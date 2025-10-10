const Alexa = require('ask-sdk-core');
const axios = require('axios');

// URL pública del módulo Synian Core (puede ser HTTP o HTTPS)
const SYNIAN_CORE_API = 'https://api.synian.app/core/query'; // ← cambia esta URL por la real

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Hola, soy Synian Assistant. ¿Qué deseas consultar hoy?';
        return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
    }
};

const ConversacionIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    async handle(handlerInput) {
        const userSpeech = handlerInput.requestEnvelope.request.intent
            ?.slots?.texto?.value || handlerInput.requestEnvelope.request.intent.name;

        try {
            const response = await axios.post(SYNIAN_CORE_API, {
                prompt: userSpeech,
                origin: 'alexa'
            });

            const speakOutput = response.data.reply || 'Lo siento, no obtuve respuesta de Synian.';
            return handlerInput.responseBuilder.speak(speakOutput).getResponse();
        } catch (error) {
            console.error('Error al conectar con Synian Core:', error.message);
            const speakOutput = 'Hubo un problema al conectar con el sistema central.';
            return handlerInput.responseBuilder.speak(speakOutput).getResponse();
        }
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        ConversacionIntentHandler
    )
    .lambda();
