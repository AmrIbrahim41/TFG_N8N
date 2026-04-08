#!/usr/bin/env python3
"""
Fix: Add greeting message + random delay range to W3, W4, W8.
"""
import requests, sys
sys.stdout.reconfigure(encoding='utf-8')

N8N_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwODE0MmI0OS00M2IyLTQ5M2EtYTBlYS0xMDYwNWU3YzYzOGUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMzVmYWFjNGQtZGUzZS00NzkxLWE1MmEtYmMxOTY0ZWI1ZDBiIiwiaWF0IjoxNzc0ODkxNjQzfQ.u7g3rXOJ7XELFRLd9FbhmbaXairbCaM2J_Ulg1mLMtA"
N8N_URL = "https://n8n.srv1532138.hstgr.cloud"
HEADERS = {"X-N8N-API-KEY": N8N_KEY, "Content-Type": "application/json"}

W3_ID = "61u8nDuYlLFXbuc8"
W4_ID = "m86FaORgXpvwpWQO"
W8_ID = "E3Y2RaqSFnh1kQUv"

# ─────────────────────────────────────────────
# W3 — Init Campaign Code (updated)
# ─────────────────────────────────────────────
W3_INIT_CODE = r"""
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
const limit = body.limit ? Math.min(body.limit, rawContacts.length) : rawContacts.length;
const toProcess = rawContacts.slice(0, limit);

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
"""

# ─────────────────────────────────────────────
# W4 — Check Status Code (updated: greeting + random delay)
# ─────────────────────────────────────────────
W4_CHECK_CODE = r"""
const data = $input.first().json;
const running = data.status === 'running';
const hasContact = data.contact && data.contact.whatsappId;
const notDone = !data.done;

if (running && hasContact && notDone) {
  const EVO_URL = 'http://72.62.190.12:8080';
  const EVO_INSTANCE = 'TFG';

  // Build full message: greeting + name + main message
  let fullMessage = data.message || '';
  if (data.greetingMessage) {
    const namePart = (data.contact.name || '').trim();
    const greetingLine = namePart
      ? data.greetingMessage + ' ' + namePart
      : data.greetingMessage;
    fullMessage = greetingLine + '\n' + fullMessage;
  }

  // Calculate random delay between delayMin and delayMax
  const delayMin = data.delayMin || 15;
  const delayMax = data.delayMax || (data.delaySeconds || 30);
  const actualDelay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;

  let sendUrl, sendBody;
  if (data.imageBase64) {
    sendUrl = EVO_URL + '/message/sendMedia/' + EVO_INSTANCE;
    sendBody = JSON.stringify({
      number: data.contact.whatsappId,
      mediatype: 'image',
      media: data.imageBase64,
      caption: fullMessage
    });
  } else {
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
"""

# ─────────────────────────────────────────────
# W8 — State Handler Code (updated: greetingMessage + delayMin/Max in read-current)
# ─────────────────────────────────────────────
W8_STATE_CODE = r"""
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
"""

def update_workflow(wf_id, node_name, new_code, label):
    r = requests.get(f"{N8N_URL}/api/v1/workflows/{wf_id}", headers=HEADERS)
    if r.status_code != 200:
        print(f"[FAILED] GET {wf_id}: {r.status_code}")
        return False
    wf = r.json()
    found = False
    for node in wf["nodes"]:
        if node["name"] == node_name:
            node["parameters"]["jsCode"] = new_code
            found = True
            break
    if not found:
        print(f"[FAILED] Node '{node_name}' not found in {wf_id}")
        return False

    payload = {
        "name": wf["name"],
        "nodes": wf["nodes"],
        "connections": wf["connections"],
        "settings": wf["settings"],
        "staticData": wf.get("staticData")
    }
    r2 = requests.put(f"{N8N_URL}/api/v1/workflows/{wf_id}", headers=HEADERS, json=payload)
    if r2.status_code not in (200, 201):
        print(f"[FAILED] PUT {wf_id}: {r2.status_code} — {r2.text[:200]}")
        return False

    r3 = requests.post(f"{N8N_URL}/api/v1/workflows/{wf_id}/activate", headers=HEADERS)
    active = r3.json().get("active", False)
    print(f"{'[active]' if active else '[FAILED activate]'} {label}")
    return active

print("== Applying: Greeting Message + Random Delay ==\n")
update_workflow(W3_ID, "Init Campaign",  W3_INIT_CODE,  "W3 Init Campaign Code")
update_workflow(W4_ID, "Check Status",   W4_CHECK_CODE, "W4 Check Status Code")
update_workflow(W8_ID, "State Handler",  W8_STATE_CODE, "W8 State Handler Code")
print("\nDone.")
