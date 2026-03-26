export const STORAGE_BUCKETS = {
  documents: 'documents',
} as const;

export const DOCUMENTS_BUCKET = STORAGE_BUCKETS.documents;

export function getStorageObjectPathFromUrl(url: string, bucket = DOCUMENTS_BUCKET): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

export function getStorageProxyUrl(path: string): string {
  return `/api/files?path=${encodeURIComponent(path)}`;
}

export function normaliseFileAttachmentUrl(url: string, bucket = DOCUMENTS_BUCKET): string {
  const path = getStorageObjectPathFromUrl(url, bucket);
  return path ? getStorageProxyUrl(path) : url;
}
