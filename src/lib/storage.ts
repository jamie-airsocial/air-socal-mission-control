export const STORAGE_BUCKETS = {
  documents: 'documents',
} as const;

export const DOCUMENTS_BUCKET = STORAGE_BUCKETS.documents;

export function getStorageObjectPathFromUrl(url: string, bucket = DOCUMENTS_BUCKET): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/authenticated/${bucket}/`,
    ];

    for (const marker of markers) {
      const idx = parsed.pathname.indexOf(marker);
      if (idx !== -1) {
        const rawPath = parsed.pathname.slice(idx + marker.length);
        return decodeURIComponent(rawPath.split('/sign/')[0]);
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function getStorageProxyUrl(path: string): string {
  return `/api/files?path=${encodeURIComponent(path)}`;
}

export function normaliseFileAttachmentUrl(url: string, bucket = DOCUMENTS_BUCKET): string {
  if (!url) return url;
  if (url.startsWith('/api/files?path=')) return url;

  const path = getStorageObjectPathFromUrl(url, bucket);
  return path ? getStorageProxyUrl(path) : url;
}
