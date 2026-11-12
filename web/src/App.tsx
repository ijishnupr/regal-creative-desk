import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "./auth";
import { DataProvider, useData } from "./data";
import { Avatar, Skeleton } from "./components/ui";
import Login from "./pages/Login";

// Route-level code splitting; every chunk is precached by the service worker
// and also prefetched on idle, so navigation never waits on the network.
const pages = {
  Dashboard: () => import("./pages/Dashboard"),
  Campaigns: () => import("./pages/Campaigns"),
  CampaignDetail: () => import("./pages/CampaignDetail"),
  NewCampaign: () => import("./pages/NewCampaign"),
  Tasks: () => import("./pages/Tasks"),
  NewTask: () => import("./pages/NewTask"),
  TaskDetail: () => import("./pages/TaskDetail"),
  Team: () => import("./pages/Team"),
  Approvals: () => import("./pages/Approvals"),
  Reports: () => import("./pages/Reports"),
  Notifications: () => import("./pages/Notifications"),
};
const L = Object.fromEntries(Object.entries(pages).map(([k, f]) => [k, lazy(f)])) as unknown as Record<keyof typeof pages, React.LazyExoticComponent<() => React.JSX.Element>>;

const NAV: [string, string, string, boolean?][] = [
  ["/", "▦", "Dashboard"],
  ["/campaigns", "▣", "Campaigns"],
  ["/tasks", "☷", "Task Tracker"],
  ["/team", "♙", "Employees", true],
  ["/approvals", "✓", "Approvals"],
  ["/reports", "▥", "Reports", true],
  ["/notifications", "♧", "Notifications"],
];

export default function App() {
  const a = useAuth();
  if (a.status === "loading") return <div className="login"><div className="spinner" /></div>;
  if (a.status !== "ready") return <Login />;
  return <DataProvider><Shell /></DataProvider>;
}

function titleFor(path: string, admin: boolean): [string, string] {
  const sub = admin ? "Overview of all campaigns, employees and approvals" : "Your assignments and submissions";
  if (path === "/") return [admin ? "Admin Dashboard" : "My Dashboard", sub];
  if (path === "/campaigns/new") return ["Create Campaign", sub];
  if (path.startsWith("/campaigns/")) return ["Campaign Detail", sub];
  if (path === "/campaigns") return ["Campaigns", sub];
  if (path === "/tasks/new") return ["Assign New Work", sub];
  if (path.startsWith("/tasks/")) return ["Task Details", sub];
  if (path === "/tasks") return [admin ? "Task Tracker" : "My Tasks", sub];
  if (path === "/team") return ["Employee Management", sub];
  if (path === "/approvals") return [admin ? "Design Approvals" : "My Submissions", sub];
  if (path === "/reports") return ["Team Reports", sub];
  if (path === "/notifications") return ["Notifications", sub];
  return ["Creative Desk", sub];
}

function Shell() {
  const auth = useAuth();
  const me = auth.status === "ready" ? auth.profile : null!;
  const admin = me.role === "Admin";
  const { notifications, tasks } = useData();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const unread = notifications.filter((n) => !n.read).length;
  const reviewCount = tasks.filter((t) => t.status === "In Review").length;
  const prevUnread = useRef(unread);
  const [ring, setRing] = useState(false);
  const [title, subtitle] = titleFor(loc.pathname, admin);

  useEffect(() => { setOpen(false); window.scrollTo({ top: 0 }); }, [loc.pathname]);
  useEffect(() => { document.title = `${title} · Regal Creative Desk`; }, [title]);
  useEffect(() => {
    if (unread > prevUnread.current) { setRing(true); setTimeout(() => setRing(false), 1400); }
    prevUnread.current = unread;
  }, [unread]);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener("online", on); addEventListener("offline", off);
    // Prefetch every page chunk while idle => instant navigation.
    const idle = (window as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 800));
    idle(() => Object.values(pages).forEach((f) => f()));
    return () => { removeEventListener("online", on); removeEventListener("offline", off); };
  }, []);

  const items = NAV.filter((n) => admin || !n[3]);
  const mobileTabs = [NAV[0], NAV[1], NAV[2], NAV[4], NAV[6]];

  return (
    <div className="app">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={"side" + (open ? " open" : "")}>
        <div className="logo">
          <img src={`${import.meta.env.BASE_URL}icons/logo.png`} alt="Regal Jewellers logo" />
          <div><b>REGAL</b><small>CREATIVE DESK</small></div>
        </div>
        <nav>
          {items.map(([to, ico, label]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => "navbtn" + (isActive ? " active" : "")}>
              <span className="ico">{ico}</span>{label}
              {to === "/notifications" && unread > 0 && <span className="count">{unread}</span>}
              {to === "/approvals" && admin && reviewCount > 0 && <span className="count">{reviewCount}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidefooter">
          <div className="me"><Avatar name={me.name} photo={me.photoURL} size={32} /><div><b>{me.name}</b><small>{me.role}</small></div></div>
          <button className="btn tiny secondary" onClick={() => auth.signOut()}>Sign out</button>
          <span>Premium creative operations</span>
        </div>
      </aside>
      <div className="main">
        {!online && <div className="offline">You're offline — changes are saved on this device and will sync automatically.</div>}
        <header className="top">
          <button className="burger" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <div className="titles"><h1 key={title} className="page">{title}</h1><small>{subtitle}</small></div>
          <div className="right">
            <button className={"bell" + (ring ? " ring" : "")} onClick={() => nav("/notifications")} title="Notifications">
              <span className="bell-ico">🔔</span>{unread > 0 && <span className="badge" key={unread}>{unread}</span>}
            </button>
          </div>
        </header>
        <main className="content">
          <Suspense fallback={<div className="page"><Skeleton h={28} w={240} /><div style={{ height: 14 }} /><Skeleton h={180} /></div>}>
            <div key={loc.pathname} className="page">
              <Routes location={loc}>
                <Route path="/" element={<L.Dashboard />} />
                <Route path="/campaigns" element={<L.Campaigns />} />
                <Route path="/campaigns/new" element={admin ? <L.NewCampaign /> : <Navigate to="/campaigns" />} />
                <Route path="/campaigns/:id" element={<L.CampaignDetail />} />
                <Route path="/tasks" element={<L.Tasks />} />
                <Route path="/tasks/new" element={admin ? <L.NewTask /> : <Navigate to="/tasks" />} />
                <Route path="/tasks/:id" element={<L.TaskDetail />} />
                <Route path="/team" element={admin ? <L.Team /> : <Navigate to="/" />} />
                <Route path="/approvals" element={<L.Approvals />} />
                <Route path="/reports" element={admin ? <L.Reports /> : <Navigate to="/" />} />
                <Route path="/notifications" element={<L.Notifications />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </div>
          </Suspense>
        </main>
      </div>
      <nav className="tabnav">
        {mobileTabs.map(([to, ico, label]) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
            <span className="ico">{ico}</span>{label === "Task Tracker" ? "Tasks" : label === "Notifications" ? "Alerts" : label}
            {to === "/notifications" && unread > 0 && <span className="dot" />}
          </NavLink>
        ))}
      </nav>
      <InstallPrompt />
    </div>
  );
}

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
function InstallPrompt() {
  const [evt, setEvt] = useState<BIP | null>(null);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); if (!localStorage.getItem("rcd-install-dismissed")) setEvt(e as BIP); };
    addEventListener("beforeinstallprompt", h);
    return () => removeEventListener("beforeinstallprompt", h);
  }, []);
  if (!evt) return null;
  return (
    <div className="install">
      <span>📲 Install Creative Desk on this device</span>
      <span className="actions">
        <button className="btn tiny" onClick={async () => { await evt.prompt(); setEvt(null); }}>Install</button>
        <button className="btn tiny secondary" onClick={() => { try { localStorage.setItem("rcd-install-dismissed", "1"); } catch { /* */ } setEvt(null); }}>Later</button>
      </span>
    </div>
  );
}
