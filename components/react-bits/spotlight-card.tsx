"use client";
// Adapted from React Bits SpotlightCard. See LICENSE.md and https://reactbits.dev/components/spotlight-card.
import { useRef } from "react";
import { useReducedMotion } from "motion/react";
export function SpotlightCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  return (
    <div
      ref={ref}
      className={`card-spotlight ${className}`}
      onMouseMove={(event) => {
        if (reduced || !ref.current) return;
        const box = ref.current.getBoundingClientRect();
        ref.current.style.setProperty(
          "--mouse-x",
          `${event.clientX - box.left}px`,
        );
        ref.current.style.setProperty(
          "--mouse-y",
          `${event.clientY - box.top}px`,
        );
      }}
    >
      {children}
    </div>
  );
}
