import { useNavigate, useSearchParams } from "react-router-dom";
import { actions, useData } from "../data";
import { useMe } from "../auth";
import { Empty, useToast } from "../components/ui";
import { PRIORITIES, isUpcoming, type Priority } from "../types";
import { normalizeUrl } from "../components/Links";
import { Link } from "react-router-dom";

export default function NewTask() {
  const me = useMe();
  const { campaigns, users } = useData();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const designers = users.filter((u) => u.role === "Designer" && u.active !== false);
  const due = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  if (!campaigns.length) return <div className="card"><Empty>Create a campaign first. <Link to="/campaigns/new">New campaign →</Link></Empty></div>;
  return (
    <div className="card">
      <h2 className="sectiontitle">Assign New Work</h2>
      <p className="muted">Include the full content brief so the designer knows exactly what to create.</p>
      <form className="fields" style={{ gridTemplateColumns: "1fr" }} onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        const assigneeId = String(d.get("assignee"));
        const references = String(d.get("references") || "").split(/\n+/).map((l) => l.trim()).filter(Boolean).flatMap((line) => {
          // "Label | https://…" or just a URL
          const [a, b] = line.includes("|") ? line.split("|").map((x) => x.trim()) : ["", line];
          const url = normalizeUrl(b);
          try { new URL(url); return [{ label: a, url }]; } catch { return []; }
        });
        const id = actions.createTask(me, users.find((u) => u.id === assigneeId)?.name ?? "designer", {
          campaignId: String(d.get("campaignId")), title: String(d.get("title")).trim(), assigneeId,
          priority: String(d.get("priority")) as Priority, due: String(d.get("due")), format: String(d.get("format")),
          copy: String(d.get("copy")), instructions: String(d.get("instructions")), references, deliverables: [],
        }, (err) => toast(err.message, "err"));
        toast("Task assigned");
        nav(`/tasks/${id}`);
      }}>
        <div className="fields" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          <label className="field">Task title<input name="title" required placeholder="Instagram Story" /></label>
          <label className="field">Campaign<select name="campaignId" defaultValue={sp.get("campaign") ?? campaigns[0].id}>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}{isUpcoming(c) ? " (upcoming)" : ""}</option>)}</select></label>
          <label className="field">Assign Designer<select name="assignee" required>{designers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <label className="field">Deadline<input name="due" type="date" defaultValue={due} required /></label>
          <label className="field">Priority<select name="priority" defaultValue="Medium">{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label className="field">Format / Dimensions<input name="format" placeholder="1080 × 1920" required /></label>
        </div>
        <label className="field">Content / Exact Copy<textarea name="copy" placeholder="Headline, supporting copy and CTA" /></label>
        <label className="field">Design Instructions<textarea name="instructions" placeholder="Colours, layout, product reference, mandatory elements" /></label>
        <label className="field">Links & References <span className="muted" style={{ fontWeight: 400 }}>one per line · optional "Label | link"</span>
          <textarea name="references" style={{ minHeight: 70 }} placeholder={"Brochure | https://drive.google.com/…\nhttps://pinterest.com/…"} />
        </label>
        {!designers.length && <div className="hint">No designers yet. Invite one from <Link to="/team">Employees</Link>.</div>}
        <div><button className="btn" type="submit" disabled={!designers.length}>Create & Assign Task</button></div>
      </form>
    </div>
  );
}
