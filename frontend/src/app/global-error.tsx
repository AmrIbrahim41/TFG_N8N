"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html>
      <body style={{ background: "#EEF2F7", margin: 0, fontFamily: "sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 24, padding: 32, maxWidth: 360, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ margin: "0 0 8px", color: "#1f2937" }}>حدث خطأ</h2>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>جرّب تحديث الصفحة</p>
            <button onClick={reset}
              style={{ width: "100%", padding: "12px", borderRadius: 16, border: "none",
                background: "linear-gradient(135deg,#059669,#0d9488)", color: "white",
                fontWeight: "bold", fontSize: 14, cursor: "pointer" }}>
              🔄 إعادة المحاولة
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
