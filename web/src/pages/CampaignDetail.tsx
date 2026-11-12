import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useData } from "../data";
import { useMe } from "../auth";
import { Bar, Cover, Empty, Skeleton, fmtTime, hours, progress, stagger } from "../components/ui";
import { SubmissionCards, TaskTable } from "../components/tasks";
import { Upload } from "../components/Upload";

const TABS = [["tasks", "All Tasks"], ["brief", "Content Brief"], ["employees", "Employees"], ["submissions", "Submissions"], ["activity", "Activity"]] as const;

export default function CampaignDetail() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || "tasks";
  const admin = useMe().role === "Admin";
  const { campaign, tasks, users, activity, ready } = useData();
  const nav = useNavigate();
  const c = campaign(id);
  if (!c) return ready.campaigns ? <div className="card"><Empty>Campaign not found. <Link to="/campaigns">Back</Link></Empty></div> : <Skeleton h={220} />;
  const ts = tasks.filter((t) => t.campaignId === c.id), p = progress(ts);

  return (
    <>
      <Link className="btn secondary tiny" to="/campaigns">← Campaigns</Link>
      <div className="card detailhead" style={{ marginTop: 13 }}>
        <Cover c={c} />
        <div>
          <span className="pill">Campaign Workspace</span>
          <h2>{c.name}</h2>
          <p className="muted">{c.description}</p>
          <p><b>Key message:</b> {c.objective}</p>
          <div className="flex mini" style={{ marginBottom: 6 }}><span>{ts.length} tasks · {new Set(ts.map((t) => t.assigneeId)).size} designers</span><b>{p}% approved</b></div>
          <Bar value={p} />
          {admin && (
            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn tiny" onClick={() => nav(`/tasks/new?campaign=${c.id}`)}>+ Assign Campaign Task</button>
              <Upload compact kind="cover" id={c.id} accept="image/*" label="Upload Campaign Cover" />
            </div>
          )}
        </div>
      </div>
      <div className="tabbar">
        {TABS.map(([k, l]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setSp({ tab: k }, { replace: true })}>{l}</button>)}
      </div>
      <div key={tab} className="page">
        {tab === "tasks" && <TaskTable tasks={ts} showCampaign={false} />}
        {tab === "brief" && (
          <div className="card">
            <h3 className="sectiontitle">Campaign Brief</h3>
            <p><b>Objective</b></p><p>{c.description}</p>
            <p><b>Primary copy</b></p><p>{c.objective}</p>
            <p className="muted">Individual tasks contain their own content copy, format and design instructions.</p>
          </div>
        )}
        {tab === "employees" && (
          <div className="grid stagger">
            {users.filter((e) => ts.some((t) => t.assigneeId === e.id)).map((e, i) => {
              const et = ts.filter((t) => t.assigneeId === e.id);
              return (
                <div className="card" key={e.id} style={stagger(i)}>
                  <b>{e.name}</b>
                  <p className="muted">{et.length} tasks · {et.filter((t) => t.status === "Approved").length} approved</p>
                  <Bar value={progress(et)} />
                  <p className="muted">{hours(et)} hours logged</p>
                </div>
              );
            })}
            {!ts.length && <Empty>No designers assigned yet</Empty>}
          </div>
        )}
        {tab === "submissions" && <SubmissionCards tasks={ts.filter((t) => t.submission || t.fileId)} />}
        {tab === "activity" && (() => {
          const acts = activity.filter((a) => a.campaignId === c.id);
          return acts.length ? <div className="card"><div className="timeline stagger">{acts.map((a, i) => <p key={a.id} style={stagger(i)}>{a.text}<br /><span className="muted">{fmtTime(a.createdAt)}</span></p>)}</div></div>
            : <div className="card"><Empty>No activity yet</Empty></div>;
        })()}
      </div>
    </>
  );
}
