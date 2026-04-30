import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { downloadResourceBlob, extractStoragePath } from "@/lib/storageUtils";

type ResourceRecord = Tables<"resources">;

interface ZipDownloadItem {
  resource: ResourceRecord;
  folderName?: string | null;
}

const INVALID_FILE_CHARS = /[\\/:*?"<>|]+/g;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]+/g;
const MULTIPLE_SPACES = /\s+/g;

function sanitizeSegment(value: string | null | undefined, fallback: string) {
  const sanitized = (value ?? "")
    .replace(INVALID_FILE_CHARS, "-")
    .replace(CONTROL_CHARS, "")
    .replace(MULTIPLE_SPACES, " ")
    .trim();
  return sanitized || fallback;
}

function extractSourceFileName(source: string) {
  const rawName = source.split("/").pop()?.split("?")[0] ?? "";
  try { return decodeURIComponent(rawName); } catch { return rawName; }
}

function splitFileName(fileName: string) {
  const i = fileName.lastIndexOf(".");
  if (i <= 0) return { base: fileName, extension: "" };
  return { base: fileName.slice(0, i), extension: fileName.slice(i) };
}

function getResourceSource(r: ResourceRecord) {
  return r.file_url || r.external_url || null;
}

function getResourceBaseName(r: ResourceRecord) {
  const sourceName = extractSourceFileName(getResourceSource(r) ?? "");
  return sanitizeSegment(r.title || splitFileName(sourceName).base, "resource");
}

function getResourceExtension(r: ResourceRecord) {
  const sourceName = extractSourceFileName(getResourceSource(r) ?? "");
  return splitFileName(sourceName).extension.toLowerCase();
}

function buildUniquePath(candidate: string, used: Set<string>) {
  const norm = candidate.toLowerCase();
  if (!used.has(norm)) { used.add(norm); return candidate; }
  const { base, extension } = splitFileName(candidate);
  let n = 2;
  let next = `${base} (${n})${extension}`;
  while (used.has(next.toLowerCase())) { n++; next = `${base} (${n})${extension}`; }
  used.add(next.toLowerCase());
  return next;
}

function isSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
}

/**
 * Trigger a download via an anchor click on a real URL.
 * Works in Safari when the URL is same-origin or has Content-Disposition.
 */
function triggerAnchorDownload(href: string, fileName: string, openInNewTab = false) {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  if (openInNewTab) link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Save a Blob to disk. Uses anchor+blob URL for most browsers.
 * On Safari (which often ignores `download` on blob: URLs in iframes),
 * we open the blob in a new tab so the user can save it.
 */
function saveBlobAsFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);

  if (isSafari()) {
    // Safari: open blob in new tab — user uses Cmd+S / share to save.
    // This is the only reliable cross-iframe approach in Safari.
    const win = window.open(url, "_blank");
    if (!win) {
      // Popup blocked — fallback to anchor click which may still navigate top.
      triggerAnchorDownload(url, fileName);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  triggerAnchorDownload(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function getResourceDownloadName(r: ResourceRecord) {
  const base = getResourceBaseName(r);
  const ext = getResourceExtension(r);
  if (!ext || base.toLowerCase().endsWith(ext)) return base;
  return `${base}${ext}`;
}

/**
 * Get a signed URL with `download` param so Supabase serves
 * `Content-Disposition: attachment; filename=…`. Safari respects this
 * and saves the file directly without opening a tab.
 */
async function getSignedDownloadUrl(fileUrl: string, fileName: string): Promise<string | null> {
  const path = extractStoragePath(fileUrl);
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("resources")
    .createSignedUrl(path, 3600, { download: fileName });
  if (error) {
    console.error("createSignedUrl(download) failed:", error);
    return null;
  }
  return data.signedUrl;
}

export async function downloadResourceFile(resource: ResourceRecord) {
  const source = getResourceSource(resource);
  if (!source) throw new Error("This resource has no file to download");

  const fileName = getResourceDownloadName(resource);

  // Preferred path: storage file → use signed URL with `download` flag.
  // The browser navigates to a same-server URL with Content-Disposition,
  // so Safari saves directly without popup or tab.
  if (resource.file_url) {
    const signed = await getSignedDownloadUrl(resource.file_url, fileName);
    if (signed) {
      triggerAnchorDownload(signed, fileName);
      return fileName;
    }
  }

  // External URL fallback: try a direct anchor download (works if CORS/headers allow).
  if (resource.external_url) {
    triggerAnchorDownload(resource.external_url, fileName, true);
    return fileName;
  }

  // Last resort: fetch as blob and save.
  const blob = await downloadResourceBlob(source);
  if (blob) {
    saveBlobAsFile(blob, fileName);
    return fileName;
  }

  throw new Error("Unable to download this file");
}

export async function downloadResourcesAsZip(items: ZipDownloadItem[], zipName: string) {
  const downloadItems = items.filter(({ resource }) => Boolean(getResourceSource(resource)));
  if (downloadItems.length === 0) throw new Error("No downloadable files found");

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const used = new Set<string>();
  const skipped: string[] = [];
  let downloaded = 0;

  for (const { resource, folderName } of downloadItems) {
    const source = getResourceSource(resource);
    if (!source) continue;
    const blob = await downloadResourceBlob(source);
    if (!blob) { skipped.push(resource.title || "Untitled"); continue; }
    const prefix = folderName ? `${sanitizeSegment(folderName, "folder")}/` : "";
    const path = buildUniquePath(`${prefix}${getResourceDownloadName(resource)}`, used);
    zip.file(path, await blob.arrayBuffer());
    downloaded++;
  }

  if (downloaded === 0) throw new Error("No files could be downloaded");

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const safeName = sanitizeSegment(zipName.replace(/\.zip$/i, ""), "download");
  saveBlobAsFile(zipBlob, `${safeName}.zip`);

  return { downloaded, skipped };
}
