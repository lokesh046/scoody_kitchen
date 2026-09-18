import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { refreshAuthTokenSilently } from './client';
import { resolveHost } from './resolveHost';
import { captureApiError } from '../services/sentry';
import { isNetworkError } from '../store/networkStore';

export const getChatbotBaseUrl = (): string => resolveHost(8002, process.env.EXPO_PUBLIC_CHATBOT_URL);

const CHATBOT_URL = getChatbotBaseUrl();

export interface ChatProduct {
  id: number;
  name: string;
  price: number;
  image_url?: string | null;
  in_stock?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  statusText?: string;
  sources?: string[];
  products?: ChatProduct[];
  isStreaming?: boolean;
}

export interface ChatResponse {
  reply: string;
  status: string;
  session_id: string;
  sources?: string[];
  products?: ChatProduct[];
}

export interface HistoricalMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Fallback REST call
export const sendChatMessage = async (
  message: string,
  sessionId: string,
  token?: string | null
): Promise<ChatResponse> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await axios.post<ChatResponse>(
    `${CHATBOT_URL}/chat`,
    { message, session_id: sessionId },
    { headers, timeout: 25000 }
  );
  return response.data;
};

// Stream via progressive XMLHttpRequest with automatic REST fallback
export const streamChatMessage = (
  message: string,
  sessionId: string,
  onToken: (token: string) => void,
  onStatus: (status: string) => void,
  onSources: (sources: string[]) => void,
  onError: (err: string) => void,
  onDone: () => void,
  token?: string | null,
  onProducts?: (products: ChatProduct[]) => void
): (() => void) => {
  const xhr = new XMLHttpRequest();
  let isDone = false;
  let hasReceivedTokens = false;

  const cleanup = () => {
    isDone = true;
    try {
      xhr.abort();
    } catch {}
  };

  xhr.open('POST', `${CHATBOT_URL}/chat/stream`);
  xhr.setRequestHeader('Content-Type', 'application/json');
  if (token) {
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  }

  let lastIndex = 0;

  xhr.onprogress = () => {
    if (isDone) return;
    try {
      const newText = xhr.responseText.substring(lastIndex);
      lastIndex = xhr.responseText.length;

      const lines = newText.split('\n');
      for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned.startsWith('data: ')) continue;
        const jsonStr = cleaned.substring(6).trim();
        if (!jsonStr) continue;

        try {
          const data = JSON.parse(jsonStr);
          if (data.type === 'token') {
            hasReceivedTokens = true;
            onToken(data.content);
          } else if (data.type === 'status') {
            onStatus(data.content);
          } else if (data.type === 'sources') {
            onSources(data.sources);
          } else if (data.type === 'products') {
            onProducts?.(data.products || []);
          } else if (data.type === 'error') {
            onError(data.detail || 'Streaming error');
          } else if (data.type === 'done') {
            isDone = true;
            onDone();
          }
        } catch {
          // ignore partial json chunks
        }
      }
    } catch (e) {
      console.log('Chunk parsing warning:', e);
    }
  };

  xhr.onload = () => {
    if (isDone) return;
    isDone = true;
    if (xhr.status >= 200 && xhr.status < 300) {
      onDone();
    } else {
      // If streaming endpoint fails, fallback to standard REST endpoint
      fallbackToRest();
    }
  };

  xhr.onerror = () => {
    if (isDone) return;
    isDone = true;
    fallbackToRest();
  };

  const fallbackToRest = async () => {
    if (hasReceivedTokens) {
      onDone();
      return;
    }
    try {
      onStatus('Finalizing veterinary answer...');
      let activeToken = token;

      // If streaming gave 401 Unauthorized, refresh the token silently first
      if (xhr.status === 401) {
        const refreshed = await refreshAuthTokenSilently();
        if (refreshed) {
          activeToken = refreshed;
        }
      }

      const res = await sendChatMessage(message, sessionId, activeToken);
      if (res.sources && res.sources.length > 0) {
        onSources(res.sources);
      }
      if (res.products && res.products.length > 0) {
        onProducts?.(res.products);
      }
      onToken(res.reply);
      onDone();
    } catch (err: any) {
      // Reached only when BOTH the streaming attempt (xhr.onerror/onload
      // fallback above) AND this REST fallback have failed — the user's
      // message genuinely never got a response, always worth knowing about.
      captureApiError(err, 'chat.fallbackFailed', { alwaysCapture: true });
      if (err.response?.status === 401) {
        onError('Authentication required or expired. Please log in to chat with Scooby AI.');
      } else if (isNetworkError(err)) {
        onError('You appear to be offline. Check your connection and try sending your message again.');
      } else {
        onError(err.response?.data?.detail || 'Could not connect to Scooby AI service.');
      }
      onDone();
    }
  };

  xhr.send(JSON.stringify({ message, session_id: sessionId }));

  return cleanup;
};

export const fetchChatSessionHistory = async (
  sessionId: string,
  token?: string | null
): Promise<HistoricalMessage[]> => {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await axios.get<{ history: HistoricalMessage[] }>(
      `${CHATBOT_URL}/chat/session/${sessionId}`,
      { headers, timeout: 6000 }
    );
    return res.data?.history || [];
  } catch {
    return [];
  }
};

export const clearChatSession = async (
  sessionId: string,
  token?: string | null
): Promise<void> => {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    await axios.delete(`${CHATBOT_URL}/chat/session/${sessionId}`, { headers });
  } catch (e) {
    console.log('Error clearing chat session:', e);
  }
};
