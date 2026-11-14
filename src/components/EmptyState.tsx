import React from "react";
import { FolderDown, Github, Lock, Sparkles } from "lucide-react";
import { Button } from "./ui/button";

interface EmptyStateProps {
  onAddProject: () => void;
  loading?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onAddProject, loading }) => {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-dashed border-white/[0.1] bg-[#020403] px-6 py-10 text-center">
      <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="relative mx-auto flex max-w-md flex-col items-center">
        <div className="relative mb-5 flex h-20 w-20 animate-float items-center justify-center rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.16] to-transparent shadow-[0_0_50px_-16px_rgba(0,255,136,0.5)]">
          <FolderDown className="h-9 w-9 text-primary" strokeWidth={1.6} />
          <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-[#041007]">
            <Sparkles className="h-3 w-3 text-primary" />
          </span>
        </div>

        <h3 className="text-base font-semibold tracking-tight text-white">No projects in your vault yet</h3>
        <p className="mt-2 max-w-sm text-xs leading-relaxed text-neutral-500">
          Pick a project folder. ProjectUp reads its <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[10px] text-primary/80">.gitignore</code>{" "}
          automatically, zips only the files that matter, and uploads the snapshot to your Google Drive.
        </p>

        <Button onClick={onAddProject} loading={loading} size="lg" className="mt-5 gap-2 px-5">
          <FolderDown className="h-4 w-4" />
          Select project folder
        </Button>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] text-neutral-600">
          <span className="flex items-center gap-1.5">
            <Github className="h-3 w-3" /> Respects .gitignore
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="h-3 w-3" /> Direct to your Drive
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> No RYZ servers
          </span>
        </div>
      </div>
    </div>
  );
};
