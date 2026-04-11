"use client";
import { useState } from "react";
import ConnectionPanel from "@/components/ConnectionPanel";
import CampaignForm from "@/components/CampaignForm";
import ProgressDashboard from "@/components/ProgressDashboard";
import ContactTable from "@/components/ContactTable";
import SettingsModal from "@/components/SettingsModal";
import { useCampaignStatus } from "@/hooks/useCampaignStatus";

export default function Home() {
  const { status, refresh } = useCampaignStatus();
  const [showSettings, setShowSettings] = useState(false);
  const isActiveCampaign = status?.status === "running" || status?.status === "paused";
  const hasCampaign = status && status.status !== "idle";

  return (
    <div className="min-h-screen" style={{ background: "#EEF2F7" }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 shadow-lg"
        style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}>
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
              style={{ background: "rgba(255,255,255,0.18)" }}>
              💬
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight tracking-tight">
                TFG WhatsApp Sender
              </h1>
              <p className="text-emerald-100 text-xs">نظام الإرسال بالجملة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status && status.status !== "idle" && (
              <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-1.5">
                <div className={`w-2 h-2 rounded-full ${
                  status.status === "running" ? "bg-white animate-pulse" :
                  status.status === "paused"  ? "bg-yellow-300" : "bg-white/50"
                }`} />
                <span className="text-white text-xs font-medium">
                  {status.status === "running" ? "جاري الإرسال" :
                   status.status === "paused"  ? "متوقف مؤقتاً" : "مكتمل"}
                </span>
              </div>
            )}
            <button
              onClick={() => setShowSettings(true)}
              title="إعدادات Evolution API"
              className="w-9 h-9 flex items-center justify-center rounded-xl text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4 fade-in">
        <ConnectionPanel />
        {hasCampaign && <ProgressDashboard status={status} onRefresh={refresh} />}
        {!isActiveCampaign && (
          <CampaignForm disabled={false} onStarted={() => setTimeout(refresh, 1500)} />
        )}
        <ContactTable status={status} />
      </main>

      {/* ── Footer ── */}
      <footer className="text-center py-6 text-xs text-gray-400">
        TFG WhatsApp Sender © 2026
      </footer>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
