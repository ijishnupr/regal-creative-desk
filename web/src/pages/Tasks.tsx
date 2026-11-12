import { Link } from "react-router-dom";
import { useState } from "react";
import { useData } from "../data";
import { useMe } from "../auth";
import { TaskTable } from "../components/tasks";
import { Skeleton } from "../components/ui";
import { STATUSES } from "../types";

export default function Tasks() {
  const admin = useMe().role === "Admin";
  const { tasks, campaigns, users, ready } = useData();
  const [camp, setCamp] = useState(() => sessionStorage.getItem("rcd-f-camp") || "all");
  const [status, setStatus] = useState("all");
  const [who, setWho] = useState("all");
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const ts = tasks.filter((t) => (camp === "all" || t.campaignId === camp) && (status === "all" || t.status === status)
    && (who === "all" || t.assigneeId === who) && (!ql || t.title.toLowerCase().includes(ql)));
  return (
    <>
      <div className="flex" style={{ marginBottom: 14 }}>
        <div className="actions">
          <input className="filter" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="filter" value={camp} onChange={(e) => { setCamp(e.target.value); try { sessionStorage.setItem("rcd-f-camp", e.target.value); } catch { /* */ } }}>
            <option value="all">All Campaigns</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="filter" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All Statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          {admin && <select className="filter" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="all">All Designers</option>{users.filter((u) => u.role === "Designer").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>}
        </div>
        {admin && <Link className="btn" to="/tasks/new">+ Assign New Work</Link>}
      </div>
      {ready.tasks ? <TaskTable tasks={ts} /> : <div className="card"><Skeleton h={44} /><br /><Skeleton h={44} /><br /><Skeleton h={44} /></div>}
    </>
  );
}
