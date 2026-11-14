import React, { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { Toaster, toast } from "sonner";
import { AlertTriangle, FolderGit2, RefreshCw } from "lucide-react";
import {
  AppSnapshot,
  BackupJobState,
  BackupProgress,
  BackupRecord,
  DriveStatus,
  Project,
  RestoreJobState,
  RestoreProgress,
  RestoreResult,
  SettingsInput,
  ViewMode,
} from "./types";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/utils/format";
import { useWindowControls } from "@/hooks/useWindowControls";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { ProjectsPage } from "./pages/ProjectsPage";
import { BackupsPage } from "./pages/BackupsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { IgnorePreviewDialog } from "./components/IgnorePreviewDialog";
import { BackupProgressDialog } from "./components/BackupProgressDialog";
import { RestoreProgressDialog } from "./components/RestoreProgressDialog";
import { DriveConnectDialog } from "./components/DriveConnectDialog";
import { DeleteBackupDialog } from "./components/DeleteBackupDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { Button } from "./components/ui/button";

const initialProgress = (jobId: string): BackupProgress => ({
  job_id: jobId,
  phase: "scanning",
  percent: 0,
  message: "Preparing snapshot…",
  current: 0,
  total: 0,
  bytes_done: 0,
  bytes_total: 0,
});

const App: React.FC = () => {
  const { isMaximized, minimize, toggleMaximize, close } = useWindowControls();

  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("projects");
  const [search, setSearch] = useState("");
  const startupCloudSync = useRef(false);

  const [adding, setAdding] = useState(false);
  const [previewProject, setPreviewProject] = useState<Project | null>(null);
  const [removeProjectTarget, setRemoveProjectTarget] = useState<Project | null>(null);
  const [removing, setRemoving] = useState(false);

  const [backupJob, setBackupJob] = useState<BackupJobState | null>(null);
  const [restoreJob, setRestoreJob] = useState<RestoreJobState | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<BackupRecord | null>(null);

  const [driveDialogOpen, setDriveDialogOpen] = useState(false);
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await invoke<AppSnapshot>("get_app_state");
    setSnapshot(next);
    setLoadError(null);
    return next;
  }, []);

  const safeRefresh = useCallback(async () => {
    try {
      return await refresh();
    } catch (err) {
      console.error("Could not refresh app state", err);
      return undefined;
    }
  }, [refresh]);

  const syncCloudVault = useCallback(async () => {
    const next = await invoke<AppSnapshot>("sync_cloud_metadata");
    setSnapshot(next);
    return next;
  }, []);

  // On app launch with a saved Drive session, pull any projects/history that
  // were added from another PC. Runs once per launch.
  useEffect(() => {
    if (loading || !snapshot?.drive.connected || startupCloudSync.current) return;
    startupCloudSync.current = true;
    const beforeProjects = snapshot.projects.length;
    const beforeBackups = snapshot.backups.length;
    const timer = window.setTimeout(() => {
      syncCloudVault()
        .then((next) => {
          if (next.projects.length > beforeProjects || next.backups.length > beforeBackups) {
            toast.success("Vault restored from Google Drive", {
              description: `${next.projects.length} projects · ${next.backups.length} snapshots`,
            });
          }
        })
        .catch((err) => console.error("Cloud vault sync failed", err));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [loading, snapshot?.drive.connected, syncCloudVault]);

  useEffect(() => {
    refresh()
      .catch((err) => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    document.documentElement.classList.toggle("window-maximized", isMaximized);
  }, [isMaximized]);

  useEffect(() => {
    let disposed = false;
    let unlistenBackup: UnlistenFn | undefined;
    let unlistenRestore: UnlistenFn | undefined;

    const setup = async () => {
      const backupUnlisten = await listen<BackupProgress>("backup-progress", (event) => {
        setBackupJob((prev) =>
          prev && prev.jobId === event.payload.job_id ? { ...prev, progress: event.payload } : prev
        );
      });
      if (disposed) backupUnlisten();
      else unlistenBackup = backupUnlisten;

      const restoreUnlisten = await listen<RestoreProgress>("restore-progress", (event) => {
        setRestoreJob((prev) =>
          prev && prev.jobId === event.payload.job_id ? { ...prev, progress: event.payload } : prev
        );
      });
      if (disposed) restoreUnlisten();
      else unlistenRestore = restoreUnlisten;
    };

    setup().catch((err) => console.error("Failed to register progress listeners", err));

    return () => {
      disposed = true;
      unlistenBackup?.();
      unlistenRestore?.();
    };
  }, []);

  const handleAddProject = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select a project folder",
      });
      if (!selected || Array.isArray(selected)) return;

      setAdding(true);
      const project = await invoke<Project>("add_project", { path: selected });
      await safeRefresh();
      toast.success("Project added", {
        description: `${project.name} · ${project.stats?.included_files ?? 0} files tracked`,
      });
    } catch (err) {
      toast.error("Could not add project", { description: errorMessage(err) });
    } finally {
      setAdding(false);
    }
  };

  const handleRefreshStats = async (project: Project) => {
    try {
      await invoke("refresh_project", { projectId: project.id });
      await safeRefresh();
      toast.success("Project re-scanned", { description: project.name });
    } catch (err) {
      toast.error("Scan failed", { description: errorMessage(err) });
    }
  };

  const handleRelinkProject = async (project: Project) => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: `Select the folder for ${project.name}`,
      });
      if (!selected || Array.isArray(selected)) return;

      await invoke("relink_project", { projectId: project.id, path: selected });
      await safeRefresh();
      toast.success("Project relinked", {
        description: "Snapshots and history were kept — you can back up again.",
      });
    } catch (err) {
      toast.error("Could not relink project", { description: errorMessage(err) });
    }
  };

  const handleSyncCloud = async () => {
    const next = await syncCloudVault();
    toast.success("Vault synced from Google Drive", {
      description: `${next.projects.length} projects · ${next.backups.length} snapshots`,
    });
  };

  const handleReveal = async (path: string) => {
    if (!path) return;
    try {
      await invoke("reveal_path", { path });
    } catch (err) {
      toast.error("Could not open folder", { description: errorMessage(err) });
    }
  };

  const handleOpenUrl = async (url: string) => {
    if (!url) return;
    try {
      await invoke("open_url", { url });
    } catch (err) {
      toast.error("Could not open link", { description: errorMessage(err) });
    }
  };

  const handleStartBackup = async (project: Project) => {
    if (!snapshot?.drive.connected) {
      toast.error("Connect Google Drive first", {
        description: "ProjectUp needs an authorized Drive account to upload snapshots.",
      });
      setDriveDialogOpen(true);
      return;
    }
    if (backupJob?.status === "running") return;

    const jobId = crypto.randomUUID();
    setBackupJob({
      jobId,
      project,
      status: "running",
      progress: initialProgress(jobId),
    });

    try {
      const record = await invoke<BackupRecord>("run_backup", {
        projectId: project.id,
        jobId,
      });
      setBackupJob((prev) =>
        prev && prev.jobId === jobId
          ? {
              ...prev,
              status: "success",
              record,
              progress: {
                ...prev.progress,
                phase: "done",
                percent: 100,
                message: "Snapshot uploaded",
              },
            }
          : prev
      );
      await safeRefresh();
      toast.success("Backup uploaded to Drive", { description: record.file_name });
    } catch (err) {
      const message = errorMessage(err);
      const cancelled = /cancel/i.test(message);
      setBackupJob((prev) =>
        prev && prev.jobId === jobId
          ? {
              ...prev,
              status: cancelled ? "cancelled" : "error",
              error: cancelled ? undefined : message,
            }
          : prev
      );
      if (!cancelled) {
        toast.error("Backup failed", { description: message });
      }
    }
  };

  const handleCancelBackup = async () => {
    try {
      await invoke("cancel_backup");
      toast.info("Cancelling backup…");
    } catch (err) {
      toast.error("Could not cancel", { description: errorMessage(err) });
    }
  };

  const handleBackupRetry = () => {
    const project = backupJob?.project;
    setBackupJob(null);
    if (project) setTimeout(() => handleStartBackup(project), 120);
  };

  const handleRestore = async (record: BackupRecord) => {
    try {
      if (!snapshot?.drive.connected) {
        toast.error("Connect Google Drive first");
        setDriveDialogOpen(true);
        return;
      }
      if (restoreJob?.status === "running") return;

      const destination = await open({
        directory: true,
        multiple: false,
        title: "Choose where to restore this snapshot",
      });
      if (!destination || Array.isArray(destination)) return;

      const jobId = crypto.randomUUID();
      setRestoreJob({
        jobId,
        record,
        status: "running",
        progress: {
          job_id: jobId,
          phase: "downloading",
          percent: 0,
          message: "Connecting to Google Drive…",
        },
      });

      const result = await invoke<RestoreResult>("restore_backup", {
        backupId: record.id,
        destination,
        jobId,
      });

      setRestoreJob((prev) =>
        prev && prev.jobId === jobId
          ? {
              ...prev,
              status: "success",
              result,
              progress: { ...prev.progress, phase: "done", percent: 100, message: "Restore complete" },
            }
          : prev
      );
      await safeRefresh();
      toast.success("Snapshot restored", { description: result.destination });
    } catch (err) {
      const message = errorMessage(err);
      setRestoreJob((prev) =>
        prev ? { ...prev, status: "error", error: message } : prev
      );
      toast.error("Restore failed", { description: message });
    }
  };

  const handleDeleteBackup = async (deleteFromDrive: boolean) => {
    if (!deleteRecord) return;
    await invoke("delete_backup", {
      backupId: deleteRecord.id,
      deleteFromDrive,
    });
    setDeleteRecord(null);
    await safeRefresh();
    toast.success("Snapshot deleted", {
      description: deleteFromDrive ? "Removed from local history and Google Drive" : "Removed from local history",
    });
  };

  const handleSaveSettings = async (input: SettingsInput) => {
    const next = await invoke<AppSnapshot>("save_settings", { input });
    setSnapshot(next);
  };

  const handleDisconnectDrive = async () => {
    await invoke("drive_disconnect");
    await safeRefresh();
  };

  const handleDriveStart = async (clientId: string, clientSecret: string) => {
    if (!snapshot) return;
    const beforeProjects = snapshot.projects.length;
    const beforeBackups = snapshot.backups.length;
    setDriveConnecting(true);
    setDriveError(null);
    try {
      const s = snapshot.settings;
      if (clientId !== s.client_id || clientSecret) {
        const next = await invoke<AppSnapshot>("save_settings", {
          input: {
            folder_name: s.folder_name,
            retention: s.retention,
            compression_level: s.compression_level,
            respect_gitignore: s.respect_gitignore,
            extra_ignore_patterns: s.extra_ignore_patterns,
            client_id: clientId,
            client_secret: clientSecret || null,
          },
        });
        // Keep the UI in sync even if the consent flow is later cancelled.
        setSnapshot(next);
      }

      const status = await invoke<DriveStatus>("drive_connect");
      const next = await safeRefresh();
      setDriveConnecting(false);
      setDriveError(null);
      setDriveDialogOpen(false);

      const restored =
        next && (next.projects.length > beforeProjects || next.backups.length > beforeBackups)
          ? ` · ${next.projects.length} projects restored`
          : "";
      toast.success("Google Drive connected", {
        description: `${status.email || status.folder_name}${restored}`,
      });
    } catch (err) {
      setDriveConnecting(false);
      setDriveError(errorMessage(err));
    }
  };

  const handleDriveCancel = async () => {
    try {
      await invoke("cancel_drive_auth");
    } catch {
      /* noop */
    }
    setDriveConnecting(false);
    setDriveError("Connection cancelled.");
  };

  const handleRemoveProject = async () => {
    if (!removeProjectTarget) return;
    setRemoving(true);
    try {
      await invoke("remove_project", { projectId: removeProjectTarget.id });
      setRemoveProjectTarget(null);
      await safeRefresh();
      toast.success("Project removed from vault");
    } catch (err) {
      toast.error("Could not remove project", { description: errorMessage(err) });
    } finally {
      setRemoving(false);
    }
  };

  const handleOpenDriveFolder = () => {
    if (snapshot?.drive.folder_id) {
      handleOpenUrl(`https://drive.google.com/drive/folders/${snapshot.drive.folder_id}`);
    } else if (snapshot?.drive.connected) {
      handleOpenUrl("https://drive.google.com/drive/my-drive");
    } else {
      toast.info("Connect Google Drive to open the backup folder");
      setDriveDialogOpen(true);
    }
  };

  const statusLabel = backupJob?.status === "running"
    ? `Backing up ${backupJob.project.name}`
    : restoreJob?.status === "running"
      ? "Restoring snapshot"
      : null;

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 rounded-2xl border border-primary/20" />
            <img src="/logo.svg" alt="" className="h-10 w-10 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            <span className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
            Opening vault
          </div>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black p-8">
        <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-[#060303] p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-sm font-semibold text-white">Could not open the vault</h1>
          <p className="mt-2 break-words text-[11px] leading-relaxed text-neutral-500">
            {loadError || "The Tauri backend did not respond."}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setLoading(true);
                refresh()
                  .catch((err) => setLoadError(errorMessage(err)))
                  .finally(() => setLoading(false));
              }}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
            <Button onClick={close} className="gap-1.5">
              Close app
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const totalBackedUp = snapshot.backups.reduce((sum, b) => sum + b.size_bytes, 0);

  return (
    <div className="m-0 h-screen w-screen select-none overflow-hidden bg-transparent p-0">
      <div
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden bg-black",
          isMaximized
            ? "rounded-none border-0"
            : "rounded-2xl border border-primary/15 shadow-[0_0_60px_rgba(0,255,136,0.07)]"
        )}
      >
        <TitleBar
          isMaximized={isMaximized}
          onMinimize={minimize}
          onToggleMaximize={toggleMaximize}
          onClose={close}
          statusLabel={statusLabel}
        />

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <Sidebar
            currentView={view}
            onSelectView={setView}
            projectCount={snapshot.projects.length}
            backupCount={snapshot.backups.length}
            totalBackedUpBytes={totalBackedUp}
            drive={snapshot.drive}
            version={snapshot.version}
            onConnectDrive={() => {
              setDriveError(null);
              setDriveDialogOpen(true);
            }}
            onOpenDriveFolder={handleOpenDriveFolder}
          />

          <div className="relative flex min-w-0 flex-1 flex-col">
            {view === "projects" ? (
              <ProjectsPage
                snapshot={snapshot}
                loading={false}
                adding={adding}
                search={search}
                onSearch={setSearch}
                onAddProject={handleAddProject}
                onBackup={handleStartBackup}
                onPreview={(project) => setPreviewProject(project)}
                onReveal={handleReveal}
                onRelink={handleRelinkProject}
                onRemove={setRemoveProjectTarget}
                onRefreshStats={handleRefreshStats}
                onConnectDrive={() => {
                  setDriveError(null);
                  setDriveDialogOpen(true);
                }}
                onOpenDriveFolder={handleOpenDriveFolder}
              />
            ) : view === "backups" ? (
              <BackupsPage
                backups={snapshot.backups}
                drive={snapshot.drive}
                onRestore={handleRestore}
                onDelete={setDeleteRecord}
                onOpenDrive={handleOpenUrl}
                onConnectDrive={() => {
                  setDriveError(null);
                  setDriveDialogOpen(true);
                }}
              />
            ) : (
              <SettingsPage
                snapshot={snapshot}
                onSave={handleSaveSettings}
                onConnectDrive={() => {
                  setDriveError(null);
                  setDriveDialogOpen(true);
                }}
                onDisconnectDrive={handleDisconnectDrive}
                onSyncCloud={handleSyncCloud}
                onOpenUrl={handleOpenUrl}
                onReveal={handleReveal}
              />
            )}
          </div>
        </div>

        {adding ? (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="flex w-72 flex-col items-center rounded-2xl border border-primary/20 bg-[#030604] p-6 text-center shadow-[0_0_60px_-20px_rgba(0,255,136,0.4)]">
              <div className="relative flex h-14 w-14 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-2xl border border-primary/20" />
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                  <FolderGit2 className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold text-white">Indexing project</p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-neutral-500">
                Reading .gitignore rules and measuring the files to archive…
              </p>
            </div>
          </div>
        ) : null}

        <IgnorePreviewDialog
          project={previewProject}
          open={!!previewProject}
          onOpenChange={(value) => {
            if (!value) setPreviewProject(null);
          }}
        />

        <BackupProgressDialog
          job={backupJob}
          onClose={() => setBackupJob(null)}
          onCancel={handleCancelBackup}
          onRetry={handleBackupRetry}
          onOpenDrive={handleOpenUrl}
        />

        <RestoreProgressDialog job={restoreJob} onClose={() => setRestoreJob(null)} onReveal={handleReveal} />

        <DriveConnectDialog
          open={driveDialogOpen}
          onOpenChange={(value) => {
            setDriveDialogOpen(value);
            if (!value) {
              setDriveError(null);
              setDriveConnecting(false);
            }
          }}
          drive={snapshot.drive}
          settings={snapshot.settings}
          connecting={driveConnecting}
          error={driveError}
          onStart={handleDriveStart}
          onCancel={handleDriveCancel}
          onOpenUrl={handleOpenUrl}
        />

        <DeleteBackupDialog
          record={deleteRecord}
          driveConnected={snapshot.drive.connected}
          onOpenChange={(value) => {
            if (!value) setDeleteRecord(null);
          }}
          onConfirm={handleDeleteBackup}
        />

        <ConfirmDialog
          open={!!removeProjectTarget}
          onOpenChange={(value) => {
            if (!value) setRemoveProjectTarget(null);
          }}
          title="Remove project from vault?"
          description={
            removeProjectTarget
              ? `${removeProjectTarget.name} will stop appearing in ProjectUp. Your files and Google Drive backups are not touched.`
              : ""
          }
          confirmLabel="Remove project"
          destructive
          loading={removing}
          onConfirm={handleRemoveProject}
          icon={FolderGit2}
        />

        <Toaster
          theme="dark"
          richColors
          position="bottom-right"
          offset={18}
          gap={10}
          closeButton
          toastOptions={{
            style: {
              background: "#040705",
              border: "1px solid rgba(0,255,136,0.16)",
              color: "#f3f6f4",
              borderRadius: "14px",
              fontSize: "12px",
            },
          }}
        />
      </div>
    </div>
  );
};

export default App;
