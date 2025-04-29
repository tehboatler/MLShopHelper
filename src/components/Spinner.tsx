import React from 'react';

export const Spinner: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <div
    style={{
      display: 'inline-block',
      width: size,
      height: size,
      border: `${size * 0.13}px solid #e0c080`,
      borderTop: `${size * 0.13}px solid #a86e2f`,
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }}
  />
);

// Add this to your global CSS (App.css or index.css):
// @keyframes spin {
//   0% { transform: rotate(0deg); }
//   100% { transform: rotate(360deg); }
// }
