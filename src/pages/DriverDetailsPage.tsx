/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  Check,
  Pencil,
  Phone,
  RefreshCw,
  Route,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";

import { DriverFormModal } from "../components/DriverFormModal.js";
import { useAuth } from "../context/AuthContext.js";
import {
  type Driver,
  DriverStatus,
  type Trip,
  TripStatus,
  UserRole,
} from "../types.js";
import { apiFetch } from "../utils/api.js";

interface DriverDetailsPageProps {
  driverId: string;
  onBack: () => void;
}

interface LinkedDriverUser {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

interface DriverDetailsResponse extends Driver {
  linked_user: LinkedDriverUser | null;
  licence_status: "VALID" | "EXPIRING_SOON" | "EXPIRED";
}

interface DriverTripHistoryItem extends Trip {
  vehicle_name: string;
  vehicle_registration: string;
}

interface DriverHistoryResponse {
  trips: DriverTripHistoryItem[];
  summary: {
    total_trips: number;
    active_trips: number;
    completed_trips: number;
    cancelled_trips: number;
    total_distance: number;
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to load the driver profile.";
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ");
}

function StatusBadge({ status }: { status: DriverStatus }) {
  const styles: Record<DriverStatus, string> = {
    [DriverStatus.AVAILABLE]:
      "border-emerald-900/50 bg-emerald-950 text-emerald-400",
    [DriverStatus.ON_TRIP]:
      "border-blue-900/50 bg-blue-950 text-blue-400",
    [DriverStatus.OFF_DUTY]:
      "border-amber-900/50 bg-amber-950/30 text-amber-400",
    [DriverStatus.SUSPENDED]:
      "border-red-900/50 bg-red-950 text-red-400",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {formatStatus(status)}
    </span>
  );
}

function TripStatusBadge({ status }: { status: TripStatus }) {
  const styles: Record<TripStatus, string> = {
    [TripStatus.DRAFT]:
      "border-slate-700 bg-slate-800 text-slate-300",
    [TripStatus.DISPATCHED]:
      "border-blue-900/50 bg-blue-950/40 text-blue-400",
    [TripStatus.COMPLETED]:
      "border-emerald-900/50 bg-emerald-950/40 text-emerald-400",
    [TripStatus.CANCELLED]:
      "border-red-900/50 bg-red-950/40 text-red-400",
  };

  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-bold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export const DriverDetailsPage: React.FC<
  DriverDetailsPageProps
> = ({ driverId, onBack }) => {
  const { user } = useAuth();
  const [driver, setDriver] = useState<DriverDetailsResponse | null>(
    null,
  );
  const [history, setHistory] = useState<DriverHistoryResponse>({
    trips: [],
    summary: {
      total_trips: 0,
      active_trips: 0,
      completed_trips: 0,
      cancelled_trips: 0,
      total_distance: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showEditForm, setShowEditForm] = useState(false);

  const canManageProfiles = Boolean(
    user &&
      [
        UserRole.ADMIN,
        UserRole.DISPATCHER,
        UserRole.SAFETY_OFFICER,
      ].includes(user.role),
  );
  const canSanction = Boolean(
    user &&
      [UserRole.ADMIN, UserRole.SAFETY_OFFICER].includes(
        user.role,
      ),
  );
  const canDelete = user?.role === UserRole.ADMIN;

  const loadDetails = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");

    try {
      const [profile, tripHistory] = await Promise.all([
        apiFetch<DriverDetailsResponse>(`/drivers/${driverId}`),
        apiFetch<DriverHistoryResponse>(
          `/drivers/${driverId}/history`,
        ),
      ]);
      setDriver(profile);
      setHistory(tripHistory);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const showSuccess = (message: string): void => {
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(""), 4000);
  };

  const handleSuspend = async (): Promise<void> => {
    if (!driver) return;

    const confirmed = window.confirm(
      `Suspend ${driver.full_name}? Suspended drivers cannot be dispatched.`,
    );
    if (!confirmed) return;

    try {
      await apiFetch(`/drivers/${driver.id}/suspend`, {
        method: "PATCH",
      });
      showSuccess("Driver suspended successfully.");
      await loadDetails();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const handleActivate = async (): Promise<void> => {
    if (!driver) return;

    try {
      await apiFetch(`/drivers/${driver.id}/activate`, {
        method: "PATCH",
      });
      showSuccess("Driver restored to Available.");
      await loadDetails();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!driver) return;

    const confirmed = window.confirm(
      `Permanently delete ${driver.full_name}? Drivers with any trip history cannot be deleted.`,
    );
    if (!confirmed) return;

    try {
      await apiFetch(`/drivers/${driver.id}`, {
        method: "DELETE",
      });
      onBack();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const licenceStyles = useMemo(() => {
    if (!driver) return "";

    if (driver.licence_status === "EXPIRED") {
      return "border-red-900/50 bg-red-950/40 text-red-400";
    }

    if (driver.licence_status === "EXPIRING_SOON") {
      return "border-amber-900/50 bg-amber-950/40 text-amber-400";
    }

    return "border-emerald-900/50 bg-emerald-950/40 text-emerald-400";
  }, [driver]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-slate-400">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <p className="font-mono text-xs uppercase tracking-wider">
          Loading Driver Profile...
        </p>
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white"
        >
          <ArrowLeft size={14} /> Back to driver roster
        </button>
        <div className="rounded-lg border border-red-900 bg-red-950/20 p-5 text-sm text-red-200">
          <p>{error || "Driver profile could not be retrieved."}</p>
          <button
            type="button"
            onClick={() => void loadDetails()}
            className="mt-3 inline-flex items-center gap-1.5 font-bold hover:text-white"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white"
        >
          <ArrowLeft size={14} /> Back to driver roster
        </button>

        <div className="flex flex-wrap gap-2">
          {canManageProfiles &&
            driver.status !== DriverStatus.ON_TRIP && (
              <button
                type="button"
                onClick={() => setShowEditForm(true)}
                className="inline-flex items-center gap-1.5 rounded border border-blue-900/60 bg-blue-950/30 px-3 py-2 text-xs font-bold text-blue-300 hover:bg-blue-950/60"
              >
                <Pencil size={14} /> Edit Profile
              </button>
            )}

          {canSanction &&
            (driver.status === DriverStatus.SUSPENDED ? (
              <button
                type="button"
                onClick={() => void handleActivate()}
                className="inline-flex items-center gap-1.5 rounded border border-emerald-800 bg-emerald-950 px-3 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-900"
              >
                <Check size={14} /> Activate
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSuspend()}
                disabled={driver.status === DriverStatus.ON_TRIP}
                className="inline-flex items-center gap-1.5 rounded border border-red-900/70 bg-red-950/40 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Ban size={14} /> Suspend
              </button>
            ))}

          {canDelete && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={driver.status === DriverStatus.ON_TRIP}
              className="inline-flex items-center gap-1.5 rounded border border-red-950 px-3 py-2 text-xs font-bold text-red-400 hover:border-red-800 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
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
        <section className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-emerald-900/40 bg-emerald-500/10 text-emerald-400">
              <UserRound size={28} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold text-white">
                  {driver.full_name}
                </h2>
                <StatusBadge status={driver.status} />
              </div>
              <p className="mt-1 text-sm text-slate-400">
                {driver.licence_category} · {driver.region}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-slate-800 pt-5 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <span className="block text-[10px] font-semibold uppercase text-slate-500">
                Licence Number
              </span>
              <span className="mt-1 block font-mono text-sm font-bold text-slate-200">
                {driver.licence_number}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold uppercase text-slate-500">
                Licence Expiry
              </span>
              <span className="mt-1 block font-mono text-sm font-bold text-slate-200">
                {driver.licence_expiry_date}
              </span>
              <span
                className={`mt-2 inline-flex rounded border px-2 py-0.5 text-[10px] font-bold ${licenceStyles}`}
              >
                {formatStatus(driver.licence_status)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold uppercase text-slate-500">
                Contact
              </span>
              <span className="mt-1 flex items-center gap-1.5 font-mono text-sm text-slate-200">
                <Phone size={13} /> {driver.contact_number}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold uppercase text-slate-500">
                Safety Score
              </span>
              <span
                className={`mt-1 block font-mono text-xl font-bold ${
                  driver.safety_score >= 90
                    ? "text-emerald-400"
                    : driver.safety_score >= 75
                      ? "text-amber-400"
                      : "text-red-400"
                }`}
              >
                {driver.safety_score}/100
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="flex items-center gap-2 font-bold text-slate-100">
            <ShieldCheck size={17} className="text-emerald-400" />
            Linked Login Account
          </h3>
          {driver.linked_user ? (
            <div className="mt-4 space-y-2 text-sm">
              <p className="font-semibold text-slate-200">
                {driver.linked_user.full_name}
              </p>
              <p className="break-all font-mono text-xs text-slate-400">
                {driver.linked_user.email}
              </p>
              <span
                className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-bold ${
                  driver.linked_user.is_active
                    ? "border-emerald-900/50 bg-emerald-950/40 text-emerald-400"
                    : "border-red-900/50 bg-red-950/40 text-red-400"
                }`}
              >
                {driver.linked_user.is_active
                  ? "ACTIVE ACCOUNT"
                  : "DISABLED ACCOUNT"}
              </span>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              No application login account is linked to this driver profile.
            </p>
          )}
          <div className="mt-5 space-y-2 border-t border-slate-800 pt-4 text-xs text-slate-500">
            <p className="flex items-center gap-2">
              <CalendarDays size={13} /> Created {driver.created_at.slice(0, 10)}
            </p>
            <p className="flex items-center gap-2">
              <RefreshCw size={13} /> Updated {driver.updated_at.slice(0, 10)}
            </p>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ["Total Trips", history.summary.total_trips],
          ["Active", history.summary.active_trips],
          ["Completed", history.summary.completed_trips],
          ["Cancelled", history.summary.cancelled_trips],
          [
            "Distance",
            `${history.summary.total_distance.toLocaleString()} km`,
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-800 bg-slate-900 p-4"
          >
            <span className="block text-[10px] font-semibold uppercase text-slate-500">
              {label}
            </span>
            <span className="mt-1 block font-mono text-lg font-bold text-slate-200">
              {value}
            </span>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-100">
          <Route size={17} className="text-blue-400" /> Trip Assignment History
        </h3>

        {history.trips.length === 0 ? (
          <p className="py-4 text-sm italic text-slate-500">
            No trips have been assigned to this driver.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Trip</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Planned Start</th>
                  <th className="px-4 py-3">Distance</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {history.trips.map((trip) => (
                  <tr
                    key={trip.id}
                    className="text-slate-300 hover:bg-slate-800/20"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-200">
                      {trip.trip_code}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-200">
                        {trip.source} → {trip.destination}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        {trip.cargo_description}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{trip.vehicle_name}</div>
                      <div className="mt-1 font-mono text-[10px] text-slate-500">
                        {trip.vehicle_registration}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">
                      {new Date(trip.planned_start_time).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {(trip.actual_distance ?? trip.planned_distance).toLocaleString()} km
                    </td>
                    <td className="px-4 py-3">
                      <TripStatusBadge status={trip.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showEditForm && user && (
        <DriverFormModal
          mode="edit"
          driver={driver}
          currentUserRole={user.role}
          onClose={() => setShowEditForm(false)}
          onSaved={(message) => {
            setShowEditForm(false);
            showSuccess(message);
            void loadDetails();
          }}
        />
      )}
    </div>
  );
};
