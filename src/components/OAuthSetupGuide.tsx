import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Cloud,
  ExternalLink,
  FolderPlus,
  KeyRound,
  Lock,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface OAuthSetupGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenUrl: (url: string) => void;
}

const LINKS = {
  console: "https://console.cloud.google.com/",
  newProject: "https://console.cloud.google.com/projectcreate",
  driveApi: "https://console.cloud.google.com/apis/library/drive.googleapis.com",
  authPlatform: "https://console.cloud.google.com/auth/overview",
  credentials: "https://console.cloud.google.com/apis/credentials",
  permissions: "https://myaccount.google.com/permissions",
};

const Step: React.FC<{
  number: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ number, icon: Icon, title, hint, children }) => (
  <div className="relative flex gap-3">
    <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-[#041007] text-[11px] font-bold text-primary shadow-[0_0_18px_-6px_rgba(0,255,136,0.6)]">
      {number}
    </div>
    <div className="min-w-0 flex-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-primary/80" />
        <h3 className="text-xs font-semibold text-white">{title}</h3>
        {hint ? (
          <Badge variant="secondary" className="py-0 text-[9px]">
            {hint}
          </Badge>
        ) : null}
      </div>
      <div className="mt-1.5 space-y-2 text-[11px] leading-relaxed text-neutral-500">{children}</div>
    </div>
  </div>
);

const GuideLink: React.FC<{
  children: React.ReactNode;
  url: string;
  onOpenUrl: (url: string) => void;
  variant?: "default" | "secondary" | "ghost";
}> = ({ children, url, onOpenUrl, variant = "secondary" }) => (
  <Button
    type="button"
    size="sm"
    variant={variant}
    onClick={() => onOpenUrl(url)}
    className="mt-1 h-7 gap-1.5 px-2.5 text-[10px]"
  >
    {children}
    <ExternalLink className="h-3 w-3" />
  </Button>
);

export const OAuthSetupGuide: React.FC<OAuthSetupGuideProps> = ({ open, onOpenChange, onOpenUrl }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="border-b border-white/[0.06] bg-[#030604] px-6 py-5 pr-14">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_26px_-10px_rgba(0,255,136,0.65)]">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle>Get your Google OAuth credentials</DialogTitle>
                <Badge className="py-0 text-[9px]">One-time setup</Badge>
              </div>
              <DialogDescription>
                Create a free Desktop OAuth client in your own Google Cloud project. About 3 minutes.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(88vh-178px)] overflow-y-auto px-6 py-5">
          <div className="mb-5 rounded-2xl border border-primary/15 bg-primary/[0.05] p-3.5">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-[11px] font-semibold text-primary/90">
                  ProjectUp does not ship a Google client
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-neutral-400">
                  Each user connects their own Drive. You will create an OAuth client, copy its{" "}
                  <strong className="text-neutral-200">Client ID</strong> and{" "}
                  <strong className="text-neutral-200">Client secret</strong>, then paste them into the
                  Connect dialog. No billing is required.
                </p>
              </div>
            </div>
          </div>

          <div className="relative space-y-3">
            <div className="pointer-events-none absolute bottom-8 left-[17px] top-8 z-0 w-px bg-gradient-to-b from-primary/35 via-white/10 to-transparent" />

            <Step number={1} icon={FolderPlus} title="Create a Google Cloud project" hint="~1 min">
              <p>
                Sign in to Google Cloud with the Google account whose Drive you want to back up. Use the
                project selector at the top and create a new project, or pick an existing one.
              </p>
              <GuideLink url={LINKS.newProject} onOpenUrl={onOpenUrl}>
                Create a project
              </GuideLink>
            </Step>

            <Step number={2} icon={Cloud} title="Enable the Google Drive API" hint="1 click">
              <p>
                Open the Drive API page and click <strong className="text-neutral-300">Enable</strong> for
                the same project. Without this, Drive uploads will fail with a 403 error.
              </p>
              <GuideLink url={LINKS.driveApi} onOpenUrl={onOpenUrl}>
                Enable Google Drive API
              </GuideLink>
            </Step>

            <Step number={3} icon={ShieldCheck} title="Configure the OAuth consent screen" hint="Google Auth Platform">
              <p>
                Open the Google Auth Platform (the new home of the OAuth consent screen) and fill in the
                app details:
              </p>
              <ul className="space-y-1.5 pl-1">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" />
                  <span>
                    App name: <strong className="text-neutral-300">RYZ ProjectUp</strong> (or anything you
                    like)
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" />
                  <span>User type: External</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" />
                  <span>
                    Audience → <strong className="text-neutral-300">Test users</strong> → add the same
                    Google account you will use for Drive
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" />
                  <span>
                    Data access → add the scope{" "}
                    <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[9px] text-primary/80">
                      .../auth/drive.file
                    </code>
                  </span>
                </li>
              </ul>
              <GuideLink url={LINKS.authPlatform} onOpenUrl={onOpenUrl}>
                Configure consent screen
              </GuideLink>
            </Step>

            <Step number={4} icon={KeyRound} title="Create a Desktop OAuth client" hint="Desktop app">
              <p>
                Go to <strong className="text-neutral-300">Credentials → Create credentials → OAuth client
                ID</strong>. Choose <strong className="text-neutral-300">Desktop app</strong>, give it a name,
                and click Create. If Google asks you to configure the consent screen first, finish step 3.
              </p>
              <p>Copy the two values Google shows you:</p>
              <div className="space-y-2 rounded-xl border border-white/[0.07] bg-black/40 p-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-600">
                    Client ID — example
                  </p>
                  <p className="path-text mt-0.5 text-neutral-400">
                    1234567890-abc123.apps.googleusercontent.com
                  </p>
                </div>
                <div className="h-px bg-white/[0.05]" />
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-600">
                    Client secret — example
                  </p>
                  <p className="path-text mt-0.5 text-neutral-400">GOCSPX-xxxxxxxxxxxxxxxxxxxx</p>
                </div>
              </div>
              <p className="text-[10px] text-neutral-600">
                Yours will look different. You can find both again under Credentials → OAuth 2.0 Client IDs →
                your Desktop client.
              </p>
              <GuideLink url={LINKS.credentials} onOpenUrl={onOpenUrl}>
                Open Credentials
              </GuideLink>
            </Step>

            <Step number={5} icon={MousePointerClick} title="Paste into ProjectUp and connect" hint="~30 sec">
              <p>
                Paste the Client ID and Client secret into the Connect Google Drive dialog, then click{" "}
                <strong className="text-neutral-300">Continue with Google</strong>.
              </p>
              <ul className="space-y-1.5 pl-1">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" />
                  <span>Choose the same Google account you added as a test user.</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" />
                  <span>
                    If Google says the app isn&apos;t verified:{" "}
                    <strong className="text-neutral-300">Advanced → Go to RYZ ProjectUp (unsafe)</strong>.
                    This is expected for your own test app.
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" />
                  <span>
                    ProjectUp requests only{" "}
                    <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[9px] text-primary/80">
                      drive.file
                    </code>
                    , so it can manage only the backup files it creates.
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" />
                  <span>
                    On a new PC, use the same OAuth client, Google account and backup folder name. ProjectUp
                    restores the project list and snapshot history from the Drive vault index.
                  </span>
                </li>
              </ul>
            </Step>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              If something goes wrong
            </p>
            <div className="mt-3 grid gap-3 text-[10px] leading-relaxed sm:grid-cols-2">
              <div>
                <p className="font-semibold text-neutral-300">Access blocked / app not verified</p>
                <p className="mt-0.5 text-neutral-500">
                  Add your Google account under Audience → Test users. Only test users can sign in while the
                  app is in Testing.
                </p>
              </div>
              <div>
                <p className="font-semibold text-neutral-300">Drive API has not been used</p>
                <p className="mt-0.5 text-neutral-500">
                  Enable the Google Drive API in the same project, then retry the backup.
                </p>
              </div>
              <div>
                <p className="font-semibold text-neutral-300">invalid_grant / expired</p>
                <p className="mt-0.5 text-neutral-500">
                  Testing-mode refresh tokens expire after about 7 days. Disconnect and reconnect Drive.
                </p>
              </div>
              <div>
                <p className="font-semibold text-neutral-300">Browser did not return</p>
                <p className="mt-0.5 text-neutral-500">
                  Allow the local loopback callback (127.0.0.1), set a default browser, then retry.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenUrl(LINKS.permissions)}
              className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-200/80 hover:text-amber-100 hover:underline"
            >
              Manage app permissions in your Google account
              <ExternalLink className="h-2.5 w-2.5" />
            </button>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/[0.04] p-3">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
            <p className="text-[10px] leading-relaxed text-neutral-500">
              Your Client ID, Client secret and refresh token are stored only in ProjectUp&apos;s local data
              folder on this PC. Never share your Client secret or commit it to a public repository. If it
              leaks, delete the OAuth client in Google Cloud and create a new one.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenUrl(LINKS.console)}
            className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-left transition hover:border-primary/25 hover:bg-primary/[0.04]"
          >
            <span className="flex items-center gap-2 text-[10px] font-semibold text-neutral-400">
              <Cloud className="h-3.5 w-3.5 text-primary/70" />
              Google Cloud Console
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-neutral-600" />
          </button>
        </div>

        <div className="flex flex-col-reverse items-stretch justify-between gap-2 border-t border-white/[0.06] bg-[#030604] px-6 py-3.5 sm:flex-row sm:items-center">
          <p className="flex items-center gap-1.5 text-[10px] text-neutral-600">
            <BookOpen className="h-3 w-3 text-primary/50" />
            Reopen this guide anytime from Settings → Google OAuth credentials.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenUrl(LINKS.credentials)}
              className="gap-1.5"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Credentials
            </Button>
            <Button type="button" size="sm" onClick={() => onOpenChange(false)} className="gap-1.5">
              Got it
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
