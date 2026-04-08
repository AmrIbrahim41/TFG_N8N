# دليل الإعداد الكامل — TFG WhatsApp Sender

> آخر تحديث: 2026-04-06

---

## المتطلبات

| الأداة | الإصدار |
|--------|---------|
| Node.js | 18+ |
| Python | 3.8+ |
| pip | `requests`, `openpyxl` |
| Vercel CLI | أحدث |

```bash
pip install requests openpyxl
npm install -g vercel
```

---

## الجزء الأول: التحقق من البنية التحتية

### تحقق من Evolution API

```bash
curl -H "apikey: AmrSecretKey2024" http://72.62.190.12:8080/instance/fetchInstances
# الرد: [{"instance":{"instanceName":"TFG","state":"open",...}}]

curl -H "apikey: AmrSecretKey2024" http://72.62.190.12:8080/instance/connectionState/TFG
# متصل: {"instance":{"state":"open"}}
# غير متصل: {"instance":{"state":"close"}}
```

### تحقق من n8n

```bash
curl -H "X-N8N-API-KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
     https://n8n.srv1532138.hstgr.cloud/api/v1/workflows
```

---

## الجزء الثاني: إعداد n8n Workflows

### تشغيل سكريبت البناء

```bash
cd A:\N8N
python rebuild_workflows.py
```

**المخرجات المتوقعة:**
```
W1 WhatsApp Status   [active]
W2 WhatsApp QR       [active]
W3 Campaign Start    [active]
W4 Campaign Executor [active]
W5 Campaign Control  [active]
W6 Campaign Status   [active]
W7 Export Failed     [active]
W8 State Store       [active]
```

### اختبار الـ Endpoints

```bash
curl https://n8n.srv1532138.hstgr.cloud/webhook/whatsapp-status
curl https://n8n.srv1532138.hstgr.cloud/webhook/campaign-status
```

---

## الجزء الثالث: ربط واتساب (QR Code)

### عبر الـ Frontend

1. افتح https://tfg-whatsapp-sender.vercel.app
2. اضغط "ربط واتساب"
3. امسح الـ QR Code:
   - واتساب → النقاط الثلاث → الأجهزة المرتبطة → ربط جهاز
4. انتظر 15 ثانية — الـ UI يتحدث تلقائياً

**بعد الربط سيظهر:**
- نقطة خضراء
- اسم الأكونت (مثال: "Amr Ibrahim")
- رقم الهاتف

**ملاحظة:** QR صالح لـ 60 ثانية فقط.

### عبر API مباشرة

```bash
curl -X POST https://n8n.srv1532138.hstgr.cloud/webhook/whatsapp-qr
# الرد: {"connected":false,"base64":"data:image/png;base64,..."}
```

---

## الجزء الرابع: نشر الـ Frontend

### تثبيت محلي

```bash
cd A:\N8N\frontend
npm install
npm run dev
# http://localhost:3000
```

### نشر على Vercel

```bash
cd A:\N8N\frontend
npx vercel --prod --yes
```

---

## الجزء الخامس: استخدام النظام

### تحضير ملف Excel

الملف يجب أن يحتوي على عمود **"موبايل"** بالضبط.

| رقم العضوية | العضو | موبايل |
|------------|-------|--------|
| 1001 | أحمد محمد | 01061023320 |
| 1002 | سارة علي | 201508879271 |

**الصيغ المقبولة:**
```
01061023320      → يُحوَّل لـ 201061023320 ✓
201061023320     → صالح ✓
+201061023320    → صالح (يُشيل +) ✓
```

### بدء حملة

1. ارفع ملف Excel
2. اختار نطاق الإرسال:
   - **"أول N عميل"**: أدخل عدد الجهات من الأول
   - **"من رقم X إلى رقم Y"**: أدخل رقم البداية والنهاية
3. اكتب رسالة الترحيب (اختياري) — سيُضاف اسم العميل تلقائياً
4. اكتب الرسالة الأساسية
5. أضف صورة (اختياري)
6. اضبط التأخير العشوائي (10–180 ثانية)
7. اضغط "بدء الإرسال (N عميل)"

### التحكم في الحملة

| الزر | التأثير |
|------|---------|
| ⏸ إيقاف مؤقت | يحتفظ بالمكان |
| ▶ استئناف | يكمل من حيث توقف |
| ⏹ إيقاف نهائي | ينهي الحملة |
| ⬇ تحميل الفاشلين | CSV بالأرقام الفاشلة |

---

## الجزء السادس: بناء من الصفر (Scratch)

### تثبيت Evolution API

```bash
docker run -d \
  --name evolution-api -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=YOUR_API_KEY \
  -v evolution_store:/evolution/store \
  atendai/evolution-api:latest

# إنشاء instance
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: YOUR_API_KEY" -H "Content-Type: application/json" \
  -d '{"instanceName":"TFG","qrcode":true}'
```

### تثبيت n8n

```bash
docker run -d \
  --name n8n -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=password \
  -v n8n_data:/home/node/.n8n \
  n8nio/n8n:latest
```

### Nginx Reverse Proxy لـ n8n (HTTPS)

```nginx
server {
    listen 443 ssl;
    server_name n8n.yourdomain.com;
    ssl_certificate /etc/letsencrypt/live/n8n.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/n8n.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
certbot --nginx -d n8n.yourdomain.com
```

### تحديث بيانات الاعتماد

في `rebuild_workflows.py`:
```python
N8N_KEY = "YOUR_N8N_API_KEY"
N8N_URL = "https://n8n.yourdomain.com"
# داخل الكود:
EVO_URL = "http://YOUR_SERVER_IP:8080"
EVO_API_KEY = "YOUR_EVO_KEY"
EVO_INSTANCE = "YOUR_INSTANCE"
```

في `frontend/src/lib/n8nClient.ts`:
```typescript
const N8N_BASE = 'https://n8n.yourdomain.com/webhook';
```

---

## الجزء السابع: استكشاف الأخطاء

### مشاكل شائعة

| المشكلة | السبب | الحل |
|---------|-------|------|
| Bad Request عند إرسال صورة | فورمات غلط | تأكد: `mediaMessage.mediatype = "image"` (lowercase) + raw base64 |
| Bad Request عند إرسال نص | فورمات قديم | استخدم `textMessage: { text: "..." }` مش `text` مباشرة |
| `[object Object]` في n8n | jsonHeaders dict | استخدم keypair headers (راجع `00_START_HERE.md`) |
| Static Data فارغة | restart n8n | أعد تشغيل الحملة |
| QR لا يعمل | انتهت الـ 60 ثانية | اضغط "توليد كود جديد" |
| الفرونت لا يتصل بـ n8n | n8n على HTTP | يجب HTTPS — استخدم Nginx + SSL |

### اختبار مباشر للـ Evolution API

```python
import requests, base64, struct, zlib

def tiny_png():
    def chunk(name, data):
        c = struct.pack('>I', len(data)) + name + data
        return c + struct.pack('>I', zlib.crc32(name+data) & 0xFFFFFFFF)
    raw = chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0))
    raw += chunk(b'IDAT', zlib.compress(b'\x00\xff\x00\x00'))
    raw += chunk(b'IEND', b'')
    return base64.b64encode(b'\x89PNG\r\n\x1a\n' + raw).decode()

# اختبار نص
r = requests.post("http://72.62.190.12:8080/message/sendText/TFG",
    headers={"apikey": "AmrSecretKey2024", "Content-Type": "application/json"},
    json={"number": "201XXXXXXXXXX@s.whatsapp.net", "textMessage": {"text": "اختبار"}})
print(r.status_code, r.json())

# اختبار صورة
r = requests.post("http://72.62.190.12:8080/message/sendMedia/TFG",
    headers={"apikey": "AmrSecretKey2024", "Content-Type": "application/json"},
    json={"number": "201XXXXXXXXXX@s.whatsapp.net",
          "mediaMessage": {"mediatype": "image", "media": tiny_png(), "caption": "اختبار"}})
print(r.status_code, r.json())
```

---

## ملخص بيانات الاعتماد

| الخدمة | القيمة |
|--------|--------|
| **Evolution API URL** | `http://72.62.190.12:8080` |
| **Evolution API Key** | `AmrSecretKey2024` |
| **Evolution Instance** | `TFG` |
| **n8n URL** | `https://n8n.srv1532138.hstgr.cloud` |
| **Frontend URL** | `https://tfg-whatsapp-sender.vercel.app` |
| **Vercel Project** | `amrs-projects-0462a485/tfg-whatsapp-sender` |
