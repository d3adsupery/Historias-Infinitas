import { GoogleGenAI, Type, Schema } from "@google/genai";
import { StoryEngineResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Schema for the game logic (Text Model)
const storySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    narrative: {
      type: Type.STRING,
      description: "La narración del segmento actual de la historia. Debe ser inmersiva y descriptiva.",
    },
    hpChange: {
      type: Type.INTEGER,
      description: "El cambio en la vida del jugador. Negativo para daño, positivo para curación, 0 si no hay cambios.",
    },
    inventoryAdd: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Lista de objetos obtenidos en este turno.",
    },
    inventoryRemove: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Lista de objetos perdidos o usados en este turno.",
    },
    visualDescription: {
      type: Type.STRING,
      description: "Una descripción visual detallada de la escena actual para generar una imagen. En Inglés.",
    },
    isGameOver: {
      type: Type.BOOLEAN,
      description: "True si el jugador ha muerto o completado la historia final.",
    },
    choices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          text: { type: Type.STRING },
        },
        required: ["id", "text"],
      },
      description: "EXACTAMENTE 4 opciones distintas para que el jugador elija.",
    },
  },
  required: ["narrative", "hpChange", "inventoryAdd", "inventoryRemove", "visualDescription", "isGameOver", "choices"],
};

export const generateStorySegment = async (
  theme: string,
  currentHp: number,
  inventory: string[],
  lastChoice: string | null,
  historyContext: string
): Promise<StoryEngineResponse> => {
  
  const systemInstruction = `
    Eres un Dungeon Master experto de un juego de rol de texto.
    Tu objetivo es crear una aventura inmersiva basada en el tema: "${theme}".
    
    Reglas:
    1. Idioma: ESPAÑOL.
    2. Gestiona la vida (HP) y el inventario de forma lógica.
    3. Si HP llega a 0, narra una muerte épica y pon isGameOver en true.
    4. Genera una descripción visual (visualDescription) optimizada para generación de imágenes (en inglés).
    5. Mantén la historia coherente.
    6. Devuelve SIEMPRE un JSON válido acorde al esquema.
    7. IMPORTANTE: Genera SIEMPRE 4 opciones (choices) para el usuario.
  `;

  const userPrompt = `
    Estado Actual:
    - Vida: ${currentHp}
    - Inventario: ${inventory.join(", ") || "Vacío"}
    - Contexto Previo: ${historyContext}
    
    Acción del usuario: ${lastChoice ? `El usuario eligió: "${lastChoice}"` : "Inicio de la aventura."}
    
    Genera el siguiente segmento con 4 opciones.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: storySchema,
        temperature: 0.8,
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as StoryEngineResponse;
    }
    throw new Error("No text response from Gemini");
  } catch (error) {
    console.error("Error generating story:", error);
    // Fallback in case of severe error to prevent crash
    return {
      narrative: "La niebla se espesa y tu mente se nubla... (Error de conexión con la IA, intenta recargar o elegir otra opción).",
      hpChange: 0,
      inventoryAdd: [],
      inventoryRemove: [],
      visualDescription: "foggy mystery void",
      isGameOver: false,
      choices: [
        { id: "retry", text: "Intentar de nuevo" },
        { id: "wait", text: "Esperar un momento" },
        { id: "run", text: "Huir en pánico" },
        { id: "scream", text: "Gritar al vacío" }
      ]
    };
  }
};

export const generateSceneImage = async (prompt: string): Promise<string | undefined> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.warn("Image generation failed:", error);
    return undefined; // UI will handle missing image
  }
  return undefined;
};