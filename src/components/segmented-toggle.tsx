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
};

/** Two-option toggle that posts via a hidden input (Open / Approval, one-time / recurring). */
export function SegmentedToggle({
  name,
  options,
  defaultValue,
  ariaLabel,
}: Props) {
  const initial =
    options.find((o) => o.value === defaultValue)?.value ?? options[0].value;
  const [value, setValue] = useState(initial);

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
            onClick={() => setValue(opt.value)}
            className={
              selected
                ? "rounded-md bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm"
                : "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
