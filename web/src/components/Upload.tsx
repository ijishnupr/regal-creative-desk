import { useRef, useState } from "react";
import { uploadFile, type UploadStage } from "../api";
import { actions } from "../data";
import { useToast } from "./ui";

const LABEL: Record<UploadStage, string> = { reading: "Preparing image…", uploading: "Uploading to Google Drive…", saving: "Saving…" };

/** Campaign cover upload (the only place files are uploaded; tasks use links). */
export function CoverUpload({ campaignId, label = "Upload Campaign Cover" }: { campaignId: string; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<UploadStage | null>(null);
  const toast = useToast();
  async function send(file?: File) {
    if (!file) return;
    try {
      setStage("reading");
      await uploadCover(campaignId, file, setStage, (e) => toast(e.message, "err"));
      toast("Cover uploaded to Google Drive");
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setStage(null);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <>
      <button type="button" className="btn secondary tiny" disabled={stage !== null} onClick={() => input.current?.click()}>
        {stage === null ? label : LABEL[stage]}
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => send(e.target.files?.[0])} />
    </>
  );
}

export async function uploadCover(campaignId: string, file: File, onStage?: (s: UploadStage) => void, onError?: (e: Error) => void) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file");
  if (file.size > 25 * 1024 * 1024) throw new Error("Image is larger than 25 MB");
  const up = await uploadFile("cover", campaignId, file, onStage);
  actions.setCover(campaignId, up.fileId, onError);
}
