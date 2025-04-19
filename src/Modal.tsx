import React, { useEffect, useRef, useState } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  disableEsc?: boolean;
}

export function Modal({ open, onClose, children, disableEsc = false }: ModalProps) {
  const [show, setShow] = useState(open);
  const [animating, setAnimating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setShow(true);
      setAnimating(true);
      setTimeout(() => setAnimating(false), 250);
    } else if (show) {
      setAnimating(true);
      setTimeout(() => {
        setShow(false);
        setAnimating(false);
      }, 250);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && !disableEsc) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose, disableEsc]);

  if (!show) return null;
  return (
    <div
      className={`modal-backdrop${open ? " modal-fade-in" : " modal-fade-out"}`}
      style={{ zIndex: 2000 }}
    >
      <div
        className={`modal-content${open ? " modal-content-in" : " modal-content-out"}`}
        ref={modalRef}
        tabIndex={-1}
        style={{
          outline: "none",
          maxWidth: "100vw",
          boxSizing: "border-box",
          zIndex: 2001,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
