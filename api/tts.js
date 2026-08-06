"use strict";

const textToSpeech = require("@google-cloud/text-to-speech");
const { validarConsulta, crearSsml } = require("../lib/tts");

const CONFIGURACION = {
    es: { languageCode: "es-ES", voiceEnv: "GOOGLE_TTS_VOICE_ES", defaultVoice: "es-ES-Neural2-A" },
    it: { languageCode: "it-IT", voiceEnv: "GOOGLE_TTS_VOICE_IT", defaultVoice: "it-IT-Neural2-F" }
};

function responderError(response, estado, mensaje) {
    response.status(estado).json({ error: mensaje });
}

module.exports = async function tts(request, response) {
    if (request.method !== "GET") {
        response.setHeader("Allow", "GET");
        return responderError(response, 405, "Método no permitido");
    }

    const consulta = validarConsulta(request.query);
    if (!consulta) return responderError(response, 400, "Parámetros no válidos");
    const { numero, idioma } = consulta;

    try {
        const base64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
        if (!base64) return responderError(response, 500, "Servicio de audio no configurado");
        const credentials = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
        if (!credentials.client_email || !credentials.private_key || !credentials.project_id) {
            return responderError(response, 500, "Servicio de audio no configurado");
        }

        const config = CONFIGURACION[idioma];
        const client = new textToSpeech.TextToSpeechClient({
            credentials: { client_email: credentials.client_email, private_key: credentials.private_key },
            projectId: credentials.project_id
        });
        const [result] = await client.synthesizeSpeech({
            input: { ssml: crearSsml(numero, idioma) },
            voice: { languageCode: config.languageCode, name: process.env[config.voiceEnv] || config.defaultVoice },
            audioConfig: { audioEncoding: "MP3", speakingRate: 1, pitch: 0 }
        });

        response.setHeader("Content-Type", "audio/mpeg");
        response.setHeader("Cache-Control", "public, s-maxage=31536000, stale-while-revalidate=86400");
        const audio = typeof result.audioContent === "string"
            ? Buffer.from(result.audioContent, "base64")
            : Buffer.from(result.audioContent);
        return response.status(200).send(audio);
    } catch (_error) {
        return responderError(response, 500, "No se pudo generar el audio");
    }
};

module.exports.CONFIGURACION = CONFIGURACION;
