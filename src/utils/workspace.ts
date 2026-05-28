// workspace.ts — active Slack workspace persisted across the app

/** localStorage key for the workspace selected in the sidebar switcher */
export const ACTIVE_WORKSPACE_ID_KEY = "activeWorkspaceId";

/** Dispatched on window when user switches workspace in the sidebar */
export const WORKSPACE_CHANGED_EVENT = "workspace-changed";

/** Top bar "Switch" button asks the sidebar dropdown to open */
export const WORKSPACE_SWITCHER_OPEN_EVENT = "workspace-switcher-open";

export function getActiveWorkspaceId(): string | null {
  return localStorage.getItem(ACTIVE_WORKSPACE_ID_KEY);
}

/** Persist selection without notifying listeners (initial load / hydration) */
export function persistActiveWorkspaceId(workspaceId: string): void {
  localStorage.setItem(ACTIVE_WORKSPACE_ID_KEY, workspaceId);
}

/** User switched workspace — persist and notify all pages to refetch */
export function setActiveWorkspaceId(workspaceId: string): void {
  persistActiveWorkspaceId(workspaceId);
  window.dispatchEvent(
    new CustomEvent(WORKSPACE_CHANGED_EVENT, {
      detail: { workspaceId },
    }),
  );
}
