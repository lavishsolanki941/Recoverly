import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Animates from the previous value to `target` whenever it changes. */
export function useAnimatedNumber(target: number, durationMs = 700): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    // Reduced-motion: collapse to a single frame instead of animating —
    // still goes through the same rAF-driven setState path (not a
    // synchronous setState in the effect body), it just resolves on tick one.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const effectiveDuration = reducedMotion ? 0 : durationMs;

    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const t = effectiveDuration === 0 ? 1 : Math.min(1, elapsed / effectiveDuration);
      setValue(from + (target - from) * easeOutCubic(t));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    }
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
  }, [target, durationMs]);

  return value;
}
