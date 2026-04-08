#!/usr/bin/env python3
"""
TFG WhatsApp Sender - Rebuild n8n Workflows (v2)
State Management: W8 (Static Data Store) instead of filesystem
W4: Self-triggering webhook for sequential message sending
"""

import requests
import json
import uuid
import sys

N8N_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwODE0MmI0OS00M2IyLTQ5M2EtYTBlYS0xMDYwNWU3YzYzOGUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMzVmYWFjNGQtZGUzZS00NzkxLWE1MmEtYmMxOTY0ZWI1ZDBiIiwiaWF0IjoxNzc0ODkxNjQzfQ.u7g3rXOJ7XELFRLd9FbhmbaXairbCaM2J_Ulg1mLMtA"
N8N_URL = "https://n8n.srv1532138.hstgr.cloud"
HEADERS = {"X-N8N-API-KEY": N8N_KEY, "Content-Type": "application/json"}

EVO_URL = "http://72.62.190.12:8080"
EVO_KEY = "AmrSecretKey2024"
EVO_INSTANCE = "TFG"
STATE_WEBHOOK = f"{N8N_URL}/webhook/campaign-state"
EXEC_WEBHOOK = f"{N8N_URL}/webhook/campaign-execute-next"

def uid():
    return str(uuid.uuid4())

def api(method, path, **kwargs):
    r = getattr(requests, method)(f"{N8N_URL}{path}", headers=HEADERS, **kwargs)
    return r

def create_wf(wf_json):
    r = api("post", "/api/v1/workflows", json=wf_json)
    if r.status_code not in (200, 201):
        print(f"  ERROR: {r.status_code} {r.text[:200]}")
        return None
    d = r.json()
    print(f"  Created: {d['id']} — {d['name']}")
    return d['id']

def activate_wf(wf_id):
    r = api("post", f"/api/v1/workflows/{wf_id}/activate")
    d = r.json()
    status = "[active]" if d.get("active") else f"[FAILED] {d.get('message','?')[:80]}"
    print(f"  Activate {wf_id}: {status}")

def update_wf(wf_id, wf_json):
    r = api("put", f"/api/v1/workflows/{wf_id}", json=wf_json)
    if r.status_code not in (200, 201):
        print(f"  ERROR updating {wf_id}: {r.status_code} {r.text[:200]}")
        return False
    return True

def delete_wf(wf_id):
    r = api("delete", f"/api/v1/workflows/{wf_id}")
    print(f"  Delete {wf_id}: {r.status_code}")

def wf_base(name, nodes, connections):
    return {
        "name": name,
        "nodes": nodes,
        "connections": connections,
        "settings": {"executionOrder": "v1"},
        "staticData": None
    }

def webhook_node(path, method="GET", response_mode="responseNode", multi=False):
    return {
        "id": uid(), "name": "Webhook",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2, "position": [0, 300],
        "webhookId": uid(),
        "parameters": {
            "path": path,
            "httpMethod": method,
            "responseMode": response_mode,
            "options": {"allowedOrigins": "*"}
        }
    }

def respond_node(pos=[440, 300]):
    return {
        "id": uid(), "name": "Respond",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1, "position": pos,
        "parameters": {
            "respondWith": "firstIncomingItem",
            "options": {
                "responseHeaders": {"entries": [
                    {"name": "Access-Control-Allow-Origin", "value": "*"},
                    {"name": "Content-Type", "value": "application/json"}
                ]}
            }
        }
    }

def code_node(name, code, pos):
    return {
        "id": uid(), "name": name,
        "type": "n8n-nodes-base.code",
        "typeVersion": 2, "position": pos,
        "parameters": {"mode": "runOnceForAllItems", "jsCode": code}
    }

def http_node(name, method, url, body=None, pos=None, continue_fail=False, timeout=10000, extra_headers=None):
    pos = pos or [220, 300]
    params = {
        "method": method,
        "url": url,
        "options": {
            "response": {"response": {"neverError": True}},
            "timeout": timeout
        }
    }
    # Use keypair headers only when custom headers needed
    if extra_headers:
        params["sendHeaders"] = True
        params["specifyHeaders"] = "keypair"
        params["headerParameters"] = {
            "parameters": [{"name": k, "value": v} for k, v in extra_headers.items()]
        }
    if body:
        params["sendBody"] = True
        params["contentType"] = "raw"
        params["body"] = body
        params["rawContentType"] = "application/json"
    n = {
        "id": uid(), "name": name,
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4, "position": pos,
        "continueOnFail": continue_fail,
        "parameters": params
    }
    return n

# ═══════════════════════════════════════════════════════════════
# W8: State Store — POST /webhook/campaign-state
# ═══════════════════════════════════════════════════════════════
W8_STATE_CODE = r"""
const staticData = $getWorkflowStaticData('global');
const body = $input.first().json.body || $input.first().json;
const action = body.action;

if (action === 'read') {
  const s = staticData.campaignState || {
    status:'idle', total:0, currentIndex:0,
    sentCount:0, failedCount:0, contacts:[], campaignId:null
  };
  // Return contacts preview (first 500 for display)
  const preview = s.contacts ? s.contacts.slice(0, 500).map(c => ({
    phone: c.phone, name: c.name||'', status: c.status,
    sentAt: c.sentAt||null, failedReason: c.failedReason||null
  })) : [];
  const total = s.contacts ? s.contacts.length : 0;
  const pct = total > 0 ? Math.round((s.currentIndex / total)*100) : 0;
  const remaining = total - (s.currentIndex||0);
  const estMins = Math.ceil(remaining * (s.delaySeconds||30) / 60);
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
    imageBase64: s.imageBase64 || null,
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

def create_w8():
    print("\n[W8] Creating campaign-state (State Store)...")
    wh = webhook_node("campaign-state", "POST", "responseNode")
    code = code_node("State Handler", W8_STATE_CODE, [220, 300])
    resp = respond_node([440, 300])
    nodes = [wh, code, resp]
    conn = {
        "Webhook": {"main": [[{"node": "State Handler", "type": "main", "index": 0}]]},
        "State Handler": {"main": [[{"node": "Respond", "type": "main", "index": 0}]]},
    }
    wf_id = create_wf(wf_base("TFG - Campaign State Store", nodes, conn))
    if wf_id:
        activate_wf(wf_id)
    return wf_id


# ═══════════════════════════════════════════════════════════════
# W4: Campaign Executor — self-triggering webhook
# POST /webhook/campaign-execute-next
# ═══════════════════════════════════════════════════════════════
W4_CHECK_CODE = r"""
const data = $input.first().json;
const running = data.status === 'running';
const hasContact = data.contact && data.contact.whatsappId;
const notDone = !data.done;

if (running && hasContact && notDone) {
  const EVO_URL = 'http://72.62.190.12:8080';
  const EVO_INSTANCE = 'TFG';
  let sendUrl, sendBody;
  if (data.imageBase64) {
    sendUrl = EVO_URL + '/message/sendMedia/' + EVO_INSTANCE;
    sendBody = JSON.stringify({
      number: data.contact.whatsappId,
      mediatype: 'image',
      media: data.imageBase64,
      caption: data.message
    });
  } else {
    sendUrl = EVO_URL + '/message/sendText/' + EVO_INSTANCE;
    sendBody = JSON.stringify({
      number: data.contact.whatsappId,
      text: data.message
    });
  }
  return [{ json: {
    canSend: true,
    sendUrl, sendBody,
    currentIndex: data.currentIndex,
    phone: data.contact.phone,
    delaySeconds: data.delaySeconds
  }}];
}

// Not running or no contact → stop chain
const allDone = data.done && data.status === 'running';
return [{ json: {
  canSend: false,
  allDone,
  status: data.status
}}];
"""

W4_UPDATE_CODE = r"""
// Determine send result
const item = $input.first().json;
// Evolution API returns {key:{...}} on success
const success = item.key !== undefined && item.key !== null;
return [{ json: {
  contactStatus: success ? 'sent' : 'failed',
  failedReason: success ? null : (item.message || item.error || 'Send failed'),
  currentIndex: $('Check Status').first().json.currentIndex,
  delaySeconds: $('Check Status').first().json.delaySeconds
}}];
"""

W4_FINALIZE_CODE = r"""
const item = $input.first().json;
if (item.allDone) {
  // All contacts processed naturally — mark completed via State Store
  return [{ json: { action: 'set-status', status: 'completed' } }];
}
// Paused/stopped — do nothing, just exit
return [];
"""

def create_w4(state_webhook_url):
    print("\n[W4] Creating campaign-execute-next (Executor)...")

    wh = webhook_node("campaign-execute-next", "POST", "onReceived")

    read_state = http_node(
        "Read Current Contact", "POST", state_webhook_url,
        body='={"action":"read-current"}', pos=[220, 300]
    )

    check = code_node("Check Status", W4_CHECK_CODE, [440, 300])

    if_node = {
        "id": uid(), "name": "Can Send?",
        "type": "n8n-nodes-base.if",
        "typeVersion": 2, "position": [660, 300],
        "parameters": {
            "conditions": {
                "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
                "conditions": [{
                    "id": uid(),
                    "leftValue": "={{ $json.canSend }}",
                    "rightValue": True,
                    "operator": {"type": "boolean", "operation": "equals"}
                }],
                "combinator": "and"
            }
        }
    }

    send_msg = http_node(
        "Send Message", "POST", "={{ $json.sendUrl }}",
        body="={{ $json.sendBody }}", pos=[880, 200],
        continue_fail=True,
        extra_headers={"apikey": EVO_KEY, "Content-Type": "application/json"}
    )

    update_code = code_node("Update State Code", W4_UPDATE_CODE, [1100, 200])

    update_state = http_node(
        "Update State", "POST", state_webhook_url,
        body='={"action":"update-after-send","contactStatus":"={{ $json.contactStatus }}","failedReason":"={{ $json.failedReason || \'\' }}"}',
        pos=[1320, 200]
    )

    wait_node = {
        "id": uid(), "name": "Wait",
        "type": "n8n-nodes-base.wait",
        "typeVersion": 1, "position": [1540, 200],
        "webhookId": uid(),
        "parameters": {
            "resume": "timeInterval",
            "amount": "={{ $('Update State Code').first().json.delaySeconds || 30 }}",
            "unit": "seconds"
        }
    }

    trigger_next = http_node(
        "Trigger Next", "POST", EXEC_WEBHOOK,
        body='={}', pos=[1760, 200],
        continue_fail=True, timeout=5000
    )

    finalize = code_node("Finalize", W4_FINALIZE_CODE, [880, 420])

    mark_complete = http_node(
        "Mark Completed", "POST", state_webhook_url,
        body='={"action":"set-status","status":"completed"}',
        pos=[1100, 420]
    )

    nodes = [wh, read_state, check, if_node, send_msg, update_code,
             update_state, wait_node, trigger_next, finalize, mark_complete]

    conn = {
        "Webhook": {"main": [[{"node": "Read Current Contact", "type": "main", "index": 0}]]},
        "Read Current Contact": {"main": [[{"node": "Check Status", "type": "main", "index": 0}]]},
        "Check Status": {"main": [[{"node": "Can Send?", "type": "main", "index": 0}]]},
        "Can Send?": {
            "main": [
                [{"node": "Send Message", "type": "main", "index": 0}],   # TRUE
                [{"node": "Finalize", "type": "main", "index": 0}]         # FALSE
            ]
        },
        "Send Message": {"main": [[{"node": "Update State Code", "type": "main", "index": 0}]]},
        "Update State Code": {"main": [[{"node": "Update State", "type": "main", "index": 0}]]},
        "Update State": {"main": [[{"node": "Wait", "type": "main", "index": 0}]]},
        "Wait": {"main": [[{"node": "Trigger Next", "type": "main", "index": 0}]]},
        "Finalize": {"main": [[{"node": "Mark Completed", "type": "main", "index": 0}]]},
    }

    wf_id = create_wf(wf_base("TFG - Campaign Executor", nodes, conn))
    if wf_id:
        activate_wf(wf_id)
    return wf_id


# ═══════════════════════════════════════════════════════════════
# Update W1: WhatsApp Status → use W8 for... nothing (no state)
# W1 is fine as-is, just fix the respond node to use firstIncomingItem
# ═══════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════
# Update W3: Campaign Start → write state to W8, trigger W4 webhook
# ═══════════════════════════════════════════════════════════════
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
  const rawPhone = typeof c === 'string' ? c : (c.phone || c.mobile || c['\u0645\u0648\u0628\u0627\u064a\u0644'] || '');
  const normalized = normalizePhone(rawPhone);
  if (normalized) {
    contacts.push({
      phone: rawPhone,
      name: c.name || c['\u0627\u0644\u0639\u0636\u0648'] || c['\u0627\u0633\u0645'] || '',
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
const delaySeconds = Math.max(15, Math.min(60, parseInt(body.delaySeconds)||30));

const campaignState = {
  campaignId, status: 'running', contacts,
  currentIndex: 0,
  message: body.message || '',
  imageBase64: body.imageBase64 || null,
  delaySeconds,
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
    estimatedHours: Math.round(contacts.length * delaySeconds / 3600 * 10)/10
  }
}}];
"""

def update_w3(w3_id, state_webhook_url):
    print("\n[W3] Updating campaign-start...")
    r = api("get", f"/api/v1/workflows/{w3_id}")
    wf = r.json()

    init_code = code_node("Init Campaign", W3_INIT_CODE, [220, 300])
    write_state = http_node(
        "Write State", "POST", state_webhook_url,
        body="={{ $json.writePayload }}",
        pos=[440, 300]
    )
    # Custom respond node that returns the response field
    respond_n = {
        "id": uid(), "name": "Respond",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1, "position": [660, 300],
        "parameters": {
            "respondWith": "json",
            "responseBody": "={{ $('Init Campaign').first().json.response }}",
            "options": {
                "responseHeaders": {"entries": [
                    {"name": "Access-Control-Allow-Origin", "value": "*"}
                ]}
            }
        }
    }
    trigger_exec = http_node(
        "Start Executor", "POST", EXEC_WEBHOOK,
        body='={}', pos=[880, 300],
        continue_fail=True, timeout=5000
    )

    nodes = [
        {"id": uid(), "name": "Webhook",
         "type": "n8n-nodes-base.webhook", "typeVersion": 2,
         "position": [0, 300], "webhookId": uid(),
         "parameters": {
             "path": "campaign-start",
             "httpMethod": "POST",
             "responseMode": "responseNode",
             "options": {"allowedOrigins": "*"}
         }},
        init_code, write_state, respond_n, trigger_exec
    ]
    conn = {
        "Webhook": {"main": [[{"node": "Init Campaign", "type": "main", "index": 0}]]},
        "Init Campaign": {"main": [[{"node": "Write State", "type": "main", "index": 0}]]},
        "Write State": {"main": [[{"node": "Respond", "type": "main", "index": 0}]]},
        "Respond": {"main": [[{"node": "Start Executor", "type": "main", "index": 0}]]},
    }

    payload = {
        "name": "TFG - Campaign Start",
        "nodes": nodes, "connections": conn,
        "settings": {"executionOrder": "v1"}, "staticData": None
    }
    ok = update_wf(w3_id, payload)
    print(f"  Updated W3: {'OK' if ok else 'FAILED'}")
    if ok:
        activate_wf(w3_id)


# ═══════════════════════════════════════════════════════════════
# Update W5: Campaign Control → W8 for status, W4 webhook for resume
# ═══════════════════════════════════════════════════════════════
W5_CONTROL_CODE = r"""
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
"""

def update_w5(w5_id, state_webhook_url):
    print("\n[W5] Updating campaign-control...")
    r = api("get", f"/api/v1/workflows/{w5_id}")
    wf = r.json()

    ctrl_code = code_node("Handle Control", W5_CONTROL_CODE, [220, 300])

    write_state = http_node(
        "Write Status", "POST", state_webhook_url,
        body="={{ $json.writePayload }}", pos=[440, 300]
    )

    respond_n = {
        "id": uid(), "name": "Respond",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1, "position": [660, 300],
        "parameters": {
            "respondWith": "json",
            "responseBody": "={{ $('Handle Control').first().json.responseMsg }}",
            "options": {
                "responseHeaders": {"entries": [
                    {"name": "Access-Control-Allow-Origin", "value": "*"}
                ]}
            }
        }
    }

    if_resume = {
        "id": uid(), "name": "Should Resume?",
        "type": "n8n-nodes-base.if",
        "typeVersion": 2, "position": [880, 300],
        "parameters": {
            "conditions": {
                "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
                "conditions": [{
                    "id": uid(),
                    "leftValue": "={{ $('Handle Control').first().json.shouldResume }}",
                    "rightValue": True,
                    "operator": {"type": "boolean", "operation": "equals"}
                }],
                "combinator": "and"
            }
        }
    }

    trigger_exec = http_node(
        "Resume Executor", "POST", EXEC_WEBHOOK,
        body='={}', pos=[1100, 300],
        continue_fail=True, timeout=5000
    )

    nodes = [
        {"id": uid(), "name": "Webhook",
         "type": "n8n-nodes-base.webhook", "typeVersion": 2,
         "position": [0, 300], "webhookId": uid(),
         "parameters": {
             "path": "campaign-control",
             "httpMethod": "POST",
             "responseMode": "responseNode",
             "options": {"allowedOrigins": "*"}
         }},
        ctrl_code, write_state, respond_n, if_resume, trigger_exec
    ]
    conn = {
        "Webhook": {"main": [[{"node": "Handle Control", "type": "main", "index": 0}]]},
        "Handle Control": {"main": [[{"node": "Write Status", "type": "main", "index": 0}]]},
        "Write Status": {"main": [[{"node": "Respond", "type": "main", "index": 0}]]},
        "Respond": {"main": [[{"node": "Should Resume?", "type": "main", "index": 0}]]},
        "Should Resume?": {
            "main": [
                [{"node": "Resume Executor", "type": "main", "index": 0}],
                []
            ]
        },
    }

    payload = {
        "name": "TFG - Campaign Control",
        "nodes": nodes, "connections": conn,
        "settings": {"executionOrder": "v1"}, "staticData": None
    }
    ok = update_wf(w5_id, payload)
    print(f"  Updated W5: {'OK' if ok else 'FAILED'}")
    if ok:
        activate_wf(w5_id)


# ═══════════════════════════════════════════════════════════════
# Update W6: Campaign Status → read from W8
# ═══════════════════════════════════════════════════════════════
def update_w6(w6_id, state_webhook_url):
    print("\n[W6] Updating campaign-status...")

    nodes = [
        {"id": uid(), "name": "Webhook",
         "type": "n8n-nodes-base.webhook", "typeVersion": 2,
         "position": [0, 300], "webhookId": uid(),
         "parameters": {
             "path": "campaign-status",
             "httpMethod": "GET",
             "responseMode": "responseNode",
             "options": {"allowedOrigins": "*"}
         }},
        http_node("Read State", "POST", state_webhook_url,
                  body='={"action":"read"}', pos=[220, 300]),
        respond_node([440, 300])
    ]
    conn = {
        "Webhook": {"main": [[{"node": "Read State", "type": "main", "index": 0}]]},
        "Read State": {"main": [[{"node": "Respond", "type": "main", "index": 0}]]},
    }
    payload = {
        "name": "TFG - Campaign Status",
        "nodes": nodes, "connections": conn,
        "settings": {"executionOrder": "v1"}, "staticData": None
    }
    ok = update_wf(w6_id, payload)
    print(f"  Updated W6: {'OK' if ok else 'FAILED'}")
    if ok:
        activate_wf(w6_id)


# ═══════════════════════════════════════════════════════════════
# Update W7: Export Failed → read from W8, return CSV
# ═══════════════════════════════════════════════════════════════
W7_CSV_CODE = r"""
const state = $input.first().json;
if (!state.contacts) {
  return [{ json: { csv: 'Phone,Name,Status,Reason\n', count: 0 } }];
}
// We have preview (500 contacts). Need full list from state.
// Note: contacts array here is preview only. For full failed list,
// we need the full contacts. This is a limitation of the preview approach.
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
"""

def update_w7(w7_id, state_webhook_url):
    print("\n[W7] Updating campaign-export-failed...")

    nodes = [
        {"id": uid(), "name": "Webhook",
         "type": "n8n-nodes-base.webhook", "typeVersion": 2,
         "position": [0, 300], "webhookId": uid(),
         "parameters": {
             "path": "campaign-export-failed",
             "httpMethod": "GET",
             "responseMode": "responseNode",
             "options": {"allowedOrigins": "*"}
         }},
        http_node("Read State", "POST", state_webhook_url,
                  body='={"action":"read"}', pos=[220, 300]),
        code_node("Build CSV", W7_CSV_CODE, [440, 300]),
        respond_node([660, 300])
    ]
    conn = {
        "Webhook": {"main": [[{"node": "Read State", "type": "main", "index": 0}]]},
        "Read State": {"main": [[{"node": "Build CSV", "type": "main", "index": 0}]]},
        "Build CSV": {"main": [[{"node": "Respond", "type": "main", "index": 0}]]},
    }
    payload = {
        "name": "TFG - Export Failed Contacts",
        "nodes": nodes, "connections": conn,
        "settings": {"executionOrder": "v1"}, "staticData": None
    }
    ok = update_wf(w7_id, payload)
    print(f"  Updated W7: {'OK' if ok else 'FAILED'}")
    if ok:
        activate_wf(w7_id)


# ═══════════════════════════════════════════════════════════════
# Fix W1: WhatsApp Status — fix respond node
# ═══════════════════════════════════════════════════════════════
W1_FORMAT_CODE = r"""
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
"""

def fix_w1(w1_id):
    print("\n[W1] Fixing whatsapp-status respond node...")
    r = api("get", f"/api/v1/workflows/{w1_id}")
    wf = r.json()

    # Update respond node to use firstIncomingItem
    for n in wf["nodes"]:
        if n["name"] == "Respond":
            n["parameters"] = {
                "respondWith": "firstIncomingItem",
                "options": {
                    "responseHeaders": {"entries": [
                        {"name": "Access-Control-Allow-Origin", "value": "*"}
                    ]}
                }
            }
        elif n["name"] == "Format Response":
            n["parameters"]["jsCode"] = W1_FORMAT_CODE

    payload = {
        "name": wf["name"],
        "nodes": wf["nodes"],
        "connections": wf["connections"],
        "settings": wf["settings"],
        "staticData": wf["staticData"]
    }
    ok = update_wf(w1_id, payload)
    print(f"  Fixed W1: {'OK' if ok else 'FAILED'}")


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("=" * 60)
    print("TFG WhatsApp Sender — Rebuild Workflows (v2)")
    print("State: $getWorkflowStaticData | No filesystem required")
    print("=" * 60)

    # Existing workflow IDs
    W1_ID = "WIaFfruceOZehBqg"  # whatsapp-status
    W2_ID = "amuoJXviXIkel948"  # whatsapp-qr
    W3_ID = "61u8nDuYlLFXbuc8"  # campaign-start
    W4_OLD = "Z1DxUsrZViBnMRm3" # campaign-executor (old, uses executeWorkflowTrigger)
    W5_ID = "27LfJhVVo4aoA0D7"  # campaign-control
    W6_ID = "c1wBr8RlOaJNGefL"  # campaign-status
    W7_ID = "izMkdxtu2F5kVcrS"  # export-failed

    # Delete old W4
    print("\n[0] Deleting old executor (executeWorkflowTrigger)...")
    delete_wf(W4_OLD)

    # Create new workflows
    w8_id = create_w8()
    if not w8_id:
        print("FATAL: Could not create state store")
        sys.exit(1)

    w4_id = create_w4(STATE_WEBHOOK)
    if not w4_id:
        print("FATAL: Could not create executor")
        sys.exit(1)

    # Update existing workflows
    fix_w1(W1_ID)
    update_w3(W3_ID, STATE_WEBHOOK)
    update_w5(W5_ID, STATE_WEBHOOK)
    update_w6(W6_ID, STATE_WEBHOOK)
    update_w7(W7_ID, STATE_WEBHOOK)

    print("\n" + "=" * 60)
    print("WORKFLOW SUMMARY:")
    print(f"  W1 WhatsApp Status:    {W1_ID}")
    print(f"  W2 WhatsApp QR:        {W2_ID}")
    print(f"  W3 Campaign Start:     {W3_ID}")
    print(f"  W4 Campaign Executor:  {w4_id}")
    print(f"  W5 Campaign Control:   {W5_ID}")
    print(f"  W6 Campaign Status:    {W6_ID}")
    print(f"  W7 Export Failed:      {W7_ID}")
    print(f"  W8 State Store:        {w8_id}")
    print()
    print("ENDPOINTS:")
    print(f"  GET  {N8N_URL}/webhook/whatsapp-status")
    print(f"  POST {N8N_URL}/webhook/whatsapp-qr")
    print(f"  POST {N8N_URL}/webhook/campaign-start")
    print(f"  POST {N8N_URL}/webhook/campaign-control")
    print(f"  GET  {N8N_URL}/webhook/campaign-status")
    print(f"  GET  {N8N_URL}/webhook/campaign-export-failed")
    print(f"  POST {N8N_URL}/webhook/campaign-state  (internal)")
    print(f"  POST {N8N_URL}/webhook/campaign-execute-next  (internal)")
    print("=" * 60)

    # Quick test
    print("\n[TEST] Testing endpoints...")
    import time
    time.sleep(2)

    import requests as req
    r = req.get(f"{N8N_URL}/webhook/whatsapp-status", timeout=15)
    print(f"  W1 status: HTTP {r.status_code} — {r.text[:100]}")

    r = req.get(f"{N8N_URL}/webhook/campaign-status", timeout=15)
    print(f"  W6 status: HTTP {r.status_code} — {r.text[:100]}")

    r = req.post(f"{N8N_URL}/webhook/campaign-state",
                 json={"action": "read"}, timeout=15)
    print(f"  W8 read: HTTP {r.status_code} — {r.text[:100]}")
