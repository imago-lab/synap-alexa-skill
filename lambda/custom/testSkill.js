const { handler } = require('./index');

const SKILL_ID = process.env.ASK_SKILL_ID || 'amzn1.ask.skill.synian-assistant';
const USER_ID = process.env.ASK_TEST_USER_ID || 'amzn1.ask.account.TESTUSER';
const DEVICE_ID = process.env.ASK_TEST_DEVICE_ID || 'amzn1.ask.device.TESTDEVICE';

function createBaseEnvelope() {
    const timestamp = new Date().toISOString();

    return {
        version: '1.0',
        session: {
            new: false,
            sessionId: `SessionId.${Math.random().toString(36).slice(2)}`,
            application: {
                applicationId: SKILL_ID
            },
            user: {
                userId: USER_ID
            }
        },
        context: {
            System: {
                application: {
                    applicationId: SKILL_ID
                },
                user: {
                    userId: USER_ID
                },
                device: {
                    deviceId: DEVICE_ID,
                    supportedInterfaces: {}
                },
                apiEndpoint: 'https://api.amazonalexa.com',
                apiAccessToken: 'MOCK_ACCESS_TOKEN'
            }
        },
        request: {
            requestId: `EdwRequestId.${Math.random().toString(36).slice(2)}`,
            timestamp,
            locale: 'es-ES'
        }
    };
}

function buildLaunchRequestEnvelope() {
    const envelope = createBaseEnvelope();
    envelope.session.new = true;
    envelope.request.type = 'LaunchRequest';
    return envelope;
}

function buildGetStatusIntentEnvelope() {
    const envelope = createBaseEnvelope();
    envelope.request.type = 'IntentRequest';
    envelope.request.intent = {
        name: 'GetStatusIntent',
        confirmationStatus: 'NONE',
        slots: {}
    };
    return envelope;
}

function buildQueryIntentEnvelope(queryText) {
    const envelope = createBaseEnvelope();
    envelope.request.type = 'IntentRequest';
    envelope.request.intent = {
        name: 'QueryIntent',
        confirmationStatus: 'NONE',
        slots: {
            QueryText: {
                name: 'QueryText',
                value: queryText,
                confirmationStatus: 'NONE'
            }
        }
    };
    return envelope;
}

function extractSpeech(outputSpeech) {
    if (!outputSpeech || !outputSpeech.ssml) {
        return null;
    }

    return outputSpeech.ssml
        .replace(/^<speak>/i, '')
        .replace(/<\/speak>$/i, '')
        .trim();
}

async function invokeScenario(name, envelopeBuilder) {
    const event = envelopeBuilder();

    console.log('----------------------------------------------');
    console.log(`Invocando escenario: ${name}`);

    try {
        const response = await handler(event, {});
        const speech = extractSpeech(response.outputSpeech);
        const reprompt = extractSpeech(response.reprompt);

        console.log('Respuesta completa:', JSON.stringify(response, null, 2));

        if (speech) {
            console.log('Mensaje pronunciado:', speech);
        } else {
            console.warn('No se encontró SSML en la respuesta.');
        }

        if (reprompt) {
            console.log('Reprompt:', reprompt);
        }

        return response;
    } catch (error) {
        console.error(`Error al ejecutar ${name}`, error);
        throw error;
    }
}

async function main() {
    await invokeScenario('LaunchRequest', buildLaunchRequestEnvelope);
    await invokeScenario('GetStatusIntent', buildGetStatusIntentEnvelope);
    await invokeScenario('QueryIntent', () => buildQueryIntentEnvelope('¿Cuál es el estado del proyecto Synian?'));

    console.log('----------------------------------------------');
    console.log('Pruebas locales finalizadas.');
}

main().catch((error) => {
    console.error('El flujo de pruebas falló:', error);
    process.exitCode = 1;
});
