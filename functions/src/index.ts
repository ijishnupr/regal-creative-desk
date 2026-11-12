import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { ensureFolder, uploadToDrive, trashOnDrive, downloadFromDrive, LOCAL_MODE } from "./drive";

initializeApp();
const db = getFirestore();
setGlobalOptions({ region: "asia-south1", maxInstances: 10 });

type Role = "Admin" | "Designer";
interface Profile { name: string; email: string; role: Role; active?: boolean }

/**
 * Called by the web app right after Google sign-in.
 * Creates the user's profile with a role taken from (in order):
 *   1. an invite created by an Admin (invites/{email})
 *   2. the very first user of the system becomes Admin (bootstrap)
 *   3. ALLOWED_DOMAIN match -> Designer
 * Otherwise access is refused.
 */
export const ensureProfile = onCall({ concurrency: 40 }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = req.auth.uid;
  const email = String(req.auth.token.email || "").toLowerCase();
  if (!email || req.auth.token.email_verified === false) {
    throw new HttpsError("permission-denied", "A verified email address is required.");
  }
  const userRef = db.doc(`users/${uid}`);
  const inviteRef = db.doc(`invites/${email}`);
  const bootRef = db.doc("meta/bootstrap");
  const name = String(req.auth.token.name || email.split("@")[0]);
  const photoURL = (req.auth.token.picture as string | undefined) ?? null;

  return db.runTransaction(async (tx) => {
    const [user, invite, boot] = await Promise.all([tx.get(userRef), tx.get(inviteRef), tx.get(bootRef)]);
    if (user.exists) {
      const p = user.data() as Profile;
      if (p.active === false) throw new HttpsError("permission-denied", "Your account has been deactivated.");
      return { role: p.role, created: false };
    }
    let role: Role | null = null;
    let inviteName: string | undefined;
    if (invite.exists) {
      role = invite.get("role") === "Admin" ? "Admin" : "Designer";
      inviteName = invite.get("name");
      tx.delete(inviteRef);
    } else if (!boot.exists) {
      role = "Admin";
    } else {
      const domain = (process.env.ALLOWED_DOMAIN || "").toLowerCase().trim();
      if (domain && email.endsWith("@" + domain)) role = "Designer";
    }
    if (!role) {
      throw new HttpsError("permission-denied", "You have not been invited yet. Ask a Creative Desk admin to add your email.");
    }
    tx.set(userRef, {
      name: inviteName || name, email, role, photoURL, active: true,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    if (!boot.exists) tx.set(bootRef, { firstAdmin: uid, at: FieldValue.serverTimestamp() });
    const actRef = db.collection("activity").doc();
    tx.set(actRef, { text: `${inviteName || name} joined as ${role}`, actorUid: uid, campaignId: null, createdAt: FieldValue.serverTimestamp() });
    return { role, created: true };
  });
});

// ------------------------------------------------------------------
// HTTP API (served same-origin through Firebase Hosting at /api/**)
//   POST /api/upload?kind=task|cover&id=<docId>   raw file body
//   GET  /api/file/<driveFileId>                   streams the file
// ------------------------------------------------------------------

// Short-lived in-memory caches keep warm requests to a single network hop.
const tokenCache = new Map<string, { uid: string; exp: number }>();
const profileCache = new Map<string, { profile: Profile; at: number }>();
const PROFILE_TTL = 30_000;

async function authUser(req: Request): Promise<{ uid: string; profile: Profile }> {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpsError("unauthenticated", "Missing token");
  const now = Date.now();
  let cached = tokenCache.get(token);
  if (!cached || cached.exp < now) {
    const decoded = await getAuth().verifyIdToken(token);
    cached = { uid: decoded.uid, exp: Math.min(decoded.exp * 1000, now + 5 * 60_000) };
    if (tokenCache.size > 500) tokenCache.clear();
    tokenCache.set(token, cached);
  }
  const uid = cached.uid;
  let entry = profileCache.get(uid);
  if (!entry || now - entry.at > PROFILE_TTL) {
    const snap = await db.doc(`users/${uid}`).get();
    if (!snap.exists) throw new HttpsError("permission-denied", "No profile");
    entry = { profile: snap.data() as Profile, at: now };
    profileCache.set(uid, entry);
  }
  const profile = entry.profile;
  if (profile.active === false) throw new HttpsError("permission-denied", "Account deactivated");
  return { uid, profile };
}

const ALLOWED_MIME = /^(image\/(png|jpe?g|webp|gif|svg\+xml|heic|heif)|video\/(mp4|quicktime|webm)|application\/pdf)$/;

function cleanName(s: string) {
  return s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120) || "upload";
}

async function handleUpload(req: Request, res: Response) {
  const { uid, profile } = await authUser(req);
  const kind = String(req.query.kind || "");
  const id = String(req.query.id || "");
  const mime = String(req.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const fileName = cleanName(decodeURIComponent(String(req.get("x-file-name") || "upload")));
  const body: Buffer | undefined = req.rawBody;
  const maxMb = Number(process.env.MAX_UPLOAD_MB || 25);
  const rootFolder = process.env.DRIVE_FOLDER_ID || (LOCAL_MODE ? "local-root" : "");

  if (!rootFolder) throw new HttpsError("failed-precondition", "DRIVE_FOLDER_ID is not configured on the server.");
  if (!id || !["task", "cover"].includes(kind)) throw new HttpsError("invalid-argument", "Bad upload target");
  if (!body?.length) throw new HttpsError("invalid-argument", "Empty file");
  if (body.length > maxMb * 1024 * 1024) throw new HttpsError("invalid-argument", `File larger than ${maxMb} MB`);
  if (!ALLOWED_MIME.test(mime)) throw new HttpsError("invalid-argument", "Only images, MP4/MOV/WebM video and PDF are allowed");

  if (kind === "cover") {
    if (profile.role !== "Admin") throw new HttpsError("permission-denied", "Admins only");
    const ref = db.doc(`campaigns/${id}`);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Campaign not found");
    const folder = await ensureFolder(cleanName(`${snap.get("name")} (${id})`), rootFolder);
    const up = await uploadToDrive({ name: `COVER - ${fileName}`, mimeType: mime, body, folderId: folder, description: `Campaign cover uploaded by ${profile.email}` });
    const old = snap.get("coverFileId");
    const batch = db.batch();
    batch.set(db.doc(`files/${up.id}`), { kind, refId: id, uploadedBy: uid, mime, createdAt: FieldValue.serverTimestamp() });
    batch.update(ref, { coverFileId: up.id, updatedAt: FieldValue.serverTimestamp() });
    if (old) batch.delete(db.doc(`files/${old}`));
    await batch.commit();
    if (old) void trashOnDrive(old); // fire-and-forget, don't block the response
    res.json({ fileId: up.id });
    return;
  }

  // kind === "task"
  const ref = db.doc(`tasks/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Task not found");
  const task = snap.data()!;
  if (profile.role !== "Admin" && task.assigneeId !== uid) throw new HttpsError("permission-denied", "Not your task");
  const camp = await db.doc(`campaigns/${task.campaignId}`).get();
  const campFolder = await ensureFolder(cleanName(`${camp.get("name") || "Campaign"} (${task.campaignId})`), rootFolder);
  const taskFolder = await ensureFolder(cleanName(task.title || id), campFolder);
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  const up = await uploadToDrive({
    name: `${stamp} - ${fileName}`, mimeType: mime, body, folderId: taskFolder,
    description: `Submission for "${task.title}" by ${profile.email}`,
  });
  const batch = db.batch();
  batch.set(db.doc(`files/${up.id}`), { kind, refId: id, uploadedBy: uid, mime, createdAt: FieldValue.serverTimestamp() });
  // Keep earlier versions on Drive (version history) — only the pointer moves.
  batch.update(ref, {
    fileId: up.id, fileName, fileMime: mime,
    fileVersions: FieldValue.arrayUnion({ fileId: up.id, fileName, at: Date.now(), by: uid }),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  res.json({ fileId: up.id });
}

async function handleFile(req: Request, res: Response, fileId: string) {
  const { uid, profile } = await authUser(req);
  const idx = await db.doc(`files/${fileId}`).get();
  if (!idx.exists) throw new HttpsError("not-found", "Unknown file");
  const { kind, refId } = idx.data() as { kind: string; refId: string };
  if (kind === "task" && profile.role !== "Admin") {
    const t = await db.doc(`tasks/${refId}`).get();
    if (t.get("assigneeId") !== uid) throw new HttpsError("permission-denied", "Not allowed");
  }
  const { meta, stream } = await downloadFromDrive(fileId);
  res.set("Content-Type", meta.mimeType || "application/octet-stream");
  // Drive file IDs are immutable (new upload = new ID) so clients may cache forever.
  res.set("Cache-Control", "private, max-age=31536000, immutable");
  if (meta.size) res.set("Content-Length", String(meta.size));
  res.set("Content-Disposition", `inline; filename="${encodeURIComponent(meta.name || "file")}"`);
  stream.pipe(res);
}

const STATUS: Record<string, number> = {
  "unauthenticated": 401, "permission-denied": 403, "not-found": 404,
  "invalid-argument": 400, "failed-precondition": 412,
};

// minInstances: 1 keeps one instance warm => no cold starts for uploads/previews.
// concurrency lets that single instance serve many requests in parallel.
export const api = onRequest({ memory: "512MiB", cpu: 1, concurrency: 40, minInstances: 1, timeoutSeconds: 120, cors: true }, async (req, res) => {
  try {
    const path = req.path.replace(/^\/api/, "");
    if (req.method === "POST" && path === "/upload") return await handleUpload(req, res);
    const m = path.match(/^\/file\/([\w-]+)$/);
    if (req.method === "GET" && m) return await handleFile(req, res, m[1]);
    res.status(404).json({ error: "Not found" });
  } catch (err) {
    if (err instanceof HttpsError) {
      res.status(STATUS[err.code] || 500).json({ error: err.message });
    } else {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
});
