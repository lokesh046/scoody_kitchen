import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { logoutUser } from '../../api/auth';
import { cancelOrder } from '../../api/orders';
import { cancelConsultation } from '../../api/consultations';
import { CartDrawer } from '../../components/CartDrawer';
import { 
  streamChat, postImageChat, postVoiceChat, clearChatSession 
} from '../../api/chatbot';
import { 
  ArrowLeft, ShoppingCart, LogOut, User, PawPrint, 
  Send, Mic, MicOff, Trash2, ShieldAlert, Check, X,
  Loader2, AlertCircle, Sparkles, Paperclip
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
  const navigate = useNavigate();
  const { user, accessToken, clearAuth } = useAuthStore();
  const { items: cartItems, clear: clearCart } = useCartStore();
  const [isCartOpen, setIsCartOpen] = useState(false);

  const totalCartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Chat State
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
    setSessionId(`u${userId}_session_${randomId}`);
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

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      clearAuth();
      clearCart();
      navigate('/login');
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
          sources: response.sources
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
      accessToken
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
        sources: response.sources
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
    setMessages([]);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Full-width Top Navigation Header bar */}
      <header className="w-full border-b border-cardboard border-opacity-25 bg-ink bg-opacity-95 backdrop-blur-md sticky top-0 z-30 shadow-sm text-paper">
        <div className="w-full px-4 md:px-8 py-4 flex justify-between items-center md:grid md:grid-cols-12">
          
          {/* Left Corner: Brand Logo & Title */}
          <div className="flex items-center space-x-3 cursor-pointer md:col-span-3 justify-start select-none" onClick={() => navigate('/')}>
            <PawPrint className="text-turmeric w-6 h-6 animate-pulse" />
            <div>
              <h1 className="font-display font-bold text-2xl tracking-tight text-paper">
                Scooby's Kitchen
              </h1>
              <p className="font-mono text-[9px] uppercase tracking-wider text-turmeric opacity-85">
                Notebook Ledger v1.0
              </p>
            </div>
          </div>

          {/* Center: Navigation Menu */}
          <nav className="hidden md:flex space-x-4 lg:space-x-6 font-body text-xs font-bold uppercase tracking-wider text-paper md:col-span-6 justify-center">
            <button onClick={() => navigate('/shop')} className="hover:text-turmeric transition-colors pb-1">Shop Recipes</button>
            <button onClick={() => navigate('/pets')} className="hover:text-turmeric transition-colors pb-1">Pets Ledger</button>
            <button onClick={() => navigate('/consultations')} className="hover:text-turmeric transition-colors pb-1">Vet Consults</button>
            <button onClick={() => navigate('/orders')} className="hover:text-turmeric transition-colors pb-1">My Orders</button>
            <button onClick={() => navigate('/assistant')} className="hover:text-turmeric transition-colors pb-1 font-bold border-b-2 border-turmeric">AI Assistant 🐾</button>
            <button onClick={() => navigate('/profile')} className="hover:text-turmeric transition-colors pb-1">My Profile</button>
            {user?.role === 'admin' && (
              <button onClick={() => navigate('/admin')} className="hover:text-turmeric text-turmeric transition-colors pb-1">Admin Panel 🛠️</button>
            )}
            {(user?.role === 'doctor' || user?.role === 'admin') && (
              <button onClick={() => navigate('/doctor')} className="hover:text-turmeric text-turmeric transition-colors pb-1">Doctor Panel 🩺</button>
            )}
          </nav>

          {/* Right Corner: Actions */}
          <div className="flex items-center space-x-4 md:col-span-3 justify-end">
            {user && (
              <span className="font-mono text-[10px] uppercase font-bold text-turmeric">
                {user.first_name || 'User'}
              </span>
            )}

            <button 
              onClick={() => setIsCartOpen(true)}
              className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 relative text-paper"
            >
              <ShoppingCart className="w-4 h-4" />
              {totalCartQuantity > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-paprika text-paperLight font-mono text-[9px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center animate-bounce">
                  {totalCartQuantity}
                </span>
              )}
            </button>

            {user ? (
              <button
                onClick={handleLogout}
                className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 text-paper flex items-center space-x-1.5 font-body text-[10px] font-bold uppercase"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 text-paper flex items-center space-x-1.5 font-body text-[10px] font-bold uppercase"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Centered Main Content Wrapper */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8">

      {/* Back Link */}
      <div className="mb-4 flex justify-between items-center text-left">
        <button
          onClick={() => navigate('/shop')}
          className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Back to Product Ledger</span>
        </button>

        <button
          onClick={clearChat}
          className="font-mono text-[9px] uppercase tracking-wider text-paprika hover:opacity-100 flex items-center space-x-1 border border-paprika border-dashed px-2.5 py-1 rounded-sm bg-paperLight"
        >
          <Trash2 className="w-3 h-3" />
          <span>Clear Conversation</span>
        </button>
      </div>

      {/* Emergency health warning banner */}
      {showEmergencyAlert && (
        <div className="bg-red-50 border border-paprika p-4 rounded-sm mb-6 flex items-start space-x-3 text-paprika font-body text-xs text-left animate-pulse">
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

      {/* Main layout */}
      <div className="flex-grow flex flex-col md:flex-row gap-8 items-stretch text-left min-h-[60vh]">
        {/* Left Side: Recipe Assistant Panel */}
        <div className="flex-1 border border-cardboard bg-paperLight rounded-sm shadow-md flex flex-col justify-between overflow-hidden relative min-h-[500px]">
          {/* Notebook binder spines styling */}
          <div className="absolute top-0 bottom-0 left-1 border-l border-dashed border-cardboard opacity-35"></div>

          {/* Assistant Title header */}
          <div className="border-b border-cardboard p-4 bg-paper bg-opacity-40 flex items-center space-x-3">
            <Sparkles className="w-5 h-5 text-turmeric shrink-0" />
            <div>
              <h2 className="font-display font-bold text-lg text-ink">Scooby's AI Recipe Assistant</h2>
              <span className="font-mono text-[8px] uppercase font-bold text-herb">STREAMING CHAT WORKFLOW ACTIVE</span>
            </div>
          </div>

          {/* Messages stream */}
          <div className="flex-grow overflow-y-auto p-6 space-y-6 min-h-[450px]">
            {messages.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <PawPrint className="w-12 h-12 text-cardboard mx-auto stroke-1" />
                <h4 className="font-display font-bold text-ink">Ask Anything About Scooby's Kitchen</h4>
                <p className="font-body text-xs text-ink opacity-70 max-w-xs mx-auto">
                  Type questions to query inventory, track placed orders, cancel active orders, or get diagnostic recipe advice.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex items-start max-w-[85%] ${
                    msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto flex-row'
                  }`}
                >
                  {/* Modern Avatar */}
                  {msg.role === 'user' ? (
                    <div className="w-8 h-8 rounded-full bg-turmeric bg-opacity-20 border border-turmeric border-opacity-40 flex items-center justify-center text-turmeric shadow-sm shrink-0 ml-3">
                      <User className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-paprika bg-opacity-20 border border-paprika border-opacity-40 flex items-center justify-center text-paprika shadow-sm shrink-0 mr-3">
                      <PawPrint className="w-4 h-4 animate-pulse" />
                    </div>
                  )}

                  <div className="flex flex-col space-y-1">
                    <span className={`font-mono text-[10px] uppercase text-cardboard font-bold ${
                      msg.role === 'user' ? 'text-right' : 'text-left'
                    }`}>
                      {msg.role === 'user' ? 'CUSTOMER' : 'AI ASSISTANT'}
                    </span>
                    <div className={`p-4 rounded-2xl shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-ink text-paper border border-cardboard border-opacity-40 rounded-tr-none' 
                        : 'bg-paper text-ink border border-cardboard border-opacity-30 rounded-tl-none'
                    }`}>
                      {renderFormattedText(msg.content)}

                    {/* RAG Sourced items */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-cardboard border-dashed">
                        <span className="font-mono text-[10px] uppercase text-herb font-bold block">Sourced knowledge files:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {msg.sources.map((src, idx) => (
                            <span key={idx} className="font-mono text-[10px] bg-paper px-2 py-0.5 border border-cardboard rounded-sm text-ink opacity-80">
                              {src}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sensitive HITL action confirmation dialogs */}
                    {msg.hasActionConfirmation && msg.hasActionConfirmation.confirmed === undefined && (
                      <div className="mt-4 p-3 bg-red-50 border border-paprika border-opacity-40 rounded-sm space-y-3">
                        <div className="flex items-start space-x-2 text-paprika">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span className="font-mono text-sm uppercase font-bold tracking-wider leading-tight">
                            SECURE AUTHORIZATION REQUIRED
                          </span>
                        </div>
                        <p className="font-body text-sm text-ink">
                          The assistant suggests executing a cancellation action for ID <span className="font-mono font-bold text-paprika">#{msg.hasActionConfirmation.targetId}</span>. Please click to approve:
                        </p>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleConfirmAction(msg.id, msg.hasActionConfirmation!.actionType, msg.hasActionConfirmation!.targetId)}
                            className="bg-herb text-paperLight font-mono text-xs uppercase font-bold py-1 px-3 rounded-sm flex items-center space-x-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Confirm Action</span>
                          </button>
                          <button
                            onClick={() => handleDeclineAction(msg.id)}
                            className="border border-cardboard hover:bg-paper text-ink font-mono text-xs uppercase font-bold py-1 px-3 rounded-sm flex items-center space-x-1"
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
            ))
            )}

            {/* SSE tool status notification */}
            {isStreaming && statusText && (
              <div className="flex items-center space-x-2 text-herb font-mono text-sm uppercase tracking-wide pl-4">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{statusText}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Form message sender inputs */}
          <div className="border-t border-cardboard p-4 bg-paper bg-opacity-40 space-y-3">
            {/* Image Preview bar */}
            {imagePreview && (
              <div className="flex items-center space-x-3 bg-paper p-2 border border-cardboard border-dashed rounded-sm">
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

            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
              {/* File picker */}
              <label className="p-2 border border-cardboard rounded-sm hover:bg-paper cursor-pointer text-ink relative">
                <Paperclip className="w-4 h-4" />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageChange}
                  disabled={isStreaming} 
                />
              </label>

              {/* Voice microphone button */}
              {isRecording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="p-2 bg-paprika text-paperLight rounded-sm animate-pulse relative"
                >
                  <MicOff className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="p-2 border border-cardboard rounded-sm hover:bg-paper text-ink relative"
                  disabled={isStreaming}
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}

              {/* Text Input */}
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={selectedImage ? "Enter description for this image analysis..." : "Ask Scooby's assistant a question..."}
                className="flex-1 px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric"
                disabled={isStreaming}
              />

              <button
                type="submit"
                className="p-2 bg-paprika hover:bg-opacity-95 text-paperLight rounded-sm disabled:opacity-50"
                disabled={isStreaming || (!inputMessage.trim() && !selectedImage)}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      {/* Footer */}
      <footer className="mt-20 border-t border-cardboard pt-8 text-center text-ink opacity-60 font-mono text-[9px] uppercase tracking-wider">
        © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
      </footer>
      </div>
      </main>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
