import { createContext } from "react";

export interface UISettings {
  round50k: boolean;
  showUnsold: boolean;
  setRound50k: (val: boolean) => void;
  setShowUnsold: (val: boolean) => void;
  compactMode: boolean;
  setCompactMode: (val: boolean) => void;
}

export const UISettingsContext = createContext<UISettings | null>(null);
