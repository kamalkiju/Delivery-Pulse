// WorkspaceTopBarExtras — workspace label + shortcut to open sidebar switcher

import { ChevronDown } from "lucide-react";
import { colors, spacing, typography } from "../../styles/tokens";
import { WORKSPACE_SWITCHER_OPEN_EVENT } from "../../utils/workspace";

interface WorkspaceTopBarExtrasProps {
  displayName: string | null;
}

const WorkspaceTopBarExtras = ({ displayName }: WorkspaceTopBarExtrasProps) => {
  if (!displayName) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[3],
        marginLeft: spacing[4],
        flex: 1,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: typography.captionSm.size,
          fontWeight: 500,
          color: "rgba(255,255,255,0.75)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={displayName}
      >
        {displayName}
      </span>

      <button
        type="button"
        onClick={() =>
          window.dispatchEvent(new CustomEvent(WORKSPACE_SWITCHER_OPEN_EVENT))
        }
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: spacing[1],
          padding: `${spacing[1]} ${spacing[2]}`,
          borderRadius: "6px",
          border: "1px solid rgba(255,255,255,0.25)",
          backgroundColor: "rgba(255,255,255,0.08)",
          color: colors["text-on-dark"],
          fontSize: typography.captionSm.size,
          fontWeight: 600,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Switch
        <ChevronDown size={14} aria-hidden />
      </button>
    </div>
  );
};

export default WorkspaceTopBarExtras;
