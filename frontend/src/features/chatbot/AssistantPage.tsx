import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { cancelOrder } from '../../api/orders';
import { cancelConsultation } from '../../api/consultations';
import { CartDrawer } from '../../components/CartDrawer';
import {
  streamChat, postImageChat, postVoiceChat, clearChatSession, fetchChatbotHealth, fetchChatSessionHistory,
} from '../../api/chatbot';
import type { ChatProduct } from '../../api/chatbot';
import { Header } from '../../components/Header';
import {
  PawPrint,
  Mic, MicOff, Trash2, ShieldAlert, Check, X,
  Loader2, AlertCircle, Plus
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  statusText?: string;
  sources?: string[];
  products?: ChatProduct[];
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
        <ul key={lineIdx} className="list-disc pl-5 my-1 space-y-1 text-sm">
          <li>{parsedElements}</li>
        </ul>
      );
    }

    if (numberedMatch) {
      return (
        <ol key={lineIdx} className="list-decimal pl-5 my-1 space-y-1 text-sm">
          <li value={parseInt(numberedMatch[1])}>{parsedElements}</li>
        </ol>
      );
    }

    return (
      <p key={lineIdx} className="min-h-[1em] text-sm font-body leading-relaxed my-1">
        {parsedElements}
      </p>
    );
  });
};

export const AssistantPage: React.FC = () => {
  const { user, accessToken } = useAuthStore();
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [engineHealth, setEngineHealth] = useState<'online' | 'offline' | 'checking'>('checking');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetchChatbotHealth();
        if (response && response.status === 'ok') {
          setEngineHealth('online');
        } else {
          setEngineHealth('offline');
        }
      } catch (e) {
        console.error('Chatbot health check failed:', e);
        setEngineHealth('offline');
      }
    };
    checkHealth();

    // Poll every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Image Upload State
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  // Dropdown States
  const [isTopDropdownOpen, setIsTopDropdownOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState('Scooby Recipe Chat');

  // Emergency Alert State
  const [showEmergencyAlert, setShowEmergencyAlert] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Session ID and Load History
  useEffect(() => {
    if (!user) return;
    const storageKey = `chat_session_page_u${user.id}`;
    let savedSessionId = localStorage.getItem(storageKey);
    if (!savedSessionId) {
      const randomId = Math.random().toString(36).substring(2, 9);
      savedSessionId = `u${user.id}_session_${randomId}`;
      localStorage.setItem(storageKey, savedSessionId);
    }
    setSessionId(savedSessionId);

    const loadHistory = async () => {
      try {
        const history = await fetchChatSessionHistory(savedSessionId!);
        if (history && history.length > 0) {
          const mapped = history
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map((m, idx) => ({
              id: `hist_${idx}_${Date.now()}`,
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }));
          setMessages(mapped);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    };
    loadHistory();
  }, [user]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, statusText]);

  // Detect Health Emergency Keywords
  const checkForEmergency = (text: string) => {
    const keywords = ['emergency', 'blood', 'poison', 'dying', 'toxic', 'lethargic', 'seizure', 'unconscious', 'choking'];
    const lower = text.toLowerCase();
    const matches = keywords.some(k => lower.includes(k));
    if (matches) {
      setShowEmergencyAlert(true);
    }
  };



  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() && !selectedImage) return;

    const userText = inputMessage;
    setInputMessage('');
    checkForEmergency(userText);

    // 1. If image is selected, do a Multimodal Image Post instead of standard text stream
    if (selectedImage) {
      const fileToSend = selectedImage;
      setSelectedImage(null);
      setImagePreview('');

      // Add user message to UI
      const userMsgId = Date.now().toString() + '_user';
      setMessages(prev => [...prev, {
        id: userMsgId,
        role: 'user',
        content: `[Image Sourced]: ${userText || 'Please analyze this pet image.'}`
      }]);

      setIsStreaming(true);
      setStatusText('Analyzing pet image...');

      try {
        const response = await postImageChat(fileToSend, userText || 'Please analyze this pet image.', sessionId);

        // Add assistant reply
        setMessages(prev => [...prev, {
          id: Date.now().toString() + '_assistant',
          role: 'assistant',
          content: response.reply,
          sources: response.sources,
          products: response.products
        }]);
      } catch (err: any) {
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

    // 2. Standard Text Streaming chat
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
        // Stream completed successfully

        // Dynamic scan for Human-In-The-Loop action trigger confirmations
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
      accessToken,
      (products) => {
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, products } : m));
      }
    );
  };

  // Image Selection Handlers
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Voice recording handlers
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Microphone not supported by your browser.');
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
      console.error('Microphone access denied:', err);
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
      content: '🎤 [Voice Recording Submitted]'
    }]);

    setIsStreaming(true);
    setStatusText('Transcribing voice audio...');

    try {
      const response = await postVoiceChat(blob, sessionId);

      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_assistant',
        role: 'assistant',
        content: response.reply,
        sources: response.sources,
        products: response.products
      }]);
    } catch (err: any) {
      console.error('Audio transcription failed:', err);
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_error',
        role: 'assistant',
        content: 'We couldn\'t understand the audio. Please try again or type your message.'
      }]);
    } finally {
      setIsStreaming(true);
      setIsStreaming(false);
      setStatusText('');
    }
  };

  // Confirm sensitive action callback
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
        content: `${m.content}\n\n✅ **Action executed successfully on backend.**`
      } : m));
    } catch (err) {
      console.error('Sensitive action execution failed:', err);
      alert('Authorization check failed. Could not process action.');
    }
  };

  const handleDeclineAction = (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? {
      ...m,
      hasActionConfirmation: m.hasActionConfirmation ? { ...m.hasActionConfirmation, confirmed: false } : undefined,
      content: `${m.content}\n\n❌ **Action declined.**`
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
    const userId = user?.id || 0;
    const randomId = Math.random().toString(36).substring(2, 9);
    const newSessionId = `u${userId}_session_${randomId}`;
    if (user) {
      localStorage.setItem(`chat_session_page_u${user.id}`, newSessionId);
    }
    setSessionId(newSessionId);
    setMessages([]);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Full-width Top Navigation Header bar */}
      <Header activeTab="assistant" onCartToggle={() => setIsCartOpen(true)} />

      {/* Centered Main Content Wrapper */}
      <main className="flex-grow max-w-4xl w-full mx-auto px-4 md:px-8 py-8 flex flex-col justify-between min-h-[85vh]">

        {/* Custom Modern Header Row */}
        <div className="mb-8 border-b border-cardboard border-opacity-30 pb-4 flex justify-between items-center text-left">
          {/* Top Left Dropdown for Mode Selection */}
          <div className="relative">
            <button
              onClick={() => setIsTopDropdownOpen(!isTopDropdownOpen)}
              className="font-display font-bold text-sm text-ink hover:opacity-85 flex items-center space-x-1.5 focus:outline-none select-none"
            >
              <span>{selectedMode}</span>
              <span className="text-[8px] opacity-70">▼</span>
            </button>
            {isTopDropdownOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-paperLight border border-cardboard shadow-xl z-50 text-left rounded-xl overflow-hidden">
                <div className="p-2 border-b border-cardboard border-opacity-30 bg-paper font-mono text-[8px] uppercase tracking-wider text-cardboard font-bold">
                  SELECT ASSISTANT MODE
                </div>
                <button
                  onClick={() => { setSelectedMode('Scooby Recipe Chat'); setIsTopDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-xs font-body hover:bg-paper text-ink block border-b border-cardboard border-opacity-20"
                >
                  <span className="font-bold block text-ink">Scooby Recipe Chat 🍳</span>
                  <span className="text-[9px] text-cardboard font-mono">NUTRITION & RECIPES</span>
                </button>
                <button
                  onClick={() => { setSelectedMode('Pet Health Diagnostic'); setIsTopDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-xs font-body hover:bg-paper text-ink block border-b border-cardboard border-opacity-20"
                >
                  <span className="font-bold block text-ink">Pet Health Diagnostic 🩺</span>
                  <span className="text-[9px] text-cardboard font-mono">CLINICAL SUPPORT</span>
                </button>
                <button
                  onClick={() => { setSelectedMode('Order & Inventory Support'); setIsTopDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-xs font-body hover:bg-paper text-ink block"
                >
                  <span className="font-bold block text-ink">Order & Inventory Support 📦</span>
                  <span className="text-[9px] text-cardboard font-mono">REFUNDS & TRACKING</span>
                </button>
              </div>
            )}
          </div>

          {/* Top Right Clear Button and Live Indicator */}
          <div className="flex items-center space-x-4">
            <span className="font-mono text-[9px] uppercase font-bold tracking-wider flex items-center space-x-1">
              {engineHealth === 'online' ? (
                <span className="flex items-center text-herb">
                  <span className="w-1.5 h-1.5 rounded-full bg-herb animate-ping mr-1"></span>
                  <span>Engine Active</span>
                </span>
              ) : engineHealth === 'offline' ? (
                <span className="flex items-center text-paprika">
                  <span>Engine Offline</span>
                </span>
              ) : (
                <span className="flex items-center text-cardboard">
                  <span>Checking...</span>
                </span>
              )}
            </span>

            <button
              onClick={clearChat}
              className="font-mono text-[9px] uppercase tracking-wider text-paprika hover:opacity-105 flex items-center space-x-1 border border-turmeric border-dashed px-3 py-1 bg-paperLight rounded-full"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Chat</span>
            </button>
          </div>
        </div>

        {/* Emergency health warning banner */}
        {showEmergencyAlert && (
          <div className="bg-red-50 border border-turmeric p-4 rounded-xl mb-6 flex items-start space-x-3 text-paprika font-body text-xs text-left animate-pulse">
            <ShieldAlert className="w-6 h-6 shrink-0 text-paprika mt-0.5" />
            <div>
              <span className="font-display font-bold text-sm block">🚨 EMERGENCY HEALTH WARNING</span>
              <span>Your conversation refers to acute/severe veterinary clinical symptoms. AI recommendations are purely informational. Please bypass AI support and contact an emergency veterinarian clinic immediately!</span>
              <button
                onClick={() => setShowEmergencyAlert(false)}
                className="font-mono text-[9px] uppercase font-bold underline block mt-2 text-ink hover:text-paprika"
              >
                Dismiss Warning
              </button>
            </div>
          </div>
        )}

        {/* Chat List Stream (Centered in 3xl container) */}
        <div className="flex-1 overflow-y-auto space-y-6 mb-8 min-h-[450px]">
          {messages.length === 0 ? (
            <div className="text-center py-24 space-y-3">
              <PawPrint className="w-12 h-12 text-cardboard mx-auto stroke-1 animate-float-slow" />
              <h4 className="font-display font-bold text-ink text-base">Ask Anything About Scooby's Kitchen</h4>
              <p className="font-body text-xs text-ink opacity-70 max-w-sm mx-auto">
                Type questions to query inventory, track placed orders, cancel active orders, or get diagnostic recipe advice.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`w-full flex mb-4 animate-fade-in-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}>
                <div className={`flex items-start space-x-3 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse max-w-[75%]' : 'flex-row max-w-[85%]'
                  }`}>
                  {/* Avatar */}
                  {msg.role === 'user' ? (
                    <div className="w-9 h-9 border border-cardboard border-opacity-65 bg-paperLight flex items-center justify-center shadow-xs shrink-0 select-none rounded-sm font-display font-black text-sm text-turmeric">
                      {user?.first_name ? user.first_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                  ) : (
                    <div className="w-9 h-9 border-2 border-dashed border-herb bg-white flex items-center justify-center shadow-xs shrink-0 select-none rounded-sm">
                      <PawPrint className="w-5 h-5 text-herb animate-pulse" />
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div className="flex flex-col space-y-1">
                    <span className={`font-mono text-[9px] uppercase text-cardboard font-bold ${msg.role === 'user' ? 'text-right' : 'text-left'
                      }`}>
                      {msg.role === 'user' ? 'CUSTOMER' : 'SCOOBY ASSISTANT'}
                    </span>

                    <div className={`p-4 border shadow-xs rounded-sm ${
                      msg.role === 'user'
                        ? 'bg-turmeric bg-opacity-10 text-ink border-turmeric border-opacity-40 text-left font-body text-xs'
                        : msg.id.endsWith('_error')
                        ? 'bg-red-50 text-paprika border-turmeric border-opacity-45 text-left'
                        : 'bg-paperLight text-ink border-cardboard border-opacity-45 text-left relative'
                    }`}>
                      {msg.id.endsWith('_error') ? (
                        <div className="flex items-start space-x-2 text-paprika">
                          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <span className="font-mono text-[9px] uppercase font-bold tracking-wider block">
                              COMMUNICATION FAULT
                            </span>
                            <p className="font-body text-xs text-ink leading-relaxed">
                              {msg.content}
                            </p>
                          </div>
                        </div>
                      ) : msg.isStreaming && !msg.content ? (
                        <div className="flex items-center space-x-2 py-2">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-herb animate-pulse">
                            Consulting Scooby's Recipe Ledger...
                          </span>
                          <div className="flex space-x-1">
                            <span className="w-1.5 h-1.5 bg-turmeric rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-turmeric rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-turmeric rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      ) : (
                        <div className="font-body text-xs text-ink leading-relaxed">
                          {renderFormattedText(msg.content)}
                        </div>
                      )}

                      {/* Sourced knowledge files */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-cardboard border-dashed">
                          <span className="font-mono text-[9px] uppercase text-herb font-bold block">Sourced files:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {msg.sources.map((src, idx) => (
                              <span key={idx} className="font-mono text-[9px] bg-paper px-2 py-0.5 border border-cardboard rounded-full text-ink opacity-80">
                                {src}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tappable product suggestions */}
                      {msg.products && msg.products.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-cardboard border-dashed">
                          <div className="flex gap-3 overflow-x-auto pb-1">
                            {msg.products.map((product) => (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => navigate(`/product/${product.id}`)}
                                className="shrink-0 w-28 text-left border border-cardboard border-opacity-45 bg-paper rounded-sm p-2 hover:border-turmeric transition-colors"
                              >
                                {product.image_url ? (
                                  <img
                                    src={product.image_url}
                                    alt={product.name}
                                    className="w-full h-20 object-cover rounded-sm bg-paperLight"
                                  />
                                ) : (
                                  <div className="w-full h-20 rounded-sm bg-paperLight flex items-center justify-center">
                                    <PawPrint className="w-5 h-5 text-cardboard" />
                                  </div>
                                )}
                                <span className="block font-body text-[11px] font-bold text-ink mt-1.5 truncate">
                                  {product.name}
                                </span>
                                <span className="block font-mono text-[10px] font-bold text-herb">
                                  ₹{Number(product.price).toFixed(0)}
                                </span>
                                {product.in_stock === false && (
                                  <span className="block font-mono text-[9px] uppercase text-paprika font-bold">
                                    Out of stock
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sensitive HITL action confirmation dialogs */}
                      {msg.hasActionConfirmation && msg.hasActionConfirmation.confirmed === undefined && (
                        <div className="mt-4 p-3 bg-red-50 border border-turmeric border-opacity-40 rounded-xl space-y-3">
                          <div className="flex items-start space-x-2 text-paprika">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span className="font-mono text-xs uppercase font-bold tracking-wider leading-tight">
                              SECURE AUTHORIZATION REQUIRED
                            </span>
                          </div>
                          <p className="font-body text-[11px] text-ink">
                            The assistant suggests executing a cancellation action for ID <span className="font-mono font-bold text-paprika">#{msg.hasActionConfirmation.targetId}</span>. Please click to approve:
                          </p>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleConfirmAction(msg.id, msg.hasActionConfirmation!.actionType, msg.hasActionConfirmation!.targetId)}
                              className="bg-herb text-paperLight font-mono text-[10px] uppercase font-bold py-1 px-3 rounded-full flex items-center space-x-1 hover:opacity-95"
                            >
                              <Check className="w-3 h-3" />
                              <span>Confirm Action</span>
                            </button>
                            <button
                              onClick={() => handleDeclineAction(msg.id)}
                              className="border border-cardboard hover:bg-paper text-ink font-mono text-[10px] uppercase font-bold py-1 px-3 rounded-full flex items-center space-x-1"
                            >
                              <X className="w-3 h-3" />
                              <span>Decline</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* SSE tool status notification */}
          {isStreaming && statusText && (
            <div className="flex items-center space-x-2 text-herb font-mono text-xs uppercase tracking-wide pl-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{statusText}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Floating Input Box Container (Claude Style) */}
        <div className="max-w-3xl w-full mx-auto sticky bottom-0 bg-paper bg-opacity-95 pt-4 pb-2 z-10">

          {/* Image Preview bar */}
          {imagePreview && (
            <div className="flex items-center space-x-3 bg-paper p-2 border border-cardboard border-dashed rounded-sm mb-2">
              <img src={imagePreview} alt="upload preview" className="w-12 h-12 object-cover rounded-sm border border-cardboard" />
              <div>
                <span className="font-mono text-[8px] uppercase font-bold text-herb block">Sourced Image Ready</span>
                <span className="font-body text-[10px] text-ink opacity-70">{selectedImage?.name}</span>
              </div>
              <button
                onClick={() => { setSelectedImage(null); setImagePreview(''); }}
                className="ml-auto p-1.5 text-paprika hover:bg-red-50 rounded-sm"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="border border-cardboard bg-paperLight rounded-2xl px-4 py-3 shadow-md flex flex-col space-y-3 focus-within:border-turmeric transition-colors text-left">
            {/* Auto-growing Text Area */}
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={selectedImage ? "Describe pet symptoms or upload details..." : "Ask Scooby's assistant a question..."}
              className="w-full min-h-[44px] max-h-[140px] resize-none border-0 bg-transparent font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:ring-0 py-1"
              disabled={isStreaming}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />

            {/* Bottom Actions Row */}
            <div className="flex justify-between items-center border-t border-cardboard border-opacity-25 pt-2.5">
              {/* Left Column: Attachment Plus */}
              <div className="flex items-center space-x-2">
                <label className="p-1.5 border border-cardboard rounded-full hover:bg-paper cursor-pointer text-ink relative flex items-center justify-center w-8 h-8">
                  <Plus className="w-3.5 h-3.5 text-ink" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                    disabled={isStreaming}
                  />
                </label>
              </div>

              {/* Right Column: Voice mic, Send button */}
              <div className="flex items-center space-x-2 relative">
                {/* Voice mic button */}
                {isRecording ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="w-8 h-8 bg-turmeric text-ink rounded-full animate-pulse flex items-center justify-center border border-turmeric cursor-pointer"
                  >
                    <MicOff className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="w-8 h-8 border border-cardboard hover:bg-paper text-ink rounded-full flex items-center justify-center cursor-pointer"
                    disabled={isStreaming}
                  >
                    <Mic className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Send action arrow */}
                <button
                  type="submit"
                  className="w-8 h-8 bg-turmeric hover:bg-opacity-95 text-ink rounded-full flex items-center justify-center disabled:opacity-40 font-bold cursor-pointer"
                  disabled={isStreaming || (!inputMessage.trim() && !selectedImage)}
                >
                  ↑
                </button>
              </div>
            </div>
          </form>

          {/* Claude style footnote */}
          <p className="mt-3 text-center text-ink opacity-40 font-mono text-[8px] uppercase tracking-wider select-none">
            Scooby AI is an assistant and can make mistakes. Please double-check veterinary diagnoses.
          </p>
        </div>

      </main>
      {/* Footer */}
      <footer className="mt-auto border-t border-cardboard py-8 text-center text-ink opacity-60 font-mono text-[9px] uppercase tracking-wider w-full">
        © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
      </footer>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
