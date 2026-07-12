/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.js";
import { TripStatus, UserRole } from "../types.js";
import { ArrowLeft, Navigation, Route, Calendar, User, Truck, ShieldAlert, CheckCircle, Ban, Compass } from "lucide-react";

interface TripDetailsPageProps {
  tripId: string;
  onBack: () => void;
}

export const TripDetailsPage: React.FC<TripDetailsPageProps> = ({ tripId, onBack }) => {
  const { user } = useAuth();
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Complete Form Modal
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [completeForm, setCompleteForm] = useState({
    actual_distance: "",
    fuel_consumed: "",
    actual_end_time: new Date().toISOString().slice(0, 16),
    notes: "",
  });

  const loadDetails = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/trips/${tripId}`);
      setTrip(data);
      // Pre-fill complete form
      setCompleteForm({
        actual_distance: data.planned_distance.toString(),
        fuel_consumed: "15",
        actual_end_time: new Date().toISOString().slice(0, 16),
        notes: "",
      });
    } catch (err: any) {
      setError(err.message || "Failed to load trip details sheet.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [tripId]);

  const handleDispatch = async () => {
    if (!confirm("Confirm dispatch: Are you ready to authorize the driver and vehicle for departure? This locks both assets in ON_TRIP status.")) return;
    try {
      setLoading(true);
      await apiFetch(`/trips/${tripId}/dispatch`, { method: "PATCH" });
      setSuccessMsg("Trip authorized and dispatched successfully.");
      await loadDetails();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setError(err.message || "Dispatch authorization failed.");
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Confirm cancellation: Are you sure you want to CANCEL this dispatch plan? This returns all locked assets back to AVAILABLE status.")) return;
    try {
      setLoading(true);
      await apiFetch(`/trips/${tripId}/cancel`, { method: "PATCH" });
      setSuccessMsg("Dispatch plan cancelled successfully.");
      await loadDetails();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setError(err.message || "Trip cancellation failed.");
      setLoading(false);
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompleteLoading(true);
    setCompleteError("");

    try {
      await apiFetch(`/trips/${tripId}/complete`, {
        method: "PATCH",
        body: JSON.stringify({
          actual_distance: Number(completeForm.actual_distance),
          fuel_consumed: Number(completeForm.fuel_consumed),
          actual_end_time: completeForm.actual_end_time,
          notes: completeForm.notes,
        }),
      });

      setSuccessMsg("Trip operations closed and logged as COMPLETED.");
      setShowCompleteModal(false);
      await loadDetails();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setCompleteError(err.message || "Closing trip operations failed.");
    } finally {
      setCompleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-400 space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-mono text-xs uppercase tracking-wider">Syncing Dispatch Console...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-slate-400 hover:text-white flex items-center gap-2 text-xs cursor-pointer">
          <ArrowLeft size={14} /> Back to dispatches
        </button>
        <div className="bg-red-950/20 border border-red-900 text-red-200 p-5 rounded-lg text-sm">
          {error || "Trip ledger could not be retrieved."}
        </div>
      </div>
    );
  }

  const isDispatcherOrAdmin = user && [UserRole.ADMIN, UserRole.DISPATCHER].includes(user.role);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={onBack}
        className="text-slate-400 hover:text-white flex items-center gap-2 text-xs cursor-pointer bg-transparent border-none"
      >
        <ArrowLeft size={14} /> Back to dispatches list
      </button>

      {successMsg && (
        <div className="bg-emerald-950/40 border border-emerald-900 text-emerald-200 px-4 py-3 rounded-lg text-sm font-semibold">
          {successMsg}
        </div>
      )}

      {/* Control console wrapper */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Route Details Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 lg:col-span-2">
          <div className="flex justify-between items-start border-b border-slate-800/60 pb-4">
            <div>
              <span className="font-mono text-xs text-emerald-400 font-bold bg-emerald-950/50 border border-emerald-900/40 px-2.5 py-0.5 rounded uppercase">
                {trip.trip_code}
              </span>
              <h3 className="text-xl font-bold text-white mt-2 flex items-center gap-2">
                {trip.source} → {trip.destination}
              </h3>
            </div>
            <div>
              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase border ${
                trip.status === TripStatus.DRAFT ? "bg-slate-950 text-slate-400 border-slate-800" :
                trip.status === TripStatus.DISPATCHED ? "bg-blue-950 text-blue-400 border-blue-900/40" :
                trip.status === TripStatus.COMPLETED ? "bg-emerald-950 text-emerald-400 border-emerald-900/40" :
                "bg-red-950 text-red-400 border-red-900/40"
              }`}>
                ● {trip.status}
              </span>
            </div>
          </div>

          {/* Details specs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-slate-300">
            {/* Cargo description */}
            <div className="bg-slate-950/40 border border-slate-800/40 p-4 rounded-xl space-y-1">
              <span className="block text-xs text-slate-500 uppercase font-bold tracking-wider">Cargo Ledger</span>
              <span className="font-bold text-slate-200 block text-sm">{trip.cargo_description}</span>
              <span className="font-mono text-xs text-slate-400 block mt-1">
                Weight: {(trip.cargo_weight ?? 0).toLocaleString()} kg
              </span>
            </div>

            {/* Financial Revenue */}
            <div className="bg-slate-950/40 border border-slate-800/40 p-4 rounded-xl space-y-1">
              <span className="block text-xs text-slate-500 uppercase font-bold tracking-wider">Estimated Revenue</span>
              <span className="font-extrabold text-emerald-400 block text-lg font-mono">
                Rs. {(trip.revenue ?? 0).toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 block">
                Planning Cost Index: Rs. {(trip.revenue / trip.planned_distance).toFixed(1)} / km
              </span>
            </div>
          </div>

          {/* Scheduled / Actual timelines */}
          <div className="bg-slate-950/30 border border-slate-800 rounded-xl p-4 space-y-3.5 text-xs">
            <h4 className="font-bold text-slate-300">Operations Log Sheet</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <span className="text-slate-500 block uppercase font-semibold">Planned Departure</span>
                <span className="font-mono text-slate-300 block mt-1">
                  {trip.planned_start_time ? new Date(trip.planned_start_time).toLocaleString() : "N/A"}
                </span>
              </div>
              {trip.actual_start_time && (
                <div>
                  <span className="text-slate-500 block uppercase font-semibold">Dispatched Departure</span>
                  <span className="font-mono text-slate-300 block mt-1">
                    {trip.actual_start_time ? new Date(trip.actual_start_time).toLocaleString() : "N/A"}
                  </span>
                </div>
              )}
              {trip.actual_end_time && (
                <div>
                  <span className="text-slate-500 block uppercase font-semibold">Arrival Timestamp</span>
                  <span className="font-mono text-slate-300 block mt-1">
                    {trip.actual_end_time ? new Date(trip.actual_end_time).toLocaleString() : "N/A"}
                  </span>
                </div>
              )}
            </div>

            {trip.notes && (
              <div className="border-t border-slate-800/60 pt-3 mt-1">
                <span className="text-slate-500 block uppercase font-semibold mb-1">Dispatcher Cautions</span>
                <p className="text-slate-400 leading-relaxed italic">"{trip.notes}"</p>
              </div>
            )}
          </div>
        </div>

        {/* Assigned Resources & Workflow Sidebar */}
        <div className="space-y-6">
          {/* Asset matches */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h4 className="font-bold text-slate-100 pb-2 border-b border-slate-800/60">Locked Dispatch Resources</h4>

            {/* Vehicle Card */}
            <div className="flex gap-3 items-center text-sm">
              <div className="bg-slate-950 p-2.5 rounded-lg text-emerald-400">
                <Truck size={20} />
              </div>
              <div className="overflow-hidden">
                <span className="block text-[10px] text-slate-500 font-bold uppercase">Asset Profile</span>
                <span className="font-bold text-slate-200 truncate block mt-0.5">{trip.vehicle_name}</span>
                <span className="font-mono text-xs text-slate-400">{trip.vehicle_registration}</span>
              </div>
            </div>

            {/* Driver Card */}
            <div className="flex gap-3 items-center text-sm">
              <div className="bg-slate-950 p-2.5 rounded-lg text-emerald-400">
                <User size={20} />
              </div>
              <div className="overflow-hidden">
                <span className="block text-[10px] text-slate-500 font-bold uppercase">Assigned Operator</span>
                <span className="font-bold text-slate-200 truncate block mt-0.5">{trip.driver_name}</span>
                <span className="font-mono text-xs text-slate-400">Licence: {trip.driver_licence}</span>
              </div>
            </div>
          </div>

          {/* Workflow Transitions Box */}
          {isDispatcherOrAdmin && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h4 className="font-bold text-slate-100 pb-2 border-b border-slate-800/60">Authorize Workflow Transitions</h4>

              {trip.status === TripStatus.DRAFT && (
                <div className="space-y-3">
                  <button
                    onClick={handleDispatch}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 px-4 rounded-lg text-xs cursor-pointer flex items-center justify-center gap-2 transition-colors"
                  >
                    <Compass size={14} className="stroke-[2.5]" />
                    <span>Authorize & Dispatch</span>
                  </button>
                  <button
                    onClick={handleCancel}
                    className="w-full bg-slate-800 hover:bg-red-950/20 hover:text-red-400 border border-slate-700 text-slate-400 font-bold py-3 px-4 rounded-lg text-xs cursor-pointer flex items-center justify-center gap-2 transition-colors"
                  >
                    <Ban size={14} />
                    <span>Cancel Dispatch Plan</span>
                  </button>
                </div>
              )}

              {trip.status === TripStatus.DISPATCHED && (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowCompleteModal(true)}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 px-4 rounded-lg text-xs cursor-pointer flex items-center justify-center gap-2 transition-colors"
                  >
                    <CheckCircle size={14} className="stroke-[2.5]" />
                    <span>Log Arrival & Complete</span>
                  </button>
                  <button
                    onClick={handleCancel}
                    className="w-full bg-slate-800 hover:bg-red-950/20 hover:text-red-400 border border-slate-700 text-slate-400 font-bold py-3 px-4 rounded-lg text-xs cursor-pointer flex items-center justify-center gap-2 transition-colors"
                  >
                    <Ban size={14} />
                    <span>Abort active transit</span>
                  </button>
                </div>
              )}

              {trip.status === TripStatus.COMPLETED && (
                <div className="bg-emerald-950/20 border border-emerald-900/60 p-4 rounded-lg text-xs text-emerald-400 flex gap-2.5 items-start">
                  <CheckCircle size={16} className="shrink-0" />
                  <div>
                    <span className="font-bold uppercase tracking-wide block">Operations Closed</span>
                    This transport log is completed. All assigned vehicle and driver resources have been unlocked and returned to Available status.
                  </div>
                </div>
              )}

              {trip.status === TripStatus.CANCELLED && (
                <div className="bg-red-950/20 border border-red-900/60 p-4 rounded-lg text-xs text-red-400 flex gap-2.5 items-start">
                  <ShieldAlert size={16} className="shrink-0" />
                  <div>
                    <span className="font-bold uppercase tracking-wide block">Dispatch Cancelled</span>
                    This dispatch plan was aborted and logged as cancelled. All locked resources are immediately released.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Completion Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle size={18} className="text-emerald-400" /> Close Operations Sheet
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

            <form onSubmit={handleCompleteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Actual Distance Completed (km)
                </label>
                <input
                  type="number"
                  value={completeForm.actual_distance}
                  onChange={(e) => setCompleteForm({ ...completeForm, actual_distance: e.target.value })}
                  placeholder="Planned was 105 km"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Fuel Consumed during transit (Litres)
                </label>
                <input
                  type="number"
                  value={completeForm.fuel_consumed}
                  onChange={(e) => setCompleteForm({ ...completeForm, fuel_consumed: e.target.value })}
                  placeholder="15"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Actual Arrival Time
                </label>
                <input
                  type="datetime-local"
                  value={completeForm.actual_end_time}
                  onChange={(e) => setCompleteForm({ ...completeForm, actual_end_time: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Final Journey Notes
                </label>
                <textarea
                  value={completeForm.notes}
                  onChange={(e) => setCompleteForm({ ...completeForm, notes: e.target.value })}
                  placeholder="Enter toll receipts details, fuel refuel records, or route notes..."
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 h-16 resize-none"
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
                  {completeLoading ? "Closing Operations..." : "Authorize Completion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
