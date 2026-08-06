# Bingo de boda

La web estática incluye el generador de cartones y el bombo digital. La locución del bombo se genera en el backend con Google Cloud Text-to-Speech; ninguna credencial se entrega al navegador.

## Despliegue en Vercel y configuración de Text-to-Speech

1. Crea un proyecto en Google Cloud, activa Text-to-Speech y crea una cuenta de servicio con el permiso mínimo necesario.
2. Descarga temporalmente su JSON en un equipo seguro. En Ubuntu, conviértelo completo a Base64:

   ```bash
   base64 -w 0 nombre-del-archivo.json
   ```

3. Crea un proyecto en Vercel e importa este repositorio.
4. En **Settings → Environment Variables**, configura:
   - `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` (obligatoria): pega el resultado Base64 completo.
   - `GOOGLE_TTS_VOICE_ES` (opcional): nombre de una voz compatible con `es-ES`.
   - `GOOGLE_TTS_VOICE_IT` (opcional): nombre de una voz compatible con `it-IT`.
5. No subas nunca el JSON de la cuenta de servicio al repositorio. El `.gitignore` excluye los JSON salvo los manifiestos de npm necesarios.
6. Despliega el proyecto. Vercel servirá los archivos estáticos y ejecutará `api/tts.js` como función backend.
7. Comprueba los dos idiomas abriendo:
   - `/api/tts?numero=13&idioma=es&v=rasalgethi-v1`
   - `/api/tts?numero=13&idioma=it&v=rasalgethi-v1`

Las voces predeterminadas son `es-ES-Neural2-A` e `it-IT-Neural2-F`; las variables opcionales permiten sustituirlas sin cambiar el código.

## Audio sin conexión

El apartado **Audio del bingo** permite preparar los 180 audios (90 en español y 90 en italiano) en la caché `bingo-tts-rasalgethi-v1`. El modo **Streaming** busca primero en esa caché y guarda automáticamente cualquier audio nuevo; el modo **Sin conexión** nunca consulta el backend y continúa la partida aunque falte un audio.

Para probarlo en el navegador:

1. Abre `bombo.html` mediante HTTPS (o `localhost`), despliega **Audio del bingo** y pulsa **Preparar audios**.
2. Espera a que el estado indique `180 / 180 audios preparados`.
3. En DevTools, abre **Application → Cache Storage → bingo-tts-rasalgethi-v1** y comprueba las 180 entradas.
4. Selecciona **Sin conexión** y activa **Network → Offline**. Extrae números o usa el modo automático: las locuciones almacenadas seguirán reproduciéndose.
5. Vuelve a estar online, elimina una entrada desde Cache Storage y pulsa **Completar descarga** para verificar que solo se recupera la ausente.
6. Pulsa **Eliminar audios guardados**, confirma la acción y comprueba que únicamente desaparece `bingo-tts-rasalgethi-v1`.

## Versionado de cachés

`VERSION_AUDIO`, en `bombo.js`, debe incrementarse cuando cambie la voz, la frase, el SSML, la velocidad, el tono o cualquier otra configuración que modifique el MP3 generado. La versión forma parte tanto de la URL de TTS como del nombre de su caché.

`VERSION_APP`, en `sw.js`, debe incrementarse cuando cambien los archivos estáticos cacheados por el Service Worker. Cambiar cualquiera de estas versiones fuerza la creación de su caché nueva y evita reutilizar contenido antiguo; la aplicación elimina exclusivamente las versiones anteriores de la caché correspondiente.
