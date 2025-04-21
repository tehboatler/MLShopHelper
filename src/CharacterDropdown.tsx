import  { useState, useRef, useEffect } from "react";

interface Character {
  id: string;
  name: string;
}

interface CharacterDropdownProps {
  characters: Character[];
  selectedCharacterId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CharacterDropdown({ characters, selectedCharacterId, onSelect, onDelete }: CharacterDropdownProps) {
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

  const selected = characters.find(c => c.id === selectedCharacterId);

  return (
    <div className="dropdown" ref={ref} style={{ width: '100%' }}>
      <button
        className="dropdown-label"
        style={{ width: '100%', textAlign: 'left', fontSize: 15, background: '#191a1b', color: '#fff', border: '1px solid #333', borderRadius: 4, padding: '6px' }}
        onClick={() => setOpen((v) => !v)}
      >
        {selected ? selected.name : "Select character"} <span style={{ fontSize: 12, float: 'right' }}>▼</span>
      </button>
      {open && (
        <div className="dropdown-menu" style={{ width: '100%', marginTop: 2, background: '#242424', border: '1px solid #333', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.10)', zIndex: 999 }}>
          {characters.map((c) => (
            <div
              key={c.id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', cursor: 'pointer', color: '#fff', background: selectedCharacterId === c.id ? '#2d8cff33' : 'transparent', borderRadius: 6 }}
              onClick={() => { onSelect(c.id); setOpen(false); }}
            >
              <span style={{ flex: 1 }}>{c.name}</span>
              <button
                onClick={e => {
                  e.stopPropagation();
                  if (characters.length === 1) return;
                  if (window.confirm(`Delete character '${c.name}'? This cannot be undone.`)) {
                    onDelete(c.id);
                    setOpen(false);
                  }
                }}
                style={{ background: '#e74c3c', border: 'none', color: '#fff', borderRadius: 6, padding: '2px 10px', fontWeight: 600, fontSize: 13, cursor: characters.length === 1 ? 'not-allowed' : 'pointer', marginLeft: 8 }}
                title="Delete character"
                aria-label={`Delete character ${c.name}`}
                disabled={characters.length === 1}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
