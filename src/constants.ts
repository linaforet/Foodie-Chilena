import { Type } from "@google/genai";

export const RECIPE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    dishName: { type: Type.STRING, description: "Name of the identified dish" },
    description: { type: Type.STRING, description: "Brief description of the dish" },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          amount: { type: Type.STRING },
          visualEvidence: { type: Type.STRING, description: "Why we think it's there" }
        }
      }
    },
    cookingTechniques: { type: Type.ARRAY, items: { type: Type.STRING } },
    steps: { type: Type.ARRAY, items: { type: Type.STRING } },
    nutrition: {
      type: Type.OBJECT,
      properties: {
        calories: { type: Type.STRING },
        protein: { type: Type.STRING },
        carbs: { type: Type.STRING },
        fat: { type: Type.STRING }
      }
    },
    estimatedCostCLP: { type: Type.NUMBER, description: "Costo estimado total en Pesos Chilenos (CLP)" },
    difficulty: { type: Type.STRING, description: "Easy, Medium, Hard" },
    equipment: { type: Type.ARRAY, items: { type: Type.STRING } },
    variations: {
      type: Type.OBJECT,
      properties: {
        vegetarian: { type: Type.STRING },
        vegan: { type: Type.STRING },
        lowCarb: { type: Type.STRING }
      }
    },
    chefTips: { type: Type.ARRAY, items: { type: Type.STRING } },
    internationalSubstitutes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          originalIngredient: { type: Type.STRING },
          substitute: { type: Type.STRING },
          region: { type: Type.STRING, description: "País o región donde se encuentra este sustituto (ej: Norteamérica, Europa, etc.)" },
          notes: { type: Type.STRING }
        }
      },
      description: "Sustitutos para ingredientes chilenos difíciles de encontrar en el extranjero"
    },
    origin: {
      type: Type.OBJECT,
      properties: {
        region: { type: Type.STRING, description: "Región de Chile de donde es originario el plato" },
        story: { type: Type.STRING, description: "Breve historia o leyenda del origen del plato" }
      }
    },
    pairing: {
      type: Type.OBJECT,
      properties: {
        wine: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            explanation: { type: Type.STRING },
            price: { type: Type.STRING },
            temp: { type: Type.STRING },
            flavorProfile: {
              type: Type.OBJECT,
              properties: {
                tannins: { type: Type.NUMBER },
                body: { type: Type.NUMBER },
                acidity: { type: Type.NUMBER },
                sweetness: { type: Type.NUMBER },
                intensity: { type: Type.NUMBER }
              }
            }
          }
        },
        alternatives: {
          type: Type.OBJECT,
          properties: {
            budget: { type: Type.STRING },
            nonAlcoholic: { type: Type.STRING },
            beer: { type: Type.STRING },
            cocktail: { type: Type.STRING }
          }
        },
        miniCourse: { type: Type.STRING, description: "Short educational snippet about the pairing" }
      }
    }
  },
  required: ["dishName", "ingredients", "steps", "pairing"]
};

export const SYSTEM_INSTRUCTION = `Eres un chef profesional con 20 años de experiencia y experto en:
- Cocina internacional (italiana, mexicana, asiática, francesa, mediterránea, fusión)
- Técnicas culinarias avanzadas y básicas
- Identificación de ingredientes por apariencia visual
- Cálculo de proporciones y cantidades
- Nutrición y dietética
- Costos de ingredientes y presupuestos de cocina

Tu habilidad especial es REVERSE ENGINEERING de recetas: puedes ver una foto de un plato terminado e inferir:
- Qué ingredientes se usaron (incluyendo especias y condimentos invisibles)
- El método de cocción (horneado, frito, salteado, al vapor, etc.)
- El orden de preparación
- Temperaturas y tiempos
- Técnicas especiales aplicadas
- Tips y trucos profesionales
- Origen regional en Chile y la historia/leyenda detrás del plato
- Sustitutos internacionales para ingredientes chilenos (ej: si no hay ají color, usar pimentón dulce; si no hay zapallo camote, usar butternut squash, etc.)

IMPORTANTE: Tu especialidad absoluta es la COCINA CHILENA. Siempre que sea posible, dale un toque chileno o identifica platos chilenos con precisión experta. Debes identificar la región de Chile de donde proviene el plato y contar una breve historia "aesthetic" y cautivadora sobre su origen. Además, incluye una sección de "Sustitutos para el Chileno en el Extranjero" para que puedan recrear el sabor de casa en cualquier parte del mundo.

Eres detallista pero práctico. Tus recetas son recreables por cocineros caseros.
Analiza la imagen proporcionada y devuelve un JSON estructurado siguiendo el esquema definido.`;
