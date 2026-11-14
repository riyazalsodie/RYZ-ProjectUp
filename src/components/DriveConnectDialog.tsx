import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Cloud,
  ExternalLink,
  FolderOpen,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Unplug,
  XCircle,
} from "lucide-react";
import { AppSettings, DriveStatus } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { OAuthSetupGuide } from "@/components/OAuthSetupGuide";
import { cn } from "@/lib/utils";

interface DriveConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drive: DriveStatus;
  settings: AppSettings;
  connecting: boolean;
  error: string | null;
  onStart: (clientId: string, clientSecret: string) => void | Promise<void>;
  onCancel: () => void;
  onOpenUrl: (url: string) => void;
}

export const DriveConnectDialog: React.FC<DriveConnectDialogProps> = ({
  open,
  onOpenChange,
  drive,
  settings,
  connecting,
  error,
  onStart,
  onCancel,
  onOpenUrl,
}) => {
  const [clientId, setClientId] = useState(settings.client_id);
  const [clientSecret, setClientSecret] = useState("");
  const [showCreds, setShowCreds] = useState(!settings.client_id || !settings.has_client_secret);
  const [localError, setLocalError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClientId(settings.client_id);
    setClientSecret("");
    setShowCreds(!settings.client_id || !settings.has_client_secret);
    setLocalError(null);
  }, [open, settings.client_id, settings.has_client_secret]);

  const configured = !!settings.client_id && settings.has_client_secret;

  const handleStart = () => {
    setLocalError(null);
    setGuideOpen(false);
    if (!clientId.trim()) {
      setLocalError("Enter your Google OAuth Client ID first.");
      return;
    }
    if (clientId.trim() !== settings.client_id && !clientSecret.trim() && settings.has_client_secret) {
      setLocalError("Enter the Client secret that belongs to the new Client ID.");
      return;
    }
    if (!clientSecret.trim() && !settings.has_client_secret) {
      setLocalError("Enter the OAuth Client secret as well.");
      return;
    }
    onStart(clientId.trim(), clientSecret.trim());
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (connecting) return;
          if (!value) setGuideOpen(false);
          onOpenChange(value);
        }}
      >
      <DialogContent
        hideClose={connecting}
        className="max-w-md"
        onEscapeKeyDown={(e) => {
          if (connecting) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (connecting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                drive.connected
                  ? "border-primary/30 bg-primary/15 text-primary shadow-[0_0_24px_-8px_rgba(0,255,136,0.6)]"
                  : "border-white/[0.08] bg-white/[0.03] text-neutral-400"
              )}
            >
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>
                {drive.connected ? "Google Drive connected" : "Connect Google Drive"}
              </DialogTitle>
              <DialogDescription>
                {drive.connected
                  ? "Your snapshots upload straight to this account."
                  : "Authorize ProjectUp to create backups in your Drive."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {drive.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-4">
              {drive.picture ? (
                <img
                  src={drive.picture}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-11 w-11 rounded-xl border border-primary/25 object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/15 text-sm font-bold text-primary">
                  {(drive.name || drive.email || "G").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">{drive.name || "Google Drive"}</p>
                <p className="truncate text-[10px] text-neutral-500">{drive.email}</p>
                <div className="mt-1 flex items-center gap-1.5 text-[9px] text-primary/70">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  drive.file scope · app-created files only
                </div>
              </div>
              <Badge variant="success">Connected</Badge>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-3.5 w-3.5 text-primary/70" />
                <div>
                  <p className="text-[11px] font-medium text-neutral-200">Backup folder</p>
                  <p className="text-[10px] text-neutral-500">{drive.folder_name}</p>
                </div>
              </div>
              {drive.folder_id ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onOpenUrl(`https://drive.google.com/drive/folders/${drive.folder_id}`)}
                  title="Open folder in Google Drive"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>

            <DialogFooter>
              <Button size="sm" onClick={() => onOpenChange(false)} className="gap-1.5">
                <Check className="h-3.5 w-3.5" />
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : connecting ? (
          <div className="space-y-5 py-2">
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full border border-primary/20" />
              <span className="absolute inset-3 rounded-full border border-primary/15" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_40px_-10px_rgba(0,255,136,0.6)]">
                <Cloud className="h-7 w-7" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-[#041007]">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              </span>
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-white">Waiting for Google authorization</p>
              <p className="mx-auto mt-1.5 max-w-xs text-[11px] leading-relaxed text-neutral-500">
                A browser tab should have opened. Sign in, approve access for ProjectUp, and this window will
                update automatically.
              </p>
            </div>

            <div className="space-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
              {[
                "Browser opens Google sign-in",
                "You approve Drive file access",
                "ProjectUp stores a refresh token locally",
              ].map((line) => (
                <div key={line} className="flex items-center gap-2 text-[10px] text-neutral-500">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-primary/20 bg-primary/[0.06]">
                    <Check className="h-2.5 w-2.5 text-primary/70" />
                  </span>
                  {line}
                </div>
              ))}
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5">
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                <p className="break-words text-[10px] text-red-300">{error}</p>
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="secondary" size="sm" onClick={onCancel} className="gap-1.5">
                <Unplug className="h-3.5 w-3.5" />
                Cancel connection
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {!configured ? (
              <div className="rounded-xl border border-primary/15 bg-primary/[0.05] p-3.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary/80">
                  <Sparkles className="h-3 w-3" />
                  First-time setup
                </p>
                <p className="mt-1.5 text-[10px] leading-relaxed text-neutral-400">
                  ProjectUp uses your own Google Cloud OAuth app, so your Drive connection never passes
                  through a third-party server. Create a <strong className="text-neutral-200">Desktop app</strong>{" "}
                  OAuth client with the Drive API enabled.
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenUrl("https://console.cloud.google.com/apis/credentials")}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                  >
                    Open credentials console
                    <ExternalLink className="h-2.5 w-2.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenUrl("https://console.cloud.google.com/apis/library/drive.googleapis.com")}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary/80 hover:underline"
                  >
                    Enable Drive API
                    <ExternalLink className="h-2.5 w-2.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setGuideOpen(true)}
                  className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/[0.07] px-3 py-2.5 text-left transition-all hover:border-primary/35 hover:bg-primary/[0.12]"
                >
                  <span className="flex items-center gap-2 text-[10px] font-semibold text-primary">
                    <BookOpen className="h-3.5 w-3.5" />
                    View the detailed step-by-step guide
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-primary/70" />
                </button>
              </div>
            ) : null}

            {showCreds ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="drive-client-id">Client ID</Label>
                  <Input
                    id="drive-client-id"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="1234567890-abc.apps.googleusercontent.com"
                    spellCheck={false}
                    autoComplete="off"
                    className="mt-1.5 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <Label htmlFor="drive-client-secret">Client secret</Label>
                  <Input
                    id="drive-client-secret"
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder={settings.has_client_secret ? "••••••••  Saved — leave blank to keep" : "GOCSPX-..."}
                    spellCheck={false}
                    autoComplete="off"
                    className="mt-1.5 font-mono text-[11px]"
                  />
                </div>
                {configured ? (
                  <button
                    type="button"
                    onClick={() => setShowCreds(false)}
                    className="text-[10px] font-medium text-neutral-500 hover:text-neutral-300"
                  >
                    Keep existing credentials
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-3.5 w-3.5 text-primary/70" />
                  <div>
                    <p className="text-[11px] font-medium text-neutral-200">OAuth app configured</p>
                    <p className="path-text text-[9px] text-neutral-600">{settings.client_id.slice(0, 34)}…</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowCreds(true)}>
                  Change
                </Button>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2.5">
              <Lock className="mt-0.5 h-3 w-3 shrink-0 text-neutral-600" />
              <p className="text-[9px] leading-relaxed text-neutral-600">
                ProjectUp requests the <code className="font-mono text-neutral-400">drive.file</code> scope.
                It can only manage files it creates — never the rest of your Drive. Tokens stay on this PC.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="flex items-center gap-1.5 text-[10px] font-medium text-neutral-500 transition-colors hover:text-primary"
            >
              <BookOpen className="h-3 w-3" />
              Where do I find these credentials?
            </button>

            {localError || error ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5">
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                <p className="break-words text-[10px] text-red-300">{localError || error}</p>
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleStart} className="gap-1.5">
                Continue with Google
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
      </Dialog>

      <OAuthSetupGuide open={guideOpen} onOpenChange={setGuideOpen} onOpenUrl={onOpenUrl} />
    </>
  );
};
