"use client";

import { ContactRound, PanelsTopLeft, UserRound } from "lucide-react";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { ProfileExperienceBackground } from "./profile-experience-background";

const modes = [
  { value: "profile", label: "Your profile", icon: UserRound },
  { value: "contact", label: "Save contact", icon: ContactRound },
  { value: "links", label: "Share your work", icon: PanelsTopLeft },
] as const;
type Mode = (typeof modes)[number]["value"];

const W = 960;
const H = 510;
const notchWidth = 188;
const notchTop = 306;
const selectorGap = 12;
const outline: [string, ...number[]][] = [
  ["M", 22, 0], ["H", W - 72], ["L", W, 72], ["V", H - 22], ["Q", W, H, W - 22, H],
  ["H", notchWidth + 80], ["L", notchWidth, H - 48], ["V", notchTop + 22],
  ["Q", notchWidth, notchTop, notchWidth - 22, notchTop], ["H", 22],
  ["Q", 0, notchTop, 0, notchTop - 22], ["V", 22], ["Q", 0, 0, 22, 0],
];
// Converted to objectBoundingBox units so the clip scales with the plate.
const clipPath =
  outline
    .map(([cmd, ...n]) => cmd + n.map((v, i) => +(v / (cmd === "V" || (cmd !== "H" && i % 2) ? H : W)).toFixed(5)).join(" "))
    .join("") + "Z";

export function ProfileExperienceStage({ scenes }: { scenes: Record<Mode, ReactNode> }) {
  const [mode, setMode] = useState<Mode>("profile");
  const previewId = useId();
  const clipId = useId();
  return (
    <div className="pe-stage" data-mode={mode} style={{
      "--pe-clip": `url("#${clipId}")`,
      "--pe-selector-width": `${notchWidth - selectorGap}px`,
      "--pe-selector-top": `${notchTop + selectorGap}px`,
      "--pe-selector-left": `${selectorGap}px`,
    } as CSSProperties}>
      <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
        <clipPath id={clipId} clipPathUnits="objectBoundingBox">
          <path d={clipPath} />
        </clipPath>
      </svg>
      <div className="pe-selector" role="group" aria-label="Explore the Neffi experience">
        {modes.map(({ value, label, icon: Icon }) => (
          <button key={value} type="button" aria-pressed={mode === value} aria-controls={`${previewId}-${value}`} onFocus={() => setMode(value)} onClick={() => setMode(value)}>
            <Icon className="pe-selector-icon" size={16} strokeWidth={1.6} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="pe-surface">
        <ProfileExperienceBackground />
        <div className="pe-product">
          {modes.map(({ value, label }) => (
            <div key={value} id={`${previewId}-${value}`} className="pe-scene" data-active={mode === value} aria-hidden={mode !== value} inert={mode !== value} role="region" aria-label={label}>
              {scenes[value]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
