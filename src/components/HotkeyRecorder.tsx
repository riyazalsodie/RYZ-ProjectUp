import React, { useEffect, useRef, useState } from "react";
import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

const modifierLabels: Record<string, string> = {
  CommandOrControl: isMac ? "⌘" : "Ctrl",
  Super: isMac ? "⌘" : "Win",
  Alt: isMac ? "⌥" : "Alt",
  Shift: isMac ? "⇧" : "Shift",
};

const keyLabels: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Space: "Space",
  Backquote: "`",
  Backslash: "\\",
  BracketLeft: "[",
  BracketRight: "]",
  Comma: ",",
  Equal: "=",
  Minus: "-",
  Period: ".",
  Quote: "'",
  Semicolon: ";",
  Slash: "/",
};

const namedKeys = new Set([
  "Backquote",
  "Backslash",
  "BracketLeft",
  "BracketRight",
  "Comma",
  "Equal",
  "Minus",
  "Period",
  "Quote",
  "Semicolon",
  "Slash",
  "Space",
  "Enter",
  "Tab",
  "Backspace",
  "Delete",
  "End",
  "Home",
  "Insert",
  "PageDown",
  "PageUp",
  "PrintScreen",
  "ScrollLock",
  "Pause",
]);

const modifierCodes = new Set([
  "ControlLeft",
  "ControlRight",
  "ShiftLeft",
  "ShiftRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "OSLeft",
  "OSRight",
]);

function isSupportedKey(code: string): boolean {
  return (
    /^Key[A-Z]$/.test(code) ||
    /^Digit[0-9]$/.test(code) ||
    /^F([1-9]|1[0-9]|2[0-4])$/.test(code) ||
    /^Numpad([0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter|Equal)$/.test(code) ||
    /^Arrow(Up|Down|Left|Right)$/.test(code) ||
    namedKeys.has(code)
  );
}

function labelFor(part: string): string {
  if (modifierLabels[part]) return modifierLabels[part];
  if (/^Key[A-Z]$/.test(part)) return part.slice(3);
  if (/^Digit[0-9]$/.test(part)) return part.slice(5);
  if (part.startsWith("Numpad")) return `Num ${part.slice(6)}`;
  return keyLabels[part] ?? part;
}

interface HotkeyRecorderProps {
  value: string;
  onChange: (value: string) => void;
  onRecordingChange: (recording: boolean) => void;
}

export const HotkeyRecorder: React.FC<HotkeyRecorderProps> = ({
  value,
  onChange,
  onRecordingChange,
}) => {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recordingChangeRef = useRef(onRecordingChange);
  recordingChangeRef.current = onRecordingChange;

  const stopRecording = () => {
    setRecording(false);
    recordingChangeRef.current(false);
  };

  useEffect(() => {
    if (!recording) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        setError(null);
        stopRecording();
        return;
      }

      if (modifierCodes.has(event.code)) return;

      if (!event.ctrlKey && !event.altKey && !event.metaKey) {
        setError("Use Ctrl, Alt or Win plus a key.");
        return;
      }

      if (!isSupportedKey(event.code)) {
        setError("That key is not supported. Try a letter, number, F-key or arrow.");
        return;
      }

      const modifiers: string[] = [];
      if (event.ctrlKey) modifiers.push("CommandOrControl");
      if (event.altKey) modifiers.push("Alt");
      if (event.shiftKey) modifiers.push("Shift");
      if (event.metaKey) modifiers.push("Super");

      onChange([...modifiers, event.code].join("+"));
      setError(null);
      stopRecording();
    };

    const handleBlur = () => {
      setError(null);
      stopRecording();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("blur", handleBlur);
    };
  }, [recording, onChange]);

  useEffect(
    () => () => {
      recordingChangeRef.current(false);
    },
    []
  );

  const startRecording = () => {
    setError(null);
    setRecording(true);
    recordingChangeRef.current(true);
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <div className="flex items-center gap-1.5">
        {value
          .split("+")
          .filter(Boolean)
          .map((part) => (
            <kbd
              key={part}
              className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] px-1.5 font-mono text-[9px] font-semibold text-neutral-300",
                recording && "border-primary/30 bg-primary/[0.08] text-primary"
              )}
            >
              {labelFor(part)}
            </kbd>
          ))}
      </div>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={recording ? stopRecording : startRecording}
        className={cn(
          "h-6 gap-1.5 px-2 text-[9px]",
          recording && "text-primary hover:text-primary"
        )}
        aria-label={recording ? "Cancel hotkey recording" : "Change global backup hotkey"}
      >
        <Keyboard className="h-3 w-3" />
        {recording ? "Press keys…" : "Change"}
      </Button>
      {recording ? <span className="text-[9px] text-neutral-600">Esc cancels</span> : null}
      {error ? <span className="basis-full text-[9px] text-amber-300/80">{error}</span> : null}
    </div>
  );
};
