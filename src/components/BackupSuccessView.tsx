import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  Cloud,
  Clock3,
  FileArchive,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BackupRecord, Project } from "@/types";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import {
  formatBytes,
  formatDateTime,
  formatNumber,
  projectInitials,
  tileColor,
} from "@/utils/format";

interface BackupSuccessViewProps {
  project: Project;
  record: BackupRecord;
  onClose: () => void;
  onOpenDrive: (url: string) => void;
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export const BackupSuccessView: React.FC<BackupSuccessViewProps> = ({
  project,
  record,
  onClose,
  onOpenDrive,
}) => {
  const reduceMotion = useReducedMotion();

  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) => {
        const angle = (index / 24) * Math.PI * 2 + (index % 3) * 0.18;
        const distance = 76 + (index % 6) * 17;
        return {
          id: index,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 16,
          rotate: (index % 2 === 0 ? 1 : -1) * (100 + index * 9),
          delay: (index % 5) * 0.035,
          size: index % 4 === 0 ? 3 : 5,
          color:
            index % 3 === 0 ? "#7dffbb" : index % 3 === 1 ? "#00ff88" : "rgba(255,255,255,0.72)",
        };
      }),
    []
  );

  return (
    <div className="relative isolate -mx-1 overflow-hidden px-1">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-44 w-72 -translate-x-1/2 rounded-full bg-primary/[0.09] blur-3xl" />

      {!reduceMotion ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-56">
          {particles.map((particle) => (
            <motion.span
              key={particle.id}
              initial={{ x: 0, y: 0, opacity: 1, scale: 0.3, rotate: 0 }}
              animate={{
                x: particle.x,
                y: particle.y,
                opacity: 0,
                scale: 1,
                rotate: particle.rotate,
              }}
              transition={{
                duration: 1.35,
                delay: 0.32 + particle.delay,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="absolute left-1/2 top-[92px] rounded-full"
              style={{
                width: particle.size,
                height: particle.size * (particle.id % 3 === 0 ? 2.2 : 1),
                backgroundColor: particle.color,
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="relative flex flex-col items-center pt-1 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <motion.span
            className="absolute inset-0 rounded-full border border-primary/25"
            initial={{ scale: 0.55, opacity: 0.8 }}
            animate={{ scale: [0.55, 1.45], opacity: [0.65, 0] }}
            transition={{ duration: 1.7, ease: "easeOut" }}
          />
          <motion.span
            className="absolute inset-2 rounded-full border border-primary/15"
            initial={{ scale: 0.7, opacity: 0.6 }}
            animate={{ scale: [0.7, 1.4], opacity: [0.5, 0] }}
            transition={{ duration: 1.7, delay: 0.14, ease: "easeOut" }}
          />
          <motion.div
            initial={{ scale: 0.45, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 250, damping: 17, delay: 0.06 }}
            className="relative flex h-16 w-16 items-center justify-center rounded-full border border-primary/40 bg-[#062515] text-primary shadow-[0_0_45px_-8px_rgba(0,255,136,0.8)]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8"
            >
              <motion.path
                d="M5 12.5l4.2 4.2L19 7"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.45, delay: 0.34, ease: "easeOut" }}
              />
            </svg>
          </motion.div>
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.62, duration: 0.35 }}
            className="absolute -right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-primary/25 bg-[#041007] text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </motion.span>
        </div>

        <motion.div {...fadeUp(0.2)} className="mt-4">
          <p className="flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-primary/75">
            <Cloud className="h-3 w-3" />
            Uploaded to Google Drive
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
            Snapshot secured<span className="text-primary">.</span>
          </h2>
          <p className="mt-1 text-[11px] text-neutral-500">
            The snapshot is in Google Drive and can be restored from Backup History.
          </p>
        </motion.div>

        <motion.div
          {...fadeUp(0.27)}
          className="mt-4 flex items-center gap-2.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5"
        >
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg border bg-gradient-to-br text-[10px] font-bold",
              tileColor(project.name)
            )}
          >
            {projectInitials(project.name)}
          </div>
          <span className="max-w-[220px] truncate text-[11px] font-semibold text-neutral-200">
            {project.name}
          </span>
          <span className="h-1 w-1 rounded-full bg-primary/70" />
          <span className="text-[10px] text-neutral-500">Snapshot complete</span>
        </motion.div>

        <motion.div {...fadeUp(0.34)} className="mt-4 grid w-full grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-2.5">
            <FileArchive className="mx-auto h-3.5 w-3.5 text-primary/70" />
            <p className="mt-1.5 text-sm font-semibold text-white tabular">
              {formatNumber(record.file_count)}
            </p>
            <p className="text-[9px] uppercase tracking-wider text-neutral-600">Files</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-2.5">
            <Cloud className="mx-auto h-3.5 w-3.5 text-primary/70" />
            <p className="mt-1.5 text-sm font-semibold text-white tabular">
              {formatBytes(record.size_bytes)}
            </p>
            <p className="text-[9px] uppercase tracking-wider text-neutral-600">Archive</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-2.5">
            <Clock3 className="mx-auto h-3.5 w-3.5 text-primary/70" />
            <p className="mt-1.5 truncate text-[11px] font-semibold text-white">
              {formatDateTime(record.created_at)}
            </p>
            <p className="text-[9px] uppercase tracking-wider text-neutral-600">Uploaded</p>
          </div>
        </motion.div>

        <motion.div
          {...fadeUp(0.41)}
          className="mt-3 w-full space-y-2 rounded-2xl border border-white/[0.06] bg-black/30 p-3 text-left"
        >
          <div className="flex items-center gap-2.5">
            <FileArchive className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
            <span className="w-16 shrink-0 text-[9px] font-bold uppercase tracking-wider text-neutral-600">
              Snapshot
            </span>
            <span className="path-text min-w-0 flex-1 truncate text-neutral-400" title={record.file_name}>
              {record.file_name}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary/60" />
            <span className="w-16 shrink-0 text-[9px] font-bold uppercase tracking-wider text-neutral-600">
              Destination
            </span>
            <span className="min-w-0 flex-1 truncate text-[10px] text-neutral-400">
              Google Drive
            </span>
            <span className="rounded-full border border-primary/20 bg-primary/[0.06] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary/80">
              Cloud
            </span>
          </div>
        </motion.div>

        <motion.div {...fadeUp(0.48)} className="mt-4 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          {record.web_view_link ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenDrive(record.web_view_link as string)}
              className="gap-1.5"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              View in Drive
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={onClose} className="gap-1.5 px-5">
            <Check className="h-3.5 w-3.5" />
            Done
          </Button>
        </motion.div>

        <motion.p
          {...fadeUp(0.55)}
          className="mt-3 flex items-center gap-1.5 text-center text-[9px] text-neutral-600"
        >
          <ShieldCheck className="h-2.5 w-2.5 text-primary/40" />
          Stored in your Drive. No RYZ servers.
        </motion.p>
      </div>
    </div>
  );
};
