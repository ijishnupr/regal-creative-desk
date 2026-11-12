import { useNavigate } from "react-router-dom";
import { actions, useData } from "../data";
import { useMe } from "../auth";
import { useToast } from "../components/ui";
import { useState } from "react";

export default function NewCampaign() {
  const me = useMe();
  const { users } = useData();
  const nav = useNavigate();
  const toast = useToast();
  const [color, setColor] = useState("#71846d");
  const [label, setLabel] = useState("");
  return (
    <div className="card">
      <h2 className="sectiontitle">Create Campaign</h2>
      <div className="cover" style={{ background: color, height: 110, marginBottom: 14, transition: "background .3s" }}>
        <div className="cover-text"><b>{label || "REGAL"}</b><span>REGAL JEWELLERS</span></div>
      </div>
      <form className="fields" style={{ gridTemplateColumns: "1fr" }} onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        const id = actions.createCampaign(me, {
          name: String(d.get("name")).trim(), label: String(d.get("label") || "REGAL").trim().toUpperCase(),
          color: String(d.get("color")), description: String(d.get("description")), objective: String(d.get("objective")),
          ownerId: String(d.get("owner")),
        }, (err) => toast(err.message, "err"));
        toast("Campaign created");
        nav(`/campaigns/${id}`);
      }}>
        <div className="fields">
          <label className="field">Campaign name<input name="name" required /></label>
          <label className="field">Cover label<input name="label" placeholder="e.g. WRP" maxLength={12} value={label} onChange={(e) => setLabel(e.target.value.toUpperCase())} /></label>
          <label className="field">Theme colour<input name="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
          <label className="field">Campaign owner
            <select name="owner" defaultValue={me.id}>{users.filter((u) => u.active !== false).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          </label>
        </div>
        <label className="field">Description<textarea name="description" /></label>
        <label className="field">Main campaign copy<input name="objective" /></label>
        <div><button className="btn" type="submit">Create Campaign</button></div>
      </form>
    </div>
  );
}
