# TFG WhatsApp Sender — دليل إعادة البناء الكامل للـ AI

> اقرأ هذا الملف أولاً. يحتوي على كل ما تحتاجه لإعادة بناء المشروع من الصفر.
> آخر تحديث: 2026-04-06

---

## ما هو المشروع؟

نظام إرسال رسائل واتساب بالجملة يعمل على 3 طبقات:
- **Frontend**: Next.js 16 على Vercel — واجهة عربية RTL
- **Backend**: n8n على Hostinger — 8 workflows تدير كل شيء
- **WhatsApp Gateway**: Evolution API v2 — بوابة الإرسال الفعلي

---

## بيانات الاعتماد الكاملة

```
n8n URL:              https://n8n.srv1532138.hstgr.cloud
n8n API Key:          eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwODE0MmI0OS00M2IyLTQ5M2EtYTBlYS0xMDYwNWU3YzYzOGUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMzVmYWFjNGQtZGUzZS00NzkxLWE1MmEtYmMxOTY0ZWI1ZDBiIiwiaWF0IjoxNzc0ODkxNjQzfQ.u7g3rXOJ7XELFRLd9FbhmbaXairbCaM2J_Ulg1mLMtA

Evolution API URL:    http://72.62.190.12:8080
Evolution API Key:    AmrSecretKey2024
Evolution Instance:   TFG

Vercel Team:          amrs-projects-0462a485
Vercel Project:       tfg-whatsapp-sender
Frontend Live URL:    https://tfg-whatsapp-sender.vercel.app
Frontend Code Path:   A:\N8N\frontend\
```

---

## ترتيب الملفات — اقرأها بهذا الترتيب

| الملف | المحتوى |
|-------|---------|
| `00_START_HERE.md` | **هذا الملف** — نقطة البداية |
| `01_PROJECT_MAP.md` | المعمارية الكاملة، تدفق البيانات، بنية الـ state |
| `02_N8N_WORKFLOWS_CODE.md` | كود الـ 8 workflows بالكامل (أحدث إصدار) |
| `03_FRONTEND_CODE.md` | كل ملفات الفرونت TypeScript/TSX (أحدث إصدار) |
| `04_SETUP_GUIDE.md` | خطوات الإعداد من الصفر، استكشاف الأخطاء |

---

## مميزات النظام الكاملة

| الميزة | التفاصيل |
|--------|---------|
| إرسال بالجملة | آلاف الأرقام بتأخير بين كل رسالة |
| رسالة ترحيبية | تُضاف + اسم العميل تلقائياً أمام الرسالة |
| تأخير عشوائي | من X إلى Y ثانية، يتغير مع كل رسالة |
| إرسال صور | صورة مع كابشن (raw base64, mediatype='image') |
| نطاق الإرسال | "أول N عميل" أو "من رقم X إلى رقم Y" |
| اسم الأكونت | يُعرض في الـ UI بعد ربط الواتساب |
| Pause/Resume/Stop | تحكم كامل مع الحفاظ على المكان |
| تصدير الفاشلين | CSV بالأرقام الفاشلة وسببها |
| تطبيع الأرقام | 01xxxxxxxx → 201xxxxxxxx@s.whatsapp.net |
| RTL عربي | خط Cairo، اتجاه يمين-لشمال |

---

## خطوات إعادة البناء (للـ AI)

### الخطوة 1: إعداد n8n Workflows

```bash
cd A:\N8N
python rebuild_workflows.py
```

هذا يبني الـ 8 workflows. إذا احتجت تعديل كود معين:
```python
import requests
N8N_KEY = "eyJ..."
N8N_URL = "https://n8n.srv1532138.hstgr.cloud"
HEADERS = {"X-N8N-API-KEY": N8N_KEY, "Content-Type": "application/json"}

r = requests.get(f"{N8N_URL}/api/v1/workflows/WORKFLOW_ID", headers=HEADERS)
wf = r.json()

for node in wf["nodes"]:
    if node["name"] == "NODE_NAME":
        node["parameters"]["jsCode"] = "NEW_CODE"
        break

requests.put(f"{N8N_URL}/api/v1/workflows/WORKFLOW_ID", headers=HEADERS, json={
    "name": wf["name"], "nodes": wf["nodes"],
    "connections": wf["connections"], "settings": wf["settings"],
    "staticData": wf.get("staticData")
})
requests.post(f"{N8N_URL}/api/v1/workflows/WORKFLOW_ID/activate", headers=HEADERS)
```

### الخطوة 2: بناء الفرونت

```bash
# المكتبات المطلوبة
npm install react-window@^2.2.7 xlsx@^0.18.5
npm install -D @types/react-window

# تشغيل محلي
npm run dev

# بناء للإنتاج
npm run build
```

### الخطوة 3: نشر على Vercel

```bash
cd frontend
npx vercel --prod --yes
```

---

## معرفات الـ 8 Workflows

| الـ Workflow | الـ ID | الـ Endpoint |
|-------------|-------|-------------|
| W1 WhatsApp Status | `WIaFfruceOZehBqg` | `GET /webhook/whatsapp-status` |
| W2 WhatsApp QR | `amuoJXviXIkel948` | `POST /webhook/whatsapp-qr` |
| W3 Campaign Start | `61u8nDuYlLFXbuc8` | `POST /webhook/campaign-start` |
| W4 Campaign Executor | `m86FaORgXpvwpWQO` | `POST /webhook/campaign-execute-next` |
| W5 Campaign Control | `27LfJhVVo4aoA0D7` | `POST /webhook/campaign-control` |
| W6 Campaign Status | `c1wBr8RlOaJNGefL` | `GET /webhook/campaign-status` |
| W7 Export Failed | `izMkdxtu2F5kVcrS` | `GET /webhook/campaign-export-failed` |
| W8 State Store | `E3Y2RaqSFnh1kQUv` | `POST /webhook/campaign-state` |

---

## نقاط حرجة — لا تتجاهلها

### Evolution API v2 — فورمات الرسائل (مُختبر ومؤكد بالاختبار المباشر)

```javascript
// نص
POST /message/sendText/TFG
Headers: { apikey: "AmrSecretKey2024" }
Body: { "number": "201XXXXXXXXXX@s.whatsapp.net", "textMessage": { "text": "الرسالة" } }

// صورة
POST /message/sendMedia/TFG
Body: {
  "number": "201XXXXXXXXXX@s.whatsapp.net",
  "mediaMessage": {
    "mediatype": "image",     // ← lowercase حتماً
    "media": "iVBORw0KGgo=", // ← raw base64 بدون "data:image/..." prefix
    "caption": "الكابشن"
  }
}
```

### n8n HTTP Request Node v4 — Headers

```javascript
// صح — keypair
"specifyHeaders": "keypair",
"headerParameters": { "parameters": [
  { "name": "apikey", "value": "AmrSecretKey2024" },
  { "name": "Content-Type", "value": "application/json" }
]}

// غلط — jsonHeaders dict (يسبب [object Object] error)
"jsonHeaders": {"apikey": "..."}
```

### n8n Code Nodes — قيود

```
✗ require() — محظور
✗ fetch() — محظور
✗ fs — محظور
✓ $getWorkflowStaticData('global') — التخزين الوحيد
✓ $input.first().json
✓ $('NodeName').first().json
```

### n8n Expressions

```
✓ ={{ expression }}
✓ "text {{ $json.val }}"
✗ ={"key": "={{ val }}"}       — INVALID
✓ ={{ JSON.stringify({key: $json.val}) }}
```

### react-window v2 — API الجديدة

```tsx
import { List } from 'react-window'  // ← List مش FixedSizeList

<List<RowProps>
  rowComponent={Row}        // ← مش children render prop
  rowCount={count}
  rowHeight={56}
  rowProps={{ contacts }}   // ← بيانات إضافية للـ Row
  defaultHeight={height}
/>
```

### TypeScript — generic مع string literal في TSX

```tsx
// خطأ — TSX يخلط بين | ">" وـ JSX
useState<number | "">("")

// صح — استخدم type alias
type NumOrEmpty = number | "";
useState<NumOrEmpty>("")
```

---

## هيكل الملفات الكاملة

```
A:\N8N\
├── docs\                         ← الدوكيومنتيشن (هذا الفولدر)
│   ├── 00_START_HERE.md
│   ├── 01_PROJECT_MAP.md
│   ├── 02_N8N_WORKFLOWS_CODE.md
│   ├── 03_FRONTEND_CODE.md
│   └── 04_SETUP_GUIDE.md
├── frontend\                     ← Next.js project
│   └── src\
│       ├── app\ (layout, page, globals.css)
│       ├── components\ (4 components)
│       ├── hooks\ (2 hooks)
│       └── lib\ (n8nClient, excelParser)
├── rebuild_workflows.py          ← يبني كل الـ 8 workflows
├── fix_greeting_random_delay.py  ← أضاف greetingMessage + random delay
├── fix_sendmedia_format.py       ← أصلح فورمات الصور
└── send_test.py                  ← اختبار الإرسال من الترمينال
```
