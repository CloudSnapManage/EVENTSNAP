
import { GoogleGenAI } from "@google/genai";

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const generateCaption = async (blob: Blob): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const base64 = await blobToBase64(blob);
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType: blob.type } },
          { text: "Write a short, fun, 1-sentence caption for this photo from a party/event. Be creative and enthusiastic! Use emojis occasionally." }
        ]
      }
    });

    return response.text?.trim() || "A beautiful moment captured! ✨";
  } catch (err) {
    console.error("Gemini failed:", err);
    return "Event memory captured! 📸";
  }
};
