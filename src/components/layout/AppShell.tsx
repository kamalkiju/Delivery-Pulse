import React from "react";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import WorkspaceTopBarExtras from "./WorkspaceTopBarExtras";
import { useActiveWorkspace } from "../../hooks/useActiveWorkspace";
import { colors } from "../../styles/tokens";

interface AppShellProps {
  children: React.ReactNode;
  pageTitle: string;
  /** Show active workspace name + switch shortcut in the top bar */
  showWorkspaceContext?: boolean;
}

const AppShell = ({
  children,
  pageTitle,
  showWorkspaceContext = false,
}: AppShellProps) => {
  const { displayName } = useActiveWorkspace();

  return (
    // Return the full app layout structure.
    <div
      // Root wrapper that holds sidebar + right content area.
      style={{
        display: "flex", // Place left and right sections side by side.
        height: "100vh", // Make the shell exactly the full browser viewport height.
      }}
    >
      <Sidebar /> {/* Left: fixed 80px sidebar component. */}
      <div
        // Right area sits next to the fixed sidebar.
        style={{
          marginLeft: "80px", // Reserve space so content starts after the fixed sidebar.
          flex: 1, // Let the right area take all remaining horizontal space.
          display: "flex", // Use flex to stack topnav + content vertically.
          flexDirection: "column", // Arrange topnav on top, main content below.
          minWidth: 0, // Prevent overflow issues in flexible layouts.
        }}
      >
        <TopNav
          title={pageTitle}
          centerSlot={
            showWorkspaceContext ? (
              <WorkspaceTopBarExtras displayName={displayName} />
            ) : undefined
          }
        />
        <main
          // Main content area under the top navigation.
          style={{
            flex: 1, // Fill remaining vertical space below the topnav.
            backgroundColor: colors.canvas,
            padding: "24px", // Add 24px spacing around all page content.
            overflowY: "auto", // Enable vertical scrolling when content is taller than the view.
            boxSizing: "border-box", // Keep padding inside the element's size calculations.
          }}
        >
          {children} {/* Render whichever page content is wrapped by AppShell. */}
        </main>
      </div>
    </div>
  );
};

export default AppShell; // Export AppShell so other files can use this layout wrapper.
