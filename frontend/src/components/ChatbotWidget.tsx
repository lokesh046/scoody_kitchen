import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth';
import { cancelOrder } from '../api/orders';
import { cancelConsultation } from '../api/consultations';
import { 
  streamChat, postImageChat, postVoiceChat, clearChatSession 
} from '../api/chatbot';
import { 
  Sparkles, X, MessageSquare, Send, Mic, MicOff, 
  Trash2, ShieldAlert, Loader2, Paperclip, User, PawPrint
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  statusText?: string;
  sources?: string[];
  hasActionConfirmation?: {
    actionType: 'CANCEL_ORDER' | 'CANCEL_CONSULTATION';
    targetId: number;
    confirmed?: boolean;
  };
}

const cleanPrefixes = (text: string) => {
  if (!text) return '';
  return text.replace(/^(health_agent|knowledge_agent|commerce_agent)\s*/i, '');
};

const renderFormattedText = (rawText: string) => {
  const text = cleanPrefixes(rawText);
  if (!text) return null;
  
  const lines = text.split('\n');
  
  return lines.map((line, lineIdx) => {
    const isBullet = line.trim().startsWith('* ') || line.trim().startsWith('- ');
    const numberedMatch = line.trim().match(/^(\d+)\.\s(.*)/);
    
    let content = line;
    if (isBullet) {
      content = line.trim().substring(2);
    } else if (numberedMatch) {
      content = numberedMatch[2];
    }
    
    const parts = content.split('**');
    const parsedElements = parts.map((part, partIdx) => {
      if (partIdx % 2 === 1) {
        return <strong key={partIdx} className="font-bold text-turmeric">{part}</strong>;
      }
      return part;
    });

    if (isBullet) {
      return (
        <ul key={lineIdx} className="list-disc pl-4 my-0.5 space-y-0.5 text-xs">
          <li>{parsedElements}</li>
        </ul>
      );
    }
    
    if (numberedMatch) {
      return (
        <ol key={lineIdx} className="list-decimal pl-4 my-0.5 space-y-0.5 text-xs">
          <li value={parseInt(numberedMatch[1])}>{parsedElements}</li>
        </ol>
      );
    }
    
    return (
      <p key={lineIdx} className="min-h-[1em] text-xs font-body leading-relaxed my-0.5">
        {parsedElements}
      </p>
    );
  });
};

export const ChatbotWidget: React.FC = () => {
  const { user, accessToken } = useAuthStore();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState('');

  // Image Upload State
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  // Emergency Alert State
  const [showEmergencyAlert, setShowEmergencyAlert] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Session ID
  useEffect(() => {
    const userId = user?.id || 0;
    const randomId = Math.random().toString(36).substring(2, 9);
    setSessionId(`u${userId}_widget_${randomId}`);
  }, [user]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, statusText]);

  // Detect Health Emergency Keywords
  const checkForEmergency = (text: string) => {
    const keywords = ['emergency', 'blood', 'poison', 'dying', 'toxic', 'lethargic', 'seizure', 'unconscious', 'choking'];
    const lower = text.toLowerCase();
    if (keywords.some(k => lower.includes(k))) {
      setShowEmergencyAlert(true);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() && !selectedImage) return;

    const userText = inputMessage;
    setInputMessage('');
    checkForEmergency(userText);

    if (selectedImage) {
      const fileToSend = selectedImage;
      setSelectedImage(null);
      setImagePreview('');

      // Add user message to UI
      const userMsgId = Date.now().toString() + '_user';
      setMessages(prev => [...prev, {
        id: userMsgId,
        role: 'user',
        content: `📷 [Image Uploaded]: ${userText || 'Please analyze this pet image.'}`
      }]);

      setIsStreaming(true);
      setStatusText('Analyzing pet image...');

      try {
        const response = await postImageChat(fileToSend, userText || 'Please analyze this pet image.', sessionId);
        setMessages(prev => [...prev, {
          id: Date.now().toString() + '_assistant',
          role: 'assistant',
          content: response.reply,
          sources: response.sources
        }]);
      } catch (err) {
        console.error('Image analysis failed:', err);
        setMessages(prev => [...prev, {
          id: Date.now().toString() + '_error',
          role: 'assistant',
          content: 'We couldn\'t analyze this image. Please try again.'
        }]);
      } finally {
        setIsStreaming(false);
        setStatusText('');
      }
      return;
    }

    const userMsgId = Date.now().toString() + '_user';
    setMessages(prev => [...prev, {
      id: userMsgId,
      role: 'user',
      content: userText
    }]);

    const assistantMsgId = Date.now().toString() + '_assistant';
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      isStreaming: true
    }]);

    setIsStreaming(true);
    let accumulatedText = '';

    await streamChat(
      userText,
      sessionId,
      (token) => {
        accumulatedText += token;
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: accumulatedText } : m));
      },
      (status) => {
        setStatusText(status);
      },
      (sources) => {
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, sources } : m));
      },
      (error) => {
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: error, isStreaming: false } : m));
        setIsStreaming(false);
        setStatusText('');
      },
      () => {
        let actionConfirmation = undefined;
        const cancelOrderMatch = accumulatedText.match(/(?:cancel\s+order\s+#?|cancel_my_order.*?id\s*=\s*)(\d+)/i);
        const cancelConsultMatch = accumulatedText.match(/(?:cancel\s+consultation\s+#?|cancel_my_consultation.*?id\s*=\s*)(\d+)/i);

        if (cancelOrderMatch) {
          actionConfirmation = {
            actionType: 'CANCEL_ORDER' as const,
            targetId: parseInt(cancelOrderMatch[1])
          };
        } else if (cancelConsultMatch) {
          actionConfirmation = {
            actionType: 'CANCEL_CONSULTATION' as const,
            targetId: parseInt(cancelConsultMatch[1])
          };
        }

        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { 
          ...m, 
          isStreaming: false,
          hasActionConfirmation: actionConfirmation
        } : m));

        setIsStreaming(false);
        setStatusText('');
      },
      accessToken
    );
  };

  // Image handlers
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Voice recording
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Microphone not supported.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        await handleAudioUpload(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Mic access denied:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleAudioUpload = async (blob: Blob) => {
    const userMsgId = Date.now().toString() + '_user';
    setMessages(prev => [...prev, {
      id: userMsgId,
      role: 'user',
      content: '🎤 [Voice Message Recorded]'
    }]);

    setIsStreaming(true);
    setStatusText('Transcribing speech...');

    try {
      const response = await postVoiceChat(blob, sessionId);
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_assistant',
        role: 'assistant',
        content: response.reply,
        sources: response.sources
      }]);
    } catch (err) {
      console.error('Audio transcription failed:', err);
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_error',
        role: 'assistant',
        content: 'We couldn\'t understand the audio. Please try again.'
      }]);
    } finally {
      setIsStreaming(false);
      setStatusText('');
    }
  };

  const handleConfirmAction = async (msgId: string, actionType: 'CANCEL_ORDER' | 'CANCEL_CONSULTATION', targetId: number) => {
    try {
      if (actionType === 'CANCEL_ORDER') {
        await cancelOrder(targetId);
      } else if (actionType === 'CANCEL_CONSULTATION') {
        await cancelConsultation(targetId);
      }

      setMessages(prev => prev.map(m => m.id === msgId ? {
        ...m,
        hasActionConfirmation: m.hasActionConfirmation ? { ...m.hasActionConfirmation, confirmed: true } : undefined,
        content: `${m.content}\n\n✅ **Action executed successfully.**`
      } : m));
    } catch (err) {
      console.error('Action failed:', err);
      alert('Could not cancel. Authorization failed.');
    }
  };

  const handleDeclineAction = (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? {
      ...m,
      hasActionConfirmation: m.hasActionConfirmation ? { ...m.hasActionConfirmation, confirmed: false } : undefined,
      content: `${m.content}\n\n❌ **Action cancelled.**`
    } : m));
  };

  const clearChat = async () => {
    if (sessionId) {
      try {
        await clearChatSession(sessionId);
      } catch (e) {
        console.error('Purge session memory failed:', e);
      }
    }
    setMessages([]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-body">
      {isOpen ? (
        /* Expanded Chatbox Widget panel */
        <div className="w-80 sm:w-96 h-[500px] bg-paperLight border border-cardboard rounded-sm shadow-2xl flex flex-col justify-between overflow-hidden text-left relative">
          {/* Spine Binding styling */}
          <div className="absolute top-0 bottom-0 left-1 border-l border-dashed border-cardboard opacity-35"></div>

          {/* Panel Header */}
          <div className="border-b border-cardboard p-3.5 bg-paper bg-opacity-40 flex justify-between items-center pl-6">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-turmeric shrink-0" />
              <div>
                <h4 className="font-display font-bold text-xs text-ink">Scooby's AI Help</h4>
                <span className="font-mono text-[7px] uppercase font-bold text-herb">STREAM TOKEN CHAT</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={clearChat}
                className="p-1 text-paprika hover:bg-red-50 rounded-sm"
                title="Clear Conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 text-ink hover:bg-paper rounded-sm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Emergency Alert */}
          {showEmergencyAlert && (
            <div className="bg-red-50 border-y border-paprika px-4 py-2 flex items-start space-x-2 text-paprika text-[10px] pl-6 animate-pulse">
              <ShieldAlert className="w-4 h-4 shrink-0 text-paprika mt-0.5" />
              <div>
                <span className="font-bold block">🚨 EMERGENCY MEDICAL ALERT</span>
                <span>Please call an emergency vet clinic immediately for critical symptoms.</span>
                <button onClick={() => setShowEmergencyAlert(false)} className="underline block mt-1 font-bold">Dismiss</button>
              </div>
            </div>
          )}

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 pl-6">
            {messages.length === 0 ? (
              <div className="text-center py-20 space-y-2">
                <MessageSquare className="w-10 h-10 text-cardboard mx-auto stroke-1" />
                <h5 className="font-display font-bold text-ink text-xs">Ask Scooby's Kitchen AI</h5>
                <p className="font-body text-[10px] text-ink opacity-70 max-w-[200px] mx-auto">
                  Get delivery diagnostics, order status updates, or veterinarian booking timings.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex items-start max-w-[90%] ${
                    msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto flex-row'
                  }`}
                >
                  {/* Modern Avatar */}
                  {msg.role === 'user' ? (
                    <div className="w-6 h-6 rounded-full bg-turmeric bg-opacity-20 border border-turmeric border-opacity-40 flex items-center justify-center text-turmeric shadow-sm shrink-0 ml-2">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-paprika bg-opacity-20 border border-paprika border-opacity-40 flex items-center justify-center text-paprika shadow-sm shrink-0 mr-2">
                      <PawPrint className="w-3.5 h-3.5 animate-pulse" />
                    </div>
                  )}

                  <div className="flex flex-col space-y-0.5">
                    <span className={`font-mono text-[9px] uppercase text-cardboard font-bold ${
                      msg.role === 'user' ? 'text-right' : 'text-left'
                    }`}>
                      {msg.role === 'user' ? 'CUSTOMER' : 'AI'}
                    </span>
                    <div className={`p-3 rounded-2xl shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-ink text-paper border border-cardboard border-opacity-40 rounded-tr-none' 
                        : 'bg-paper text-ink border border-cardboard border-opacity-30 rounded-tl-none'
                    }`}>
                      {renderFormattedText(msg.content)}

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 pt-1.5 border-t border-cardboard border-dashed flex flex-wrap gap-1">
                        {msg.sources.map((s, idx) => (
                          <span key={idx} className="font-mono text-[9px] bg-paper px-1 py-0.2 border border-cardboard rounded-sm text-ink opacity-80">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    {msg.hasActionConfirmation && msg.hasActionConfirmation.confirmed === undefined && (
                      <div className="mt-2.5 p-2 bg-red-50 border border-paprika border-opacity-40 rounded-sm space-y-2 text-[11px]">
                        <span className="font-mono font-bold text-paprika block">⚠️ AUTHORIZE CANCELLATION</span>
                        <div className="flex space-x-1.5">
                          <button
                            onClick={() => handleConfirmAction(msg.id, msg.hasActionConfirmation!.actionType, msg.hasActionConfirmation!.targetId)}
                            className="bg-herb text-paperLight font-mono text-[9px] uppercase font-bold py-1 px-2.5 rounded-sm"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => handleDeclineAction(msg.id)}
                            className="border border-cardboard text-ink font-mono text-[9px] uppercase font-bold py-1 px-2.5 rounded-sm"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
            )}

            {isStreaming && statusText && (
              <div className="flex items-center space-x-1.5 text-herb font-mono text-[10px] uppercase pl-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{statusText}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Sender footer */}
          <div className="border-t border-cardboard p-3 bg-paper bg-opacity-40 space-y-2 pl-6">
            {imagePreview && (
              <div className="flex items-center space-x-2 bg-paper p-1.5 border border-cardboard border-dashed rounded-sm text-[10px]">
                <img src={imagePreview} alt="upload preview" className="w-8 h-8 object-cover rounded-sm border border-cardboard" />
                <span className="truncate flex-1 text-ink opacity-80">{selectedImage?.name}</span>
                <button 
                  onClick={() => { setSelectedImage(null); setImagePreview(''); }}
                  className="text-paprika p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center space-x-1.5">
              <label className="p-1.5 border border-cardboard rounded-sm hover:bg-paper cursor-pointer text-ink relative">
                <Paperclip className="w-3.5 h-3.5" />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageChange}
                  disabled={isStreaming} 
                />
              </label>

              {isRecording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="p-1.5 bg-paprika text-paperLight rounded-sm animate-pulse"
                >
                  <MicOff className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="p-1.5 border border-cardboard rounded-sm hover:bg-paper text-ink"
                  disabled={isStreaming}
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              )}

              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type help request..."
                className="flex-1 px-2.5 py-1.5 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric"
                disabled={isStreaming}
              />

              <button
                type="submit"
                className="p-1.5 bg-paprika hover:bg-opacity-95 text-paperLight rounded-sm disabled:opacity-50"
                disabled={isStreaming || (!inputMessage.trim() && !selectedImage)}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Floating collapsed badge */
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2 bg-paprika text-paperLight px-4 py-3 rounded-full shadow-2xl hover:bg-opacity-95 transition-transform hover:-translate-y-0.5 duration-200 cursor-pointer border border-cardboard animate-pulse"
        >
          <Sparkles className="w-4 h-4 text-paperLight" />
          <span className="font-display font-bold text-xs uppercase tracking-wider">Chat Assistant 🐾</span>
        </button>
      )}
    </div>
  );
};
