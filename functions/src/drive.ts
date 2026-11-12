import { google, drive_v3 } from "googleapis";
import { Readable } from "node:stream";
import { randomBytes } from "node:crypto";
import { promises as fs, createReadStream } from "node:fs";
import * as path from "node:path";

/**
 * Local testing mode: when running in the Functions emulator without a
 * DRIVE_FOLDER_ID, files are written to functions/.local-drive instead of
 * Google Drive, so the whole app can be exercised offline.
 */
export const LOCAL_MODE = process.env.FUNCTIONS_EMULATOR === "true" && !process.env.DRIVE_FOLDER_ID;
const LOCAL_DIR = path.resolve(__dirname, "..", ".local-drive");
if (LOCAL_MODE) console.log("[drive] Local testing mode: files stored in", LOCAL_DIR);

const SCOPES = ["https://www.googleapis.com/auth/drive"];
let client: drive_v3.Drive | null = null;

/** Drive client: OAuth refresh token if configured, else the runtime service account. */
export function drive(): drive_v3.Drive {
  if (client) return client;
  const { DRIVE_OAUTH_CLIENT_ID: id, DRIVE_OAUTH_CLIENT_SECRET: secret, DRIVE_OAUTH_REFRESH_TOKEN: refresh } = process.env;
  if (id && secret && refresh) {
    const oauth = new google.auth.OAuth2(id, secret);
    oauth.setCredentials({ refresh_token: refresh });
    client = google.drive({ version: "v3", auth: oauth });
  } else {
    const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
    client = google.drive({ version: "v3", auth });
  }
  return client;
}

const folderCache = new Map<string, string>();

/** Find or create a sub-folder (e.g. one per campaign) inside the root upload folder. */
export async function ensureFolder(name: string, parentId: string): Promise<string> {
  if (LOCAL_MODE) return parentId + "/" + name;
  const key = parentId + "/" + name;
  const cached = folderCache.get(key);
  if (cached) return cached;
  const safe = name.replace(/['\\]/g, "\\$&");
  const res = await drive().files.list({
    q: `'${parentId}' in parents and name = '${safe}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 1,
  });
  let id = res.data.files?.[0]?.id;
  if (!id) {
    const created = await drive().files.create({
      requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
      fields: "id",
      supportsAllDrives: true,
    });
    id = created.data.id!;
  }
  folderCache.set(key, id);
  return id;
}

export async function uploadToDrive(opts: {
  name: string; mimeType: string; body: Buffer; folderId: string; description?: string;
}): Promise<{ id: string; webViewLink?: string | null }> {
  if (LOCAL_MODE) {
    const id = "local" + randomBytes(12).toString("hex");
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    await fs.writeFile(path.join(LOCAL_DIR, id), opts.body);
    await fs.writeFile(path.join(LOCAL_DIR, id + ".json"), JSON.stringify({ name: opts.name, mimeType: opts.mimeType, size: opts.body.length, folder: opts.folderId }));
    return { id };
  }
  const res = await drive().files.create({
    requestBody: { name: opts.name, parents: [opts.folderId], description: opts.description },
    media: { mimeType: opts.mimeType, body: Readable.from(opts.body) },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });
  return { id: res.data.id!, webViewLink: res.data.webViewLink };
}

export async function trashOnDrive(fileId: string): Promise<void> {
  if (LOCAL_MODE) { await fs.rm(path.join(LOCAL_DIR, fileId), { force: true }); return; }
  try {
    await drive().files.update({ fileId, requestBody: { trashed: true }, supportsAllDrives: true });
  } catch (err) {
    console.warn("Could not trash old Drive file", fileId, err);
  }
}

export async function downloadFromDrive(fileId: string) {
  if (LOCAL_MODE) {
    if (!/^[\w-]+$/.test(fileId)) throw new Error("bad id");
    const meta = JSON.parse(await fs.readFile(path.join(LOCAL_DIR, fileId + ".json"), "utf8"));
    return { meta: { mimeType: meta.mimeType as string, name: meta.name as string, size: String(meta.size) }, stream: createReadStream(path.join(LOCAL_DIR, fileId)) as NodeJS.ReadableStream };
  }
  const meta = await drive().files.get({ fileId, fields: "mimeType, name, size", supportsAllDrives: true });
  const res = await drive().files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" },
  );
  return { meta: meta.data, stream: res.data as unknown as NodeJS.ReadableStream };
}
