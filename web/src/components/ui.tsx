import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { fileUrl, peekFileUrl } from "../api";
import { coverVT } from "./motion";
import type { Campaign } from "../types";

export const esc = (s: unknown) => String(s ?? "");
export const progress = (ts: { status: string }[]) =>
  ts.length ? Math.round((ts.filter((t) => t.status === "Approved").length / ts.length) * 100) : 0;
export const hours = (ts: { hours?: number }[]) => ts.reduce((s, t) => s + (Number(t.hours) || 0), 0);
export const stagger = (i: number): CSSProperties => ({ ["--i" as string]: Math.min(i, 12) });

export function Bar({ value }: { value: number }) {
  return <div className="bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><i style={{ width: value + "%" }} /></div>;
}

export function Pill({ children, kind }: { children: ReactNode; kind?: string }) {
  const k = kind ?? (children === "Revisions" ? "danger" : children === "High" ? "warn" : children === "In Review" ? "info" : children === "Approved" ? "ok" : "");
  return <span className={"pill " + k}>{children}</span>;
}

/** Animated number that counts up when it changes. */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(value); return; }
    const start = performance.now(), a = from.current, dur = 600;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (value - a) * e));
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown}</>;
}

/** Image/video/PDF stored on Google Drive, fetched through the cached file layer. */
export function DriveMedia({ fileId, mime, alt, className, style, onLoad }: {
  fileId: string; mime?: string; alt: string; className?: string; style?: CSSProperties; onLoad?: () => void;
}) {
  const cached = peekFileUrl(fileId);
  const [url, setUrl] = useState<string | null>(cached);
  const [err, setErr] = useState<string | null>(null);
  // Images seen before paint instantly (no fade-in), which keeps page transitions flicker-free.
  const [loaded, setLoaded] = useState(!!cached);
  useEffect(() => {
    const hit = peekFileUrl(fileId);
    if (hit) { setUrl(hit); setLoaded(true); setErr(null); return; }
    let alive = true;
    setUrl(null); setErr(null); setLoaded(false);
    fileUrl(fileId).then((u) => alive && setUrl(u)).catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [fileId]);
  if (err) return <div className={"media-error " + (className ?? "")} style={style}>⚠ {err}</div>;
  if (!url) return <div className={"skeleton " + (className ?? "")} style={{ minHeight: 120, ...style }} />;
  if (mime?.startsWith("video/")) return <video className={className} style={style} src={url} controls playsInline onLoadedData={onLoad} />;
  if (mime === "application/pdf") return <a className="btn secondary tiny" href={url} target="_blank" rel="noreferrer">Open PDF ↗</a>;
  return <img className={"fade-img " + (loaded ? "loaded " : "") + (className ?? "")} style={style} src={url} alt={alt} decoding="async" draggable={false}
    onLoad={() => { setLoaded(true); onLoad?.(); }} />;
}

export function Cover({ c, hero }: { c: Campaign; hero?: boolean }) {
  return (
    <div className="cover" style={{ background: c.color || "#71846d", ...coverVT(c.id, hero) }}>
      {c.coverFileId
        ? <DriveMedia fileId={c.coverFileId} alt="Campaign cover" className="cover-img" />
        : <div className="cover-text"><b>{c.label || "REGAL"}</b><span>REGAL JEWELLERS</span></div>}
    </div>
  );
}

export function Avatar({ name, photo, size = 28 }: { name?: string; photo?: string | null; size?: number }) {
  const initials = (name || "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return photo
    ? <img className="avatar" src={photo} alt="" width={size} height={size} referrerPolicy="no-referrer" />
    : <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>{initials}</span>;
}

export function Skeleton({ h = 16, w = "100%", r = 8 }: { h?: number; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}
export function SkeletonCards({ n = 3, h = 220 }: { n?: number; h?: number }) {
  return <div className="campaigns">{Array.from({ length: n }, (_, i) => <div className="card" key={i}><Skeleton h={h - 60} /><div style={{ height: 12 }} /><Skeleton h={14} w="60%" /></div>)}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty"><div className="empty-ico">◇</div>{children}</div>;
}

// ---------------- Toasts ----------------
type ToastT = { id: number; text: string; kind: "ok" | "err"; leaving?: boolean };
const ToastCtx = createContext<(text: string, kind?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ToastT[]>([]);
  const push = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setList((l) => [...l.slice(-3), { id, text, kind }]);
    setTimeout(() => setList((l) => l.map((t) => (t.id === id ? { ...t, leaving: true } : t))), 2600);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 2900);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {list.map((t) => <div key={t.id} className={"toast " + t.kind + (t.leaving ? " leaving" : "")}>{t.kind === "ok" ? "✓" : "!"} {t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------------- Modal ----------------
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const [render, setRender] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) { setRender(true); setClosing(false); }
    else if (render) { setClosing(true); const t = setTimeout(() => setRender(false), 200); return () => clearTimeout(t); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!render) return null;
  // Portal to <body> so animated (transformed) ancestors can't trap the fixed overlay.
  return createPortal(
    <div className={"modal-backdrop" + (closing ? " closing" : "")} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex"><h3 className="sectiontitle" style={{ margin: 0 }}>{title}</h3><button className="iconbtn" onClick={onClose} aria-label="Close">✕</button></div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmButton({ onConfirm, children, className = "btn tiny secondary", confirmText = "Are you sure?" }: {
  onConfirm: () => void; children: ReactNode; className?: string; confirmText?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  return <button type="button" className={className + (armed ? " armed" : "")} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>{armed ? confirmText : children}</button>;
}

export function fmtTime(t?: { toDate(): Date }) {
  if (!t?.toDate) return "just now";
  const d = t.toDate(), diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + " min ago";
  if (diff < 86400) return Math.floor(diff / 3600) + " h ago";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
export function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return isNaN(+d) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
export function overdue(t: { due: string; status: string }) {
  return t.status !== "Approved" && !!t.due && new Date(t.due + "T23:59:59") < new Date();
}
