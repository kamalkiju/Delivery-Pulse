import type { ReactNode } from "react";
import { Bell, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { colors, layout, spacing, typography } from "../../styles/tokens";

interface TopNavProps {
  title: string;
  notificationCount?: number;
  userInitials?: string;
  /** Optional slot — workspace label + switch shortcut (Dashboard, Review, Slack) */
  centerSlot?: ReactNode;
}

function IconButton({
  children,
  ariaLabel,
  badge,
}: {
  children: ReactNode;
  ariaLabel: string;
  badge?: number;
}) {
  return (
    <button type="button" className="dp-icon-btn" aria-label={ariaLabel}>
      {children}
      {badge != null && badge > 0 && (
        <span
          data-name="notification-badge"
          style={{
            position: "absolute",
            top: "-2px",
            right: "-2px",
            width: layout.topnavNotificationBadgeSize,
            height: layout.topnavNotificationBadgeSize,
            borderRadius: "7px",
            backgroundColor: colors.danger,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: typography.notificationBadge.size,
            fontWeight: typography.notificationBadge.weight,
            fontFamily: typography.notificationBadge.fontFamily,
            color: colors["text-on-dark"],
            lineHeight: 1,
            pointerEvents: "none",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

const TopNav = ({
  title,
  notificationCount = 2,
  userInitials = "RM",
  centerSlot,
}: TopNavProps) => {
  const navigate = useNavigate();

  return (
    <header
      data-node-id="148:517"
      data-name="topnav"
      style={{
        height: layout.topnavHeight,
        minHeight: layout.topnavHeight,
        backgroundColor: colors["navy-topnav"],
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `${spacing[3]} ${spacing[4]}`,
        boxSizing: "border-box",
        flexShrink: 0,
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          minWidth: 0,
          flex: 1,
        }}
      >
        <h1
          data-node-id="148:535"
          style={{
            margin: 0,
            fontSize: typography.titleMd.size,
            fontWeight: typography.titleMd.weight,
            fontFamily: typography.microBold.fontFamily,
            color: colors["text-on-dark"],
            lineHeight: "normal",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {title}
        </h1>
        {centerSlot}
      </div>

      <div
        data-node-id="148:523"
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[4],
          flexShrink: 0,
        }}
      >
        <IconButton ariaLabel="Search">
          <Search
            size={18}
            strokeWidth={1.75}
            color={colors["text-on-dark"]}
            aria-hidden
          />
        </IconButton>

        <IconButton ariaLabel="Notifications" badge={notificationCount}>
          <Bell
            size={18}
            strokeWidth={1.75}
            color={colors["text-on-dark"]}
            aria-hidden
          />
        </IconButton>

        <button
          type="button"
          data-node-id="148:532"
          className="dp-avatar-btn"
          onClick={() => navigate("/profile")}
          aria-label="Open profile"
          title={userInitials}
        >
          <span
            data-node-id="148:533"
            style={{
              fontSize: typography.microBold.size,
              fontWeight: typography.microBold.weight,
              fontFamily: typography.microBold.fontFamily,
              color: colors["text-on-dark"],
              lineHeight: 1,
            }}
          >
            {userInitials}
          </span>
        </button>
      </div>
    </header>
  );
};

export default TopNav;
