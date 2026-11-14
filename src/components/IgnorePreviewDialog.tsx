import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertTriangle,
  Check,
  Eye,
  FileX2,
  Files,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { IgnoredSample, Project, ScanPreview } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBytes, formatNumber } from "@/utils/format";
import { errorMessage } from "@/utils/format";

interface IgnorePreviewDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const IgnorePreviewDialog: React.FC<IgnorePreviewDialogProps> = ({
  project,
  open,
  onOpenChange,
}) => {
  const [preview, setPreview] = useState<ScanPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = React.useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<ScanPreview>("scan_project_preview", { projectId });
      setPreview(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && project) {
      setPreview(null);
      load(project.id);
    }
  }, [open, project, load]);

  const stats = preview?.stats;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-x-hidden">
        <DialogHeader className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
              <Eye className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate">Ignore rules — {project?.name}</DialogTitle>
              <DialogDescription className="truncate">
                Exactly what ProjectUp includes and skips in this snapshot.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-neutral-500">Scanning project and reading ignore files…</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 text-xs text-red-300">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Could not scan project
            </div>
            <p className="mt-1.5 break-words text-[11px] text-red-300/70">{error}</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3 gap-1.5"
              onClick={() => project && load(project.id)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </Button>
          </div>
        ) : stats ? (
          <div className="min-w-0 space-y-4">
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-600">Included</p>
                <p className="mt-1 truncate text-sm font-semibold text-white tabular">
                  {formatNumber(stats.included_files)}
                </p>
                <p className="truncate text-[9px] text-neutral-500">{formatBytes(stats.included_bytes)}</p>
              </div>
              <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-600">Ignored</p>
                <p className="mt-1 truncate text-sm font-semibold text-neutral-300 tabular">
                  {formatNumber(stats.ignored_files)}
                </p>
                <p className="truncate text-[9px] text-neutral-500">{formatBytes(stats.ignored_bytes)}</p>
              </div>
              <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-600">Total seen</p>
                <p className="mt-1 truncate text-sm font-semibold text-neutral-300 tabular">
                  {formatNumber(stats.total_files)}
                </p>
                <p className="truncate text-[9px] text-neutral-500">non-.git files</p>
              </div>
              <div className="min-w-0 rounded-xl border border-primary/15 bg-primary/[0.05] px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-primary/70">Rules</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Badge variant={stats.gitignore_present ? "success" : "warning"} className="py-0 text-[9px]">
                    {stats.gitignore_present ? ".gitignore" : "no .gitignore"}
                  </Badge>
                  {stats.ryzignore_present ? (
                    <Badge variant="secondary" className="py-0 text-[9px]">
                      .ryzignore
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>

            <Tabs defaultValue="ignored" className="min-w-0">
              <TabsList className="max-w-full overflow-x-auto">
                <TabsTrigger value="ignored" className="gap-1.5">
                  <FileX2 className="h-3 w-3" />
                  Ignored ({formatNumber(stats.ignored_files)})
                </TabsTrigger>
                <TabsTrigger value="included" className="gap-1.5">
                  <Files className="h-3 w-3" />
                  Included ({formatNumber(stats.included_files)})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ignored">
                <div className="min-w-0 max-h-[280px] overflow-y-auto overflow-x-hidden rounded-xl border border-white/[0.06] bg-black/40 p-2">
                  {preview.ignored_samples.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <Check className="h-5 w-5 text-primary" />
                      <p className="text-xs text-neutral-400">Nothing is being ignored.</p>
                      <p className="text-[10px] text-neutral-600">
                        Every file in this folder would be archived.
                      </p>
                    </div>
                  ) : (
                    preview.ignored_samples.map((item: IgnoredSample, index: number) => (
                      <div
                        key={`${item.path}-${index}`}
                        className="flex min-w-0 items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]"
                      >
                        <span
                          className="path-text min-w-0 flex-1 truncate text-neutral-400"
                          title={item.path}
                        >
                          {item.path}
                        </span>
                        {item.pattern ? (
                          <span
                            className="path-text max-w-[38%] shrink-0 truncate text-neutral-600"
                            title={item.pattern}
                          >
                            {item.pattern}
                          </span>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
                {stats.ignored_files > preview.ignored_samples.length ? (
                  <p className="mt-2 text-[10px] text-neutral-600">
                    Showing the first {formatNumber(preview.ignored_samples.length)} ignored entries.
                  </p>
                ) : null}
              </TabsContent>

              <TabsContent value="included">
                <div className="min-w-0 max-h-[280px] overflow-y-auto overflow-x-hidden rounded-xl border border-white/[0.06] bg-black/40 p-2">
                  {preview.included_samples.map((path, index) => (
                    <div
                      key={`${path}-${index}`}
                      className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]"
                    >
                      <span className="h-1 w-1 shrink-0 rounded-full bg-primary/50" />
                      <span className="path-text min-w-0 flex-1 truncate text-neutral-400" title={path}>
                        {path}
                      </span>
                    </div>
                  ))}
                </div>
                {stats.included_files > preview.included_samples.length ? (
                  <p className="mt-2 text-[10px] text-neutral-600">
                    Showing the first {formatNumber(preview.included_samples.length)} included entries.
                  </p>
                ) : null}
              </TabsContent>
            </Tabs>

            {preview.warnings.length > 0 ? (
              <div className="min-w-0 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-300">
                  <AlertTriangle className="h-3 w-3" />
                  {preview.warnings.length} warning{preview.warnings.length === 1 ? "" : "s"} while scanning
                </p>
                <p className="mt-1 line-clamp-2 break-words text-[10px] text-amber-200/60">
                  {preview.warnings.slice(0, 3).join(" · ")}
                </p>
              </div>
            ) : null}

            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-3">
              <p className="flex min-w-0 items-center gap-1.5 text-[10px] text-neutral-600">
                <ShieldCheck className="h-3 w-3 shrink-0 text-primary/50" />
                <span className="truncate">.git + temporary archives are always excluded.</span>
              </p>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" onClick={() => project && load(project.id)}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Rescan
                </Button>
                <Button size="sm" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
