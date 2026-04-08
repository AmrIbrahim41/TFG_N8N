#!/usr/bin/env python3
import sys, re, openpyxl, requests, json, time
sys.stdout.reconfigure(encoding='utf-8')

N8N_URL = "https://n8n.srv1532138.hstgr.cloud"

def normalize(raw):
    if not raw: return None
    d = re.sub(r'\D', '', str(raw))
    if d.startswith('002') and len(d)==14: d = d[1:]
    if d.startswith('020') and len(d)==13: d = d[1:]
    if d.startswith('01') and len(d)==11: d = '2' + d
    if re.match(r'^20[0-9]{10}$', d): return d
    return None

# Parse Excel
wb = openpyxl.load_workbook(r'C:\Users\amrhi\Desktop\test.xlsx')
ws = wb.active
headers = [str(c.value) for c in next(ws.iter_rows(min_row=1, max_row=1))]

phone_col = next((h for h in headers if 'موبايل' in h and 'اخر' not in h), None)
name_col  = next((h for h in headers if h in ['العضو','الاسم','اسم']), None)
ph_idx = headers.index(phone_col)
nm_idx = headers.index(name_col) if name_col else None

contacts = []
for row in ws.iter_rows(min_row=2, values_only=True):
    raw_phone = row[ph_idx]
    norm = normalize(raw_phone)
    if norm:
        contacts.append({
            "phone": str(raw_phone),
            "name": str(row[nm_idx]).strip() if nm_idx is not None and row[nm_idx] else ""
        })

print(f"جهات الاتصال: {len(contacts)}")
for c in contacts:
    print(f"  {c['name']} → {c['phone']}")

# Send campaign
payload = {
    "contacts": contacts,
    "message": "مرحباً 👋 هذه رسالة تجريبية من TFG WhatsApp Sender.\nسيتم التواصل معك قريباً.",
    "delaySeconds": 20
}

print("\nبدء الإرسال...")
r = requests.post(f"{N8N_URL}/webhook/campaign-start",
    json=payload, timeout=20)
print(f"Response: {r.status_code} — {r.text}")

# Poll status
print("\nمراقبة الحالة...")
for _ in range(20):
    time.sleep(8)
    r = requests.get(f"{N8N_URL}/webhook/campaign-status", timeout=15)
    s = r.json()
    print(f"  [{s['status']}] {s['currentIndex']}/{s['total']} | مُرسل={s['sentCount']} فاشل={s['failedCount']}")
    if s['status'] in ('completed','stopped'): break

print("\nتفاصيل جهات الاتصال:")
for c in s.get('contacts',[]):
    print(f"  {c['phone']} ({c['name']}) → {c['status']} {c.get('failedReason') or ''}")
