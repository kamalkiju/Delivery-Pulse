import {
  AudioLines,
  BarChart3,
  Calendar,
  ClipboardList,
  FileText,
  Layers,
  LayoutGrid,
  MessageSquare,
  LogOut,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { logoutUser } from "../../api/auth.api";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isSidebarNavActive } from "../../utils/navActive";
import {
  borderRadius,
  colors,
  figmaAssets,
  layout,
  spacing,
  typography,
} from "../../styles/tokens";

type BadgeColor = "blue" | "amber";

interface NavItem {
  icon: LucideIcon | string;
  label: string;
  path: string;
  badgeCount?: number;
  badgeColor?: BadgeColor;
}

const navItems: NavItem[] = [
  { icon: LayoutGrid, label: "Dashboard", path: "/dashboard" },
  {
    icon: MessageSquare,
    label: "Slack",
    path: "/slack",
    badgeCount: 3,
    badgeColor: "blue",
  },
  { icon: Layers, label: "ADO Board", path: "/ado-board" },
  {
    icon: ClipboardList,
    label: "Review Queue",
    path: "/review",
    badgeCount: 8,
    badgeColor: "amber",
  },
  { icon: FileText, label: "Documents", path: "/documents" },
  { path: "/document-workshop", icon: "📄", label: "Doc Workshop" },
  { icon: Calendar, label: "Meetings", path: "/meetings" },
  { icon: Users, label: "Clients", path: "/clients" },
  { icon: BarChart3, label: "Reports", path: "/reports" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const badgeBackground: Record<BadgeColor, string> = {
  blue: colors["brand-blue"],
  amber: colors.warning,
};

function SidebarDivider() {
  return (
    <div
      data-name="divider"
      style={{
        width: layout.sidebarWidth,
        height: "1px",
        backgroundColor: colors["divider-on-dark"],
        flexShrink: 0,
      }}
    />
  );
}

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <aside
      data-node-id="151:952"
      data-name="sidebar"
      style={{
        width: layout.sidebarWidth,
        height: "100vh",
        backgroundColor: colors["navy-sidebar"],
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 100,
        boxSizing: "border-box",
        overflow: "visible",
      }}
    >
      <div
        data-node-id="151:953"
        data-name="logo-row"
        style={{
          width: layout.sidebarWidth,
          padding: layout.sidebarChromePadding,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <div
          data-node-id="151:954"
          style={{
            width: layout.logoSize,
            height: layout.logoSize,
            backgroundColor: colors["surface-card"],
            borderRadius: borderRadius.md,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="DeliveryPulse"
        >
          <AudioLines
            size={20}
            strokeWidth={2}
            color={colors["navy-sidebar"]}
            aria-hidden
          />
        </div>
      </div>

      <SidebarDivider />

      <nav
        data-node-id="151:958"
        data-name="nav"
        className="sidebar-nav"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: layout.navGap,
          padding: `${spacing[5]} 0`,
          flex: "1 1 0",
          minHeight: 0,
          width: "100%",
          boxSizing: "border-box",
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {navItems.map((item) => {
          const isActive = isSidebarNavActive(item.path, location.pathname);
          const Icon = typeof item.icon === "string" ? null : item.icon;

          return (
            <button
              key={item.path}
              type="button"
              data-name={isActive ? "sidebar-item-active" : "sidebar-item"}
              className={`sidebar-nav-item ${isActive ? "sidebar-nav-item--current sidebar-nav-item--wide" : ""}`}
              onClick={() => navigate(item.path)}
              aria-current={isActive ? "page" : undefined}
            >
              {typeof item.icon === "string" ? (
                <span
                  style={{ fontSize: 20, lineHeight: 1, width: 20, textAlign: "center" }}
                  aria-hidden
                >
                  {item.icon}
                </span>
              ) : Icon ? (
                <Icon
                  size={20}
                  strokeWidth={1.75}
                  color={colors["text-on-dark"]}
                  aria-hidden
                />
              ) : null}

              <span
                style={{
                  fontSize: typography.sidebarLabel.size,
                  fontFamily: typography.sidebarLabel.fontFamily,
                  fontWeight: typography.sidebarLabel.weight,
                  color: isActive
                    ? colors["text-on-dark"]
                    : colors["text-muted-dark"],
                  lineHeight: 1.1,
                  textAlign: "center",
                  maxWidth: layout.sidebarWidth,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.label}
              </span>

              {item.badgeCount != null && item.badgeCount > 0 && (
                <div
                  data-name="badge"
                  style={{
                    position: "absolute",
                    top: item.badgeColor === "amber" ? "22.5px" : "20.5px",
                    left: item.badgeColor === "amber" ? "44px" : "43px",
                    minWidth: "14px",
                    height: "14px",
                    padding: "1px 4px",
                    borderRadius: borderRadius.xs,
                    backgroundColor:
                      badgeBackground[item.badgeColor ?? "blue"],
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: typography.badgeCount.size,
                    fontWeight: typography.badgeCount.weight,
                    fontFamily: typography.badgeCount.fontFamily,
                    color: colors["text-on-dark"],
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                  }}
                  aria-label={`${item.badgeCount} notifications`}
                >
                  {item.badgeCount}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      <SidebarDivider />

      <div
        style={{
          width: layout.sidebarWidth,
          padding: `0 ${spacing[3]} ${layout.sidebarChromePadding}`,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: spacing[2],
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="sidebar-chrome-btn"
          onClick={() => logoutUser()}
          aria-label="Sign out"
        >
          <LogOut size={18} aria-hidden />
        </button>
        <button
          type="button"
          data-node-id="151:1000"
          data-name="user-row"
          className="sidebar-chrome-btn"
          onClick={() => navigate("/profile")}
          aria-label="Open profile"
          style={{ padding: 0 }}
        >
          {avatarFailed ? (
            <div
              style={{
                width: layout.logoSize,
                height: layout.logoSize,
                borderRadius: borderRadius["2xl"],
                backgroundColor: colors["brand-blue"],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: typography.tableHeader.size,
                fontWeight: typography.badgeCount.weight,
                fontFamily: typography.badgeCount.fontFamily,
                color: colors["text-on-dark"],
              }}
            >
              RM
            </div>
          ) : (
            <img
              data-node-id="151:1001"
              src={figmaAssets.avatar}
              alt=""
              width={32}
              height={32}
              style={{
                width: layout.logoSize,
                height: layout.logoSize,
                borderRadius: borderRadius["2xl"],
                objectFit: "cover",
                display: "block",
              }}
              onError={() => setAvatarFailed(true)}
            />
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
