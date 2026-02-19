// src/hooks/useKeyboardShortcuts.js
import { useEffect } from "react";

/**
 * Global keyboard shortcuts for FellowShift.
 * - 1-9: Switch views by index
 * - Escape: Emit fellowshift:escape (modals listen and close)
 * - ArrowLeft/Right: Emit fellowshift:nav with direction
 * - Ctrl+K or /: Focus search bar (if present)
 */
export default function useKeyboardShortcuts({ views, setActiveView }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // Escape: always works (close modals)
      if (e.key === "Escape") {
        window.dispatchEvent(new CustomEvent("fellowshift:escape"));
        return;
      }

      // Ctrl+K or / to focus search (not in inputs)
      if (!isInput && (e.key === "/" || ((e.ctrlKey || e.metaKey) && e.key === "k"))) {
        e.preventDefault();
        const searchInput = document.querySelector("[data-fellowshift-search]");
        if (searchInput) searchInput.focus();
        return;
      }

      // Skip everything else if in an input
      if (isInput) return;

      // Number keys 1-9: switch views
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && num <= views.length) {
        e.preventDefault();
        setActiveView(views[num - 1].key);
        return;
      }

      // Arrow keys: emit navigation event
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent("fellowshift:nav", {
            detail: { direction: e.key === "ArrowLeft" ? -1 : 1 },
          })
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [views, setActiveView]);
}
