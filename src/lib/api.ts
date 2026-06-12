export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

export type Source = { filename: string; chunk_index: number; score: number };
export type ChatResponse = { answer: string; sources: Source[]; session_id: string };
export type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};
export type SessionSummary = { session_id: string; title?: string; updated_at?: string };
export type DocumentItem = {
  doc_id: string;
  filename: string;
  status: string;
  created_at?: string;
};

export async function askChat(question: string, session_id?: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, session_id }),
  });
  if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
  return res.json();
}

export async function listSessions(): Promise<SessionSummary[]> {
  const res = await fetch(`${API_BASE}/api/chat`);
  if (!res.ok) throw new Error(`Sessions failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.sessions ?? [];
}

export async function loadSession(id: string): Promise<{ messages: Message[]; session_id: string }> {
  const res = await fetch(`${API_BASE}/api/chat/${id}`);
  if (!res.ok) throw new Error(`Load failed: ${res.status}`);
  const data = await res.json();
  const messages: Message[] = (data.messages || data.history || []).map((m: any) => ({
    role: m.role,
    content: m.content ?? m.answer ?? m.question ?? "",
    sources: m.sources,
  }));
  return { messages, session_id: data.session_id || id };
}

export async function listDocuments(): Promise<DocumentItem[]> {
  const res = await fetch(`${API_BASE}/api/docs`);
  if (!res.ok) throw new Error(`Docs failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.documents ?? [];
}

export async function uploadDocument(file: File): Promise<DocumentItem> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/docs/upload`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

export async function getDocStatus(id: string): Promise<DocumentItem> {
  const res = await fetch(`${API_BASE}/api/docs/${id}/status`);
  if (!res.ok) throw new Error(`Status failed: ${res.status}`);
  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function streamChat(
  question: string,
  opts: {
    session_id?: string;
    signal?: AbortSignal;
    onToken: (t: string) => void;
    onSession?: (id: string) => void;
    onSources?: (s: Source[]) => void;
  }
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, session_id: opts.session_id }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) throw new Error(`Stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleEvent = (raw: string) => {
    const dataLines = raw
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).replace(/^ /, ""));
    if (dataLines.length === 0) return;
    const payload = dataLines.join("\n");
    if (payload.startsWith("[SESSION]")) {
      opts.onSession?.(payload.slice("[SESSION]".length).trim());
    } else if (payload.startsWith("[SOURCES]")) {
      try {
        opts.onSources?.(JSON.parse(payload.slice("[SOURCES]".length).trim()));
      } catch {
        /* ignore */
      }
    } else if (payload === "[DONE]") {
      /* end marker */
    } else {
      opts.onToken(payload);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const event = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      handleEvent(event);
    }
  }
  if (buffer.trim()) handleEvent(buffer);
}