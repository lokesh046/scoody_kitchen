import axios from 'axios';
import { useAuthStore } from '../store/auth';

const CHATBOT_BASE_URL = import.meta.env.VITE_CHATBOT_BASE_URL || 'http://127.0.0.1:8002';

export interface ChatResponse {
  reply: string;
  status: string;
  session_id: string;
  sources: string[];
}

export const chatbotClient = axios.create({
  baseURL: CHATBOT_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach bearer token if present
chatbotClient.interceptors.request.use(
  (config) => {
    try {
      const token = useAuthStore.getState().accessToken;
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error('Failed to read auth token for chatbot request:', e);
    }
    return config;
  },
  (err) => Promise.reject(err)
);

export const clearChatSession = async (sessionId: string): Promise<{ status: string; message: string }> => {
  const response = await chatbotClient.delete(`/chat/session/${sessionId}`);
  return response.data;
};

export const postImageChat = async (file: File, message: string, sessionId: string): Promise<ChatResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('message', message);
  formData.append('session_id', sessionId);

  const response = await chatbotClient.post<ChatResponse>('/chat/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const postVoiceChat = async (file: Blob, sessionId: string): Promise<ChatResponse> => {
  const formData = new FormData();
  // Name the file with appropriate extension so the backend validates it correctly
  formData.append('file', file, 'voice_recording.wav');
  formData.append('session_id', sessionId);

  const response = await chatbotClient.post<ChatResponse>('/chat/voice', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// SSE streaming function
export const streamChat = async (
  message: string,
  sessionId: string,
  onToken: (token: string) => void,
  onStatus: (status: string) => void,
  onSources: (sources: string[]) => void,
  onError: (error: string) => void,
  onDone: () => void,
  token: string | null
) => {
  try {
    const response = await fetch(`${CHATBOT_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message,
        session_id: sessionId,
      }),
    });

    if (!response.ok) {
      throw new Error(`SSE stream error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');

    if (!reader) {
      throw new Error('Response body reader is unavailable.');
    }

    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned.startsWith('data: ')) continue;
        
        try {
          const data = JSON.parse(cleaned.substring(6));
          if (data.type === 'token') {
            onToken(data.content);
          } else if (data.type === 'status') {
            onStatus(data.content);
          } else if (data.type === 'sources') {
            onSources(data.sources);
          } else if (data.type === 'error') {
            onError(data.detail);
          } else if (data.type === 'done') {
            onDone();
          }
        } catch (e) {
          console.error('Error parsing SSE line:', e);
        }
      }
    }
  } catch (err: any) {
    console.error('SSE Stream failed:', err);
    onError(err.message || 'Stream connection failed.');
  }
};

export interface RAGDocument {
  doc_id: string;
  title: string;
  category: string;
}

export const uploadRAGDocument = async (
  file: File,
  title?: string,
  category?: string
): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);
  if (category) formData.append('category', category);

  const response = await chatbotClient.post('/rag/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const fetchRAGDocuments = async (): Promise<RAGDocument[]> => {
  const response = await chatbotClient.get<RAGDocument[]>('/rag/documents');
  return response.data;
};

export const deleteRAGDocument = async (docId: string): Promise<any> => {
  const response = await chatbotClient.delete(`/rag/documents/${docId}`);
  return response.data;
};

export interface ChatbotHealthResponse {
  status: string;
  service: string;
}

export const fetchChatbotHealth = async (): Promise<ChatbotHealthResponse> => {
  const response = await chatbotClient.get<ChatbotHealthResponse>('/health');
  return response.data;
};
