import { useCallback, useEffect, useState } from "react";
import { getSlackWorkspaces } from "../api/slack.integration.api";
import {
  getActiveWorkspaceId,
  persistActiveWorkspaceId,
} from "../utils/workspace";
import { useWorkspaceChange } from "./useWorkspaceChange";

/** Active Slack workspace label for page headers (e.g. "TechSolutions Workspace") */
export function useActiveWorkspace() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(() =>
    getActiveWorkspaceId(),
  );
  const [displayName, setDisplayName] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const id = getActiveWorkspaceId();
    setWorkspaceId(id);

    try {
      const list = await getSlackWorkspaces();
      const active =
        list.find((w) => w.id === id) ?? list[0] ?? null;

      if (active && !id) {
        persistActiveWorkspaceId(active.id);
        setWorkspaceId(active.id);
      }

      setDisplayName(
        active ? `${active.teamName} Workspace` : null,
      );
    } catch {
      setDisplayName(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useWorkspaceChange(refresh);

  return { workspaceId, displayName };
}
