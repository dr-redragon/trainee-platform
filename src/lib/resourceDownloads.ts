import type { Tables } from "@/integrations/supabase/types";
import { downloadResourceBlob } from "@/lib/storageUtils";

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

  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

function splitFileName(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex <= 0) {
    return { base: fileName, extension: "" };
  }

  return {
    base: fileName.slice(0, lastDotIndex),
    extension: fileName.slice(lastDotIndex),
  };
}

function getResourceSource(resource: ResourceRecord) {
  return resource.file_url || resource.external_url || null;
}

function getResourceBaseName(resource: ResourceRecord) {
  const source = getResourceSource(resource) ?? "";
  const sourceName = extractSourceFileName(source);
  const sourceBase = splitFileName(sourceName).base;

  return sanitizeSegment(resource.title || sourceBase, "resource");
}

function getResourceExtension(resource: ResourceRecord) {
  const source = getResourceSource(resource) ?? "";
  const sourceName = extractSourceFileName(source);
  const extension = splitFileName(sourceName).extension;

  return extension.toLowerCase();
}

function buildUniquePath(candidatePath: string, usedPaths: Set<string>) {
  const normalized = candidatePath.toLowerCase();
  if (!usedPaths.has(normalized)) {
    usedPaths.add(normalized);
    return candidatePath;
  }

  const { base, extension } = splitFileName(candidatePath);
  let duplicateIndex = 2;
  let nextCandidate = `${base} (${duplicateIndex})${extension}`;

  while (usedPaths.has(nextCandidate.toLowerCase())) {
    duplicateIndex += 1;
    nextCandidate = `${base} (${duplicateIndex})${extension}`;
  }

  usedPaths.add(nextCandidate.toLowerCase());
  return nextCandidate;
}

function triggerAnchorDownload(href: string, fileName: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function saveBlobAsFile(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);

  try {
    triggerAnchorDownload(objectUrl, fileName);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

export function getResourceDownloadName(resource: ResourceRecord) {
  const baseName = getResourceBaseName(resource);
  const extension = getResourceExtension(resource);

  if (!extension || baseName.toLowerCase().endsWith(extension)) {
    return baseName;
  }

  return `${baseName}${extension}`;
}

export async function downloadResourceFile(resource: ResourceRecord) {
  const source = getResourceSource(resource);
  if (!source) {
    throw new Error("This resource has no file to download");
  }

  const fileName = getResourceDownloadName(resource);
  const blob = await downloadResourceBlob(source);

  if (blob) {
    await saveBlobAsFile(blob, fileName);
    return fileName;
  }

  if (resource.external_url) {
    triggerAnchorDownload(resource.external_url, fileName);
    return fileName;
  }

  throw new Error("Unable to download this file");
}

export async function downloadResourcesAsZip(items: ZipDownloadItem[], zipName: string) {
  const downloadItems = items.filter(({ resource }) => Boolean(getResourceSource(resource)));
  if (downloadItems.length === 0) {
    throw new Error("No downloadable files found");
  }

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const usedPaths = new Set<string>();
  const skipped: string[] = [];
  let downloaded = 0;

  for (const { resource, folderName } of downloadItems) {
    const source = getResourceSource(resource);
    if (!source) continue;

    const blob = await downloadResourceBlob(source);
    if (!blob) {
      skipped.push(resource.title || "Untitled resource");
      continue;
    }

    const folderPrefix = folderName ? `${sanitizeSegment(folderName, "folder")}/` : "";
    const uniquePath = buildUniquePath(`${folderPrefix}${getResourceDownloadName(resource)}`, usedPaths);

    zip.file(uniquePath, await blob.arrayBuffer());
    downloaded += 1;
  }

  if (downloaded === 0) {
    throw new Error("No files could be downloaded");
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const safeZipName = sanitizeSegment(zipName.replace(/\.zip$/i, ""), "download");
  await saveBlobAsFile(zipBlob, `${safeZipName}.zip`);

  return { downloaded, skipped };
}