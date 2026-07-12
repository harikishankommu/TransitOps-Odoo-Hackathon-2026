/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.js";
import { UserRole } from "../types.js";
import { Plus, Search, AlertTriangle, Wrench, CheckCircle, Clock, Check } from "lucide-react";

export const MaintenancePage: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [search, setSearch] = useState("");

  // Start Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    vehicle_id: "",
    maintenance_type: "Routine Oil Change",
    estimated_cost: "",
    service_provider: "",
    description: "",
    start_date: new Date().toISOString().split("T")[0],
  });

  // Complete Form states
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState("");
  const [completeLoading, setCompleteLoading] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [completeForm, setCompleteForm] = useState({
    actual_cost: "",
    completed_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({ search });
      const data = await apiFetch(`/maintenance?${query.toString()}`);
      setLogs(data);
    } catch (err: any) {
      setError(err.message || "Failed to load maintenance records.");
    } finally {
      setLoading(false);
    }
  };

  const loadVehicles = async () => {
    try {
      const vData = await apiFetch("/vehicles/available");
      setVehicles(vData);
    } catch (e) {
      console.error("Failed to load available vehicles", e);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [search]);

  useEffect(() => {
    if (showAddModal) {
      loadVehicles();
    }
  }, [showAddModal]);

  const handleStartMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");

    try {
      await apiFetch("/maintenance", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          estimated_cost: Number(form.estimated_cost),
        }),
      });

      setSuccessMsg("Vehicle marked as IN SHOP. Dispatch is blocked for this asset.");
      setShowAddModal(false);
      setForm({
        vehicle_id: "",
        maintenance_type: "Routine Oil Change",
        estimated_cost: "",
        service_provider: "",
        description: "",
        start_date: new Date().toISOString().split("T")[0],
      });
      fetchLogs();
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: any) {
      setFormError(err.message || "Failed to initiate workshop entry.");
    } finally {
      setFormLoading(false);
    }
  };

  const openCompleteModal = (log: any) => {
    setSelectedLogId(log.id);
    setCompleteForm({
      actual_cost: log.estimated_cost.toString(),
      completed_date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setCompleteError("");
    setShowCompleteModal(true);
  };

  const handleCompleteMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompleteLoading(true);
    setCompleteError("");

    try {
      await apiFetch(`/maintenance/${selectedLogId}/complete`, {
        method: "PATCH",
        body: JSON.stringify({
          actual_cost: Number(completeForm.actual_cost),
          completed_date: completeForm.completed_date,
          notes: completeForm.notes,
        }),
      });

      setSuccessMsg("Maintenance order closed. Vehicle restored to AVAILABLE status.");
      setShowCompleteModal(false);
      fetchLogs();
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: any) {
      setCompleteError(err.message || "Failed to log completion.");
    } finally {
      setCompleteLoading(false);
    }
  };

  const isElevated = user && [UserRole.ADMIN, UserRole.FLEET_MANAGER].includes(user.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Workshop & Servicing</h2>
          <p className="text-sm text-slate-400">Log oil checks, engine tune-ups, workshop records, and restore assets</p>
        </div>
        {isElevated && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>Schedule Workshop Entry</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="bg-emerald-950/40 border border-emerald-900 text-emerald-200 px-4 py-3 rounded-lg text-sm font-semibold">
          {successMsg}
        </div>
      )}

      {/* Query filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <label className="text-xs font-semibold text-slate-400 uppercase block mb-1.5">Search Workshop Log</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by vehicle reg, maintenance type, service provider..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Listings */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-mono text-sm uppercase">
            Loading workshop records...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <AlertTriangle className="mx-auto text-slate-600 mb-3" size={36} />
            <p className="font-bold text-slate-400">No Workshop Logs</p>
            <p className="text-xs text-slate-500 mt-1">Adjust search or register a new service log.</p>
          </div>
        ) : (
          <div className="overflow-x-auto text-sm text-slate-300">
            <table className="w-full text-left">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Vehicle Details</th>
                  <th className="px-6 py-4">Service Details</th>
                  <th className="px-6 py-4">Workshop / Provider</th>
                  <th className="px-6 py-4">Estimated Cost</th>
                  <th className="px-6 py-4">Workflow Status</th>
                  {isElevated && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-100">{log.vehicle_name}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{log.registration_number}</div>
                    </td>
                    <td className="px-6 py-4 space-y-1 max-w-xs">
                      <span className="font-semibold text-slate-200">{log.maintenance_type}</span>
                      <p className="text-xs text-slate-500 line-clamp-1 italic">"{log.description}"</p>
                      <div className="text-[10px] text-slate-500 flex gap-4 font-mono pt-1">
                        <span>Started: {log.start_date}</span>
                        {log.completed_date && <span>Completed: {log.completed_date}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {log.service_provider}
                    </td>
                    <td className="px-6 py-4 font-mono space-y-0.5">
                      <div className="text-slate-400 text-xs">Est: Rs. {(log.estimated_cost ?? 0).toLocaleString()}</div>
                      {log.actual_cost !== null && log.actual_cost !== undefined && (
                        <div className="text-emerald-400 font-bold">Act: Rs. {Number(log.actual_cost).toLocaleString()}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {log.actual_cost === null ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-900/50">
                          <Clock size={12} /> In Workshop
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-900/40">
                          <CheckCircle size={12} /> Closed
                        </span>
                      )}
                    </td>
                    {isElevated && (
                      <td className="px-6 py-4 text-right">
                        {log.actual_cost === null && (
                          <button
                            onClick={() => openCompleteModal(log)}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded text-xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Check size={12} /> Release & Close
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Start Maintenance Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Wrench size={18} className="text-emerald-400" /> Start Workshop Order
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

            <form onSubmit={handleStartMaintenance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Select Vehicle (Available Only)
                </label>
                <select
                  value={form.vehicle_id}
                  onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                  required
                >
                  <option value="">Select a vehicle...</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_name} ({v.registration_number}) - Cap: {v.maximum_load_capacity} kg
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Service Type
                </label>
                <select
                  value={form.maintenance_type}
                  onChange={(e) => setForm({ ...form, maintenance_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                >
                  <option value="Routine Oil Change">Routine Oil Change</option>
                  <option value="Tire Rotation & Replacement">Tire Rotation & Replacement</option>
                  <option value="Brake System Tuneup">Brake System Tuneup</option>
                  <option value="Suspension Maintenance">Suspension Maintenance</option>
                  <option value="Engine Repair log">Engine Repair log</option>
                  <option value="Accident Body Restoration">Accident Body Restoration</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Est Cost (Rs.)
                  </label>
                  <input
                    type="number"
                    value={form.estimated_cost}
                    onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })}
                    placeholder="2500"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Entry Date
                  </label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Workshop Provider / Garage name
                </label>
                <input
                  type="text"
                  value={form.service_provider}
                  onChange={(e) => setForm({ ...form, service_provider: e.target.value })}
                  placeholder="Tata Authorized Garage, Patna"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Service Cautions / Descriptions
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Notes on brake noises or regular filter replacements..."
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 h-16 resize-none"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
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
                  {formLoading ? "Sending to Shop..." : "Mark as In Shop"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Maintenance Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle size={18} className="text-emerald-400" /> Complete Workshop Order
              </h3>
              <button
                onClick={() => setShowCompleteModal(false)}
                className="text-slate-500 hover:text-slate-300 text-lg font-bold bg-transparent border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {completeError && (
              <div className="mb-4 bg-red-950/40 border border-red-900 text-red-200 p-3 rounded text-xs font-semibold">
                {completeError}
              </div>
            )}

            <form onSubmit={handleCompleteMaintenance} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Actual Repair Cost (Rs.)
                  </label>
                  <input
                    type="number"
                    value={completeForm.actual_cost}
                    onChange={(e) => setCompleteForm({ ...completeForm, actual_cost: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Release Date
                  </label>
                  <input
                    type="date"
                    value={completeForm.completed_date}
                    onChange={(e) => setCompleteForm({ ...completeForm, completed_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Workshop Final Comments
                </label>
                <textarea
                  value={completeForm.notes}
                  onChange={(e) => setCompleteForm({ ...completeForm, notes: e.target.value })}
                  placeholder="Engine oil replaced, brake pads restored. All tests passed..."
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 h-20 resize-none"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-transparent border border-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completeLoading}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition-colors"
                >
                  {completeLoading ? "Closing order..." : "Complete Repair & Release"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
