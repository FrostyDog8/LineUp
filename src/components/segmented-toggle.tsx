"use client";

import { useState } from "react";

export type SegmentedOption = {
  value: string;
  label: string;
};

type Props = {
  name: string;
  options: [SegmentedOption, SegmentedOption];
  defaultValue: string;
  ariaLabel: string;
  onValueChange?: (value: string) => void;
  size?: "default" | "sm";
};

/** Two-option toggle that posts via a hidden input (Open / Approval, one-time / recurring). */
export function SegmentedToggle({
  name,
  options,
  defaultValue,
  ariaLabel,
  onValueChange,
  size = "default",
}: Props) {
  const initial =
    options.find((o) => o.value === defaultValue)?.value ?? options[0].value;
  const [value, setValue] = useState(initial);
  const pad = size === "sm" ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/50 p-1"
    >
      <input type="hidden" name={name} value={value} />
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              setValue(opt.value);
              onValueChange?.(opt.value);
            }}
            className={
              selected
                ? `rounded-md bg-card ${pad} font-medium whitespace-nowrap text-foreground shadow-sm`
                : `rounded-md ${pad} font-medium whitespace-nowrap text-muted-foreground hover:text-foreground`
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
