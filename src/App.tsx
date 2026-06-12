import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { MessageSquare, FileText, Sparkles } from "lucide-react";
import { API_BASE, checkHealth } from "./lib/api";

export default function App() {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    const ping = () => checkHealth().then((ok) => active && setHealthy(ok));
    ping();
    const t = setInterval(ping, 15000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);
  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/30">
              <Sparkles size={18} strokeWidth={2.25} />
            </div>
            <div className="leading-tight">
              <h1 className="text-[15px] font-semibold tracking-tight">AI Powered Support Agent</h1>
              <p className="text-[11px] text-slate-500">Ask your knowledge base</p>
            </div>
            <span
              title={`${API_BASE}`}
              className={`ml-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                healthy
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : healthy === false
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              <span className="relative flex h-1.5 w-1.5">
                {healthy && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                    healthy ? "bg-emerald-500" : healthy === false ? "bg-red-500" : "bg-slate-400"
                  }`}
                />
              </span>
              {healthy ? "Online" : healthy === false ? "Offline" : "Checking"}
            </span>
          </div>
          <nav className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 text-sm shadow-sm">
            <NavTab to="/chat" icon={<MessageSquare size={15} />} label="Chat" />
            <NavTab to="/documents" icon={<FileText size={15} />} label="Documents" />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 overflow-hidden p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}

function NavTab({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition ${
          isActive
            ? "bg-slate-900 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100"
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}