/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.js";
import { TripStatus, UserRole } from "../types.js";
import { Plus, Search, AlertTriangle, Eye, Navigation, Route, Calendar, ShieldAlert } from "lucide-react";

interface TripsPageProps {
  onViewDetails: (tripId: string) => void;
}

export const TripsPage: React.FC<TripsPageProps> = ({ onViewDetails }) => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Options for form
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Create Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    source: "",
    destination: "",
    vehicle_id: "",
    driver_id: "",
    cargo_description: "",
    cargo_weight: "",
    planned_distance: "",
    planned_start_time: "",
    revenue: "",
    notes: "",
  });

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        search,
        status: statusFilter,
      });
      const data = await apiFetch(`/trips?${query.toString()}`);
      setTrips(data);
    } catch (err: any) {
      setError(err.message || "Failed to load dispatches.");
    } finally {
      setLoading(false);
    }
  };

  const loadFormOptions = async () => {
    try {
      const [vAvail, dAvail] = await Promise.all([
        apiFetch("/vehicles/available"),
        apiFetch("/drivers/available"),
      ]);
      setAvailableVehicles(vAvail);
      setAvailableDrivers(dAvail);
    } catch (e) {
      console.error("Failed to load options", e);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [search, statusFilter]);

  useEffect(() => {
    if (showAddModal) {
      loadFormOptions();
    }
  }, [showAddModal]);

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");

    try {
      await apiFetch("/trips", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          cargo_weight: Number(form.cargo_weight),
          planned_distance: Number(form.planned_distance),
          revenue: Number(form.revenue || 0),
        }),
      });

      setSuccessMsg("Draft trip created successfully. Open details to Dispatch.");
      setShowAddModal(false);
      setForm({
        source: "",
        destination: "",
        vehicle_id: "",
        driver_id: "",
        cargo_description: "",
        cargo_weight: "",
        planned_distance: "",
        planned_start_time: "",
        revenue: "",
        notes: "",
      });
      fetchTrips();
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: any) {
      setFormError(err.message || "Failed to create trip planning.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditClick = (trip: any) => {
    onViewDetails(trip.id);
  };

  // Find selected vehicle specs for live capacity warning
  const selectedVehicle = availableVehicles.find(v => v.id === form.vehicle_id);
  const isOverweight = selectedVehicle && form.cargo_weight && Number(form.cargo_weight) > selectedVehicle.maximum_load_capacity;

  const isDispatcherOrAdmin = user && [UserRole.ADMIN, UserRole.DISPATCHER].includes(user.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Dispatches & Trips</h2>
          <p className="text-sm text-slate-400">Manage route planning, dispatch controls, and active transit audits</p>
        </div>
        {isDispatcherOrAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>Create New Trip</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="bg-emerald-950/40 border border-emerald-900 text-emerald-200 px-4 py-3 rounded-lg text-sm font-semibold">
          {successMsg}
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row gap-4 items-end">
        {/* Search */}
        <div className="space-y-1.5 flex-1 w-full">
          <label className="text-xs font-semibold text-slate-400 uppercase">Search dispatches</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, source, destination, cargo..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Status */}
        <div className="space-y-1.5 w-full md:w-48">
          <label className="text-xs font-semibold text-slate-400 uppercase">Trip Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Statuses</option>
            {Object.values(TripStatus).map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Trips Cards Board */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 font-mono text-sm uppercase">
          Loading dispatches rosters...
        </div>
      ) : trips.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center text-slate-500">
          <AlertTriangle className="mx-auto text-slate-600 mb-3" size={36} />
          <p className="font-bold text-slate-400">No Trips Planned</p>
          <p className="text-xs text-slate-500 mt-1">
            {user?.role === UserRole.DRIVER
              ? "You do not have any trips currently assigned to your account."
              : "No dispatches logged under these filters. Create a new trip."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {trips.map((t) => (
            <div
              key={t.id}
              className="bg-slate-900 border border-slate-800/85 rounded-xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              {/* Header card info */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/30 px-2.5 py-0.5 rounded">
                    {t.trip_code}
                  </span>
                  {/* status badge */}
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    t.status === TripStatus.DRAFT ? "bg-slate-800 text-slate-400" :
                    t.status === TripStatus.DISPATCHED ? "bg-blue-950 text-blue-400 border border-blue-900/40" :
                    t.status === TripStatus.COMPLETED ? "bg-emerald-950 text-emerald-400 border border-emerald-900/40" :
                    "bg-red-950 text-red-400 border border-red-900/40"
                  }`}>
                    {t.status}
                  </span>
                </div>

                {/* Route specs */}
                <div className="flex items-center gap-3">
                  <div className="bg-slate-950 p-2 rounded-lg text-slate-400">
                    <Navigation size={18} className="rotate-45" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-100 text-base">
                      {t.source} → {t.destination}
                    </h4>
                    <p className="text-xs text-slate-500 font-mono">Planned Dist: {t.planned_distance} km</p>
                  </div>
                </div>

                {/* Cargo */}
                <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/40 text-xs text-slate-400 space-y-1">
                  <div>
                    <span className="font-semibold text-slate-300">Cargo:</span> {t.cargo_description}
                  </div>
                  <div className="flex justify-between font-mono">
                    <span>Weight: <span className="text-slate-200">{(t.cargo_weight ?? 0).toLocaleString()} kg</span></span>
                    <span>Capacity: <span className="text-slate-400">{(t.vehicle_capacity ?? 0).toLocaleString()} kg</span></span>
                  </div>
                </div>

                {/* Vehicle & Driver links */}
                <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-semibold">Vehicle Specs</span>
                    <span className="font-semibold text-slate-300 truncate block mt-0.5">
                      {t.vehicle_name}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-semibold">Assigned Driver</span>
                    <span className="font-semibold text-slate-300 truncate block mt-0.5">
                      {t.driver_name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action triggers */}
              <div className="border-t border-slate-800/60 pt-4 mt-5 flex justify-between items-center text-xs">
                <span className="text-slate-500 flex items-center gap-1">
                  <Calendar size={12} /> {new Date(t.planned_start_time).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                <button
                  onClick={() => handleEditClick(t)}
                  className="bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 text-slate-300 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Eye size={12} /> Open Control Sheet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Trip Modal Form */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3.5 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Route size={18} className="text-emerald-400" /> Route Dispatch Planner
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 hover:text-slate-300 text-lg font-bold bg-transparent border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 bg-red-950/40 border border-red-900 text-red-200 p-3 rounded text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateTrip} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Route Source
                  </label>
                  <input
                    type="text"
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    placeholder="Patna"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Route Destination
                  </label>
                  <input
                    type="text"
                    value={form.destination}
                    onChange={(e) => setForm({ ...form, destination: e.target.value })}
                    placeholder="Gaya"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
              </div>

              {/* Vehicle selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Assign Fleet Vehicle (Available Only)
                </label>
                <select
                  value={form.vehicle_id}
                  onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                  required
                >
                  <option value="">Select a vehicle...</option>
                  {availableVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_name} ({v.registration_number}) - Cap: {v.maximum_load_capacity} kg
                    </option>
                  ))}
                </select>
                {selectedVehicle && (
                  <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                    Selected Vehicle Limit: {(selectedVehicle.maximum_load_capacity ?? 0).toLocaleString()} kg
                  </span>
                )}
              </div>

              {/* Driver selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Assign Operator (Available & Compliant Only)
                </label>
                <select
                  value={form.driver_id}
                  onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                  required
                >
                  <option value="">Select a driver...</option>
                  {availableDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} (DL: {d.licence_number}, Score: {d.safety_score})
                    </option>
                  ))}
                </select>
              </div>

              {/* Cargo info */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Cargo description
                  </label>
                  <input
                    type="text"
                    value={form.cargo_description}
                    onChange={(e) => setForm({ ...form, cargo_description: e.target.value })}
                    placeholder="Agricultural seeds / Stationery"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Cargo Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={form.cargo_weight}
                    onChange={(e) => setForm({ ...form, cargo_weight: e.target.value })}
                    placeholder="450"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-700"
                    required
                  />
                </div>
              </div>

              {/* Overweight live capacity warning indicator */}
              {isOverweight && (
                <div className="bg-rose-950/40 border border-rose-900 text-rose-300 px-4 py-3 rounded-lg text-xs flex gap-2.5 items-start">
                  <ShieldAlert className="text-rose-400 stroke-[2.5] shrink-0" size={16} />
                  <div>
                    <span className="font-bold uppercase tracking-wide block">Weight Limit Violated</span>
                    Cargo weight of {form.cargo_weight} kg exceeds selected vehicle {selectedVehicle.vehicle_name}'s maximum capacity of {selectedVehicle.maximum_load_capacity} kg. Dispatch will be rejected by the backend server.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Planned Distance (km)
                  </label>
                  <input
                    type="number"
                    value={form.planned_distance}
                    onChange={(e) => setForm({ ...form, planned_distance: e.target.value })}
                    placeholder="105"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Dispatched Revenue (Rs.)
                  </label>
                  <input
                    type="number"
                    value={form.revenue}
                    onChange={(e) => setForm({ ...form, revenue: e.target.value })}
                    placeholder="12000"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Scheduled Start
                  </label>
                  <input
                    type="datetime-local"
                    value={form.planned_start_time}
                    onChange={(e) => setForm({ ...form, planned_start_time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Dispatch Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional delivery instructions or dispatch route cautions..."
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 h-16 resize-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-transparent border border-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition-colors"
                >
                  {formLoading ? "Saving Draft..." : "Create Draft Dispatch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
