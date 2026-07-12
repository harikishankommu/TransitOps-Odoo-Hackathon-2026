/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useAuth } from "../context/AuthContext.js";
import { UserRole } from "../types.js";
import {
  LayoutDashboard,
  Truck,
  Users,
  Route,
  Wrench,
  Fuel,
  TrendingUp,
  Settings,
  Bell,
  LogOut,
  ShieldCheck
} from "lucide-react";

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  notificationsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  onLogout,
  notificationsCount
}) => {
  const { user } = useAuth();

  if (!user) return null;

  // Role permissions checklist
  const hasAccess = (tab: string): boolean => {
    const role = user.role;
    if (role === UserRole.ADMIN) return true;

    switch (tab) {
      case "dashboard":
        return true;
      case "vehicles":
        return [UserRole.FLEET_MANAGER, UserRole.DISPATCHER].includes(role);
      case "drivers":
        return [UserRole.DISPATCHER, UserRole.SAFETY_OFFICER].includes(role);
      case "trips":
        return [UserRole.DISPATCHER, UserRole.DRIVER].includes(role);
      case "maintenance":
        return [UserRole.FLEET_MANAGER].includes(role);
      case "fuel-expenses":
        return [UserRole.FINANCIAL_ANALYST].includes(role);
      case "reports":
        return [UserRole.FLEET_MANAGER, UserRole.SAFETY_OFFICER, UserRole.FINANCIAL_ANALYST].includes(role);
      case "users":
        return role === UserRole.ADMIN;
      case "notifications":
        return true;
      default:
        return false;
    }
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "vehicles", label: "Vehicles", icon: Truck },
    { id: "drivers", label: "Drivers", icon: Users },
    { id: "trips", label: "Trips", icon: Route },
    { id: "maintenance", label: "Maintenance", icon: Wrench },
    { id: "fuel-expenses", label: "Fuel & Expenses", icon: Fuel },
    { id: "reports", label: "Reports", icon: TrendingUp },
    { id: "users", label: "Users & Roles", icon: Settings },
    { id: "notifications", label: "Notifications", icon: Bell, badge: notificationsCount },
  ];

  return (
    <aside className="w-64 bg-[#0A0A0A] text-white flex flex-col h-screen fixed top-0 left-0 border-r border-white/5 z-30">
      {/* Brand logo */}
      <div className="p-6 border-b border-white/5 flex items-center gap-3">
        <div className="border border-white/10 text-blue-500 p-2 rounded-sm bg-white/5">
          <Truck size={20} className="stroke-[2]" />
        </div>
        <div>
          <h1 className="text-xl font-bold font-sans tracking-tighter">TRANSITOPS<span className="text-blue-500">®</span></h1>
          <p className="text-[9px] text-white/40 font-mono tracking-[0.2em] uppercase font-medium">
            OPERATIONS PORTAL
          </p>
        </div>
      </div>

      {/* User profile brief */}
      <div className="px-6 py-4 bg-[#111111]/40 border-b border-white/5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center text-blue-400 font-bold uppercase select-none">
          {user.full_name.charAt(0)}
        </div>
        <div className="overflow-hidden">
          <h4 className="text-xs font-semibold truncate text-white/80">
            {user.full_name}
          </h4>
          <span className="inline-flex items-center gap-1 text-[9px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded uppercase mt-1">
            <ShieldCheck size={10} /> {user.role.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          if (!hasAccess(item.id)) return null;
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-sm text-xs font-medium transition-all duration-200 group ${
                isActive
                  ? "bg-white text-black font-bold shadow-md"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={16} className={isActive ? "text-black stroke-[2]" : "text-white/40 group-hover:text-white/80"} />
                <span className="tracking-wide uppercase text-[10px]">{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-sm text-[9px] font-mono ${
                    isActive ? "bg-black text-white" : "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout button */}
      <div className="p-4 border-t border-white/5 bg-white/[0.02]">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-sm text-xs font-medium text-white/50 hover:bg-red-950/20 hover:text-red-400 transition-colors uppercase tracking-wider"
        >
          <LogOut size={16} />
          <span>Logout Session</span>
        </button>
      </div>
    </aside>
  );
};
