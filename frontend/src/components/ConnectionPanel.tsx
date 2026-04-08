"use client";
import { useState } from "react";
import { n8n } from "@/lib/n8nClient";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";

export default function ConnectionPanel() {
  const { status, loading, error, refresh } = useWhatsAppStatus();
  const [qrData, setQrData]     = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError]   = useState<string | null>(null);

  async function handleGetQR() {
    setQrLoading(true); setQrError(null);
    try {
      const data = await n8n.getQRCode();
      setQrData(data.base64 || null);
      setTimeout(refresh, 20_000);
    } catch (e) {
      setQrError(e instanceof Error ? e.message : "فشل توليد QR");
    } finally { setQrLoading(false); }
  }

  const isConnected = status?.connected === true;

  return (
    <div className="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden card-hover">

      {/* Top stripe */}
      <div className="h-1.5 w-full"
        style={{ background: isConnected
          ? "linear-gradient(90deg,#10b981,#14b8a6)"
          : "linear-gradient(90deg,#f87171,#fb923c)" }} />

      <div className="p-5">
        {loading ? (
          <div className="flex items-center gap-3 py-2">
            <div className="w-5 h-5 rounded-full bg-gray-200 animate-pulse" />
            <span className="text-sm text-gray-400">جاري التحقق من الاتصال...</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">

            {/* Status info */}
            <div className="flex items-center gap-4">
              {/* Glow dot */}
              <div className="relative shrink-0">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
                  isConnected ? "bg-emerald-50" : "bg-red-50"}`}>
                  {isConnected ? "📱" : "📵"}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${
                  isConnected ? "bg-emerald-500 glow-green" : "bg-red-400"}`} />
              </div>

              <div>
                <p className={`font-bold text-base ${isConnected ? "text-emerald-700" : "text-red-600"}`}>
                  {isConnected ? "متصل بواتساب" : "غير متصل"}
                </p>
                {isConnected && status?.name && (
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{status.name}</p>
                )}
                {isConnected && status?.phoneNumber && (
                  <p className="text-xs text-gray-400 font-mono">+{status.phoneNumber}</p>
                )}
                {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
              </div>
            </div>

            {/* Action button */}
            {!isConnected ? (
              <button onClick={handleGetQR} disabled={qrLoading}
                className="shrink-0 px-4 py-2.5 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#059669,#0d9488)" }}>
                {qrLoading ? "⏳ جاري..." : "🔗 ربط الآن"}
              </button>
            ) : (
              <button onClick={refresh}
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors">
                🔄 تحديث
              </button>
            )}
          </div>
        )}

        {qrError && (
          <div className="mt-3 p-3 bg-red-50 rounded-xl text-sm text-red-600">{qrError}</div>
        )}

        {/* QR Section */}
        {qrData && !isConnected && (
          <div className="mt-4 p-5 rounded-2xl text-center"
            style={{ background: "linear-gradient(135deg,#f0fdf4,#f0fdfa)" }}>
            <p className="text-sm font-semibold text-gray-700 mb-1">امسح الكود بواتساب</p>
            <p className="text-xs text-gray-400 mb-4">
              واتساب ← النقاط الثلاث ← الأجهزة المرتبطة ← ربط جهاز
            </p>
            <div className="inline-block p-3 bg-white rounded-2xl shadow-md">
              <img src={qrData} alt="QR Code" className="w-52 h-52 rounded-xl" />
            </div>
            <br />
            <button onClick={handleGetQR}
              className="mt-3 text-xs text-emerald-600 hover:text-emerald-700 font-medium underline-offset-2 hover:underline">
              🔄 توليد كود جديد
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
