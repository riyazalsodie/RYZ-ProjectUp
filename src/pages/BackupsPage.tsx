import React, { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  Cloud,
  CloudOff,
  ExternalLink,
  History,
  HardDriveDownload,
  Search,
  Trash2,
  X,
  Package,
  FileArchive,
} from "lucide-react";
import { BackupRecord, DriveStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBytes, formatDateTime, formatNumber, formatRelative } from "@/utils/format";

interface BackupsPageProps {
  backups: BackupRecord[];
  drive: DriveStatus;
  onRestore: (record: BackupRecord) => void;
  onDelete: (record: BackupRecord) => void;
  onOpenDrive: (url: string) => void;
  onConnectDrive: () => void;
}

export const BackupsPage: React.FC<BackupsPageProps> = ({
  backups,
  drive,
  onRestore,
  onDelete,
  onOpenDrive,
  onConnectDrive,
}) => {
  const [search, setSearch] = useState("");

  const sorted = useMemo(
    () => [...backups].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [backups]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (b) =>
        b.project_name.toLowerCase().includes(q) ||
        b.file_name.toLowerCase().includes(q) ||
        formatDateTime(b.created_at).toLowerCase().includes(q)
    );
  }, [sorted, search]);

  const totalBytes = sorted.reduce((sum, b) => sum + b.size_bytes, 0);
  const totalFiles = sorted.reduce((sum, b) => sum + b.file_count, 0);

  return (
    <div className="relative flex-1 overflow-y-auto">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 overflow-hidden">
        <div className="aura left-[18%] top-[-150px] h-[280px] w-[420px] bg-primary/[0.07]" />
        <div className="ambient-grid absolute inset-0 opacity-40" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 pb-10 pt-6 sm:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-primary/70">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_#00ff88]" />
              Cloud snapshot archive
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Backup history</h1>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-neutral-500">
              Every upload is a standalone zip snapshot. Restore any version to a folder on this PC, or jump
              straight to the file in Google Drive.
            </p>
          </div>
          <div className="flex gap-2">
            {drive.connected ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (drive.folder_id) {
                    onOpenDrive(`https://drive.google.com/drive/folders/${drive.folder_id}`);
                  } else if (sorted[0]?.web_view_link) {
                    onOpenDrive(sorted[0].web_view_link);
                  }
                }}
                className="gap-1.5"
              >
                <Cloud className="h-3.5 w-3.5 text-primary" />
                Open Drive folder
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={onConnectDrive} className="gap-1.5">
                <CloudOff className="h-3.5 w-3.5" />
                Connect Drive
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.1] to-[#020403] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-500">Snapshots</span>
              <Package className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-xl font-semibold text-white tabular">{formatNumber(sorted.length)}</p>
            <p className="mt-0.5 text-[10px] text-neutral-500">Across all projects</p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-[#030604] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-500">Cloud size</span>
              <HardDriveDownload className="h-4 w-4 text-neutral-500" />
            </div>
            <p className="mt-2 text-xl font-semibold text-white tabular">{formatBytes(totalBytes)}</p>
            <p className="mt-0.5 text-[10px] text-neutral-500">Compressed zip archives</p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-[#030604] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-500">Files archived</span>
              <FileArchive className="h-4 w-4 text-neutral-500" />
            </div>
            <p className="mt-2 text-xl font-semibold text-white tabular">{formatNumber(totalFiles)}</p>
            <p className="mt-0.5 text-[10px] text-neutral-500">Cumulative across snapshots</p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by project, file or date..."
              className="h-9 pl-9 pr-8"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-600 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <Badge variant="secondary" className="shrink-0">
            {filtered.length} shown
          </Badge>
        </div>

        <div className="mt-3 space-y-2">
          {sorted.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/[0.1] bg-[#020403] px-6 py-14 text-center">
              <History className="mx-auto h-9 w-9 text-neutral-700" strokeWidth={1.5} />
              <h3 className="mt-4 text-sm font-semibold text-white">No backups yet</h3>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-neutral-500">
                Run your first backup from the Projects page. Each upload appears here with restore and Drive
                shortcuts.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#020403] px-6 py-10 text-center text-xs text-neutral-500">
              No snapshots match “{search}”.
            </div>
          ) : (
            filtered.map((record) => (
              <div
                key={record.id}
                className="group flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-[#030604] px-4 py-3.5 transition-all duration-200 hover:border-primary/20 hover:bg-[#040806] sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.07] text-primary">
                    <FileArchive className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-xs font-semibold text-white">{record.project_name}</p>
                      <Badge variant="secondary" className="gap-1 py-0 text-[9px]">
                        <span className="h-1 w-1 rounded-full bg-primary/70" />
                        {formatRelative(record.created_at)}
                      </Badge>
                    </div>
                    <p className="path-text mt-1 truncate text-neutral-600">{record.file_name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[10px] text-neutral-500">
                      <span>{formatDateTime(record.created_at)}</span>
                      <span>{formatBytes(record.size_bytes)}</span>
                      <span>{formatNumber(record.file_count)} files</span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRestore(record)}
                    disabled={!drive.connected}
                    className="gap-1.5"
                    title="Download and extract this snapshot"
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    Restore
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    onClick={() =>
                      record.web_view_link &&
                      onOpenDrive(record.web_view_link)
                    }
                    disabled={!record.web_view_link}
                    title="Open in Google Drive"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDelete(record)}
                    title="Delete this backup"
                    className="hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
