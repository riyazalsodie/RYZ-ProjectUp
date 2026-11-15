import React from "react";
import {
  FolderGit2,
  History,
  Settings2,
  HardDrive,
  Cloud,
  ShieldCheck,
  ArrowUpRight,
  CircleDashed,
} from "lucide-react";
import { ViewMode, DriveStatus } from "@/types";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/utils/format";

interface SidebarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  projectCount: number;
  backupCount: number;
  totalBackedUpBytes: number;
  drive: DriveStatus;
  version: string;
  onConnectDrive: () => void;
  onOpenDriveFolder: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  projectCount,
  backupCount,
  totalBackedUpBytes,
  drive,
  version,
  onConnectDrive,
  onOpenDriveFolder,
}) => {
  const navItems = [
    {
      id: "projects" as ViewMode,
      label: "Projects",
      icon: FolderGit2,
      count: projectCount,
    },
    {
      id: "backups" as ViewMode,
      label: "Backup History",
      icon: History,
      count: backupCount,
    },
    {
      id: "settings" as ViewMode,
      label: "Settings",
      icon: Settings2,
    },
  ];

  const activeIndex = Math.max(0, navItems.findIndex((i) => i.id === currentView));

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col justify-between border-r border-white/[0.05] bg-black p-4 md:flex">
      <div className="space-y-5">
        <div className="flex items-center gap-3 px-2 py-1">
          <img
            src="/logo.svg"
            alt="RYZ ProjectUp"
            className="h-9 w-9 object-contain drop-shadow-[0_0_14px_rgba(0,255,136,0.4)]"
            draggable={false}
          />
          <div className="min-w-0">
            <h1 className="font-brand truncate text-[13px] text-white">RYZ PROJECTUP</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-primary/70">
              <span className="h-1 w-1 rounded-full bg-primary" />
              Project backups
            </p>
          </div>
        </div>

        <nav className="relative flex flex-col rounded-2xl border border-white/[0.06] bg-[#030604] p-1">
          <div
            className="pointer-events-none absolute left-1 right-1 rounded-xl border border-primary/30 bg-primary/[0.13] shadow-[0_0_20px_-6px_rgba(0,255,136,0.45)] transition-all duration-300 ease-out"
            style={{ height: "42px", top: `calc(${activeIndex} * 46px + 4px)` }}
          />
          {navItems.map((item) => {
            const active = currentView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className="relative z-10 my-[2px] flex h-[42px] w-full items-center justify-between rounded-xl px-3 text-left"
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-colors",
                      active ? "text-primary" : "text-neutral-600"
                    )}
                    strokeWidth={2}
                  />
                  <span
                    className={cn(
                      "text-xs transition-all",
                      active ? "font-semibold text-white" : "font-medium text-neutral-400 hover:text-neutral-200"
                    )}
                  >
                    {item.label}
                  </span>
                </span>
                {item.count !== undefined ? (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular",
                      active
                        ? "border border-primary/30 bg-primary/15 text-primary"
                        : "bg-white/[0.05] text-neutral-500"
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="mx-1 space-y-3 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[#050a07] to-[#020503] p-3.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-500">
              <HardDrive className="h-3 w-3" />
              Backup vault
            </span>
            <ShieldCheck className="h-3.5 w-3.5 text-primary/70" />
          </div>

          <div>
            <p className="text-lg font-semibold tracking-tight text-white tabular">
              {formatBytes(totalBackedUpBytes)}
            </p>
            <p className="text-[10px] text-neutral-500">
              {backupCount} {backupCount === 1 ? "snapshot" : "snapshots"} in Drive
            </p>
          </div>

          <div className="h-px bg-white/[0.06]" />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-neutral-400">
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    drive.connected ? "bg-primary shadow-[0_0_8px_#00ff88]" : "bg-neutral-600"
                  )}
                />
                <span className="truncate">
                  {drive.connected ? drive.email || "Google Drive" : "Drive not connected"}
                </span>
              </span>
              {drive.connected ? (
                <button
                  type="button"
                  onClick={onOpenDriveFolder}
                  title="Open backup folder in Google Drive"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-500 transition hover:bg-white/[0.06] hover:text-primary"
                >
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              ) : null}
            </div>

            {drive.connected ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-primary/15 bg-primary/[0.06] px-2 py-1.5">
                <Cloud className="h-3 w-3 text-primary" />
                <span className="truncate text-[9px] font-medium text-primary/80">
                  {drive.folder_name}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onConnectDrive}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-1.5 text-[10px] font-bold text-black transition hover:bg-[#00e676]"
              >
                <CircleDashed className="h-3 w-3" />
                Connect Google Drive
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-2">
        <div className="flex items-center justify-between text-[9px] font-medium text-neutral-600">
          <span>v{version}</span>
          <span className="flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-primary/60" />
            Local-first
          </span>
        </div>
      </div>
    </aside>
  );
};
