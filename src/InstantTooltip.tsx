import React from 'react';

interface InstantTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
}

// --- Character-specific addedToShopAtMap hook for tooltips (multi-item aware) ---
export function useCharacterAddedToShopAt(itemId: string, characterId: string | undefined): string | null {
  if (!characterId) return null;
  let stored: Record<string, Record<string, (string | null)[]>> = {};
  try {
    stored = JSON.parse(localStorage.getItem('addedToShopAtMap') || '{}');
  } catch {}
  const arr = stored[characterId]?.[itemId];
  // Return the latest timestamp if exists
  if (Array.isArray(arr) && arr.length > 0) {
    // Sort and return the most recent ISO string
    return arr.slice().sort().reverse()[0] || null;
  }
  return null;
}

export const InstantTooltip: React.FC<InstantTooltipProps> = ({ content, children }) => {
  const [visible, setVisible] = React.useState(false);
  const [coords, setCoords] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const ref = React.useRef<HTMLSpanElement>(null);

  function handleMouseMove(e: React.MouseEvent) {
    // Track cursor position for tooltip
    setCoords({ x: e.clientX + 12, y: e.clientY + 16 });
  }
  function handleMouseEnter(e: React.MouseEvent) {
    setVisible(true);
    setCoords({ x: e.clientX + 12, y: e.clientY + 16 });
  }
  function handleMouseLeave() {
    setVisible(false);
  }

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && (
        <div
          style={{
            position: 'fixed',
            left: coords.x,
            top: coords.y,
            zIndex: 9999,
            background: 'linear-gradient(135deg, #232a3f 70%, #1e222e 100%)',
            color: '#fff',
            padding: '13px 18px',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 500,
            boxShadow: '0 8px 32px #000b',
            pointerEvents: 'none',
            whiteSpace: 'pre-line',
            minWidth: 180,
            maxWidth: 420,
            border: '1.5px solid #2d8cff',
            lineHeight: 1.6,
          }}
        >
          {content}
        </div>
      )}
    </span>
  );
};
