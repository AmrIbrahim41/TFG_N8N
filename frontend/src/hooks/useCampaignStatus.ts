"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { n8n, type CampaignStatus } from "@/lib/n8nClient";

export function useCampaignStatus() {
  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await n8n.getCampaignStatus();
      // Only set status if response has the expected shape
      if (data && typeof data.status === "string") {
        setStatus(data);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ في جلب الحالة");
    }
  }, []);

  // Poll every 5s while running or paused
  useEffect(() => {
    refresh();

    intervalRef.current = setInterval(() => {
      refresh();
    }, 5_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  return { status, error, refresh };
}
