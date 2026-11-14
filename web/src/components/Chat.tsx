import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { actions, useData, useMessages } from "../data";
import { useMe } from "../auth";
import { Avatar, Skeleton, useToast } from "./ui";
import type { Task } from "../types";

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return <>{parts.map((p, i) => (i % 2 ? <a key={i} href={p} target="_blank" rel="noreferrer noopener">{p}</a> : <Fragment key={i}>{p}</Fragment>))}</>;
}
const dayLabel = (d: Date) => {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const diff = (t.getTime() - x.getTime()) / 864e5;
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};
const timeLabel = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** Task conversation between the admins and the assigned designer. */
export function TaskChat({ t }: { t: Task }) {
  const me = useMe();
  const { users, user } = useData();
  const toast = useToast();
  const [msgs, ready] = useMessages(t.id);
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const first = useRef(true);

  // Stick to the bottom: jump on first load, smooth-scroll for new messages.
  useLayoutEffect(() => {
    const el = list.current;
    if (!el || !ready) return;
    el.scrollTo({ top: el.scrollHeight, behavior: first.current ? "auto" : "smooth" });
    first.current = false;
  }, [msgs.length, ready]);
  useEffect(() => { first.current = true; }, [t.id]);

  const send = () => {
    const v = text.trim();
    if (!v) return;
    actions.sendMessage(me, users, t, v, (e) => toast(e.message, "err"));
    setText("");
    box.current?.focus();
  };

  let lastDay = "";
  return (
    <aside className="chat card">
      <div className="chat-head">
        <div><b>Task chat</b><div className="muted">{user(t.assigneeId)?.name ?? "Designer"} & admins</div></div>
        <span className="pill">{msgs.length}</span>
      </div>
      <div className="chat-list" ref={list}>
        {!ready ? <><Skeleton h={38} w="70%" /><br /><Skeleton h={38} w="55%" /></>
          : !msgs.length ? <div className="chat-empty"><div className="empty-ico">💬</div>Start the conversation: share feedback, corrections or questions about this task.</div>
          : msgs.map((m, i) => {
            const d = m.createdAt?.toDate?.() ?? new Date();
            const day = dayLabel(d), showDay = day !== lastDay; lastDay = day;
            const mine = m.authorUid === me.id;
            const prev = msgs[i - 1];
            const grouped = !showDay && prev?.authorUid === m.authorUid;
            const author = user(m.authorUid);
            return (
              <Fragment key={m.id}>
                {showDay && <div className="chat-day"><span>{day}</span></div>}
                <div className={"msg" + (mine ? " mine" : "") + (grouped ? " grouped" : "")}>
                  {!mine && !grouped && <Avatar name={m.authorName} photo={author?.photoURL} size={26} />}
                  <div className="bubble">
                    {!mine && !grouped && <div className="who">{m.authorName}{author?.role === "Admin" && <span className="role">Admin</span>}</div>}
                    <div className="body"><Linkified text={m.text} /></div>
                    <div className="time">{timeLabel(d)}</div>
                  </div>
                </div>
              </Fragment>
            );
          })}
      </div>
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <textarea ref={box} rows={1} value={text} placeholder="Write a message…" maxLength={4000}
          onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px"; }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
        <button className="send" type="submit" disabled={!text.trim()} aria-label="Send">➤</button>
      </form>
    </aside>
  );
}
