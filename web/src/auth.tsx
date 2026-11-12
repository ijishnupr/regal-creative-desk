import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut as fbSignOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, callFunction } from "./firebase";
import type { UserProfile } from "./types";
import { clearFileCache } from "./api";

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "denied"; user: User; message: string }
  | { status: "ready"; user: User; profile: UserProfile };

const Ctx = createContext<AuthState & { signIn: () => Promise<void>; signOut: () => Promise<void> }>(null!);
export const useAuth = () => useContext(Ctx);
export function useMe() {
  const a = useAuth();
  if (a.status !== "ready") throw new Error("useMe outside signed-in area");
  return a.profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    const unsub = onAuthStateChanged(auth, (user) => {
      unsubProfile?.();
      if (!user) { setState({ status: "signedOut" }); return; }
      let ensured = false;
      // Cached profile renders instantly; server copy follows.
      unsubProfile = onSnapshot(doc(db, "users", user.uid), { includeMetadataChanges: false }, async (snap) => {
        if (snap.exists()) {
          const profile = { id: snap.id, ...snap.data() } as UserProfile;
          if (profile.active === false) setState({ status: "denied", user, message: "Your account has been deactivated." });
          else setState({ status: "ready", user, profile });
          return;
        }
        if (snap.metadata.fromCache || ensured) return;
        ensured = true;
        try {
          await callFunction("ensureProfile");
        } catch (e) {
          setState({ status: "denied", user, message: (e as Error).message.replace(/^.*?:\s*/, "").replace(/\s*\[\d+\]$/, "") });
        }
      }, (err) => setState({ status: "denied", user, message: err.message }));
    });
    return () => { unsub(); unsubProfile?.(); };
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(auth, provider);
      } else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") throw e;
    }
  };
  const signOut = async () => { await clearFileCache(); await fbSignOut(auth); };

  return <Ctx.Provider value={{ ...state, signIn, signOut }}>{children}</Ctx.Provider>;
}
