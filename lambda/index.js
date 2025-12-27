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

// Locale de Alexa antes de autenticación (solo referencia)
const getRequestLocale = (handlerInput) =>
  handlerInput.requestEnvelope.request.locale || 'es-MX';

const getSessionAttributes = (handlerInput) =>
  handlerInput.attributesManager.getSessionAttributes();

const setSessionAttributes = (handlerInput, attributes) => {
  handlerInput.attributesManager.setSessionAttributes(attributes);
};

// El estado real vive en Synian Core; aquí solo guardamos datos efímeros de sesión
const clearSynianSession = (handlerInput) => {
  const attributes = getSessionAttributes(handlerInput);
  delete attributes.synian;
  delete attributes.authAttempts;
  setSessionAttributes(handlerInput, attributes);
};

const isSynianSessionActive = (handlerInput) => {
  const attributes = getSessionAttributes(handlerInput);
  return Boolean(attributes.synian?.sessionId);
};

// Una voz oficial por idioma de Synian (no por usuario)
const resolveVoiceByLanguage = (language) => {
  const voices = {
    'es-MX': { name: 'Andrés', locale: 'es-MX' },
    'es-ES': { name: 'Sergio', locale: 'es-ES' },
    'en-US': { name: 'Matthew', locale: 'en-US' },
    'pt-BR': { name: 'Ricardo', locale: 'pt-BR' }
  };

  return voices[language] || voices['es-MX'];
};

const buildAlexaSSML = (text, locale) => `<speak>
  <lang xml:lang="${locale}">
    ${text}
  </lang>
</speak>`;

const buildSynianSSML = (text, language) => {
  const voice = resolveVoiceByLanguage(language);
  return `<speak>
    <lang xml:lang="${voice.locale}">
      <voice name="${voice.name}">
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

const isSessionExpiredResponse = (data) =>
  data?.status === 'SESSION_EXPIRED' ||
  data?.error?.code === 'SESSION_EXPIRED';

const requestSynianCore = async (payload) => {
  const response = await axios.post(SYNIAN_CORE_API, payload);
  return response.data;
};

// ===================================================
// 🔐 Validación de clave con Synian Core
// ===================================================

async function validateCode(code, handlerInput) {
  const attributes = getSessionAttributes(handlerInput);
  const attempts = attributes.authAttempts || 0;
  try {
    const payload = {
      prompt: '__auth_synian_mode__',
      origin: 'alexa',
      context: buildCoreContext(handlerInput),
      auth: { method: 'totp', value: code }
    };

    const data = await requestSynianCore(payload);

    // Si la autenticación es correcta
    if (data.status === 'OK') {
      const synianSession = {
        sessionId: data.sessionId,
        language: data.language || getRequestLocale(handlerInput),
        preferredName: data.preferredName || ''
      };
      setSessionAttributes(handlerInput, {
        ...attributes,
        synian: synianSession,
        authAttempts: 0
      });

      const saludo =
        data.reply ||
        `Autenticación verificada. Hola ${synianSession.preferredName || ''}, te saluda Synian.`;
      const speakOutput = buildSynianSSML(saludo.trim(), synianSession.language);
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }

    // Si la autenticación falla
    const nextAttempts = attempts + 1;
    setSessionAttributes(handlerInput, { ...attributes, authAttempts: nextAttempts });

    const locale = getRequestLocale(handlerInput);
    if (nextAttempts >= 3) {
      clearSynianSession(handlerInput);
      const speakOutput = buildAlexaSSML(
        'Clave incorrecta tres veces. Por seguridad, vuelve a iniciar el modo Synian.',
        locale
      );
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }

    const speakOutput = buildAlexaSSML(
      'Clave incorrecta. Vuelve a intentarlo, por favor.',
      locale
    );
    return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
  } catch (err) {
    console.error('Error conectando con Synian Core:', err.message);
    const speakOutput = buildAlexaSSML(
      'Hubo un problema al conectar con el sistema central.',
      getRequestLocale(handlerInput)
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
    const speakOutput = buildAlexaSSML(
      'Hola, soy Alexa, intérprete de Synian. Puedes decir “modo Synian” o “activar modo Synian”.',
      getRequestLocale(input)
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
    const codeSlot = handlerInput.requestEnvelope.request.intent.slots?.clave?.value;

    if (!codeSlot) {
      const speakOutput = buildAlexaSSML(
        'Por favor, dime el código TOTP para activar modo Synian.',
        getRequestLocale(handlerInput)
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
    const code = handlerInput.requestEnvelope.request.intent.slots?.clave?.value;
    if (!code) {
      const speakOutput = buildAlexaSSML(
        'No entendí el código. Por favor repítelo número por número.',
        getRequestLocale(handlerInput)
      );
      return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
    }
    return await validateCode(code, handlerInput);
  }
};

// Conversación activa con Synian Core
const ConversacionIntentHandler = {
  canHandle: (input) =>
    isSynianSessionActive(input) &&
    Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    input.requestEnvelope.request.intent.name === 'ConversacionIntent',
  async handle(handlerInput) {
    const texto = handlerInput.requestEnvelope.request.intent.slots?.texto?.value || '';
    const attributes = getSessionAttributes(handlerInput);
    const synianSession = attributes.synian || {};
    try {
      const response = await requestSynianCore({
        prompt: texto,
        origin: 'alexa',
        context: {
          ...buildCoreContext(handlerInput, synianSession.sessionId),
          mode: 'synian'
        }
      });

      if (isSessionExpiredResponse(response)) {
        clearSynianSession(handlerInput);
        const speakOutput = buildAlexaSSML(
          'Tu sesión de Synian expiró. Por favor, vuelve a decir “modo Synian” para autenticarte.',
          getRequestLocale(handlerInput)
        );
        return handlerInput.responseBuilder.speak(speakOutput).getResponse();
      }

      const reply = response.reply || 'Synian no ha respondido.';
      const speakOutput = buildSynianSSML(reply, synianSession.language);

      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    } catch (err) {
      console.error('Error comunicando con Synian Core:', err.message);
      const speakOutput = buildSynianSSML(
        'Hubo un error al conectar con Synian Core.',
        synianSession.language || getRequestLocale(handlerInput)
      );
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
  }
};

// Salida manual de modo Synian
const ExitSynianIntentHandler = {
  canHandle: (input) =>
    isSynianSessionActive(input) &&
    Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    input.requestEnvelope.request.intent.name === 'ExitSynianIntent',
  async handle(handlerInput) {
    const attributes = getSessionAttributes(handlerInput);
    const synianSession = attributes.synian || {};
    try {
      if (synianSession.sessionId) {
        await requestSynianCore({
          prompt: '__end_synian_session__',
          origin: 'alexa',
          context: buildCoreContext(handlerInput, synianSession.sessionId)
        });
      }
    } catch (err) {
      console.error('Error cerrando sesión en Synian Core:', err.message);
    }

    clearSynianSession(handlerInput);
    const speakOutput = buildAlexaSSML(
      'Volviendo a modo Alexa.',
      getRequestLocale(handlerInput)
    );
    return handlerInput.responseBuilder.speak(speakOutput).getResponse();
  }
};

// Ayuda / cancelar
const HelpIntentHandler = {
  canHandle: (input) =>
    Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    input.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent',
  handle: (input) => {
    const speakOutput = buildAlexaSSML(
      'Puedes decir “activa modo Synian” o “salir de modo Synian”.',
      getRequestLocale(input)
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
    const speakOutput = buildAlexaSSML('Volviendo a modo Alexa.', getRequestLocale(input));
    return input.responseBuilder.speak(speakOutput).getResponse();
  }
};

// Fin de sesión con respuesta hablada
const SessionEndedRequestHandler = {
  canHandle: (input) => Alexa.getRequestType(input.requestEnvelope) === 'SessionEndedRequest',
  handle: (input) => {
    console.log('🔚 Sesión finalizada:', JSON.stringify(input.requestEnvelope));
    clearSynianSession(input);
    const speakOutput = buildAlexaSSML(
      'Hasta luego. Puedes decir “abre modo Synian” para volver a iniciar.',
      getRequestLocale(input)
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
    const speakOutput = buildAlexaSSML(
      'Hubo un problema al procesar tu solicitud. Inténtalo nuevamente en unos segundos.',
      getRequestLocale(handlerInput)
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
