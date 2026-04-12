"use client";
import { useState } from "react";
import type { CampaignStatus, ContactStatus } from "@/lib/n8nClient";

const PER_PAGE = 50;

function ContactRow({ index, c }: { index: number; c: ContactStatus }) {
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
    <div style={{ background: rowBg }}
      className="flex items-center justify-between px-4 py-3 border-b border-gray-100/80 text-sm">
      <div className="flex items-center gap-3 overflow-hidden">
        <span className="text-gray-300 text-xs w-7 shrink-0 text-center font-mono">{index + 1}</span>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
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
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<"all" | "sent" | "failed" | "pending">("all");

  if (!status || !status.contacts?.length) return null;

  const allContacts = status.contacts;

  // Apply filter
  const filtered = filter === "all"
    ? allContacts
    : allContacts.filter(c => c.status === filter);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages - 1);
  const pageSlice  = filtered.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);

  const sentPct = status.total > 0
    ? Math.round(status.sentCount / status.total * 100) : 0;

  const from = safePage * PER_PAGE + 1;
  const to   = Math.min((safePage + 1) * PER_PAGE, filtered.length);

  function goPage(p: number) {
    setPage(Math.max(0, Math.min(p, totalPages - 1)));
  }

  // Reset to page 0 when filter changes
  function changeFilter(f: typeof filter) {
    setFilter(f);
    setPage(0);
  }

  return (
    <div className="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden fade-in card-hover">

      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100"
        style={{ background: "linear-gradient(135deg,#f8fafc,#f1f5f9)" }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-gray-800">
            📋 جهات الاتصال
            <span className="text-xs font-normal text-gray-400 mr-2">
              ({allContacts.length.toLocaleString()} إجمالي)
            </span>
          </h2>
          {status.total > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-1.5 rounded-full progress-shimmer"
                  style={{ width: `${sentPct}%` }} />
              </div>
              <span className="text-xs font-bold text-emerald-600">{sentPct}%</span>
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {([
            ["all",     "الكل",       allContacts.length,                              "gray"],
            ["sent",    "مُرسل",      allContacts.filter(c => c.status === "sent").length,    "emerald"],
            ["failed",  "فاشل",       allContacts.filter(c => c.status === "failed").length,  "red"],
            ["pending", "انتظار",     allContacts.filter(c => c.status === "pending").length, "amber"],
          ] as const).map(([key, label, count, color]) => {
            const active = filter === key;
            const colorMap: Record<string, string> = {
              gray:    active ? "bg-gray-700 text-white"           : "bg-gray-100 text-gray-500 hover:bg-gray-200",
              emerald: active ? "bg-emerald-600 text-white"        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
              red:     active ? "bg-red-500 text-white"            : "bg-red-50 text-red-600 hover:bg-red-100",
              amber:   active ? "bg-amber-500 text-white"          : "bg-amber-50 text-amber-700 hover:bg-amber-100",
            };
            return (
              <button key={key} onClick={() => changeFilter(key)}
                className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-colors ${colorMap[color]}`}>
                {label} <span className="opacity-80">({count.toLocaleString()})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Rows */}
      {pageSlice.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-sm">لا توجد نتائج</div>
      ) : (
        pageSlice.map((c, i) => (
          <ContactRow key={c.phone + i} index={safePage * PER_PAGE + i} c={c} />
        ))
      )}

      {/* Pagination bar */}
      {filtered.length > PER_PAGE && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-gray-500">
            {from.toLocaleString()} – {to.toLocaleString()} من <strong>{filtered.length.toLocaleString()}</strong>
          </span>

          <div className="flex items-center gap-1">
            <PagBtn onClick={() => goPage(0)}           disabled={safePage === 0}              label="«" />
            <PagBtn onClick={() => goPage(safePage - 1)} disabled={safePage === 0}             label="‹" />

            {/* Page numbers: show window around current page */}
            {Array.from({ length: totalPages }, (_, i) => i)
              .filter(i => Math.abs(i - safePage) <= 2 || i === 0 || i === totalPages - 1)
              .reduce<(number | "...")[]>((acc, i, idx, arr) => {
                if (idx > 0 && i - (arr[idx - 1] as number) > 1) acc.push("...");
                acc.push(i);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "..." ? (
                  <span key={`dot-${idx}`} className="px-1 text-xs text-gray-400">…</span>
                ) : (
                  <button key={item} onClick={() => goPage(item as number)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                      item === safePage
                        ? "bg-emerald-600 text-white"
                        : "text-gray-600 hover:bg-gray-200"
                    }`}>
                    {(item as number) + 1}
                  </button>
                )
              )
            }

            <PagBtn onClick={() => goPage(safePage + 1)} disabled={safePage === totalPages - 1} label="›" />
            <PagBtn onClick={() => goPage(totalPages - 1)} disabled={safePage === totalPages - 1} label="»" />
          </div>
        </div>
      )}
    </div>
  );
}

function PagBtn({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-7 h-7 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
      {label}
    </button>
  );
}
