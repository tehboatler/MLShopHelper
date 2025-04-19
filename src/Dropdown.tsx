import React, { useState, useRef, useEffect } from "react";

interface DropdownProps {
  label: string;
  children: React.ReactNode;
}

export function Dropdown({ label, children }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="dropdown" ref={ref}>
      <button className="dropdown-label" onClick={() => setOpen((v) => !v)}>
        {label} <span style={{ fontSize: 12 }}>▼</span>
      </button>
      {open && <div className="dropdown-menu">{children}</div>}
    </div>
  );
}
