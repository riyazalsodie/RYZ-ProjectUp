import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Cloud,
  Copy,
  Database,
  ExternalLink,
  FolderCog,
  FolderOpen,
  KeyRound,
  Keyboard,
  Link2Off,
  Lock,
  Minimize2,
  Power,
  RefreshCw,
  Rocket,
  Save,
  ShieldCheck,
  Sparkles,
  Terminal,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { AppSnapshot, SettingsInput } from "@/types";
import { isTauriRuntime } from "@/hooks/useWindowControls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes, formatNumber, truncateMiddle } from "@/utils/format";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { OAuthSetupGuide } from "@/components/OAuthSetupGuide";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SettingsPageProps {
  snapshot: AppSnapshot;
  onSave: (input: SettingsInput) => Promise<void>;
  onConnectDrive: () => void;
  onDisconnectDrive: () => Promise<void>;
  onSyncCloud: () => Promise<void>;
  onOpenUrl: (url: string) => void;
  onReveal: (path: string) => void;
  onQuit: () => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  snapshot,
  onSave,
  onConnectDrive,
  onDisconnectDrive,
  onSyncCloud,
  onOpenUrl,
  onReveal,
  onQuit,
}) => {
  const { settings, drive, data_dir } = snapshot;

  const [folderName, setFolderName] = useState(settings.folder_name);
  const [retention, setRetention] = useState(settings.retention);
  const [compression, setCompression] = useState(settings.compression_level);
  const [respectGitignore, setRespectGitignore] = useState(settings.respect_gitignore);
  const [extraPatterns, setExtraPatterns] = useState(settings.extra_ignore_patterns.join("\n"));
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(settings.auto_backup_enabled);
  const [autoBackupInterval, setAutoBackupInterval] = useState(
    settings.auto_backup_interval_hours
  );
  const [minimizeToTray, setMinimizeToTray] = useState(settings.minimize_to_tray);
  const [closeToTray, setCloseToTray] = useState(settings.close_to_tray);
  const [hotkeyEnabled, setHotkeyEnabled] = useState(settings.global_hotkey_enabled);

  const [clientId, setClientId] = useState(settings.client_id);
  const [clientSecret, setClientSecret] = useState("");
  const [showOauth, setShowOauth] = useState(!settings.has_client_secret || !settings.client_id);

  const [savingRules, setSavingRules] = useState(false);
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [savingOauth, setSavingOauth] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartBusy, setAutostartBusy] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const settingsKey = JSON.stringify(settings);

  useEffect(() => {
    setFolderName(settings.folder_name);
    setRetention(settings.retention);
    setCompression(settings.compression_level);
    setRespectGitignore(settings.respect_gitignore);
    setExtraPatterns(settings.extra_ignore_patterns.join("\n"));
    setAutoBackupEnabled(settings.auto_backup_enabled);
    setAutoBackupInterval(settings.auto_backup_interval_hours);
    setMinimizeToTray(settings.minimize_to_tray);
    setCloseToTray(settings.close_to_tray);
    setHotkeyEnabled(settings.global_hotkey_enabled);
    setClientId(settings.client_id);
    // Do not discard unsaved edits when a background backup refreshes the
    // snapshot but the persisted settings are unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsKey]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let active = true;
    invoke<boolean>("get_autostart")
      .then((value) => {
        if (active) setAutostartEnabled(value);
      })
      .catch((err) => console.error("Could not read startup setting", err));
    return () => {
      active = false;
    };
  }, []);

  const buildInput = (overrides: Partial<SettingsInput> = {}): SettingsInput => ({
    folder_name: folderName.trim() || "RYZ ProjectUp",
    retention,
    compression_level: compression,
    respect_gitignore: respectGitignore,
    extra_ignore_patterns: extraPatterns
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    auto_backup_enabled: autoBackupEnabled,
    auto_backup_interval_hours: autoBackupInterval,
    close_to_tray: closeToTray,
    minimize_to_tray: minimizeToTray,
    global_hotkey_enabled: hotkeyEnabled,
    client_id: null,
    client_secret: null,
    ...overrides,
  });

  const saveRules = async () => {
    setSavingRules(true);
    try {
      await onSave(buildInput());
      toast.success("Backup rules saved");
    } catch (err) {
      toast.error("Could not save settings", { description: String(err) });
    } finally {
      setSavingRules(false);
    }
  };

  const saveAutomation = async () => {
    setSavingAutomation(true);
    try {
      await onSave(buildInput());
      toast.success("Automation settings saved", {
        description: autoBackupEnabled
          ? "Scheduled backups will run while ProjectUp is open."
          : undefined,
      });
    } catch (err) {
      toast.error("Could not save automation settings", { description: String(err) });
    } finally {
      setSavingAutomation(false);
    }
  };

  const handleAutostart = async (value: boolean) => {
    if (!isTauriRuntime()) {
      toast.error("Startup launch is only available in the desktop app");
      return;
    }
    setAutostartBusy(true);
    try {
      const next = await invoke<boolean>("set_autostart", { enabled: value });
      setAutostartEnabled(next);
      toast.success(next ? "ProjectUp will launch at startup" : "Startup launch disabled", {
        description: next
          ? "It opens quietly in the tray so scheduled backups can keep running."
          : undefined,
        id: "autostart",
      });
    } catch (err) {
      toast.error("Could not update startup setting", {
        description: String(err),
        id: "autostart",
      });
    } finally {
      setAutostartBusy(false);
    }
  };

  const handleQuit = async () => {
    setQuitting(true);
    try {
      await onQuit();
    } catch (err) {
      setQuitting(false);
      toast.error("Could not quit ProjectUp", { description: String(err) });
    }
  };

  const saveOauth = async () => {
    if (!clientId.trim()) {
      toast.error("Client ID is required");
      return;
    }
    if (clientId.trim() !== settings.client_id && !clientSecret.trim()) {
      toast.error("Enter the Client secret for the new Client ID");
      return;
    }
    setSavingOauth(true);
    try {
      await onSave(
        buildInput({
          client_id: clientId.trim(),
          client_secret: clientSecret.trim() ? clientSecret.trim() : null,
        })
      );
      setClientSecret("");
      setShowOauth(false);
      toast.success("Google OAuth credentials saved");
    } catch (err) {
      toast.error("Could not save credentials", { description: String(err) });
    } finally {
      setSavingOauth(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await onDisconnectDrive();
      setConfirmDisconnect(false);
      toast.success("Google Drive disconnected");
    } catch (err) {
      toast.error("Could not disconnect", { description: String(err) });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSyncCloud = async () => {
    setSyncingCloud(true);
    try {
      await onSyncCloud();
    } catch (err) {
      toast.error("Cloud vault sync failed", { description: String(err) });
    } finally {
      setSyncingCloud(false);
    }
  };

  const totalBackups = snapshot.backups.length;
  const totalBytes = snapshot.backups.reduce((sum, b) => sum + b.size_bytes, 0);

  return (
    <div className="relative flex-1 overflow-y-auto">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 overflow-hidden">
        <div className="aura right-[10%] top-[-150px] h-[280px] w-[420px] bg-primary/[0.07]" />
        <div className="ambient-grid absolute inset-0 opacity-40" />
      </div>

      <div className="relative mx-auto w-full max-w-3xl px-4 pb-12 pt-6 sm:px-7">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-primary/70">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_#00ff88]" />
            Configuration
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Settings</h1>
          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-neutral-500">
            Connect your Drive, tune snapshot rules, and decide how ProjectUp runs in the background.
            Everything is stored locally on this machine.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {/* Google Drive account */}
          <section className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-[#030705] to-[#020403] p-5">
            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-primary/[0.08] blur-3xl" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3.5">
                {drive.connected && drive.picture ? (
                  <img
                    src={drive.picture}
                    alt=""
                    className="h-12 w-12 rounded-2xl border border-primary/25 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",
                      drive.connected
                        ? "border-primary/30 bg-primary/15 text-primary shadow-[0_0_24px_-8px_rgba(0,255,136,0.6)]"
                        : "border-white/10 bg-white/[0.04] text-neutral-500"
                    )}
                  >
                    <Cloud className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-white">
                      {drive.connected ? drive.name || "Google Drive" : "Google Drive"}
                    </h2>
                    <Badge variant={drive.connected ? "success" : "secondary"}>
                      {drive.connected ? "Connected" : "Not connected"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">
                    {drive.connected
                      ? drive.email || "Drive account linked"
                      : "Connect to upload compressed project snapshots straight to your Drive."}
                  </p>
                  {drive.connected ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-black/30 px-2.5 py-1 text-[9px] font-medium text-neutral-400">
                        <FolderCog className="h-3 w-3 text-primary/70" />
                        {drive.folder_name}
                      </span>
                      <span className="text-[9px] text-neutral-600">
                        {formatNumber(totalBackups)} snapshots · {formatBytes(totalBytes)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {drive.connected ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleSyncCloud}
                      loading={syncingCloud}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Sync
                    </Button>
                    {drive.folder_id ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        onClick={() =>
                          onOpenUrl(`https://drive.google.com/drive/folders/${drive.folder_id}`)
                        }
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open folder
                      </Button>
                    ) : null}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setConfirmDisconnect(true)}
                    >
                      <Link2Off className="h-3.5 w-3.5" />
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setGuideOpen(true)}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      Setup guide
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={onConnectDrive}>
                      <Cloud className="h-3.5 w-3.5" />
                      Connect Google Drive
                    </Button>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Drive folder + OAuth */}
          <section className="rounded-2xl border border-white/[0.06] bg-[#030604] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-primary">
                <FolderCog className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-white">Drive destination</h2>
                <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">
                  ProjectUp creates this folder inside your Google Drive and uploads every snapshot into it.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="folder-name">Folder name</Label>
              <Input
                id="folder-name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="RYZ ProjectUp"
                className="mt-1.5"
              />
              <p className="mt-1.5 text-[10px] text-neutral-600">
                Changing this creates a new destination folder on the next backup.
              </p>
            </div>

            <Separator className="my-4" />

            <button
              type="button"
              onClick={() => setShowOauth((v) => !v)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-2.5">
                <KeyRound className="h-3.5 w-3.5 text-primary/70" />
                <span>
                  <span className="block text-xs font-semibold text-white">Google OAuth credentials</span>
                  <span className="mt-0.5 block text-[10px] text-neutral-500">
                    {settings.has_client_secret && settings.client_id
                      ? `Configured · ${truncateMiddle(settings.client_id, 42)}`
                      : "Required to connect your own Google Drive"}
                  </span>
                </span>
              </span>
              <ChevronDown
                className={cn("h-4 w-4 text-neutral-500 transition-transform", showOauth && "rotate-180")}
              />
            </button>

            {showOauth ? (
              <div className="mt-4 space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
                <div className="rounded-xl border border-primary/15 bg-primary/[0.05] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">
                    One-time setup · 3 minutes
                  </p>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[10px] leading-relaxed text-neutral-400 marker:text-primary/50">
                    <li>Open Google Cloud Console and create (or pick) a project.</li>
                    <li>
                      Enable the <strong className="text-neutral-200">Google Drive API</strong>, then create an
                      OAuth client of type <strong className="text-neutral-200">Desktop app</strong>.
                    </li>
                    <li>Paste the Client ID and Client secret below, save, then connect.</li>
                  </ol>
                  <button
                    type="button"
                    onClick={() => onOpenUrl("https://console.cloud.google.com/apis/credentials")}
                    className="mt-2.5 inline-flex items-center gap-1.5 text-[10px] font-semibold text-primary hover:underline"
                  >
                    Open Google Cloud Console
                    <ExternalLink className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideOpen(true)}
                    className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/[0.07] px-2.5 py-2 text-left text-[10px] font-semibold text-primary transition-colors hover:bg-primary/[0.12]"
                  >
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3" />
                      View the detailed step-by-step guide
                    </span>
                    <ChevronDown className="h-3 w-3 -rotate-90" />
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="client-id">Client ID</Label>
                    <Input
                      id="client-id"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="1234567890-abc.apps.googleusercontent.com"
                      spellCheck={false}
                      autoComplete="off"
                      className="mt-1.5 font-mono text-[11px]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="client-secret">Client secret</Label>
                    <Input
                      id="client-secret"
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder={
                        settings.has_client_secret ? "••••••••  Saved — leave blank to keep" : "GOCSPX-..."
                      }
                      spellCheck={false}
                      autoComplete="off"
                      className="mt-1.5 font-mono text-[11px]"
                    />
                    <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-neutral-600">
                      <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                      Credentials and refresh tokens stay in this app&apos;s local data directory
                      {snapshot.secure_storage
                        ? ` and are encrypted at rest with ${snapshot.secure_storage_label}.`
                        : "."}{" "}
                      They never touch a RYZ server.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={saveOauth}
                    loading={savingOauth}
                    className="gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save credentials
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          {/* Backup rules */}
          <section className="rounded-2xl border border-white/[0.06] bg-[#030604] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-white">Snapshot rules</h2>
                <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">
                  Control what gets archived, how hard it is compressed, and how many snapshots remain in
                  Drive.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3.5 py-3">
              <div>
                <p className="text-xs font-semibold text-white">Respect .gitignore</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">
                  Skip node_modules, build output, secrets and every pattern in the project&apos;s{" "}
                  <code className="font-mono text-primary/70">.gitignore</code> /{" "}
                  <code className="font-mono text-primary/70">.ryzignore</code>.
                </p>
              </div>
              <Switch checked={respectGitignore} onCheckedChange={setRespectGitignore} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="retention">Snapshots kept per project</Label>
                <Select
                  value={String(retention)}
                  onValueChange={(value) => setRetention(Number(value))}
                >
                  <SelectTrigger id="retention" className="mt-1.5">
                    <SelectValue placeholder="Choose retention" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Unlimited</SelectItem>
                    <SelectItem value="3">Last 3 snapshots</SelectItem>
                    <SelectItem value="5">Last 5 snapshots</SelectItem>
                    <SelectItem value="10">Last 10 snapshots</SelectItem>
                    <SelectItem value="20">Last 20 snapshots</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-[10px] text-neutral-600">Older Drive files are deleted after upload.</p>
              </div>
              <div>
                <Label htmlFor="compression">Zip compression</Label>
                <Select
                  value={String(compression)}
                  onValueChange={(value) => setCompression(Number(value))}
                >
                  <SelectTrigger id="compression" className="mt-1.5">
                    <SelectValue placeholder="Choose compression" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Fast — larger archives</SelectItem>
                    <SelectItem value="6">Balanced — recommended</SelectItem>
                    <SelectItem value="9">Maximum — slower</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-[10px] text-neutral-600">Applies to the next snapshot.</p>
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="extra-patterns">Always ignore</Label>
              <Textarea
                id="extra-patterns"
                value={extraPatterns}
                onChange={(e) => setExtraPatterns(e.target.value)}
                placeholder={".env\n*.pem\nnode_modules/\ndist/"}
                spellCheck={false}
                className="mt-1.5 min-h-[110px] font-mono text-[11px]"
              />
              <p className="mt-1.5 text-[10px] leading-relaxed text-neutral-600">
                One gitignore-style pattern per line, applied on top of the project&apos;s own rules. The
                defaults cover common build folders, dependency caches and secret files. Drop a{" "}
                <code className="font-mono text-neutral-400">.ryzignore</code> file in a project for
                project-specific extras.
              </p>
            </div>

            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={saveRules} loading={savingRules} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                Save rules
              </Button>
            </div>
          </section>

          {/* Automation */}
          <section className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#030604] p-5">
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-primary/[0.05] blur-3xl" />
            <div className="relative flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-primary">
                <Clock3 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-white">Automation & background</h2>
                <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">
                  Keep snapshots current without opening the app, and choose how ProjectUp behaves when
                  you minimize or close it.
                </p>
              </div>
            </div>

            <div className="relative mt-4 space-y-3">
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-3.5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-white">Scheduled backups</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">
                      Each project is checked against its own last snapshot, so a recent backup in one
                      project never delays another.
                    </p>
                  </div>
                  <Switch
                    aria-label="Enable scheduled backups"
                    checked={autoBackupEnabled}
                    onCheckedChange={setAutoBackupEnabled}
                  />
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
                  <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                    <Clock3 className="h-3 w-3 text-primary/60" />
                    Run a due project every
                  </div>
                  <Select
                    value={String(autoBackupInterval)}
                    onValueChange={(value) => setAutoBackupInterval(Number(value))}
                    disabled={!autoBackupEnabled}
                  >
                    <SelectTrigger className="h-9" aria-label="Automatic backup interval">
                      <SelectValue placeholder="Choose interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">Every 6 hours</SelectItem>
                      <SelectItem value="12">Every 12 hours</SelectItem>
                      <SelectItem value="24">Every day</SelectItem>
                      <SelectItem value="72">Every 3 days</SelectItem>
                      <SelectItem value="168">Every week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <p className="mt-2 text-[10px] leading-relaxed text-neutral-600">
                  Runs only while ProjectUp is open, including when it is hidden in the tray. Pair it with
                  startup launch to keep the schedule alive after a reboot.
                </p>
                {autoBackupEnabled && !drive.connected ? (
                  <p className="mt-2 rounded-lg border border-amber-500/15 bg-amber-500/[0.05] px-2.5 py-2 text-[10px] leading-relaxed text-amber-200/70">
                    Google Drive is not connected, so scheduled uploads will wait. Connect Drive first.
                  </p>
                ) : null}
              </div>

              <div className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3.5 py-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <Keyboard className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                  <div>
                    <p className="text-xs font-semibold text-white">Global backup hotkey</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">
                      Start a bulk backup from any app, even when ProjectUp is in the tray.
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      {["Ctrl", "Shift", "B"].map((key) => (
                        <kbd
                          key={key}
                          className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] px-1.5 font-mono text-[9px] font-semibold text-neutral-300"
                        >
                          {key}
                        </kbd>
                      ))}
                      <span className="ml-1 text-[9px] text-neutral-600">works system-wide</span>
                    </div>
                  </div>
                </div>
                <Switch
                  aria-label="Enable global backup hotkey"
                  checked={hotkeyEnabled}
                  onCheckedChange={setHotkeyEnabled}
                />
              </div>

              <div className="overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.015]">
                <div className="flex items-center justify-between gap-4 px-3.5 py-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                    <div>
                      <p className="text-xs font-semibold text-white">Launch at startup</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">
                        Open quietly in the tray when your computer starts. Saved immediately.
                      </p>
                    </div>
                  </div>
                  <Switch
                    aria-label="Launch ProjectUp at startup"
                    checked={autostartEnabled}
                    disabled={!isTauriRuntime() || autostartBusy}
                    onCheckedChange={handleAutostart}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-4 px-3.5 py-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Minimize2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                    <div>
                      <p className="text-xs font-semibold text-white">Minimize to tray</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">
                        The minimize button hides the window instead of sending it to the taskbar.
                      </p>
                    </div>
                  </div>
                  <Switch
                    aria-label="Minimize ProjectUp to tray"
                    checked={minimizeToTray}
                    onCheckedChange={setMinimizeToTray}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-4 px-3.5 py-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Power className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                    <div>
                      <p className="text-xs font-semibold text-white">Close to tray</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">
                        Closing the window keeps ProjectUp running so scheduled backups can continue.
                      </p>
                    </div>
                  </div>
                  <Switch
                    aria-label="Close ProjectUp to tray"
                    checked={closeToTray}
                    onCheckedChange={setCloseToTray}
                  />
                </div>
              </div>
            </div>

            <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmQuit(true)}
                className="gap-1.5 text-neutral-500 hover:text-red-300"
              >
                <Power className="h-3.5 w-3.5" />
                Quit ProjectUp
              </Button>
              <div className="flex items-center gap-2">
                <span className="hidden text-[9px] text-neutral-600 sm:inline">
                  Tray settings apply after saving
                </span>
                <Button
                  size="sm"
                  onClick={saveAutomation}
                  loading={savingAutomation}
                  className="gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save automation
                </Button>
              </div>
            </div>
          </section>

          {/* Privacy */}
          <section className="rounded-2xl border border-white/[0.06] bg-[#030604] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-primary">
                <Database className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-white">Local data & privacy</h2>
                <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">
                  Project paths, snapshot history, settings and OAuth tokens live only on this PC. Project
                  files are streamed directly to Google Drive.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/40 px-3 py-2.5">
              <Terminal className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
              <span className="path-text min-w-0 flex-1 truncate text-neutral-400" title={data_dir}>
                {data_dir}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => onReveal(data_dir)}
                title="Open data folder"
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard?.writeText(data_dir).then(
                    () => toast.success("Data path copied"),
                    () => toast.error("Clipboard unavailable")
                  );
                }}
                title="Copy path"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/[0.04] px-3.5 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary/80" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-neutral-200">Google credentials</p>
                  <p className="text-[10px] leading-relaxed text-neutral-500">
                    {snapshot.secure_storage
                      ? `Client secret and refresh tokens are encrypted at rest with ${snapshot.secure_storage_label}.`
                      : "Stored in the local app data folder — OS secure storage is unavailable."}
                  </p>
                </div>
              </div>
              <Badge
                variant={snapshot.secure_storage ? "success" : "warning"}
                className="shrink-0 gap-1"
              >
                <ShieldCheck className="h-2.5 w-2.5" />
                {snapshot.secure_storage ? "Encrypted" : "Local"}
              </Badge>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/[0.04] p-3">
              <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
              <p className="text-[10px] leading-relaxed text-neutral-500">
                Your project list, folders and snapshot history are also saved as{" "}
                <code className="font-mono text-neutral-300">ryz-projectup-vault.json</code> in the Drive
                backup folder. Connect the same Drive on another PC and ProjectUp restores the vault
                automatically — OAuth secrets and tokens are never included.
              </p>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex items-start gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                <div>
                  <p className="text-[11px] font-semibold text-neutral-200">No middleman servers</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-600">
                    Uploads use Google&apos;s Drive API with the file-scoped{" "}
                    <code className="font-mono">drive.file</code> permission.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                <div>
                  <p className="text-[11px] font-semibold text-neutral-200">App-scoped access</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-600">
                    ProjectUp can only see files it creates — not the rest of your Drive.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* About */}
          <section className="rounded-2xl border border-white/[0.06] bg-[#030604] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img src="/logo.svg" alt="" className="h-10 w-10" draggable={false} />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-brand text-xs text-white">RYZ PROJECTUP</h2>
                    <Badge variant="secondary" className="py-0 text-[9px]">
                      v{snapshot.version}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-neutral-500">
                    Git-aware project backups for Google Drive.
                  </p>
                </div>
              </div>
              <Badge variant="success" className="shrink-0 gap-1">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Local-first
              </Badge>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-wrap items-center gap-2">
              {["Tauri 2", "Rust", "React 18", "TypeScript", "Tailwind CSS", "shadcn/ui"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[9px] font-medium text-neutral-500"
                >
                  {tag}
                </span>
              ))}
              <span className="ml-auto flex items-center gap-1 text-[10px] text-neutral-600">
                <Sparkles className="h-3 w-3 text-primary/50" />
                Built by R ! Y 4 Z
              </span>
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title="Disconnect Google Drive?"
        description="ProjectUp will forget the stored OAuth tokens and stop uploading snapshots. Existing files stay safely in your Drive."
        confirmLabel="Disconnect"
        destructive
        loading={disconnecting}
        onConfirm={handleDisconnect}
        icon={Unplug}
      />

      <ConfirmDialog
        open={confirmQuit}
        onOpenChange={setConfirmQuit}
        title="Quit ProjectUp?"
        description="Scheduled backups will pause until you open ProjectUp again. Any backup already in progress will stop."
        confirmLabel="Quit app"
        destructive
        loading={quitting}
        onConfirm={handleQuit}
        icon={Power}
      />

      <OAuthSetupGuide open={guideOpen} onOpenChange={setGuideOpen} onOpenUrl={onOpenUrl} />
    </div>
  );
};
