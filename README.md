# Synian Alexa Skill

Este repositorio contiene el código del skill **Synian Assistant** para Alexa. El backend se ejecuta en AWS Lambda y delega las respuestas en los servicios de Synian para devolver información de estado y responder consultas.

## Requisitos previos

* [Node.js](https://nodejs.org/) 18.x o superior.
* [ASK CLI](https://developer.amazon.com/en-US/docs/alexa/smapi/quick-start-alexa-skills-kit-command-line-interface.html) configurado con tus credenciales de AWS.
* Acceso a la consola de [Alexa Developer](https://developer.amazon.com/alexa/console/ask) con el skill Synian Assistant importado.

## Instalación de dependencias

Todos los scripts se ejecutan desde el directorio `lambda/custom` porque allí se encuentra el código de la función Lambda y su `package.json`.

```bash
cd lambda/custom
npm install
```

## Pruebas locales con peticiones JSON

El script `testSkill.js` emula las peticiones principales del skill utilizando el manejador de Lambda exportado en `index.js`.

1. Ajusta las variables de entorno según sea necesario:
   * `ASK_SKILL_ID`: identifica el skill en pruebas (por defecto `amzn1.ask.skill.synian-assistant`).
   * `ASK_TEST_USER_ID` y `ASK_TEST_DEVICE_ID`: opcional para personalizar los identificadores simulados.
2. Ejecuta el flujo completo:

```bash
npm run local-test
```

El comando lanza secuencialmente un `LaunchRequest`, el intent `GetStatusIntent` y el intent `QueryIntent`. En la consola verás las respuestas completas generadas por la API de Synian, incluidos los mensajes SSML que Alexa pronunciaría y los reprompts configurados.

## Despliegue al entorno `development`

La configuración de ASK CLI define un entorno llamado `development` que apunta al ARN de la función Lambda `SynianAssistantDev` en la región `us-east-1` (`.ask/config`). Para publicar cambios en dicho entorno ejecuta:

```bash
npm run deploy
```

El script invoca `ask deploy --env development`, desplegando tanto el modelo del skill como el código Lambda. Si necesitas usar un perfil diferente de ASK CLI puedes anteponer `ASK_PROFILE=<tu_perfil>` al comando anterior.

## Verificación en la Alexa Developer Console

1. Accede a la consola de Alexa Developer y abre el skill Synian Assistant.
2. En la pestaña **Build**, verifica que los intents `GetStatusIntent` y `QueryIntent` aparezcan en el Interaction Model. Publica los cambios si realizas ajustes.
3. Cambia a la pestaña **Test** y habilita el modo **Development** en la parte superior derecha.
4. Utiliza el simulador de texto o voz para lanzar el skill (`"Alexa, abre Synian Assistant"`) y probar los intents (`"¿Cuál es el estado de Synian?"`, `"Pregunta a Synian qué novedades hay"`). Las respuestas deben coincidir con lo obtenido mediante `npm run local-test`, ya que ambas provienen del backend Synian accesible desde `https://api.synian.app`.

## Conexión con un dispositivo físico Alexa

1. Abre la aplicación móvil **Amazon Alexa** con la misma cuenta desarrolladora.
2. Ve a **Más → Skills y juegos → Tus Skills → Desarrollo** y habilita *Synian Assistant*.
3. Asegúrate de que el dispositivo Alexa esté asociado a dicha cuenta. Puedes comprobarlo en **Dispositivos → Echo y Alexa**.
4. Invoca el skill desde el dispositivo físico con los mismos comandos utilizados en el simulador. El dispositivo usará el modelo y backend desplegados mediante `ask deploy`, por lo que escucharás las respuestas generadas por Synian en tiempo real.

## Recursos adicionales

* [Documentación de ASK SDK para Node.js](https://www.npmjs.com/package/ask-sdk-core)
* [Documentación oficial de ASK](https://developer.amazon.com/docs)
