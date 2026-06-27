import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export async function getHealth() {
  const { data } = await apiClient.get('/health');
  return data;
}

export async function listRepositories() {
  const { data } = await apiClient.get('/api/repositories/');
  return data;
}

export async function getRepository(repositoryId) {
  const { data } = await apiClient.get(`/api/repositories/${repositoryId}`);
  return data;
}

export async function requestRepositoryIndex(repositoryUrl) {
  const { data } = await apiClient.post('/api/repositories/index', {
    repository_url: repositoryUrl,
  });
  return data;
}

/**
 * Stream real-time progress events while indexing a repository.
 * Calls onProgress({ stage, percent, message }) for each progress event.
 * Calls onComplete(repoData) when done.
 * Calls onError(message) on failure.
 */
export async function indexRepositoryWithProgress(repositoryUrl, { onProgress, onComplete, onError }) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/repositories/index/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repository_url: repositoryUrl }),
    });
  } catch (err) {
    onError?.(`Network error: ${err.message}`);
    return;
  }

  if (!response.ok || !response.body) {
    const detail = await response.text();
    onError?.(detail || `Request failed with status ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const block of events) {
      const parsed = parseSSE(block);
      if (!parsed) continue;
      if (parsed.event === 'progress') onProgress?.(parsed.data);
      if (parsed.event === 'complete') onComplete?.(parsed.data);
      if (parsed.event === 'error') onError?.(parsed.data?.message ?? 'Unknown error');
    }
  }
}

export async function streamChatResponse({ repositoryId, message, onToken, onCitations, onError }) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repository_id: repositoryId, message }),
    });
  } catch (err) {
    onError?.(`Network error: ${err.message}`);
    return;
  }

  if (!response.ok || !response.body) {
    const detail = await response.text();
    onError?.(detail || `Request failed with status ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const block of events) {
      const parsed = parseSSE(block);
      if (!parsed) continue;
      if (parsed.event === 'token') onToken?.(parsed.data.text ?? '');
      if (parsed.event === 'citations') onCitations?.(parsed.data.citations ?? []);
    }
  }
}

function parseSSE(block) {
  const eventLine = block.split('\n').find((l) => l.startsWith('event:'));
  const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
  if (!dataLine) return null;
  try {
    return {
      event: eventLine ? eventLine.replace('event:', '').trim() : 'message',
      data: JSON.parse(dataLine.replace('data:', '').trim()),
    };
  } catch {
    return null;
  }
}
