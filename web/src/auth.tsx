import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut as fbSignOut, type User } from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, writeBatch, collection } from "firebase/firestore";
import { auth, db } from "./firebase";
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

/**
 * First sign-in: create the user's profile. Firestore rules only allow this when
 * an Admin invited this email (role taken from the invite), or when nobody has
 * signed up yet (the first user becomes Admin).
 */
async function registerProfile(user: User) {
  const email = (user.email || "").toLowerCase();
  if (!email) throw new Error("Your Google account has no email address.");
  const [invite, boot] = await Promise.all([
    getDoc(doc(db, "invites", email)).catch(() => null),
    getDoc(doc(db, "meta", "bootstrap")),
  ]);
  const b = writeBatch(db);
  let role: "Admin" | "Designer";
  let name = user.displayName || email.split("@")[0];
  if (invite?.exists()) {
    role = invite.get("role") === "Admin" ? "Admin" : "Designer";
    name = invite.get("name") || name;
    b.delete(invite.ref);
  } else if (!boot.exists()) {
    role = "Admin";
    b.set(boot.ref, { firstAdmin: user.uid, at: serverTimestamp() });
  } else {
    throw new Error("You have not been invited yet. Ask a Creative Desk admin to add your email.");
  }
  b.set(doc(db, "users", user.uid), {
    name, email, role, photoURL: user.photoURL ?? null, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  b.set(doc(collection(db, "activity")), { text: `${name} joined as ${role}`, actorUid: user.uid, campaignId: null, createdAt: serverTimestamp() });
  await b.commit();
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
      unsubProfile = onSnapshot(doc(db, "users", user.uid), { includeMetadataChanges: true }, async (snap) => {
        // Wait until the server has accepted a brand-new profile, otherwise the
        // data listeners would start before security rules can see it.
        if (snap.metadata.hasPendingWrites) return;
        if (snap.exists()) {
          const profile = { id: snap.id, ...snap.data() } as UserProfile;
          if (profile.active === false) setState({ status: "denied", user, message: "Your account has been deactivated." });
          else setState({ status: "ready", user, profile });
          return;
        }
        if (snap.metadata.fromCache || ensured) return;
        ensured = true;
        try {
          await registerProfile(user);
        } catch (e) {
          setState({ status: "denied", user, message: /permission|insufficient/i.test((e as Error).message) ? "You have not been invited yet. Ask a Creative Desk admin to add your email." : (e as Error).message });
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
