# Google Drive storage — Apps Script setup (free, about 5 min)

Do this while signed in with the **Gmail that owns the Drive folder**.

1. Go to https://script.google.com → **New project**. Rename it "Regal Creative Desk Storage".
2. Delete the sample code in `Code.gs` and paste in the whole of `apps-script/Code.gs` from this repo. Press **Save** (💾).
3. **Project Settings** (⚙ on the left):
   - Tick **Show "appsscript.json" manifest file in editor**. Back in the Editor, open `appsscript.json` and replace its contents with `apps-script/appsscript.json` from this repo, then **Save**.
   - Under **Script Properties → Add script property**, add two properties:
     | Property | Value |
     |---|---|
     | `FOLDER_ID` | `12ZNJwtJa5NN1u6hGqDdc8Ym-c6pgv0Np` |
     | `FIREBASE_PROJECT_ID` | `media-backend-a216f` |
   - **Save script properties.**
4. **Authorise:** in the Editor, choose the function **`authorize`** in the toolbar dropdown → **Run** → **Review permissions** → pick your Gmail → **Advanced → Go to … (unsafe) → Allow**. The log should show `Folder OK: <your folder name>`.
5. **Deploy:** **Deploy → New deployment →** ⚙ **Select type → Web app**:
   - Description: `v1`
   - **Execute as: Me**
   - **Who has access: Anyone**
   - **Deploy**, then copy the **Web app URL**. It ends in `/exec`.
6. Put that URL in `web/.env.production` as `VITE_STORAGE_URL=...` and push.

"Anyone" only means the URL is reachable. Every request must include a valid Firebase sign-in token, and Firestore rules decide what each person can upload or view.

### Updating the script later
After editing the code, go to **Deploy → Manage deployments → ✎ Edit → Version: New version → Deploy**. The URL stays the same.
