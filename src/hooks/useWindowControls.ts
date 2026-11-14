import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useWindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    const win = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const sync = () => {
      win
        .isMaximized()
        .then((value) => {
          if (!disposed) setIsMaximized(value);
        })
        .catch(() => undefined);
    };

    sync();
    win
      .onResized(() => sync())
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const minimize = useCallback(async () => {
    if (!isTauriRuntime()) return;
    try {
      await getCurrentWindow().minimize();
    } catch {
      /* noop */
    }
  }, []);

  const toggleMaximize = useCallback(async () => {
    if (!isTauriRuntime()) return;
    try {
      const win = getCurrentWindow();
      await win.toggleMaximize();
      setIsMaximized(await win.isMaximized());
    } catch {
      /* noop */
    }
  }, []);

  const close = useCallback(async () => {
    if (!isTauriRuntime()) return;
    try {
      await getCurrentWindow().close();
    } catch {
      /* noop */
    }
  }, []);

  return { isMaximized, minimize, toggleMaximize, close };
}

export { isTauriRuntime };
