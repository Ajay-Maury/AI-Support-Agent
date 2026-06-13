import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

export const http = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.code === "ERR_NETWORK" || err.message === "Network Error") {
      return "Cannot reach the server. Please check your connection or try again later.";
    }
    if (err.code === "ECONNABORTED") return "Request timed out. Please try again.";
    const status = err.response?.status;
    const data: any = err.response?.data;
    const apiMsg =
      (typeof data === "string" && data) ||
      data?.error ||
      data?.message ||
      data?.detail;
    if (status && status >= 500) return apiMsg || `Server error (${status}). Please try again.`;
    if (status === 404) return apiMsg || "Not found.";
    if (status === 401 || status === 403) return apiMsg || "You are not authorized.";
    if (status) return apiMsg || `Request failed (${status}).`;
    return err.message || "Request failed.";
  }
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return "Cannot reach the server. Please check your connection or try again later.";
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

export type Source = { filename: string; chunk_index: number; score: number };
export type ChatResponse = { answer: string; sources: Source[]; session_id: string };
export type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  created_at?: string;
};
export type SessionSummary = { session_id: string; title?: string; updated_at?: string };
export type DocumentItem = {
  id: string;
  filename: string;
  status: string;
  created_at?: string;
};

export async function askChat(question: string, session_id?: string): Promise<ChatResponse> {
  const { data } = await http.post<ChatResponse>("/api/chat", { question, session_id });
  return data;
}

export async function listSessions(): Promise<SessionSummary[]> {
  const { data } = await http.get("/api/chat");
  return Array.isArray(data) ? data : data.sessions ?? [];
}

export async function loadSession(id: string): Promise<{ messages: Message[]; session_id: string }> {
  const { data } = await http.get(`/api/chat/${id}`);
  const messages: Message[] = (data.messages || data.history || []).map((m: any) => ({
    role: m.role,
    content: m.content ?? m.answer ?? m.question ?? "",
    sources: m.sources,
    created_at: m.created_at ?? m.timestamp ?? m.createdAt,
  }));
  return { messages, session_id: data.session_id || id };
}

export async function listDocuments(): Promise<DocumentItem[]> {
  const { data } = await http.get("/api/docs");
  return Array.isArray(data) ? data : data.documents ?? [];
}

export async function uploadDocument(file: File): Promise<DocumentItem> {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await http.post<DocumentItem>("/api/docs/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getDocStatus(id: string): Promise<DocumentItem> {
  const { data } = await http.get<DocumentItem>(`/api/docs/${id}/status`);
  return data;
}

export async function checkHealth(): Promise<boolean> {
  try {
    await http.get("/health");
    return true;
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