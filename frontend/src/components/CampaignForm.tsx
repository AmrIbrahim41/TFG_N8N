"use client";
import { useState, useRef, useMemo } from "react";
import { parseExcel, fileToBase64 } from "@/lib/excelParser";
import { n8n, type Contact } from "@/lib/n8nClient";

interface Props { onStarted: () => void; disabled: boolean; }
type SelectionMode = "count" | "range";
type NumOrEmpty = number | "";

function normalizePhone(raw: string): string | null {
  let d = raw.trim().replace(/\D/g, "");
  if (d.startsWith("002") && d.length === 14) d = d.substring(1);
  if (d.startsWith("020") && d.length === 13) d = d.substring(1);
  if (d.startsWith("01") && d.length === 11) d = "2" + d;
  if (/^20[0-9]{10}$/.test(d)) return d;
  return null;
}

export default function CampaignForm({ onStarted, disabled }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [greetingMessage, setGreetingMessage] = useState("");
  const [message, setMessage]   = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [delayMin, setDelayMin] = useState(15);
  const [delayMax, setDelayMax] = useState(45);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("count");
  const [countLimit, setCountLimit]   = useState<NumOrEmpty>("");
  const [fromContact, setFromContact] = useState<NumOrEmpty>(1);
  const [toContact, setToContact]     = useState<NumOrEmpty>("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [starting, setStarting]   = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [dragOver, setDragOver]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef  = useRef<HTMLInputElement>(null);

  const validContacts = useMemo(
    () => contacts.filter((c) => normalizePhone(c.phone) !== null), [contacts]);

  const selectedContacts = useMemo(() => {
    if (!validContacts.length) return [];
    if (selectionMode === "count") {
      const n = typeof countLimit === "number"
        ? Math.min(countLimit, validContacts.length) : validContacts.length;
      return validContacts.slice(0, Math.max(1, n));
    }
    const from = typeof fromContact === "number" ? Math.max(1, fromContact) : 1;
    const to   = typeof toContact   === "number"
      ? Math.min(toContact, validContacts.length) : validContacts.length;
    return from > to ? [] : validContacts.slice(from - 1, to);
  }, [selectionMode, countLimit, fromContact, toContact, validContacts]);

  const avgDelay  = (delayMin + delayMax) / 2;
  const estMinutes = Math.ceil(selectedContacts.length * avgDelay / 60);
  const sampleName = validContacts[0]?.name?.trim() || "اسم العميل";
  const greetingLine = greetingMessage.trim()
    ? `${greetingMessage.trim()} ${sampleName}` : null;
  const fullPreview = greetingLine ? `${greetingLine}\n${message}` : message;

  async function loadFile(file: File) {
    setFileError(null); setContacts([]);
    try {
      const parsed = await parseExcel(file);
      setContacts(parsed);
      setCountLimit(""); setFromContact(1); setToContact("");
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "خطأ في قراءة الملف");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }

  async function handleStart() {
    if (!selectedContacts.length) { setStartError("لا توجد جهات اتصال في النطاق المحدد"); return; }
    if (!message.trim()) { setStartError("الرجاء كتابة نص الرسالة"); return; }
    if (delayMin > delayMax) { setStartError("الحد الأدنى يجب أن يكون أقل من الأقصى"); return; }
    setStarting(true); setStartError(null);
    try {
      const imageBase64 = imageFile ? await fileToBase64(imageFile) : null;
      await n8n.startCampaign({
        contacts: selectedContacts, message: message.trim(),
        greetingMessage: greetingMessage.trim() || undefined,
        imageBase64, delayMin, delayMax,
      });
      onStarted();
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "فشل بدء الحملة");
    } finally { setStarting(false); }
  }

  return (
    <div className="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden fade-in">

      {/* Card header */}
      <div className="px-6 py-4 border-b border-gray-50"
        style={{ background: "linear-gradient(135deg,#f0fdf4,#f0fdfa)" }}>
        <h2 className="text-base font-bold text-gray-900">🚀 إعداد الحملة</h2>
        <p className="text-xs text-gray-400 mt-0.5">أرسل رسائلك لآلاف العملاء بكل سهولة</p>
      </div>

      <div className="p-5 space-y-6">

        {/* ══ Section 1: File Upload ══ */}
        <Section icon="📁" title="جهات الاتصال" color="emerald">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-emerald-400 bg-emerald-50 scale-[1.01]"
                : contacts.length
                ? "border-emerald-300 bg-emerald-50/50"
                : "border-gray-200 hover:border-emerald-300 hover:bg-gray-50"
            }`}>
            <div className="text-4xl mb-2">{contacts.length ? "✅" : "📂"}</div>
            <p className="text-sm font-semibold text-gray-700">
              {contacts.length
                ? `${contacts.length} جهة اتصال محملة`
                : "اسحب الملف هنا أو انقر للاختيار"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {contacts.length
                ? `${validContacts.length} رقم صالح`
                : "يدعم .xlsx و .xls — يجب أن يحتوي على عمود «موبايل»"}
            </p>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
          {fileError && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{fileError}</div>
          )}

          {/* Stats strip */}
          {contacts.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[
                { v: contacts.length,        l: "إجمالي",  c: "bg-gray-100 text-gray-700" },
                { v: validContacts.length,   l: "صالح",    c: "bg-emerald-100 text-emerald-700" },
                { v: contacts.length - validContacts.length, l: "غير صالح", c: "bg-red-100 text-red-600" },
                { v: selectedContacts.length, l: "سيُرسل", c: "bg-blue-100 text-blue-700 font-bold" },
              ].map((s, i) => (
                <div key={i} className={`rounded-xl px-2 py-2 text-center ${s.c}`}>
                  <div className="text-lg font-extrabold">{s.v}</div>
                  <div className="text-[10px] mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
          )}

          {/* Preview phones */}
          {validContacts.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-400 mb-1.5">أول 8 أرقام:</p>
              <div className="flex flex-wrap gap-1.5">
                {validContacts.slice(0, 8).map((c, i) => (
                  <span key={i}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-xs font-mono text-gray-600">
                    {c.phone}
                  </span>
                ))}
                {validContacts.length > 8 && (
                  <span className="text-xs text-gray-400 self-center">+{validContacts.length - 8} أخرى</span>
                )}
              </div>
            </div>
          )}
        </Section>

        {/* ══ Section 2: Range Selection ══ */}
        {contacts.length > 0 && (
          <Section icon="🎯" title="نطاق الإرسال" color="blue">
            {/* Mode tabs */}
            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm mb-3">
              {([
                { mode: "count", label: "أول N عميل" },
                { mode: "range", label: "من رقم ← إلى رقم" },
              ] as const).map(({ mode, label }) => (
                <button key={mode} onClick={() => setSelectionMode(mode)}
                  className={`flex-1 py-2 font-semibold transition-all ${
                    selectionMode === mode
                      ? "text-white shadow-sm"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                  style={selectionMode === mode
                    ? { background: "linear-gradient(135deg,#3b82f6,#6366f1)" } : {}}>
                  {label}
                </button>
              ))}
            </div>

            {selectionMode === "count" ? (
              <div className="flex items-center gap-3">
                <input type="number" min={1} max={validContacts.length}
                  value={countLimit === "" ? "" : countLimit}
                  placeholder={String(validContacts.length)}
                  onChange={(e) => setCountLimit(e.target.value === "" ? "" : parseInt(e.target.value) || 1)}
                  className="border border-gray-200 rounded-xl px-4 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-300 text-center font-bold" />
                <span className="text-sm text-gray-500">من أصل {validContacts.length}</span>
                <button onClick={() => setCountLimit(validContacts.length)}
                  className="text-xs text-blue-500 hover:text-blue-700 font-semibold">الكل</button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 w-8">من</span>
                  <input type="number" min={1} max={validContacts.length}
                    value={fromContact === "" ? "" : fromContact} placeholder="1"
                    onChange={(e) => setFromContact(e.target.value === "" ? "" : parseInt(e.target.value) || 1)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-300 text-center font-bold" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 w-8">إلى</span>
                  <input type="number" min={1} max={validContacts.length}
                    value={toContact === "" ? "" : toContact}
                    placeholder={String(validContacts.length)}
                    onChange={(e) => setToContact(e.target.value === "" ? "" : parseInt(e.target.value) || 1)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-300 text-center font-bold" />
                </div>
                <button onClick={() => { setFromContact(1); setToContact(validContacts.length); }}
                  className="text-xs text-blue-500 hover:text-blue-700 font-semibold">الكل</button>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                  {selectedContacts.length} عميل
                </span>
              </div>
            )}

            {/* Time estimate */}
            {selectedContacts.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 flex items-center gap-3">
                <span className="text-xl">⏱</span>
                <div>
                  <p className="text-xs font-bold text-amber-800">الوقت التقديري للحملة</p>
                  <p className="text-sm font-extrabold text-amber-700">
                    ~{estMinutes >= 60 ? `${(estMinutes/60).toFixed(1)} ساعة` : `${estMinutes} دقيقة`}
                    <span className="text-xs font-normal text-amber-600 mr-1">
                      ({selectedContacts.length} رسالة × متوسط {avgDelay}ث)
                    </span>
                  </p>
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ══ Section 3: Greeting ══ */}
        <Section icon="👋" title="رسالة الترحيب" color="purple">
          <input type="text" value={greetingMessage}
            onChange={(e) => setGreetingMessage(e.target.value)}
            placeholder="مثال: أهلاً — مرحباً — السلام عليكم"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            <span>💡</span>
            مثال على الإرسال:{" "}
            <span className="text-gray-600 font-semibold">
              {greetingMessage.trim() || "مرحباً"} {sampleName}
            </span>
          </p>
        </Section>

        {/* ══ Section 4: Message ══ */}
        <Section icon="💬" title="نص الرسالة" color="emerald">
          <textarea rows={4} value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="اكتب محتوى رسالتك هنا..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300 leading-relaxed" />
          <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
            <span>{message.length} حرف</span>
            <span className="text-gray-300">اختياري: يمكنك استخدام Emoji 😊</span>
          </div>
        </Section>

        {/* ══ Preview ══ */}
        {(greetingMessage.trim() || message.trim()) && (
          <div className="rounded-2xl overflow-hidden border border-gray-200">
            {/* WhatsApp-style header */}
            <div className="flex items-center gap-2 px-4 py-2.5"
              style={{ background: "linear-gradient(135deg,#075E54,#128C7E)" }}>
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-sm">👤</div>
              <span className="text-white text-xs font-semibold">{sampleName}</span>
            </div>
            {/* Chat background */}
            <div className="px-4 py-4" style={{ background: "#E5DDD5" }}>
              {/* Message bubble */}
              <div className="flex justify-end">
                <div className="relative max-w-[80%]">
                  <div className="rounded-2xl rounded-tr-sm px-4 py-2 shadow-sm"
                    style={{ background: "#DCF8C6" }}>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {fullPreview || <span className="italic text-gray-400">اكتب الرسالة...</span>}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-gray-400">الآن</span>
                      <span className="text-[11px] text-emerald-500">✓✓</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {greetingMessage.trim() && (
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-center">
                <p className="text-[10px] text-gray-400">
                  ✨ &quot;{sampleName}&quot; سيُستبدل باسم كل عميل تلقائياً
                </p>
              </div>
            )}
          </div>
        )}

        {/* ══ Section 5: Image ══ */}
        <Section icon="🖼️" title="صورة مرفقة" color="pink">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => imgRef.current?.click()}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                imageFile
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
              }`}>
              <span>{imageFile ? "✅" : "📎"}</span>
              {imageFile ? imageFile.name : "اختر صورة (اختياري)"}
            </button>
            {imageFile && (
              <button type="button"
                onClick={() => { setImageFile(null); if (imgRef.current) imgRef.current.value = ""; }}
                className="text-xs text-red-400 hover:text-red-600 font-medium">✕ حذف</button>
            )}
          </div>
          <input ref={imgRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
        </Section>

        {/* ══ Section 6: Delay ══ */}
        <Section icon="⏱" title="التأخير بين الرسائل (عشوائي)" color="orange">
          <div className="space-y-4">
            <SliderRow label="الحد الأدنى" value={delayMin} min={10} max={120} step={5}
              color="#10b981"
              onChange={(v) => { setDelayMin(v); if (v > delayMax) setDelayMax(v); }} />
            <SliderRow label="الحد الأقصى" value={delayMax} min={10} max={180} step={5}
              color="#0d9488"
              onChange={(v) => { setDelayMax(v); if (v < delayMin) setDelayMin(v); }} />
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-orange-50 border border-orange-200">
              <span className="text-lg">🎲</span>
              <p className="text-xs text-orange-700">
                تأخير عشوائي بين{" "}
                <strong>{delayMin}</strong> و <strong>{delayMax}</strong> ثانية لكل رسالة
              </p>
            </div>
          </div>
        </Section>

        {/* Error */}
        {startError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
            <span>⚠️</span> {startError}
          </div>
        )}

        {/* Start Button */}
        <button onClick={handleStart}
          disabled={disabled || starting || !selectedContacts.length || !message.trim()}
          className="w-full py-4 rounded-2xl text-base font-extrabold text-white transition-all shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          style={!disabled && selectedContacts.length && message.trim()
            ? { background: "linear-gradient(135deg, #059669, #0d9488)" }
            : { background: "#d1d5db" }}>
          {starting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              جاري بدء الحملة...
            </span>
          ) : selectedContacts.length ? (
            `🚀 بدء الإرسال — ${selectedContacts.length} عميل`
          ) : (
            "بدء الإرسال"
          )}
        </button>
      </div>
    </div>
  );
}

/* ── Section Wrapper ── */
function Section({ icon, title, color, children }: {
  icon: string; title: string; color: string; children: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-700",
    blue:    "bg-blue-100 text-blue-700",
    purple:  "bg-purple-100 text-purple-700",
    pink:    "bg-pink-100 text-pink-700",
    orange:  "bg-orange-100 text-orange-700",
  };
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${colors[color]}`}>
          {icon}
        </span>
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/* ── Slider Row ── */
function SliderRow({ label, value, min, max, step, color, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  color: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="font-extrabold" style={{ color }}>{value} ث</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: color }} />
      <div className="flex justify-between text-[10px] text-gray-300 mt-1 px-0.5">
        <span>{min}ث</span><span>{max}ث</span>
      </div>
    </div>
  );
}
