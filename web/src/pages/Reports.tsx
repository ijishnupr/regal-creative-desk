import { useData } from "../data";
import { Bar, hours, progress, stagger } from "../components/ui";

export default function Reports() {
  const { users, tasks } = useData();
  const designers = users.filter((u) => u.role === "Designer");
  return (
    <>
      <h2 className="sectiontitle">Employee Workload & Performance</h2>
      <div className="card tablewrap">
        <table className="tbl responsive stagger">
          <thead><tr><th>Designer</th><th>Assigned</th><th>In Progress</th><th>In Review</th><th>Approved</th><th>Hours Logged</th><th>Completion</th></tr></thead>
          <tbody>
            {designers.map((e, i) => {
              const ts = tasks.filter((t) => t.assigneeId === e.id), p = progress(ts);
              return (
                <tr key={e.id} style={stagger(i)}>
                  <td className="primary"><b>{e.name}</b></td>
                  <td data-label="Assigned">{ts.length}</td>
                  <td data-label="In progress">{ts.filter((t) => t.status === "In Progress").length}</td>
                  <td data-label="In review">{ts.filter((t) => t.status === "In Review").length}</td>
                  <td data-label="Approved">{ts.filter((t) => t.status === "Approved").length}</td>
                  <td data-label="Hours">{hours(ts)} h</td>
                  <td data-label="Completion" style={{ minWidth: 120 }}><div className="chartrow" style={{ gridTemplateColumns: "1fr 36px", margin: 0 }}><Bar value={p} /><span>{p}%</span></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="hint">Logged hours are entered manually by the designer/admin. They are not automatically measured or independently verified.</div>
    </>
  );
}
