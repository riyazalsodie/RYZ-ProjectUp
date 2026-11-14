import React from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TitleBarProps {
  isMaximized: boolean;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
  statusLabel?: string | null;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

export const TitleBar: React.FC<TitleBarProps> = ({
  isMaximized,
  onMinimize,
  onToggleMaximize,
  onClose,
  statusLabel,
}) => {
  return (
    <div
      data-tauri-drag-region
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        onToggleMaximize();
      }}
      className={cn(
        "relative z-50 flex h-11 shrink-0 select-none items-center justify-between border-b border-primary/10 bg-black px-3",
        isMaximized ? "rounded-none" : "rounded-t-2xl"
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5 pl-1">
        {isMac ? (
          <div
            className="mr-1 flex items-center gap-2"
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="h-3 w-3 rounded-full border border-[#e0443e]/50 bg-[#ff5f56] transition hover:brightness-110"
            />
            <button
              type="button"
              onClick={onMinimize}
              title="Minimize"
              className="h-3 w-3 rounded-full border border-[#dea123]/50 bg-[#ffbd2e] transition hover:brightness-110"
            />
            <button
              type="button"
              onClick={onToggleMaximize}
              title={isMaximized ? "Restore" : "Maximize"}
              className="h-3 w-3 rounded-full border border-[#1aab29]/50 bg-[#27c93f] transition hover:brightness-110"
            />
          </div>
        ) : null}

        <img
          src="/logo.svg"
          alt="RYZ ProjectUp"
          className="h-5 w-5 object-contain drop-shadow-[0_0_8px_rgba(0,255,136,0.45)]"
          draggable={false}
        />
        <span className="font-brand flex items-center gap-2 text-[11px] text-white">
          RYZ PROJECTUP
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_#00ff88]" />
        </span>
        <span className="hidden text-[10px] font-medium text-neutral-600 sm:inline">
          — Git-aware Drive backups
        </span>

        {statusLabel ? (
          <span className="ml-2 hidden max-w-[220px] items-center gap-1.5 truncate rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary md:inline-flex">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
            <span className="truncate">{statusLabel}</span>
          </span>
        ) : null}
      </div>

      {!isMac ? (
        <div
          className="flex h-full items-center gap-1"
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onMinimize}
            title="Minimize"
            className="flex h-7 w-9 items-center justify-center rounded-lg text-neutral-500 transition-all hover:bg-white/[0.07] hover:text-white"
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onToggleMaximize}
            title={isMaximized ? "Restore" : "Maximize"}
            className="flex h-7 w-9 items-center justify-center rounded-lg text-neutral-500 transition-all hover:bg-white/[0.07] hover:text-white"
          >
            {isMaximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="flex h-7 w-9 items-center justify-center rounded-lg text-neutral-500 transition-all hover:bg-red-500 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
};
