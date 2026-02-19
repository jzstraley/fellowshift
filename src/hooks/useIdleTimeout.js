// src/hooks/useIdleTimeout.js
import { useEffect, useRef, useState, useCallback } from "react";

const IDLE_LIMIT = 15 * 60 * 1000; // 15 minutes
const WARNING_AT = 13 * 60 * 1000; // warn at 13 minutes
const CHECK_INTERVAL = 30 * 1000;  // check every 30 seconds

/**
 * Auto-signs out the user after 15 minutes of inactivity.
 * Shows a warning at 13 minutes.
 *
 * @param {Object} opts
 * @param {Function} opts.onTimeout - called when idle timeout fires (should sign out)
 * @param {boolean} opts.enabled - only active when true (i.e. user is authenticated)
 */
export default function useIdleTimeout({ onTimeout, enabled }) {
  const lastActivityRef = useRef(null);
  const [showWarning, setShowWarning] = useState(false);

  // Initialize the ref on first effect run (not during render)
  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showWarning) setShowWarning(false);
  }, [showWarning]);

  useEffect(() => {
    if (!enabled) return;

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    let throttleTimer = null;

    const throttledReset = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
        resetActivity();
      }, 5000); // throttle to every 5s
    };

    events.forEach((ev) => window.addEventListener(ev, throttledReset, { passive: true }));

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= IDLE_LIMIT) {
        onTimeout();
      } else if (elapsed >= WARNING_AT) {
        setShowWarning(true);
      }
    }, CHECK_INTERVAL);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, throttledReset));
      clearInterval(interval);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [enabled, onTimeout, resetActivity]);

  return { showWarning, dismissWarning: resetActivity };
}
