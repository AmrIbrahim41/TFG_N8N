"use client";
import { List } from "react-window";
import type { CSSProperties } from "react";
import type { CampaignStatus, ContactStatus } from "@/lib/n8nClient";

interface RowProps { contacts: ContactStatus[] }

function Row({ index, style, contacts }: {
  index: number; style: CSSProperties; contacts: ContactStatus[];
}) {
  const c = contacts[index];
  const isEven = index % 2 === 0;

  const rowBg =
    c.status === "sent"   ? (isEven ? "#f0fdf4" : "#dcfce7") :
    c.status === "failed" ? (isEven ? "#fff1f2" : "#ffe4e6") :
    isEven ? "#ffffff" : "#f9fafb";

  const badge =
    c.status === "sent" ? (
      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full whitespace-nowrap">
        ✓ مُرسل
      </span>
    ) : c.status === "failed" ? (
      <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-100 px-2.5 py-0.5 rounded-full whitespace-nowrap">
        ✗ فاشل
      </span>
    ) : (
      <span className="flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full whitespace-nowrap">
        ⏳ انتظار
      </span>
    );

  return (
    <div style={{ ...style, background: rowBg }}
      className="flex items-center justify-between px-4 border-b border-gray-100/80 text-sm">
      <div className="flex items-center gap-3 overflow-hidden">
        <span className="text-gray-300 text-xs w-7 shrink-0 text-center font-mono">{index + 1}</span>
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            c.status === "sent"   ? "bg-emerald-500 text-white" :
            c.status === "failed" ? "bg-red-400 text-white"     : "bg-gray-200 text-gray-500"
          }`}>
          {c.name ? c.name.charAt(0) : "#"}
        </div>
        <div className="overflow-hidden">
          {c.name && <p className="text-xs font-semibold text-gray-700 truncate">{c.name}</p>}
          <p className="font-mono text-xs text-gray-500 truncate">{c.phone}</p>
          {c.failedReason && (
            <p className="text-[10px] text-red-400 truncate">{c.failedReason}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {c.sentAt && (
          <span className="text-[10px] text-gray-400 hidden sm:block">
            {new Date(c.sentAt).toLocaleTimeString("ar-EG")}
          </span>
        )}
        {badge}
      </div>
    </div>
  );
}

interface Props { status: CampaignStatus | null }

export default function ContactTable({ status }: Props) {
  if (!status || !status.contacts?.length) return null;

  const contacts = status.contacts;
  const height   = Math.min(420, contacts.length * 60);
  const sentPct  = status.total > 0
    ? Math.round(status.sentCount / status.total * 100) : 0;

  return (
    <div className="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden fade-in card-hover">

      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg,#f8fafc,#f1f5f9)" }}>
        <h2 className="text-sm font-bold text-gray-800">
          📋 جهات الاتصال
          <span className="text-xs font-normal text-gray-400 mr-2">
            ({contacts.length} معروضة)
          </span>
        </h2>
        <div className="flex items-center gap-3">
          {/* Mini progress */}
          {status.total > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-1.5 rounded-full progress-shimmer"
                  style={{ width: `${sentPct}%` }} />
              </div>
              <span className="text-xs font-bold text-emerald-600">{sentPct}%</span>
            </div>
          )}
          {/* Legend */}
          <div className="hidden sm:flex gap-2 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />مُرسل
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />فاشل
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />انتظار
            </span>
          </div>
        </div>
      </div>

      <List<RowProps>
        rowComponent={Row}
        rowCount={contacts.length}
        rowHeight={60}
        rowProps={{ contacts }}
        defaultHeight={height}
        style={{ height: `${height}px` }}
      />

      {status.total > contacts.length && (
        <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            يُعرض أول <strong>{contacts.length}</strong> من أصل <strong>{status.total}</strong> جهة اتصال
          </p>
        </div>
      )}
    </div>
  );
}
