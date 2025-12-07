import { GoogleGenAI, Chat, Modality } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { ModelMode } from "../types";
import { decodeAudio } from "./audioUtils";

// Ensure API key is available
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API_KEY is missing in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

// Map modes to models
const MODEL_MAP: Record<ModelMode, string> = {
  fast: 'gemini-2.5-flash-lite',
  standard: 'gemini-2.5-flash',
  thinking: 'gemini-3-pro-preview'
};

export const createChatSession = (mode: ModelMode = 'standard'): Chat => {
  const modelName = MODEL_MAP[mode];
  
  const config: any = {
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: [{ googleSearch: {} }],
  };

  // Add thinking config only for the thinking model
  if (mode === 'thinking') {
    config.thinkingConfig = { thinkingBudget: 32768 };
  }

  return ai.chats.create({
    model: modelName,
    config,
  });
};

export const sendMessageToGemini = async (chat: Chat, message: string) => {
  try {
    const result = await chat.sendMessage({ message });
    
    // Extract text
    const text = result.text;

    // Extract grounding metadata if available
    const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .filter((chunk: any) => chunk.web?.uri && chunk.web?.title)
      .map((chunk: any) => ({
        title: chunk.web.title,
        uri: chunk.web.uri
      }));
      
    // Deduplicate sources based on URI
    const uniqueSources = Array.from(new Map(sources.map((s: any) => [s.uri, s])).values());

    return {
      text,
      sources: uniqueSources
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string): Promise<AudioBuffer | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const audioBytes = decodeAudio(base64Audio);
    
    // The TTS model returns raw PCM, we need to handle it or standard decoding depending on format. 
    // Wait, the documentation says "The audio bytes returned by the API is raw PCM data... it contains no header".
    // So we must use decodeAudioData helper for PCM.
    
    // Actually, for TTS specifically, standard decodeAudioData often works if it's wav, but docs say raw PCM.
    // Let's reuse our PCM decoder from audioUtils which handles raw PCM 24kHz.
    
    // However, the Live API example uses a custom decode function.
    // Let's implement a simple decode for the TTS endpoint assuming standard PCM.
    
    // Let's assume the TTS endpoint returns raw PCM similar to Live API for consistency in this SDK version.
    // If it fails, we might need a WAV header, but let's try raw PCM first.
    
    const dataInt16 = new Int16Array(audioBytes.buffer);
    const buffer = audioContext.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;

  } catch (error) {
    console.error("TTS generation error:", error);
    return null;
  }
};

export const getLiveClient = () => {
    return ai.live;
};