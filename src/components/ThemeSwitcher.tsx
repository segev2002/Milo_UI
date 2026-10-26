import type { CSSProperties, ReactNode } from "react";
import { LuMoon, LuSun } from "react-icons/lu";

export type Theme = "light" | "dark";

export const THEMES: Theme[] = ["light", "dark"];

const OPTIONS: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: "light", label: "בהיר", icon: <LuSun className="h-[18px] w-[18px]" /> },
  { value: "dark", label: "כהה", icon: <LuMoon className="h-[18px] w-[18px]" /> },
];

/**
 * Light / dark, as a liquid-glass pill that slides between the icons.
 * `data-i` names the chosen option, so the pill's stretch animation
 * (liquid-glass.css) has a new name, and replays, on every change.
 */
export function ThemeSwitcher({ value, onValueChange }: { value: Theme; onValueChange: (theme: Theme) => void }) {
  const index = OPTIONS.findIndex((o) => o.value === value);
  return (
    <fieldset className="switcher" data-i={index} style={{ "--i": index } as CSSProperties}>
      <legend className="sr-only">ערכת צבעים</legend>
      {OPTIONS.map((option) => (
        <label key={option.value} className="switcher__option" title={option.label}>
          <input
            className="switcher__input"
            type="radio"
            name="theme"
            value={option.value}
            checked={value === option.value}
            onChange={() => onValueChange(option.value)}
            aria-label={option.label}
          />
          {option.icon}
        </label>
      ))}
    </fieldset>
  );
}
