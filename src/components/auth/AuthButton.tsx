import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type AuthButtonVariant = "primary" | "secondary" | "ghost" | "outline";

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AuthButtonVariant;
  fullWidth?: boolean;
  children: ReactNode;
}

const variantClass: Record<AuthButtonVariant, string> = {
  primary: "dp-btn dp-btn-primary",
  secondary: "dp-btn dp-btn-secondary",
  ghost: "dp-btn dp-btn-ghost",
  outline: "dp-btn dp-btn-outline",
};

export default function AuthButton({
  variant = "primary",
  fullWidth = false,
  className = "",
  style,
  children,
  ...props
}: AuthButtonProps) {
  const mergedStyle: CSSProperties = {
    width: fullWidth ? "100%" : undefined,
    ...style,
  };

  return (
    <button
      type="button"
      className={`${variantClass[variant]} dp-btn-auth ${className}`.trim()}
      style={mergedStyle}
      {...props}
    >
      {children}
    </button>
  );
}
