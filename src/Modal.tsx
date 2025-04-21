import React, { useEffect, useRef, useState } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  disableEsc?: boolean;
  width?: number | string;
  title?: string;
  noPadding?: boolean;
  alignTopLeft?: boolean;
}

const getModalContentWidthStyles = ({ alignTopLeft, width }: { alignTopLeft: boolean; width?: number | string }) => {
  const widthValue = width ? (typeof width === 'number' ? `${width}px` : width) : '75vw';
  const maxWidthValue = width ? (typeof width === 'number' ? `${width}px` : width) : '100vw';

  return {
    width: alignTopLeft ? widthValue : widthValue,
    maxWidth: alignTopLeft ? maxWidthValue : 'min(1800px, 75vw)',
    minWidth: alignTopLeft ? (width ? (typeof width === 'number' ? `${width}px` : width) : '0') : undefined,
  };
};

export function Modal({ open, onClose, children, disableEsc = false, width, title, alignTopLeft = false }: ModalProps) {
  const [show, setShow] = useState(open);
  const [_, setAnimating] = useState(false);
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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.54)',
        zIndex: 3001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 0,
        padding: 0,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'none',
          borderRadius: 0,
          boxShadow: 'none',
          padding: 0,
          minWidth: 0,
          maxWidth: '100vw',
         
          position: 'relative',
          zIndex: 2000,
          display: 'flex',
          alignItems: alignTopLeft ? 'flex-start' : 'center',
          justifyContent: alignTopLeft ? 'flex-start' : 'center',
          width: '100%',
          height: '100%',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className={`modal-content${open ? " modal-content-in" : " modal-content-out"}`}
          ref={modalRef}
          tabIndex={-1}
          style={{
            outline: "none",
            // Use a helper to compute width-related styles
            ...getModalContentWidthStyles({ alignTopLeft, width }),
            minHeight: alignTopLeft ? '90vh' : '90vh',
            maxHeight: alignTopLeft ? '90vh' : '90vh',
            overflowY: alignTopLeft ? 'auto' : 'auto',
            overflowX: 'visible',
            overflow: undefined,
            height: alignTopLeft ? 'auto' : undefined,
            boxSizing: "border-box",
            zIndex: 2001,
            padding: alignTopLeft ? 0 : 'clamp(8px, 2vw, 40px)',
            background: '#232b3c',
            borderRadius: alignTopLeft ? 0 : 16,
            boxShadow: '0 2px 24px #0006',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            margin: 0,
            alignSelf: alignTopLeft ? 'flex-start' : 'center',
            justifySelf: alignTopLeft ? 'flex-start' : 'center',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 18, color: '#fff' }}>{title}</div>
          )}
          {children}
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', fontSize: 22, fontWeight: 600, color: '#aaa', cursor: 'pointer' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
