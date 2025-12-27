const Alexa = require('ask-sdk-core');
const axios = require('axios');

// ===================================================
// ⚙️ Configuración general
// ===================================================

// Endpoint principal de Synian Core (IA)
const SYNIAN_CORE_API = 'https://api.synian.app/core/query';

// Variables seguras (pueden venir del entorno)
const COMPANY_ID = process.env.COMPANY_ID || '00000000-0000-0000-0000-000000000000';
const USER_ID = process.env.USER_ID || '00000000-0000-0000-0000-000000000000';

// ===================================================
// 🧠 Funciones de utilidad
// ===================================================

const getSessionAttributes = (handlerInput) =>
  handlerInput.attributesManager.getSessionAttributes();

const setSessionAttributes = (handlerInput, attributes) => {
  handlerInput.attributesManager.setSessionAttributes(attributes);
};

const clearSynianSession = (handlerInput) => {
  setSessionAttributes(handlerInput, {});
};

const buildAlexaSpeech = (text) => `<speak>${text}</speak>`;

const buildSynianSpeech = (text, language, voiceProfile) => {
  if (!language || !voiceProfile) {
    return buildAlexaSpeech(text);
  }
  return `<speak>
    <lang xml:lang="${language}">
      <voice name="${voiceProfile}">
        <prosody rate="95%" pitch="+1%">
          ${text}
        </prosody>
      </voice>
    </lang>
  </speak>`;
};

const buildCoreContext = (handlerInput, sessionId) => {
  const system = handlerInput.requestEnvelope.context.System;
  return {
    companyId: COMPANY_ID,
    userId: USER_ID,
    deviceId: system.device.deviceId,
    alexaUserId: system.user.userId,
    applicationId: system.application.applicationId,
    sessionId,
    timestamp: new Date().toISOString()
  };
};

const requestSynianCore = async (payload) => {
  const response = await axios.post(SYNIAN_CORE_API, payload);
  return response.data;
};

const isSessionExpired = (expiresAt) => {
  if (!expiresAt) {
    return true;
  }
  const expiryTime = new Date(expiresAt).getTime();
  if (Number.isNaN(expiryTime)) {
    return true;
  }
  return Date.now() >= expiryTime;
};

const getActiveSession = (handlerInput) => {
  const attributes = getSessionAttributes(handlerInput);
  if (!attributes.sessionId || isSessionExpired(attributes.expiresAt)) {
    return null;
  }
  return attributes;
};

const handleExpiredSession = (handlerInput) => {
  clearSynianSession(handlerInput);
  const speakOutput = buildAlexaSpeech(
    'Tu sesión expiró. Por favor, dime el código TOTP para continuar.'
  );
  return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
};

// ===================================================
// 🔐 Validación de clave con Synian Core
// ===================================================

async function validateCode(code, handlerInput) {
  try {
    const payload = {
      prompt: '__auth_synian_mode__',
      origin: 'alexa',
      context: buildCoreContext(handlerInput),
      auth: { method: 'totp', value: code }
    };

    const data = await requestSynianCore(payload);

    if (data.authStatus === 'OK') {
      setSessionAttributes(handlerInput, {
        sessionId: data.sessionId,
        expiresAt: data.expiresAt
      });

      const preferredName = data.userDisplayName ? data.userDisplayName.trim() : '';
      const greetingName = preferredName ? `Hola ${preferredName},` : 'Hola,';
      const saludo =
        data.reply ||
        `Autenticación verificada. ${greetingName} te saluda Synian.`;
      const speakOutput = buildSynianSpeech(saludo.trim(), data.language, data.voiceProfile);
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }

    clearSynianSession(handlerInput);
    const speakOutput = buildAlexaSpeech(
      'No pude validar el código. Inténtalo de nuevo, por favor.'
    );
    return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
  } catch (err) {
    console.error('Error conectando con Synian Core:', err.message);
    const speakOutput = buildAlexaSpeech(
      'Hubo un problema al conectar con el sistema central.'
    );
    return handlerInput.responseBuilder.speak(speakOutput).getResponse();
  }
}

// ===================================================
// 🎯 INTENTS PRINCIPALES
// ===================================================

// Inicio normal
const LaunchRequestHandler = {
  canHandle: (input) => Alexa.getRequestType(input.requestEnvelope) === 'LaunchRequest',
  handle: (input) => {
    const speakOutput = buildAlexaSpeech(
      'Hola, soy Alexa, intérprete de Synian. Puedes decir “modo Synian” o “activar modo Synian”.'
    );
    return input.responseBuilder.speak(speakOutput).reprompt('¿Deseas activar el modo Synian?').getResponse();
  }
};

// Activar modo Synian (con o sin clave)
const ActivateSynianIntentHandler = {
  canHandle: (input) =>
    Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    input.requestEnvelope.request.intent.name === 'ActivateSynianIntent',
  async handle(handlerInput) {
    const attributes = getSessionAttributes(handlerInput);
    if (attributes.expiresAt && isSessionExpired(attributes.expiresAt)) {
      return handleExpiredSession(handlerInput);
    }

    const codeSlot = handlerInput.requestEnvelope.request.intent.slots?.clave?.value;

    if (!codeSlot) {
      const speakOutput = buildAlexaSpeech(
        'Por favor, dime el código TOTP para activar modo Synian.'
      );
      return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
    }

    return await validateCode(codeSlot, handlerInput);
  }
};

// Si el usuario responde solo con el código
const ProvideCodeIntentHandler = {
  canHandle: (input) =>
    Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    input.requestEnvelope.request.intent.name === 'ProvideCodeIntent',
  async handle(handlerInput) {
    const attributes = getSessionAttributes(handlerInput);
    if (attributes.expiresAt && isSessionExpired(attributes.expiresAt)) {
      return handleExpiredSession(handlerInput);
    }

    const code = handlerInput.requestEnvelope.request.intent.slots?.clave?.value;
    if (!code) {
      const speakOutput = buildAlexaSpeech(
        'No entendí el código. Por favor repítelo número por número.'
      );
      return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
    }
    return await validateCode(code, handlerInput);
  }
};

// Conversación activa con Synian Core
const ConversacionIntentHandler = {
  canHandle: (input) =>
    Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    input.requestEnvelope.request.intent.name === 'ConversacionIntent',
  async handle(handlerInput) {
    const texto = handlerInput.requestEnvelope.request.intent.slots?.texto?.value || '';
    const attributes = getSessionAttributes(handlerInput);
    if (attributes.expiresAt && isSessionExpired(attributes.expiresAt)) {
      return handleExpiredSession(handlerInput);
    }
    const activeSession = getActiveSession(handlerInput);
    if (!activeSession) {
      const speakOutput = buildAlexaSpeech(
        'Para continuar necesito autenticarte. Dime “modo Synian”.'
      );
      return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
    }
    try {
      const response = await requestSynianCore({
        prompt: texto,
        origin: 'alexa',
        context: {
          ...buildCoreContext(handlerInput, activeSession.sessionId),
          mode: 'synian'
        }
      });

      const reply = response.reply || 'Synian no ha respondido.';
      const speakOutput = buildSynianSpeech(reply, response.language, response.voiceProfile);

      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    } catch (err) {
      console.error('Error comunicando con Synian Core:', err.message);
      const speakOutput = buildAlexaSpeech('Hubo un error al conectar con Synian Core.');
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
  }
};

// Salida manual de modo Synian
const ExitSynianIntentHandler = {
  canHandle: (input) =>
    Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    input.requestEnvelope.request.intent.name === 'ExitSynianIntent',
  async handle(handlerInput) {
    const attributes = getSessionAttributes(handlerInput);
    if (attributes.expiresAt && isSessionExpired(attributes.expiresAt)) {
      return handleExpiredSession(handlerInput);
    }
    try {
      if (attributes.sessionId) {
        await requestSynianCore({
          prompt: '__end_synian_session__',
          origin: 'alexa',
          context: buildCoreContext(handlerInput, attributes.sessionId)
        });
      }
    } catch (err) {
      console.error('Error cerrando sesión en Synian Core:', err.message);
    }

    clearSynianSession(handlerInput);
    const speakOutput = buildAlexaSpeech('Volviendo a modo Alexa.');
    return handlerInput.responseBuilder.speak(speakOutput).getResponse();
  }
};

// Ayuda / cancelar
const HelpIntentHandler = {
  canHandle: (input) =>
    Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    input.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent',
  handle: (input) => {
    const attributes = getSessionAttributes(input);
    if (attributes.expiresAt && isSessionExpired(attributes.expiresAt)) {
      return handleExpiredSession(input);
    }
    const speakOutput = buildAlexaSpeech(
      'Puedes decir “activa modo Synian” o “salir de modo Synian”.'
    );
    return input.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
  }
};

const CancelAndStopIntentHandler = {
  canHandle: (input) =>
    Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    ['AMAZON.CancelIntent', 'AMAZON.StopIntent'].includes(
      input.requestEnvelope.request.intent.name
    ),
  handle: (input) => {
    clearSynianSession(input);
    const speakOutput = buildAlexaSpeech('Volviendo a modo Alexa.');
    return input.responseBuilder.speak(speakOutput).getResponse();
  }
};

// Fin de sesión con respuesta hablada
const SessionEndedRequestHandler = {
  canHandle: (input) => Alexa.getRequestType(input.requestEnvelope) === 'SessionEndedRequest',
  handle: (input) => {
    console.log('🔚 Sesión finalizada:', JSON.stringify(input.requestEnvelope));
    clearSynianSession(input);
    const speakOutput = buildAlexaSpeech(
      'Hasta luego. Puedes decir “abre modo Synian” para volver a iniciar.'
    );
    return input.responseBuilder.speak(speakOutput).getResponse();
  }
};

// ===================================================
// ⚠️ Manejador de errores global
// ===================================================
const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error('⚠️ Error global:', error);
    const speakOutput = buildAlexaSpeech(
      'Hubo un problema al procesar tu solicitud. Inténtalo nuevamente en unos segundos.'
    );
    return handlerInput.responseBuilder.speak(speakOutput).reprompt('¿Deseas intentar de nuevo?').getResponse();
  }
};

// ===================================================
// 🧩 Exportar skill principal
// ===================================================
exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    ActivateSynianIntentHandler,
    ProvideCodeIntentHandler,
    ConversacionIntentHandler,
    ExitSynianIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
