import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";

// Singleton pattern for the GoogleGenAI client
let client: GoogleGenAI | undefined;

// Returns a singleton instance of the GoogleGenAI client, initializing it if necessary.
function getClient(): GoogleGenAI {
  if (!config.gemini.apiKey) {
    throw new Error("Missing GEMINI_API_KEY — set it in .env");
  }
  if (!client) client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  return client;
}

// Generates text using the Gemini model based on the provided system instruction and prompt.
// If the request fails due to server overload, it retries up to 3 times with increasing delays.
export async function generateText(params: {
  systemInstruction: string;
  prompt: string;
  temperature?: number;
}): Promise<string> {
  const genAI = getClient();

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await genAI.models.generateContent({
        model: config.gemini.model,
        contents: params.prompt,
        config: {
          systemInstruction: params.systemInstruction,
          temperature: params.temperature ?? 0.2,
        },
      });
      const text = response.text;
      if (!text) throw new Error(`Gemini returned no text content. Full response: ${JSON.stringify(response)}`);
      return text;
    } catch (err) {
      const isRetryable = String(err).includes("UNAVAILABLE") || String(err).includes("503");
      if (!isRetryable || attempt === 3) throw err;
      console.log(`Gemini overloaded (attempt ${attempt}/3), retrying in ${attempt * 3}s...`);
      await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
  throw new Error("unreachable");
}

// Generates JSON output by first generating text and then parsing it as JSON.
export async function generateJSON<T>(params: {
  systemInstruction: string; prompt: string; temperature?: number;
}): Promise<T> {
  const raw = await generateText(params);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned) as T;
}