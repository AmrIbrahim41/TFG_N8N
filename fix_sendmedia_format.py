#!/usr/bin/env python3
"""Fix W4 sendMedia: correct Evolution API v2 format confirmed by direct testing.
   mediaMessage wrapper + mediatype='image' (lowercase) + raw base64 media."""
import requests, sys
sys.stdout.reconfigure(encoding='utf-8')

N8N_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwODE0MmI0OS00M2IyLTQ5M2EtYTBlYS0xMDYwNWU3YzYzOGUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMzVmYWFjNGQtZGUzZS00NzkxLWE1MmEtYmMxOTY0ZWI1ZDBiIiwiaWF0IjoxNzc0ODkxNjQzfQ.u7g3rXOJ7XELFRLd9FbhmbaXairbCaM2J_Ulg1mLMtA"
N8N_URL = "https://n8n.srv1532138.hstgr.cloud"
HEADERS = {"X-N8N-API-KEY": N8N_KEY, "Content-Type": "application/json"}
W4_ID = "m86FaORgXpvwpWQO"

NEW_CHECK_CODE = r"""
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
    // Confirmed working format: mediaMessage wrapper, lowercase 'image', raw base64 (no data URL prefix)
    sendUrl = EVO_URL + '/message/sendMedia/' + EVO_INSTANCE;
    sendBody = JSON.stringify({
      number: data.contact.whatsappId,
      mediaMessage: {
        mediatype: 'image',
        media: data.imageBase64,
        caption: fullMessage
      }
    });
  } else {
    // Text only
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

r = requests.get(f"{N8N_URL}/api/v1/workflows/{W4_ID}", headers=HEADERS)
wf = r.json()

for node in wf["nodes"]:
    if node["name"] == "Check Status":
        node["parameters"]["jsCode"] = NEW_CHECK_CODE
        print("Fixed Check Status node")
        break

payload = {
    "name": wf["name"], "nodes": wf["nodes"],
    "connections": wf["connections"], "settings": wf["settings"],
    "staticData": wf.get("staticData")
}
r2 = requests.put(f"{N8N_URL}/api/v1/workflows/{W4_ID}", headers=HEADERS, json=payload)
print(f"Update: {r2.status_code}")

r3 = requests.post(f"{N8N_URL}/api/v1/workflows/{W4_ID}/activate", headers=HEADERS)
print(f"Active: {r3.json().get('active')}")
