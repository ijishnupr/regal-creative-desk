import { useState } from "react";
import type { LinkItem } from "../types";

/** Google Drive file id from common share-link shapes, if any. */
export function driveId(url: string) {
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/)
    || url.match(/docs\.google\.com\/\w+\/d\/([\w-]{20,})/);
  return m?.[1] ?? null;
}
const isImageUrl = (u: string) => /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(u);
export function normalizeUrl(raw: string) {
  const s = raw.trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : "https://" + s;
}
function hostLabel(u: string) {
  try { const h = new URL(u).hostname.replace(/^www\./, ""); return h.includes("drive.google") || h.includes("docs.google") ? "Google Drive" : h; }
  catch { return "Link"; }
}

/** Thumbnail for Drive / direct image links. Drive previews load when the viewer's Google account can see the file. */
function Thumb({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const id = driveId(url);
  const src = id ? `https://drive.google.com/thumbnail?id=${id}&sz=w480` : isImageUrl(url) ? url : null;
  if (!src || failed) return <span className="link-ico">{id ? "▲" : "🔗"}</span>;
  return <img className="link-thumb fade-img" src={src} alt="" loading="lazy" referrerPolicy="no-referrer"
    onLoad={(e) => e.currentTarget.classList.add("loaded")} onError={() => setFailed(true)} />;
}

export function LinkList({ links, big }: { links: LinkItem[]; big?: boolean }) {
  return (
    <div className={"links" + (big ? " big" : "")}>
      {links.map((l, i) => (
        <a key={i} className="link-card" href={l.url} target="_blank" rel="noreferrer noopener">
          <Thumb url={l.url} />
          <span className="link-text"><b>{l.label || hostLabel(l.url)}</b><small>{hostLabel(l.url)} ↗</small></span>
        </a>
      ))}
    </div>
  );
}

/** View + (optionally) edit a list of labelled links. */
export function LinkEditor({ links, canEdit, onChange, placeholder, labelPlaceholder = "Label (optional)", empty, big }: {
  links: LinkItem[]; canEdit: boolean; onChange?: (next: LinkItem[]) => void;
  placeholder: string; labelPlaceholder?: string; empty: string; big?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [editing, setEditing] = useState(false);
  const add = () => {
    const u = normalizeUrl(url);
    if (!u) return;
    try { new URL(u); } catch { return; }
    onChange?.([...links, { url: u, label: label.trim() }]);
    setUrl(""); setLabel("");
  };
  return (
    <div>
      {links.length ? <LinkList links={links} big={big} /> : <p className="muted">{empty}</p>}
      {canEdit && editing && links.length > 0 && (
        <div className="link-remove">
          {links.map((l, i) => (
            <button key={i} type="button" className="chip" onClick={() => onChange?.(links.filter((_, j) => j !== i))}>✕ {l.label || hostLabel(l.url)}</button>
          ))}
        </div>
      )}
      {canEdit && (
        <div className="link-add">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={placeholder} inputMode="url"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={labelPlaceholder}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button type="button" className="btn tiny" onClick={add} disabled={!url.trim()}>+ Add</button>
          {links.length > 0 && <button type="button" className="btn tiny secondary" onClick={() => setEditing((v) => !v)}>{editing ? "Done" : "Remove…"}</button>}
        </div>
      )}
    </div>
  );
}
