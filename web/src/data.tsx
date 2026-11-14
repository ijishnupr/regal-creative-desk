import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  collection, doc, onSnapshot, query, where, orderBy, limit, writeBatch, serverTimestamp,
  updateDoc, setDoc, deleteDoc, arrayUnion, type QueryConstraint, type WriteBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { useMe } from "./auth";
import type { Activity, Annotation, Campaign, Invite, Notification, Status, Task, UserProfile } from "./types";

interface Data {
  campaigns: Campaign[]; tasks: Task[]; users: UserProfile[]; invites: Invite[];
  notifications: Notification[]; activity: Activity[];
  ready: { campaigns: boolean; tasks: boolean; users: boolean };
  campaign: (id?: string) => Campaign | undefined;
  user: (id?: string) => UserProfile | undefined;
  task: (id?: string) => Task | undefined;
}
const Ctx = createContext<Data>(null!);
export const useData = () => useContext(Ctx);

function useLive<T>(path: string, constraints: QueryConstraint[], enabled: boolean, deps: unknown[]) {
  const [rows, setRows] = useState<T[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) { setRows([]); setReady(true); return; }
    let unsub: (() => void) | undefined, timer: ReturnType<typeof setTimeout> | undefined, tries = 0;
    const listen = () => {
      unsub = onSnapshot(query(collection(db, path), ...constraints), (snap) => {
        tries = 0;
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }) as T));
        setReady(true);
      }, (err) => {
        // A listener stops on error (e.g. a role change in flight): retry with backoff.
        console.warn(path, err.code);
        setReady(true);
        if (tries < 6) timer = setTimeout(listen, 500 * 2 ** tries++);
      });
    };
    listen();
    return () => { unsub?.(); clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [rows, ready] as const;
}

const ts = (x?: { toMillis(): number }) => x?.toMillis?.() ?? Date.now();

export function DataProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const admin = me.role === "Admin";
  const [campaigns, cReady] = useLive<Campaign>("campaigns", [], true, []);
  const [users, uReady] = useLive<UserProfile>("users", [], true, []);
  const [tasks, tReady] = useLive<Task>("tasks", admin ? [] : [where("assigneeId", "==", me.id)], true, [admin, me.id]);
  const [invites] = useLive<Invite>("invites", [], admin, [admin]);
  const notifications = useNotifications(me.id);
  const [activity] = useLive<Activity>("activity", [orderBy("createdAt", "desc"), limit(150)], true, []);

  const value = useMemo<Data>(() => {
    const cs = [...campaigns].sort((a, b) => ts(a.createdAt) - ts(b.createdAt));
    const tk = [...tasks].sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
    const us = [...users].sort((a, b) => a.name.localeCompare(b.name));
    const cMap = new Map(cs.map((c) => [c.id, c])), uMap = new Map(us.map((u) => [u.id, u])), tMap = new Map(tk.map((t) => [t.id, t]));
    return {
      campaigns: cs, tasks: tk, users: us, invites, notifications, activity,
      ready: { campaigns: cReady, tasks: tReady, users: uReady },
      campaign: (id) => (id ? cMap.get(id) : undefined),
      user: (id) => (id ? uMap.get(id) : undefined),
      task: (id) => (id ? tMap.get(id) : undefined),
    };
  }, [campaigns, tasks, users, invites, notifications, activity, cReady, tReady, uReady]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Live notifications for one user. Prefers the indexed query (newest 100);
 * if the composite index (toUid ↑, createdAt ↓) hasn't been created in the
 * Firebase console yet, falls back to an unindexed query sorted on the device,
 * so notifications always work.
 */
function useNotifications(uid: string) {
  const [rows, setRows] = useState<Notification[]>([]);
  useEffect(() => {
    let unsub: (() => void) | undefined, timer: ReturnType<typeof setTimeout> | undefined, tries = 0;
    const col = collection(db, "notifications");
    const toRows = (docs: { id: string; data: (o: object) => object }[]) => docs
      .map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }) as Notification)
      .sort((a, b) => ts(b.createdAt) - ts(a.createdAt)).slice(0, 100);
    const listen = (indexed: boolean) => {
      const q = indexed
        ? query(col, where("toUid", "==", uid), orderBy("createdAt", "desc"), limit(100))
        : query(col, where("toUid", "==", uid));
      unsub = onSnapshot(q, (snap) => { tries = 0; setRows(toRows(snap.docs)); }, (err) => {
        if (indexed && err.code === "failed-precondition") {
          console.warn("Notifications index missing — using fallback query. Create it via the link:", err.message);
          listen(false);
        } else if (tries < 6) {
          timer = setTimeout(() => listen(indexed), 500 * 2 ** tries++);
        }
      });
    };
    listen(true);
    return () => { unsub?.(); clearTimeout(timer); };
  }, [uid]);
  return rows;
}

/** Live annotations for one task (subcollection). */
export function useAnnotations(taskId?: string) {
  const [rows, setRows] = useState<Annotation[]>([]);
  useEffect(() => {
    if (!taskId) return;
    return onSnapshot(query(collection(db, "tasks", taskId, "annotations"), orderBy("createdAt", "asc")), (snap) =>
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }) as Annotation)));
  }, [taskId]);
  return rows;
}

// ------------------------------------------------------------------
// Mutations. All writes are applied to the local cache instantly by
// Firestore; we never block the UI waiting for the server round-trip.
// ------------------------------------------------------------------

type Me = UserProfile;
const newId = (col: string) => doc(collection(db, col)).id;

function log(b: WriteBatch, me: Me, text: string, campaignId: string | null = null) {
  b.set(doc(collection(db, "activity")), { text, campaignId, actorUid: me.id, createdAt: serverTimestamp() });
}
function notify(b: WriteBatch, me: Me, toUids: (string | undefined)[], taskId: string | null, message: string) {
  for (const to of new Set(toUids.filter(Boolean) as string[])) {
    if (to === me.id) continue;
    b.set(doc(collection(db, "notifications")), { toUid: to, fromUid: me.id, taskId, message, read: false, createdAt: serverTimestamp() });
  }
}
const admins = (users: UserProfile[]) => users.filter((u) => u.role === "Admin" && u.active !== false).map((u) => u.id);

/** Commit in the background; surface failures through onError. */
function fire(b: WriteBatch, onError?: (e: Error) => void) {
  b.commit().catch((e) => { console.error(e); onError?.(e); });
}

export const actions = {
  createCampaign(me: Me, c: Omit<Campaign, "id" | "createdAt" | "coverFileId">, onError?: (e: Error) => void) {
    const id = newId("campaigns");
    const b = writeBatch(db);
    b.set(doc(db, "campaigns", id), { ...c, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    log(b, me, `Campaign ${c.name} created`, id);
    fire(b, onError);
    return id;
  },
  updateCampaign(id: string, patch: Partial<Campaign>) {
    return updateDoc(doc(db, "campaigns", id), { ...patch, updatedAt: serverTimestamp() });
  },
  createTask(me: Me, assigneeName: string, t: Omit<Task, "id" | "createdAt" | "updatedAt" | "status" | "submission" | "feedback" | "hours">, onError?: (e: Error) => void) {
    const id = newId("tasks");
    const b = writeBatch(db);
    b.set(doc(db, "tasks", id), { ...t, status: "To Do", submission: "", feedback: "", hours: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    log(b, me, `${t.title} assigned to ${assigneeName}`, t.campaignId);
    notify(b, me, [t.assigneeId], id, `New task assigned: ${t.title} · due ${t.due}`);
    fire(b, onError);
    return id;
  },
  saveTask(me: Me, users: UserProfile[], t: Task, patch: Partial<Pick<Task, "status" | "hours" | "submission" | "feedback">>, onError?: (e: Error) => void) {
    const admin = me.role === "Admin";
    const next = { ...t, ...patch };
    const b = writeBatch(db);
    const clean: Record<string, unknown> = { status: next.status, hours: Number(next.hours) || 0, submission: next.submission, updatedAt: serverTimestamp() };
    if (admin) clean.feedback = next.feedback;
    b.update(doc(db, "tasks", t.id), clean);
    const assignee = users.find((u) => u.id === t.assigneeId);
    if (!admin && next.status === "In Review" && t.status !== "In Review")
      notify(b, me, admins(users), t.id, `${assignee?.name ?? "A designer"} submitted ${t.title} for review`);
    if (admin && next.status === "Revisions" && (t.status !== "Revisions" || t.feedback !== next.feedback))
      notify(b, me, [t.assigneeId], t.id, `Corrections requested on ${t.title}${next.feedback ? ": " + next.feedback : ""}`);
    if (admin && next.status === "Approved" && t.status !== "Approved")
      notify(b, me, [t.assigneeId], t.id, `Your design was approved: ${t.title}`);
    log(b, me, `${t.title} updated to ${next.status}`, t.campaignId);
    fire(b, onError);
  },
  review(me: Me, t: Task, status: Status, onError?: (e: Error) => void) {
    const b = writeBatch(db);
    b.update(doc(db, "tasks", t.id), { status, updatedAt: serverTimestamp() });
    notify(b, me, [t.assigneeId], t.id, status === "Revisions" ? `Admin requested corrections: ${t.title}${t.feedback ? " · " + t.feedback : ""}` : `Admin approved: ${t.title}`);
    log(b, me, `${t.title} marked ${status}`, t.campaignId);
    fire(b, onError);
  },
  attachTaskFile(me: Me, taskId: string, fileId: string, fileName: string, fileMime: string, onError?: (e: Error) => void) {
    updateDoc(doc(db, "tasks", taskId), {
      fileId, fileName, fileMime, updatedAt: serverTimestamp(),
      fileVersions: arrayUnion({ fileId, fileName, at: Date.now(), by: me.id }),
    }).catch((e) => onError?.(e));
  },
  setCover(campaignId: string, fileId: string, onError?: (e: Error) => void) {
    updateDoc(doc(db, "campaigns", campaignId), { coverFileId: fileId, updatedAt: serverTimestamp() }).catch((e) => onError?.(e));
  },
  deleteTask(id: string) { return deleteDoc(doc(db, "tasks", id)); },
  addAnnotation(me: Me, t: Task, x: number, y: number, text: string, onError?: (e: Error) => void) {
    const b = writeBatch(db);
    b.set(doc(collection(db, "tasks", t.id, "annotations")), { x, y, text, authorName: me.name, authorUid: me.id, resolved: false, createdAt: serverTimestamp() });
    if (t.status !== "Revisions") b.update(doc(db, "tasks", t.id), { status: "Revisions", updatedAt: serverTimestamp() });
    notify(b, me, [t.assigneeId], t.id, `New pinned correction on ${t.title}: ${text}`);
    log(b, me, `${me.name} added an artwork correction to ${t.title}`, t.campaignId);
    fire(b, onError);
  },
  resolveAnnotation(me: Me, users: UserProfile[], t: Task, annId: string, onError?: (e: Error) => void) {
    const b = writeBatch(db);
    b.update(doc(db, "tasks", t.id, "annotations", annId), { resolved: true, resolvedAt: serverTimestamp(), resolvedBy: me.id });
    notify(b, me, admins(users), t.id, `${me.name} marked artwork correction resolved on ${t.title}`);
    log(b, me, `Artwork correction resolved: ${t.title}`, t.campaignId);
    fire(b, onError);
  },
  deleteAnnotation(t: Task, annId: string) { return deleteDoc(doc(db, "tasks", t.id, "annotations", annId)); },
  invite(email: string, name: string, role: "Admin" | "Designer") {
    const e = email.trim().toLowerCase();
    return setDoc(doc(db, "invites", e), { email: e, name: name.trim(), role, createdAt: serverTimestamp() });
  },
  cancelInvite(email: string) { return deleteDoc(doc(db, "invites", email)); },
  setRole(me: Me, u: UserProfile, role: "Admin" | "Designer") {
    const b = writeBatch(db);
    b.update(doc(db, "users", u.id), { role, updatedAt: serverTimestamp() });
    log(b, me, `${u.name} role changed to ${role}`);
    return b.commit();
  },
  setActive(me: Me, u: UserProfile, active: boolean) {
    const b = writeBatch(db);
    b.update(doc(db, "users", u.id), { active, updatedAt: serverTimestamp() });
    log(b, me, `${u.name} ${active ? "re-activated" : "deactivated"}`);
    return b.commit();
  },
  markRead(id: string) { void updateDoc(doc(db, "notifications", id), { read: true }); },
  markAllRead(ns: Notification[]) {
    const unread = ns.filter((n) => !n.read);
    for (let i = 0; i < unread.length; i += 400) {
      const b = writeBatch(db);
      unread.slice(i, i + 400).forEach((n) => b.update(doc(db, "notifications", n.id), { read: true }));
      fire(b);
    }
  },
};
