import { useState } from 'react';
import { indexRepositoryWithProgress } from '../services/api';

const STAGE_LABELS = {
  cloning: '🔗 Cloning repository',
  scanning: '🔍 Scanning files',
  chunking: '✂️ Chunking code',
  embedding: '🧮 Generating embeddings',
  saving: '💾 Saving metadata',
};

export default function Sidebar({ repos, activeRepoId, onSelectRepo, onRepoIndexed }) {
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null); // { stage, percent, message }
  const [error, setError] = useState('');

  async function handleIndex(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setProgress({ stage: 'cloning', percent: 0, message: 'Starting…' });

    await indexRepositoryWithProgress(url.trim(), {
      onProgress: (data) => setProgress(data),
      onComplete: (data) => {
        onRepoIndexed?.(data);
        setUrl('');
        setShowForm(false);
        setProgress(null);
        setLoading(false);
      },
      onError: (msg) => {
        setError(msg);
        setProgress(null);
        setLoading(false);
      },
    });
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">🧠</div>
          <span className="logo-text">GitMind Pro</span>
          <span className="logo-badge">AI</span>
        </div>
        {!loading && (
          <button
            className="btn-index"
            onClick={() => { setShowForm(!showForm); setError(''); }}
          >
            <span>+</span>
            Index Repository
          </button>
        )}
      </div>

      {/* Index form */}
      {showForm && !loading && (
        <div className="index-form">
          <form onSubmit={handleIndex}>
            <input
              type="url"
              placeholder="https://github.com/user/repo"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
            {error && (
              <div style={{ fontSize: 11, color: '#fca5a5', marginBottom: 8, lineHeight: 1.4 }}>
                ⚠ {error}
              </div>
            )}
            <div className="index-form-actions">
              <button type="submit" className="btn-submit" disabled={!url.trim()}>
                → Index
              </button>
              <button type="button" className="btn-cancel" onClick={() => { setShowForm(false); setError(''); }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Progress display */}
      {loading && progress && (
        <div className="index-progress">
          <div className="progress-stage">{STAGE_LABELS[progress.stage] ?? progress.stage}</div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="progress-detail">
            <span className="progress-message">{progress.message}</span>
            <span className="progress-pct">{progress.percent}%</span>
          </div>
        </div>
      )}

      {repos.length > 0 && !loading && (
        <div className="sidebar-section-label">Repositories</div>
      )}

      <div className="repo-list">
        {repos.length === 0 && !loading ? (
          <div className="sidebar-empty">
            No repositories yet.<br />Index one to get started.
          </div>
        ) : (
          repos.map((repo) => (
            <div
              key={repo.id}
              className={`repo-item ${repo.id === activeRepoId ? 'active' : ''}`}
              onClick={() => onSelectRepo(repo)}
            >
              <div className="repo-icon">📦</div>
              <div className="repo-info">
                <div className="repo-name">{repo.name}</div>
                <div className="repo-meta">
                  {repo.indexed_files} files · {repo.chunks} chunks
                </div>
              </div>
              <div className="status-dot" title="Indexed" />
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
