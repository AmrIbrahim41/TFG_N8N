# أكواد n8n Workflows الكاملة — أحدث إصدار

> آخر تحديث: 2026-04-06
> جميع الأكواد مُختبرة وتعمل على الإنتاج.

---

## W1 — WhatsApp Status
**ID:** `WIaFfruceOZehBqg` | **Endpoint:** `GET /webhook/whatsapp-status`

**Flow:** Webhook → Get Connection State (HTTP) → Get Instance Info (HTTP) → Format Response (Code) → Respond

### Format Response Code
```javascript
const stateRaw = $('Get Connection State').first().json;
const instancesRaw = $input.first().json;
const instances = Array.isArray(instancesRaw) ? instancesRaw : [instancesRaw];
const tfg = instances.find(i => i.instance?.instanceName === 'TFG') || {};
const inst = tfg.instance || {};
return [{json: {
  connected: stateRaw.instance?.state === 'open',
  state: stateRaw.instance?.state || 'unknown',
  phoneNumber: inst.ownerJid ? inst.ownerJid.split('@')[0] : null,
  name: inst.profileName || inst.instanceName || 'TFG',
  instanceName: 'TFG'
}}];
```

### HTTP Nodes (keypair headers)
```
GET http://72.62.190.12:8080/instance/connectionState/TFG
GET http://72.62.190.12:8080/instance/fetchInstances
Headers (keypair): apikey = AmrSecretKey2024
```

### Response Example
```json
{
  "connected": true,
  "state": "open",
  "phoneNumber": "201061023320",
  "name": "Amr Ibrahim",
  "instanceName": "TFG"
}
```

---

## W2 — WhatsApp QR
**ID:** `amuoJXviXIkel948` | **Endpoint:** `POST /webhook/whatsapp-qr`

**Flow:** Webhook → Get QR Code (HTTP) → Format QR Response (Code) → Respond

### HTTP Node
```
GET http://72.62.190.12:8080/instance/connect/TFG
Headers (keypair): apikey = AmrSecretKey2024
```

### Format QR Response Code
```javascript
const data = $input.first().json;
if (data.instance && data.instance.state === 'open') {
  return [{ json: { connected: true, state: 'open', base64: null } }];
}
const base64 = data.base64 || (data.qrcode && data.qrcode.base64) || null;
const code   = data.code   || (data.qrcode && data.qrcode.code)   || null;
return [{ json: {
  connected: false,
  base64,
  code,
  status: data.status || data.instance?.state || 'unknown'
}}];
```

---

## W3 — Campaign Start
**ID:** `61u8nDuYlLFXbuc8` | **Endpoint:** `POST /webhook/campaign-start`

**Flow:** Webhook → Init Campaign (Code) → Write State (HTTP→W8) → Respond → Start Executor (HTTP→W4)

### Init Campaign Code (كامل — أحدث إصدار)
```javascript
const input = $input.first().json;
const body = input.body || input;

function normalizePhone(raw) {
  if (!raw) return null;
  let d = String(raw).trim().replace(/\D/g, '');
  if (d.startsWith('002') && d.length === 14) d = d.substring(1);
  if (d.startsWith('020') && d.length === 13) d = d.substring(1);
  if (d.startsWith('01') && d.length === 11) d = '2' + d;
  if (/^20[0-9]{10}$/.test(d)) return d;
  return null;
}

const rawContacts = body.contacts || [];
// Frontend sends already-sliced contacts (based on count or range selection)
const toProcess = rawContacts;

const contacts = [];
let invalidCount = 0;
for (const c of toProcess) {
  const rawPhone = typeof c === 'string' ? c : (c.phone || c.mobile || c['موبايل'] || '');
  const normalized = normalizePhone(rawPhone);
  if (normalized) {
    contacts.push({
      phone: rawPhone,
      name: c.name || c['العضو'] || c['اسم'] || '',
      whatsappId: normalized + '@s.whatsapp.net',
      status: 'pending',
      failedReason: null,
      sentAt: null
    });
  } else {
    invalidCount++;
  }
}

const campaignId = 'camp_' + Date.now();
const delayMin = Math.max(10, Math.min(120, parseInt(body.delayMin) || 15));
const delayMax = Math.max(delayMin, Math.min(180, parseInt(body.delayMax) || 45));
const greetingMessage = (body.greetingMessage || '').trim();
const avgDelay = Math.round((delayMin + delayMax) / 2);

const campaignState = {
  campaignId, status: 'running', contacts,
  currentIndex: 0,
  message: body.message || '',
  greetingMessage,
  imageBase64: body.imageBase64 || null,
  delayMin,
  delayMax,
  delaySeconds: avgDelay,
  sentCount: 0, failedCount: 0,
  totalInvalid: invalidCount,
  startedAt: new Date().toISOString(),
  pausedAt: null, completedAt: null,
  lastUpdated: new Date().toISOString()
};

return [{ json: {
  writePayload: JSON.stringify({ action: 'write', data: campaignState }),
  response: {
    campaignId, total: contacts.length,
    totalInvalid: invalidCount, success: true,
    delayMin, delayMax,
    estimatedHours: Math.round(contacts.length * avgDelay / 3600 * 10) / 10
  }
}}];
```

### Request Body للـ Frontend
```json
{
  "contacts": [
    { "phone": "01061023320", "name": "عمرو إبراهيم" }
  ],
  "message": "نص الرسالة الأساسية",
  "greetingMessage": "أهلاً",
  "imageBase64": null,
  "delayMin": 15,
  "delayMax": 45
}
```

**ملاحظة:** الـ Frontend يقوم بقطع الجهات (count أو range) قبل الإرسال، لذا W3 يعالج كل ما يصله.

---

## W4 — Campaign Executor (Self-Triggering)
**ID:** `m86FaORgXpvwpWQO` | **Endpoint:** `POST /webhook/campaign-execute-next`

**⚠️ مهم:** الـ Webhook بـ `responseMode: onReceived` — يرد فوراً بـ 200 قبل ما ينهي التنفيذ.

**Flow:**
```
Webhook (onReceived)
  → Read Current Contact (HTTP → W8 action:read-current)
  → Check Status (Code)
  → IF canSend=true:
      → Send Message (HTTP → Evolution API)
      → Update State Code (Code)
      → Update State (HTTP → W8 action:update-after-send)
      → Wait (actualDelay — عشوائي بين delayMin و delayMax)
      → Trigger Next (HTTP → /webhook/campaign-execute-next) ← يشغّل نفسه!
  → IF canSend=false:
      → Finalize (Code)
      → Mark Completed (HTTP → W8 action:set-status:completed) — فقط لو allDone
```

### Check Status Code (أحدث إصدار — رسالة ترحيبية + تأخير عشوائي + فورمات مؤكد)
```javascript
const data = $input.first().json;
const running = data.status === 'running';
const hasContact = data.contact && data.contact.whatsappId;
const notDone = !data.done;

if (running && hasContact && notDone) {
  const EVO_URL = 'http://72.62.190.12:8080';
  const EVO_INSTANCE = 'TFG';

  // بناء الرسالة الكاملة: ترحيبية + اسم العميل + رسالة أساسية
  let fullMessage = data.message || '';
  if (data.greetingMessage) {
    const namePart = (data.contact.name || '').trim();
    const greetingLine = namePart
      ? data.greetingMessage + ' ' + namePart
      : data.greetingMessage;
    fullMessage = greetingLine + '\n' + fullMessage;
  }

  // حساب تأخير عشوائي بين delayMin و delayMax
  const delayMin = data.delayMin || 15;
  const delayMax = data.delayMax || (data.delaySeconds || 30);
  const actualDelay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;

  let sendUrl, sendBody;
  if (data.imageBase64) {
    // فورمات الصورة المؤكد — mediaMessage wrapper + lowercase image + raw base64
    sendUrl = EVO_URL + '/message/sendMedia/' + EVO_INSTANCE;
    sendBody = JSON.stringify({
      number: data.contact.whatsappId,
      mediaMessage: {
        mediatype: 'image',        // ← lowercase دائماً
        media: data.imageBase64,   // ← raw base64 بدون data URL prefix
        caption: fullMessage
      }
    });
  } else {
    // فورمات النص المؤكد — textMessage wrapper
    sendUrl = EVO_URL + '/message/sendText/' + EVO_INSTANCE;
    sendBody = JSON.stringify({
      number: data.contact.whatsappId,
      textMessage: { text: fullMessage }
    });
  }

  return [{ json: {
    canSend: true,
    sendUrl, sendBody,
    currentIndex: data.currentIndex,
    phone: data.contact.phone,
    delaySeconds: actualDelay
  }}];
}

const allDone = data.done && data.status === 'running';
return [{ json: { canSend: false, allDone, status: data.status } }];
```

### Update State Code
```javascript
const item = $input.first().json;
const success = item.key !== undefined && item.key !== null;
return [{ json: {
  contactStatus: success ? 'sent' : 'failed',
  failedReason: success ? null : (item.message || item.error || 'Send failed'),
  currentIndex: $('Check Status').first().json.currentIndex,
  delaySeconds: $('Check Status').first().json.delaySeconds
}}];
```

### Finalize Code
```javascript
const item = $input.first().json;
if (item.allDone) {
  return [{ json: { action: 'set-status', status: 'completed' } }];
}
return [];
```

### Send Message Node
```
POST ={{ $json.sendUrl }}
Body: ={{ $json.sendBody }}
Headers (keypair): apikey = AmrSecretKey2024, Content-Type = application/json
continueOnFail: true
```

### Update State Body
```
={{ JSON.stringify({"action":"update-after-send","contactStatus":$json.contactStatus,"failedReason":$json.failedReason||""}) }}
```

---

## W5 — Campaign Control
**ID:** `27LfJhVVo4aoA0D7` | **Endpoint:** `POST /webhook/campaign-control`

**Flow:** Webhook → Handle Control (Code) → Write Status (HTTP→W8) → Respond → IF resume → Resume Executor (HTTP→W4)

### Handle Control Code
```javascript
const body = $input.first().json.body || $input.first().json;
const action = body.action;

const validActions = ['pause','resume','stop'];
if (!validActions.includes(action)) {
  return [{ json: { success: false, error: 'Unknown action: '+action, shouldResume: false } }];
}

const statusMap = { pause: 'paused', resume: 'running', stop: 'stopped' };
return [{ json: {
  writePayload: JSON.stringify({ action: 'set-status', status: statusMap[action] }),
  shouldResume: action === 'resume',
  responseMsg: { success: true, status: statusMap[action] }
}}];
```

### Request Body
```json
{ "action": "pause" }   // أو "resume" أو "stop"
```

---

## W6 — Campaign Status
**ID:** `c1wBr8RlOaJNGefL` | **Endpoint:** `GET /webhook/campaign-status`

**Flow:** Webhook → Read State (HTTP→W8 action:read) → Respond

مباشر — يطلب من W8 ويرجع الرد للـ Frontend.

---

## W7 — Export Failed Contacts
**ID:** `izMkdxtu2F5kVcrS` | **Endpoint:** `GET /webhook/campaign-export-failed`

**Flow:** Webhook → Read State (HTTP→W8 action:read) → Build CSV (Code) → Respond

### Build CSV Code
```javascript
const state = $input.first().json;
if (!state.contacts) {
  return [{ json: { csv: 'Phone,Name,Status,Reason\n', count: 0 } }];
}
const failed = state.contacts.filter(c => c.status === 'failed');
const rows = [
  'Phone,Name,Status,Reason',
  ...failed.map(c => [
    c.phone||'',
    (c.name||'').replace(/,/g,' '),
    c.status||'failed',
    (c.failedReason||'').replace(/,/g,' ')
  ].join(','))
];
return [{ json: { csv: rows.join('\n'), count: failed.length } }];
```

---

## W8 — Campaign State Store
**ID:** `E3Y2RaqSFnh1kQUv` | **Endpoint:** `POST /webhook/campaign-state`

**⚠️ الأهم في المشروع** — يخزن كل شيء في `$getWorkflowStaticData('global')`

### State Handler Code (كامل — أحدث إصدار مع greetingMessage + delayMin/Max)
```javascript
const staticData = $getWorkflowStaticData('global');
const body = $input.first().json.body || $input.first().json;
const action = body.action;

if (action === 'read') {
  const s = staticData.campaignState || {
    status:'idle', total:0, currentIndex:0,
    sentCount:0, failedCount:0, contacts:[], campaignId:null
  };
  const preview = s.contacts ? s.contacts.slice(0, 500).map(c => ({
    phone: c.phone, name: c.name||'', status: c.status,
    sentAt: c.sentAt||null, failedReason: c.failedReason||null
  })) : [];
  const total = s.contacts ? s.contacts.length : 0;
  const pct = total > 0 ? Math.round((s.currentIndex / total)*100) : 0;
  const remaining = total - (s.currentIndex||0);
  const avgDelay = s.delayMin && s.delayMax
    ? (s.delayMin + s.delayMax) / 2
    : (s.delaySeconds || 30);
  const estMins = Math.ceil(remaining * avgDelay / 60);
  return [{ json: {
    campaignId: s.campaignId, status: s.status, total,
    currentIndex: s.currentIndex||0,
    sentCount: s.sentCount||0, failedCount: s.failedCount||0,
    percentComplete: pct, estimatedMinutesRemaining: estMins,
    startedAt: s.startedAt||null, pausedAt: s.pausedAt||null,
    completedAt: s.completedAt||null, lastUpdated: s.lastUpdated||null,
    contacts: preview
  }}];

} else if (action === 'read-current') {
  const s = staticData.campaignState || {};
  const idx = s.currentIndex || 0;
  const contacts = s.contacts || [];
  const contact = contacts[idx] || null;
  const done = idx >= contacts.length;
  return [{ json: {
    status: s.status || 'idle',
    contact,
    message: s.message || '',
    greetingMessage: s.greetingMessage || '',
    imageBase64: s.imageBase64 || null,
    delayMin: s.delayMin || 15,
    delayMax: s.delayMax || (s.delaySeconds || 30),
    delaySeconds: s.delaySeconds || 30,
    currentIndex: idx,
    total: contacts.length,
    done
  }}];

} else if (action === 'write') {
  staticData.campaignState = body.data;
  return [{ json: { success: true } }];

} else if (action === 'update-after-send') {
  const s = staticData.campaignState || {};
  const idx = s.currentIndex || 0;
  if (s.contacts && s.contacts[idx]) {
    s.contacts[idx].status = body.contactStatus;
    if (body.contactStatus === 'sent') {
      s.contacts[idx].sentAt = new Date().toISOString();
      s.sentCount = (s.sentCount||0) + 1;
    } else {
      s.contacts[idx].failedReason = body.failedReason || 'Send failed';
      s.failedCount = (s.failedCount||0) + 1;
    }
  }
  s.currentIndex = idx + 1;
  s.lastUpdated = new Date().toISOString();
  staticData.campaignState = s;
  return [{ json: { success: true, nextIndex: s.currentIndex } }];

} else if (action === 'set-status') {
  const s = staticData.campaignState || {};
  s.status = body.status;
  if (body.status === 'paused') s.pausedAt = new Date().toISOString();
  if (body.status === 'running') s.pausedAt = null;
  if (['completed','stopped'].includes(body.status)) s.completedAt = new Date().toISOString();
  s.lastUpdated = new Date().toISOString();
  staticData.campaignState = s;
  return [{ json: { success: true, status: s.status } }];

} else {
  return [{ json: { error: 'Unknown action: '+(action||'none') } }];
}
```
