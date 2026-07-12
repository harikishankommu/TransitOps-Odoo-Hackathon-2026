/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  CheckCircle,
  Gauge,
  RefreshCw,
  Trash2,
  Truck,
  Wallet,
  Wrench,
} from "lucide-react";

import { CompleteMaintenanceModal } from "../components/CompleteMaintenanceModal.js";
import { useAuth } from "../context/AuthContext.js";
import {
  type MaintenanceLog,
  MaintenanceStatus,
  UserRole,
} from "../types.js";
import { apiFetch } from "../utils/api.js";

interface MaintenanceDetailsPageProps {
  maintenanceId: string;
  onBack: () => void;
}

interface MaintenanceDetails
  extends MaintenanceLog {
  vehicle_name: string;
  registration_number: string;
  vehicle_reg: string;
  vehicle_status: string | null;
  vehicle_odometer: number | null;
  vehicle_model: string | null;
  vehicle_type: string | null;
  vehicle_region: string | null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Maintenance details could not be loaded.";
}

function isActiveStatus(
  status: MaintenanceStatus,
): boolean {
  return [
    MaintenanceStatus.OPEN,
    MaintenanceStatus.IN_PROGRESS,
  ].includes(status);
}

function formatDate(value?: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function statusClass(
  status: MaintenanceStatus,
): string {
  switch (status) {
    case MaintenanceStatus.OPEN:
      return "border-blue-900/40 bg-blue-950/40 text-blue-400";
    case MaintenanceStatus.IN_PROGRESS:
      return "border-amber-900/40 bg-amber-950/40 text-amber-400";
    case MaintenanceStatus.COMPLETED:
      return "border-emerald-900/40 bg-emerald-950/40 text-emerald-400";
    case MaintenanceStatus.CANCELLED:
      return "border-red-900/40 bg-red-950/40 text-red-400";
    default:
      return "border-slate-700 bg-slate-800 text-slate-300";
  }
}

export const MaintenanceDetailsPage: React.FC<
  MaintenanceDetailsPageProps
> = ({
  maintenanceId,
  onBack,
}) => {
  const { user } = useAuth();

  const [maintenance, setMaintenance] =
    useState<MaintenanceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");
  const [showCompleteModal, setShowCompleteModal] =
    useState(false);

  const canManage = Boolean(
    user &&
      [
        UserRole.ADMIN,
        UserRole.FLEET_MANAGER,
      ].includes(user.role),
  );
  const canDelete =
    user?.role === UserRole.ADMIN;

  const loadDetails =
    useCallback(async (): Promise<void> => {
      setLoading(true);
      setError("");

      try {
        const response =
          await apiFetch<MaintenanceDetails>(
            `/maintenance/${maintenanceId}`,
          );

        setMaintenance(response);
      } catch (requestError) {
        setMaintenance(null);
        setError(getErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    }, [maintenanceId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const showSuccess = (
    message: string,
  ): void => {
    setSuccessMessage(message);
    window.setTimeout(() => {
      setSuccessMessage("");
    }, 5000);
  };

  const handleCompleted = async (
    message: string,
  ): Promise<void> => {
    setShowCompleteModal(false);
    showSuccess(message);
    await loadDetails();
  };

  const handleCancel = async (): Promise<void> => {
    if (!maintenance) {
      return;
    }

    const confirmed = window.confirm(
      `Cancel maintenance for ${maintenance.vehicle_name} (${maintenance.registration_number})?`,
    );

    if (!confirmed) {
      return;
    }

    setError("");

    try {
      await apiFetch(
        `/maintenance/${maintenance.id}/cancel`,
        { method: "POST" },
      );

      showSuccess(
        "Maintenance cancelled. The vehicle is AVAILABLE again.",
      );
      await loadDetails();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!maintenance) {
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete cancelled maintenance record ${maintenance.id}?`,
    );

    if (!confirmed) {
      return;
    }

    setError("");

    try {
      await apiFetch(
        `/maintenance/${maintenance.id}`,
        { method: "DELETE" },
      );

      onBack();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-slate-400">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <p className="font-mono text-xs uppercase tracking-wider">
          Loading Maintenance Record...
        </p>
      </div>
    );
  }

  if (!maintenance) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Back to Maintenance
        </button>

        <div className="rounded-lg border border-red-900 bg-red-950/30 p-5 text-sm text-red-200">
          <div>{error || "Maintenance record not found."}</div>
          <button
            type="button"
            onClick={() => {
              void loadDetails();
            }}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase"
          >
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const active = isActiveStatus(
    maintenance.status,
  );
  const costVariance =
    maintenance.actual_cost === undefined
      ? null
      : maintenance.actual_cost -
        maintenance.estimated_cost;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Back to Maintenance
        </button>

        <button
          type="button"
          onClick={() => {
            void loadDetails();
          }}
          className="inline-flex items-center gap-1.5 self-start rounded border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-800"
        >
          <RefreshCw size={13} />
          Refresh
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
        <section className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
          <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-lg border border-emerald-900/40 bg-emerald-500/10 p-3 text-emerald-400">
                <Wrench size={26} />
              </div>

              <div>
                <div className="font-mono text-xs font-bold uppercase text-emerald-400">
                  {maintenance.id}
                </div>
                <h2 className="mt-1 text-2xl font-bold text-white">
                  {maintenance.maintenance_type}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {maintenance.service_provider}
                </p>
              </div>
            </div>

            <span
              className={`inline-flex self-start rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusClass(
                maintenance.status,
              )}`}
            >
              {maintenance.status.replaceAll(
                "_",
                " ",
              )}
            </span>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Service Description
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
              {maintenance.description}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <CalendarDays
                size={17}
                className="mb-3 text-blue-400"
              />
              <div className="text-[10px] font-bold uppercase text-slate-500">
                Start Date
              </div>
              <div className="mt-1 font-mono text-sm text-slate-200">
                {formatDate(
                  maintenance.start_date,
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <CalendarDays
                size={17}
                className="mb-3 text-amber-400"
              />
              <div className="text-[10px] font-bold uppercase text-slate-500">
                Expected Completion
              </div>
              <div className="mt-1 font-mono text-sm text-slate-200">
                {formatDate(
                  maintenance.expected_completion_date,
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <CheckCircle
                size={17}
                className="mb-3 text-emerald-400"
              />
              <div className="text-[10px] font-bold uppercase text-slate-500">
                Completed Date
              </div>
              <div className="mt-1 font-mono text-sm text-slate-200">
                {formatDate(
                  maintenance.completed_date,
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <Gauge
                size={18}
                className="mb-3 text-purple-400"
              />
              <div className="text-[10px] font-bold uppercase text-slate-500">
                Odometer at Service
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-slate-100">
                {maintenance.odometer_at_service.toLocaleString()}{" "}
                km
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Current vehicle reading:{" "}
                {maintenance.vehicle_odometer === null
                  ? "Unknown"
                  : `${maintenance.vehicle_odometer.toLocaleString()} km`}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <Wallet
                size={18}
                className="mb-3 text-emerald-400"
              />
              <div className="text-[10px] font-bold uppercase text-slate-500">
                Cost Summary
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Estimated:{" "}
                <span className="font-mono text-slate-200">
                  Rs.{" "}
                  {maintenance.estimated_cost.toLocaleString()}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Actual:{" "}
                <span className="font-mono font-bold text-emerald-400">
                  {maintenance.actual_cost ===
                  undefined
                    ? "Not recorded"
                    : `Rs. ${maintenance.actual_cost.toLocaleString()}`}
                </span>
              </div>
              {costVariance !== null && (
                <div
                  className={`mt-1 text-xs font-bold ${
                    costVariance <= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  Variance:{" "}
                  {costVariance >= 0 ? "+" : "-"}
                  Rs.{" "}
                  {Math.abs(
                    costVariance,
                  ).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="border-b border-slate-800 pb-3 text-sm font-bold text-slate-100">
              Vehicle Profile
            </h3>

            <div className="mt-4 flex items-start gap-3">
              <div className="rounded-lg bg-slate-950 p-2.5 text-emerald-400">
                <Truck size={20} />
              </div>
              <div>
                <div className="font-bold text-slate-100">
                  {maintenance.vehicle_name}
                </div>
                <div className="mt-0.5 font-mono text-xs text-slate-400">
                  {maintenance.registration_number}
                </div>
              </div>
            </div>

            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">
                  Model
                </dt>
                <dd className="text-right text-slate-300">
                  {maintenance.vehicle_model ??
                    "Unknown"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">
                  Type
                </dt>
                <dd className="text-right text-slate-300">
                  {maintenance.vehicle_type ??
                    "Unknown"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">
                  Region
                </dt>
                <dd className="text-right text-slate-300">
                  {maintenance.vehicle_region ??
                    "Unknown"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">
                  Current Status
                </dt>
                <dd className="font-bold text-amber-400">
                  {maintenance.vehicle_status ??
                    "Unknown"}
                </dd>
              </div>
            </dl>
          </section>

          {canManage && (
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="mb-4 text-sm font-bold text-slate-100">
                Workflow Actions
              </h3>

              <div className="space-y-2">
                {active && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setShowCompleteModal(true)
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400"
                    >
                      <CheckCircle size={14} />
                      Complete & Release
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void handleCancel();
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-md border border-red-900 px-4 py-2.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-950/30"
                    >
                      <Ban size={14} />
                      Cancel Maintenance
                    </button>
                  </>
                )}

                {canDelete &&
                  maintenance.status ===
                    MaintenanceStatus.CANCELLED && (
                    <button
                      type="button"
                      onClick={() => {
                        void handleDelete();
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-md border border-red-900 px-4 py-2.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-950/30"
                    >
                      <Trash2 size={14} />
                      Delete Record
                    </button>
                  )}

                {!active &&
                  maintenance.status !==
                    MaintenanceStatus.CANCELLED && (
                    <p className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-500">
                      This maintenance workflow is
                      closed.
                    </p>
                  )}
              </div>
            </section>
          )}
        </aside>
      </div>

      {showCompleteModal && (
        <CompleteMaintenanceModal
          maintenance={maintenance}
          onClose={() =>
            setShowCompleteModal(false)
          }
          onSaved={(message) => {
            void handleCompleted(message);
          }}
        />
      )}
    </div>
  );
};
