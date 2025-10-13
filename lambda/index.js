const Alexa = require('ask-sdk-core');
const axios = require('axios');

const SYNIAN_CORE_API = 'https://api.synian.app/core/query'; // Cambia esta URL si es necesario
let modoSynian = false;
let intentosFallidos = 0;
let temporizadorModo = null;

function iniciarTemporizador(handlerInput) {
    if (temporizadorModo) clearTimeout(temporizadorModo);
    temporizadorModo = setTimeout(() => {
        modoSynian = false;
        console.log('⏳ Tiempo de inactividad. Regresando a modo Alexa.');
    }, 5 * 60 * 1000); // 5 minutos
}

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        console.log('🚀 LaunchRequest ejecutado');
        const speakOutput = 'Hola, soy Synian Assistant. ¿Qué deseas consultar hoy?';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const ModoSynianIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'ModoSynianIntent';
    },
    handle(handlerInput) {
        console.log('🧠 Activando modo Synian');
        const speakOutput = 'Por favor, indica la clave de acceso.';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('Dime la clave para acceder al modo Synian.')
            .getResponse();
    }
};

const ClaveIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'ClaveIntent';
    },
    handle(handlerInput) {
        const clave = handlerInput.requestEnvelope.request.intent.slots?.clave?.value;
        console.log('🔐 Clave ingresada:', clave);

        if (clave === '123456') {
            modoSynian = true;
            intentosFallidos = 0;
            iniciarTemporizador(handlerInput);
            const speakOutput = 'Acceso concedido. Soy Synian.';
            return handlerInput.responseBuilder.speak(speakOutput).getResponse();
        } else {
            intentosFallidos++;
            if (intentosFallidos >= 3) {
                modoSynian = false;
                intentosFallidos = 0;
                const speakOutput = 'Clave incorrecta tres veces. Volviendo a modo Alexa.';
                return handlerInput.responseBuilder.speak(speakOutput).getResponse();
            }
            const speakOutput = 'Clave incorrecta. Vuelve a intentarlo.';
            return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
        }
    }
};

const ConversacionIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    async handle(handlerInput) {
        const userSpeech =
            handlerInput.requestEnvelope.request.intent.slots?.texto?.value ||
            handlerInput.requestEnvelope.request.intent.name;

        console.log('💬 Entrada del usuario:', userSpeech);
        iniciarTemporizador(handlerInput);

        if (!modoSynian) {
            const speakOutput = 'Estoy en modo Alexa. Dime "activa modo Synian" para entrar al modo especial.';
            return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
        }

        try {
            const response = await axios.post(SYNIAN_CORE_API, {
                prompt: userSpeech,
                origin: 'alexa'
            });

            const speakOutput = response.data?.reply || 'No obtuve respuesta de Synian.';
            return handlerInput.responseBuilder.speak(speakOutput).getResponse();
        } catch (error) {
            console.error('❌ Error al conectar con Synian Core:', error.message);
            const speakOutput = 'Hubo un problema al conectar con el sistema central.';
            return handlerInput.responseBuilder.speak(speakOutput).getResponse();
        }
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error('🔥 Error inesperado:', error.stack || error.message);
        const speakOutput = 'Ha ocurrido un error interno en la skill.';
        return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        ModoSynianIntentHandler,
        ClaveIntentHandler,
        ConversacionIntentHandler
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();