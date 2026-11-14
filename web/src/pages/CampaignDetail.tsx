import { useVTNavigate, VLink, TabBar } from "../components/motion";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useData } from "../data";
import { useMe } from "../auth";
import { Bar, Cover, Empty, Skeleton, fmtTime, hours, progress, stagger } from "../components/ui";
import { SubmissionCards, TaskTable } from "../components/tasks";
import { CoverUpload } from "../components/Upload";
import { actions } from "../data";
import { useToast } from "../components/ui";
import { isUpcoming } from "../types";
import { countdown } from "./Campaigns";

const TABS = [["tasks", "All Tasks"], ["brief", "Content Brief"], ["employees", "Employees"], ["submissions", "Submissions"], ["activity", "Activity"]] as const;

export default function CampaignDetail() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || "tasks";
  const me = useMe();
  const admin = me.role === "Admin";
  const toast = useToast();
  const { campaign, tasks, users, activity, ready } = useData();
  const nav = useVTNavigate();
  const c = campaign(id);
  if (!c) return ready.campaigns ? <div className="card"><Empty>Campaign not found. <Link to="/campaigns">Back</Link></Empty></div> : <Skeleton h={220} />;
  const ts = tasks.filter((t) => t.campaignId === c.id), p = progress(ts);

  return (
    <>
      <VLink className="btn secondary tiny" to="/campaigns">← Campaigns</VLink>
      <div className="card detailhead" style={{ marginTop: 13 }}>
        <Cover c={c} />
        <div>
          {isUpcoming(c)
            ? <span className="pill warn">📅 Upcoming · {countdown(c.startDate)} · {c.startDate}</span>
            : <span className="pill">Campaign Workspace{c.startDate ? ` · ${c.startDate}${c.endDate ? " → " + c.endDate : ""}` : ""}</span>}
          <h2>{c.name}</h2>
          <p className="muted">{c.description}</p>
          <p><b>Key message:</b> {c.objective}</p>
          <div className="flex mini" style={{ marginBottom: 6 }}><span>{ts.length} tasks · {new Set(ts.map((t) => t.assigneeId)).size} designers</span><b>{p}% approved</b></div>
          <Bar value={p} />
          {admin && (
            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn tiny" onClick={() => nav(`/tasks/new?campaign=${c.id}`)}>+ Assign Campaign Task</button>
              <CoverUpload campaignId={c.id} label={c.coverFileId ? "Change Cover" : "Upload Campaign Cover"} />
              {isUpcoming(c) && <button className="btn tiny secondary" onClick={() => actions.startCampaign(me, c).then(() => toast(`${c.name} is now active`), (e) => toast(e.message, "err"))}>Start now</button>}
            </div>
          )}
        </div>
      </div>
      <TabBar tabs={TABS} value={tab as (typeof TABS)[number][0]} onChange={(k) => setSp({ tab: k }, { replace: true })} />
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
        {tab === "submissions" && <SubmissionCards tasks={ts.filter((t) => t.submission || t.fileId || t.deliverables?.length)} />}
        {tab === "activity" && (() => {
          const acts = activity.filter((a) => a.campaignId === c.id);
          return acts.length ? <div className="card"><div className="timeline stagger">{acts.map((a, i) => <p key={a.id} style={stagger(i)}>{a.text}<br /><span className="muted">{fmtTime(a.createdAt)}</span></p>)}</div></div>
            : <div className="card"><Empty>No activity yet</Empty></div>;
        })()}
      </div>
    </>
  );
}
