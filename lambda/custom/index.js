const Alexa = require('ask-sdk-core');
const axios = require('axios');
const i18n = require('i18next');
const languageStrings = require('./languageStrings');

const SYNIAN_FALLBACK_MESSAGE = 'No pude comunicarme con Synian en este momento, intenta más tarde.';

class SynianConnector {
    constructor(logger = console) {
        this.logger = logger;
        const headers = { 'Content-Type': 'application/json' };
        const apiKey = process.env.SYNIAN_API_KEY;

        if (apiKey) {
            headers.Authorization = `Bearer ${apiKey}`;
        }

        this.client = axios.create({
            baseURL: 'https://api.synian.app',
            timeout: 8000,
            headers
        });
    }

    async getStatus() {
        try {
            const { data } = await this.client.get('/status');
            return data;
        } catch (error) {
            this.logError('getStatus', error);
            throw error;
        }
    }

    async sendQuery(query, metadata = {}) {
        try {
            const payload = { query, ...metadata };
            const { data } = await this.client.post('/alexa-query', payload);
            return data;
        } catch (error) {
            this.logError('sendQuery', error);
            throw error;
        }
    }

    async sendCommand(command, metadata = {}) {
        try {
            const payload = { command, ...metadata };
            const { data } = await this.client.post('/command', payload);
            return data;
        } catch (error) {
            this.logError('sendCommand', error);
            throw error;
        }
    }

    logError(operation, error) {
        const message = error?.response?.data || error?.message || error;
        this.logger.error(`SynianConnector ${operation} error:`, message);
    }
}

const synianConnector = new SynianConnector();

const getFirstSlotValue = (handlerInput) => {
    const slots = handlerInput?.requestEnvelope?.request?.intent?.slots || {};
    const firstSlotWithValue = Object.values(slots).find((slot) => slot && slot.value);
    return firstSlotWithValue ? firstSlotWithValue.value : undefined;
};

const extractMetadata = (handlerInput) => ({
    locale: Alexa.getLocale(handlerInput.requestEnvelope),
    userId: handlerInput.requestEnvelope?.context?.System?.user?.userId
});

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Hola, soy Synian. ¿En qué puedo ayudarte hoy?';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('¿En qué puedo ayudarte hoy?')
            .getResponse();
    }
};

const GetStatusIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetStatusIntent';
    },
    async handle(handlerInput) {
        try {
            const status = await synianConnector.getStatus();
            const isOnline = Boolean(status?.online) || (typeof status?.status === 'string' && status.status.toLowerCase() === 'ok');
            const speakOutput = isOnline
                ? 'Synian está en línea y listo para ayudarte.'
                : 'Synian no está disponible en este momento.';

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
        } catch (error) {
            console.error('GetStatusIntent error:', error);
            return handlerInput.responseBuilder
                .speak(SYNIAN_FALLBACK_MESSAGE)
                .getResponse();
        }
    }
};

const QueryIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'QueryIntent';
    },
    async handle(handlerInput) {
        const userQuery = getFirstSlotValue(handlerInput);
        if (!userQuery) {
            return handlerInput.responseBuilder
                .speak('Necesito que me digas qué quieres saber de Synian.')
                .reprompt('¿Qué quieres preguntar a Synian?')
                .getResponse();
        }

        try {
            const metadata = extractMetadata(handlerInput);
            const response = await synianConnector.sendQuery(userQuery, metadata);
            const speakOutput = response?.reply || response?.response || response?.message;

            if (speakOutput) {
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .getResponse();
            }

            console.warn('QueryIntent empty response from Synian:', response);
            return handlerInput.responseBuilder
                .speak(SYNIAN_FALLBACK_MESSAGE)
                .getResponse();
        } catch (error) {
            console.error('QueryIntent error:', error);
            return handlerInput.responseBuilder
                .speak(SYNIAN_FALLBACK_MESSAGE)
                .getResponse();
        }
    }
};

const CommandIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'CommandIntent';
    },
    async handle(handlerInput) {
        const commandText = getFirstSlotValue(handlerInput);
        if (!commandText) {
            return handlerInput.responseBuilder
                .speak('Necesito que me digas qué acción deseas que Synian ejecute.')
                .reprompt('Indica el comando que debo enviar a Synian.')
                .getResponse();
        }

        try {
            const metadata = extractMetadata(handlerInput);
            const response = await synianConnector.sendCommand(commandText, metadata);
            const speakOutput = response?.confirmation || response?.message || response?.status;

            if (speakOutput) {
                return handlerInput.responseBuilder
                    .speak(typeof speakOutput === 'string' ? speakOutput : JSON.stringify(speakOutput))
                    .getResponse();
            }

            console.warn('CommandIntent empty response from Synian:', response);
            return handlerInput.responseBuilder
                .speak('Tu comando fue enviado a Synian.')
                .getResponse();
        } catch (error) {
            console.error('CommandIntent error:', error);
            return handlerInput.responseBuilder
                .speak(SYNIAN_FALLBACK_MESSAGE)
                .getResponse();
        }
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Puedes preguntarme por el estado de Synian o pedirle que responda tus consultas. ¿Qué deseas hacer?';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('¿Qué deseas hacer?')
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak('Hasta luego.')
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.info('Session ended', handlerInput.requestEnvelope);
        return handlerInput.responseBuilder.getResponse();
    }
};

const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `Acabas de activar ${intentName}.`;
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error('Global error handler invoked', error);
        const speakOutput = 'Lo siento, ocurrió un error. Intenta de nuevo.';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('¿Puedes intentarlo de nuevo?')
            .getResponse();
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        GetStatusIntentHandler,
        QueryIntentHandler,
        CommandIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler
    )
    .addErrorHandlers(ErrorHandler)
    .withCustomUserAgent('synian-assistant/v1.0')
    .lambda();