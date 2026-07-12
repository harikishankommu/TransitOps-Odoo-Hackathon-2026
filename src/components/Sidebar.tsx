/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

import {
  Bell,
  Fuel,
  LayoutDashboard,
  LogOut,
  Route,
  Settings,
  ShieldCheck,
  TrendingUp,
  Truck,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "../context/AuthContext.js";

import {
  type AppTab,
  canAccessTab,
} from "../utils/permissions.js";

interface SidebarProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onLogout: () => void;
  notificationsCount: number;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface NavigationItem {
  id: AppTab;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  onLogout,
  notificationsCount,
  isMobileOpen = false,
  onMobileClose,
}) => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  const navigationItems: NavigationItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "vehicles", label: "Vehicles", icon: Truck },
    { id: "drivers", label: "Drivers", icon: Users },
    { id: "trips", label: "Trips", icon: Route },
    { id: "maintenance", label: "Maintenance", icon: Wrench },
    { id: "fuel-expenses", label: "Fuel & Expenses", icon: Fuel },
    { id: "reports", label: "Reports", icon: TrendingUp },
    { id: "users", label: "Users & Roles", icon: Settings },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
      badge: notificationsCount,
    },
  ];

  const visibleNavigationItems = navigationItems.filter((item) =>
    canAccessTab(user.role, item.id),
  );

  const handleNavigation = (tab: AppTab): void => {
    onTabChange(tab);
    onMobileClose?.();
  };

  return (
    <aside
      aria-label="Primary navigation"
      className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-72 flex-col border-r border-white/5 bg-[#0A0A0A] text-white shadow-2xl shadow-black/40 transition-transform duration-300 ease-out lg:z-30 lg:w-64 lg:translate-x-0 lg:shadow-none ${
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/5 p-5 sm:p-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-sm border border-white/10 bg-white/5 p-2 text-blue-500">
            <Truck size={20} className="stroke-[2]" />
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tighter">
              TRANSITOPS<span className="text-blue-500">®</span>
            </h1>
            <p className="truncate font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-white/40">
              Operations Portal
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={onMobileClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-white/10 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X size={17} />
        </button>
      </div>

      <div className="flex items-center gap-3 border-b border-white/5 bg-[#111111]/40 px-5 py-4 sm:px-6">
        <div className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-sm border border-white/10 bg-white/5 font-bold uppercase text-blue-400">
          {user.full_name.charAt(0)}
        </div>

        <div className="min-w-0 overflow-hidden">
          <h4 className="truncate text-xs font-semibold text-white/80">
            {user.full_name}
          </h4>
          <span className="mt-1 inline-flex max-w-full items-center gap-1 truncate rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-blue-400">
            <ShieldCheck size={10} className="shrink-0" />
            <span className="truncate">{user.role.replaceAll("_", " ")}</span>
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-4 py-5 sm:py-6">
        {visibleNavigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigation(item.id)}
              className={`group flex w-full items-center justify-between rounded-sm px-4 py-3 text-xs font-medium transition-all duration-200 ${
                isActive
                  ? "bg-white font-bold text-black shadow-md"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Icon
                  size={16}
                  className={`shrink-0 ${
                    isActive
                      ? "stroke-[2] text-black"
                      : "text-white/40 group-hover:text-white/80"
                  }`}
                />
                <span className="truncate text-[10px] uppercase tracking-wide">
                  {item.label}
                </span>
              </div>

              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`ml-2 shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[9px] ${
                    isActive
                      ? "bg-black text-white"
                      : "border border-blue-500/20 bg-blue-500/15 text-blue-400"
                  }`}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/5 bg-white/[0.02] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-sm px-4 py-3 text-xs font-medium uppercase tracking-wider text-white/50 transition-colors hover:bg-red-950/20 hover:text-red-400"
        >
          <LogOut size={16} />
          <span>Logout Session</span>
        </button>
      </div>
    </aside>
  );
};
