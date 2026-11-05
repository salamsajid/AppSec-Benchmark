import React, { useState, useRef, useEffect } from 'react';
import { API } from '../api.js';

export default function Assistant() {
  const [q, setQ] = useState('');
  const [log, setLog] = useState([
    {
      role: 'assistant',
      q: null,
      a: 'Welcome to <strong>Stratos AI Specialist</strong>. I am your autonomous automotive concierge, directly interfaced with our nationwide dealership inventory, pricing valuation algorithms, and vehicle diagnostic registries. How may I assist you today?',
      toolCalls: [],
      flag: null,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('standard'); // 'standard' or 'scanned'
  const chatBottomRef = useRef(null);

  const samplePrompts = [
    { label: '🏎️ Sporty Sedans', query: 'Show me sporty sedans with low mileage' },
    { label: '💰 Under $20,000', query: 'Find reliable vehicles under $20000' },
    { label: '🔍 Value Appraisal', query: 'What is the valuation and dealer cost for vehicle 1?' },
    { label: '⚡ Electric Models', query: 'Which electric and hybrid vehicles do you have in stock?' },
    { label: '🏢 Dealer Directory', query: 'Which certified dealerships are in Mumbai and Delhi?' },
    { label: '📋 System Tools', query: 'What diagnostic and search tools are active?' }
  ];

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log, loading]);

  const ask = async (e, customPrompt = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const query = (customPrompt !== null ? customPrompt : q).trim();
    if (!query) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLog(prev => [...prev, {
      role: 'user',
      q: query,
      a: null,
      toolCalls: [],
      flag: null,
      time: timeStr
    }]);

    if (customPrompt === null) setQ('');
    setLoading(true);

    try {
      const endpoint = mode === 'scanned' ? `${API.ai}/chat/scanned` : `${API.ai}/chat`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      });
      const data = await res.json();

      let replyText = data.reply || (typeof data === 'string' ? data : JSON.stringify(data));
      const toolCalls = data.tool_calls || [];
      const flag = data.flag || null;
      const blocked = data.blocked || false;

      setLog(prev => [
        ...prev,
        {
          role: 'assistant',
          q: query,
          a: replyText,
          toolCalls,
          flag,
          blocked,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err) {
      setLog(prev => [
        ...prev,
        {
          role: 'assistant',
          q: query,
          a: `<span style="color:#ef4444;">Connection error: Failed to reach the AI Specialist neural gateway (${err.message}).</span>`,
          toolCalls: [],
          flag: null,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setLog([
      {
        role: 'assistant',
        q: null,
        a: 'Conversation reset. Ready for your automotive inquiries, inventory searches, or diagnostic queries.',
        toolCalls: [],
        flag: null,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  return (
    <div className="am-assistant-page">
      {/* Hero Showcase Banner */}
      <div className="am-ai-hero-card">
        <div className="am-ai-hero-overlay" />
        <div className="am-ai-hero-content">
          <div className="am-ai-status-row">
            <span className="am-ai-live-pill">
              <span className="am-pulse-led" />
              Stratos Neural Specialist v4.2
            </span>
            <div className="am-ai-telemetry-tags">
              <span className="am-telemetry-tag">
                <span className="am-dot green" /> Catalog DB: Connected
              </span>
              <span className="am-telemetry-tag">
                <span className="am-dot cyan" /> Live Telematics: Active
              </span>
              <span className="am-telemetry-tag">
                <span className="am-dot violet" /> Multi-Tool Engine: Ready
              </span>
            </div>
          </div>

          <h1 className="am-ai-title">
            AI Automotive <span>Specialist & Concierge</span>
          </h1>
          <p className="am-ai-desc">
            Directly connected to national vehicle inventories, pricing valuation models, 
            instant dealer communications, and autonomous diagnostic tool pipelines.
          </p>

          {/* Mode Switcher */}
          <div className="am-ai-mode-bar">
            <span className="am-mode-label">Safety Filter Mode:</span>
            <div className="am-mode-toggles">
              <button
                type="button"
                className={`am-mode-btn ${mode === 'standard' ? 'active' : ''}`}
                onClick={() => setMode('standard')}
                title="Full Autonomous Agency: Executes tool pipelines without safety filter"
              >
                <span>⚡</span> Standard Autonomous (Direct)
              </button>
              <button
                type="button"
                className={`am-mode-btn ${mode === 'scanned' ? 'active' : ''}`}
                onClick={() => setMode('scanned')}
                title="Strict Content Scanner: Evaluates messages against guardrail policies"
              >
                <span>🛡️</span> Policy Guard (Scanned)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Quick Prompts */}
      <div className="am-ai-suggestions-bar">
        <span className="am-suggestions-title">Recommended Prompts:</span>
        <div className="am-suggestions-scroll">
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              className="am-prompt-chip"
              onClick={() => ask(null, p.query)}
              disabled={loading}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Terminal Container */}
      <div className="am-ai-terminal-container">
        <div className="am-ai-terminal-header">
          <div className="am-terminal-info">
            <div className="am-bot-avatar">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
                <rect x="3" y="8" width="18" height="12" rx="4" />
                <circle cx="8" cy="14" r="2" />
                <circle cx="16" cy="14" r="2" />
                <path d="M10 18h4" />
              </svg>
            </div>
            <div>
              <div className="am-bot-name">Stratos Neural Co-Pilot</div>
              <div className="am-bot-sub">Online • Direct Catalog & Tool Agency</div>
            </div>
          </div>

          <div className="am-terminal-actions">
            <button
              type="button"
              className="am-terminal-btn"
              onClick={clearChat}
              title="Clear transcript"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Clear Chat
            </button>
          </div>
        </div>

        {/* Message Log */}
        <div className="am-ai-message-list">
          {log.map((m, i) => (
            <div className={`am-chat-row ${m.role}`} key={i}>
              {m.role === 'assistant' ? (
                <div className="am-bubble assistant">
                  <div className="am-bubble-meta">
                    <span className="am-badge-role">Specialist AI</span>
                    <span className="am-bubble-time">{m.time}</span>
                  </div>

                  {m.blocked && (
                    <div className="am-blocked-banner">
                      <span className="am-blocked-icon">⚠️</span>
                      <strong>Security Filter Triggered:</strong> Content blocked by active inspection rules.
                    </div>
                  )}

                  <div
                    className="am-bubble-text"
                    dangerouslySetInnerHTML={{ __html: m.a }}
                  />

                  {/* Render Tool Calls if present */}
                  {m.toolCalls && m.toolCalls.length > 0 && (
                    <div className="am-tool-executions-card">
                      <div className="am-tool-header">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                        </svg>
                        <span>Telemetry Actions Dispatched ({m.toolCalls.length})</span>
                      </div>
                      <div className="am-tools-list">
                        {m.toolCalls.map((tc, idx) => (
                          <div className="am-tool-pill" key={idx}>
                            <span className="am-tool-name">⚡ {tc.tool}</span>
                            <span className="am-tool-args">{JSON.stringify(tc.args)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Render Security Flag if captured */}
                  {m.flag && (
                    <div className="am-flag-captured-badge">
                      <div className="am-flag-trophy">🏆</div>
                      <div>
                        <div className="am-flag-title">Lab Security Canary Unlocked</div>
                        <code className="am-flag-code">{m.flag}</code>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="am-bubble user">
                  <div className="am-bubble-meta">
                    <span className="am-badge-role">You</span>
                    <span className="am-bubble-time">{m.time}</span>
                  </div>
                  <div className="am-bubble-text">{m.q}</div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="am-chat-row assistant">
              <div className="am-bubble assistant loading">
                <div className="am-ai-typing-indicator">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="am-typing-text">Querying vehicle catalogs, valuation matrix & telemetry tools...</span>
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Prompt Input Dock */}
        <form className="am-ai-input-dock" onSubmit={ask}>
          <div className="am-input-bar-wrapper">
            <svg className="am-input-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <input
              type="text"
              className="am-ai-text-input"
              placeholder="Ask anything about cars, pricing valuations, dealership inventory, or test commands..."
              value={q}
              onChange={e => setQ(e.target.value)}
              disabled={loading}
              autoFocus
            />
            {q && (
              <button
                type="button"
                className="am-input-clear-btn"
                onClick={() => setQ('')}
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              className="am-ai-send-btn"
              disabled={!q.trim() || loading}
            >
              <span>Send</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m5 12 7-7 7 7" />
                <path d="M12 19V5" />
              </svg>
            </button>
          </div>
          <div className="am-input-footer-hints">
            <span>💡 Tip: Ask for <code>show me sporty cars</code>, <code>price 1 15000</code>, or inspect valuation data.</span>
            <span className="am-keyboard-hint">Press <b>Enter ↵</b> to send</span>
          </div>
        </form>
      </div>
    </div>
  );
}
