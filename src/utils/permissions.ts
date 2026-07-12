import { UserRole } from "../types.js";

export type AppTab =
  | "dashboard"
  | "vehicles"
  | "drivers"
  | "trips"
  | "maintenance"
  | "fuel-expenses"
  | "reports"
  | "users"
  | "notifications";

const TAB_PERMISSIONS: Record<
  AppTab,
  readonly UserRole[]
> = {
  dashboard: [
    UserRole.FLEET_MANAGER,
    UserRole.DISPATCHER,
    UserRole.SAFETY_OFFICER,
    UserRole.FINANCIAL_ANALYST,
    UserRole.DRIVER,
  ],

  vehicles: [
    UserRole.FLEET_MANAGER,
    UserRole.DISPATCHER,
  ],

  drivers: [
    UserRole.DISPATCHER,
    UserRole.SAFETY_OFFICER,
  ],

  trips: [
    UserRole.DISPATCHER,
    UserRole.DRIVER,
  ],

  maintenance: [
    UserRole.FLEET_MANAGER,
  ],

  "fuel-expenses": [
    UserRole.FINANCIAL_ANALYST,
  ],

  reports: [
    UserRole.FLEET_MANAGER,
    UserRole.SAFETY_OFFICER,
    UserRole.FINANCIAL_ANALYST,
  ],

  // ADMIN is handled separately.
  users: [],

  notifications: [
    UserRole.FLEET_MANAGER,
    UserRole.DISPATCHER,
    UserRole.SAFETY_OFFICER,
    UserRole.FINANCIAL_ANALYST,
    UserRole.DRIVER,
  ],
};

export function canAccessTab(
  role: UserRole,
  tab: AppTab,
): boolean {
  if (role === UserRole.ADMIN) {
    return true;
  }

  return TAB_PERMISSIONS[tab].includes(role);
}

export function isAppTab(
  value: string,
): value is AppTab {
  return Object.prototype.hasOwnProperty.call(
    TAB_PERMISSIONS,
    value,
  );
}