import { Link, useNavigate } from "react-router-dom";
import { useData } from "../data";
import { useMe } from "../auth";
import { Bar, CountUp, Cover, Empty, Skeleton, hours, progress, stagger } from "../components/ui";

export default function Dashboard() {
  const me = useMe();
  const admin = me.role === "Admin";
  const { campaigns, tasks, users, user, campaign, ready } = useData();
  const nav = useNavigate();
  const stats: [string, number][] = [
    ["Active Campaigns", campaigns.length],
    [admin ? "Assigned Tasks" : "My Tasks", tasks.length],
    ["In Review", tasks.filter((t) => t.status === "In Review").length],
    ["Approved", tasks.filter((t) => t.status === "Approved").length],
  ];
  const designers = users.filter((u) => u.role === "Designer" && u.active !== false && (admin || u.id === me.id));
  const loading = !ready.campaigns || !ready.tasks;
  const waiting = tasks.filter((t) => t.status === (admin ? "In Review" : "Revisions"));

  return (
    <>
      <div className="flex" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="sectiontitle" style={{ margin: 0 }}>{admin ? "Creative operations at a glance" : `Welcome back, ${me.name.split(" ")[0]}`}</h2>
          <p className="muted">{admin ? "Campaign progress, employee workload and review queue" : "Your tasks, progress and corrections"}</p>
        </div>
        {admin ? <Link className="btn" to="/tasks/new">+ Assign Work</Link> : <Link className="btn" to="/tasks">Open My Tasks</Link>}
      </div>
      <div className="grid stagger">
        {stats.map(([k, v], i) => (
          <div className="card stat" key={k} style={stagger(i)}><small>{k}</small><strong>{loading ? <Skeleton h={30} w={50} /> : <CountUp value={v} />}</strong></div>
        ))}
      </div>
      <div className="twocol">
        <div className="card">
          <div className="flex"><h3 className="sectiontitle">Campaign progress</h3><Link className="btn tiny secondary" to="/campaigns">All campaigns →</Link></div>
          {loading ? <><Skeleton h={40} /><br /><Skeleton h={40} /></> : campaigns.length ? (
            <div className="stagger">
              {campaigns.map((c, i) => {
                const ct = tasks.filter((t) => t.campaignId === c.id), p = progress(ct);
                return (
                  <div className="item click" key={c.id} style={stagger(i)} onClick={() => nav(`/campaigns/${c.id}`)}>
                    <div className="flex"><b>{c.name}</b><span className="muted">{p}% · {ct.length} tasks</span></div>
                    <div style={{ marginTop: 9 }}><Bar value={p} /></div>
                  </div>
                );
              })}
            </div>
          ) : <Empty>No campaigns yet{admin && <> — <Link to="/campaigns/new">create one</Link></>}</Empty>}
        </div>
        <div className="card">
          <h3 className="sectiontitle">{admin ? "Employee workload" : "My workload"}</h3>
          {designers.map((e) => {
            const et = tasks.filter((t) => t.assigneeId === e.id), p = progress(et);
            return (
              <div key={e.id}>
                <div className="chartrow"><span>{e.name}</span><Bar value={p} /><span>{et.length}</span></div>
                <div className="muted" style={{ margin: "-6px 0 8px 104px" }}>{et.filter((t) => t.status === "Approved").length} approved · {hours(et)}h logged</div>
              </div>
            );
          })}
          {!designers.length && <Empty>No designers yet</Empty>}
        </div>
      </div>
      <div className="twocol">
        <div className="card">
          <div className="flex"><h3 className="sectiontitle">Campaigns</h3><Link className="btn tiny secondary" to="/campaigns">View all →</Link></div>
          <div className="campaigns stagger" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))" }}>
            {campaigns.map((c, i) => (
              <Link className="campaigncard" to={`/campaigns/${c.id}`} key={c.id} style={stagger(i)}>
                <Cover c={c} height={120} /><b className="mini">{c.name}</b>
              </Link>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="flex"><h3 className="sectiontitle">{admin ? "Waiting for approval" : "Needs your corrections"}</h3><Link className="btn tiny secondary" to="/approvals">Review →</Link></div>
          {waiting.length ? <div className="stagger">{waiting.map((t, i) => (
            <div className="item click" key={t.id} style={stagger(i)} onClick={() => nav(`/tasks/${t.id}`)}>
              <b>{t.title}</b><div className="muted">{user(t.assigneeId)?.name} · {campaign(t.campaignId)?.name}</div>
            </div>
          ))}</div> : <Empty>{admin ? "No designs awaiting review" : "Nothing to correct 🎉"}</Empty>}
        </div>
      </div>
    </>
  );
}
