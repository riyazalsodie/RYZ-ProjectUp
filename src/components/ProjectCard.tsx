import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpFromLine,
  Check,
  Clock3,
  Eye,
  FileWarning,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  GitBranch,
} from "lucide-react";
import { Project } from "@/types";
import { cn } from "@/lib/utils";
import { formatBytes, formatNumber, formatRelative, projectInitials, tileColor, truncateMiddle } from "@/utils/format";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface ProjectCardProps {
  project: Project;
  index: number;
  driveConnected: boolean;
  onBackup: (project: Project) => void;
  onPreview: (project: Project) => void;
  onReveal: (path: string) => void;
  onRemove: (project: Project) => void;
  onRefreshStats: (project: Project) => Promise<void>;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  index,
  driveConnected,
  onBackup,
  onPreview,
  onReveal,
  onRemove,
  onRefreshStats,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const stats = project.stats;
  const last = project.last_backup;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshStats(project);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: Math.min(index * 0.045, 0.25), ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#030604] p-4 transition-all duration-300 hover:border-primary/25 hover:bg-[#040806] hover:shadow-[0_20px_50px_-30px_rgba(0,255,136,0.25)]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/0 to-transparent transition-all duration-300 group-hover:via-primary/30" />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border bg-gradient-to-br text-sm font-bold",
              tileColor(project.name)
            )}
          >
            {projectInitials(project.name)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-white">{project.name}</h3>
              {stats?.gitignore_present ? (
                <Badge variant="secondary" className="gap-1 border-primary/15 bg-primary/[0.06] text-primary/80">
                  <Check className="h-2.5 w-2.5" />
                  .gitignore
                </Badge>
              ) : (
                <Badge variant="warning" className="gap-1">
                  <FileWarning className="h-2.5 w-2.5" />
                  no .gitignore
                </Badge>
              )}
              {stats?.ryzignore_present ? (
                <Badge variant="secondary" className="gap-1">
                  <GitBranch className="h-2.5 w-2.5" />
                  .ryzignore
                </Badge>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => onReveal(project.path)}
              title={project.path}
              className="path-text mt-1.5 flex max-w-full items-center gap-1.5 text-left text-neutral-500 transition-colors hover:text-neutral-300"
            >
              <FolderOpen className="h-3 w-3 shrink-0" />
              <span className="truncate">{truncateMiddle(project.path, 72)}</span>
            </button>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-neutral-500">
              <span className="flex items-center gap-1.5" title="Files included after ignore rules">
                <span className="h-1 w-1 rounded-full bg-primary/60" />
                {formatNumber(stats?.included_files ?? 0)} files
              </span>
              <span>{formatBytes(stats?.included_bytes ?? 0)}</span>
              {stats && stats.ignored_files > 0 ? (
                <span className="flex items-center gap-1 text-neutral-600" title="Files excluded by .gitignore rules">
                  <Trash2 className="h-2.5 w-2.5" />
                  {formatNumber(stats.ignored_files)} ignored
                </span>
              ) : null}
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-2.5 w-2.5" />
                {last ? `Backed up ${formatRelative(last.created_at)}` : "Never backed up"}
              </span>
              {project.backup_count > 0 ? (
                <span className="text-primary/60">{project.backup_count} snapshots</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 lg:justify-end">
          <Button
            size="sm"
            onClick={() => onBackup(project)}
            className="h-8 gap-1.5 px-3.5"
            title={driveConnected ? "Backup this project to Google Drive" : "Connect Google Drive first"}
          >
            <ArrowUpFromLine className="h-3.5 w-3.5" />
            Back up
          </Button>

          {refreshing ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            </div>
          ) : (
            <Button
              size="icon-sm"
              variant="secondary"
              onClick={handleRefresh}
              title="Re-scan ignore rules and size"
              className="border-white/[0.07]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="secondary" className="border-white/[0.07]" title="Project actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Project</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onPreview(project)}>
                <Eye className="h-3.5 w-3.5 text-primary/70" />
                Inspect ignore rules
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onReveal(project.path)}>
                <FolderOpen className="h-3.5 w-3.5 text-neutral-500" />
                Reveal in Explorer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRefresh}>
                <RefreshCw className="h-3.5 w-3.5 text-neutral-500" />
                Re-scan project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onRemove(project)}
                className="text-red-400 focus:bg-red-500/10 focus:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  );
};
