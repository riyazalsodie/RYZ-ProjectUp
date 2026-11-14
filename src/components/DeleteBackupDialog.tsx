import React, { useEffect, useState } from "react";
import { CloudOff, Trash2 } from "lucide-react";
import { BackupRecord } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatBytes, formatDateTime } from "@/utils/format";
import { cn } from "@/lib/utils";

interface DeleteBackupDialogProps {
  record: BackupRecord | null;
  driveConnected: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (deleteFromDrive: boolean) => Promise<void>;
}

export const DeleteBackupDialog: React.FC<DeleteBackupDialogProps> = ({
  record,
  driveConnected,
  onOpenChange,
  onConfirm,
}) => {
  const [deleteFromDrive, setDeleteFromDrive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (record) {
      setDeleteFromDrive(driveConnected);
      setError(null);
      setLoading(false);
    }
  }, [record, driveConnected]);

  if (!record) return null;

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(deleteFromDrive && driveConnected);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!record} onOpenChange={(value) => (!loading ? onOpenChange(value) : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10 text-red-400">
              <Trash2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Delete snapshot?</DialogTitle>
              <DialogDescription className="truncate">
                {record.project_name} · {formatDateTime(record.created_at)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
          <p className="path-text truncate text-neutral-400" title={record.file_name}>
            {record.file_name}
          </p>
          <p className="mt-1 text-[10px] text-neutral-600">
            {formatBytes(record.size_bytes)} · {record.file_count} files
          </p>
        </div>

        {driveConnected ? (
          <div
            className={cn(
              "flex items-center justify-between gap-4 rounded-xl border px-3.5 py-3 transition-colors",
              deleteFromDrive
                ? "border-red-500/20 bg-red-500/[0.05]"
                : "border-white/[0.06] bg-white/[0.015]"
            )}
          >
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-200">
                <CloudOff className="h-3.5 w-3.5 text-red-400" />
                Delete the file from Google Drive too
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">
                {deleteFromDrive
                  ? "The zip archive is removed from your Drive permanently."
                  : "Only the local history entry is removed — the Drive file stays."}
              </p>
            </div>
            <Switch checked={deleteFromDrive} onCheckedChange={setDeleteFromDrive} />
          </div>
        ) : (
          <p className="text-[10px] leading-relaxed text-neutral-500">
            Drive is disconnected, so only the local history entry will be removed. Reconnect Drive to delete
            the cloud file.
          </p>
        )}

        {error ? (
          <p className="break-words rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[10px] text-red-300">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={handleConfirm} loading={loading} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" />
            Delete snapshot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
