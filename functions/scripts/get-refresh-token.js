/**
 * One-time helper: authorise Google Drive for the backend and save the
 * refresh token into functions/.env (never printed to the screen).
 *
 *   1. Put DRIVE_OAUTH_CLIENT_ID and DRIVE_OAUTH_CLIENT_SECRET in functions/.env
 *   2. In Google Cloud > Credentials > your OAuth client, add the redirect URI:
 *        http://localhost:8085/oauth2callback
 *   3. Run:  node functions/scripts/get-refresh-token.js   and open the printed link
 */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { google } = require("googleapis");

const ENV = path.join(__dirname, "..", ".env");
const PORT = 8085, REDIRECT = `http://localhost:${PORT}/oauth2callback`;

const env = Object.fromEntries(fs.readFileSync(ENV, "utf8").split("\n")
  .filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const id = env.DRIVE_OAUTH_CLIENT_ID, secret = env.DRIVE_OAUTH_CLIENT_SECRET;
if (!id || !secret) { console.error("✗ Fill DRIVE_OAUTH_CLIENT_ID and DRIVE_OAUTH_CLIENT_SECRET in functions/.env first."); process.exit(1); }

const oauth = new google.auth.OAuth2(id, secret, REDIRECT);
const url = oauth.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: ["https://www.googleapis.com/auth/drive"] });

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, REDIRECT);
  if (u.pathname !== "/oauth2callback") { res.writeHead(404).end(); return; }
  const err = u.searchParams.get("error"), code = u.searchParams.get("code");
  try {
    if (err || !code) throw new Error(err || "No code returned");
    const { tokens } = await oauth.getToken(code);
    if (!tokens.refresh_token) throw new Error("Google returned no refresh token. Remove the app at https://myaccount.google.com/permissions and run again.");
    let text = fs.readFileSync(ENV, "utf8");
    text = /^DRIVE_OAUTH_REFRESH_TOKEN=.*$/m.test(text)
      ? text.replace(/^DRIVE_OAUTH_REFRESH_TOKEN=.*$/m, `DRIVE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`)
      : text + `\nDRIVE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`;
    fs.writeFileSync(ENV, text);
    // Quick check: can we see the configured folder?
    let check = "";
    if (env.DRIVE_FOLDER_ID) {
      oauth.setCredentials(tokens);
      const f = await google.drive({ version: "v3", auth: oauth }).files.get({ fileId: env.DRIVE_FOLDER_ID, fields: "name" });
      check = ` Folder found: "${f.data.name}".`;
    }
    res.writeHead(200, { "Content-Type": "text/html" }).end("<h2>✓ Done — you can close this tab.</h2>");
    console.log("✓ Refresh token saved to functions/.env." + check);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/html" }).end("<h2>✗ " + String(e.message) + "</h2>");
    console.error("✗", e.message);
  } finally {
    server.close();
  }
});
server.listen(PORT, () => {
  console.log("\nOpen this link in your browser and sign in with the Gmail that owns the Drive folder:\n\n" + url + "\n");
  console.log("(If you see 'Google hasn't verified this app': Advanced → Go to … (unsafe) → Continue/Allow)\n");
});
