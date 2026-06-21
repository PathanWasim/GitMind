import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function getHealth() {
  const response = await apiClient.get('/health');
  return response.data;
}

export async function requestRepositoryIndex(repositoryUrl) {
  const response = await apiClient.post('/api/repositories/index', {
    repository_url: repositoryUrl,
  });
  return response.data;
}

export async function streamChatResponse({ repositoryId, message, onToken, onCitations }) {
  const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repository_id: repositoryId,
      message,
    }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text();
    throw new Error(detail || `Chat request failed with ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const eventBlock of events) {
      const parsedEvent = parseServerSentEvent(eventBlock);
      if (!parsedEvent) {
        continue;
      }

      if (parsedEvent.event === 'token') {
        onToken?.(parsedEvent.data.text ?? '');
      }

      if (parsedEvent.event === 'citations') {
        onCitations?.(parsedEvent.data.citations ?? []);
      }
    }
  }
}

function parseServerSentEvent(eventBlock) {
  const eventLine = eventBlock.split('\n').find((line) => line.startsWith('event:'));
  const dataLine = eventBlock.split('\n').find((line) => line.startsWith('data:'));

  if (!dataLine) {
    return null;
  }

  return {
    event: eventLine ? eventLine.replace('event:', '').trim() : 'message',
    data: JSON.parse(dataLine.replace('data:', '').trim()),
  };
}
