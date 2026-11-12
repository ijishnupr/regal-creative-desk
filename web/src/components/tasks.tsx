import { useNavigate } from "react-router-dom";
import { useData, actions } from "../data";
import { useMe } from "../auth";
import type { Task } from "../types";
import { DriveMedia, Empty, Pill, fmtDate, overdue, stagger, useToast } from "./ui";
import { prefetchFile } from "../api";

export function TaskTable({ tasks, showCampaign = true }: { tasks: Task[]; showCampaign?: boolean }) {
  const { user, campaign } = useData();
  const nav = useNavigate();
  return (
    <div className="card tablewrap">
      <table className="tbl responsive stagger">
        <thead><tr><th>Task</th><th>Designer</th><th>Deadline</th><th>Priority</th><th>Status</th><th className="hide-sm" /></tr></thead>
        <tbody>
          {tasks.map((t, i) => (
            <tr key={t.id} className="click" style={stagger(i)} onClick={() => nav(`/tasks/${t.id}`)} onMouseEnter={() => prefetchFile(t.fileId)}>
              <td className="primary"><b>{t.title}</b>{showCampaign && <div className="muted">{campaign(t.campaignId)?.name}</div>}</td>
              <td data-label="Designer">{user(t.assigneeId)?.name ?? "—"}</td>
              <td data-label="Due">{fmtDate(t.due)} {overdue(t) && <Pill kind="late">Overdue</Pill>}</td>
              <td><Pill>{t.priority}</Pill></td>
              <td className="end"><Pill>{t.status}</Pill></td>
              <td className="hide-sm"><button className="btn tiny secondary">Open →</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!tasks.length && <Empty>No tasks found</Empty>}
    </div>
  );
}

export function SubmissionCards({ tasks }: { tasks: Task[] }) {
  const { user, campaign } = useData();
  const me = useMe();
  const toast = useToast();
  const nav = useNavigate();
  const admin = me.role === "Admin";
  if (!tasks.length) return <div className="card"><Empty>No submissions available yet.</Empty></div>;
  return (
    <div className="campaigns stagger">
      {tasks.map((t, i) => (
        <div className="card" key={t.id} style={stagger(i)}>
          <div className="art" onClick={() => nav(`/tasks/${t.id}`)} style={{ cursor: "pointer" }}>
            {t.fileId ? <DriveMedia fileId={t.fileId} mime={t.fileMime} alt="Design submission" /> : (t.submission || "AWAITING DESIGN")}
          </div>
          <h3 style={{ fontSize: 14, marginBottom: 4 }}>{t.title}</h3>
          <p className="muted" style={{ marginTop: 0 }}>{user(t.assigneeId)?.name} · {campaign(t.campaignId)?.name}</p>
          <div className="flex"><Pill>{t.status}</Pill><button className="btn tiny secondary" onClick={() => nav(`/tasks/${t.id}`)}>Review →</button></div>
          {admin && t.status === "In Review" && (
            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn tiny" onClick={() => { actions.review(me, t, "Approved", (e) => toast(e.message, "err")); toast("Approved: " + t.title); }}>Approve</button>
              <button className="btn tiny secondary" onClick={() => { actions.review(me, t, "Revisions", (e) => toast(e.message, "err")); toast("Revisions requested"); }}>Request Revisions</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
