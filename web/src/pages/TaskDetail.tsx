import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { actions, useAnnotations, useData } from "../data";
import { useMe } from "../auth";
import { ConfirmButton, DriveMedia, Empty, Modal, Pill, Skeleton, fmtDate, fmtTime, overdue, stagger, useToast } from "../components/ui";
import { Upload } from "../components/Upload";
import { DESIGNER_STATUSES, STATUSES, type Task } from "../types";

export default function TaskDetail() {
  const { id } = useParams();
  const me = useMe();
  const admin = me.role === "Admin";
  const { task, user, campaign, ready } = useData();
  const toast = useToast();
  const t = task(id);
  if (!t) return ready.tasks ? <div className="card"><Empty>Task not found. <Link to="/tasks">Back to tasks</Link></Empty></div> : <Skeleton h={300} />;
  const statusOpts = admin ? STATUSES : Array.from(new Set([...DESIGNER_STATUSES, t.status]));

  return (
    <>
      <Link className="btn secondary tiny" to="/tasks">← Tasks</Link>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="flex">
          <div>
            <Link className="pill" to={`/campaigns/${t.campaignId}`}>{campaign(t.campaignId)?.name}</Link>
            <h2>{t.title}</h2>
            <p className="muted">Assigned to {user(t.assigneeId)?.name} · Deadline {fmtDate(t.due)} · {t.format} {overdue(t) && <Pill kind="late">Overdue</Pill>}</p>
          </div>
          <Pill>{t.status}</Pill>
        </div>
        <div className="twocol">
          <div>
            <h3 className="sectiontitle">Content Brief</h3>
            <p><b>Approved copy</b></p><p style={{ whiteSpace: "pre-wrap" }}>{t.copy || "Not specified"}</p>
            <p><b>Design instructions</b></p><p style={{ whiteSpace: "pre-wrap" }}>{t.instructions || "Not specified"}</p>
            <p><b>Priority:</b> {t.priority}</p>
            {admin && <ConfirmButton confirmText="Tap again to delete" onConfirm={() => { void actions.deleteTask(t.id); history.back(); toast("Task deleted"); }}>Delete task</ConfirmButton>}
          </div>
          <div>
            <h3 className="sectiontitle">Progress & Submission</h3>
            <TaskForm t={t} statusOpts={statusOpts} key={t.id} />
            <div style={{ marginTop: 13 }}>
              <div className="field" style={{ marginBottom: 6 }}>Design file (stored in Google Drive)</div>
              {t.fileId && <div style={{ marginBottom: 10 }}><DriveMedia fileId={t.fileId} mime={t.fileMime} alt="Submitted design" className="uploadpreview" /><div className="muted">{t.fileName}</div></div>}
              <Upload kind="task" id={t.id} label={t.fileId ? "Upload new version" : "Upload design"} />
            </div>
          </div>
        </div>
        <Annotations t={t} />
      </div>
    </>
  );
}

function TaskForm({ t, statusOpts }: { t: Task; statusOpts: readonly string[] }) {
  const me = useMe();
  const admin = me.role === "Admin";
  const { users } = useData();
  const toast = useToast();
  return (
    <form className="fields" onSubmit={(e) => {
      e.preventDefault();
      const d = new FormData(e.currentTarget);
      actions.saveTask(me, users, t, {
        status: String(d.get("status")) as Task["status"], hours: Number(d.get("hours")) || 0,
        submission: String(d.get("submission") ?? ""), ...(admin ? { feedback: String(d.get("feedback") ?? "") } : {}),
      }, (err) => toast(err.message, "err"));
      toast("Task saved");
    }}>
      <label className="field">Status<select name="status" defaultValue={t.status}>{statusOpts.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="field">Hours worked<input type="number" min="0" step="0.5" name="hours" defaultValue={Number(t.hours) || 0} /></label>
      <label className="field wide">Submission title<input name="submission" defaultValue={t.submission} placeholder="e.g. WRP Story v2" /></label>
      {admin
        ? <label className="field wide">Admin feedback<textarea name="feedback" defaultValue={t.feedback} /></label>
        : <p className="muted wide">Admin feedback: {t.feedback || "No feedback yet"}</p>}
      <div className="wide"><button className="btn" type="submit">Save Task Update</button></div>
    </form>
  );
}

function Annotations({ t }: { t: Task }) {
  const me = useMe();
  const admin = me.role === "Admin";
  const { users } = useData();
  const anns = useAnnotations(t.id);
  const toast = useToast();
  const stage = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [text, setText] = useState("");
  const [hl, setHl] = useState<string | null>(null);
  const isImage = !t.fileMime || t.fileMime.startsWith("image/");

  useEffect(() => { if (!hl) return; const x = setTimeout(() => setHl(null), 1800); return () => clearTimeout(x); }, [hl]);

  function place(e: React.MouseEvent) {
    if (!admin || !stage.current || (e.target as HTMLElement).closest(".annotation-pin")) return;
    const r = stage.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    setDraft({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
    setText("");
  }
  function focus(id: string) {
    setHl(id);
    document.getElementById("ann-" + id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="card" style={{ marginTop: 18, background: "#fcfbf9" }}>
      <div className="flex">
        <div>
          <h3 className="sectiontitle" style={{ margin: 0 }}>Artwork Corrections</h3>
          <p className="muted">{admin ? "Click directly on the uploaded design to place a numbered correction pin." : "Open each pin and mark it resolved after editing."}</p>
        </div>
        <Pill>{anns.filter((a) => !a.resolved).length} open comments</Pill>
      </div>
      {t.fileId && isImage ? (
        <>
          <div className="annotation-toolbar">
            <Pill>{admin ? "✎ Click artwork to add correction" : "◉ Click pins to read feedback"}</Pill>
            <span className="muted">Pin positions are saved relative to the image.</span>
          </div>
          <div ref={stage} className={"annotation-stage" + (admin ? "" : " readonly")} onClick={place} role="img" aria-label="Submitted artwork with correction pins">
            <DriveMedia fileId={t.fileId} mime={t.fileMime} alt="Design submitted for review" style={{ minWidth: 240 }} />
            {anns.map((a, i) => (
              <button key={a.id} type="button" className={"annotation-pin" + (a.resolved ? " resolved" : "") + (hl === a.id ? " hl" : "")}
                style={{ left: a.x + "%", top: a.y + "%", animationDelay: i * 60 + "ms" }} title={`Correction ${i + 1}: ${a.text}`}
                onClick={(e) => { e.stopPropagation(); focus(a.id); }}>{i + 1}</button>
            ))}
            {draft && <span className="annotation-pin ghost" style={{ left: draft.x + "%", top: draft.y + "%" }}>+</span>}
          </div>
        </>
      ) : <div className="hint">{t.fileId ? "Pinned corrections are available for image submissions." : "Upload a design image in Progress & Submission, then return here to add image-specific corrections."}</div>}

      <div style={{ marginTop: 16 }}>
        <b className="mini">Correction thread</b>
        {anns.length ? <div className="stagger">{anns.map((a, i) => (
          <div key={a.id} id={"ann-" + a.id} style={stagger(i)} className={"annotation-comment" + (a.resolved ? " resolved" : "") + (hl === a.id ? " hl" : "")}
            onMouseEnter={() => setHl(a.id)}>
            <div className="flex"><b>Pin {i + 1} · {a.resolved ? "Resolved" : "Correction requested"}</b><span className="muted">{a.authorName}</span></div>
            <p style={{ whiteSpace: "pre-wrap", margin: "7px 0" }}>{a.text}</p>
            <small>{fmtTime(a.createdAt)}</small>
            <div className="actions">
              {!a.resolved && !admin && <button className="btn tiny" onClick={() => { actions.resolveAnnotation(me, users, t, a.id, (e) => toast(e.message, "err")); toast("Correction marked resolved"); }}>Mark corrected ✓</button>}
              {a.resolved && <Pill kind="ok">✓ Resolved</Pill>}
              {admin && <ConfirmButton confirmText="Delete?" onConfirm={() => void actions.deleteAnnotation(t, a.id)}>Remove</ConfirmButton>}
            </div>
          </div>
        ))}</div> : <p className="muted">No pinned corrections yet.</p>}
      </div>

      <Modal open={!!draft} onClose={() => setDraft(null)} title="Add correction">
        <form className="fields" style={{ gridTemplateColumns: "1fr" }} onSubmit={(e) => {
          e.preventDefault();
          if (!draft || !text.trim()) return;
          actions.addAnnotation(me, t, draft.x, draft.y, text.trim(), (err) => toast(err.message, "err"));
          setDraft(null);
          toast("Pinned correction sent to designer");
        }}>
          <label className="field">Write the correction for this marked area
            <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Increase logo size, align price tag with headline" />
          </label>
          <div className="actions"><button className="btn" type="submit" disabled={!text.trim()}>Add pin</button><button type="button" className="btn secondary" onClick={() => setDraft(null)}>Cancel</button></div>
        </form>
      </Modal>
    </div>
  );
}
