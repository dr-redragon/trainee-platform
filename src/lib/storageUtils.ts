import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SIGNED_URL_EXPIRY = 3600; // 1 hour

/**
 * Extracts the storage path from a file_url.
 * Handles both full public URLs (legacy) and bare paths (new).
 */
export function extractStoragePath(fileUrl: string): string | null {
  if (!fileUrl) return null;

  // If it's a full Supabase storage URL, extract path after /resources/
  const publicPrefix = `${SUPABASE_URL}/storage/v1/object/public/resources/`;
  if (fileUrl.startsWith(publicPrefix)) {
    return decodeURIComponent(fileUrl.slice(publicPrefix.length));
  }

  // If it contains the storage path pattern but different format
  const match = fileUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/resources\/(.+)/);
  if (match) return decodeURIComponent(match[1]);

  // If it's already a bare path (no http), return as-is
  if (!fileUrl.startsWith("http")) return fileUrl;

  // Not a storage URL (external link) — return null
  return null;
}

/**
 * Creates a signed URL for a resource file_url.
 * Returns the original URL if it's not a storage URL (e.g. external links).
 */
export async function getSignedResourceUrl(fileUrl: string): Promise<string | null> {
  const path = extractStoragePath(fileUrl);
  if (!path) return fileUrl; // external URL, return as-is

  const { data, error } = await supabase.storage
    .from("resources")
    .createSignedUrl(path, SIGNED_URL_EXPIRY);

  if (error) {
    console.error("Failed to create signed URL:", error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Downloads a resource file as a Blob directly via Supabase SDK.
 * Falls back to fetch for external URLs.
 */
export async function downloadResourceBlob(fileUrl: string): Promise<Blob | null> {
  const path = extractStoragePath(fileUrl);

  // If it's a storage file, use the SDK download which avoids CORS issues
  if (path) {
    const { data, error } = await supabase.storage
      .from("resources")
      .download(path);

    if (error) {
      console.error("Failed to download file:", error);
      return null;
    }
    return data;
  }

  // External URL — try fetch
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

/**
 * Returns true if the file_url points to Supabase storage (vs external).
 */
export function isStorageUrl(fileUrl: string | null): boolean {
  if (!fileUrl) return false;
  return extractStoragePath(fileUrl) !== fileUrl || !fileUrl.startsWith("http");
}
