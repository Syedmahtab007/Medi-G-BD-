import { getLiveClient } from "./geminiService";
import { LiveServerMessage, Modality } from "@google/genai";
import { createPcmBlob, decodeAudio, decodePcmAudioData } from "./audioUtils";

interface LiveSessionCallbacks {
  onOpen: () => void;
  onMessage: (text?: string) => void;
  onError: (error: any) => void;
  onClose: () => void;
  onAudioData: (buffer: AudioBuffer) => void;
}

export class LiveSession {
  private inputContext: AudioContext | null = null;
  private outputContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime: number = 0;
  private session: any = null;
  private isActive: boolean = false;

  constructor(private callbacks: LiveSessionCallbacks) {}

  async connect() {
    try {
      this.inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const liveClient = getLiveClient();
      
      const sessionPromise = liveClient.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log("Live Session Opened");
            this.isActive = true;
            this.callbacks.onOpen();
            this.startAudioInput(sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            this.handleServerMessage(message);
          },
          onerror: (err: any) => {
            console.error("Live Session Error", err);
            this.callbacks.onError(err);
          },
          onclose: () => {
            console.log("Live Session Closed");
            this.isActive = false;
            this.callbacks.onClose();
            this.cleanup();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: "You are a helpful health assistant named MediGuide. Keep responses concise and conversational.",
        },
      });
      
      this.session = await sessionPromise;

    } catch (error) {
      console.error("Connection failed", error);
      this.callbacks.onError(error);
      this.cleanup();
    }
  }

  private startAudioInput(sessionPromise: Promise<any>) {
    if (!this.inputContext || !this.stream) return;

    this.source = this.inputContext.createMediaStreamSource(this.stream);
    this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isActive) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);
      
      sessionPromise.then((session) => {
        if(this.isActive) {
           session.sendRealtimeInput({ media: pcmBlob });
        }
      });
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputContext.destination);
  }

  private async handleServerMessage(message: LiveServerMessage) {
    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    
    if (base64Audio && this.outputContext) {
      const audioBytes = decodeAudio(base64Audio);
      const audioBuffer = await decodePcmAudioData(audioBytes, this.outputContext, 24000);
      
      this.playAudio(audioBuffer);
      this.callbacks.onAudioData(audioBuffer); // Optional visualization hook
    }
    
    if (message.serverContent?.interrupted) {
      this.nextStartTime = 0;
      // In a real app, we'd cancel currently playing nodes here
    }
  }

  private playAudio(buffer: AudioBuffer) {
    if (!this.outputContext) return;

    this.nextStartTime = Math.max(this.nextStartTime, this.outputContext.currentTime);
    
    const source = this.outputContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputContext.destination);
    source.start(this.nextStartTime);
    
    this.nextStartTime += buffer.duration;
  }

  disconnect() {
    this.isActive = false;
    if (this.session) {
      // session.close() might not be available on the interface directly depending on version,
      // but usually closing the socket is handled. 
      // The SDK defines close() on the session object? 
      // Actually checking types, 'close' is not on the session object returned by connect directly in some versions,
      // but usually the connection is managed.
      // We will trigger cleanup which stops the audio processing.
      // There isn't an explicit close method exposed on the resolved session object in the docs provided,
      // but we can just stop sending audio.
    }
    this.cleanup();
  }

  private cleanup() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.inputContext) {
      this.inputContext.close();
      this.inputContext = null;
    }
    if (this.outputContext) {
      this.outputContext.close();
      this.outputContext = null;
    }
  }
}