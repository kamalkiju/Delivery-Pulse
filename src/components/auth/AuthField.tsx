import type { InputHTMLAttributes, ReactNode } from "react";
import { colors, spacing, typography } from "../../styles/tokens";

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  rightSlot?: ReactNode;
}

export default function AuthField({
  label,
  error,
  rightSlot,
  id,
  className = "",
  ...inputProps
}: AuthFieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div style={{ marginBottom: spacing[5], width: "100%" }}>
      <label
        htmlFor={fieldId}
        style={{
          display: "block",
          fontSize: typography.labelMd.size,
          fontWeight: typography.labelMd.weight,
          color: colors["navy-auth"],
          marginBottom: spacing[2],
        }}
      >
        {label}
      </label>
      <div
        className={`dp-field-wrap ${error ? "dp-field-wrap--error" : ""}`}
      >
        <input
          id={fieldId}
          className={`dp-input ${className}`.trim()}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: typography.bodySm.size,
            color: colors["text-primary"],
            minWidth: 0,
          }}
          {...inputProps}
        />
        {rightSlot}
      </div>
      {error != null && error !== "" && (
        <p
          role="alert"
          style={{
            margin: `${spacing[2]} 0 0`,
            fontSize: typography.captionSm.size,
            color: colors.danger,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
