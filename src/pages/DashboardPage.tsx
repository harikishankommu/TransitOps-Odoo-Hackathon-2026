/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.js";
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle,
  AlertCircle,
  Percent,
  Compass,
  DollarSign,
  UserCheck
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from "recharts";

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [summary, setSummary] = useState<any>(null);
  const [vehicleStatusData, setVehicleStatusData] = useState<any[]>([]);
  const [tripStatusData, setTripStatusData] = useState<any[]>([]);
  const [costData, setCostData] = useState<any[]>([]);
  const [efficiencyData, setEfficiencyData] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [licenceAlerts, setLicenceAlerts] = useState<any>({ expired: [], expiring_soon: [] });

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [sum, vStat, tStat, costs, effs, act, lic] = await Promise.all([
        apiFetch("/dashboard/summary"),
        apiFetch("/dashboard/vehicle-status"),
        apiFetch("/dashboard/trip-status"),
        apiFetch("/dashboard/monthly-costs"),
        apiFetch("/dashboard/fuel-efficiency"),
        apiFetch("/dashboard/recent-activity"),
        apiFetch("/dashboard/licence-alerts")
      ]);

      setSummary(sum?.kpi || {
        totalVehicles: 0,
        availableVehicles: 0,
        onTripVehicles: 0,
        inMaintenanceVehicles: 0,
        totalDrivers: 0,
        availableDrivers: 0,
        onTripDrivers: 0,
        activeTrips: 0,
        draftTrips: 0,
        fleetUtilization: 0,
        totalFuelCost: 0,
        totalMaintenanceCost: 0,
        totalOperationalCost: 0
      });
      setVehicleStatusData(vStat || []);
      setTripStatusData(tStat || []);
      setCostData(costs || []);
      setEfficiencyData(effs || []);
      setRecentActivities(act || []);
      setLicenceAlerts(lic || { expired: [], expiring_soon: [] });
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-white/50 space-y-4">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-sm animate-spin"></div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Syncing Telemetry Engine...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-950/20 border border-red-900/40 text-red-200 p-6 rounded-sm flex items-center gap-4">
        <AlertTriangle size={24} className="text-red-400" />
        <div>
          <h4 className="font-bold font-sans text-sm">OPERATIONAL DIAGNOSTIC ERROR</h4>
          <p className="text-xs text-red-400/80 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const COLORS = ["#3b82f6", "#60a5fa", "#2563eb", "#1d4ed8"];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-blue-500 font-bold mb-1.5">
            Operations Control Room
          </div>
          <h2 className="text-3xl font-light tracking-tight text-white font-sans">
            FLEET <span className="italic font-serif font-light text-blue-500">operations</span> COMMAND
          </h2>
          <p className="text-xs text-white/50 mt-1">Live telemetries, dispatch summaries, and core licensing audits</p>
        </div>
        <div className="bg-[#111111]/80 border border-white/5 px-4 py-2 rounded-sm flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
          <span className="text-[9px] font-mono text-blue-400 font-bold uppercase tracking-[0.15em]">
            TELEMETRY ONLINE
          </span>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1 */}
        <div className="bg-[#111111]/80 border border-white/5 border-l-2 border-l-blue-500 rounded-sm p-6 relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Fleet Utilization</span>
            <div className="bg-blue-500/10 text-blue-400 p-2 rounded-sm">
              <Percent size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-light text-white tracking-tight">{summary.fleetUtilization}%</h3>
            <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wide">Vehicles dispatched vs inactive</p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-[#111111]/80 border border-white/5 border-l-2 border-l-blue-400 rounded-sm p-6 relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Active Dispatches</span>
            <div className="bg-blue-500/10 text-blue-400 p-2 rounded-sm">
              <Compass size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-light text-white tracking-tight">{summary.activeTrips}</h3>
            <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wide">{summary.draftTrips} draft planning logs</p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-[#111111]/80 border border-white/5 border-l-2 border-l-blue-500 rounded-sm p-6 relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Operational Cost</span>
            <div className="bg-blue-500/10 text-blue-400 p-2 rounded-sm">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-light text-white tracking-tight">
              Rs. {(summary?.totalOperationalCost ?? 0).toLocaleString()}
            </h3>
            <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wide font-mono">
              Fuel: Rs. {(summary?.totalFuelCost ?? 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-[#111111]/80 border border-white/5 border-l-2 border-l-blue-400 rounded-sm p-6 relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Available Assets</span>
            <div className="bg-blue-500/10 text-blue-400 p-2 rounded-sm">
              <UserCheck size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-light text-white tracking-tight">
              {summary.availableVehicles} v / {summary.availableDrivers} dr
            </h3>
            <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wide font-mono">
              {summary.inMaintenanceVehicles} in workshop
            </p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cost Analysis Chart */}
        <div className="bg-[#111111]/80 border border-white/5 rounded-sm p-6 lg:col-span-2">
          <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
            <h4 className="text-xs uppercase tracking-widest text-white/80 flex items-center gap-2 font-bold">
              <TrendingUp size={14} className="text-blue-400" /> Operational Expense Distribution
            </h4>
            <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">Monthly Cycle</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111111", borderColor: "rgba(255,255,255,0.1)", color: "#ffffff" }}
                  cursor={{ fill: "rgba(255, 255, 255, 0.02)" }}
                />
                <Bar dataKey="cost" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vehicle Status Pie */}
        <div className="bg-[#111111]/80 border border-white/5 rounded-sm p-6 flex flex-col justify-between">
          <div>
            <h4 className="text-xs uppercase tracking-widest text-white/80 font-bold border-b border-white/5 pb-4 mb-4 font-sans">Fleet Status Split</h4>
            <div className="h-44 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vehicleStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {vehicleStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111111", borderColor: "rgba(255,255,255,0.1)", color: "#ffffff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Pie legend */}
          <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider border-t border-white/5 pt-4 mt-2 font-mono">
            {vehicleStatusData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                <span className="text-white/50 capitalize truncate">{entry.name}</span>
                <span className="font-mono text-white/80 font-bold ml-auto">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compliance alerts & activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance warnings */}
        <div className="bg-[#111111]/80 border border-white/5 rounded-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h4 className="text-xs uppercase tracking-widest text-white/80 flex items-center gap-2 font-bold font-sans">
              <AlertTriangle size={14} className="text-rose-400" /> Licence Compliance Alerts
            </h4>
            <span className="text-[9px] uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-sm font-bold tracking-wider">
              CRITICAL
            </span>
          </div>

          <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
            {licenceAlerts.expired.length === 0 && licenceAlerts.expiring_soon.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-white/40">
                <CheckCircle size={32} className="text-blue-500 mb-2" />
                <p className="text-xs font-semibold text-white/70">All Driver Licences Valid</p>
                <p className="text-[11px] text-white/40">No expiring records within 30 days.</p>
              </div>
            ) : (
              <>
                {/* Expired warnings */}
                {licenceAlerts.expired.map((alert: any, idx: number) => (
                  <div key={`exp-${idx}`} className="flex items-start gap-3 bg-red-950/20 border border-red-900/40 p-3 rounded-sm text-sm">
                    <AlertCircle className="text-red-500 stroke-[2.5] mt-0.5" size={16} />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-bold text-white/90">{alert.driver_name}</span>
                        <span className="text-[9px] font-mono font-bold text-red-400 bg-red-950 px-1.5 py-0.5 rounded-sm border border-red-900 uppercase">
                          EXPIRED
                        </span>
                      </div>
                      <p className="text-xs text-white/50 mt-1">
                        Licence <span className="font-mono text-white/75">{alert.licence}</span> has expired on <span className="font-semibold text-red-300">{alert.expiry}</span>.
                      </p>
                    </div>
                  </div>
                ))}

                {/* Expiring soon warnings */}
                {licenceAlerts.expiring_soon.map((alert: any, idx: number) => (
                  <div key={`soon-${idx}`} className="flex items-start gap-3 bg-amber-950/20 border border-amber-900/40 p-3 rounded-sm text-sm">
                    <AlertTriangle className="text-amber-500 stroke-[2.5] mt-0.5" size={16} />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-bold text-white/90">{alert.driver_name}</span>
                        <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-950 px-1.5 py-0.5 rounded-sm border border-amber-900 uppercase">
                          EXPIRING SOON
                        </span>
                      </div>
                      <p className="text-xs text-white/50 mt-1">
                        Licence <span className="font-mono text-white/75">{alert.licence}</span> expires on <span className="font-semibold text-amber-300">{alert.expiry}</span>.
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Audit actions log */}
        <div className="bg-[#111111]/80 border border-white/5 rounded-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h4 className="text-xs uppercase tracking-widest text-white/80 flex items-center gap-2 font-bold font-sans">
              <Clock size={14} className="text-blue-400" /> Recent Operations Timeline
            </h4>
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Security Audit Logs</span>
          </div>

          <div className="space-y-3.5 max-h-[260px] overflow-y-auto pr-1">
            {recentActivities.map((act) => (
              <div key={act.id} className="flex gap-3 text-sm">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 ring-4 ring-blue-950/40"></div>
                  <div className="flex-1 w-px bg-white/5 my-1"></div>
                </div>
                <div className="flex-1 pb-3 border-b border-white/5">
                  <p className="text-xs text-white/70">
                    <span className="font-bold text-white">{act.user_name}</span> {act.action}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-mono text-white/30">
                      {new Date(act.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-[8px] font-mono font-bold text-blue-400 bg-blue-500/10 px-1 py-0.2 rounded-sm border border-blue-500/20 uppercase tracking-wider">
                      {act.entity_type}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
