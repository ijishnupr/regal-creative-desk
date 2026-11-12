import { useRef, useState } from "react";
import { uploadFile, type UploadStage } from "../api";
import { actions } from "../data";
import { useMe } from "../auth";
import { useToast } from "./ui";

const LABEL: Record<UploadStage, string> = { reading: "Preparing file…", uploading: "Uploading to Google Drive…", saving: "Saving…" };

/** Drag-and-drop / tap-to-pick upload straight to Google Drive. */
export function Upload({ kind, id, accept = "image/*,video/mp4,video/quicktime,video/webm,application/pdf", label, compact, onDone }: {
  kind: "task" | "cover"; id: string; accept?: string; label?: string; compact?: boolean; onDone?: (fileId: string) => void;
}) {
  const me = useMe();
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<UploadStage | null>(null);
  const [over, setOver] = useState(false);
  const toast = useToast();

  async function send(file?: File) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast("File is larger than 25 MB", "err"); return; }
    setStage("reading");
    try {
      const up = await uploadFile(kind, id, file, setStage);
      if (kind === "task") actions.attachTaskFile(me, id, up.fileId, up.fileName, up.mime, (e) => toast(e.message, "err"));
      else actions.setCover(id, up.fileId, (e) => toast(e.message, "err"));
      toast("Uploaded to Google Drive");
      onDone?.(up.fileId);
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setStage(null);
      if (input.current) input.current.value = "";
    }
  }

  if (compact) return (
    <>
      <button type="button" className="btn secondary tiny" disabled={stage !== null} onClick={() => input.current?.click()}>
        {stage === null ? label ?? "Upload" : LABEL[stage]}
      </button>
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => send(e.target.files?.[0])} />
    </>
  );

  return (
    <div className={"dropzone" + (over ? " over" : "")} onClick={() => stage === null && input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files?.[0]); }}>
      <input ref={input} type="file" accept={accept} onChange={(e) => send(e.target.files?.[0])} />
      {stage === null ? <><b>⇪ {label ?? "Upload design"}</b><div className="mini">Drop a file or tap to choose · images, video, PDF · max 25 MB</div></>
        : <><b>{LABEL[stage]}</b><div className="uploadbar indet"><i /></div></>}
    </div>
  );
}
