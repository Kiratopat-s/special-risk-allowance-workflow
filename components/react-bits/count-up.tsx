"use client";
// Adapted from React Bits CountUp. See LICENSE.md and https://reactbits.dev/text-animations/count-up.
import {
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { useEffect, useRef } from "react";
export function CountUp({
  to,
  decimals = 0,
}: {
  to: number;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const visible = useInView(ref, { once: true });
  const value = useMotionValue(0);
  const spring = useSpring(value, { damping: 60, stiffness: 100 });
  const final = new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(to);
  useEffect(() => {
    if (!visible || reduced) return;
    value.set(to);
    return spring.on("change", (current) => {
      if (ref.current)
        ref.current.textContent = new Intl.NumberFormat("th-TH", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(current);
    });
  }, [visible, reduced, to, decimals, value, spring]);
  return (
    <>
      <span aria-hidden="true" ref={ref}>
        {final}
      </span>
      <span className="sr-only">{final}</span>
    </>
  );
}
