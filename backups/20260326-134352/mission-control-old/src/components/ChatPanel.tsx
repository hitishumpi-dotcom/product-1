import { useState, useRef, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { fetchHealth } from '../api/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  stub?: boolean;
  streaming?: boolean;
}

interface ChatStatus { ok: boolean; reason: string; }

interface Props { activeLane: string; }

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatPanel({ activeLane }: Props) {
  const { data: health } = useApi(fetchHealth, [], 5000);
  const [chatStatus, setChatStatus] = useState<ChatStatus | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<{ role: string; content: string }[]>([]);

  // Check chat endpoint status
  useEffect(() => {
    fetch('/api/chat/status')
      .then(r => r.json() as Promise<ChatStatus>)
      .then(setChatStatus)
      .catch(() => setChatStatus({ ok: false, reason: 'API unreachable' }));
  }, [health]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    historyRef.current = [...historyRef.current, { role: 'user', content: text }];

    const aId = crypto.randomUUID();
    const aMsg: Message = { id: aId, role: 'assistant', content: '', ts: Date.now(), streaming: true };
    setMessages(prev => [...prev, aMsg]);

    try {
      const resp = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          lane: activeLane,
          history: historyRef.current.slice(-20),
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` })) as { error?: string };
        setMessages(prev => prev.map(m => m.id === aId
          ? { ...m, content: `Error: ${err.error ?? 'unknown'}`, streaming: false }
          : m));
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          try {
            const chunk = JSON.parse(payload) as {
              content?: string; done?: boolean; stub?: boolean; error?: string;
            };
            if (chunk.error) {
              setMessages(prev => prev.map(m => m.id === aId
                ? { ...m, content: `Error: ${chunk.error}`, streaming: false }
                : m));
              break;
            }
            if (chunk.content) {
              fullContent += chunk.content;
              setMessages(prev => prev.map(m => m.id === aId
                ? { ...m, content: fullContent, stub: chunk.stub }
                : m));
            }
            if (chunk.done) {
              setMessages(prev => prev.map(m => m.id === aId
                ? { ...m, streaming: false }
                : m));
            }
          } catch { /* skip */ }
        }
      }

      if (fullContent) {
        historyRef.current = [...historyRef.current, { role: 'assistant', content: fullContent }];
      }
      setMessages(prev => prev.map(m => m.id === aId ? { ...m, streaming: false } : m));
    } catch (e: unknown) {
      setMessages(prev => prev.map(m => m.id === aId
        ? { ...m, content: `Error: ${e instanceof Error ? e.message : String(e)}`, streaming: false }
        : m));
    } finally {
      setSending(false);
    }
  }, [input, sending, activeLane]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  }

  const apiOnline    = health?.ok === true;
  const chatReady    = chatStatus?.ok === true;
  const showSetupBanner = apiOnline && chatStatus !== null && !chatReady;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e2433] bg-[#0a0d14] flex-shrink-0">
        <div>
          <span className="text-sm font-semibold text-gray-200">OpenClaw</span>
          <span className="ml-2 text-xs text-gray-500 capitalize">{activeLane}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${apiOnline ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-500">{apiOnline ? 'API' : 'API offline'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${chatReady ? 'bg-green-400 animate-pulse' : 'bg-yellow-500'}`} />
            <span className="text-xs text-gray-500">{chatReady ? 'Gateway' : 'Setup needed'}</span>
          </div>
        </div>
      </div>

      {/* Setup banner */}
      {showSetupBanner && (
        <div className="bg-yellow-950/40 border-b border-yellow-800/40 px-5 py-3 flex-shrink-0">
          <div className="text-xs text-yellow-300 font-medium mb-1">Gateway chat endpoint not enabled</div>
          <div className="text-xs text-yellow-600 font-mono leading-relaxed">
            Run in terminal:<br />
            <span className="text-yellow-400 select-all">
              openclaw config set gateway.http.endpoints.chatCompletions.enabled true
            </span>
          </div>
          <div className="text-[10px] text-yellow-700 mt-1">Then restart the Gateway. Chat will activate automatically.</div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-600 text-sm mt-12">
            {chatReady ? 'Send a message to start.' : 'Enable the Gateway endpoint to begin chatting.'}
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
              ${m.role === 'user'
                ? 'bg-indigo-600 text-white rounded-br-sm'
                : `bg-[#1a1f2e] border border-[#1e2433] text-gray-200 rounded-bl-sm ${m.stub ? 'opacity-70' : ''}`}`}>
              {m.content || <span className="opacity-40">…</span>}
              {m.streaming && <span className="inline-block w-1.5 h-3.5 bg-indigo-400 ml-1 animate-pulse rounded-sm align-middle" />}
              {m.stub && !m.streaming && <span className="text-[10px] text-gray-500 ml-2">[stub]</span>}
            </div>
            <div className="text-[10px] text-gray-600 mt-1 px-1">{fmt(m.ts)}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-4 border-t border-[#1e2433] flex-shrink-0">
        <div className="flex items-end gap-3">
          <textarea
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={chatReady
              ? `Message OpenClaw (${activeLane})…`
              : 'Enable Gateway endpoint to chat…'}
            className="flex-1 bg-[#1a1f2e] border border-[#2d3748] rounded-xl px-4 py-3 text-sm text-gray-200
              placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            onClick={() => void send()}
            disabled={!input.trim() || sending}
            className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30
              disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
        <div className="text-[10px] text-gray-700 mt-1.5">Enter to send · Shift+Enter for newline</div>
      </div>
    </div>
  );
}
