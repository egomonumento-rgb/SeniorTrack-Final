import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const MODEL_NAME = "gemini-flash-latest";

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`Gemini API attempt ${i + 1} failed. Retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  throw lastError;
}

export const generateHealthSummary = async (vitals: any[], seniorName: string) => {
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Analiza los siguientes signos vitales de ${seniorName} y genera un resumen breve y tranquilizador para su familia. 
      Signos vitales: ${JSON.stringify(vitals)}`,
      config: {
        systemInstruction: "Eres un asistente de salud inteligente para SeniorTrack. Tu tono es profesional, empático y tranquilizador. Resume el estado de salud actual basándote en los datos proporcionados.",
      },
    }));
    return response.text;
  } catch (error) {
    console.error("Error generating health summary after retries:", error);
    return "No se pudo generar el resumen de salud en este momento debido a un error de conexión. Por favor, intenta de nuevo más tarde.";
  }
};

export const getMedicalAdvice = async (query: string) => {
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: MODEL_NAME,
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    }));
    return response.text;
  } catch (error) {
    console.error("Error getting medical advice after retries:", error);
    return "Lo siento, no pude obtener información actualizada en este momento. Por favor, intenta de nuevo más tarde.";
  }
};

export const findNearbyClinics = async (lat: number, lng: number) => {
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: MODEL_NAME,
      contents: "¿Qué clínicas u hospitales hay cerca de mi ubicación?",
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: lat,
              longitude: lng
            }
          }
        }
      },
    }));
    return {
      text: response.text,
      grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks
    };
  } catch (error) {
    console.error("Error finding nearby clinics after retries:", error);
    return null;
  }
};
