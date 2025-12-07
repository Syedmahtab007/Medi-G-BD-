import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Bot, ExternalLink, Share, Check, Volume2, Loader2 } from 'lucide-react';
import { Message, Theme } from '../types';
import { generateSpeech } from '../services/geminiService';

interface ChatBubbleProps {
  message: Message;
  theme: Theme;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, theme }) => {
  const isUser = message.role === 'user';
  const [isCopied, setIsCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Define bubble styles based on theme and role
  const getBubbleStyles = () => {
    if (isUser) {
      // User bubble remains consistent or slightly adapted to look good on all backgrounds
      switch (theme) {
        case 'pink':
          return 'bg-rose-500 text-white rounded-tr-none';
        case 'white':
          return 'bg-blue-600 text-white rounded-tr-none';
        case 'black':
        default:
          return 'bg-indigo-600 text-white rounded-tr-none';
      }
    } else {
      // Bot bubble logic per requirements:
      // Black background -> White bubble
      // White background -> Black bubble
      // Pink background -> Bottle Green bubble
      switch (theme) {
        case 'black':
          return 'bg-white border border-zinc-200 text-black rounded-tl-none';
        case 'white':
          return 'bg-black text-white rounded-tl-none';
        case 'pink':
          return 'bg-emerald-900 text-white rounded-tl-none'; // Bottle Green
        default:
          return 'bg-zinc-800 text-zinc-100 rounded-tl-none';
      }
    }
  };

  const bubbleClass = getBubbleStyles();
  
  // Determine text color for markdown headers/strong tags based on the bubble background
  // If bubble is white, headers should be black. If bubble is dark, headers should be white.
  const isDarkBubble = isUser || theme === 'white' || theme === 'pink'; 
  const contentHeaderClass = isDarkBubble ? 'text-white' : 'text-black';
  const contentLinkClass = isUser || theme === 'pink' ? 'text-white/90 hover:text-white' : (theme === 'black' && !isUser ? 'text-blue-700 hover:text-blue-900' : 'text-emerald-300 hover:text-emerald-200');

  // Helper for auxiliary text colors (timestamp, share button)
  const auxTextColor = theme === 'black' ? 'text-zinc-500 hover:text-zinc-300' : (theme === 'white' ? 'text-zinc-400 hover:text-zinc-600' : 'text-pink-800/60 hover:text-pink-900');

  const handleShare = async () => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(message.text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleSpeak = async () => {
    if (isSpeaking || isPlaying) return;
    
    setIsSpeaking(true);
    try {
        const audioBuffer = await generateSpeech(message.text);
        if (audioBuffer) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.onended = () => {
                setIsPlaying(false);
                ctx.close();
            };
            setIsPlaying(true);
            source.start();
        }
    } catch (e) {
        console.error("Speech error", e);
    } finally {
        setIsSpeaking(false);
    }
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] lg:max-w-[70%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm
          ${isUser 
            ? (theme === 'pink' ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white') 
            : (theme === 'pink' ? 'bg-emerald-900 text-white' : (theme === 'white' ? 'bg-black text-white' : 'bg-white text-black'))
          }`}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        {/* Content */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div 
            className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed overflow-hidden transition-colors duration-300
              ${bubbleClass}
              ${message.isError ? 'bg-red-900/20 border-red-800 text-red-200' : ''}
            `}
          >
            {message.isError ? (
              <p>Error: {message.text}</p>
            ) : (
              <div className={`markdown-body`}>
                <ReactMarkdown
                  components={{
                    ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
                    li: ({node, ...props}) => <li className="my-1" {...props} />,
                    p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                    strong: ({node, ...props}) => <strong className={`font-bold ${contentHeaderClass}`} {...props} />,
                    a: ({node, ...props}) => <a className={`underline ${contentLinkClass}`} target="_blank" rel="noopener noreferrer" {...props} />,
                    h1: ({node, ...props}) => <h1 className={`text-xl font-bold my-2 ${contentHeaderClass}`} {...props} />,
                    h2: ({node, ...props}) => <h2 className={`text-lg font-bold my-2 ${contentHeaderClass}`} {...props} />,
                    h3: ({node, ...props}) => <h3 className={`text-base font-bold my-1 ${contentHeaderClass}`} {...props} />,
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Sources/Grounding */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <div className={`mt-2 text-xs p-2 rounded-lg border max-w-full
              ${theme === 'black' ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 
                (theme === 'white' ? 'bg-zinc-100 border-zinc-200 text-zinc-600' : 'bg-pink-200/50 border-pink-300/50 text-pink-900')
              }
            `}>
              <p className="font-semibold mb-1 flex items-center gap-1 opacity-80">
                Sources
              </p>
              <div className="flex flex-wrap gap-2">
                {message.sources.map((source, idx) => (
                  <a 
                    key={idx} 
                    href={source.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors truncate max-w-[200px]
                      ${theme === 'black' 
                        ? 'text-emerald-400 hover:text-emerald-300 bg-emerald-900/20 border-emerald-800/50' 
                        : (theme === 'white' 
                          ? 'text-blue-700 hover:text-blue-900 bg-blue-50 border-blue-100'
                          : 'text-emerald-900 hover:text-emerald-800 bg-emerald-100/50 border-emerald-200')
                      }`}
                    title={source.title}
                  >
                    <ExternalLink size={10} />
                    <span className="truncate">{source.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-3 mt-1 px-1">
            <span className={`text-[10px] ${auxTextColor.split(' ')[0]}`}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            
            {!isUser && !message.isError && (
              <>
                  <button
                    onClick={handleShare}
                    className={`flex items-center gap-1 text-[10px] transition-colors ${auxTextColor}`}
                    title="Copy to clipboard"
                    aria-label="Copy message text"
                  >
                    {isCopied ? (
                      <>
                        <Check size={12} className={theme === 'black' ? 'text-emerald-400' : (theme === 'white' ? 'text-green-600' : 'text-emerald-700')} />
                        <span className={theme === 'black' ? 'text-emerald-400' : (theme === 'white' ? 'text-green-600' : 'text-emerald-700')}>Copied</span>
                      </>
                    ) : (
                      <>
                        <Share size={12} />
                        <span>Share</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSpeak}
                    disabled={isSpeaking || isPlaying}
                    className={`flex items-center gap-1 text-[10px] transition-colors ${auxTextColor} disabled:opacity-50`}
                    title="Read aloud"
                    aria-label="Read aloud"
                  >
                     {isSpeaking ? (
                        <Loader2 size={12} className="animate-spin" />
                     ) : (
                        <Volume2 size={12} className={isPlaying ? 'text-emerald-500 animate-pulse' : ''} />
                     )}
                     <span>{isPlaying ? 'Playing...' : 'Speak'}</span>
                  </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};