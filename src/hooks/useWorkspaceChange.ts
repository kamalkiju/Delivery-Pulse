import { useEffect } from "react";
import { WORKSPACE_CHANGED_EVENT } from "../utils/workspace";

/** Re-run callback when sidebar workspace switcher changes active workspace */
export function useWorkspaceChange(onChange: () => void) {
  useEffect(() => {
    const handler = () => onChange();
    window.addEventListener(WORKSPACE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(WORKSPACE_CHANGED_EVENT, handler);
  }, [onChange]);
}
