import { useState, useRef } from "react";

interface Props {
  onIngested: () => void;
}

type Stage = "idle" | "uploading" | "processing" | "done" | "error";

export default function Upload({ onIngested }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".pdf")) { setError("PDF files only."); return; }
    setStage("uploading");
    setError("");

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/ingest", { method: "POST", body: form });
    if (!res.ok) { setStage("error"); setError("Upload failed."); return; }

    const { job_id } = await res.json();
    setStage("processing");
    setStep("Ingesting PDF…");

    pollRef.current = setInterval(async () => {
      const jr = await fetch(`/api/jobs/${job_id}`);
      const data = await jr.json();
      if (data.status === "processing") { setStep(data.step ?? "Processing…"); }
      else if (data.status === "done") {
        clearInterval(pollRef.current!);
        setStage("done");
        onIngested();
        setTimeout(() => setStage("idle"), 2000);
      } else if (data.status === "error") {
        clearInterval(pollRef.current!);
        setStage("error");
        setError(data.message ?? "Processing failed.");
      }
    }, 1500);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="p-3 border-b border-white/[0.06]">
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => stage === "idle" && inputRef.current?.click()}
        className={`relative rounded-lg border border-dashed px-3 py-3 text-center transition-colors cursor-pointer
          ${stage === "idle" ? "border-white/10 hover:border-white/20 hover:bg-surface-2" : "border-white/5 cursor-default"}
          ${stage === "done" ? "border-accent-teal/30 bg-accent-teal/5" : ""}
          ${stage === "error" ? "border-accent-coral/30 bg-accent-coral/5" : ""}
        `}
      >
        <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

        {stage === "idle" && (
          <p className="text-xs text-gray-500">Drop PDF or <span className="text-gray-400 underline underline-offset-2">browse</span></p>
        )}
        {(stage === "uploading" || stage === "processing") && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-2">
              <Spinner />
              <p className="text-xs text-gray-400">{step || "Uploading…"}</p>
            </div>
          </div>
        )}
        {stage === "done" && <p className="text-xs text-accent-teal">Graph ready ✓</p>}
        {stage === "error" && <p className="text-xs text-accent-coral">{error}</p>}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-3 h-3 text-gray-400" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
