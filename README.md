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
   - `/api/tts?numero=13&idioma=es`
   - `/api/tts?numero=13&idioma=it`

Las voces predeterminadas son `es-ES-Neural2-A` e `it-IT-Neural2-F`; las variables opcionales permiten sustituirlas sin cambiar el código.
