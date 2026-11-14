import { Link, useNavigate, useParams } from "react-router-dom";
import { actions, useData } from "../data";
import { useMe } from "../auth";
import { ConfirmButton, DriveMedia, Empty, Pill, Skeleton, fmtDate, overdue, useToast } from "../components/ui";
import { LinkEditor } from "../components/Links";
import { TaskChat } from "../components/Chat";
import { VLink, useVTNavigate } from "../components/motion";
import { DESIGNER_STATUSES, STATUSES, type Task } from "../types";

export default function TaskDetail() {
  const { id } = useParams();
  const me = useMe();
  const admin = me.role === "Admin";
  const { task, user, campaign, users, ready } = useData();
  const toast = useToast();
  const nav = useVTNavigate();
  const t = task(id);
  if (!t) return ready.tasks ? <div className="card"><Empty>Task not found. <Link to="/tasks">Back to tasks</Link></Empty></div> : <Skeleton h={300} />;
  const statusOpts = admin ? STATUSES : Array.from(new Set([...DESIGNER_STATUSES, t.status]));
  const isAssignee = t.assigneeId === me.id;

  return (
    <>
      <VLink className="btn secondary tiny" to="/tasks">← Tasks</VLink>
      <div className="task-layout">
        <div className="card task-main">
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

              <div className="subcard">
                <h3 className="sectiontitle">🔗 Links & References</h3>
                <LinkEditor links={t.references ?? []} canEdit={admin}
                  onChange={(next) => actions.setReferences(t.id, next, (e) => toast(e.message, "err"))}
                  placeholder="Paste a reference link (Drive, Pinterest, website…)" empty="No reference links yet." />
              </div>
              {admin && <div style={{ marginTop: 14 }}><ConfirmButton confirmText="Tap again to delete" onConfirm={() => { void actions.deleteTask(t.id); nav("/tasks"); toast("Task deleted"); }}>Delete task</ConfirmButton></div>}
            </div>
            <div>
              <h3 className="sectiontitle">Progress & Submission</h3>
              <TaskForm t={t} statusOpts={statusOpts} key={t.id} />

              <div className="subcard final">
                <h3 className="sectiontitle">📁 Final file</h3>
                <p className="muted" style={{ marginTop: -8 }}>Share the Google Drive link of the final design (and a screenshot link if useful).</p>
                <LinkEditor big links={t.deliverables ?? []} canEdit={admin || isAssignee}
                  onChange={(next) => actions.setDeliverables(me, users, t, next, (e) => toast(e.message, "err"))}
                  placeholder="Paste Google Drive link of the final file" labelPlaceholder="e.g. Final PNG, Screenshot"
                  empty="No final file shared yet." />
                {t.fileId && (
                  <details className="legacy">
                    <summary className="muted">Previously uploaded file</summary>
                    <DriveMedia fileId={t.fileId} mime={t.fileMime} alt="Previously uploaded design" className="uploadpreview" />
                  </details>
                )}
              </div>
            </div>
          </div>
        </div>
        <TaskChat t={t} />
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
