import { Link } from "react-router-dom";
import { useData } from "../data";
import { useMe } from "../auth";
import { Bar, Cover, Empty, SkeletonCards, progress, stagger } from "../components/ui";

export default function Campaigns() {
  const admin = useMe().role === "Admin";
  const { campaigns, tasks, ready } = useData();
  return (
    <>
      <div className="flex" style={{ marginBottom: 16 }}>
        <div><h2 className="sectiontitle">All campaigns</h2><p className="muted">Open a campaign to see its entire creative workflow.</p></div>
        {admin && <Link className="btn" to="/campaigns/new">+ New Campaign</Link>}
      </div>
      {!ready.campaigns ? <SkeletonCards /> : campaigns.length ? (
        <div className="campaigns stagger">
          {campaigns.map((c, i) => {
            const ts = tasks.filter((t) => t.campaignId === c.id), p = progress(ts);
            return (
              <Link className="card campaigncard" to={`/campaigns/${c.id}`} key={c.id} style={stagger(i)}>
                <Cover c={c} />
                <h3 style={{ fontSize: 15, margin: "13px 0 6px" }}>{c.name}</h3>
                <p className="muted">{c.description}</p>
                <div className="flex mini" style={{ marginBottom: 6 }}><span>{ts.length} tasks</span><b>{p}% approved</b></div>
                <Bar value={p} />
                <p className="muted">Open campaign →</p>
              </Link>
            );
          })}
        </div>
      ) : <div className="card"><Empty>No campaigns yet.</Empty></div>}
    </>
  );
}
