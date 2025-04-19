import React, { useState, useRef, useEffect } from "react";

const EQUIPMENTS: string[] = [
  "Claw", "Staff", "Wand", "Knuckle", "Shoes", "Topwear", "Bottomwear", "Overall", "Helmet", "Shield", "Gloves", "Cape", "Face Accessory", "Eye Accessory", "Pet Equip."
];
const STATS: string[] = [
  "Weapon ATT", "ATT", "Magic Att.", "LUK", "DEX", "STR", "INT", "Jump", "Speed"
];
const PERCENTAGES: string[] = ["10%", "30%", "50%", "60%", "70%", "100%"];

function normalize(str: string) {
  return str.replace(/\s+/g, ' ').trim().toLowerCase();
}

function fuzzyIncludes(hay: string, needle: string) {
  return normalize(hay).includes(normalize(needle));
}

function anyFuzzyMatch(parts: string[], target: string) {
  return parts.every(part => fuzzyIncludes(target, part));
}

function generateFuzzySuggestions(input: string): string[] {
  const suggestions: string[] = [];
  const inputNorm = normalize(input);
  if (!inputNorm) return suggestions;
  const parts = inputNorm.split(' ').filter(Boolean);

  // Expand abbreviations for equipment
  const equipMap: Record<string, string> = {
    "eye acc": "Eye Accessory",
    "eye": "Eye Accessory",
    "face acc": "Face Accessory",
    "face": "Face Accessory",
    "pet": "Pet Equip.",
    "top": "Topwear",
    "bottom": "Bottomwear",
    "overall": "Overall",
    "helm": "Helmet",
    "glove": "Gloves",
    "cape": "Cape",
    "claw": "Claw",
    "staff": "Staff",
    "wand": "Wand",
    "knuckle": "Knuckle",
    "shoes": "Shoes",
    "shield": "Shield",
  };
  const allEquips = [...EQUIPMENTS];
  Object.entries(equipMap).forEach(([abbr, full]) => {
    if (!allEquips.includes(full)) allEquips.push(full);
  });

  // Determine if input is likely for dark scrolls or regular scrolls
  const wantsDark = parts.some(p => p === "dark");
  const wants30 = parts.some(p => p === "30" || p === "30%" || p === "30pct");
  const wants70 = parts.some(p => p === "70" || p === "70%" || p === "70pct");
  const wantsOtherPercent = parts.some(p => ["10", "10%", "50", "50%", "60", "60%", "100", "100%"].includes(p));

  // Only allow valid scroll/percent combinations
  let scrollCombos: { prefix: string; percents: string[] }[] = [];
  if (wantsDark || wants30 || wants70) {
    // Only allow "Dark Scroll" for 30% or 70%
    scrollCombos.push({ prefix: "Dark ", percents: ["30%", "70%"] });
  }
  if (!wantsDark && !wants30 && !wants70) {
    // Only allow regular scrolls for other percentages
    scrollCombos.push({ prefix: "", percents: ["10%", "50%", "60%", "100%"] });
  } else if (!wantsDark && wantsOtherPercent) {
    // If user typed e.g. "10", only regular scrolls
    scrollCombos.push({ prefix: "", percents: ["10%", "50%", "60%", "100%"] });
  }

  // If nothing matches, show both (fallback)
  if (scrollCombos.length === 0) {
    scrollCombos = [
      { prefix: "Dark ", percents: ["30%", "70%"] },
      { prefix: "", percents: ["10%", "50%", "60%", "100%"] }
    ];
  }

  scrollCombos.forEach(({ prefix, percents }) => {
    allEquips.forEach(equip => {
      STATS.forEach(stat => {
        percents.forEach(percent => {
          const suggestion = `${prefix}Scroll for ${equip} for ${stat} ${percent}`;
          // Match against input fragments
          const expandedParts = parts.map(part => equipMap[part] || part);
          if (anyFuzzyMatch(expandedParts, suggestion)) {
            suggestions.push(suggestion);
          }
        });
      });
    });
  });

  // Also add suggestions for incomplete patterns
  if ("dark scroll for".startsWith(inputNorm)) suggestions.push("Dark Scroll for ...");
  if ("scroll for".startsWith(inputNorm)) suggestions.push("Scroll for ...");

  // Deduplicate and limit
  return Array.from(new Set(suggestions)).slice(0, 15);
}

export interface ItemNameAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  existingItems?: string[];
  style?: React.CSSProperties;
}

export function ItemNameAutocomplete({ value, onChange, placeholder, required, autoFocus, existingItems = [], style }: ItemNameAutocompleteProps) {
  const [show, setShow] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value) {
      const suggs = generateFuzzySuggestions(value).filter(s => s !== value);
      setSuggestions(suggs);
      setShow(suggs.length > 0);
    } else {
      setSuggestions([]);
      setShow(false);
    }
    setHighlight(0);
  }, [value]);

  function isExisting(s: string) {
    return existingItems.some(item => item.trim().toLowerCase() === s.trim().toLowerCase());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!show) return;
    if (e.key === "ArrowDown") {
      setHighlight(h => Math.min(h + 1, suggestions.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setHighlight(h => Math.max(h - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter") {
      if (suggestions[highlight]) {
        onChange(suggestions[highlight]);
        setShow(false);
        e.preventDefault();
      }
    } else if (e.key === "Escape") {
      setShow(false);
    }
  }

  return (
    <div style={{ position: "relative", width: "100%", ...style }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setShow(suggestions.length > 0)}
        onBlur={() => setTimeout(() => setShow(false), 100)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        style={{ width: "100%", boxSizing: "border-box" }}
      />
      {show && suggestions.length > 0 && (
        <div style={{
          position: "absolute", left: 0, right: 0, top: "100%", zIndex: 1000, background: "#232323", border: "1px solid #333", borderRadius: 8, boxShadow: "0 2px 8px #0002"
        }}>
          {suggestions.map((s, i) => (
            <div
              key={s}
              style={{
                padding: "8px 14px",
                background: i === highlight ? (isExisting(s) ? "#2d8cff" : "#2d8cff44") : "#232323",
                color: isExisting(s) ? "#fff" : (i === highlight ? "#fff" : "#ccc"),
                cursor: "pointer"
              }}
              onMouseDown={e => { e.preventDefault(); onChange(s); setShow(false); }}
              onMouseEnter={() => setHighlight(i)}
            >
              {s} {isExisting(s) && <span style={{ fontSize: 12, color: "#b5d7ff", marginLeft: 6 }}>(already exists)</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
