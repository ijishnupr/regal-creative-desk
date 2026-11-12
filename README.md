# Regal Creative Desk

An installable PWA for Regal Jewellers' creative team, built from `regal_creative_desk_local_test.html`. It covers campaigns, task assignment, design submissions, approvals, pinned artwork corrections, notifications, employees and reports.

| Layer | Tech |
|---|---|
| Frontend | React 19 + TypeScript + Vite, PWA (vite-plugin-pwa / Workbox) |
| Auth | Firebase Authentication (Google sign-in) |
| Database | Cloud Firestore (realtime, offline-first) |
| Backend | Cloud Functions v2 (`asia-south1`) |
| File storage | Google Drive (uploads go through the `api` function) |
| Hosting | Firebase Hosting (`/api/**` is rewritten to the function, so it is same-origin) |

```
firebase.json  firestore.rules  firestore.indexes.json
functions/src/index.ts   ensureProfile (roles/invites) + /api/upload + /api/file/:id
functions/src/drive.ts   Google Drive client (service account or OAuth)
web/src/                 React app (pages/, components/, data.tsx, auth.tsx, api.ts)
```

## Performance choices
- **Offline-first Firestore cache (IndexedDB):** screens render from the local cache straight away, then update live.
- **Instant writes:** writes use Firestore latency compensation and are never awaited, so the UI updates immediately and the server syncs in the background.
- **Route chunks:** each page is split into its own chunk. All chunks are precached by the service worker and prefetched when the browser is idle.
- **Drive file caching:** Drive file IDs never change, so each file is cached in memory, then in Cache Storage, then fetched from the network. Hovering a task prefetches its file.
- **Backend:** one instance is kept warm (`minInstances: 1`), so there are no cold starts. It handles 40 requests at once, caches verified tokens and profiles in memory, batches Firestore writes, and moves old Drive files to the trash without blocking the response.
- **Uploads:** they show real progress (XHR) and go straight to Drive.

`minInstances: 1` costs a few dollars a month. To remove it, delete it in `functions/src/index.ts`.

## Setup

### 1. Firebase project
1. Create a project at https://console.firebase.google.com and upgrade it to the **Blaze** plan (Cloud Functions require it).
2. **Authentication → Sign-in method:** enable **Google**.
3. **Firestore Database:** create it in production mode. Region `asia-south1` (Mumbai) is recommended.
4. **Project settings → Your apps:** add a **Web app** and copy its config.
5. Put your project ID in `.firebaserc`.

### 2. Google Drive storage
**Option A: Google Workspace (recommended)**
1. In Google Cloud console → IAM, find the functions runtime service account, usually `PROJECT_NUMBER-compute@developer.gserviceaccount.com`.
2. Enable the **Google Drive API** for the project: APIs & Services → Library.
3. Create a **Shared Drive** (for example "Creative Desk") and add that service account as a **Content manager**.
4. Create a folder inside the Shared Drive and copy its ID from the URL.

**Option B: personal Gmail**
Service accounts have no Drive storage quota of their own. Instead, create an OAuth client (type: Web application) and get a refresh token for the account that owns the folder with scope `https://www.googleapis.com/auth/drive`, for example via https://developers.google.com/oauthplayground using your own client credentials. Then fill in the `DRIVE_OAUTH_*` values below.

### 3. Configure
```bash
cp functions/.env.example functions/.env   # set DRIVE_FOLDER_ID (+ ALLOWED_DOMAIN / OAuth if used)
cp web/.env.example web/.env               # paste the Firebase web config
```

### 4. Install, build and deploy
Node 22+ is required. Node 24 is recommended because the newest Firebase JS SDK prefers it.
```bash
npm i -g firebase-tools && firebase login
(cd functions && npm install)
(cd web && npm install && npm run build)
firebase deploy                            # hosting + functions + firestore rules/indexes
```

### 5. First login
- **The first person to sign in becomes Admin.** Sign in yourself first.
- Admins invite people from **Employees** by their Google email. Invitees get their role the first time they sign in.
- If `ALLOWED_DOMAIN=regaljewellers.net` is set, anyone with that email domain can join as a Designer without an invite.

### Local development
```bash
cd web && npm run dev
```
This uses the real Firebase project. `/api` is proxied to `VITE_DEV_API_TARGET`; point that at your deployed `https://<project>.web.app`. To use the emulators instead, install Java and run `firebase emulators:start`, then set `VITE_USE_EMULATORS=true`.

## Frontend on GitHub Pages (current setup)
The frontend is deployed by `.github/workflows/deploy-pages.yml`. The backend, Firestore rules and indexes stay on Firebase:
```bash
firebase deploy --only functions,firestore      # backend only (not Firebase Hosting)
```
- `web/.env.production` holds the public Firebase web config and `VITE_API_BASE`, the full Cloud Function URL. It is committed on purpose.
- The repo needs **Settings → Pages → Source: GitHub Actions**.
- In Firebase Console → Authentication → Settings → **Authorized domains**, add `<your-username>.github.io`.
- Project repos are served from `/<repo>/`. The workflow sets `VITE_BASE_PATH` automatically and copies `index.html` to `404.html` so deep links work.

## Install as an app
- **Android/Chrome/Edge:** use the in-app "Install" banner, or the browser menu → *Install app*.
- **iPhone:** in Safari, tap Share → *Add to Home Screen*.

## Security model (`firestore.rules`)
- Roles can only be created by the backend and changed by an Admin. A user cannot promote themselves.
- Designers can only read their own tasks. They can only change status, hours and submission title on those tasks, and can never set a task to *Approved*.
- File pointers (`fileId`, `coverFileId`) can only be written by the backend upload endpoint.
- Drive files are served only through `/api/file/:id`, which checks that the requester is an admin or the task's assignee. Drive folders are never shared publicly.
- Old design versions are kept on Drive and listed in each task's `fileVersions`. Files are organised as `Campaign (id)/Task title/` folders.
