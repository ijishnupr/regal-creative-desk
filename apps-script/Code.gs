/**
 * Regal Creative Desk — free Google Drive storage backend (Google Apps Script).
 *
 * Runs as the Drive owner ("Execute as: Me"), so files land in YOUR Drive folder.
 * Every request carries the user's Firebase ID token; access is verified by
 * reading the related Firestore document WITH THAT TOKEN, so Firestore security
 * rules decide who may upload/view (admins: everything, designers: own tasks).
 *
 * Setup: see apps-script/README.md
 *   Script properties required:
 *     FOLDER_ID            Drive folder ID (part after /folders/ in its URL)
 *     FIREBASE_PROJECT_ID  e.g. media-backend-a216f
 */

var MAX_MB = 25;
var ALLOWED_MIME = /^(image\/(png|jpe?g|webp|gif|svg\+xml|heic|heif)|video\/(mp4|quicktime|webm)|application\/pdf)$/;

function cfg_() {
  var p = PropertiesService.getScriptProperties();
  var folderId = p.getProperty('FOLDER_ID'), projectId = p.getProperty('FIREBASE_PROJECT_ID');
  if (!folderId || !projectId) throw new Error('Storage not configured: set FOLDER_ID and FIREBASE_PROJECT_ID in Script properties.');
  return { folderId: folderId, projectId: projectId };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json_({ ok: true, service: 'Regal Creative Desk storage' });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    if (!req.token) throw new Error('Missing sign-in token');
    if (req.action === 'upload') return json_(upload_(req));
    if (req.action === 'file') return json_(getFile_(req));
    if (req.action === 'ping') return json_(ping_(req));
    throw new Error('Unknown action');
  } catch (err) {
    return json_({ error: String((err && err.message) || err) });
  }
}

// ---------- Firestore access with the caller's own token ----------
function fsGet_(token, path) {
  var url = 'https://firestore.googleapis.com/v1/projects/' + cfg_().projectId + '/databases/(default)/documents/' + path;
  var r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  var code = r.getResponseCode();
  if (code === 200) return JSON.parse(r.getContentText()).fields || {};
  if (code === 404) throw new Error('Not found');
  if (code === 401) throw new Error('Session expired — sign in again');
  throw new Error('Not allowed');
}
function str_(f) { return f && (f.stringValue !== undefined ? f.stringValue : f.integerValue !== undefined ? String(f.integerValue) : ''); }

/** uid from a token Firestore has already accepted (signature verified by Google). */
function uid_(token) {
  var part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  while (part.length % 4) part += '=';
  return JSON.parse(Utilities.newBlob(Utilities.base64Decode(part)).getDataAsString()).user_id;
}

// ---------- Drive helpers ----------
function clean_(s) { return String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120) || 'upload'; }

function subFolder_(parent, name) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var it = parent.getFoldersByName(name);
    return it.hasNext() ? it.next() : parent.createFolder(name);
  } finally {
    lock.releaseLock();
  }
}

function ping_(req) {
  fsGet_(req.token, 'users/' + uid_(req.token));
  return { ok: true, folder: DriveApp.getFolderById(cfg_().folderId).getName() };
}

function upload_(req) {
  var mime = String(req.mime || '').toLowerCase();
  if (!ALLOWED_MIME.test(mime)) throw new Error('Only images, MP4/MOV/WebM video and PDF are allowed');
  if (!req.data) throw new Error('Empty file');
  var bytes = Utilities.base64Decode(req.data);
  if (bytes.length > MAX_MB * 1024 * 1024) throw new Error('File larger than ' + MAX_MB + ' MB');
  var id = String(req.id || '');
  if (!/^[\w-]+$/.test(id)) throw new Error('Bad target');

  var root = DriveApp.getFolderById(cfg_().folderId), folder, marker, about;
  if (req.kind === 'cover') {
    var me = fsGet_(req.token, 'users/' + uid_(req.token));
    if (str_(me.role) !== 'Admin') throw new Error('Admins only');
    var camp = fsGet_(req.token, 'campaigns/' + id);
    folder = subFolder_(root, clean_(str_(camp.name) + ' (' + id + ')'));
    marker = 'regal:cover:' + id;
    about = 'Campaign cover';
  } else if (req.kind === 'task') {
    var task = fsGet_(req.token, 'tasks/' + id); // succeeds only for admin or the assignee
    var cid = str_(task.campaignId);
    var c = fsGet_(req.token, 'campaigns/' + cid);
    folder = subFolder_(subFolder_(root, clean_(str_(c.name) + ' (' + cid + ')')), clean_(str_(task.title) || id));
    marker = 'regal:task:' + id;
    about = 'Submission for "' + str_(task.title) + '"';
  } else {
    throw new Error('Bad upload target');
  }
  var stamp = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH-mm');
  var file = folder.createFile(Utilities.newBlob(bytes, mime, stamp + ' - ' + clean_(req.name)));
  file.setDescription(marker + '\n' + about);
  return { fileId: file.getId() };
}

function getFile_(req) {
  var id = String(req.id || '');
  if (!/^[\w-]+$/.test(id)) throw new Error('Bad file id');
  var file = DriveApp.getFileById(id);
  var m = /^regal:(task|cover):([\w-]+)/.exec(file.getDescription() || '');
  if (!m) throw new Error('Unknown file');
  // Authorisation = can this user read the owning document under Firestore rules?
  fsGet_(req.token, (m[1] === 'task' ? 'tasks/' : 'campaigns/') + m[2]);
  var blob = file.getBlob();
  return { mime: blob.getContentType(), name: file.getName(), data: Utilities.base64Encode(blob.getBytes()) };
}

/** Run once from the editor to grant Drive + external request permissions. */
function authorize() {
  var c = cfg_();
  Logger.log('Folder OK: ' + DriveApp.getFolderById(c.folderId).getName());
  UrlFetchApp.fetch('https://firestore.googleapis.com/', { muteHttpExceptions: true });
}
