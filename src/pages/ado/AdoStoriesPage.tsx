// AdoStoriesPage — renders the ADO Stories kanban board — lets BAs triage stories quickly
// Every line is commented — so a UI/UX designer can learn TypeScript + React by reading it

import { useMemo, useState } from "react"; // useState stores UI state (selected card + panel open) — useMemo derives board columns efficiently
import { X } from "lucide-react"; // X icon for the right-side detail panel close button — matches existing icon style
import AppShell from "../../components/layout/AppShell"; // AppShell provides Sidebar + TopNav + canvas background — keeps page consistent
import TicketId from "../../components/ui/TicketId"; // TicketId renders the DP-### id in Geist Mono 11px — matches DeliveryPulse token usage
import StatusBadge from "../../components/ui/StatusBadge"; // StatusBadge is our reusable pill badge — used in the details panel
import { borderRadius, colors, spacing, typography } from "../../styles/tokens"; // Design tokens — ensures all colors/spacing are consistent

// StoryType — the work item type shown as a colored badge — matches Figma board badges
type StoryType = "Bug" | "Story" | "Task" | "Feature"; // Union keeps values constrained — prevents typos like "bug" vs "Bug"

// ColumnId — the four kanban buckets in the Figma frame — drives layout and filtering
type ColumnId = "todo" | "in-progress" | "in-review" | "done"; // Stable ids for data and UI — safer than using display text

// Story — one card on the board — minimal fields to match the Figma content
interface Story {
  id: string; // Unique internal id — used for selection and React keys
  ticketId: string; // Display id like DP-445 — shown in the card header
  type: StoryType; // Work item type badge — Bug/Story/Task/Feature
  priority: "Critical" | "High" | "Medium" | "Low"; // Priority badge — matches the Figma label set
  title: string; // Card title — 13px medium (per requirements) / shown prominently
  client: string; // Client pill chip on the meta row — e.g. TechCorp
  sprint: string; // Sprint meta — e.g. Sprint 14
  dateLabel: string; // Date meta — e.g. 22 May
  progressPct?: number; // Optional % used only on “In Progress” cards — renders the orange progress line
  doneLabel?: string; // Optional “Completed …” line used in Done column — matches Figma
  isAiGenerated?: boolean; // Optional badge in details panel — mapped to the purple badge rule
  columnId: ColumnId; // Which kanban column the story belongs to — drives grouping
}

// Column — one kanban column container — header + cards list
interface Column {
  id: ColumnId; // Stable identifier — used for grouping and rendering
  title: string; // Display label — “To Do”, “In Progress”, “In Review”, “Done”
  accentColor: string; // Header background color — matches Figma (blue/orange/purple/green)
}

// BADGE COLORS — map exactly per your rules — some colors are not in tokens so we keep them as constants
const badgeColorsByType: Record<StoryType, { bg: string; fg: string }> = {
  Bug: { bg: "#fee2e2", fg: "#991b1b" }, // Bug badge — red tint + dark red text
  Story: { bg: "#dbeafe", fg: "#1e40af" }, // Story badge — blue tint + navy text
  Task: { bg: "#fef3c7", fg: "#92400e" }, // Task badge — amber tint + brown text
  Feature: { bg: "#d1fae5", fg: "#15803d" }, // Feature badge — green tint + dark green text
}; // End badge colors map — used by the pill badge component

// AI badge colors — mapped exactly per your rules — shown in the detail panel as a tag
const aiBadgeColors = { bg: "#ede9fe", fg: "#5b21b6" }; // Purple tint + purple text — signals AI origin

// COLUMNS — four headers matching the Figma frame — including distinct accent colors
const columns: Column[] = [
  { id: "todo", title: "To Do", accentColor: colors["brand-blue"] }, // Blue header — matches #0088ff
  { id: "in-progress", title: "In Progress", accentColor: "#f59e0b" }, // Orange header — Figma uses amber/orange
  { id: "in-review", title: "In Review", accentColor: "#a855f7" }, // Purple header — Figma uses a vivid purple
  { id: "done", title: "Done", accentColor: colors["success-dark"] }, // Green header — matches success-dark
]; // End columns list — used to render the grid

// STORIES — sample board data matching what appears in the Figma screenshot for node 3:55
const initialStories: Story[] = [
  {
    id: "s-445", // Internal id for React keys and selection
    ticketId: "DP-445", // Figma card shows DP-445
    type: "Bug", // Figma badge shows Bug
    priority: "Critical", // Priority badge in top row
    title: "Dashboard chart API 500 error", // Card title text
    client: "TechCorp", // Meta chip on the card
    sprint: "Sprint 14", // Meta text
    dateLabel: "22 May", // Meta text
    columnId: "todo", // Placed under “To Do”
    isAiGenerated: true, // Helpful for the detail panel badge
  },
  {
    id: "s-446",
    ticketId: "DP-446",
    type: "Story",
    priority: "Medium",
    title: "Export to PDF from reports",
    client: "Northwind",
    sprint: "Sprint 14",
    dateLabel: "22 May",
    columnId: "todo",
  },
  {
    id: "s-447",
    ticketId: "DP-447",
    type: "Feature",
    priority: "Low",
    title: "Mobile dashboard view",
    client: "Acme",
    sprint: "Sprint 14",
    dateLabel: "22 May",
    columnId: "todo",
  },
  {
    id: "s-448",
    ticketId: "DP-448",
    type: "Story",
    priority: "Low",
    title: "Onboarding checklist",
    client: "Globex",
    sprint: "Sprint 14",
    dateLabel: "22 May",
    columnId: "todo",
  },
  {
    id: "s-449",
    ticketId: "DP-449",
    type: "Bug",
    priority: "High",
    title: "Login SSO integration",
    client: "TechCorp",
    sprint: "Sprint 14",
    dateLabel: "22 May",
    progressPct: 65, // Matches Figma “65%” under the orange progress line
    columnId: "in-progress",
  },
  {
    id: "s-450",
    ticketId: "DP-450",
    type: "Story",
    priority: "Medium",
    title: "User role management",
    client: "Northwind",
    sprint: "Sprint 14",
    dateLabel: "22 May",
    progressPct: 55, // Matches Figma “55%”
    columnId: "in-progress",
  },
  {
    id: "s-451",
    ticketId: "DP-451",
    type: "Feature",
    priority: "Low",
    title: "Mobile settings screen",
    client: "Acme",
    sprint: "Sprint 14",
    dateLabel: "22 May",
    progressPct: 80, // Matches Figma “80%”
    columnId: "in-progress",
  },
  {
    id: "s-452",
    ticketId: "DP-452",
    type: "Bug",
    priority: "High",
    title: "Password reset OTP flow",
    client: "TechCorp",
    sprint: "Sprint 14",
    dateLabel: "22 May",
    columnId: "in-review",
  },
  {
    id: "s-453",
    ticketId: "DP-453",
    type: "Story",
    priority: "Medium",
    title: "Client portal permissions",
    client: "Northwind",
    sprint: "Sprint 14",
    dateLabel: "22 May",
    columnId: "in-review",
  },
  {
    id: "s-430",
    ticketId: "DP-430",
    type: "Story",
    priority: "Medium",
    title: "Dashboard layout redesign",
    client: "TechCorp",
    sprint: "Sprint 13",
    dateLabel: "20 May",
    doneLabel: "Completed 20 May", // Done column shows a completion line
    columnId: "done",
  },
  {
    id: "s-432",
    ticketId: "DP-432",
    type: "Bug",
    priority: "High",
    title: "API timeout fix",
    client: "Northwind",
    sprint: "Sprint 13",
    dateLabel: "19 May",
    doneLabel: "Completed 19 May",
    columnId: "done",
  },
  {
    id: "s-431",
    ticketId: "DP-431",
    type: "Story",
    priority: "Medium",
    title: "Client onboarding flow",
    client: "Acme",
    sprint: "Sprint 13",
    dateLabel: "18 May",
    doneLabel: "Completed 18 May",
    columnId: "done",
  },
  {
    id: "s-429",
    ticketId: "DP-429",
    type: "Story",
    priority: "Low",
    title: "Search filters",
    client: "Globex",
    sprint: "Sprint 13",
    dateLabel: "17 May",
    doneLabel: "Completed 17 May",
    columnId: "done",
  },
  {
    id: "s-428",
    ticketId: "DP-428",
    type: "Story",
    priority: "Medium",
    title: "Report export CSV",
    client: "Acme",
    sprint: "Sprint 13",
    dateLabel: "16 May",
    doneLabel: "Completed 16 May",
    columnId: "done",
  },
]; // End initial stories array — used to render cards per column

export default function AdoStoriesPage() {
  // selectedStoryId — stores which story card was clicked — drives the detail panel content
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null); // null means no selection — panel stays empty/closed
  // isDetailOpen — controls the right-side detail panel visibility — required by spec
  const [isDetailOpen, setIsDetailOpen] = useState(false); // false by default — panel hidden until a card is clicked

  // selectedStory — derived from selectedStoryId — so we can show details without duplicating story state
  const selectedStory = useMemo(
    () => initialStories.find((s) => s.id === selectedStoryId) ?? null, // Find story or return null — avoids undefined checks elsewhere
    [selectedStoryId], // Recompute only when selection changes — efficient and predictable
  ); // End useMemo — selectedStory is stable between renders unless id changes

  // groupedStories — compute the board columns and their story lists — simplifies rendering logic
  const groupedStories = useMemo(() => {
    return columns.map((col) => ({
      column: col, // Keep column metadata with the group — header styling needs it
      stories: initialStories.filter((s) => s.columnId === col.id), // Filter stories into this column — kanban layout
    })); // End map — returns 4 groups
  }, []); // Empty dependency array — initialStories + columns are constants in this file

  // handleCardClick — opens the detail panel and sets selectedStoryId — used by every card
  const handleCardClick = (storyId: string) => {
    setSelectedStoryId(storyId); // Store the clicked story id — so detail panel knows what to display
    setIsDetailOpen(true); // Open the panel — matches “card click opens a 480px side panel”
  }; // End click handler — keeps card component simple

  // handleClosePanel — closes the panel and clears selection — used by overlay and X button
  const handleClosePanel = () => {
    setIsDetailOpen(false); // Hide the panel — removes it from view
    setSelectedStoryId(null); // Clear selection — prevents stale details if reopened later
  }; // End close handler — centralizes close logic

  return (
    <AppShell pageTitle="ADO Stories">
      {/* Main board wrapper — matches canvas background and internal padding from Figma frame */}
      <div
        style={{
          backgroundColor: colors.canvas, // Canvas gray — maps #f1f5f9 to token canvas
          padding: "32px", // Figma frame uses 32px inner padding — keeps board away from edges
          display: "flex", // Use flex to stack toolbar and board vertically
          flexDirection: "column", // Toolbar on top, columns below
          gap: spacing[6], // 24px gap between toolbar and board — maps to Figma gap-24
          minHeight: "100%", // Ensure full-height background under content
          boxSizing: "border-box", // Keep padding included in sizing — prevents overflow surprises
        }}
      >
        {/* Top toolbar — filter dropdowns + right-side action buttons */}
        <div
          style={{
            display: "flex", // Horizontal layout: filters on the left, buttons on the right
            alignItems: "center", // Vertically center items
            justifyContent: "space-between", // Push left and right groups apart
            width: "100%", // Fill the available width from AppShell main
            gap: spacing[4], // Space between groups when wrapping
            flexWrap: "wrap", // Allow wrap on small screens — prevents overflow
          }}
        >
          {/* Left: filter “dropdowns” (static buttons to match frame) */}
          <div
            style={{
              display: "flex", // Keep filter buttons inline
              alignItems: "center", // Vertically align text + chevrons
              gap: spacing[3], // 12px gap — matches the Figma toolbar spacing
              flexWrap: "wrap", // Wrap if viewport is narrow — better than horizontal scroll
            }}
          >
            <ToolbarDropdown label="Sprint: Current" /> {/* Sprint filter button — matches Figma */}
            <ToolbarDropdown label="All Types" /> {/* Types filter button — matches Figma */}
            <ToolbarDropdown label="All Sources" /> {/* Sources filter button — matches Figma */}
          </div>

          {/* Right: action buttons */}
          <div
            style={{
              display: "flex", // Keep buttons in a row
              alignItems: "center", // Vertically align button text
              gap: spacing[3], // 12px gap between buttons — matches Figma
            }}
          >
            <button
              type="button" // Prevent form submit behavior — this is a UI button
              style={syncButtonStyle} // Blue outline style — matches “Sync ADO” in the frame
            >
              Sync ADO
            </button>
            <button
              type="button" // Prevent form submit behavior — this is a UI button
              style={newButtonStyle} // Solid brand-blue with white text — matches “New +”
            >
              New +
            </button>
          </div>
        </div>

        {/* Kanban board — 4 columns with a 16px gap between them */}
        <div
          style={{
            display: "grid", // Grid is ideal for equal-width columns
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))", // Exactly 4 columns — each can shrink without overflow
            gap: spacing[4], // 16px column gap — matches spec “Column gap = 16px”
            width: "100%", // Board spans the toolbar width
            alignItems: "start", // Columns align to the top — like Figma
          }}
        >
          {groupedStories.map(({ column, stories }) => (
            <KanbanColumn
              key={column.id} // React key from stable column id — avoids re-mounts
              column={column} // Column metadata — header styles and title
              stories={stories} // Stories in this column — list of cards
              onCardClick={handleCardClick} // Click handler for cards — opens detail panel
            />
          ))}
        </div>
      </div>

      {/* Overlay — dims the canvas behind the detail panel — clicking it closes the panel */}
      {isDetailOpen && (
        <div
          role="presentation" // This element is for visuals + click-to-close — not semantic content
          onClick={handleClosePanel} // Clicking outside the panel closes it — common UX pattern
          style={{
            position: "fixed", // Fixed to the viewport — so it covers everything
            inset: 0, // Top/left/right/bottom = 0 — full-screen overlay
            backgroundColor: "rgba(15, 23, 42, 0.35)", // Dark translucent overlay — consistent with other panels
            zIndex: 200, // Layer above AppShell but below the panel — keeps interactions correct
          }}
        />
      )}

      {/* Detail panel — 480px fixed drawer from the right — opens when a story is clicked */}
      {isDetailOpen && selectedStory && (
        <aside
          style={{
            position: "fixed", // Fixed drawer — stays in place while board scrolls
            top: 0, // Align to top of viewport
            right: 0, // Slide from the right edge
            width: "480px", // Exact width per spec — 480px
            height: "100vh", // Full viewport height — matches requirement
            backgroundColor: colors["surface-card"], // White surface — matches surface-card
            borderLeft: `1px solid ${colors["border-default"]}`, // Border token — matches #e2e8f0
            boxShadow: "-8px 0 24px rgba(0,0,0,0.12)", // Soft shadow — separates panel from board
            zIndex: 201, // Above overlay — ensures panel is clickable
            display: "flex", // Flex to create header/body layout
            flexDirection: "column", // Header on top, content below
          }}
        >
          {/* Panel header — title + close button */}
          <div
            style={{
              display: "flex", // Put title and close button in one row
              alignItems: "center", // Vertically center items in the header
              justifyContent: "space-between", // Title left, X right
              padding: spacing[5], // 20px padding — aligns with other panels in the app
              borderBottom: `1px solid ${colors["border-default"]}`, // Divider line — matches token
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "24px", // Page title size per spec — 24px
                  fontWeight: 700, // Bold per spec — “24px Bold”
                  color: colors["text-primary"], // Primary text token — matches #1e293b
                  lineHeight: 1.2, // Tight title leading — keeps header compact
                }}
              >
                {selectedStory.title}
              </div>
              <div
                style={{
                  marginTop: spacing[2], // Small spacing under title — improves hierarchy
                  display: "flex", // Inline chips and ids
                  gap: spacing[2], // 8px gap — matches chip spacing
                  alignItems: "center", // Vertical alignment for chips
                  flexWrap: "wrap", // Wrap on narrow widths
                }}
              >
                <TicketId id={selectedStory.ticketId} /> {/* Ticket id chip — uses existing component */}
                <PillBadge label={selectedStory.type} colors={badgeColorsByType[selectedStory.type]} /> {/* Type badge — mapped colors */}
                <PillBadge label={selectedStory.priority} colors={priorityBadgeColors(selectedStory.priority)} /> {/* Priority badge */}
                {selectedStory.isAiGenerated && (
                  <PillBadge label="AI Generated" colors={aiBadgeColors} /> // AI badge — mapped purple colors
                )}
              </div>
            </div>
            <button
              type="button" // This button closes the panel — not a form submit
              onClick={handleClosePanel} // Click closes and clears selection — consistent behavior
              aria-label="Close details" // Accessible label for screen readers
              style={iconButtonStyle} // Minimal icon button styling
            >
              <X size={20} color={colors["text-secondary"]} /> {/* X icon — matches other drawers */}
            </button>
          </div>

          {/* Panel body — simple “details” content to keep it working and useful */}
          <div
            style={{
              padding: spacing[5], // Internal padding — readable spacing
              overflowY: "auto", // Scroll if content is taller than viewport
              display: "flex", // Stack sections
              flexDirection: "column", // Vertical sections
              gap: spacing[4], // Consistent separation between sections
            }}
          >
            {/* Summary section — mirrors metadata shown on the card */}
            <div
              style={{
                border: `1px solid ${colors["border-default"]}`, // Card border — matches token
                borderRadius: borderRadius.md, // 8px radius — matches spec “Card border radius = 8px”
                padding: spacing[4], // 16px padding — comfortable inside panel
                backgroundColor: colors["surface-subtle"], // Subtle surface — echoes Figma chips background
              }}
            >
              <div
                style={{
                  fontSize: typography.tableHeader.size, // 11px — table header size token
                  fontWeight: typography.tableHeader.weight, // 600 — “SemiBold”
                  color: colors["text-tertiary"], // Tertiary gray — matches spec
                  textTransform: "uppercase", // Uppercase headers — matches spec
                  marginBottom: spacing[2], // Space under header label
                }}
              >
                Story details
              </div>
              <div
                style={{
                  fontSize: typography.bodySm.size, // 14px body text — matches spec
                  fontWeight: typography.bodySm.weight, // Regular weight — matches spec
                  color: colors["text-secondary"], // Secondary text for descriptive content
                  lineHeight: 1.5, // Comfortable reading line-height
                }}
              >
                Client: <strong style={{ color: colors["text-primary"] }}>{selectedStory.client}</strong> {/* Client name */}
                {" · "} {/* Visual separator — matches “·” usage in Figma meta */}
                {selectedStory.sprint} {/* Sprint label */}
                {" · "} {/* Separator */}
                {selectedStory.dateLabel} {/* Date label */}
              </div>
              <div style={{ marginTop: spacing[3] }}>
                <StatusBadge variant="info" label="Linked to ADO (mock)" /> {/* Uses existing StatusBadge component */}
              </div>
            </div>

            {/* Notes section — placeholder copy so the panel feels complete */}
            <div>
              <div
                style={{
                  fontSize: typography.tableHeader.size, // 11px label size — consistent headings
                  fontWeight: typography.tableHeader.weight, // SemiBold — matches header style
                  color: colors["text-tertiary"], // Tertiary — subtle but readable
                  textTransform: "uppercase", // Uppercase label — matches spec
                  marginBottom: spacing[2], // Space before text
                }}
              >
                Notes
              </div>
              <div
                style={{
                  fontSize: typography.bodySm.size, // 14px body — spec
                  fontWeight: typography.bodySm.weight, // Regular — spec
                  color: colors["text-secondary"], // Secondary text — not as strong as titles
                  lineHeight: 1.5, // Readable paragraph spacing
                }}
              >
                Click cards to preview details and prepare a clean story before syncing to Azure DevOps.
              </div>
            </div>
          </div>
        </aside>
      )}
    </AppShell>
  );
} // End AdoStoriesPage — exported as default for routing

// KanbanColumn — renders one column (header + scrollable list of story cards)
function KanbanColumn({
  column,
  stories,
  onCardClick,
}: {
  column: Column; // Column metadata — title + accent color
  stories: Story[]; // Stories for this column — cards list
  onCardClick: (id: string) => void; // Click handler passed from parent — opens details
}) {
  return (
    <div
      style={{
        display: "flex", // Column is a vertical stack: header then cards
        flexDirection: "column", // Stack header above cards
        gap: "12px", // Spacing between header and list — close to the Figma look
        minWidth: 0, // Allow the column to shrink — prevents overflow in grid
      }}
    >
      {/* Column header — colored background and count pill */}
      <div
        style={{
          backgroundColor: column.accentColor, // Column accent background — matches the frame
          borderRadius: "12px", // Figma column header is more rounded — keeps it visually consistent
          padding: "10px 12px", // Balanced padding — matches Figma header height
          display: "flex", // Title + controls in one row
          alignItems: "center", // Center vertically
          justifyContent: "space-between", // Title on left, count on right
          boxSizing: "border-box", // Include padding in size calculations
        }}
      >
        <div
          style={{
            fontSize: typography.bodySm.size, // 14px label — matches Figma column title
            fontWeight: 700, // Bold column title — matches the frame
            color: colors["text-on-dark"], // White text on colored header
            whiteSpace: "nowrap", // Keep title on one line
          }}
        >
          {column.title}
        </div>
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.16)", // Semi-transparent pill — matches Figma count chip feel
            borderRadius: "12px", // Rounded chip — visually matches the header styling
            height: 24, // Fixed height — consistent chip size
            minWidth: 24, // Minimum width so “0” still looks like a chip
            padding: "0 8px", // Horizontal padding — fits 1–2 digits well
            display: "flex", // Center number
            alignItems: "center", // Center vertically
            justifyContent: "center", // Center horizontally
            color: colors["text-on-dark"], // White number on tinted chip
            fontSize: typography.captionSm.size, // Badge size per spec — “Badges = 12px SemiBold”
            fontWeight: 700, // SemiBold-ish — matches Figma chip number weight
          }}
        >
          {stories.length}
        </div>
      </div>

      {/* Cards list — scrollable if it grows — matches “scrollable story cards” requirement */}
      <div
        style={{
          display: "flex", // List is a vertical stack of cards
          flexDirection: "column", // Stack cards top-to-bottom
          gap: "10px", // Gap between cards — similar to Figma
          overflowY: "auto", // Column becomes scrollable when many cards exist
          maxHeight: "calc(100vh - 220px)", // Keep within viewport under toolbar — avoids page-level overflow
          paddingRight: "4px", // Small padding so scrollbar doesn’t overlap card shadows
        }}
      >
        {stories.map((story) => (
          <StoryCard
            key={story.id} // Stable React key — prevents reordering issues
            story={story} // Story data — drives all card UI
            onClick={() => onCardClick(story.id)} // Click opens the panel — required interaction
          />
        ))}
      </div>
    </div>
  );
} // End KanbanColumn — reusable per column

// StoryCard — one clickable card — matches the Figma “story-card” component
function StoryCard({ story, onClick }: { story: Story; onClick: () => void }) {
  return (
    <button
      type="button" // Ensures this button does not submit anything — it’s just clickable UI
      onClick={onClick} // When clicked, open the side panel — required behavior
      style={{
        width: "100%", // Card should fill the column width — matches Figma
        textAlign: "left", // Text aligns left — matches card typography
        backgroundColor: colors["surface-card"], // White background — surface-card token
        border: `1px solid ${colors["border-default"]}`, // Border token — matches Figma borders
        borderRadius: borderRadius.md, // 8px radius — matches spec “Card border radius = 8px”
        padding: "12px", // Exact card padding per spec — 12px
        boxShadow: "0px 4px 10px rgba(0,0,0,0.04)", // Subtle shadow — matches Figma’s drop shadow
        cursor: "pointer", // Pointer cursor signals clickability — important affordance
        boxSizing: "border-box", // Include padding/border — stable sizing
      }}
    >
      {/* Card top row — TicketId + type badge on left, priority badge on right */}
      <div
        style={{
          display: "flex", // Place left group and right badge on one row
          alignItems: "center", // Vertical alignment for badges and id
          justifyContent: "space-between", // Left cluster vs right cluster
          gap: spacing[2], // Small gap when wrapping
          marginBottom: spacing[2], // Space under top row — matches Figma spacing
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
          <TicketId id={story.ticketId} /> {/* Ticket id — uses existing component */}
          <PillBadge label={story.type} colors={badgeColorsByType[story.type]} /> {/* Type badge — mapped colors */}
        </div>
        <PillBadge label={story.priority} colors={priorityBadgeColors(story.priority)} /> {/* Priority badge */}
      </div>

      {/* Card title — 13px Medium per requirement — uses text-primary */}
      <div
        style={{
          fontSize: typography.bodySm.size, // Exact card title size per spec — 13px
          fontWeight: 500, // Medium weight per spec — “Card title = 13px Medium”
          color: colors["text-primary"], // Primary text — #1e293b mapping
          lineHeight: 1.4, // Matches the frame’s comfortable title wrapping
          marginBottom: spacing[3], // Space before meta row — consistent with design
        }}
      >
        {story.title}
      </div>

      {/* Meta row — client chip + sprint/date text — mirrors the Figma meta line */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing[2], flexWrap: "wrap" }}>
        <span
          style={{
            backgroundColor: colors.canvas, // Light chip background — matches subtle gray chip
            borderRadius: borderRadius.sm, // Small rounding — matches Figma chip radius feel
            padding: "4px 8px", // Compact chip padding — keeps row tight
            fontSize: typography.monoSm.size, // Meta text is small in the frame
            color: colors["text-secondary"], // Secondary text — matches spec mapping
            whiteSpace: "nowrap", // Keep client on one line
          }}
        >
          {story.client}
        </span>
        <span style={metaDotTextStyle}>· {story.sprint}</span> {/* Sprint meta with dot separator */}
        <span style={metaDotTextStyle}>· {story.dateLabel}</span> {/* Date meta with dot separator */}
      </div>

      {/* In-progress progress bar — only for cards with progressPct */}
      {typeof story.progressPct === "number" && (
        <div style={{ marginTop: spacing[3] }}>
          <div
            style={{
              height: 4, // Thin progress line — matches the frame
              width: "100%", // Full width — indicates progress visually
              backgroundColor: colors["border-default"], // Track color — uses border token
              borderRadius: borderRadius.full, // Rounded ends — matches Figma progress style
              overflow: "hidden", // Clip the fill — keeps rounded ends clean
            }}
          >
            <div
              style={{
                width: `${story.progressPct}%`, // Fill percentage — driven by data
                height: "100%", // Fill the track height
                backgroundColor: "#f59e0b", // Orange fill — matches “In Progress” accent
                borderRadius: borderRadius.full, // Rounded fill edge
              }}
            />
          </div>
          <div
            style={{
              marginTop: spacing[2], // Space between bar and percentage label
              fontSize: typography.monoSm.size, // Small label size — matches Figma
              color: colors["text-tertiary"], // Tertiary text — subtle
            }}
          >
            {story.progressPct}%
          </div>
        </div>
      )}

      {/* Done “Completed …” label — only for Done cards */}
      {story.doneLabel && (
        <div
          style={{
            marginTop: spacing[3], // Space above completion label
            fontSize: typography.monoSm.size, // Small completion label — matches frame
            color: colors["success-dark"], // Green completion text — aligns with Done feel
            fontWeight: 500, // Slight emphasis — readable but not heavy
          }}
        >
          {story.doneLabel}
        </div>
      )}
    </button>
  );
} // End StoryCard — click opens detail panel

// ToolbarDropdown — renders a static dropdown-like button — matches the Figma toolbar controls
function ToolbarDropdown({ label }: { label: string }) {
  return (
    <button
      type="button" // Static for now — later can open a menu
      style={{
        backgroundColor: colors["surface-card"], // White button surface — matches Figma
        border: `1px solid ${colors["border-default"]}`, // Border token — matches Figma border
        borderRadius: borderRadius.md, // 8px radius — matches spec
        padding: "8px 12px", // Matches Figma px-12 py-8 feel
        display: "flex", // Text and chevron inline
        alignItems: "center", // Vertical center
        gap: spacing[2], // Space between label and chevron
        color: colors["text-primary"], // Primary text — readable
        fontSize: typography.bodySm.size, // Matches the toolbar label size shown in design context
        fontWeight: 500, // Medium — matches the frame’s feel
        cursor: "pointer", // Pointer cursor — clickable affordance
      }}
    >
      <span>{label}</span> {/* Label text — matches filter name */}
      <span style={{ color: colors["text-tertiary"], fontSize: typography.captionSm.size }}>▼</span> {/* Simple chevron — avoids image assets */}
    </button>
  );
} // End ToolbarDropdown — consistent filter control

// PillBadge — reusable badge for type/priority/AI — matches the pill radius rule (9999px)
function PillBadge({
  label,
  colors: badgeColors,
}: {
  label: string; // Badge text — e.g. “Bug”, “Critical”, “AI Generated”
  colors: { bg: string; fg: string }; // Background and foreground colors — exact mapping from rules
}) {
  return (
    <span
      style={{
        display: "inline-flex", // Inline pill that still allows padding
        alignItems: "center", // Center text vertically
        padding: "2px 8px", // Compact pill padding — matches general badge sizing
        borderRadius: borderRadius.full, // 9999px pill — exact spec requirement
        backgroundColor: badgeColors.bg, // Badge background — exact color mapping
        color: badgeColors.fg, // Badge text color — exact color mapping
        fontSize: typography.captionSm.size, // Badges are 12px per spec
        fontWeight: 600, // SemiBold per spec
        whiteSpace: "nowrap", // Keep the badge on one line
        boxSizing: "border-box", // Consistent sizing across badges
      }}
    >
      {label}
    </span>
  );
} // End PillBadge — used across cards and details panel

// priorityBadgeColors — maps priority text to a token-consistent style (brand-blue/neutral) while keeping readability
function priorityBadgeColors(priority: Story["priority"]): { bg: string; fg: string } {
  if (priority === "Critical") return { bg: badgeColorsByType.Bug.bg, fg: colors.danger }; // Critical leans red — aligns with urgency
  if (priority === "High") return { bg: "#fef3c7", fg: "#92400e" }; // High leans amber — matches warning mapping
  if (priority === "Medium") return { bg: "#dbeafe", fg: "#1e40af" }; // Medium leans blue — calm but visible
  return { bg: colors["surface-subtle"], fg: colors["text-tertiary"] }; // Low is subtle gray — de-emphasized
} // End priority mapping — used by cards and panel

// Shared styles — extracted to keep JSX readable while still fully token-based
const metaDotTextStyle: React.CSSProperties = {
  fontSize: typography.monoSm.size, // Meta text size — matches the design context
  color: colors["text-tertiary"], // Tertiary text — less emphasis than client chip
  whiteSpace: "nowrap", // Keep “· Sprint 14” on one line where possible
}; // End meta dot style

const syncButtonStyle: React.CSSProperties = {
  padding: "10px 16px", // Matches Figma toolbar button size
  backgroundColor: "transparent", // Outline button has no fill
  border: `1px solid ${colors.info}`, // Blue outline — maps to brand-blue/links feel
  borderRadius: borderRadius.md, // 8px radius — spec
  color: colors["brand-blue"], // Brand blue text — maps #0088ff
  fontSize: typography.captionSm.size, // Button text size — matches design context
  fontWeight: 600, // SemiBold — matches button emphasis
  cursor: "pointer", // Click affordance
}; // End sync button style

const newButtonStyle: React.CSSProperties = {
  padding: "10px 16px", // Same sizing as Sync button
  backgroundColor: colors["brand-blue"], // Solid brand blue — maps #0088ff
  border: "none", // No border for primary button
  borderRadius: borderRadius.xl, // Slightly rounder like Figma “New +” (12px)
  color: colors["text-on-dark"], // White text on blue — matches token
  fontSize: typography.captionSm.size, // Button label size
  fontWeight: 600, // SemiBold label weight
  cursor: "pointer", // Click affordance
}; // End new button style

const iconButtonStyle: React.CSSProperties = {
  border: `1px solid ${colors["border-default"]}`, // Subtle border — keeps it visible on white
  backgroundColor: colors["surface-card"], // White background — consistent with panel
  borderRadius: borderRadius.md, // 8px rounding — consistent with design language
  width: 36, // Square icon button
  height: 36, // Square icon button
  display: "flex", // Center the icon
  alignItems: "center", // Vertical center
  justifyContent: "center", // Horizontal center
  cursor: "pointer", // Click affordance
}; // End icon button style

