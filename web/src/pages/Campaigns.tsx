import { Link, useSearchParams } from "react-router-dom";
import { actions, useData } from "../data";
import { useMe } from "../auth";
import { Bar, Cover, Empty, SkeletonCards, progress, stagger, useToast } from "../components/ui";
import { daysUntil, isUpcoming, type Campaign } from "../types";
import { TabBar, VLink } from "../components/motion";

export function countdown(iso?: string) {
  const n = daysUntil(iso);
  if (n === null) return "";
  return n <= 0 ? "Starts today" : n === 1 ? "Starts tomorrow" : `In ${n} days`;
}
const fmt = (iso?: string) => iso ? new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";

export function DateBadge({ iso }: { iso?: string }) {
  const d = iso ? new Date(iso + "T00:00:00") : null;
  return (
    <div className="datebadge">
      <span>{d ? d.toLocaleDateString(undefined, { month: "short" }) : "—"}</span>
      <b>{d ? d.getDate() : "?"}</b>
    </div>
  );
}

export function UpcomingCard({ c, i, compact }: { c: Campaign; i: number; compact?: boolean }) {
  const me = useMe();
  const toast = useToast();
  const { tasks } = useData();
  const n = tasks.filter((t) => t.campaignId === c.id).length;
  const days = daysUntil(c.startDate) ?? 99;
  return (
    <div className={"upcoming card" + (compact ? " compact" : "")} style={{ ...stagger(i), ["--accent" as string]: c.color || "#71846d" }}>
      <DateBadge iso={c.startDate} />
      <div className="up-body">
        <Link to={`/campaigns/${c.id}`}><b>{c.name}</b></Link>
        <div className="muted">{fmt(c.startDate)}{c.endDate ? ` → ${fmt(c.endDate)}` : ""}{n ? ` · ${n} prep task${n > 1 ? "s" : ""}` : ""}</div>
        {!compact && c.description && <p className="muted up-desc">{c.description}</p>}
      </div>
      <div className="up-side">
        <span className={"pill " + (days <= 7 ? "warn" : "info")}>{countdown(c.startDate)}</span>
        {!compact && me.role === "Admin" && (
          <button className="btn tiny secondary" onClick={() => actions.startCampaign(me, c).then(() => toast(`${c.name} is now active`), (e) => toast(e.message, "err"))}>Start now</button>
        )}
      </div>
    </div>
  );
}

export default function Campaigns() {
  const admin = useMe().role === "Admin";
  const { campaigns, tasks, ready } = useData();
  const [sp, setSp] = useSearchParams();
  const view = sp.get("view") === "upcoming" ? "upcoming" : "active";
  const active = campaigns.filter((c) => !isUpcoming(c));
  const upcoming = campaigns.filter(isUpcoming).sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));

  return (
    <>
      <div className="flex" style={{ marginBottom: 6 }}>
        <div><h2 className="sectiontitle">Campaigns</h2><p className="muted">Open a campaign to see its entire creative workflow.</p></div>
        {admin && (
          <div className="actions">
            <Link className="btn secondary" to="/campaigns/new?upcoming=1">📅 Plan Upcoming</Link>
            <Link className="btn" to="/campaigns/new">+ New Campaign</Link>
          </div>
        )}
      </div>
      <TabBar value={view} onChange={(k) => setSp(k === "upcoming" ? { view: k } : {}, { replace: true })}
        tabs={[["active", `Active (${active.length})`], ["upcoming", `Upcoming (${upcoming.length})`]] as const} />
      <div key={view} className="page">
        {!ready.campaigns ? <SkeletonCards /> : view === "active" ? (
          active.length ? (
            <div className="campaigns stagger">
              {active.map((c, i) => {
                const ts = tasks.filter((t) => t.campaignId === c.id), p = progress(ts);
                return (
                  <VLink className="card campaigncard" to={`/campaigns/${c.id}`} key={c.id} style={stagger(i)} morph={c.id}>
                    <Cover c={c} />
                    <h3 style={{ fontSize: 15, margin: "13px 0 6px" }}>{c.name}</h3>
                    <p className="muted">{c.description}</p>
                    <div className="flex mini" style={{ marginBottom: 6 }}><span>{ts.length} tasks</span><b>{p}% approved</b></div>
                    <Bar value={p} />
                    <p className="muted">Open campaign →</p>
                  </VLink>
                );
              })}
            </div>
          ) : <div className="card"><Empty>No active campaigns.</Empty></div>
        ) : upcoming.length ? (
          <div className="stagger upcoming-list">{upcoming.map((c, i) => <UpcomingCard key={c.id} c={c} i={i} />)}</div>
        ) : (
          <div className="card"><Empty>No upcoming campaigns planned.{admin && <> <Link to="/campaigns/new?upcoming=1">Plan one →</Link></>}</Empty></div>
        )}
      </div>
    </>
  );
}
