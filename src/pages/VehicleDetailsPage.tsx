/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api.js";
import { VehicleStatus, TripStatus } from "../types.js";
import { ArrowLeft, Truck, Wrench, Route, DollarSign, Fuel, TrendingUp } from "lucide-react";

interface VehicleDetailsPageProps {
  vehicleId: string;
  onBack: () => void;
}

export const VehicleDetailsPage: React.FC<VehicleDetailsPageProps> = ({ vehicleId, onBack }) => {
  const [vehicle, setVehicle] = useState<any>(null);
  const [history, setHistory] = useState<any>({ trips: [], maintenance: [], expenses: [], fuel: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDetails = async () => {
    try {
      setLoading(true);
      const [vData, hData] = await Promise.all([
        apiFetch(`/vehicles/${vehicleId}`),
        apiFetch(`/vehicles/${vehicleId}/history`),
      ]);
      setVehicle(vData);
      setHistory(hData);
    } catch (err: any) {
      setError(err.message || "Failed to load vehicle details ledger.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [vehicleId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-400 space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-mono text-xs uppercase tracking-wider">Syncing Ledger...</p>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-slate-400 hover:text-white flex items-center gap-2 text-xs">
          <ArrowLeft size={14} /> Back to fleet list
        </button>
        <div className="bg-red-950/20 border border-red-900 text-red-200 p-5 rounded-lg text-sm">
          {error || "Vehicle ledger could not be retrieved."}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Financial Math & KPI Aggregates
  // --------------------------------------------------------------------------
  const completedTrips = history.trips.filter((t: any) => t.status === TripStatus.COMPLETED);
  const totalRevenue = completedTrips.reduce((sum: number, t: any) => sum + t.revenue, 0);

  // Operational cost components
  const fuelCost = history.fuel.reduce((sum: number, f: any) => sum + f.fuel_cost, 0);
  const maintenanceCost = history.maintenance.reduce((sum: number, m: any) => sum + (m.actual_cost || 0), 0);
  const otherExpenses = history.expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
  const totalOpCost = fuelCost + maintenanceCost + otherExpenses;

  const netProfit = totalRevenue - totalOpCost;
  
  // ROI: (Revenue - OpCost) / AcquisitionCost * 100
  const roi = vehicle.acquisition_cost > 0 ? (netProfit / vehicle.acquisition_cost) * 100 : 0;

  // Fuel efficiency: total completed distance / total fuel consumed
  const totalDist = completedTrips.reduce((sum: number, t: any) => sum + (t.actual_distance || 0), 0);
  const totalFuel = completedTrips.reduce((sum: number, t: any) => sum + (t.fuel_consumed || 0), 0);
  const fuelEfficiency = totalFuel > 0 ? (totalDist / totalFuel).toFixed(2) : "0.00";

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="text-slate-400 hover:text-white flex items-center gap-2 text-xs cursor-pointer bg-transparent border-none"
      >
        <ArrowLeft size={14} /> Back to fleet inventory list
      </button>

      {/* Asset Overview and specs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Profile info */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 lg:col-span-2">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-xl border border-emerald-900/30">
              <Truck size={28} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                {vehicle.vehicle_name}{" "}
                <span className="font-mono text-sm text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-900">
                  {vehicle.registration_number}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {vehicle.model} • {vehicle.manufacture_year} • {vehicle.vehicle_type}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-800/60 pt-4 text-sm">
            <div>
              <span className="block text-xs text-slate-500 uppercase font-semibold">Asset Status</span>
              <span className={`inline-flex items-center gap-1.5 font-bold mt-1 text-xs capitalize ${
                vehicle.status === VehicleStatus.AVAILABLE ? "text-emerald-400" :
                vehicle.status === VehicleStatus.ON_TRIP ? "text-blue-400" :
                vehicle.status === VehicleStatus.IN_SHOP ? "text-amber-400" : "text-slate-400"
              }`}>
                ● {vehicle.status.replace("_", " ")}
              </span>
            </div>
            <div>
              <span className="block text-xs text-slate-500 uppercase font-semibold">Load capacity</span>
              <span className="font-mono font-bold text-slate-200 mt-1 block">
                {(vehicle.maximum_load_capacity ?? 0).toLocaleString()} kg
              </span>
            </div>
            <div>
              <span className="block text-xs text-slate-500 uppercase font-semibold">Odometer</span>
              <span className="font-mono font-bold text-slate-200 mt-1 block">
                {(vehicle.odometer ?? 0).toLocaleString()} km
              </span>
            </div>
            <div>
              <span className="block text-xs text-slate-500 uppercase font-semibold">Fuel Engine</span>
              <span className="font-semibold text-slate-200 mt-1 block">
                {vehicle.fuel_type}
              </span>
            </div>
          </div>
        </div>

        {/* Financial ROI Dashboard Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="font-bold text-slate-100 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400" /> Vehicle ROI Ledger
              </h4>
              <p className="text-[10px] text-slate-400">Net profitability tracking</p>
            </div>
            <div className="bg-emerald-500/10 text-emerald-400 p-1.5 rounded text-xs font-mono font-semibold">
              {roi.toFixed(1)}% ROI
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Acquisition Value:</span>
              <span className="font-mono text-slate-200">Rs. {(vehicle.acquisition_cost ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Dispatched Revenue:</span>
              <span className="font-mono text-emerald-400 font-bold">Rs. {(totalRevenue ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Operational Costs:</span>
              <span className="font-mono text-red-400">Rs. {(totalOpCost ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-2 text-sm">
              <span className="font-bold text-slate-300">Net Profit / Margin:</span>
              <span className={`font-mono font-bold ${netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                Rs. {(netProfit ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>
        </div>
      </div>

      {/* Operational stats grids */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
            <Route size={18} />
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 uppercase font-semibold">Completed Trips</span>
            <span className="font-mono text-lg font-bold text-slate-200">{completedTrips.length}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Wrench size={18} />
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 uppercase font-semibold">Maintenance Cycles</span>
            <span className="font-mono text-lg font-bold text-slate-200">{history.maintenance.length}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Fuel size={18} />
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 uppercase font-semibold">Fuel Efficiency</span>
            <span className="font-mono text-lg font-bold text-slate-200">{fuelEfficiency} km/L</span>
          </div>
        </div>
      </div>

      {/* Ledger History tables */}
      <div className="space-y-6">
        {/* Maintenance records */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 className="font-bold text-slate-100 mb-4 flex items-center gap-2">
            <Wrench size={16} className="text-amber-400" /> Historical Maintenance Timeline
          </h4>
          {history.maintenance.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">No historical servicing logged for this asset.</p>
          ) : (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-mono border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Service ID</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Service Provider</th>
                    <th className="px-4 py-3">Odometer At Service</th>
                    <th className="px-4 py-3">Cost (Rs.)</th>
                    <th className="px-4 py-3">Date Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {history.maintenance.map((m: any) => (
                    <tr key={m.id} className="hover:bg-slate-800/20 text-slate-300">
                      <td className="px-4 py-3 font-mono text-slate-400">{m.id}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-200">{m.maintenance_type}</span>
                        <div className="text-[10px] text-slate-500 max-w-sm truncate">{m.description}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{m.service_provider}</td>
                      <td className="px-4 py-3 font-mono">{(m.odometer_at_service ?? 0).toLocaleString()} km</td>
                      <td className="px-4 py-3 font-mono text-red-400">Rs. {(m.actual_cost ?? m.estimated_cost ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono">{m.completed_date || m.start_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Trips records */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 className="font-bold text-slate-100 mb-4 flex items-center gap-2">
            <Route size={16} className="text-blue-400" /> Historical Dispatched Trips
          </h4>
          {history.trips.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">No historical transport operations logged for this asset.</p>
          ) : (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-mono border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Trip Code</th>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">Cargo Weight</th>
                    <th className="px-4 py-3">Distance (km)</th>
                    <th className="px-4 py-3">Revenue (Rs.)</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {history.trips.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-800/20 text-slate-300">
                      <td className="px-4 py-3 font-mono font-bold text-slate-400">{t.trip_code}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-200">{t.source} → {t.destination}</span>
                        <div className="text-[10px] text-slate-500">{t.cargo_description}</div>
                      </td>
                      <td className="px-4 py-3 font-mono">{(t.cargo_weight ?? 0).toLocaleString()} kg</td>
                      <td className="px-4 py-3 font-mono">{t.actual_distance || t.planned_distance} km</td>
                      <td className="px-4 py-3 font-mono text-emerald-400">Rs. {(t.revenue ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          t.status === TripStatus.COMPLETED ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40" :
                          t.status === TripStatus.DISPATCHED ? "bg-blue-950/40 text-blue-400 border border-blue-900/40" :
                          t.status === TripStatus.CANCELLED ? "bg-red-950/40 text-red-400 border border-red-900/40" : "bg-slate-800 text-slate-400"
                        }`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
