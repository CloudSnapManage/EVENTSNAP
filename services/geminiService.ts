
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateCaption(base64Image: string, mimeType: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: "Write a short, fun, 1-sentence caption for this photo from a party/event. Be creative and enthusiastic!" }
        ]
      },
      config: {
        maxOutputTokens: 60,
      }
    });

    return response.text?.trim() || "Event vibes! ✨";
  } catch (error) {
    console.error("Caption generation failed:", error);
    return "Amazing moment! 📸";
  }
}
