import React from "react";

interface ToastProps {
  msg: string;
  visible: boolean;
}

// Use named export for consistency
export const Toast: React.FC<ToastProps> = ({ msg, visible }) => {
  if (!visible) {
    // console.log('[Toast] not visible, returning null');
    return null;
  }
  console.log('[Toast] rendering with msg:', msg);
  return (
    <div style={{
      position: 'fixed',
      bottom: 32,
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#2d8cff',
      color: '#fff',
      padding: '12px 28px',
      borderRadius: 10,
      fontWeight: 600,
      fontSize: 17,
      boxShadow: '0 2px 14px rgba(45,140,255,0.13)',
      zIndex: 3000,
      opacity: 0.96,
      pointerEvents: 'none',
      transition: 'opacity 0.3s',
    }}>
      {msg}
    </div>
  );
};
