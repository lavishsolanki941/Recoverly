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

    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
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
