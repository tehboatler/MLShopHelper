import { useState } from "react";

// interface InventorySection {
//   id: string;
//   name: string;
//   itemIds: number[];
// }

interface SectionHeaderProps {
  name: string;
  onRename: (name: string) => void;
  onDelete: () => void;
  provided: any;
  snapshot: any;
}

export function SectionHeader({ name, onRename, onDelete, provided, snapshot }: SectionHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 0 4px 0',
        fontWeight: 700,
        fontSize: 16,
        color: '#fff',
        background: snapshot.isDragging ? '#2d8cff22' : 'transparent',
        borderBottom: '1.5px solid #2d8cff',
        cursor: 'grab',
        userSelect: 'none',
        ...provided.draggableProps.style,
      }}
    >
      {editing ? (
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={() => { setEditing(false); onRename(value); }}
          onKeyDown={e => {
            if (e.key === 'Enter') { setEditing(false); onRename(value); }
            if (e.key === 'Escape') { setEditing(false); setValue(name); }
          }}
          style={{ fontWeight: 700, fontSize: 16, flex: 1, border: 'none', background: 'transparent', color: '#fff' }}
          autoFocus
        />
      ) : (
        <span style={{ flex: 1 }} onDoubleClick={() => setEditing(true)}>{name}</span>
      )}
      <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', color: '#2d8cff', fontSize: 16, cursor: 'pointer' }}>✎</button>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', color: '#f55', fontSize: 16, cursor: 'pointer' }}>🗑</button>
    </div>
  );
}
