/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  DollarSign,
  Gauge,
  RefreshCw,
  Route,
  ShieldAlert,
  Truck,
  UserCheck,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "../context/AuthContext.js";
import {
  NotificationType,
  TripStatus,
  UserRole,
} from "../types.js";
import { apiFetch } from "../utils/api.js";

interface DashboardKpi {
  totalVehicles: number;
  availableVehicles: number;
  onTripVehicles: number;
  inMaintenanceVehicles: number;
  totalDrivers: number;
  availableDrivers: number;
  onTripDrivers: number;
  activeTrips: number;
  draftTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  fleetUtilization: number;
  totalRevenue: number;
  totalFuelCost: number;
  totalMaintenanceCost: number;
  totalOtherExpenses: number;
  totalOperationalCost: number;
  netBalance: number;
  unreadNotifications: number;
  personalDistance: number;
  averageSafetyScore: number;
}

interface DistributionPoint {
  name: string;
  value: number;
}

interface FinancialPoint {
  month: string;
  revenue: number;
  expenses: number;
  net: number;
}

interface EfficiencyPoint {
  vehicle_name: string;
  efficiency: number;
}

interface RecentTrip {
  id: string;
  trip_code: string;
  route: string;
  status: TripStatus;
  vehicle: string;
  driver: string;
  updated_at: string;
}

interface RecentMaintenance {
  id: string;
  vehicle: string;
  maintenance_type: string;
  status: string;
  expected_completion_date: string;
}

interface LicenceAlert {
  driver_id: string;
  driver_name: string;
  licence: string;
  expiry: string;
  status: "EXPIRED" | "EXPIRING_SOON";
}

interface ActivityEntry {
  id: string;
  user_name: string;
  action: string;
  entity_type: string;
  created_at: string;
}

interface DashboardNotification {
  id: string;
  title: string;
  message: string;
  notification_type: NotificationType;
  created_at: string;
}

interface DashboardOverview {
  generated_at: string;
  role: UserRole;
  permissions: {
    fleet: boolean;
    drivers: boolean;
    trips: boolean;
    financials: boolean;
  };
  kpi: DashboardKpi;
  vehicle_status: DistributionPoint[];
  trip_status: DistributionPoint[];
  monthly_financials: FinancialPoint[];
  fuel_efficiency: EfficiencyPoint[];
  recent_trips: RecentTrip[];
  recent_maintenance: RecentMaintenance[];
  licence_alerts: LicenceAlert[];
  recent_activity: ActivityEntry[];
  notifications: DashboardNotification[];
}

interface KpiCard {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{
    size?: number;
    className?: string;
  }>;
}

const CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
];

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-IN", {
    maximumFractionDigits: 1,
  });
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusClass(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "DISPATCHED":
    case "IN_PROGRESS":
      return "border-blue-500/20 bg-blue-500/10 text-blue-300";
    case "CANCELLED":
    case "EXPIRED":
      return "border-red-500/20 bg-red-500/10 text-red-300";
    case "DRAFT":
    case "OPEN":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    default:
      return "border-white/10 bg-white/5 text-white/60";
  }
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [overview, setOverview] =
    useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState("");

  const loadOverview = useCallback(
    async (silent = false): Promise<void> => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const data =
          await apiFetch<DashboardOverview>(
            "/dashboard/overview",
          );

        setOverview(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load dashboard analytics.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const kpiCards = useMemo<KpiCard[]>(() => {
    if (!overview || !user) {
      return [];
    }

    const { kpi, permissions } = overview;

    if (user.role === UserRole.DRIVER) {
      return [
        {
          label: "Active Trips",
          value: String(kpi.activeTrips),
          hint: `${kpi.completedTrips} completed trips`,
          icon: Route,
        },
        {
          label: "Distance Completed",
          value: `${formatNumber(kpi.personalDistance)} km`,
          hint: "Across completed assignments",
          icon: Gauge,
        },
        {
          label: "Safety Score",
          value: formatNumber(kpi.averageSafetyScore),
          hint: "Current driver profile score",
          icon: UserCheck,
        },
        {
          label: "Unread Alerts",
          value: String(kpi.unreadNotifications),
          hint: "Operational notifications",
          icon: Bell,
        },
      ];
    }

    if (user.role === UserRole.SAFETY_OFFICER) {
      return [
        {
          label: "Drivers",
          value: String(kpi.totalDrivers),
          hint: `${kpi.availableDrivers} available`,
          icon: UserCheck,
        },
        {
          label: "Average Safety",
          value: formatNumber(kpi.averageSafetyScore),
          hint: "Across all driver profiles",
          icon: Gauge,
        },
        {
          label: "Licence Alerts",
          value: String(
            overview.licence_alerts.length,
          ),
          hint: "Expired or expiring soon",
          icon: ShieldAlert,
        },
        {
          label: "Unread Alerts",
          value: String(kpi.unreadNotifications),
          hint: "Needs review",
          icon: Bell,
        },
      ];
    }

    if (
      user.role === UserRole.FINANCIAL_ANALYST
    ) {
      return [
        {
          label: "Revenue",
          value: formatCurrency(kpi.totalRevenue),
          hint: `${kpi.completedTrips} completed trips`,
          icon: DollarSign,
        },
        {
          label: "Operating Cost",
          value: formatCurrency(
            kpi.totalOperationalCost,
          ),
          hint: `Fuel ${formatCurrency(
            kpi.totalFuelCost,
          )}`,
          icon: Activity,
        },
        {
          label: "Net Balance",
          value: formatCurrency(kpi.netBalance),
          hint:
            kpi.netBalance >= 0
              ? "Positive operating balance"
              : "Costs exceed revenue",
          icon: Gauge,
        },
        {
          label: "Unread Alerts",
          value: String(kpi.unreadNotifications),
          hint: "Financial and system alerts",
          icon: Bell,
        },
      ];
    }

    const cards: KpiCard[] = [
      {
        label: "Fleet Utilization",
        value: `${formatNumber(
          kpi.fleetUtilization,
        )}%`,
        hint: `${kpi.onTripVehicles} vehicles on trip`,
        icon: Gauge,
      },
      {
        label: "Active Dispatches",
        value: String(kpi.activeTrips),
        hint: `${kpi.draftTrips} draft trips`,
        icon: Route,
      },
      {
        label: "Available Assets",
        value: `${kpi.availableVehicles} V / ${kpi.availableDrivers} D`,
        hint: `${kpi.inMaintenanceVehicles} in workshop`,
        icon: Truck,
      },
      {
        label: permissions.financials
          ? "Net Balance"
          : "Completed Trips",
        value: permissions.financials
          ? formatCurrency(kpi.netBalance)
          : String(kpi.completedTrips),
        hint: permissions.financials
          ? `${formatCurrency(
              kpi.totalOperationalCost,
            )} operating cost`
          : `${kpi.cancelledTrips} cancelled`,
        icon: permissions.financials
          ? DollarSign
          : CheckCircle2,
      },
    ];

    return cards;
  }, [overview, user]);

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 text-white/50">
        <div className="h-11 w-11 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em]">
          Loading operational analytics...
        </p>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="rounded-sm border border-red-500/20 bg-red-950/20 p-6 text-red-200">
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={22}
            className="mt-0.5 text-red-400"
          />
          <div className="flex-1">
            <h3 className="text-sm font-bold uppercase tracking-wide">
              Dashboard unavailable
            </h3>
            <p className="mt-1 text-xs text-red-300/80">
              {error ||
                "The analytics payload could not be loaded."}
            </p>
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="mt-4 rounded-sm border border-red-400/30 px-3 py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-red-400/10"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-blue-500">
            Operations Control Room
          </div>
          <h2 className="text-3xl font-light tracking-tight text-white">
            FLEET{" "}
            <span className="font-serif font-light italic text-blue-500">
              operations
            </span>{" "}
            COMMAND
          </h2>
          <p className="mt-1 text-xs text-white/50">
            Live fleet, dispatch, compliance, and
            financial analytics for {user?.full_name}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadOverview(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 self-start rounded-sm border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={
              refreshing ? "animate-spin" : ""
            }
          />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="rounded-sm border border-white/5 border-l-2 border-l-blue-500 bg-[#111111]/80 p-6"
            >
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                  {card.label}
                </span>
                <div className="rounded-sm bg-blue-500/10 p-2 text-blue-400">
                  <Icon size={16} />
                </div>
              </div>
              <p className="mt-4 text-3xl font-light tracking-tight text-white">
                {card.value}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-white/40">
                {card.hint}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {overview.vehicle_status.length > 0 && (
          <section className="rounded-sm border border-white/5 bg-[#111111]/80 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">
              Vehicle Status
            </h3>
            <div className="mt-4 h-64">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <PieChart>
                  <Pie
                    data={overview.vehicle_status}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={3}
                  >
                    {overview.vehicle_status.map(
                      (entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={
                            CHART_COLORS[
                              index %
                                CHART_COLORS.length
                            ]
                          }
                        />
                      ),
                    )}
                  </Pie>
                  <Tooltip />
                  <Legend
                    wrapperStyle={{
                      fontSize: "10px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        <section className="rounded-sm border border-white/5 bg-[#111111]/80 p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">
            Trip Status
          </h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={overview.trip_status}
                margin={{
                  top: 10,
                  right: 10,
                  left: -20,
                  bottom: 0,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#ffffff0d"
                />
                <XAxis
                  dataKey="name"
                  tick={{
                    fill: "#ffffff66",
                    fontSize: 9,
                  }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{
                    fill: "#ffffff66",
                    fontSize: 9,
                  }}
                />
                <Tooltip />
                <Bar
                  dataKey="value"
                  fill="#3b82f6"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {overview.monthly_financials.length > 0 ? (
          <section className="rounded-sm border border-white/5 bg-[#111111]/80 p-5 xl:col-span-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">
              Revenue vs Expenses
            </h3>
            <div className="mt-4 h-64">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={
                    overview.monthly_financials
                  }
                  margin={{
                    top: 10,
                    right: 10,
                    left: -10,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#ffffff0d"
                  />
                  <XAxis
                    dataKey="month"
                    tick={{
                      fill: "#ffffff66",
                      fontSize: 9,
                    }}
                  />
                  <YAxis
                    tick={{
                      fill: "#ffffff66",
                      fontSize: 9,
                    }}
                  />
                  <Tooltip />
                  <Legend
                    wrapperStyle={{
                      fontSize: "10px",
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="#22c55e"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="expenses"
                    fill="#ef4444"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        ) : (
          overview.fuel_efficiency.length > 0 && (
            <section className="rounded-sm border border-white/5 bg-[#111111]/80 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">
                Fuel Efficiency
              </h3>
              <div className="mt-4 h-64">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={
                      overview.fuel_efficiency
                    }
                    layout="vertical"
                    margin={{
                      top: 5,
                      right: 10,
                      left: 5,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#ffffff0d"
                    />
                    <XAxis
                      type="number"
                      tick={{
                        fill: "#ffffff66",
                        fontSize: 9,
                      }}
                    />
                    <YAxis
                      type="category"
                      dataKey="vehicle_name"
                      width={70}
                      tick={{
                        fill: "#ffffff66",
                        fontSize: 9,
                      }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="efficiency"
                      fill="#22c55e"
                      radius={[0, 3, 3, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-sm border border-white/5 bg-[#111111]/80">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">
              Recent Trips
            </h3>
            <Route
              size={16}
              className="text-blue-400"
            />
          </div>
          <div className="divide-y divide-white/5">
            {overview.recent_trips.length === 0 ? (
              <p className="p-8 text-center text-xs text-white/35">
                No trip activity is available.
              </p>
            ) : (
              overview.recent_trips.map((trip) => (
                <div
                  key={trip.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-bold text-blue-400">
                      {trip.trip_code}
                    </p>
                    <p className="truncate text-sm font-medium text-white/80">
                      {trip.route}
                    </p>
                    <p className="mt-1 text-[10px] text-white/35">
                      {trip.vehicle} • {trip.driver}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-bold uppercase ${statusClass(
                        trip.status,
                      )}`}
                    >
                      {trip.status}
                    </span>
                    <p className="mt-1 text-[9px] text-white/30">
                      {formatDateTime(
                        trip.updated_at,
                      )}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-sm border border-white/5 bg-[#111111]/80">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">
              Unread Operational Alerts
            </h3>
            <Bell
              size={16}
              className="text-amber-400"
            />
          </div>
          <div className="divide-y divide-white/5">
            {overview.notifications.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2
                  size={28}
                  className="mx-auto text-emerald-400"
                />
                <p className="mt-2 text-xs text-white/45">
                  No unread operational alerts.
                </p>
              </div>
            ) : (
              overview.notifications.map(
                (notification) => (
                  <div
                    key={notification.id}
                    className="flex gap-3 px-5 py-4"
                  >
                    <div className="mt-0.5 rounded-sm bg-amber-500/10 p-2 text-amber-400">
                      <ShieldAlert size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white/75">
                        {notification.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-white/40">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-[9px] text-white/25">
                        {formatDateTime(
                          notification.created_at,
                        )}
                      </p>
                    </div>
                  </div>
                ),
              )
            )}
          </div>
        </section>
      </div>

      {(overview.recent_maintenance.length > 0 ||
        overview.licence_alerts.length > 0) && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {overview.recent_maintenance.length >
            0 && (
            <section className="rounded-sm border border-white/5 bg-[#111111]/80">
              <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">
                  Recent Maintenance
                </h3>
                <Wrench
                  size={16}
                  className="text-blue-400"
                />
              </div>
              <div className="divide-y divide-white/5">
                {overview.recent_maintenance.map(
                  (record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between gap-4 px-5 py-4"
                    >
                      <div>
                        <p className="font-mono text-[10px] text-blue-400">
                          {record.vehicle}
                        </p>
                        <p className="text-xs font-medium text-white/75">
                          {record.maintenance_type}
                        </p>
                        <p className="mt-1 text-[9px] text-white/30">
                          Expected{" "}
                          {
                            record.expected_completion_date
                          }
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase ${statusClass(
                          record.status,
                        )}`}
                      >
                        {record.status}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </section>
          )}

          {overview.licence_alerts.length > 0 && (
            <section className="rounded-sm border border-white/5 bg-[#111111]/80">
              <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">
                  Licence Attention
                </h3>
                <ShieldAlert
                  size={16}
                  className="text-red-400"
                />
              </div>
              <div className="divide-y divide-white/5">
                {overview.licence_alerts
                  .slice(0, 6)
                  .map((alert) => (
                    <div
                      key={alert.driver_id}
                      className="flex items-center justify-between gap-4 px-5 py-4"
                    >
                      <div>
                        <p className="text-xs font-medium text-white/75">
                          {alert.driver_name}
                        </p>
                        <p className="mt-1 font-mono text-[9px] text-white/30">
                          {alert.licence} •{" "}
                          {alert.expiry}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-[9px] font-bold ${statusClass(
                          alert.status,
                        )}`}
                      >
                        {alert.status.replaceAll(
                          "_",
                          " ",
                        )}
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      )}

      {overview.recent_activity.length > 0 && (
        <section className="rounded-sm border border-white/5 bg-[#111111]/80">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">
              Recent Activity
            </h3>
            <Clock3
              size={16}
              className="text-blue-400"
            />
          </div>
          <div className="grid grid-cols-1 gap-px bg-white/5 md:grid-cols-2">
            {overview.recent_activity.map(
              (entry) => (
                <div
                  key={entry.id}
                  className="bg-[#111111] px-5 py-4"
                >
                  <div className="flex items-center gap-2">
                    <Activity
                      size={13}
                      className="text-blue-400"
                    />
                    <p className="text-xs text-white/70">
                      {entry.action}
                    </p>
                  </div>
                  <p className="mt-1 text-[9px] uppercase tracking-wide text-white/30">
                    {entry.user_name} •{" "}
                    {entry.entity_type} •{" "}
                    {formatDateTime(
                      entry.created_at,
                    )}
                  </p>
                </div>
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
};
