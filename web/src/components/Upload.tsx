import { useRef, useState } from "react";
import { uploadFile } from "../api";
import { useToast } from "./ui";

/** Drag-and-drop / tap-to-pick upload straight to Google Drive with live progress. */
export function Upload({ kind, id, accept = "image/*,video/mp4,video/quicktime,video/webm,application/pdf", label, compact, onDone }: {
  kind: "task" | "cover"; id: string; accept?: string; label?: string; compact?: boolean; onDone?: (fileId: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const toast = useToast();

  async function send(file?: File) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast("File is larger than 25 MB", "err"); return; }
    setPct(0);
    try {
      const { fileId } = await uploadFile(kind, id, file, setPct);
      toast("Uploaded to Google Drive");
      onDone?.(fileId);
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setPct(null);
      if (input.current) input.current.value = "";
    }
  }

  if (compact) return (
    <>
      <button type="button" className="btn secondary tiny" disabled={pct !== null} onClick={() => input.current?.click()}>
        {pct === null ? label ?? "Upload" : pct < 100 ? `Uploading ${pct}%` : "Saving to Drive…"}
      </button>
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => send(e.target.files?.[0])} />
    </>
  );

  return (
    <div className={"dropzone" + (over ? " over" : "")} onClick={() => pct === null && input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files?.[0]); }}>
      <input ref={input} type="file" accept={accept} onChange={(e) => send(e.target.files?.[0])} />
      {pct === null ? <><b>⇪ {label ?? "Upload design"}</b><div className="mini">Drop a file or tap to choose · images, video, PDF · max 25 MB</div></>
        : <><b>{pct < 100 ? `Uploading… ${pct}%` : "Saving to Google Drive…"}</b>
          <div className={"uploadbar" + (pct >= 100 ? " indet" : "")}><i style={{ width: pct + "%" }} /></div></>}
    </div>
  );
}
