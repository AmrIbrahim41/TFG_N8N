"use client";
import { n8n, type CampaignStatus } from "@/lib/n8nClient";
import { useState } from "react";

interface Props { status: CampaignStatus | null; onRefresh: () => void; }

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  running:   { label: "يعمل الآن",       color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  paused:    { label: "متوقف مؤقتاً",    color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",     dot: "bg-amber-400"   },
  completed: { label: "اكتمل ✓",          color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",       dot: "bg-blue-500"    },
  stopped:   { label: "مُوقف",           color: "text-gray-600",    bg: "bg-gray-100 border-gray-200",      dot: "bg-gray-400"    },
};

export default function ProgressDashboard({ status, onRefresh }: Props) {
  const [controlling, setControlling] = useState(false);
  const [exporting,   setExporting]   = useState(false);

  if (!status || status.status === "idle") return null;

  const {
    status: st, total, sentCount, failedCount,
    percentComplete, estimatedMinutesRemaining, currentIndex, completedAt
  } = status;

  const cfg = STATUS_CONFIG[st] || STATUS_CONFIG.stopped;
  const pendingCount = total - sentCount - failedCount;
  const estHours = (estimatedMinutesRemaining / 60).toFixed(1);

  async function handleControl(action: "pause" | "resume" | "stop") {
    setControlling(true);
    try { await n8n.control(action); setTimeout(onRefresh, 1000); }
    finally { setControlling(false); }
  }
  async function handleExport() {
    setExporting(true);
    try { await n8n.exportFailed(); } finally { setExporting(false); }
  }

  return (
    <div className="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden fade-in card-hover">

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">📊 لوحة التحكم</h2>
        <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
          <span className={`w-2 h-2 rounded-full ${cfg.dot} ${st === "running" ? "animate-pulse" : ""}`} />
          {cfg.label}
        </span>
      </div>

      <div className="px-5 pb-5 space-y-5">

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard value={total}      label="الإجمالي" color="blue"    icon="📋" />
          <StatCard value={sentCount}  label="مُرسل"    color="emerald" icon="✅" />
          <StatCard value={failedCount} label="فاشل"   color="red"     icon="❌" />
        </div>

        {/* Mini stats */}
        <div className="flex justify-between text-xs text-gray-500 bg-gray-50 rounded-2xl px-4 py-2.5">
          <span>⏳ انتظار: <strong className="text-gray-700">{pendingCount}</strong></span>
          <span>📍 الحالي: <strong className="text-gray-700">{currentIndex}</strong> من <strong>{total}</strong></span>
          {completedAt && (
            <span>🏁 اكتمل: <strong className="text-gray-700">{new Date(completedAt).toLocaleTimeString("ar-EG")}</strong></span>
          )}
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-700">التقدم</span>
            <span className="text-sm font-bold text-emerald-600">{percentComplete}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden shadow-inner">
            <div
              className="h-4 rounded-full progress-shimmer transition-all duration-700 relative"
              style={{ width: `${Math.max(percentComplete, 2)}%` }}>
              <div className="absolute inset-0 rounded-full opacity-30"
                style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)" }} />
            </div>
          </div>
          {st === "running" && estimatedMinutesRemaining > 0 && (
            <p className="text-xs text-gray-400 mt-2 text-left">
              ⏱ الوقت المتبقي تقريباً:{" "}
              <span className="font-semibold text-gray-600">
                {estimatedMinutesRemaining >= 60
                  ? `${estHours} ساعة`
                  : `${estimatedMinutesRemaining} دقيقة`}
              </span>
            </p>
          )}
        </div>

        {/* Control buttons */}
        <div className="flex gap-2 flex-wrap pt-1">
          {st === "running" && (
            <CtrlBtn onClick={() => handleControl("pause")} disabled={controlling}
              color="amber" label="⏸ إيقاف مؤقت" />
          )}
          {st === "paused" && (
            <CtrlBtn onClick={() => handleControl("resume")} disabled={controlling}
              color="emerald" label="▶ استئناف" />
          )}
          {(st === "running" || st === "paused") && (
            <CtrlBtn onClick={() => handleControl("stop")} disabled={controlling}
              color="red" label="⏹ إيقاف نهائي" />
          )}
          {(st === "completed" || st === "stopped") && (failedCount + pendingCount) > 0 && (
            <CtrlBtn onClick={handleExport} disabled={exporting}
              color="indigo" label={exporting ? "⏳ جاري التصدير..." : `⬇ تحميل غير المُرسل (${(failedCount + pendingCount).toLocaleString()})`} />
          )}
          <button onClick={onRefresh}
            className="px-4 py-2 rounded-xl text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors">
            🔄 تحديث
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── helpers ── */
function StatCard({ value, label, color, icon }: {
  value: number; label: string; color: string; icon: string;
}) {
  const colors: Record<string, string> = {
    blue:    "from-blue-50 to-blue-100 border-blue-200 text-blue-700",
    emerald: "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700",
    red:     "from-red-50 to-red-100 border-red-200 text-red-600",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-b p-3 text-center ${colors[color]}`}>
      <div className="text-xl mb-0.5">{icon}</div>
      <div className="text-2xl font-extrabold">{value.toLocaleString()}</div>
      <div className="text-xs font-medium opacity-80 mt-0.5">{label}</div>
    </div>
  );
}

function CtrlBtn({ onClick, disabled, color, label }: {
  onClick: () => void; disabled: boolean; color: string; label: string;
}) {
  const colors: Record<string, string> = {
    amber:   "from-amber-400 to-amber-500",
    emerald: "from-emerald-500 to-teal-500",
    red:     "from-red-500 to-rose-500",
    indigo:  "from-indigo-500 to-violet-500",
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md active:scale-95 ${colors[color]}`}>
      {label}
    </button>
  );
}
