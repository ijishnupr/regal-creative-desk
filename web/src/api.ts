import { auth } from "./firebase";

/**
 * File layer backed by Google Drive through a free Google Apps Script web app
 * (see apps-script/Code.gs). Drive file IDs are immutable, so blobs are cached
 * aggressively: memory (object URL) -> Cache Storage (survives reloads/offline) -> network.
 *
 * Local testing: scripts/mock-storage.mjs implements the same protocol against the emulators.
 */
const STORAGE_URL = (import.meta.env.VITE_STORAGE_URL || "").trim();
const CACHE = "regal-drive-files-v1";
const cacheKey = (id: string) => `${location.origin}/__drive-cache/${id}`;
const memory = new Map<string, Promise<string>>();

async function token() {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");
  return u.getIdToken();
}

/** POST as text/plain: a "simple" CORS request, which Apps Script supports (no preflight). */
async function call<T>(action: string, body: Record<string, unknown>): Promise<T> {
  if (!STORAGE_URL) throw new Error("File storage is not configured (VITE_STORAGE_URL).");
  const res = await fetch(STORAGE_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, token: await token(), ...body }),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Storage error (HTTP ${res.status})`);
  const out = await res.json();
  if (out.error) throw new Error(out.error);
  return out as T;
}

const openCache = () => ("caches" in window ? caches.open(CACHE).catch(() => null) : Promise.resolve(null));

function b64ToBlob(b64: string, mime: string) {
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
function blobToB64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function fileUrl(fileId: string): Promise<string> {
  let p = memory.get(fileId);
  if (p) return p;
  p = (async () => {
    const cache = await openCache();
    const hit = cache ? await cache.match(cacheKey(fileId)) : undefined;
    if (hit) return URL.createObjectURL(await hit.blob());
    const { mime, data } = await call<{ mime: string; data: string }>("file", { id: fileId });
    const blob = b64ToBlob(data, mime);
    if (cache) await cache.put(cacheKey(fileId), new Response(blob, { headers: { "Content-Type": mime } })).catch(() => undefined);
    return URL.createObjectURL(blob);
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

export type UploadStage = "reading" | "uploading" | "saving";

/** Upload a file to Google Drive. Returns the new Drive file ID. */
export async function uploadFile(kind: "task" | "cover", id: string, file: File, onStage?: (s: UploadStage) => void) {
  const mime = file.type || "application/octet-stream";
  onStage?.("reading");
  const data = await blobToB64(file);
  onStage?.("uploading");
  const { fileId } = await call<{ fileId: string }>("upload", { kind, id, name: file.name, mime, data });
  // Seed the local cache with what we already have => instant preview, no download.
  const cache = await openCache();
  if (cache) await cache.put(cacheKey(fileId), new Response(file, { headers: { "Content-Type": mime } })).catch(() => undefined);
  onStage?.("saving");
  return { fileId, fileName: file.name, mime };
}
