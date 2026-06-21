import { useState } from 'react';
import { requestRepositoryIndex, streamChatResponse } from './services/api.js';

function App() {
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [repository, setRepository] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');

  async function handleIndexRepository(event) {
    event.preventDefault();
    setError('');
    setRepository(null);
    setAnswer('');
    setCitations([]);
    setIsIndexing(true);

    try {
      const indexedRepository = await requestRepositoryIndex(repositoryUrl);
      setRepository(indexedRepository);
    } catch (caughtError) {
      setError(caughtError.response?.data?.detail ?? caughtError.message);
    } finally {
      setIsIndexing(false);
    }
  }

  async function handleAskQuestion(event) {
    event.preventDefault();
    if (!repository || !question.trim()) {
      return;
    }

    setError('');
    setAnswer('');
    setCitations([]);
    setIsStreaming(true);

    try {
      await streamChatResponse({
        repositoryId: repository.repository_id,
        message: question,
        onToken: (token) => setAnswer((currentAnswer) => `${currentAnswer}${token}`),
        onCitations: setCitations,
      });
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-8 flex flex-col gap-3 border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            AI Repository Intelligence Platform
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">GitMind Pro</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            Index a public GitHub repository into ChromaDB, then ask codebase questions with streamed
            answers and source citations.
          </p>
        </header>

        <div className="grid gap-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">Repository Indexing</h2>
            <form className="mt-4 flex flex-col gap-3 md:flex-row" onSubmit={handleIndexRepository}>
              <input
                className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
                placeholder="https://github.com/owner/repository"
                type="url"
                value={repositoryUrl}
                onChange={(event) => setRepositoryUrl(event.target.value)}
                required
              />
              <button
                className="min-h-11 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                type="submit"
                disabled={isIndexing}
              >
                {isIndexing ? 'Indexing...' : 'Index Repository'}
              </button>
            </form>

            {repository ? (
              <div className="mt-4 rounded-md bg-emerald-50 p-4 text-sm text-emerald-950">
                Indexed <span className="font-semibold">{repository.name}</span>: {repository.indexed_files}{' '}
                files, {repository.chunks} chunks.
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">Repository Chat</h2>
            <form className="mt-4 grid gap-3" onSubmit={handleAskQuestion}>
              <textarea
                className="min-h-28 rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-slate-900 disabled:bg-slate-100"
                placeholder="Ask how the repository works, where a feature is implemented, or what files matter."
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={!repository || isStreaming}
                required
              />
              <button
                className="min-h-11 w-fit rounded-md bg-blue-700 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                type="submit"
                disabled={!repository || isStreaming}
              >
                {isStreaming ? 'Streaming...' : 'Ask GitMind'}
              </button>
            </form>

            {answer ? (
              <div className="mt-5 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800">
                {answer}
              </div>
            ) : null}

            {citations.length > 0 ? (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-700">Sources</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {citations.map((citation) => (
                    <span
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700"
                      key={`${citation.file_path}:${citation.start_line}-${citation.end_line}`}
                    >
                      {citation.file_path}:{citation.start_line}-{citation.end_line}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default App;
