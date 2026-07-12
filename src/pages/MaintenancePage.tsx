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
  AlertTriangle,
  Ban,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";

import { CompleteMaintenanceModal } from "../components/CompleteMaintenanceModal.js";
import { MaintenanceFormModal } from "../components/MaintenanceFormModal.js";
import { useAuth } from "../context/AuthContext.js";
import {
  type MaintenanceLog,
  MaintenanceStatus,
  MaintenanceType,
  UserRole,
  type Vehicle,
} from "../types.js";
import { apiFetch } from "../utils/api.js";

interface MaintenancePageProps {
  onViewDetails: (
    maintenanceId: string,
  ) => void;
}

interface MaintenanceRecord
  extends MaintenanceLog {
  vehicle_name: string;
  registration_number: string;
  vehicle_reg: string;
  vehicle_status: string | null;
  vehicle_odometer: number | null;
  vehicle_model: string | null;
}

interface MaintenanceListResponse {
  data: MaintenanceRecord[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface VehicleListResponse {
  data: Vehicle[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const PAGE_SIZE = 10;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Maintenance records could not be loaded.";
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
    : date.toLocaleDateString();
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

export const MaintenancePage: React.FC<
  MaintenancePageProps
> = ({ onViewDetails }) => {
  const { user } = useAuth();

  const [records, setRecords] = useState<
    MaintenanceRecord[]
  >([]);
  const [allVehicles, setAllVehicles] =
    useState<Vehicle[]>([]);
  const [availableVehicles, setAvailableVehicles] =
    useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [referenceLoading, setReferenceLoading] =
    useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [searchInput, setSearchInput] =
    useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("");
  const [typeFilter, setTypeFilter] =
    useState("");
  const [vehicleFilter, setVehicleFilter] =
    useState("");
  const [sortBy, setSortBy] =
    useState("created_at");
  const [sortOrder, setSortOrder] =
    useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] =
    useState(1);

  const [showCreateModal, setShowCreateModal] =
    useState(false);
  const [
    selectedCompletionRecord,
    setSelectedCompletionRecord,
  ] = useState<MaintenanceRecord | null>(
    null,
  );

  const canManage = Boolean(
    user &&
      [
        UserRole.ADMIN,
        UserRole.FLEET_MANAGER,
      ].includes(user.role),
  );
  const canDelete =
    user?.role === UserRole.ADMIN;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

  const fetchReferences =
    useCallback(async (): Promise<void> => {
      setReferenceLoading(true);

      try {
        const [vehicleList, availableList] =
          await Promise.all([
            apiFetch<VehicleListResponse>(
              "/vehicles?page_size=100&sort_by=registration_number&sort_order=asc",
            ),
            apiFetch<Vehicle[]>(
              "/vehicles/available",
            ),
          ]);

        setAllVehicles(vehicleList.data);
        setAvailableVehicles(availableList);
      } catch (requestError) {
        setError(getErrorMessage(requestError));
      } finally {
        setReferenceLoading(false);
      }
    }, []);

  const fetchRecords =
    useCallback(async (): Promise<void> => {
      setLoading(true);
      setError("");

      try {
        const query = new URLSearchParams({
          search,
          status: statusFilter,
          maintenance_type: typeFilter,
          vehicle_id: vehicleFilter,
          sort_by: sortBy,
          sort_order: sortOrder,
          page: String(page),
          page_size: String(PAGE_SIZE),
        });

        const response =
          await apiFetch<MaintenanceListResponse>(
            `/maintenance?${query.toString()}`,
          );

        setRecords(response.data);
        setTotal(response.total);
        setTotalPages(response.total_pages);

        if (response.page !== page) {
          setPage(response.page);
        }
      } catch (requestError) {
        setRecords([]);
        setTotal(0);
        setTotalPages(1);
        setError(getErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    }, [
      page,
      search,
      sortBy,
      sortOrder,
      statusFilter,
      typeFilter,
      vehicleFilter,
    ]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    void fetchReferences();
  }, [fetchReferences]);

  const showSuccess = (
    message: string,
  ): void => {
    setSuccessMessage(message);
    window.setTimeout(() => {
      setSuccessMessage("");
    }, 5000);
  };

  const handleCreated = async (
    message: string,
  ): Promise<void> => {
    setShowCreateModal(false);
    showSuccess(message);
    await Promise.all([
      fetchRecords(),
      fetchReferences(),
    ]);
  };

  const handleCompleted = async (
    message: string,
  ): Promise<void> => {
    setSelectedCompletionRecord(null);
    showSuccess(message);
    await Promise.all([
      fetchRecords(),
      fetchReferences(),
    ]);
  };

  const handleCancel = async (
    record: MaintenanceRecord,
  ): Promise<void> => {
    const confirmed = window.confirm(
      `Cancel maintenance for ${record.vehicle_name} (${record.registration_number})? The vehicle will return to AVAILABLE status.`,
    );

    if (!confirmed) {
      return;
    }

    setError("");

    try {
      await apiFetch(
        `/maintenance/${record.id}/cancel`,
        { method: "POST" },
      );

      showSuccess(
        "Maintenance cancelled. The vehicle is AVAILABLE again.",
      );

      await Promise.all([
        fetchRecords(),
        fetchReferences(),
      ]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const handleDelete = async (
    record: MaintenanceRecord,
  ): Promise<void> => {
    const confirmed = window.confirm(
      `Permanently delete cancelled maintenance record ${record.id}?`,
    );

    if (!confirmed) {
      return;
    }

    setError("");

    try {
      await apiFetch(
        `/maintenance/${record.id}`,
        { method: "DELETE" },
      );

      showSuccess(
        "Cancelled maintenance record deleted.",
      );

      await fetchRecords();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const clearFilters = (): void => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setVehicleFilter("");
    setSortBy("created_at");
    setSortOrder("desc");
    setPage(1);
  };

  const filtersActive = useMemo(
    () =>
      Boolean(
        searchInput ||
          statusFilter ||
          typeFilter ||
          vehicleFilter,
      ),
    [
      searchInput,
      statusFilter,
      typeFilter,
      vehicleFilter,
    ],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">
            Workshop & Maintenance
          </h2>
          <p className="text-sm text-slate-400">
            Manage service records, workshop status,
            costs, and vehicle availability.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() =>
              setShowCreateModal(true)
            }
            disabled={
              referenceLoading ||
              availableVehicles.length === 0
            }
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} />
            Start Maintenance
          </button>
        )}
      </div>

      {successMessage && (
        <div className="rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm font-semibold text-emerald-200">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="flex flex-col gap-3 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              void fetchRecords();
              void fetchReferences();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-red-100"
          >
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-semibold uppercase text-slate-400">
            Search
          </span>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
              placeholder="Vehicle, registration, provider, description..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
            />
          </div>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase text-slate-400">
            Status
          </span>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
          >
            <option value="">All Statuses</option>
            {Object.values(
              MaintenanceStatus,
            ).map((status) => (
              <option
                key={status}
                value={status}
              >
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase text-slate-400">
            Type
          </span>
          <select
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
          >
            <option value="">All Types</option>
            {Object.values(
              MaintenanceType,
            ).map((type) => (
              <option
                key={type}
                value={type}
              >
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase text-slate-400">
            Vehicle
          </span>
          <select
            value={vehicleFilter}
            onChange={(event) => {
              setVehicleFilter(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
          >
            <option value="">All Vehicles</option>
            {allVehicles.map((vehicle) => (
              <option
                key={vehicle.id}
                value={vehicle.id}
              >
                {vehicle.registration_number}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-slate-400">
          <span>
            Total:{" "}
            <strong className="text-slate-200">
              {total}
            </strong>
          </span>

          <label className="flex items-center gap-2">
            <span>Sort by</span>
            <select
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value);
                setPage(1);
              }}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
            >
              <option value="created_at">
                Created
              </option>
              <option value="start_date">
                Start Date
              </option>
              <option value="expected_completion_date">
                Expected Completion
              </option>
              <option value="estimated_cost">
                Estimated Cost
              </option>
              <option value="actual_cost">
                Actual Cost
              </option>
              <option value="status">
                Status
              </option>
              <option value="maintenance_type">
                Type
              </option>
              <option value="service_provider">
                Provider
              </option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setSortOrder((current) =>
                current === "asc"
                  ? "desc"
                  : "asc",
              );
              setPage(1);
            }}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 font-bold text-slate-200"
          >
            {sortOrder === "asc"
              ? "Ascending"
              : "Descending"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-slate-400 transition-colors hover:text-white"
            >
              Clear Filters
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              void fetchRecords();
              void fetchReferences();
            }}
            className="inline-flex items-center gap-1.5 rounded border border-slate-700 px-2.5 py-1.5 text-slate-300 transition-colors hover:bg-slate-800"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {loading ? (
          <div className="p-14 text-center font-mono text-sm uppercase tracking-wider text-slate-400">
            Loading maintenance records...
          </div>
        ) : records.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <AlertTriangle
              size={36}
              className="mx-auto mb-3 text-slate-600"
            />
            <p className="font-bold text-slate-300">
              No Maintenance Records Found
            </p>
            <p className="mt-1 text-xs">
              Adjust filters or start a new
              maintenance workflow.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-4">
                    Vehicle
                  </th>
                  <th className="px-5 py-4">
                    Service
                  </th>
                  <th className="px-5 py-4">
                    Timeline
                  </th>
                  <th className="px-5 py-4">
                    Cost
                  </th>
                  <th className="px-5 py-4">
                    Status
                  </th>
                  <th className="px-5 py-4 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60">
                {records.map((record) => {
                  const active = isActiveStatus(
                    record.status,
                  );

                  return (
                    <tr
                      key={record.id}
                      className="transition-colors hover:bg-slate-800/30"
                    >
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-100">
                          {record.vehicle_name}
                        </div>
                        <div className="mt-0.5 font-mono text-xs text-slate-500">
                          {record.registration_number}
                        </div>
                        <div className="mt-1 text-[10px] uppercase text-slate-600">
                          {record.vehicle_status ??
                            "Unknown status"}
                        </div>
                      </td>

                      <td className="max-w-xs px-5 py-4">
                        <div className="font-semibold text-slate-200">
                          {record.maintenance_type}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {record.service_provider}
                        </div>
                        <p className="mt-1 truncate text-xs italic text-slate-600">
                          {record.description}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-xs">
                        <div>
                          Started:{" "}
                          <span className="font-mono text-slate-300">
                            {formatDate(
                              record.start_date,
                            )}
                          </span>
                        </div>
                        <div className="mt-1">
                          Expected:{" "}
                          <span className="font-mono text-slate-300">
                            {formatDate(
                              record.expected_completion_date,
                            )}
                          </span>
                        </div>
                        {record.completed_date && (
                          <div className="mt-1">
                            Completed:{" "}
                            <span className="font-mono text-emerald-400">
                              {formatDate(
                                record.completed_date,
                              )}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 font-mono text-xs">
                        <div className="text-slate-400">
                          Est. Rs.{" "}
                          {record.estimated_cost.toLocaleString()}
                        </div>
                        {record.actual_cost !==
                          undefined && (
                          <div className="mt-1 font-bold text-emerald-400">
                            Act. Rs.{" "}
                            {record.actual_cost.toLocaleString()}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${statusClass(
                            record.status,
                          )}`}
                        >
                          {record.status.replaceAll(
                            "_",
                            " ",
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onViewDetails(
                                record.id,
                              )
                            }
                            className="inline-flex items-center gap-1 rounded border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                          >
                            <Eye size={13} />
                            View
                          </button>

                          {canManage && active && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedCompletionRecord(
                                    record,
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded bg-emerald-500 px-2.5 py-1.5 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400"
                              >
                                <CheckCircle
                                  size={13}
                                />
                                Complete
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  void handleCancel(
                                    record,
                                  );
                                }}
                                className="inline-flex items-center gap-1 rounded border border-red-900 px-2.5 py-1.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-950/30"
                              >
                                <Ban size={13} />
                                Cancel
                              </button>
                            </>
                          )}

                          {canDelete &&
                            record.status ===
                              MaintenanceStatus.CANCELLED && (
                              <button
                                type="button"
                                onClick={() => {
                                  void handleDelete(
                                    record,
                                  );
                                }}
                                className="inline-flex items-center gap-1 rounded border border-red-900 px-2.5 py-1.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-950/30"
                              >
                                <Trash2 size={13} />
                                Delete
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-5 py-4 text-xs">
            <button
              type="button"
              onClick={() =>
                setPage((current) =>
                  Math.max(1, current - 1),
                )
              }
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded border border-slate-800 px-3 py-1.5 text-slate-300 transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={14} />
              Previous
            </button>

            <span className="font-mono text-slate-400">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() =>
                setPage((current) =>
                  Math.min(
                    totalPages,
                    current + 1,
                  ),
                )
              }
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded border border-slate-800 px-3 py-1.5 text-slate-300 transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {showCreateModal && (
        <MaintenanceFormModal
          vehicles={availableVehicles}
          onClose={() =>
            setShowCreateModal(false)
          }
          onSaved={(message) => {
            void handleCreated(message);
          }}
        />
      )}

      {selectedCompletionRecord && (
        <CompleteMaintenanceModal
          maintenance={
            selectedCompletionRecord
          }
          onClose={() =>
            setSelectedCompletionRecord(null)
          }
          onSaved={(message) => {
            void handleCompleted(message);
          }}
        />
      )}
    </div>
  );
};
