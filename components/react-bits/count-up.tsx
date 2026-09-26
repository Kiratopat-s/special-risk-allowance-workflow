"use client";
// Adapted from React Bits CountUp. See LICENSE.md and https://reactbits.dev/text-animations/count-up.
import { animate, useInView } from "motion/react";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(reducedMotionQuery).matches;
}

function getServerReducedMotionSnapshot() {
  return false;
}

export function CountUp({
  to,
  decimals = 0,
}: {
  to: number;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );
  const visible = useInView(ref, { once: true });
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("th-TH", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    [decimals],
  );
  const final = formatter.format(to);

  useEffect(() => {
    let active = true;
    const update = (current: number) => {
      if (active && ref.current)
        ref.current.textContent = formatter.format(current);
    };

    update(reduced ? to : 0);
    if (!visible || reduced || to === 0) return;

    const animation = animate(0, to, {
      type: "tween",
      duration: 2,
      ease: "easeOut",
      onUpdate: update,
      onComplete: () => update(to),
    });

    return () => {
      active = false;
      animation.stop();
    };
  }, [visible, reduced, to, formatter]);

  return (
    <>
      <span aria-hidden="true" ref={ref}>
        {reduced ? final : formatter.format(0)}
      </span>
      <span className="sr-only">{final}</span>
    </>
  );
}
