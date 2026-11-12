#!/usr/bin/env bash
# Run the app locally against Firebase emulators (Auth + Firestore). No real
# Firebase project or Drive needed: uploads go to scripts/.local-drive (mock of the Apps Script).
#   Requires: Node 22+, Java 21+, firebase-tools (npx is used if not installed)
# Then open http://localhost:5173
set -euo pipefail
cd "$(dirname "$0")/.."
FIREBASE="${FIREBASE_BIN:-$(command -v firebase || echo 'npx -y firebase-tools')}"
(cd web && [ -d node_modules ] || npm install)
$FIREBASE emulators:start --project demo-regal --only auth,firestore &
EMU=$!
trap 'kill $EMU 2>/dev/null' EXIT
until curl -sf http://127.0.0.1:8080 >/dev/null; do sleep 1; done
node scripts/mock-storage.mjs &
MOCK=$!
trap 'kill $EMU $MOCK 2>/dev/null' EXIT
echo; echo "Emulators ready → data viewer: http://127.0.0.1:4000"
cd web && npm run dev:emu -- --port 5173 --strictPort
