"use client";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#EEF2F7" }}>
      <div className="bg-white rounded-3xl shadow-md p-8 max-w-sm w-full mx-4 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">حدث خطأ</h2>
        <p className="text-sm text-gray-500 mb-6">جرّب تحديث الصفحة</p>
        <button
          onClick={reset}
          className="w-full py-3 rounded-2xl text-white font-bold text-sm"
          style={{ background: "linear-gradient(135deg,#059669,#0d9488)" }}
        >
          🔄 إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
