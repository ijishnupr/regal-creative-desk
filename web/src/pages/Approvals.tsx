import { useState } from "react";
import { useData } from "../data";
import { useMe } from "../auth";
import { SubmissionCards } from "../components/tasks";

export default function Approvals() {
  const admin = useMe().role === "Admin";
  const { tasks } = useData();
  const [f, setF] = useState(admin ? "In Review" : "all");
  const all = tasks.filter((t) => t.submission || t.fileId || t.deliverables?.length || t.status === "In Review");
  const ts = f === "all" ? all : all.filter((t) => t.status === f);
  return (
    <>
      <div className="flex" style={{ marginBottom: 12 }}>
        <h2 className="sectiontitle" style={{ margin: 0 }}>Design Submissions & Approvals</h2>
        <div className="tabbar" style={{ margin: 0, border: 0 }}>
          {["In Review", "Revisions", "Approved", "all"].map((k) => (
            <button key={k} className={f === k ? "active" : ""} onClick={() => setF(k)}>{k === "all" ? "All" : k} ({k === "all" ? all.length : all.filter((t) => t.status === k).length})</button>
          ))}
        </div>
      </div>
      <div key={f} className="page"><SubmissionCards tasks={ts} /></div>
    </>
  );
}
