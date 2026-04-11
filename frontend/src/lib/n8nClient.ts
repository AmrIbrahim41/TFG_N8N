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
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  if (!text || text.trim() === "") return {} as T;
  try {
    return JSON.parse(text);
  } catch {
    return {} as T;
  }
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
    apiFetch<{ campaignId: string; total: number; totalInvalid: number; success: boolean; estimatedHours: number }>(
      "/campaign-start",
      { method: "POST", body: JSON.stringify(payload) }
    ),

  getCampaignStatus: () =>
    apiFetch<CampaignStatus>("/campaign-status"),

  control: (action: "pause" | "resume" | "stop") =>
    apiFetch<{ success: boolean; status: string }>("/campaign-control", {
      method: "POST",
      body: JSON.stringify({ action }),
    }),

  getSettings: () =>
    apiFetch<{ evoUrl: string; evoInstance: string; evoApiKey: string }>(
      "/campaign-state",
      { method: "POST", body: JSON.stringify({ action: "read-settings" }) }
    ),

  saveSettings: (cfg: { evoUrl: string; evoInstance: string; evoApiKey: string }) =>
    apiFetch<{ success: boolean; evoUrl: string; evoInstance: string; evoApiKey: string }>(
      "/campaign-state",
      { method: "POST", body: JSON.stringify({ action: "write-settings", ...cfg }) }
    ),

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
