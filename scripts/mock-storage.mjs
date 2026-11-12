// Local stand-in for apps-script/Code.gs — same protocol, same authorisation
// (reads the owning Firestore doc with the caller's token, so emulator rules apply).
// Files are stored in scripts/.local-drive/.  Usage: node scripts/mock-storage.mjs
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

const PORT = 8090, PROJECT = "demo-regal", DIR = path.join(path.dirname(new URL(import.meta.url).pathname), ".local-drive");
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/`;
const ALLOWED_MIME = /^(image\/(png|jpe?g|webp|gif|svg\+xml|heic|heif)|video\/(mp4|quicktime|webm)|application\/pdf)$/;

async function fsGet(token, p) {
  const r = await fetch(FS + p, { headers: { Authorization: "Bearer " + token } });
  if (r.status === 200) return (await r.json()).fields || {};
  throw new Error(r.status === 404 ? "Not found" : "Not allowed");
}
const str = (f) => f?.stringValue ?? "";
const uid = (t) => JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()).user_id;

async function handle(req) {
  if (!req.token) throw new Error("Missing sign-in token");
  if (req.action === "upload") {
    if (!ALLOWED_MIME.test(req.mime || "")) throw new Error("Only images, MP4/MOV/WebM video and PDF are allowed");
    let marker;
    if (req.kind === "cover") {
      if (str((await fsGet(req.token, "users/" + uid(req.token))).role) !== "Admin") throw new Error("Admins only");
      await fsGet(req.token, "campaigns/" + req.id); marker = "cover:" + req.id;
    } else if (req.kind === "task") {
      await fsGet(req.token, "tasks/" + req.id); marker = "task:" + req.id;
    } else throw new Error("Bad upload target");
    const id = "mock" + randomBytes(10).toString("hex");
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(path.join(DIR, id), Buffer.from(req.data, "base64"));
    await fs.writeFile(path.join(DIR, id + ".json"), JSON.stringify({ marker, mime: req.mime, name: req.name }));
    return { fileId: id };
  }
  if (req.action === "file") {
    if (!/^[\w-]+$/.test(req.id)) throw new Error("Bad file id");
    const meta = JSON.parse(await fs.readFile(path.join(DIR, req.id + ".json"), "utf8"));
    const [kind, ref] = meta.marker.split(":");
    await fsGet(req.token, (kind === "task" ? "tasks/" : "campaigns/") + ref);
    return { mime: meta.mime, name: meta.name, data: (await fs.readFile(path.join(DIR, req.id))).toString("base64") };
  }
  throw new Error("Unknown action");
}

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    let out;
    try { out = req.method === "POST" ? await handle(JSON.parse(body)) : { ok: true }; }
    catch (e) { out = { error: e.message }; }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(out));
  });
}).listen(PORT, () => console.log(`mock storage on http://127.0.0.1:${PORT} → ${DIR}`));
