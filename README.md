# Regal Creative Desk

An installable PWA for Regal Jewellers' creative team: campaigns, task assignment, design submissions, approvals, pinned artwork corrections, notifications, employees and reports. **It runs entirely on free tiers, with no subscription.**

| Layer | Service (free) |
|---|---|
| Frontend | React 19 + TypeScript + Vite PWA, hosted on **GitHub Pages** |
| Login | **Firebase Authentication** (Google sign-in), Spark plan |
| Database | **Cloud Firestore**, Spark plan. Roles and permissions are enforced by `firestore.rules` |
| File storage | **Google Drive** via a **Google Apps Script** web app (`apps-script/Code.gs`) running as the Drive owner |

```
firestore.rules / firestore.indexes.json   security rules + indexes (deploy with Firebase CLI)
apps-script/Code.gs                        Drive storage backend (paste into script.google.com)
web/                                       React app
.github/workflows/deploy-pages.yml         builds + publishes the site on every push
scripts/test-local.sh                      run everything locally on emulators
```

## Setup (one time)

### 1. Firebase (Spark / free plan)
In the Firebase console for **media-backend-a216f**:
1. **Authentication → Get started → Sign-in method → Google → Enable.**
2. **Authentication → Settings → Authorized domains → Add** `ijishnupr.github.io`.
3. **Firestore Database → Create database →** `asia-south1` → production mode.
4. Deploy the security rules, logged in with the Google account that owns the project:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase deploy --only firestore
   ```

### 2. Google Drive storage (Apps Script)
Follow `apps-script/README.md` (about 5 minutes). You'll get a **Web app URL**.

### 3. Connect and publish
Put the Web app URL in `web/.env.production`:
```
VITE_STORAGE_URL=https://script.google.com/macros/s/XXXX/exec
```
Then commit and push. GitHub rebuilds the site in about 2 minutes:
```bash
git add -A && git commit -m "Connect Drive storage" && git push
```

### 4. First login
Open https://ijishnupr.github.io/regal-creative-desk/ and sign in. **The first person to sign in becomes Admin.** Then invite designers from **Employees** by their Google email.

## How security works
- A user can only create their own profile if an Admin invited their email, with the role taken from the invite, or if they're the very first user. Nobody can make themselves Admin.
- Designers only see their own tasks and can update status, hours and submission, but never set *Approved*.
- The Apps Script checks every upload and download by reading the related Firestore document **with the user's own sign-in token**, so the Firestore rules decide access. The Drive folder itself stays private.

## Performance
- **Offline-first Firestore cache:** screens render instantly from the device, then update live.
- **Instant saves:** writes never wait for the server, and the UI updates immediately.
- **Instant navigation:** pages are code-split, precached by the service worker, and prefetched when the browser is idle.
- **Drive files:** each file is cached on the device after its first view, and your own uploads are cached straight away. Apps Script takes about 1–2 seconds for the first view of a file.

## Local testing (no real Firebase or Drive needed)
Requires Java 21+ and Node 22+:
```bash
./scripts/test-local.sh      # then open http://localhost:5173
```
This uses the Auth and Firestore emulators. `scripts/mock-storage.mjs` stands in for the Apps Script, using the same protocol and permission checks.

## Free-tier limits (more than enough for a small team)
- **Firestore:** 50k reads, 20k writes and 1 GiB storage per day/month.
- **Apps Script (consumer account):** 20k external requests per day, 6 minutes per run.
- **Drive:** your account's storage quota.
- **Uploads:** at most 25 MB per file.

## Install as an app
- **Android/Chrome/Edge:** use the in-app "Install" banner, or the browser menu → *Install app*.
- **iPhone:** in Safari, tap Share → *Add to Home Screen*.
