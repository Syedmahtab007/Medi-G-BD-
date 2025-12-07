import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, HeartPulse, RefreshCw, Info, Mic, X, Activity, Brain, Zap, MessageSquare } from 'lucide-react';
import { Chat } from "@google/genai";
import { ChatBubble } from './components/ChatBubble';
import { Disclaimer } from './components/Disclaimer';
import { createChatSession, sendMessageToGemini } from './services/geminiService';
import { LiveSession } from './services/liveService';
import { Message, GroundingSource, Theme, ModelMode } from './types';
import { SUGGESTED_PROMPTS } from './constants';
import { Bot } from 'lucide-react';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [theme, setTheme] = useState<Theme>('black');
  const [mode, setMode] = useState<ModelMode>('standard');
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string>('Connecting...');
  
  const chatSessionRef = useRef<Chat | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const initChat = useCallback(() => {
    try {
      chatSessionRef.current = createChatSession(mode);
      setMessages([]);
      setIsInitializing(false);
    } catch (error) {
      console.error("Failed to initialize chat", error);
    }
  }, [mode]);

  useEffect(() => {
    initChat();
  }, [initChat]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || inputValue.trim();
    if (!textToSend || isLoading || !chatSessionRef.current) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await sendMessageToGemini(chatSessionRef.current, textToSend);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text || "I apologize, but I couldn't generate a response. Please try again.",
        timestamp: new Date(),
        sources: response.sources as GroundingSource[]
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "I'm having trouble connecting right now. Please check your internet connection and try again.",
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      if (window.matchMedia('(min-width: 768px)').matches) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReset = () => {
    if (window.confirm("Start a new conversation? This will clear current history.")) {
      initChat();
    }
  };

  const toggleLiveSession = async () => {
    if (isLiveActive) {
        liveSessionRef.current?.disconnect();
        setIsLiveActive(false);
        setLiveStatus('');
        return;
    }

    setIsLiveActive(true);
    setLiveStatus('Connecting...');

    liveSessionRef.current = new LiveSession({
        onOpen: () => setLiveStatus('Listening'),
        onClose: () => {
            setIsLiveActive(false);
            setLiveStatus('');
        },
        onError: (err) => {
            console.error("Live Error", err);
            setLiveStatus('Error connecting');
            setTimeout(() => setIsLiveActive(false), 2000);
        },
        onMessage: () => {},
        onAudioData: () => setLiveStatus('Speaking') // Simple visual feedback
    });

    await liveSessionRef.current.connect();
  };

  const adjustTextareaHeight = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  // Helper function to get theme-specific styles
  const getThemeStyles = () => {
    switch(theme) {
      case 'white':
        return {
          appBg: 'bg-white',
          text: 'text-zinc-900',
          headerBg: 'bg-white border-zinc-200',
          inputAreaBg: 'bg-white border-zinc-200',
          inputBg: 'bg-zinc-100 border-zinc-200 focus-within:border-blue-400 focus-within:ring-blue-100',
          inputText: 'text-zinc-900 placeholder:text-zinc-400',
          emptyStateBg: 'bg-zinc-50',
          suggestionBtn: 'bg-white border-zinc-200 hover:border-blue-400 hover:bg-blue-50 text-zinc-600 hover:text-blue-700',
          loadingDot: 'bg-black',
          liveOverlay: 'bg-white/95 text-zinc-900'
        };
      case 'pink':
        return {
          appBg: 'bg-pink-100', // Baby pink
          text: 'text-pink-950',
          headerBg: 'bg-pink-100/95 border-pink-200',
          inputAreaBg: 'bg-pink-100 border-pink-200',
          inputBg: 'bg-white/80 border-pink-200 focus-within:border-emerald-400 focus-within:ring-emerald-100',
          inputText: 'text-pink-900 placeholder:text-pink-400',
          emptyStateBg: 'bg-pink-50/50',
          suggestionBtn: 'bg-white/60 border-pink-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-pink-900 hover:text-emerald-900',
          loadingDot: 'bg-emerald-900',
          liveOverlay: 'bg-pink-50/95 text-pink-900'
        };
      case 'black':
      default:
        return {
          appBg: 'bg-black',
          text: 'text-zinc-100',
          headerBg: 'bg-black border-zinc-800',
          inputAreaBg: 'bg-black border-zinc-800',
          inputBg: 'bg-zinc-900 border-zinc-800 focus-within:border-emerald-500/50 focus-within:ring-emerald-500/20',
          inputText: 'text-white placeholder:text-zinc-500',
          emptyStateBg: 'bg-transparent',
          suggestionBtn: 'bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-800 text-zinc-300 hover:text-white',
          loadingDot: 'bg-white',
          liveOverlay: 'bg-zinc-900/95 text-white'
        };
    }
  };

  const styles = getThemeStyles();

  return (
    <div className={`flex flex-col h-screen font-sans transition-colors duration-300 ${styles.appBg} ${styles.text}`}>
      {/* Header */}
      <header className={`px-4 py-3 flex items-center justify-between shrink-0 z-20 border-b transition-colors duration-300 ${styles.headerBg}`}>
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${theme === 'pink' ? 'bg-rose-400 text-white' : (theme === 'white' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white')}`}>
            <HeartPulse size={20} />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-bold text-lg leading-tight">MediGuide</h1>
            <p className={`text-xs font-medium ${theme === 'black' ? 'text-zinc-400' : (theme === 'white' ? 'text-zinc-500' : 'text-pink-800/60')}`}>
              AI Health Education
            </p>
          </div>
        </div>

        <div className="flex gap-2 items-center">
            {/* Model Mode Selector */}
            <div className={`flex rounded-lg p-0.5 border mr-2 ${theme === 'black' ? 'bg-zinc-900 border-zinc-800' : (theme === 'white' ? 'bg-zinc-100 border-zinc-200' : 'bg-pink-50 border-pink-200')}`}>
                <button
                    onClick={() => setMode('fast')}
                    className={`p-1.5 rounded-md transition-all ${mode === 'fast' ? (theme === 'black' ? 'bg-zinc-700 text-yellow-300' : 'bg-white shadow-sm text-amber-600') : 'text-zinc-500 hover:text-zinc-800'}`}
                    title="Fast Mode"
                >
                    <Zap size={16} />
                </button>
                <button
                    onClick={() => setMode('standard')}
                    className={`p-1.5 rounded-md transition-all ${mode === 'standard' ? (theme === 'black' ? 'bg-zinc-700 text-blue-300' : 'bg-white shadow-sm text-blue-600') : 'text-zinc-500 hover:text-zinc-800'}`}
                    title="Standard Mode"
                >
                    <MessageSquare size={16} />
                </button>
                <button
                    onClick={() => setMode('thinking')}
                    className={`p-1.5 rounded-md transition-all ${mode === 'thinking' ? (theme === 'black' ? 'bg-zinc-700 text-purple-300' : 'bg-white shadow-sm text-purple-600') : 'text-zinc-500 hover:text-zinc-800'}`}
                    title="Deep Reasoning Mode"
                >
                    <Brain size={16} />
                </button>
            </div>

          {/* Theme Switcher */}
          <div className="flex items-center gap-1 mr-2 bg-black/5 rounded-full p-1 border border-black/5 hidden xs:flex">
            <button 
              onClick={() => setTheme('black')}
              className={`w-4 h-4 rounded-full border border-zinc-600 bg-black transition-transform ${theme === 'black' ? 'scale-110 ring-2 ring-emerald-500' : 'opacity-70 hover:opacity-100'}`}
              title="Black Theme"
            />
             <button 
              onClick={() => setTheme('white')}
              className={`w-4 h-4 rounded-full border border-zinc-300 bg-white transition-transform ${theme === 'white' ? 'scale-110 ring-2 ring-blue-500' : 'opacity-70 hover:opacity-100'}`}
              title="White Theme"
            />
             <button 
              onClick={() => setTheme('pink')}
              className={`w-4 h-4 rounded-full border border-pink-300 bg-pink-200 transition-transform ${theme === 'pink' ? 'scale-110 ring-2 ring-emerald-600' : 'opacity-70 hover:opacity-100'}`}
              title="Pink Theme"
            />
          </div>

          <button 
            onClick={() => setShowDisclaimer(true)}
            className={`p-2 rounded-full transition-colors ${theme === 'black' ? 'text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800' : 'text-zinc-500 hover:text-blue-600 hover:bg-black/5'}`}
            title="Show Info"
          >
            <Info size={20} />
          </button>
          <button 
            onClick={handleReset}
            className={`p-2 rounded-full transition-colors ${theme === 'black' ? 'text-zinc-400 hover:text-red-400 hover:bg-zinc-800' : 'text-zinc-500 hover:text-red-600 hover:bg-black/5'}`}
            title="Reset Chat"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </header>

      {/* Disclaimer Banner */}
      {showDisclaimer && <Disclaimer onClose={() => setShowDisclaimer(false)} />}

      {/* Live Session Overlay */}
      {isLiveActive && (
        <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md ${styles.liveOverlay}`}>
             <button 
                onClick={toggleLiveSession}
                className="absolute top-6 right-6 p-3 rounded-full hover:bg-black/10 transition-colors"
            >
                <X size={24} />
            </button>
            
            <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-8 animate-pulse
                ${liveStatus === 'Speaking' 
                    ? (theme === 'pink' ? 'bg-rose-500 shadow-[0_0_50px_rgba(244,63,94,0.5)]' : 'bg-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.5)]') 
                    : 'bg-zinc-500/20'}
            `}>
                <Activity size={48} className={liveStatus === 'Speaking' ? 'text-white' : 'text-zinc-500'} />
            </div>

            <h2 className="text-2xl font-bold mb-2">{liveStatus}</h2>
            <p className="opacity-70 max-w-xs text-center">
                Listening to your health questions. Speak naturally.
            </p>
        </div>
      )}

      {/* Chat Area */}
      <main className={`flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth relative transition-colors duration-300 ${styles.appBg}`}>
        <div className="max-w-3xl mx-auto min-h-full flex flex-col">
          
          {/* Empty State */}
          {messages.length === 0 && !isInitializing && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-90 animate-in fade-in zoom-in duration-500">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 
                ${theme === 'pink' ? 'bg-white/50 text-rose-500' : (theme === 'white' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-900/30 text-emerald-400')}
              `}>
                <HeartPulse size={32} />
              </div>
              <h2 className="text-2xl font-bold mb-2">How can I help you today?</h2>
              <p className={`max-w-md mb-8 ${theme === 'black' ? 'text-zinc-400' : (theme === 'white' ? 'text-zinc-500' : 'text-pink-800/70')}`}>
                I can provide general information on health conditions, wellness tips, nutrition, and first aid guidance.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {SUGGESTED_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className={`text-left p-4 border rounded-xl transition-all shadow-sm ${styles.suggestionBtn}`}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} theme={theme} />
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-start w-full mb-6">
               <div className="flex max-w-[80%] gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm
                     ${theme === 'pink' ? 'bg-emerald-900 text-white' : (theme === 'white' ? 'bg-black text-white' : 'bg-white text-black')}
                  `}>
                    <Bot size={16} /> 
                  </div>
                  {/* The loading bubble matches the bot bubble color logic */}
                  <div className={`px-5 py-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2
                     ${theme === 'pink' ? 'bg-emerald-900' : (theme === 'white' ? 'bg-black' : 'bg-white border border-zinc-200')}
                  `}>
                    <span className={`w-2 h-2 rounded-full animate-bounce ${styles.loadingDot}`} style={{ animationDelay: '0ms' }}></span>
                    <span className={`w-2 h-2 rounded-full animate-bounce ${styles.loadingDot}`} style={{ animationDelay: '150ms' }}></span>
                    <span className={`w-2 h-2 rounded-full animate-bounce ${styles.loadingDot}`} style={{ animationDelay: '300ms' }}></span>
                  </div>
               </div>
            </div>
          )}
          
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </main>

      {/* Input Area */}
      <footer className={`p-4 border-t shrink-0 transition-colors duration-300 ${styles.inputAreaBg}`}>
        <div className="max-w-3xl mx-auto relative">
          <div className={`relative flex items-end gap-2 rounded-2xl p-2 border transition-all shadow-inner ${styles.inputBg}`}>
            <button 
                onClick={toggleLiveSession}
                className={`p-2.5 rounded-xl flex-shrink-0 mb-0.5 transition-all hover:bg-black/5 ${theme === 'black' ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-blue-600'}`}
                title="Start Voice Chat"
            >
                <Mic size={20} />
            </button>
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={adjustTextareaHeight}
              onKeyDown={handleKeyDown}
              placeholder="Ask about health topics..."
              className={`w-full bg-transparent border-none focus:ring-0 resize-none max-h-[120px] min-h-[44px] py-2.5 px-1 ${styles.inputText}`}
              rows={1}
              style={{ height: '44px' }}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              className={`p-2.5 rounded-xl flex-shrink-0 mb-0.5 transition-all
                ${!inputValue.trim() || isLoading 
                  ? 'bg-zinc-200/20 text-zinc-400 cursor-not-allowed' 
                  : (theme === 'pink' ? 'bg-rose-500 text-white hover:bg-rose-600' : (theme === 'white' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-emerald-600 text-white hover:bg-emerald-700')) + ' shadow-sm active:scale-95'
                }`}
            >
              <Send size={20} />
            </button>
          </div>
          <p className={`text-[10px] text-center mt-2 ${theme === 'black' ? 'text-zinc-600' : (theme === 'white' ? 'text-zinc-400' : 'text-pink-800/60')}`}>
            AI can make mistakes. Always verify important medical information.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;