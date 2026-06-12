import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Send, Loader2, Plus, MessageSquare, Sparkles, User, Copy, Check, Zap, RotateCcw } from "lucide-react";
import {
  askChat,
  listSessions,
  loadSession,
  streamChat,
  type Message,
  type SessionSummary,
  type Source,
} from "../lib/api";

export default function Chat() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useStream, setUseStream] = useState(true);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    refreshSessions();
  }, []);

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId)
        .then((d) => setMessages(d.messages))
        .catch((e) => setError(String(e)));
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [sessionId, loading]);

  async function refreshSessions() {
    try {
      setSessions(await listSessions());
    } catch {
      /* ignore */
    }
  }

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    await runQuestion(q);
  }

  async function runQuestion(q: string) {
    setError(null);
    const userMsg: Message = { role: "user", content: q };
    setMessages((m) => [...m, userMsg, { role: "assistant", content: "" }]);
    setLoading(true);

    try {
      if (useStream) {
        let assistantText = "";
        let sources: Source[] | undefined;
        let newSessionId: string | undefined;
        await streamChat(q, {
          session_id: sessionId,
          onToken: (t) => {
            assistantText += t;
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = { role: "assistant", content: assistantText, sources };
              return copy;
            });
          },
          onSession: (id) => {
            newSessionId = id;
          },
          onSources: (s) => {
            sources = s;
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = { role: "assistant", content: assistantText, sources: s };
              return copy;
            });
          },
        });
        if (newSessionId && newSessionId !== sessionId) {
          navigate(`/chat/${newSessionId}`, { replace: true });
        }
      } else {
        const res = await askChat(q, sessionId);
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            content: res.answer,
            sources: res.sources,
          };
          return copy;
        });
        if (res.session_id && res.session_id !== sessionId) {
          navigate(`/chat/${res.session_id}`, { replace: true });
        }
      }
      refreshSessions();
    } catch (e: any) {
      setError(e?.message || "Request failed");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  async function retryFrom(index: number) {
    if (loading) return;
    const msg = messages[index];
    if (!msg) return;
    // Find the user question that produced this turn
    const userIdx = msg.role === "user" ? index : index - 1;
    const userMsg = messages[userIdx];
    if (!userMsg || userMsg.role !== "user") return;
    // Trim everything from the user message onward, then re-run
    setMessages((m) => m.slice(0, userIdx));
    await runQuestion(userMsg.content);
  }

  return (
    <div className="flex h-full gap-4">
      <aside className="hidden w-64 shrink-0 flex-col rounded-2xl border border-slate-200/70 bg-white/80 shadow-sm backdrop-blur md:flex">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Sessions
          </span>
          <button
            onClick={() => navigate("/chat")}
            className="flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-slate-800"
          >
            <Plus size={12} /> New
          </button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {sessions.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-slate-400">
              Your conversations will appear here.
            </p>
          )}
          {sessions.map((s) => (
            <button
              key={s.session_id}
              onClick={() => navigate(`/chat/${s.session_id}`)}
              className={`group flex w-full items-center gap-2 truncate rounded-lg px-2.5 py-2 text-left text-xs transition ${
                s.session_id === sessionId
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <MessageSquare
                size={13}
                className={`shrink-0 ${s.session_id === sessionId ? "text-indigo-300" : "text-slate-400"}`}
              />
              <span className="truncate font-medium">{s.title || s.session_id.slice(0, 8)}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 shadow-sm backdrop-blur">
        <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-8">
          {messages.length === 0 && !loading && <EmptyState onPick={(q) => setInput(q)} />}
          {messages.map((m, i) => (
            <Bubble
              key={i}
              message={m}
              isLast={i === messages.length - 1}
              loading={loading}
              onRetry={() => retryFrom(i)}
            />
          ))}
          {error && (
            <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-white/60 p-3 sm:p-4">
          <div className="relative rounded-2xl border border-slate-200 bg-white shadow-sm transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              placeholder="Ask anything about your docs…"
              className="block w-full resize-none rounded-2xl bg-transparent px-4 pb-12 pt-3 text-sm outline-none placeholder:text-slate-400"
              disabled={loading}
            />
            <div className="absolute inset-x-2 bottom-2 flex items-center justify-between">
              <label className="flex cursor-pointer select-none items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100">
                <Zap size={12} className={useStream ? "text-indigo-500" : ""} />
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={useStream}
                  onChange={(e) => setUseStream(e.target.checked)}
                />
                <span className={useStream ? "text-slate-700" : ""}>
                  Streaming {useStream ? "on" : "off"}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <span className="hidden text-[11px] text-slate-400 sm:inline">
                  <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px]">↵</kbd>{" "}
                  send ·{" "}
                  <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px]">⇧↵</kbd>{" "}
                  newline
                </span>
                <button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  const suggestions = [
    "What is the return policy?",
    "What payment methods do you accept?",
    "How do I reset my password?",
    "Where can I track my order?",
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
        <Sparkles size={24} />
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">How can I help?</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        I answer questions from your uploaded documentation with cited sources.
      </p>
      <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50/40 hover:text-indigo-700"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({
  message,
  isLast,
  loading,
  onRetry,
}: {
  message: Message;
  isLast: boolean;
  loading: boolean;
  onRetry: () => void;
}) {
  const isUser = message.role === "user";
  const showTyping = !isUser && isLast && loading && !message.content;
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className={`fade-up flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
          <Sparkles size={14} />
        </div>
      )}
      <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed shadow-sm ${
            isUser
              ? "rounded-br-md bg-slate-900 text-white"
              : "rounded-bl-md border border-slate-200/70 bg-white text-slate-800"
          }`}
        >
          {showTyping ? (
            <span className="inline-flex items-center gap-1 text-slate-400">
              <span className="dot h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span className="dot h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span className="dot h-1.5 w-1.5 rounded-full bg-slate-400" />
            </span>
          ) : (
            message.content
          )}
        </div>

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 max-w-full rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Sources
            </div>
            <ul className="space-y-1">
              {message.sources.map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-white px-1 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                    {i + 1}
                  </span>
                  <span className="truncate font-medium text-slate-700">{s.filename}</span>
                  <span className="text-slate-400">· chunk {s.chunk_index}</span>
                  <span className="ml-auto rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] text-indigo-700">
                    {s.score.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!showTyping && message.content && (
          <div
            className={`mt-1 flex items-center gap-3 ${isUser ? "justify-end" : "justify-start"}`}
          >
            <button
              onClick={copy}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 transition hover:text-slate-700"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? "Copied" : "Copy"}
            </button>
            {isUser && (
              <button
                onClick={onRetry}
                disabled={loading}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 transition hover:text-slate-700 disabled:opacity-40"
                title="Retry this question"
              >
                <RotateCcw size={11} />
                Retry
              </button>
            )}
          </div>
        )}
      </div>
      {isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
          <User size={14} />
        </div>
      )}
    </div>
  );
}