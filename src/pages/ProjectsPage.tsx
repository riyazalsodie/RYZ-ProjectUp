import React, { useMemo, useState } from "react";
import {
  ArrowUpFromLine,
  Cloud,
  CloudOff,
  FolderGit2,
  Files,
  Loader2,
  Search,
  X,
  Clock3,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import { AppSnapshot, BulkBackupState, Project } from "@/types";
import { EmptyState } from "@/components/EmptyState";
import { ProjectCard } from "@/components/ProjectCard";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBytes, formatNumber, formatRelative } from "@/utils/format";
import { cn } from "@/lib/utils";

type SortMode = "recent" | "name" | "size";

interface ProjectsPageProps {
  snapshot: AppSnapshot;
  loading: boolean;
  adding: boolean;
  search: string;
  onSearch: (value: string) => void;
  onAddProject: () => void;
  onBackup: (project: Project) => void;
  onBackupAll: () => void;
  onCancelBulkBackup: () => void;
  bulkBackup: BulkBackupState | null;
  autoBackupProject: string | null;
  onCancelAutoBackup: () => void;
  onPreview: (project: Project) => void;
  onReveal: (path: string) => void;
  onRelink: (project: Project) => void;
  onRemove: (project: Project) => void;
  onRefreshStats: (project: Project) => Promise<void>;
  onConnectDrive: () => void;
  onOpenDriveFolder: () => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  snapshot,
  loading,
  adding,
  search,
  onSearch,
  onAddProject,
  onBackup,
  onBackupAll,
  onCancelBulkBackup,
  bulkBackup,
  autoBackupProject,
  onCancelAutoBackup,
  onPreview,
  onReveal,
  onRelink,
  onRemove,
  onRefreshStats,
  onConnectDrive,
  onOpenDriveFolder,
}) => {
  const [sort, setSort] = useState<SortMode>("recent");
  const { projects, backups, drive } = snapshot;

  const totals = useMemo(() => {
    const includedFiles = projects.reduce((sum, p) => sum + (p.stats?.included_files ?? 0), 0);
    const ignoredFiles = projects.reduce((sum, p) => sum + (p.stats?.ignored_files ?? 0), 0);
    const backedUpBytes = backups.reduce((sum, b) => sum + b.size_bytes, 0);
    const last = backups.length
      ? [...backups].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0]
      : null;
    return { includedFiles, ignoredFiles, backedUpBytes, last };
  }, [projects, backups]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = projects.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "size") return (b.stats?.included_bytes ?? 0) - (a.stats?.included_bytes ?? 0);
      const at = a.last_backup?.created_at ?? a.added_at;
      const bt = b.last_backup?.created_at ?? b.added_at;
      return at < bt ? 1 : -1;
    });
  }, [projects, search, sort]);

  return (
    <div className="relative flex-1 overflow-y-auto">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden">
        <div className="aura left-[8%] top-[-140px] h-[320px] w-[420px] bg-primary/[0.09]" />
        <div className="aura right-[2%] top-[-180px] h-[300px] w-[380px] bg-emerald-500/[0.06]" />
        <div className="ambient-grid absolute inset-0 opacity-60" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 pb-10 pt-6 sm:px-7">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-primary/70">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_#00ff88]" />
              Backup workspace
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Project backups<span className="text-primary">.</span>
            </h1>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-neutral-500">
              Pick a folder, skip everything Git ignores, and send a compressed snapshot straight to Google
              Drive.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {drive.connected ? (
              <Button variant="secondary" size="sm" onClick={onOpenDriveFolder} className="gap-1.5">
                <Cloud className="h-3.5 w-3.5 text-primary" />
                Drive folder
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={onConnectDrive} className="gap-1.5">
                <CloudOff className="h-3.5 w-3.5" />
                Connect Drive
              </Button>
            )}
            {projects.length > 0 ? (
              bulkBackup ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onCancelBulkBackup}
                  className="gap-1.5"
                  title="Cancel the bulk backup"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  Stop bulk ({bulkBackup.current + 1}/{bulkBackup.total})
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onBackupAll}
                  className="gap-1.5"
                  title="Back up every available project (Ctrl+Shift+B)"
                >
                  <ArrowUpFromLine className="h-3.5 w-3.5" />
                  Back up all
                </Button>
              )
            ) : null}
            <Button onClick={onAddProject} loading={adding} className="gap-2 px-4">
              <FolderGit2 className="h-3.5 w-3.5" />
              Add project
            </Button>
          </div>
        </header>

        <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <StatCard
            label="Projects"
            value={formatNumber(projects.length)}
            hint={totals.ignoredFiles > 0 ? `${formatNumber(totals.ignoredFiles)} files skipped` : "Git-aware scanning"}
            icon={FolderGit2}
            accent
          />
          <StatCard
            label="Tracked files"
            value={formatNumber(totals.includedFiles)}
            hint="After .gitignore rules"
            icon={Files}
          />
          <StatCard
            label="Drive snapshots"
            value={formatNumber(backups.length)}
            hint={formatBytes(totals.backedUpBytes)}
            icon={Cloud}
          />
          <StatCard
            label="Last backup"
            value={totals.last ? formatRelative(totals.last.created_at) : "—"}
            hint={totals.last ? totals.last.project_name : "No snapshots yet"}
            icon={Clock3}
          />
        </div>

        {!drive.connected ? (
          <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-2.5">
              <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <p className="text-xs font-semibold text-amber-200">Google Drive is not connected yet</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-amber-200/60">
                  You can add and scan projects now. Connect Drive to start uploading snapshots.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={onConnectDrive}
              className="border-amber-500/25 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
            >
              Connect Google Drive
            </Button>
          </div>
        ) : null}

        {autoBackupProject ? (
          <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/[0.055] px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-2.5">
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
              <div>
                <p className="text-xs font-semibold text-primary">Automatic backup running</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-primary/60">
                  {autoBackupProject} is being archived and uploaded in the background.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={onCancelAutoBackup}
              className="border-primary/25 bg-primary/10 text-primary hover:bg-primary/15"
            >
              Stop backup
            </Button>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600" />
            <Input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search projects or paths..."
              className="h-9 pl-9 pr-8"
            />
            {search ? (
              <button
                type="button"
                onClick={() => onSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-600 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3 w-3 text-neutral-600" />
            <div className="flex rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
              {(
                [
                  { id: "recent", label: "Recent" },
                  { id: "name", label: "Name" },
                  { id: "size", label: "Size" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSort(opt.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-all",
                    sort === opt.id
                      ? "bg-primary/15 text-primary"
                      : "text-neutral-500 hover:text-neutral-300"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3.5 space-y-2.5">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-2xl border border-white/[0.05] bg-[#030604] p-4"
              >
                <div className="h-12 w-12 animate-pulse rounded-2xl bg-white/[0.05]" />
                <div className="flex-1 space-y-2.5">
                  <div className="h-3 w-40 animate-pulse rounded-full bg-white/[0.06]" />
                  <div className="h-2.5 w-64 animate-pulse rounded-full bg-white/[0.035]" />
                  <div className="h-2 w-80 animate-pulse rounded-full bg-white/[0.025]" />
                </div>
              </div>
            ))
          ) : projects.length === 0 ? (
            <EmptyState onAddProject={onAddProject} loading={adding} />
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#020403] px-6 py-12 text-center">
              <Search className="mx-auto h-6 w-6 text-neutral-600" />
              <p className="mt-3 text-sm font-semibold text-neutral-300">No projects match “{search}”</p>
              <p className="mt-1 text-xs text-neutral-600">Try a different name or folder path.</p>
              <Button variant="secondary" size="sm" onClick={() => onSearch("")} className="mt-4">
                Clear search
              </Button>
            </div>
          ) : (
            filtered.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={index}
                driveConnected={drive.connected}
                onBackup={onBackup}
                onPreview={onPreview}
                onReveal={onReveal}
                onRelink={onRelink}
                onRemove={onRemove}
                onRefreshStats={onRefreshStats}
              />
            ))
          )}
        </div>

        {projects.length > 0 ? (
          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[10px] text-neutral-700">
            <Sparkles className="h-3 w-3 text-primary/40" />
            Snapshots are built locally and streamed directly to Google Drive.
          </p>
        ) : null}
      </div>
    </div>
  );
};
