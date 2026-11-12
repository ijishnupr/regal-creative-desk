import { useNavigate } from "react-router-dom";
import { actions, useData } from "../data";
import { Empty, fmtTime, stagger } from "../components/ui";

export default function Notifications() {
  const { notifications } = useData();
  const nav = useNavigate();
  return (
    <>
      <div className="flex">
        <div><h2 className="sectiontitle">Notifications</h2><p className="muted">Submission alerts, correction requests, approvals and new assignments.</p></div>
        <button className="btn tiny secondary" onClick={() => actions.markAllRead(notifications)}>Mark all read</button>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        {notifications.length ? <div className="stagger">{notifications.map((n, i) => (
          <div key={n.id} className="item click" style={{ ...stagger(i), display: "flex", alignItems: "center", gap: 12, background: n.read ? "transparent" : "#f6f0e8" }}
            onClick={() => { if (!n.read) actions.markRead(n.id); if (n.taskId) nav(`/tasks/${n.taskId}`); }}>
            <span style={{ fontSize: 19, color: n.read ? "#c8bfb6" : "var(--maroon)" }}>{n.read ? "○" : "●"}</span>
            <div style={{ flex: 1 }}><b style={{ fontWeight: n.read ? 500 : 700 }}>{n.message}</b><div className="muted">{fmtTime(n.createdAt)}</div></div>
            <span className="muted hide-sm">Open →</span>
          </div>
        ))}</div> : <Empty>No notifications yet.</Empty>}
      </div>
    </>
  );
}
