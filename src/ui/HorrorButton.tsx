import type { ButtonHTMLAttributes, ReactNode } from "react";

export function HorrorButton({
  children,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button className={`hbtn hbtn-${variant}`} type="button" {...props}>
      {children}
    </button>
  );
}
