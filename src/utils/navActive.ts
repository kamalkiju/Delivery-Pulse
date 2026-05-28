/** True when this sidebar path should show as selected */
export function isSidebarNavActive(path: string, pathname: string): boolean {
  if (path === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}
