import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { actions, useData } from "../data";
import { useMe } from "../auth";
import { useToast } from "../components/ui";
import { uploadCover } from "../components/Upload";

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export default function NewCampaign() {
  const me = useMe();
  const { users } = useData();
  const nav = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const [upcoming, setUpcoming] = useState(sp.get("upcoming") === "1");
  const [color, setColor] = useState("#71846d");
  const [label, setLabel] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div className="card">
      <h2 className="sectiontitle">{upcoming ? "Plan Upcoming Campaign" : "Create Campaign"}</h2>
      <div className="seg" role="tablist">
        <button type="button" className={!upcoming ? "on" : ""} onClick={() => setUpcoming(false)}>Active now</button>
        <button type="button" className={upcoming ? "on" : ""} onClick={() => setUpcoming(true)}>Upcoming</button>
      </div>
      <label className="cover cover-pick" style={{ background: color, margin: "14px 0", transition: "background .3s" }}>
        {preview ? <img className="cover-img" src={preview} alt="Cover preview" /> : <div className="cover-text"><b>{label || "REGAL"}</b><span>REGAL JEWELLERS</span></div>}
        <span className="cover-cta">{preview ? "Change cover image" : "⇪ Add cover image (optional)"}</span>
        <input type="file" accept="image/*" hidden onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setCover(f);
          setPreview((old) => { if (old) URL.revokeObjectURL(old); return f ? URL.createObjectURL(f) : null; });
        }} />
      </label>
      <form className="fields" style={{ gridTemplateColumns: "1fr" }} onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        const name = String(d.get("name")).trim();
        const { id, saved } = actions.createCampaign(me, {
          name, label: String(d.get("label") || "REGAL").trim().toUpperCase(),
          color: String(d.get("color")), description: String(d.get("description")), objective: String(d.get("objective")),
          ownerId: String(d.get("owner")),
          stage: upcoming ? "Upcoming" : "Active",
          startDate: String(d.get("startDate") || ""), endDate: String(d.get("endDate") || ""),
        });
        saved.catch((err) => toast(err.message, "err"));
        if (cover) {
          toast("Campaign created · uploading cover…");
          saved.then(() => uploadCover(id, cover, undefined, (err) => toast(err.message, "err")))
            .then(() => toast("Cover uploaded to Google Drive"), (err) => toast("Cover upload failed: " + err.message, "err"));
        } else toast(upcoming ? "Upcoming campaign planned" : "Campaign created");
        nav(upcoming ? "/campaigns?view=upcoming" : `/campaigns/${id}`);
      }}>
        <div className="fields">
          <label className="field">Campaign name<input name="name" required /></label>
          <label className="field">Cover label<input name="label" placeholder="e.g. WRP" maxLength={12} value={label} onChange={(e) => setLabel(e.target.value.toUpperCase())} /></label>
          <label className="field">{upcoming ? "Start date" : "Start date (optional)"}<input name="startDate" type="date" required={upcoming} min={upcoming ? today() : undefined} /></label>
          <label className="field">End date (optional)<input name="endDate" type="date" /></label>
          <label className="field">Theme colour<input name="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
          <label className="field">Campaign owner
            <select name="owner" defaultValue={me.id}>{users.filter((u) => u.active !== false).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          </label>
        </div>
        <label className="field">Description<textarea name="description" placeholder={upcoming ? "Idea, occasion, channels, budget notes…" : ""} /></label>
        <label className="field">Main campaign copy<input name="objective" /></label>
        {upcoming && <div className="hint" style={{ marginTop: 0 }}>Upcoming campaigns appear in the <b>Upcoming</b> list with a countdown and become active automatically on the start date. You can already assign preparation tasks to them.</div>}
        <div><button className="btn" type="submit">{upcoming ? "Plan Campaign" : "Create Campaign"}</button></div>
      </form>
    </div>
  );
}
