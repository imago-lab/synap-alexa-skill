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

// Estado temporal de sesión
let synianMode = false;
let authAttempts = 0;
let timeoutHandler = null;

// ===================================================
// 🧠 Funciones de utilidad
// ===================================================

// Limpia temporizador de inactividad
const clearTimeoutHandler = () => {
  if (timeoutHandler) clearTimeout(timeoutHandler);
  timeoutHandler = null;
};

// Retornar al modo Alexa
const returnToAlexa = (handlerInput) => {
  synianMode = false;
  clearTimeoutHandler();
  const speakOutput = `<speak>
    <lang xml:lang="es-MX">
      <voice name="Andrés">
        <prosody rate="95%" pitch="+1%">
          Volviendo a modo Alexa.
        </prosody>
      </voice>
    </lang>
  </speak>`;
  return handlerInput.responseBuilder.speak(speakOutput).getResponse();
};

// Reinicia el contador de inactividad (5 minutos)
const setInactivityTimeout = (handlerInput) => {
  clearTimeoutHandler();
  timeoutHandler = setTimeout(() => {
    returnToAlexa(handlerInput);
  }, 5 * 60 * 1000);
};

// ===================================================
// 🔐 Validación de clave con Synian Core
// ===================================================

async function validateCode(code, handlerInput) {
  const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
  const alexaUserId = handlerInput.requestEnvelope.context.System.user.userId;
  const applicationId = handlerInput.requestEnvelope.context.System.application.applicationId;

  try {
    const payload = {
      prompt: '__auth_synian_mode__',
      origin: 'alexa',
      context: {
        companyId: COMPANY_ID,
        userId: USER_ID,
        deviceId,
        alexaUserId,
        applicationId,
        timestamp: new Date().toISOString()
      },
      auth: { method: 'code', value: code }
    };

    const response = await axios.post(SYNIAN_CORE_API, payload);
    const data = response.data;

    // Si la autenticación es correcta
    if (data.status === 'OK') {
      synianMode = true;
      authAttempts = 0;
      setInactivityTimeout(handlerInput);

      const saludo = data.reply || 'Autenticación verificada. Hola, te saluda Synian.';
      const speakOutput = `<speak>
        <lang xml:lang="es-MX">
          <voice name="Andrés">
            <prosody rate="94%" pitch="+2%">
              ${saludo}
            </prosody>
          </voice>
        </lang>
      </speak>`;

      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }

    // Si la autenticación falla
    authAttempts++;
    if (authAttempts >= 3) {
      authAttempts = 0;
      const speakOutput = `<speak>
        <lang xml:lang="es-MX">
          <voice name="Andrés">
            <prosody rate="94%" pitch="+1%">
              Clave incorrecta tres veces. Bloqueando modo Synian por tres minutos.
            </prosody>
          </voice>
        </lang>
      </speak>`;
      setTimeout(() => (synianMode = false), 3 * 60 * 1000);
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    } else {
      const speakOutput = `<speak>
        <lang xml:lang="es-MX">
          <voice name="Andrés">
            <prosody rate="96%" pitch="+2%">
              Clave incorrecta. Vuelve a intentarlo, por favor.
            </prosody>
          </voice>
        </lang>
      </speak>`;
      return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
    }
  } catch (err) {
    console.error('Error conectando con Synian Core:', err.message);
    const speakOutput = `<speak>
      <lang xml:lang="es-MX">
        <voice name="Andrés">
          <prosody rate="94%" pitch="+1%">
            Hubo un problema al conectar con el sistema central.
          </prosody>
        </voice>
      </lang>
    </speak>`;
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
    const speakOutput = `<speak>
      <lang xml:lang="es-MX">
        <voice name="Andrés">
          <prosody rate="96%" pitch="+1%">
            Hola, soy Alexa, intérprete de Synian. Puedes decir “modo Synian” o “activar modo Synian”.
          </prosody>
        </voice>
      </lang>
    </speak>`;
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
      const speakOutput = `<speak>
        <lang xml:lang="es-MX">
          <voice name="Andrés">
            <prosody rate="96%" pitch="+2%">
              Por favor, dime la clave de acceso para activar modo Synian.
            </prosody>
          </voice>
        </lang>
      </speak>`;
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
      const speakOutput = `<speak>
        <lang xml:lang="es-MX">
          <voice name="Andrés">
            <prosody rate="96%" pitch="+2%">
              No entendí la clave, por favor repítela número por número.
            </prosody>
          </voice>
        </lang>
      </speak>`;
      return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
    }
    return await validateCode(code, handlerInput);
  }
};

// Conversación activa con Synian Core
const ConversacionIntentHandler = {
  canHandle: (input) =>
    synianMode &&
    Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    input.requestEnvelope.request.intent.name === 'ConversacionIntent',
  async handle(handlerInput) {
    const texto = handlerInput.requestEnvelope.request.intent.slots?.texto?.value || '';
    setInactivityTimeout(handlerInput);
    try {
      const response = await axios.post(SYNIAN_CORE_API, {
        prompt: texto,
        origin: 'alexa',
        context: { companyId: COMPANY_ID, userId: USER_ID, mode: 'synian' }
      });

      const reply = response.data.reply || 'Synian no ha respondido.';
      const speakOutput = `<speak>
        <lang xml:lang="es-MX">
          <voice name="Andrés">
            <prosody rate="95%" pitch="+2%">
              ${reply}
            </prosody>
          </voice>
        </lang>
      </speak>`;

      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    } catch (err) {
      console.error('Error comunicando con Synian Core:', err.message);
      const speakOutput = `<speak>
        <lang xml:lang="es-MX">
          <voice name="Andrés">
            <prosody rate="94%" pitch="+1%">
              Hubo un error al conectar con Synian Core.
            </prosody>
          </voice>
        </lang>
      </speak>`;
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
  }
};

// Salida manual de modo Synian
const ExitSynianIntentHandler = {
  canHandle: (input) =>
    synianMode &&
    Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    input.requestEnvelope.request.intent.name === 'ExitSynianIntent',
  handle: (input) => returnToAlexa(input)
};

// Ayuda / cancelar
const HelpIntentHandler = {
  canHandle: (input) =>
    Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    input.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent',
  handle: (input) => {
    const speakOutput = `<speak>
      <lang xml:lang="es-MX">
        <voice name="Andrés">
          <prosody rate="96%" pitch="+1%">
            Puedes decir “activa modo Synian” o “salir de modo Synian”.
          </prosody>
        </voice>
      </lang>
    </speak>`;
    return input.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
  }
};

const CancelAndStopIntentHandler = {
  canHandle: (input) =>
    Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
    ['AMAZON.CancelIntent', 'AMAZON.StopIntent'].includes(
      input.requestEnvelope.request.intent.name
    ),
  handle: (input) => returnToAlexa(input)
};

// Fin de sesión con respuesta hablada
const SessionEndedRequestHandler = {
  canHandle: (input) => Alexa.getRequestType(input.requestEnvelope) === 'SessionEndedRequest',
  handle: (input) => {
    console.log('🔚 Sesión finalizada:', JSON.stringify(input.requestEnvelope));
    clearTimeoutHandler();
    const speakOutput = `<speak>
      <lang xml:lang="es-MX">
        <voice name="Andrés">
          <prosody rate="95%" pitch="+1%">
            Hasta luego. Puedes decir “abre modo Synian” para volver a iniciar.
          </prosody>
        </voice>
      </lang>
    </speak>`;
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
    const speakOutput = `<speak>
      <lang xml:lang="es-MX">
        <voice name="Andrés">
          <prosody rate="95%" pitch="+1%">
            Hubo un problema al procesar tu solicitud. Inténtalo nuevamente en unos segundos.
          </prosody>
        </voice>
      </lang>
    </speak>`;
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