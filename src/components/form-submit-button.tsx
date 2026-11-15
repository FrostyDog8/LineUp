"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "default" | "secondary" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
};

export function FormSubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "default",
  size = "default",
  className,
}: Props) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
