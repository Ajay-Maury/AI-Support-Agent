import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, RefreshCw, FileText, FileUp, CheckCircle2, AlertCircle } from "lucide-react";
import { getDocStatus, listDocuments, uploadDocument, extractErrorMessage, type DocumentItem } from "../lib/api";
import { toast } from "sonner";

export default function Documents() {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      setDocs(await listDocuments());
      setError(null);
    } catch (e: any) {
      const msg = extractErrorMessage(e);
      setError(msg);
      toast.error("Failed to load documents", { description: msg });
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const pending = docs.filter((d) => d.status && !/ready|done|complete/i.test(d.status));
    if (pending.length === 0) return;
    const t = setInterval(async () => {
      const updates = await Promise.all(
        pending.map((d) => getDocStatus(d.id).catch(() => null))
      );
      setDocs((prev) =>
        prev.map((d) => {
          const upd = updates.find((u) => u && u.id === d.id);
          return upd ? { ...d, ...upd } : d;
        })
      );
    }, 2000);
    return () => clearInterval(t);
  }, [docs]);

  async function onUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      await uploadDocument(file);
      toast.success("Document uploaded", { description: file.name });
      await refresh();
    } catch (e: any) {
      const msg = extractErrorMessage(e);
      setError(msg);
      toast.error("Upload failed", { description: msg });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Knowledge Base</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Upload <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">.md</code> or{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">.txt</code> documents for the agent to learn from.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm shadow-indigo-500/30 transition hover:brightness-110">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {uploading ? "Uploading…" : "Upload"}
            <input
              ref={fileRef}
              type="file"
              accept=".md,.txt,text/markdown,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="flex-1 overflow-auto rounded-2xl border border-slate-200/70 bg-white/80 shadow-sm backdrop-blur">
        {docs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
              <FileUp size={24} />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No documents yet</h3>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              Upload your first markdown or text file to start grounding the agent's responses.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur">
              <tr>
                <th className="px-5 py-3">File</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">ID</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr
                  key={d.id}
                  className="border-t border-slate-100 transition hover:bg-slate-50/60"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <FileText size={14} />
                      </div>
                      <span className="font-medium text-slate-800">{d.filename}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-5 py-3 font-mono text-[11px] text-slate-400">{d.doc_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const ready = /ready|done|complete/i.test(status);
  const failed = /fail|error/i.test(status);
  const cls = ready
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : failed
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {ready ? (
        <CheckCircle2 size={11} />
      ) : failed ? (
        <AlertCircle size={11} />
      ) : (
        <Loader2 size={11} className="animate-spin" />
      )}
      {status || "unknown"}
    </span>
  );
}