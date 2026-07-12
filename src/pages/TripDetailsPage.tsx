/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Ban,
  Calendar,
  CheckCircle,
  Compass,
  Edit3,
  Fuel,
  Gauge,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Truck,
  User,
} from "lucide-react";

import { CompleteTripModal } from "../components/CompleteTripModal.js";
import { TripFormModal } from "../components/TripFormModal.js";
import { useAuth } from "../context/AuthContext.js";
import {
  DriverStatus,
  type Trip,
  TripStatus,
  UserRole,
  VehicleStatus,
} from "../types.js";
import { apiFetch } from "../utils/api.js";

interface TripDetailsPageProps {
  tripId: string;
  onBack: () => void;
}

interface TripDetails extends Trip {
  vehicle_name: string;
  vehicle_registration: string;
  vehicle_capacity: number;
  vehicle_odometer: number;
  vehicle_status: VehicleStatus;
  driver_name: string;
  driver_licence: string;
  driver_licence_expiry: string;
  driver_phone: string;
  driver_score: number;
  driver_status: DriverStatus;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The trip operation failed.";
}

function statusClasses(status: TripStatus): string {
  switch (status) {
    case TripStatus.DISPATCHED:
      return "border-blue-900/50 bg-blue-950/50 text-blue-400";
    case TripStatus.COMPLETED:
      return "border-emerald-900/50 bg-emerald-950/50 text-emerald-400";
    case TripStatus.CANCELLED:
      return "border-red-900/50 bg-red-950/50 text-red-400";
    default:
      return "border-slate-700 bg-slate-950 text-slate-400";
  }
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

export const TripDetailsPage: React.FC<
  TripDetailsPageProps
> = ({ tripId, onBack }) => {
  const { user } = useAuth();
  const [trip, setTrip] = useState<TripDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] =
    useState(false);

  const loadDetails = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch<TripDetails>(
        `/trips/${tripId}`,
      );
      setTrip(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setTrip(null);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const showSuccess = (message: string): void => {
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(""), 4500);
  };

  const runTransition = async (
    endpoint: "dispatch" | "cancel",
    confirmation: string,
    success: string,
  ): Promise<void> => {
    if (!window.confirm(confirmation)) {
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      await apiFetch(`/trips/${tripId}/${endpoint}`, {
        method: "POST",
      });
      showSuccess(success);
      await loadDetails();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (
      !trip ||
      !window.confirm(
        `Permanently delete ${trip.trip_code}? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      await apiFetch(`/trips/${trip.id}`, {
        method: "DELETE",
      });
      onBack();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-slate-400">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <p className="font-mono text-xs uppercase tracking-wider">
          Loading Trip Control Sheet...
        </p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white"
        >
          <ArrowLeft size={14} /> Back to trips
        </button>
        <div className="rounded-lg border border-red-900 bg-red-950/30 p-5 text-sm text-red-200">
          <p>{error || "Trip not found."}</p>
          <button
            type="button"
            onClick={() => void loadDetails()}
            className="mt-3 inline-flex items-center gap-2 font-bold text-red-300 hover:text-white"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const isDispatcherOrAdmin = Boolean(
    user &&
      [UserRole.ADMIN, UserRole.DISPATCHER].includes(
        user.role,
      ),
  );
  const canComplete = Boolean(
    user &&
      [
        UserRole.ADMIN,
        UserRole.DISPATCHER,
        UserRole.DRIVER,
      ].includes(user.role) &&
      trip.status === TripStatus.DISPATCHED,
  );
  const canDelete = Boolean(
    user?.role === UserRole.ADMIN &&
      [TripStatus.DRAFT, TripStatus.CANCELLED].includes(
        trip.status,
      ),
  );
  const capacityUsage =
    trip.vehicle_capacity > 0
      ? (trip.cargo_weight / trip.vehicle_capacity) * 100
      : 0;
  const revenuePerKm =
    trip.planned_distance > 0
      ? trip.revenue / trip.planned_distance
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white"
        >
          <ArrowLeft size={14} /> Back to trips list
        </button>

        <button
          type="button"
          onClick={() => void loadDetails()}
          className="inline-flex items-center gap-2 self-start text-xs font-bold text-slate-400 hover:text-white sm:self-auto"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {successMessage && (
        <div className="rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm font-semibold text-emerald-200">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-6 rounded-xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
          <div className="flex flex-col gap-4 border-b border-slate-800/70 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="rounded border border-emerald-900/40 bg-emerald-950/40 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
                {trip.trip_code}
              </span>
              <h2 className="mt-3 text-2xl font-bold text-white">
                {trip.source} → {trip.destination}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Created {formatDateTime(trip.created_at)}
              </p>
            </div>

            <span
              className={`self-start rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusClasses(trip.status)}`}
            >
              {trip.status}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Cargo
              </span>
              <p className="mt-2 font-semibold text-slate-200">
                {trip.cargo_description}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-400">
                {trip.cargo_weight.toLocaleString()} kg / {trip.vehicle_capacity.toLocaleString()} kg
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${
                    capacityUsage > 100
                      ? "bg-red-500"
                      : capacityUsage > 85
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${Math.min(100, capacityUsage)}%`,
                  }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Revenue
              </span>
              <p className="mt-2 font-mono text-xl font-bold text-emerald-400">
                Rs. {trip.revenue.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Rs. {revenuePerKm.toFixed(2)} per planned km
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-950/30 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="block font-semibold uppercase text-slate-600">
                Planned Departure
              </span>
              <span className="mt-1 block font-mono text-slate-300">
                {formatDateTime(trip.planned_start_time)}
              </span>
            </div>
            <div>
              <span className="block font-semibold uppercase text-slate-600">
                Actual Departure
              </span>
              <span className="mt-1 block font-mono text-slate-300">
                {formatDateTime(trip.actual_start_time)}
              </span>
            </div>
            <div>
              <span className="block font-semibold uppercase text-slate-600">
                Completion
              </span>
              <span className="mt-1 block font-mono text-slate-300">
                {formatDateTime(trip.completed_at)}
              </span>
            </div>
            <div>
              <span className="block font-semibold uppercase text-slate-600">
                Distance
              </span>
              <span className="mt-1 block font-mono text-slate-300">
                {(trip.actual_distance ?? trip.planned_distance).toLocaleString()} km
              </span>
            </div>
          </div>

          {trip.status === TripStatus.COMPLETED && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <Gauge size={18} className="text-blue-400" />
                <div>
                  <span className="block text-[10px] font-semibold uppercase text-slate-600">
                    Final Odometer
                  </span>
                  <span className="font-mono font-bold text-slate-200">
                    {(trip.final_odometer ?? 0).toLocaleString()} km
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <Fuel size={18} className="text-amber-400" />
                <div>
                  <span className="block text-[10px] font-semibold uppercase text-slate-600">
                    Fuel Consumed
                  </span>
                  <span className="font-mono font-bold text-slate-200">
                    {(trip.fuel_consumed ?? 0).toLocaleString()} L
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <CheckCircle
                  size={18}
                  className="text-emerald-400"
                />
                <div>
                  <span className="block text-[10px] font-semibold uppercase text-slate-600">
                    Closure State
                  </span>
                  <span className="font-bold text-emerald-400">
                    Resources Released
                  </span>
                </div>
              </div>
            </div>
          )}

          {trip.notes && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Operational Notes
              </span>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                {trip.notes}
              </p>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="border-b border-slate-800/70 pb-3 font-bold text-slate-100">
              Assigned Resources
            </h3>

            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-slate-950 p-2.5 text-emerald-400">
                <Truck size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase text-slate-600">
                  Vehicle
                </span>
                <p className="truncate font-bold text-slate-200">
                  {trip.vehicle_name}
                </p>
                <p className="font-mono text-xs text-slate-500">
                  {trip.vehicle_registration}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {trip.vehicle_status.replaceAll("_", " ")} • {trip.vehicle_odometer.toLocaleString()} km
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-slate-950 p-2.5 text-emerald-400">
                <User size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase text-slate-600">
                  Driver
                </span>
                <p className="truncate font-bold text-slate-200">
                  {trip.driver_name}
                </p>
                <p className="font-mono text-xs text-slate-500">
                  {trip.driver_licence}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {trip.driver_status.replaceAll("_", " ")} • Score {trip.driver_score}/100
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="border-b border-slate-800/70 pb-3 font-bold text-slate-100">
              Workflow Controls
            </h3>

            {isDispatcherOrAdmin &&
              trip.status === TripStatus.DRAFT && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(true)}
                    disabled={actionLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                  >
                    <Edit3 size={14} /> Edit Draft
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void runTransition(
                        "dispatch",
                        "Dispatch this trip? The selected vehicle and driver will become ON_TRIP.",
                        "Trip dispatched successfully.",
                      )
                    }
                    disabled={actionLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    <Compass size={14} /> Authorize & Dispatch
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void runTransition(
                        "cancel",
                        "Cancel this draft trip?",
                        "Draft trip cancelled.",
                      )
                    }
                    disabled={actionLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-900/60 bg-red-950/20 px-4 py-3 text-xs font-bold text-red-400 hover:bg-red-950/40 disabled:opacity-50"
                  >
                    <Ban size={14} /> Cancel Draft
                  </button>
                </>
              )}

            {canComplete && (
              <button
                type="button"
                onClick={() => setShowCompleteModal(true)}
                disabled={actionLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                <CheckCircle size={14} /> Complete Trip
              </button>
            )}

            {isDispatcherOrAdmin &&
              trip.status === TripStatus.DISPATCHED && (
                <button
                  type="button"
                  onClick={() =>
                    void runTransition(
                      "cancel",
                      "Abort this active trip? The vehicle and driver will be released.",
                      "Active trip cancelled and resources released.",
                    )
                  }
                  disabled={actionLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-900/60 bg-red-950/20 px-4 py-3 text-xs font-bold text-red-400 hover:bg-red-950/40 disabled:opacity-50"
                >
                  <Ban size={14} /> Abort Active Trip
                </button>
              )}

            {trip.status === TripStatus.COMPLETED && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-4 text-xs text-emerald-400">
                <CheckCircle size={16} className="shrink-0" />
                <span>
                  This trip is completed. Vehicle and driver resources are available again.
                </span>
              </div>
            )}

            {trip.status === TripStatus.CANCELLED && (
              <div className="flex items-start gap-2 rounded-lg border border-red-900/60 bg-red-950/20 p-4 text-xs text-red-400">
                <ShieldAlert size={16} className="shrink-0" />
                <span>
                  This trip was cancelled and cannot be dispatched again.
                </span>
              </div>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={actionLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-900/60 px-4 py-3 text-xs font-bold text-red-400 hover:bg-red-950/30 disabled:opacity-50"
              >
                <Trash2 size={14} /> Permanently Delete
              </button>
            )}
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-xs text-slate-500">
            <div className="flex items-center gap-2 font-bold uppercase text-slate-400">
              <Calendar size={14} /> Audit Information
            </div>
            <p className="mt-3">Created: {formatDateTime(trip.created_at)}</p>
            <p className="mt-1">Updated: {formatDateTime(trip.updated_at)}</p>
          </section>
        </aside>
      </div>

      {showEditModal && (
        <TripFormModal
          mode="edit"
          trip={trip}
          onClose={() => setShowEditModal(false)}
          onSaved={(message) => {
            setShowEditModal(false);
            showSuccess(message);
            void loadDetails();
          }}
        />
      )}

      {showCompleteModal && (
        <CompleteTripModal
          tripId={trip.id}
          tripCode={trip.trip_code}
          plannedDistance={trip.planned_distance}
          currentOdometer={trip.vehicle_odometer}
          currentRevenue={trip.revenue}
          onClose={() => setShowCompleteModal(false)}
          onCompleted={(message) => {
            setShowCompleteModal(false);
            showSuccess(message);
            void loadDetails();
          }}
        />
      )}
    </div>
  );
};
