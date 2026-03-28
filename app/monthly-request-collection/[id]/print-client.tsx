"use client";

import { useEffect, useRef } from "react";

export function PrintPageControls() {
  const hasAutoPrintedRef = useRef(false);

  useEffect(() => {
    if (hasAutoPrintedRef.current) return;
    hasAutoPrintedRef.current = true;

    // Wait until browser has painted the page before opening print dialog.
    const raf = window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        window.print();
      }, 180);
    });

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="no-print"
      style={{
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: "12px",
        gap: "8px",
      }}
    >
      <button
        type="button"
        onClick={handlePrint}
        style={{
          fontFamily: "'THSarabun', 'Sarabun', sans-serif",
          fontSize: "15px",
          padding: "6px 16px",
          borderRadius: "6px",
          border: "1px solid #1a56db",
          cursor: "pointer",
          background: "#1a56db",
          color: "#fff",
        }}
      >
        พิมพ์ / บันทึก PDF
      </button>
    </div>
  );
}
