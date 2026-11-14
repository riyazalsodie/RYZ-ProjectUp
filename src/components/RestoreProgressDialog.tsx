import React from "react";
import {
  ArrowDownToLine,
  Check,
  CheckCircle2,
  DownloadCloud,
  FileArchive,
  FolderOpen,
  Loader2,
  XCircle,
} from "lucide-react";
import { RestoreJobState } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatNumber, projectInitials, tileColor } from "@/utils/format";
import { cn } from "@/lib/utils";

interface RestoreProgressDialogProps {
  job: RestoreJobState | null;
  onClose: () => void;
  onReveal: (path: string) => void;
}

export const RestoreProgressDialog: React.FC<RestoreProgressDialogProps> = ({
  job,
  onClose,
  onReveal,
}) => {
  const running = job?.status === "running";

  if (!job) return null;

  const pct = Math.min(100, Math.max(0, Math.round(job.progress.percent)));

  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !running) onClose();
      }}
    >
      <DialogContent
        hideClose
        className="max-w-md"
        onEscapeKeyDown={(e) => {
          if (running) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (running) e.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border bg-gradient-to-br text-sm font-bold",
                tileColor(job.record.project_name)
              )}
            >
              {projectInitials(job.record.project_name)}
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate">
                {running ? "Restoring snapshot" : job.status === "success" ? "Restore complete" : "Restore failed"}
              </DialogTitle>
              <DialogDescription className="truncate">{job.record.project_name}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {running ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-4">
              <div className="flex items-end justify-between">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/80">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {job.progress.message || "Contacting Google Drive…"}
                </div>
                <span className="text-2xl font-semibold text-white tabular">{pct}%</span>
              </div>
              <Progress value={pct} className="mt-3 h-2" />
            </div>

            <div className="space-y-2">
              {[
                { key: "downloading", label: "Download from Drive", icon: DownloadCloud },
                { key: "extracting", label: "Extract archive", icon: FileArchive },
              ].map((step) => {
                const phaseRank =
                  job.progress.phase === "downloading"
                    ? 0
                    : job.progress.phase === "extracting"
                      ? 1
                      : 2;
                const stepRank = step.key === "downloading" ? 0 : 1;
                const done = stepRank < phaseRank;
                const active = stepRank === phaseRank;
                const Icon = step.icon;
                return (
                  <div
                    key={step.key}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                      active
                        ? "border-primary/20 bg-primary/[0.04]"
                        : "border-white/[0.05] bg-white/[0.015]"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full border",
                        done
                          ? "border-primary/40 bg-primary/15 text-primary"
                          : active
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-white/[0.07] text-neutral-600"
                      )}
                    >
                      {done ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : active ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Icon className="h-3 w-3" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        done || active ? "text-neutral-200" : "text-neutral-600"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-[10px] text-neutral-600">
              The snapshot is extracted into a fresh folder — nothing is overwritten.
            </p>
          </div>
        ) : job.status === "success" && job.result ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center rounded-2xl border border-primary/20 bg-primary/[0.04] px-4 py-6 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-primary shadow-[0_0_40px_-10px_rgba(0,255,136,0.65)]">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <p className="text-sm font-semibold text-white">Snapshot restored</p>
              <p className="mt-1 text-[10px] text-neutral-500">
                {formatNumber(job.result.file_count)} files extracted
              </p>
              <p className="path-text mt-3 max-w-full break-all rounded-xl border border-white/[0.06] bg-black/40 px-3 py-2 text-neutral-400">
                {job.result.destination}
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={() => onReveal(job.result?.destination ?? "")}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Open folder
              </Button>
              <Button size="sm" onClick={onClose} className="gap-1.5">
                <ArrowDownToLine className="h-3.5 w-3.5" />
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-300">Restore failed</p>
                <p className="mt-1 break-words text-[10px] leading-relaxed text-red-200/70">
                  {job.error || "The snapshot could not be restored."}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" variant="secondary" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
