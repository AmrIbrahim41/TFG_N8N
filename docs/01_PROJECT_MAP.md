# TFG WhatsApp Sender — خريطة المشروع الكاملة

---

## نظرة عامة

نظام إرسال رسائل واتساب بالجملة مبني على 3 طبقات:

```
المستخدم
    ↓
[Frontend — Vercel]
https://tfg-whatsapp-sender.vercel.app
Next.js 16 + Tailwind + Cairo Font (RTL)
    ↓
[Backend — n8n on Hostinger]
https://n8n.srv1532138.hstgr.cloud
8 Workflows (W1–W8)
    ↓
[WhatsApp Gateway — Evolution API v2]
http://72.62.190.12:8080
Instance: TFG
```

---

## البيانات والإعدادات

| المكون | القيمة |
|--------|--------|
| **n8n URL** | https://n8n.srv1532138.hstgr.cloud |
| **n8n API Key** | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwODE0MmI0OS00M2IyLTQ5M2EtYTBlYS0xMDYwNWU3YzYzOGUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMzVmYWFjNGQtZGUzZS00NzkxLWE1MmEtYmMxOTY0ZWI1ZDBiIiwiaWF0IjoxNzc0ODkxNjQzfQ.u7g3rXOJ7XELFRLd9FbhmbaXairbCaM2J_Ulg1mLMtA |
| **Evolution API URL** | http://72.62.190.12:8080 |
| **Evolution Global API Key** | AmrSecretKey2024 |
| **Evolution Instance Name** | TFG |
| **Frontend URL** | https://tfg-whatsapp-sender.vercel.app |
| **Frontend Code** | A:\N8N\frontend\ |
| **Vercel Project** | amrs-projects-0462a485/tfg-whatsapp-sender |

---

## هيكل n8n Workflows

### الـ 8 Workflows ومعرفاتهم

| رقم | الاسم | الـ ID | الـ Webhook Path |
|-----|-------|--------|-----------------|
| W1 | WhatsApp Status | WIaFfruceOZehBqg | GET /webhook/whatsapp-status |
| W2 | WhatsApp QR | amuoJXviXIkel948 | POST /webhook/whatsapp-qr |
| W3 | Campaign Start | 61u8nDuYlLFXbuc8 | POST /webhook/campaign-start |
| W4 | Campaign Executor | m86FaORgXpvwpWQO | POST /webhook/campaign-execute-next |
| W5 | Campaign Control | 27LfJhVVo4aoA0D7 | POST /webhook/campaign-control |
| W6 | Campaign Status | c1wBr8RlOaJNGefL | GET /webhook/campaign-status |
| W7 | Export Failed | izMkdxtu2F5kVcrS | GET /webhook/campaign-export-failed |
| W8 | State Store | E3Y2RaqSFnh1kQUv | POST /webhook/campaign-state |

---

## تدفق البيانات الكامل

### 1. بدء حملة جديدة

```
Frontend
  → POST /webhook/campaign-start
    body: { contacts[], message, greetingMessage?, imageBase64?, delayMin, delayMax }
  → W3 (Init Campaign)
      → يطبّع أرقام الهاتف (01xxxxxxxx → 201xxxxxxxx@s.whatsapp.net)
      → يبني campaignState مع greetingMessage + delayMin/Max
      → POST /webhook/campaign-state {action:"write", data: campaignState}  → W8 يحفظ
      → يرد على Frontend بـ {campaignId, total, estimatedHours}
      → POST /webhook/campaign-execute-next {}  → يشغّل W4 (لا ينتظر)
```

### 2. تنفيذ الإرسال (W4 — Self-Triggering Loop)

```
POST /webhook/campaign-execute-next
  → W4 يستلم (responseMode: onReceived → يرد فوراً بـ 200)
  → POST /webhook/campaign-state {action:"read-current"}  → W8 يرجع الجهة الحالية
  → Check Status Code:
      إذا status=running وعندنا جهة اتصال:
          يبني fullMessage = greetingMessage + اسم العميل + "\n" + message
          يحسب actualDelay = random(delayMin, delayMax)
          canSend = true
      إذا لا:
          canSend = false → Finalize → ينهي
  → IF canSend=true:
      → POST Evolution API (sendText أو sendMedia)
      → Update State Code: يحدد sent/failed
      → POST /webhook/campaign-state {action:"update-after-send"}
      → Wait (actualDelay ثانية — عشوائي)
      → POST /webhook/campaign-execute-next {}  ← يشغّل نفسه!
```

### 3. التحكم (Pause/Resume/Stop)

```
Frontend → POST /webhook/campaign-control {action: "pause"|"resume"|"stop"}
  → W5 → POST /webhook/campaign-state {action:"set-status"} → W8
  → إذا resume: POST /webhook/campaign-execute-next → يكمل من حيث توقف
```

### 4. جلب الحالة

```
Frontend (كل 5 ثواني) → GET /webhook/campaign-status
  → W6 → POST /webhook/campaign-state {action:"read"} → W8
  → Frontend يعرض الإحصائيات والتقدم
```

### 5. تصدير الفاشلين

```
Frontend → GET /webhook/campaign-export-failed
  → W7 → POST /webhook/campaign-state {action:"read"} → W8
  → Build CSV → ينزل الملف
```

---

## W8 State Store — بنية البيانات الكاملة

```javascript
{
  campaignId: "camp_1234567890",
  status: "running",               // idle | running | paused | completed | stopped
  contacts: [
    {
      phone: "01061023320",         // الرقم الأصلي من الملف
      name: "عمرو إبراهيم",
      whatsappId: "201061023320@s.whatsapp.net",
      status: "sent",              // pending | sent | failed
      sentAt: "2026-04-06T...",
      failedReason: null
    }
  ],
  currentIndex: 3,
  message: "نص الرسالة الأساسية",
  greetingMessage: "أهلاً",        // يُضاف + اسم العميل أمام الرسالة
  imageBase64: null,               // raw base64 بدون data URL prefix
  delayMin: 15,                    // الحد الأدنى للتأخير (ثانية)
  delayMax: 45,                    // الحد الأقصى للتأخير (ثانية)
  delaySeconds: 30,                // المتوسط (للتوافق)
  sentCount: 3,
  failedCount: 0,
  totalInvalid: 0,
  startedAt: "...",
  pausedAt: null,
  completedAt: null,
  lastUpdated: "..."
}
```

### أوامر W8 (actions)

| الأمر | الوصف |
|-------|-------|
| `read` | يرجع الحالة الكاملة مع معاينة أول 500 جهة |
| `read-current` | يرجع الجهة الحالية فقط (خفيف — لـ W4) |
| `write` | يكتب الحالة كاملة (بداية حملة جديدة) |
| `update-after-send` | يحدّث حالة جهة واحدة ويزيد currentIndex |
| `set-status` | يغير الحالة (pause/resume/stop/complete) |

---

## هيكل ملفات الـ Frontend

```
A:\N8N\frontend\
├── src\
│   ├── app\
│   │   ├── layout.tsx          ← RTL + Cairo Font + metadata
│   │   ├── page.tsx            ← الصفحة الرئيسية
│   │   └── globals.css         ← direction: rtl
│   ├── components\
│   │   ├── ConnectionPanel.tsx ← حالة واتساب + اسم الأكونت + QR
│   │   ├── CampaignForm.tsx    ← رفع Excel + رسالة ترحيبية + نطاق الإرسال + تأخير عشوائي
│   │   ├── ProgressDashboard.tsx ← إحصائيات + progress bar + تحكم
│   │   └── ContactTable.tsx    ← قائمة جهات الاتصال (react-window v2)
│   ├── hooks\
│   │   ├── useWhatsAppStatus.ts ← polling كل 30 ثانية
│   │   └── useCampaignStatus.ts ← polling كل 5 ثواني
│   └── lib\
│       ├── n8nClient.ts        ← كل API calls
│       └── excelParser.ts      ← SheetJS لقراءة Excel
├── package.json
├── next.config.ts
└── (tailwind v4 — لا يحتاج tailwind.config.ts)
```

---

## مميزات النظام الكاملة

1. **إرسال بالجملة** — آلاف الأرقام مع تأخير بين كل رسالة
2. **رسالة ترحيبية** — تُضاف اسم العميل تلقائياً قبل الرسالة الأساسية
3. **تأخير عشوائي** — من X إلى Y ثانية، يتغير مع كل رسالة لتجنب الحجب
4. **إرسال صور** — صورة مع كابشن نصي (raw base64, mediatype='image')
5. **Pause/Resume/Stop** — تحكم كامل في الحملة مع الحفاظ على المكان
6. **تصدير الفاشلين** — CSV بالأرقام الفاشلة وسببها
7. **تطبيع الأرقام** — 01xxxxxxxx → 201xxxxxxxx@s.whatsapp.net
8. **نطاق الإرسال** — اختيار "أول N عميل" أو "من رقم X إلى رقم Y"
9. **اسم الأكونت** — يُعرض بعد ربط الواتساب
10. **RTL عربي كامل** — خط Cairo، اتجاه من اليمين لليسار

---

## Evolution API v2 — فورمات الرسائل (مُختبر ومؤكد)

```javascript
// نص فقط
POST /message/sendText/TFG
Headers: { apikey: "AmrSecretKey2024", "Content-Type": "application/json" }
Body: {
  "number": "201XXXXXXXXXX@s.whatsapp.net",
  "textMessage": { "text": "الرسالة" }   // ← wrapper مطلوب، مش text مباشرة
}

// صورة مع كابشن
POST /message/sendMedia/TFG
Body: {
  "number": "201XXXXXXXXXX@s.whatsapp.net",
  "mediaMessage": {
    "mediatype": "image",     // ← lowercase دائماً
    "media": "iVBORw0KGgo=", // ← raw base64 بدون "data:image/..." prefix
    "caption": "نص الكابشن"
  }
}
```

---

## تطبيع أرقام الهاتف (مصري)

```
01061023320     → أضف 2 في الأول → 201061023320 ✓
201061023320    → صالح مباشرة ✓
+201061023320   → شيل + → 201061023320 ✓
002201061023320 → شيل أول 0 → 2201061023320 × (غلط)
020xxxxxxxxx   → شيل أول 0 → 20xxxxxxxxx → تحقق الصيغة
الصيغة النهائية: /^20[0-9]{10}$/ → 201xxxxxxxxxx@s.whatsapp.net
```

---

## القيود المعروفة

1. **W7 تصدير الفاشلين**: CSV فقط، يعرض أول 500 جهة من الـ preview
2. **n8n Code Nodes**: لا يدعم `require()` ولا `fetch()` — الحل `$getWorkflowStaticData`
3. **الحملة النشطة**: حملة واحدة في وقت واحد فقط
4. **QR Code**: صالح لـ 60 ثانية فقط
5. **Static Data**: تُفقد عند restart n8n — الحملة ستحتاج إعادة تشغيل
