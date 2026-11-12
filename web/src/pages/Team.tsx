import { actions, useData } from "../data";
import { useMe } from "../auth";
import { Avatar, ConfirmButton, Pill, hours, stagger, useToast } from "../components/ui";
import type { Role } from "../types";

export default function Team() {
  const me = useMe();
  const { users, tasks, invites } = useData();
  const toast = useToast();
  const adminCount = users.filter((u) => u.role === "Admin" && u.active !== false).length;
  return (
    <>
      <div className="flex" style={{ marginBottom: 14 }}>
        <div><h2 className="sectiontitle">Manage Employees & Roles</h2><p className="muted">Invite people by their Google account email. They get access the first time they sign in.</p></div>
      </div>
      <div className="card">
        <h3 className="sectiontitle">Invite Employee</h3>
        <form className="fields" style={{ gridTemplateColumns: "1fr" }} onSubmit={async (e) => {
          e.preventDefault();
          const f = e.currentTarget, d = new FormData(f), email = String(d.get("email")).trim().toLowerCase();
          if (users.some((u) => u.email.toLowerCase() === email)) { toast("That email already has an account", "err"); return; }
          try { await actions.invite(email, String(d.get("name")), String(d.get("role")) as Role); toast("Invitation saved — ask them to sign in"); f.reset(); }
          catch (err) { toast((err as Error).message, "err"); }
        }}>
          <div className="fields" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
            <label className="field">Full name<input name="name" required /></label>
            <label className="field">Google email<input name="email" type="email" required /></label>
            <label className="field">Role<select name="role"><option>Designer</option><option>Admin</option></select></label>
          </div>
          <div><button className="btn" type="submit">+ Invite Employee</button></div>
        </form>
        {invites.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <b className="mini">Pending invitations</b>
            {invites.map((i) => (
              <div className="item flex" key={i.id}><span>{i.name || i.email} <span className="muted">{i.email}</span> <Pill>{i.role}</Pill></span>
                <ConfirmButton confirmText="Cancel invite?" onConfirm={() => void actions.cancelInvite(i.id)}>Cancel</ConfirmButton></div>
            ))}
          </div>
        )}
      </div>
      <div className="card tablewrap" style={{ marginTop: 14 }}>
        <table className="tbl responsive stagger">
          <thead><tr><th>Employee</th><th>Email</th><th>Assigned</th><th>Approved</th><th>Hours</th><th>Role</th><th /></tr></thead>
          <tbody>
            {users.map((u, i) => {
              const ts = tasks.filter((t) => t.assigneeId === u.id);
              const lastAdmin = u.role === "Admin" && adminCount <= 1;
              return (
                <tr key={u.id} style={{ ...stagger(i), opacity: u.active === false ? 0.5 : 1 }}>
                  <td className="primary"><span className="who"><Avatar name={u.name} photo={u.photoURL} /><b>{u.name}</b>{u.id === me.id && <span className="muted">(you)</span>}</span></td>
                  <td data-label="Email">{u.email}</td>
                  <td data-label="Assigned">{ts.length}</td>
                  <td data-label="Approved">{ts.filter((t) => t.status === "Approved").length}</td>
                  <td data-label="Hours">{hours(ts)}</td>
                  <td data-label="Role">
                    <select value={u.role} disabled={lastAdmin} title={lastAdmin ? "Keep at least one admin" : ""} onChange={async (e) => {
                      try { await actions.setRole(me, u, e.target.value as Role); toast("Role updated"); } catch (err) { toast((err as Error).message, "err"); }
                    }}><option>Admin</option><option>Designer</option></select>
                  </td>
                  <td>{u.id !== me.id && (u.active === false
                    ? <button className="btn tiny secondary" onClick={() => actions.setActive(me, u, true).then(() => toast("Re-activated"))}>Re-activate</button>
                    : <ConfirmButton confirmText="Deactivate?" onConfirm={() => actions.setActive(me, u, false).then(() => toast("Deactivated"))}>Deactivate</ConfirmButton>)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
