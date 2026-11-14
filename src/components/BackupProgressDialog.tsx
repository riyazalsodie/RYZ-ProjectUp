import React from "react";
import {
  AlertTriangle,
  ArrowUpFromLine,
  Check,
  CheckCircle2,
  ExternalLink,
  FileArchive,
  FolderGit2,
  Loader2,
  Search,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { BackupJobState } from "@/types";
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
import { formatBytes, formatDateTime, formatNumber, projectInitials, tileColor } from "@/utils/format";
import { cn } from "@/lib/utils";

interface BackupProgressDialogProps {
  job: BackupJobState | null;
  onClose: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onOpenDrive: (url: string) => void;
}

const PHASES = [
  { key: "scanning", label: "Scan project", hint: "Reading ignore rules", icon: Search },
  { key: "archiving", label: "Compress files", hint: "Building zip archive", icon: FileArchive },
  { key: "uploading", label: "Upload to Drive", hint: "Streaming snapshot", icon: UploadCloud },
  { key: "finalizing", label: "Finalize", hint: "Saving metadata", icon: ShieldCheck },
] as const;

const phaseIndex = (phase: string) => {
  if (phase === "done") return PHASES.length;
  const idx = PHASES.findIndex((p) => p.key === phase);
  return idx < 0 ? 0 : idx;
};

export const BackupProgressDialog: React.FC<BackupProgressDialogProps> = ({
  job,
  onClose,
  onCancel,
  onRetry,
  onOpenDrive,
}) => {
  const open = !!job;
  const running = job?.status === "running";

  if (!job) return null;

  const current = phaseIndex(job.progress.phase);
  const pct = Math.min(100, Math.max(0, Math.round(job.progress.percent)));
  const record = job.record;

  return (
    <Dialog
      open={open}
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
                tileColor(job.project.name)
              )}
            >
              {projectInitials(job.project.name)}
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate">
                {running
                  ? "Creating snapshot"
                  : job.status === "success"
                    ? "Backup complete"
                    : job.status === "cancelled"
                      ? "Backup cancelled"
                      : "Backup failed"}
              </DialogTitle>
              <DialogDescription className="truncate">{job.project.name}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {running ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-4">
              <div className="flex items-end justify-between">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/80">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {job.progress.message || "Preparing backup…"}
                </div>
                <span className="text-2xl font-semibold text-white tabular">{pct}%</span>
              </div>
              <Progress value={pct} className="mt-3 h-2" />
              <div className="mt-2.5 flex items-center justify-between text-[10px] text-neutral-500">
                <span>
                  {job.progress.current > 0
                    ? `${formatNumber(job.progress.current)} / ${formatNumber(job.progress.total)} files`
                    : "Scanning project tree"}
                </span>
                <span>
                  {job.progress.bytes_total > 0
                    ? `${formatBytes(job.progress.bytes_done)} / ${formatBytes(job.progress.bytes_total)}`
                    : ""}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              {PHASES.map((phase, idx) => {
                const done = idx < current || job.progress.phase === "done";
                const active = idx === current;
                const Icon = phase.icon;
                return (
                  <div key={phase.key} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                    <div
                      className={cn(
                        "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all",
                        done
                          ? "border-primary/40 bg-primary/15 text-primary"
                          : active
                            ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_16px_-4px_rgba(0,255,136,0.6)]"
                            : "border-white/[0.07] bg-white/[0.02] text-neutral-600"
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
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-[11px] font-medium",
                          done || active ? "text-neutral-200" : "text-neutral-600"
                        )}
                      >
                        {phase.label}
                      </p>
                      <p className="text-[9px] text-neutral-600">{phase.hint}</p>
                    </div>
                    {active ? (
                      <span className="text-[9px] font-semibold text-primary">IN PROGRESS</span>
                    ) : done ? (
                      <span className="text-[9px] font-medium text-primary/60">DONE</span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/[0.05] pt-3">
              <p className="text-[10px] leading-relaxed text-neutral-600">
                Keep ProjectUp open while the snapshot uploads.
              </p>
              <Button variant="secondary" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : job.status === "success" && record ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center rounded-2xl border border-primary/20 bg-primary/[0.04] px-4 py-6 text-center">
              <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-primary shadow-[0_0_40px_-10px_rgba(0,255,136,0.65)]">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <p className="text-sm font-semibold text-white">Snapshot uploaded to Drive</p>
              <p className="mt-1 max-w-xs truncate text-[10px] text-neutral-500">{record.file_name}</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[10px] text-neutral-400">
                <span className="rounded-full border border-white/[0.07] bg-black/30 px-2.5 py-1">
                  {formatNumber(record.file_count)} files
                </span>
                <span className="rounded-full border border-white/[0.07] bg-black/30 px-2.5 py-1">
                  {formatBytes(record.size_bytes)}
                </span>
                <span className="rounded-full border border-white/[0.07] bg-black/30 px-2.5 py-1">
                  {formatDateTime(record.created_at)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {record.web_view_link ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenDrive(record.web_view_link as string)}
                  className="gap-1.5"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View in Drive
                </Button>
              ) : null}
              <Button size="sm" onClick={onClose} className="gap-1.5">
                <Check className="h-3.5 w-3.5" />
                Done
              </Button>
            </div>
          </div>
        ) : job.status === "cancelled" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <p className="text-xs font-semibold text-amber-200">Upload cancelled</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-amber-200/60">
                  No partial archive was kept. You can safely retry whenever you&apos;re ready.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button size="sm" onClick={onRetry} className="gap-1.5">
                <ArrowUpFromLine className="h-3.5 w-3.5" />
                Retry backup
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-300">Backup failed</p>
                <p className="mt-1 break-words text-[10px] leading-relaxed text-red-200/70">
                  {job.error || "Something went wrong while creating the snapshot."}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button size="sm" onClick={onRetry} className="gap-1.5">
                <ArrowUpFromLine className="h-3.5 w-3.5" />
                Retry backup
              </Button>
            </DialogFooter>
          </div>
        )}

        {running ? (
          <div className="flex items-center justify-center gap-1.5 text-[9px] text-neutral-700">
            <FolderGit2 className="h-3 w-3" />
            Snapshot is created locally, then streamed directly to your Drive.
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
