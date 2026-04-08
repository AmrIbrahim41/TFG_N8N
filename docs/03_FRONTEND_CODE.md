# أكواد الـ Frontend الكاملة — أحدث إصدار

> آخر تحديث: 2026-04-06 | Next.js 16.2.2 + Tailwind v4 + react-window v2

---

## package.json

```json
{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@types/react-window": "^1.8.8",
    "next": "16.2.2",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "react-window": "^2.2.7",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.2",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

---

## next.config.ts

```typescript
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
```

---

## src/app/globals.css

```css
@import "tailwindcss";

body {
  direction: rtl;
}

input[type="range"] {
  cursor: pointer;
}
```

---

## src/app/layout.tsx

```typescript
import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TFG WhatsApp Sender",
  description: "إرسال رسائل واتساب بالجملة",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.className}>
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
```

---

## src/app/page.tsx

```typescript
"use client";
import ConnectionPanel from "@/components/ConnectionPanel";
import CampaignForm from "@/components/CampaignForm";
import ProgressDashboard from "@/components/ProgressDashboard";
import ContactTable from "@/components/ContactTable";
import { useCampaignStatus } from "@/hooks/useCampaignStatus";

export default function Home() {
  const { status, refresh } = useCampaignStatus();

  const isActiveCampaign =
    status?.status === "running" || status?.status === "paused";

  const hasCampaign = status && status.status !== "idle";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center text-white text-lg">
            📱
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">
              TFG WhatsApp Sender
            </h1>
            <p className="text-xs text-gray-400">إرسال رسائل بالجملة</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <ConnectionPanel />

        {hasCampaign && (
          <ProgressDashboard status={status} onRefresh={refresh} />
        )}

        {!isActiveCampaign && (
          <CampaignForm
            disabled={false}
            onStarted={() => setTimeout(refresh, 1500)}
          />
        )}

        <ContactTable status={status} />
      </main>
    </div>
  );
}
```

---

## src/lib/n8nClient.ts

```typescript
const N8N_BASE = "https://n8n.srv1532138.hstgr.cloud/webhook";

export interface WhatsAppStatus {
  connected: boolean;
  state: string;
  phoneNumber: string | null;
  name: string;
  instanceName: string;
}

export interface CampaignStatus {
  campaignId: string | null;
  status: "idle" | "running" | "paused" | "completed" | "stopped";
  total: number;
  currentIndex: number;
  sentCount: number;
  failedCount: number;
  percentComplete: number;
  estimatedMinutesRemaining: number;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  lastUpdated: string | null;
  contacts: ContactStatus[];
}

export interface ContactStatus {
  phone: string;
  name: string;
  status: "pending" | "sent" | "failed";
  sentAt: string | null;
  failedReason: string | null;
}

export interface Contact {
  phone: string;
  name?: string;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${N8N_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

export const n8n = {
  getWhatsAppStatus: () =>
    apiFetch<WhatsAppStatus>("/whatsapp-status"),

  getQRCode: () =>
    apiFetch<{ base64?: string; code?: string }>("/whatsapp-qr", {
      method: "POST",
      body: JSON.stringify({}),
    }),

  startCampaign: (payload: {
    contacts: Contact[];
    message: string;
    greetingMessage?: string;
    imageBase64?: string | null;
    delayMin: number;
    delayMax: number;
  }) =>
    apiFetch<{
      campaignId: string;
      total: number;
      totalInvalid: number;
      success: boolean;
      estimatedHours: number;
    }>("/campaign-start", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getCampaignStatus: () =>
    apiFetch<CampaignStatus>("/campaign-status"),

  control: (action: "pause" | "resume" | "stop") =>
    apiFetch<{ success: boolean; status: string }>("/campaign-control", {
      method: "POST",
      body: JSON.stringify({ action }),
    }),

  exportFailed: async (): Promise<void> => {
    const res = await fetch(`${N8N_BASE}/campaign-export-failed`);
    const data = await res.json();
    const csv: string = data.csv || "";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `failed_contacts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
```

---

## src/lib/excelParser.ts

```typescript
import * as XLSX from "xlsx";
import type { Contact } from "./n8nClient";

const PHONE_COLS = ["موبايل", "mobile", "phone", "هاتف", "رقم", "رقم الهاتف"];
const NAME_COLS = ["اسم", "العضو", "الاسم", "name", "الاسم الكامل"];

function findCol(headers: string[], candidates: string[]): string | null {
  for (const c of candidates) {
    const found = headers.find(
      (h) => h.trim().toLowerCase() === c.toLowerCase()
    );
    if (found) return found;
  }
  return null;
}

export function parseExcel(file: File): Promise<Contact[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
          defval: "",
        });
        if (!rows.length) return resolve([]);

        const headers = Object.keys(rows[0]);
        const phoneCol = findCol(headers, PHONE_COLS);
        const nameCol = findCol(headers, NAME_COLS);

        if (!phoneCol) {
          return reject(
            new Error(
              `لم يُعثر على عمود رقم الهاتف. الأعمدة المتاحة: ${headers.join(", ")}`
            )
          );
        }

        const contacts: Contact[] = rows
          .map((row) => ({
            phone: String(row[phoneCol] ?? "").trim(),
            name: nameCol ? String(row[nameCol] ?? "").trim() : "",
          }))
          .filter((c) => c.phone);

        resolve(contacts);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("فشل قراءة الملف"));
    reader.readAsArrayBuffer(file);
  });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      // Return raw base64 only (no data URL prefix)
      // Evolution API v2 requires plain base64 for mediaMessage.media
      const result = e.target!.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = () => reject(new Error("فشل تحويل الصورة"));
    reader.readAsDataURL(file);
  });
}
```

---

## src/hooks/useWhatsAppStatus.ts

```typescript
"use client";
import { useState, useEffect, useCallback } from "react";
import { n8n, type WhatsAppStatus } from "@/lib/n8nClient";

export function useWhatsAppStatus() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await n8n.getWhatsAppStatus();
      setStatus(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { status, loading, error, refresh };
}
```

---

## src/hooks/useCampaignStatus.ts

```typescript
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { n8n, type CampaignStatus } from "@/lib/n8nClient";

export function useCampaignStatus() {
  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await n8n.getCampaignStatus();
      setStatus(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ في جلب الحالة");
    }
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(() => { refresh(); }, 5_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  return { status, error, refresh };
}
```

---

## src/components/ConnectionPanel.tsx

```typescript
"use client";
import { useState } from "react";
import { n8n } from "@/lib/n8nClient";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";

export default function ConnectionPanel() {
  const { status, loading, error, refresh } = useWhatsAppStatus();
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  async function handleGetQR() {
    setQrLoading(true);
    setQrError(null);
    try {
      const data = await n8n.getQRCode();
      setQrData(data.base64 || null);
      setTimeout(refresh, 20_000);
    } catch (e) {
      setQrError(e instanceof Error ? e.message : "فشل توليد QR");
    } finally {
      setQrLoading(false);
    }
  }

  const isConnected = status?.connected === true;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-lg font-bold text-gray-800 mb-4">حالة واتساب</h2>

      {loading && (
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-3 h-3 rounded-full bg-gray-300 animate-pulse" />
          <span className="text-sm">جاري التحقق...</span>
        </div>
      )}

      {!loading && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full shrink-0 ${
                isConnected
                  ? "bg-green-500 shadow-[0_0_8px_#22c55e]"
                  : "bg-red-400"
              }`}
            />
            <div>
              <p className={`font-semibold ${isConnected ? "text-green-700" : "text-red-600"}`}>
                {isConnected ? "متصل" : "غير متصل"}
              </p>
              {/* اسم الأكونت — يظهر بعد الربط */}
              {isConnected && status?.name && (
                <p className="text-sm text-gray-700 font-medium">{status.name}</p>
              )}
              {isConnected && status?.phoneNumber && (
                <p className="text-xs text-gray-400">+{status.phoneNumber}</p>
              )}
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          </div>

          {!isConnected && (
            <button
              onClick={handleGetQR}
              disabled={qrLoading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {qrLoading ? "جاري التوليد..." : "ربط واتساب"}
            </button>
          )}

          {isConnected && (
            <button
              onClick={refresh}
              className="text-gray-400 hover:text-gray-600 text-sm px-3 py-1 rounded-lg border border-gray-200 transition-colors"
            >
              تحديث
            </button>
          )}
        </div>
      )}

      {qrError && <p className="mt-3 text-sm text-red-500">{qrError}</p>}

      {qrData && !isConnected && (
        <div className="mt-4 flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-600 font-medium">
            افتح واتساب ← الأجهزة المرتبطة ← ربط جهاز، ثم امسح الكود
          </p>
          <img src={qrData} alt="QR Code" className="w-52 h-52 rounded-lg border-4 border-white shadow" />
          <button onClick={handleGetQR} className="text-xs text-blue-500 hover:underline">
            توليد كود جديد
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## src/components/CampaignForm.tsx

```typescript
"use client";
import { useState, useRef, useMemo } from "react";
import { parseExcel, fileToBase64 } from "@/lib/excelParser";
import { n8n, type Contact } from "@/lib/n8nClient";

interface Props {
  onStarted: () => void;
  disabled: boolean;
}

function normalizePhone(raw: string): string | null {
  let d = raw.trim().replace(/\D/g, "");
  if (d.startsWith("002") && d.length === 14) d = d.substring(1);
  if (d.startsWith("020") && d.length === 13) d = d.substring(1);
  if (d.startsWith("01") && d.length === 11) d = "2" + d;
  if (/^20[0-9]{10}$/.test(d)) return d;
  return null;
}

type SelectionMode = "count" | "range";
type NumOrEmpty = number | "";

export default function CampaignForm({ onStarted, disabled }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [greetingMessage, setGreetingMessage] = useState("");
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [delayMin, setDelayMin] = useState(15);
  const [delayMax, setDelayMax] = useState(45);

  // Selection: count (first N) or range (from X to Y)
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("count");
  const [countLimit, setCountLimit] = useState<NumOrEmpty>("");
  const [fromContact, setFromContact] = useState<NumOrEmpty>(1);
  const [toContact, setToContact] = useState<NumOrEmpty>("");

  const [fileError, setFileError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const validContacts = useMemo(
    () => contacts.filter((c) => normalizePhone(c.phone) !== null),
    [contacts]
  );

  const selectedContacts = useMemo(() => {
    if (!validContacts.length) return [];
    if (selectionMode === "count") {
      const n = typeof countLimit === "number"
        ? Math.min(countLimit, validContacts.length)
        : validContacts.length;
      return validContacts.slice(0, Math.max(1, n));
    } else {
      const from = typeof fromContact === "number" ? Math.max(1, fromContact) : 1;
      const to = typeof toContact === "number"
        ? Math.min(toContact, validContacts.length)
        : validContacts.length;
      if (from > to) return [];
      return validContacts.slice(from - 1, to);
    }
  }, [selectionMode, countLimit, fromContact, toContact, validContacts]);

  const avgDelay = (delayMin + delayMax) / 2;
  const estHours = ((selectedContacts.length * avgDelay) / 3600).toFixed(1);
  const preview10 = validContacts.slice(0, 10);
  const sampleName = validContacts[0]?.name?.trim() || "اسم العميل";
  const greetingLine = greetingMessage.trim()
    ? `${greetingMessage.trim()} ${sampleName}` : null;
  const fullPreview = greetingLine ? `${greetingLine}\n${message}` : message;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setContacts([]);
    try {
      const parsed = await parseExcel(file);
      setContacts(parsed);
      setCountLimit("");
      setFromContact(1);
      setToContact("");
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "خطأ في قراءة الملف");
    }
  }

  async function handleStart() {
    if (!selectedContacts.length) {
      setStartError("لا توجد جهات اتصال في النطاق المحدد");
      return;
    }
    if (!message.trim()) {
      setStartError("الرجاء كتابة نص الرسالة");
      return;
    }
    if (delayMin > delayMax) {
      setStartError("الحد الأدنى للتأخير يجب أن يكون أقل من أو يساوي الحد الأقصى");
      return;
    }
    setStarting(true);
    setStartError(null);
    try {
      const imageBase64 = imageFile ? await fileToBase64(imageFile) : null;
      await n8n.startCampaign({
        contacts: selectedContacts,
        message: message.trim(),
        greetingMessage: greetingMessage.trim() || undefined,
        imageBase64,
        delayMin,
        delayMax,
      });
      onStarted();
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "فشل بدء الحملة");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
      <h2 className="text-lg font-bold text-gray-800">إعداد الحملة</h2>

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">ملف جهات الاتصال (Excel)</label>
        <div
          className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <div className="text-3xl mb-2">📂</div>
          <p className="text-sm text-gray-500">
            {contacts.length > 0 ? `✓ ${contacts.length} جهة اتصال محملة` : "انقر لرفع ملف .xlsx أو .xls"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            يجب أن يحتوي الملف على عمود باسم: <span className="font-mono">موبايل</span>
          </p>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
        {fileError && <p className="mt-2 text-sm text-red-500">{fileError}</p>}
      </div>

      {/* Preview stats */}
      {contacts.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-gray-600">الإجمالي: <strong className="text-blue-700">{contacts.length}</strong></span>
            <span className="text-gray-600">صالح: <strong className="text-green-700">{validContacts.length}</strong></span>
            <span className="text-gray-600">سيُرسل: <strong className="text-blue-700">{selectedContacts.length}</strong></span>
            <span className="text-gray-600">الوقت التقديري: <strong className="text-orange-600">~{estHours} ساعة</strong></span>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">أول 10 أرقام:</p>
            <div className="flex flex-wrap gap-1">
              {preview10.map((c, i) => (
                <span key={i} className="bg-white border border-gray-200 rounded px-2 py-0.5 text-xs font-mono text-gray-700">
                  {c.phone}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selection Mode */}
      {contacts.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">نطاق الإرسال</label>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-3 text-sm">
            <button
              onClick={() => setSelectionMode("count")}
              className={`flex-1 py-2 font-medium transition-colors ${selectionMode === "count" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >أول N عميل</button>
            <button
              onClick={() => setSelectionMode("range")}
              className={`flex-1 py-2 font-medium transition-colors border-r border-gray-200 ${selectionMode === "range" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >من رقم ... إلى رقم ...</button>
          </div>

          {selectionMode === "count" && (
            <div className="flex items-center gap-3">
              <input
                type="number" min={1} max={validContacts.length}
                value={countLimit === "" ? "" : countLimit}
                placeholder={String(validContacts.length)}
                onChange={(e) => setCountLimit(e.target.value === "" ? "" : parseInt(e.target.value) || 1)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <span className="text-sm text-gray-500">من أصل {validContacts.length}</span>
              <button onClick={() => setCountLimit(validContacts.length)} className="text-xs text-blue-500 hover:underline">الكل</button>
            </div>
          )}

          {selectionMode === "range" && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">من</span>
                <input
                  type="number" min={1} max={validContacts.length}
                  value={fromContact === "" ? "" : fromContact} placeholder="1"
                  onChange={(e) => setFromContact(e.target.value === "" ? "" : parseInt(e.target.value) || 1)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">إلى</span>
                <input
                  type="number" min={1} max={validContacts.length}
                  value={toContact === "" ? "" : toContact} placeholder={String(validContacts.length)}
                  onChange={(e) => setToContact(e.target.value === "" ? "" : parseInt(e.target.value) || 1)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <button onClick={() => { setFromContact(1); setToContact(validContacts.length); }} className="text-xs text-blue-500 hover:underline">الكل</button>
              <span className="text-xs text-gray-400">({selectedContacts.length} عميل)</span>
            </div>
          )}
        </div>
      )}

      {/* Greeting Message */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          رسالة الترحيب <span className="text-gray-400 font-normal text-xs">(اختياري)</span>
        </label>
        <input
          type="text" value={greetingMessage}
          onChange={(e) => setGreetingMessage(e.target.value)}
          placeholder="مثال: أهلاً  أو  مرحباً"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <p className="text-xs text-gray-400 mt-1">
          سيُضاف اسم العميل بعد كلمة الترحيب — مثال:{" "}
          <span className="text-gray-600 font-medium">{greetingMessage.trim() || "مرحباً"} {sampleName}</span>
        </p>
      </div>

      {/* Message */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">نص الرسالة الأساسية</label>
        <textarea
          rows={4} value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="اكتب نص رسالتك هنا..."
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <p className="text-xs text-gray-400 mt-1">{message.length} حرف</p>
      </div>

      {/* Message Preview */}
      {(greetingMessage.trim() || message.trim()) && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-medium text-green-700 mb-2">معاينة الرسالة النهائية:</p>
          <div className="bg-white rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap border border-green-100 leading-relaxed">
            {fullPreview || <span className="text-gray-400 italic">اكتب الرسالة لترى المعاينة</span>}
          </div>
          {greetingMessage.trim() && (
            <p className="text-xs text-green-600 mt-2">* &quot;{sampleName}&quot; سيُستبدل باسم كل عميل تلقائياً</p>
          )}
        </div>
      )}

      {/* Image upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          صورة <span className="text-gray-400 font-normal text-xs">(اختياري)</span>
        </label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => imgRef.current?.click()}
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            {imageFile ? "✓ " + imageFile.name : "اختر صورة"}
          </button>
          {imageFile && (
            <button type="button" onClick={() => { setImageFile(null); if (imgRef.current) imgRef.current.value = ""; }}
              className="text-red-400 hover:text-red-600 text-sm">حذف</button>
          )}
        </div>
        <input ref={imgRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
      </div>

      {/* Random Delay */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">التأخير العشوائي بين الرسائل</label>
        <div className="space-y-4 bg-gray-50 rounded-xl p-4">
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>الحد الأدنى</span>
              <span className="font-bold text-blue-600">{delayMin} ث</span>
            </div>
            <input type="range" min={10} max={120} step={5} value={delayMin}
              onChange={(e) => { const v = parseInt(e.target.value); setDelayMin(v); if (v > delayMax) setDelayMax(v); }}
              className="w-full accent-blue-600" />
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>الحد الأقصى</span>
              <span className="font-bold text-blue-600">{delayMax} ث</span>
            </div>
            <input type="range" min={10} max={180} step={5} value={delayMax}
              onChange={(e) => { const v = parseInt(e.target.value); setDelayMax(v); if (v < delayMin) setDelayMin(v); }}
              className="w-full accent-blue-600" />
          </div>
          <p className="text-xs text-gray-500 text-center">
            تأخير عشوائي بين <strong className="text-blue-600">{delayMin}</strong> و <strong className="text-blue-600">{delayMax}</strong> ثانية
          </p>
        </div>
      </div>

      {startError && <p className="text-sm text-red-500">{startError}</p>}

      <button
        onClick={handleStart}
        disabled={disabled || starting || !selectedContacts.length || !message.trim()}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors text-sm"
      >
        {starting ? "جاري البدء..." : selectedContacts.length ? `بدء الإرسال (${selectedContacts.length} عميل)` : "بدء الإرسال"}
      </button>
    </div>
  );
}
```

---

## src/components/ProgressDashboard.tsx

```typescript
"use client";
import { n8n, type CampaignStatus } from "@/lib/n8nClient";
import { useState } from "react";

interface Props {
  status: CampaignStatus | null;
  onRefresh: () => void;
}

export default function ProgressDashboard({ status, onRefresh }: Props) {
  const [controlling, setControlling] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!status || status.status === "idle") {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-3">لوحة التحكم</h2>
        <p className="text-gray-400 text-sm text-center py-8">لا توجد حملة نشطة.</p>
      </div>
    );
  }

  const { status: st, total, sentCount, failedCount, percentComplete, estimatedMinutesRemaining, currentIndex } = status;
  const estHoursLeft = (estimatedMinutesRemaining / 60).toFixed(1);

  async function handleControl(action: "pause" | "resume" | "stop") {
    setControlling(true);
    try {
      await n8n.control(action);
      setTimeout(onRefresh, 1000);
    } finally {
      setControlling(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try { await n8n.exportFailed(); } finally { setExporting(false); }
  }

  const statusLabel: Record<string, string> = {
    running: "يعمل", paused: "متوقف مؤقتاً", completed: "مكتمل", stopped: "مُوقف",
  };
  const statusColor: Record<string, string> = {
    running: "text-green-600 bg-green-50", paused: "text-yellow-700 bg-yellow-50",
    completed: "text-blue-600 bg-blue-50", stopped: "text-gray-600 bg-gray-100",
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">لوحة التحكم</h2>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColor[st] || "text-gray-600 bg-gray-100"}`}>
          {statusLabel[st] || st}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">{total}</div>
          <div className="text-xs text-gray-500 mt-0.5">الإجمالي</div>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{sentCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">مُرسل</div>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{failedCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">فاشل</div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>{currentIndex} من {total}</span>
          <span>{percentComplete}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
            style={{ width: `${percentComplete}%` }}
          />
        </div>
        {st === "running" && estimatedMinutesRemaining > 0 && (
          <p className="text-xs text-gray-400 mt-1.5 text-left">
            الوقت المتبقي: ~{estimatedMinutesRemaining >= 60 ? estHoursLeft + " ساعة" : estimatedMinutesRemaining + " دقيقة"}
          </p>
        )}
        {status.completedAt && (
          <p className="text-xs text-gray-400 mt-1.5">
            اكتمل في: {new Date(status.completedAt).toLocaleTimeString("ar-EG")}
          </p>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {st === "running" && (
          <button onClick={() => handleControl("pause")} disabled={controlling}
            className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors">
            ⏸ إيقاف مؤقت
          </button>
        )}
        {st === "paused" && (
          <button onClick={() => handleControl("resume")} disabled={controlling}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors">
            ▶ استئناف
          </button>
        )}
        {(st === "running" || st === "paused") && (
          <button onClick={() => handleControl("stop")} disabled={controlling}
            className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors">
            ⏹ إيقاف نهائي
          </button>
        )}
        {(st === "completed" || st === "stopped") && failedCount > 0 && (
          <button onClick={handleExport} disabled={exporting}
            className="flex-1 bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors">
            {exporting ? "جاري التصدير..." : "⬇ تحميل الفاشلين"}
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## src/components/ContactTable.tsx

```typescript
"use client";
import { List } from "react-window";
import type { CSSProperties } from "react";
import type { CampaignStatus, ContactStatus } from "@/lib/n8nClient";

interface RowProps { contacts: ContactStatus[]; }

function Row({ index, style, contacts }: { index: number; style: CSSProperties; contacts: ContactStatus[] }) {
  const contact = contacts[index];
  const bg = contact.status === "sent" ? "bg-green-50 border-green-100"
    : contact.status === "failed" ? "bg-red-50 border-red-100"
    : "bg-white border-gray-100";

  const badge = contact.status === "sent"
    ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap">✓ مُرسل</span>
    : contact.status === "failed"
    ? <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full whitespace-nowrap">✗ فاشل</span>
    : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full whitespace-nowrap">انتظار</span>;

  return (
    <div style={style} className={`flex items-center justify-between px-4 border-b ${bg} text-sm`}>
      <div className="flex items-center gap-3 overflow-hidden">
        <span className="text-gray-400 text-xs w-8 shrink-0">{index + 1}</span>
        <div className="overflow-hidden">
          <p className="font-mono text-gray-800 text-sm">{contact.phone}</p>
          {contact.name && <p className="text-xs text-gray-400 truncate">{contact.name}</p>}
          {contact.failedReason && <p className="text-xs text-red-400 truncate">{contact.failedReason}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {contact.sentAt && (
          <span className="text-xs text-gray-400">{new Date(contact.sentAt).toLocaleTimeString("ar-EG")}</span>
        )}
        {badge}
      </div>
    </div>
  );
}

interface Props { status: CampaignStatus | null; }

export default function ContactTable({ status }: Props) {
  if (!status || !status.contacts?.length) return null;
  const contacts = status.contacts;
  const height = Math.min(400, contacts.length * 56);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-800">جهات الاتصال ({contacts.length} معروضة)</h2>
        <div className="flex gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />مُرسل</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />فاشل</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />انتظار</span>
        </div>
      </div>
      <List<RowProps>
        rowComponent={Row} rowCount={contacts.length}
        rowHeight={56} rowProps={{ contacts }}
        defaultHeight={height} style={{ height: `${height}px` }}
      />
      {status.total > contacts.length && (
        <p className="text-xs text-center text-gray-400 py-2 border-t border-gray-100">
          يُعرض أول {contacts.length} من أصل {status.total} جهة اتصال
        </p>
      )}
    </div>
  );
}
```
