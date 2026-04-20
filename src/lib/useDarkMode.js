import { useEffect } from "react";

/**
 * Syncs the <html> dark class with the OS prefers-color-scheme.
 * Call this once at the app root.
 */
export function useDarkMode() {
  useEffect(() => {
    const root = document.documentElement;

    const apply = (dark) => {
      if (dark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    apply(mq.matches);

    const handler = (e) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
}