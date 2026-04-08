import * as XLSX from "xlsx";
import type { Contact } from "./n8nClient";

const PHONE_COLS = ["موبايل", "mobile", "phone", "هاتف", "رقم", "رقم الهاتف"];
const NAME_COLS = ["اسم", "العضو", "الاسم", "name", "الاسم الكامل"];

function findCol(headers: string[], candidates: string[]): string | null {
  for (const c of candidates) {
    const found = headers.find(
      (h) => h.trim().toLowerCase() === c.toLowerCase()
    );
    if (found) return found;
  }
  return null;
}

export function parseExcel(file: File): Promise<Contact[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
          defval: "",
        });
        if (!rows.length) return resolve([]);

        const headers = Object.keys(rows[0]);
        const phoneCol = findCol(headers, PHONE_COLS);
        const nameCol = findCol(headers, NAME_COLS);

        if (!phoneCol) {
          return reject(
            new Error(
              `لم يُعثر على عمود رقم الهاتف. الأعمدة المتاحة: ${headers.join(", ")}`
            )
          );
        }

        const contacts: Contact[] = rows
          .map((row) => ({
            phone: String(row[phoneCol] ?? "").trim(),
            name: nameCol ? String(row[nameCol] ?? "").trim() : "",
          }))
          .filter((c) => c.phone);

        resolve(contacts);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("فشل قراءة الملف"));
    reader.readAsArrayBuffer(file);
  });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      // Return raw base64 only (no data URL prefix) — Evolution API v2 requires plain base64
      const result = e.target!.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = () => reject(new Error("فشل تحويل الصورة"));
    reader.readAsDataURL(file);
  });
}
