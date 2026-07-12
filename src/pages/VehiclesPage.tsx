/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.js";
import { VehicleStatus, VehicleType, FuelType, UserRole } from "../types.js";
import { Plus, Search, Filter, Trash, AlertTriangle, Eye, RefreshCw } from "lucide-react";

interface VehiclesPageProps {
  onViewDetails: (vehicleId: string) => void;
}

export const VehiclesPage: React.FC<VehiclesPageProps> = ({ onViewDetails }) => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters & Queries
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [totalVehicles, setTotalVehicles] = useState(0);

  // Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState({
    registration_number: "",
    vehicle_name: "",
    model: "",
    vehicle_type: VehicleType.VAN,
    maximum_load_capacity: "",
    odometer: "",
    acquisition_cost: "",
    region: "Patna",
    manufacture_year: new Date().getFullYear().toString(),
    fuel_type: FuelType.DIESEL,
  });

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        search,
        status: statusFilter,
        vehicle_type: typeFilter,
        region: regionFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: page.toString(),
        page_size: "10",
      });

      const res = await apiFetch(`/vehicles?${query.toString()}`);
      setVehicles(res.data);
      setTotalVehicles(res.total);
    } catch (err: any) {
      setError(err.message || "Failed to load vehicles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, [search, statusFilter, typeFilter, regionFilter, sortBy, sortOrder, page]);

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");

    try {
      await apiFetch("/vehicles", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          maximum_load_capacity: Number(form.maximum_load_capacity),
          odometer: Number(form.odometer || 0),
          acquisition_cost: Number(form.acquisition_cost || 0),
          manufacture_year: Number(form.manufacture_year),
        }),
      });

      setSuccessMsg("Vehicle registered successfully.");
      setShowAddModal(false);
      // Reset form
      setForm({
        registration_number: "",
        vehicle_name: "",
        model: "",
        vehicle_type: VehicleType.VAN,
        maximum_load_capacity: "",
        odometer: "",
        acquisition_cost: "",
        region: "Patna",
        manufacture_year: new Date().getFullYear().toString(),
        fuel_type: FuelType.DIESEL,
      });
      fetchVehicles();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setFormError(err.message || "Failed to add vehicle.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleRetireVehicle = async (vehicleId: string) => {
    if (!confirm("Are you sure you want to retire this vehicle? Retired vehicles cannot be dispatched on trips.")) return;
    try {
      await apiFetch(`/vehicles/${vehicleId}`, {
        method: "PUT",
        body: JSON.stringify({ status: VehicleStatus.RETIRED }),
      });
      setSuccessMsg("Vehicle status marked as RETIRED.");
      fetchVehicles();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const isElevated = user && [UserRole.ADMIN, UserRole.FLEET_MANAGER].includes(user.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Vehicles Fleet</h2>
          <p className="text-sm text-slate-400">Inventory profiles, load capacity constraints, and status track</p>
        </div>
        {isElevated && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>Add New Vehicle</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="bg-emerald-950/40 border border-emerald-900 text-emerald-200 px-4 py-3 rounded-lg text-sm font-semibold">
          {successMsg}
        </div>
      )}

      {/* Query Filters Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        {/* Search */}
        <div className="space-y-1.5 col-span-1 md:col-span-2">
          <label className="text-xs font-semibold text-slate-400 uppercase">Search Fleet</label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search registration, name, model..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Status filter */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase">Filter Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Statuses</option>
            {Object.values(VehicleStatus).map((st) => (
              <option key={st} value={st}>
                {st.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase">Filter Vehicle Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Types</option>
            {Object.values(VehicleType).map((vt) => (
              <option key={vt} value={vt}>
                {vt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sorting configuration */}
      <div className="flex justify-between items-center bg-slate-900/40 px-4 py-3 rounded-lg border border-slate-800 text-xs">
        <div className="flex gap-4 text-slate-400">
          <span>Sort:</span>
          <button
            onClick={() => {
              setSortBy("registration_number");
              setSortOrder(sortOrder === "asc" ? "desc" : "asc");
            }}
            className={`hover:text-emerald-400 font-medium cursor-pointer ${sortBy === "registration_number" ? "text-emerald-400 font-bold" : ""}`}
          >
            Reg Number {sortBy === "registration_number" && (sortOrder === "asc" ? "▲" : "▼")}
          </button>
          <button
            onClick={() => {
              setSortBy("acquisition_cost");
              setSortOrder(sortOrder === "asc" ? "desc" : "asc");
            }}
            className={`hover:text-emerald-400 font-medium cursor-pointer ${sortBy === "acquisition_cost" ? "text-emerald-400 font-bold" : ""}`}
          >
            Acquisition Cost {sortBy === "acquisition_cost" && (sortOrder === "asc" ? "▲" : "▼")}
          </button>
        </div>
        <div className="text-slate-500 font-mono">
          Total: <span className="text-slate-300 font-bold">{totalVehicles}</span> units
        </div>
      </div>

      {/* Table listing */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-mono text-sm uppercase tracking-wider">
            Loading vehicle records...
          </div>
        ) : vehicles.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <AlertTriangle className="mx-auto text-slate-600 mb-3" size={36} />
            <p className="font-bold text-slate-400">No Vehicles Registered</p>
            <p className="text-xs text-slate-500 mt-1">Adjust filters or create a new fleet item profile.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Reg Number</th>
                  <th className="px-6 py-4">Vehicle Details</th>
                  <th className="px-6 py-4">Type / Fuel</th>
                  <th className="px-6 py-4">Capacity</th>
                  <th className="px-6 py-4">Odometer</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-100">
                      {v.registration_number}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-200">{v.vehicle_name}</div>
                      <div className="text-xs text-slate-500">{v.model} ({v.manufacture_year})</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-300">{v.vehicle_type}</div>
                      <div className="text-xs text-slate-500">{v.fuel_type}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-300">
                      {(v.maximum_load_capacity ?? 0).toLocaleString()} kg
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-300">
                      {(v.odometer ?? 0).toLocaleString()} km
                    </td>
                    <td className="px-6 py-4">
                      {v.status === VehicleStatus.AVAILABLE && (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-900/50">
                          Available
                        </span>
                      )}
                      {v.status === VehicleStatus.ON_TRIP && (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-900/50">
                          On Trip
                        </span>
                      )}
                      {v.status === VehicleStatus.IN_SHOP && (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-900/50">
                          In Shop
                        </span>
                      )}
                      {v.status === VehicleStatus.RETIRED && (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-955 text-slate-400 border border-slate-800">
                          Retired
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2.5">
                      <button
                        onClick={() => onViewDetails(v.id)}
                        className="text-slate-400 hover:text-white inline-flex items-center gap-1 text-xs cursor-pointer"
                        title="View Ledger"
                      >
                        <Eye size={14} /> View
                      </button>
                      {isElevated && v.status !== VehicleStatus.RETIRED && (
                        <button
                          onClick={() => handleRetireVehicle(v.id)}
                          className="text-red-400 hover:text-red-300 inline-flex items-center gap-1 text-xs cursor-pointer"
                          disabled={v.status === VehicleStatus.ON_TRIP}
                          title={v.status === VehicleStatus.ON_TRIP ? "Cannot retire vehicle currently on trip" : "Retire vehicle"}
                        >
                          <Trash size={14} /> Retire
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {totalVehicles > 10 && (
          <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex justify-between items-center text-xs">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 rounded hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
            >
              Previous
            </button>
            <span className="text-slate-400 font-mono">
              Page {page} of {Math.ceil(totalVehicles / 10)}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil(totalVehicles / 10)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 rounded hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Add Vehicle Modal Form */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3.5 mb-5">
              <h3 className="text-lg font-bold text-white">Add New Vehicle Profile</h3>
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

            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    value={form.registration_number}
                    onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                    placeholder="BR01AB1234"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-700 uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Vehicle Descriptive Name
                  </label>
                  <input
                    type="text"
                    value={form.vehicle_name}
                    onChange={(e) => setForm({ ...form, vehicle_name: e.target.value })}
                    placeholder="Van-05"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-700"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="Tata Winger"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Manufacture Year
                  </label>
                  <input
                    type="number"
                    value={form.manufacture_year}
                    onChange={(e) => setForm({ ...form, manufacture_year: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Vehicle Type
                  </label>
                  <select
                    value={form.vehicle_type}
                    onChange={(e) => setForm({ ...form, vehicle_type: e.target.value as VehicleType })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                  >
                    {Object.values(VehicleType).map((vt) => (
                      <option key={vt} value={vt}>
                        {vt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Fuel Type
                  </label>
                  <select
                    value={form.fuel_type}
                    onChange={(e) => setForm({ ...form, fuel_type: e.target.value as FuelType })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                  >
                    {Object.values(FuelType).map((ft) => (
                      <option key={ft} value={ft}>
                        {ft}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Max Capacity (kg)
                  </label>
                  <input
                    type="number"
                    value={form.maximum_load_capacity}
                    onChange={(e) => setForm({ ...form, maximum_load_capacity: e.target.value })}
                    placeholder="1200"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Initial Odometer (km)
                  </label>
                  <input
                    type="number"
                    value={form.odometer}
                    onChange={(e) => setForm({ ...form, odometer: e.target.value })}
                    placeholder="15000"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Acquisition Cost (Rs.)
                  </label>
                  <input
                    type="number"
                    value={form.acquisition_cost}
                    onChange={(e) => setForm({ ...form, acquisition_cost: e.target.value })}
                    placeholder="850000"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Operating Hub / Region
                </label>
                <input
                  type="text"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  placeholder="Patna"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
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
                  {formLoading ? "Saving Profile..." : "Register Vehicle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
