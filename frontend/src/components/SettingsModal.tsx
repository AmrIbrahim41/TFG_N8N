"use client";
import { useState, useEffect } from "react";
import { n8n } from "@/lib/n8nClient";

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const [evoUrl, setEvoUrl] = useState("");
  const [evoInstance, setEvoInstance] = useState("");
  const [evoApiKey, setEvoApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    n8n.getSettings()
      .then((cfg) => {
        setEvoUrl(cfg.evoUrl || "");
        setEvoInstance(cfg.evoInstance || "");
        setEvoApiKey(cfg.evoApiKey || "");
      })
      .catch(() => setMessage({ text: "فشل تحميل الإعدادات", ok: false }))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!evoUrl.trim() || !evoInstance.trim() || !evoApiKey.trim()) {
      setMessage({ text: "جميع الحقول مطلوبة", ok: false });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await n8n.saveSettings({
        evoUrl: evoUrl.trim(),
        evoInstance: evoInstance.trim(),
        evoApiKey: evoApiKey.trim(),
      });
      setMessage({ text: "تم حفظ الإعدادات بنجاح", ok: true });
      setTimeout(onClose, 1200);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "فشل الحفظ", ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background: "#fff", direction: "rtl" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 rounded-t-2xl"
          style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">⚙️</span>
            <div>
              <h2 className="text-white font-bold text-base">إعدادات Evolution API</h2>
              <p className="text-emerald-100 text-xs">تعديل بيانات الاتصال بـ WhatsApp Gateway</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-white hover:bg-white/20 transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="text-center text-gray-400 py-8">جاري تحميل الإعدادات...</div>
          ) : (
            <>
              {/* URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  رابط السيرفر (URL)
                </label>
                <input
                  type="text"
                  value={evoUrl}
                  onChange={(e) => setEvoUrl(e.target.value)}
                  placeholder="http://72.62.190.12:8080"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 text-left"
                  style={{ direction: "ltr", fontFamily: "monospace" }}
                />
                <p className="text-xs text-gray-400 mt-1">مثال: http://IP:8080 أو https://evo.yourdomain.com</p>
              </div>

              {/* Instance */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  اسم الـ Instance
                </label>
                <input
                  type="text"
                  value={evoInstance}
                  onChange={(e) => setEvoInstance(e.target.value)}
                  placeholder="TFG"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 text-left"
                  style={{ direction: "ltr", fontFamily: "monospace" }}
                />
                <p className="text-xs text-gray-400 mt-1">الاسم اللي اتعمل بيه الـ instance في Evolution Manager</p>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Global API Key
                </label>
                <input
                  type="password"
                  value={evoApiKey}
                  onChange={(e) => setEvoApiKey(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 text-left"
                  style={{ direction: "ltr", fontFamily: "monospace" }}
                />
                <p className="text-xs text-gray-400 mt-1">Global API Key من إعدادات Evolution API</p>
              </div>

              {/* Message */}
              {message && (
                <div
                  className="text-sm rounded-xl px-4 py-3 text-center"
                  style={{
                    background: message.ok ? "#d1fae5" : "#fee2e2",
                    color: message.ok ? "#065f46" : "#991b1b",
                  }}
                >
                  {message.ok ? "✓ " : "✗ "}{message.text}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="px-5 pb-5 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}
            >
              {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              إلغاء
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
