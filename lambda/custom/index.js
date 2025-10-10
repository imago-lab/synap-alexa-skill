/* *
 * This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
 * Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
 * session persistence, api calls, and more.
 * */
const Alexa = require('ask-sdk-core');
const axios = require('axios');
// i18n library dependency, we use it below in a localisation interceptor
const i18n = require('i18next');
// i18n strings for all supported locales
const languageStrings = require('./languageStrings');

const SYNIAN_FALLBACK_MESSAGE = 'No pude comunicarme con Synian en este momento, intenta más tarde.';

class SynianConnector {
    constructor(logger = console) {
        this.logger = logger;
        const headers = {
            'Content-Type': 'application/json'
        };
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
            const payload = {
                query,
                ...metadata
            };
            const { data } = await this.client.post('/alexa-query', payload);
            return data;
        } catch (error) {
            this.logError('sendQuery', error);
            throw error;
        }
    }

    async sendCommand(command, metadata = {}) {
        try {
            const payload = {
                command,
                ...metadata
            };
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
        const speakOutput = handlerInput.t('WELCOME_MSG');

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const HelloWorldIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'HelloWorldIntent';
    },
    handle(handlerInput) {
        const speakOutput = handlerInput.t('HELLO_MSG');

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
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
        const speakOutput = handlerInput.t('HELP_MSG');

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
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
        const speakOutput = handlerInput.t('GOODBYE_MSG');

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet 
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = handlerInput.t('FALLBACK_MSG');

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open 
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not 
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs 
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents 
 * by defining them above, then also adding them to the request handler chain below 
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = handlerInput.t('REFLECTOR_MSG', {intentName: intentName});

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below 
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = handlerInput.t('ERROR_MSG');
        console.log(`~~~~ Error handled: ${JSON.stringify(error.stack)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// This request interceptor will bind a translation function 't' to the handlerInput
const LocalisationRequestInterceptor = {
    process(handlerInput) {
        i18n.init({
            lng: Alexa.getLocale(handlerInput.requestEnvelope),
            resources: languageStrings
        }).then((t) => {
            handlerInput.t = (...args) => t(...args);
        });
    }
};
/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom 
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        HelloWorldIntentHandler,
        GetStatusIntentHandler,
        QueryIntentHandler,
        CommandIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler)
    .addErrorHandlers(
        ErrorHandler)
    .addRequestInterceptors(
        LocalisationRequestInterceptor)
    .withCustomUserAgent('sample/hello-world/v1.2')
    .lambda();
