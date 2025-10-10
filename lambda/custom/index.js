const Alexa = require('ask-sdk-core');
const axios = require('axios');

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        console.info('LaunchRequest received');
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
        console.info('GetStatusIntent received');

        try {
            const response = await axios.get('https://api.synian.app/status');
            console.info('Status API response', response.data);

            let statusMessage;
            if (response && response.data) {
                if (typeof response.data === 'string') {
                    statusMessage = response.data;
                } else if (response.data.message) {
                    statusMessage = response.data.message;
                } else if (response.data.status) {
                    statusMessage = response.data.status;
                }
            }

            const speakOutput = statusMessage
                ? `El estado actual de Synian es: ${statusMessage}.`
                : 'Synian está operativo en este momento.';

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt('¿Necesitas algo más?')
                .getResponse();
        } catch (error) {
            console.error('Error retrieving status', error);
            const speakOutput = 'Lo siento, no puedo obtener el estado de Synian en este momento. ¿Quieres intentar de nuevo más tarde?';

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt('¿Quieres intentar otra cosa?')
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
        console.info('QueryIntent received');
        const locale = Alexa.getLocale(handlerInput.requestEnvelope);
        const request = handlerInput.requestEnvelope.request;
        const userInput = request.intent && request.intent.slots && request.intent.slots.QueryText
            ? request.intent.slots.QueryText.value
            : undefined;

        if (!userInput) {
            console.info('QueryIntent invoked without QueryText slot');
            const speakOutput = 'No escuché tu consulta. ¿Podrías repetirla?';
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt('¿Qué deseas preguntar a Synian?')
                .getResponse();
        }

        try {
            const response = await axios.post('https://api.synian.app/alexa-query', {
                query: userInput,
                locale
            });
            console.info('Query API response', response.data);

            let answer;
            if (response && response.data) {
                if (typeof response.data === 'string') {
                    answer = response.data;
                } else if (response.data.answer) {
                    answer = response.data.answer;
                } else if (response.data.message) {
                    answer = response.data.message;
                }
            }

            const speakOutput = answer || 'Synian no tiene una respuesta en este momento.';

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt('¿Hay algo más en lo que pueda ayudarte?')
                .getResponse();
        } catch (error) {
            console.error('Error invoking Synian Core', error);
            const speakOutput = 'Ocurrió un problema al comunicarme con Synian. ¿Quieres intentar de nuevo?';

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt('¿Quieres intentar algo diferente?')
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
        console.info('HelpIntent received');
        const speakOutput = 'Puedes preguntarme por el estado de Synian o pedirle a Synian que responda tus consultas. ¿Qué deseas hacer?';

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
        console.info('Cancel or Stop intent received');
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
        console.info(`IntentReflector handling intent: ${intentName}`);
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
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler
    )
    .addErrorHandlers(ErrorHandler)
    .withCustomUserAgent('synian-assistant/v1.0')
    .lambda();
