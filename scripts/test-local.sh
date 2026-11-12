#!/usr/bin/env bash
# Run the whole app locally on Firebase emulators (no real Firebase/Drive needed).
#   Requires: Node 22+, Java 21+, firebase-tools (npx is used if not installed)
# Then open http://localhost:5173
set -euo pipefail
cd "$(dirname "$0")/.."
FIREBASE="${FIREBASE_BIN:-$(command -v firebase || echo 'npx -y firebase-tools')}"

(cd functions && [ -d node_modules ] || npm install) && (cd functions && npm run build)
(cd web && [ -d node_modules ] || npm install) && (cd web && npm run build:emu)

$FIREBASE emulators:start --project demo-regal --only auth,firestore,functions,hosting &
EMU=$!
trap 'kill $EMU 2>/dev/null' EXIT
until curl -sf http://127.0.0.1:5000 >/dev/null; do sleep 1; done
echo; echo "Emulators ready → UI: http://127.0.0.1:4000   App (built): http://127.0.0.1:5000"
cd web && npm run dev:emu -- --host
