import { auth } from "./firebase";

/**
 * File layer backed by Google Drive (via the /api Cloud Function).
 * Drive file IDs are immutable, so we cache blobs aggressively:
 *   memory (object URL)  ->  Cache Storage (survives reloads/offline)  ->  network
 */
/** Backend base URL: full Cloud Function URL in production (GitHub Pages), "/api" via proxy in dev/emulator. */
export const API = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");
const CACHE = "regal-drive-files-v1";
const memory = new Map<string, Promise<string>>();

async function token() {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");
  return u.getIdToken();
}

export function fileUrl(fileId: string): Promise<string> {
  let p = memory.get(fileId);
  if (p) return p;
  p = (async () => {
    const key = `${API}/file/${fileId}`;
    const cache = "caches" in window ? await caches.open(CACHE).catch(() => null) : null;
    let res = cache ? await cache.match(key) : undefined;
    if (!res) {
      res = await fetch(key, { headers: { Authorization: `Bearer ${await token()}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      if (cache) await cache.put(key, res.clone()).catch(() => undefined);
    }
    return URL.createObjectURL(await res.blob());
  })();
  p.catch(() => memory.delete(fileId));
  memory.set(fileId, p);
  return p;
}

/** Warm the cache in the background (e.g. hovering a card). */
export function prefetchFile(fileId?: string) { if (fileId) void fileUrl(fileId).catch(() => undefined); }

export async function clearFileCache() {
  memory.clear();
  if ("caches" in window) await caches.delete(CACHE).catch(() => undefined);
}

/** Upload with real progress events (XHR) straight into Drive via the backend. */
export function uploadFile(kind: "task" | "cover", id: string, file: File, onProgress?: (pct: number) => void) {
  return new Promise<{ fileId: string }>(async (resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API}/upload?kind=${kind}&id=${encodeURIComponent(id)}`);
      xhr.setRequestHeader("Authorization", `Bearer ${await token()}`);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        let body: { fileId?: string; error?: string } = {};
        try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300 && body.fileId) resolve({ fileId: body.fileId });
        else reject(new Error(body.error || `Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(file);
    } catch (e) { reject(e); }
  });
}
