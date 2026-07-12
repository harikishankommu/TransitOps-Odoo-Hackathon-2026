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
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

import { VehicleFormModal } from "../components/VehicleFormModal.js";
import { useAuth } from "../context/AuthContext.js";
import {
  type Vehicle,
  VehicleStatus,
  VehicleType,
  UserRole,
} from "../types.js";
import { apiFetch } from "../utils/api.js";

interface VehiclesPageProps {
  onViewDetails: (vehicleId: string) => void;
}

interface VehicleListResponse {
  data: Vehicle[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

type VehicleSortField =
  | "created_at"
  | "registration_number"
  | "vehicle_name"
  | "maximum_load_capacity"
  | "odometer"
  | "acquisition_cost"
  | "manufacture_year";

type SortOrder = "asc" | "desc";

const PAGE_SIZE = 10;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to load vehicle records.";
}

function formatStatus(status: VehicleStatus): string {
  return status.replaceAll("_", " ");
}

function getStatusClass(status: VehicleStatus): string {
  switch (status) {
    case VehicleStatus.AVAILABLE:
      return "border-emerald-900/50 bg-emerald-950 text-emerald-400";
    case VehicleStatus.ON_TRIP:
      return "border-blue-900/50 bg-blue-950 text-blue-400";
    case VehicleStatus.IN_SHOP:
      return "border-amber-900/50 bg-amber-950 text-amber-400";
    case VehicleStatus.RETIRED:
      return "border-slate-700 bg-slate-800 text-slate-400";
    default:
      return "border-slate-700 bg-slate-800 text-slate-400";
  }
}

export const VehiclesPage: React.FC<
  VehiclesPageProps
> = ({ onViewDetails }) => {
  const { user } = useAuth();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<VehicleStatus | "">("");
  const [typeFilter, setTypeFilter] =
    useState<VehicleType | "">("");
  const [regionFilter, setRegionFilter] =
    useState("");
  const [sortBy, setSortBy] =
    useState<VehicleSortField>("created_at");
  const [sortOrder, setSortOrder] =
    useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const [totalVehicles, setTotalVehicles] =
    useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [showCreateModal, setShowCreateModal] =
    useState(false);
  const [editingVehicle, setEditingVehicle] =
    useState<Vehicle | null>(null);
  const [actionVehicleId, setActionVehicleId] =
    useState<string | null>(null);

  const canManageVehicles = Boolean(
    user &&
      [
        UserRole.ADMIN,
        UserRole.FLEET_MANAGER,
      ].includes(user.role),
  );

  const canDeleteVehicles =
    user?.role === UserRole.ADMIN;

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [searchInput]);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    setError("");

    const query = new URLSearchParams({
      search,
      status: statusFilter,
      vehicle_type: typeFilter,
      region: regionFilter.trim(),
      sort_by: sortBy,
      sort_order: sortOrder,
      page: String(page),
      page_size: String(PAGE_SIZE),
    });

    try {
      const response = (
        await apiFetch(
          `/vehicles?${query.toString()}`,
        )
      ) as VehicleListResponse;

      setVehicles(response.data);
      setTotalVehicles(response.total);
      setTotalPages(
        Math.max(1, response.total_pages),
      );

      if (response.page !== page) {
        setPage(response.page);
      }
    } catch (requestError) {
      setVehicles([]);
      setTotalVehicles(0);
      setTotalPages(1);
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [
    page,
    regionFilter,
    search,
    sortBy,
    sortOrder,
    statusFilter,
    typeFilter,
  ]);

  useEffect(() => {
    void fetchVehicles();
  }, [fetchVehicles]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setSuccessMessage("");
    }, 4000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [successMessage]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        searchInput ||
          statusFilter ||
          typeFilter ||
          regionFilter,
      ),
    [
      regionFilter,
      searchInput,
      statusFilter,
      typeFilter,
    ],
  );

  const resetFilters = (): void => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setRegionFilter("");
    setSortBy("created_at");
    setSortOrder("desc");
    setPage(1);
  };

  const handleSaved = (message: string): void => {
    setShowCreateModal(false);
    setEditingVehicle(null);
    setSuccessMessage(message);

    if (page === 1) {
      void fetchVehicles();
    } else {
      setPage(1);
    }
  };

  const handleRetireVehicle = async (
    vehicle: Vehicle,
  ): Promise<void> => {
    const confirmed = window.confirm(
      `Retire ${vehicle.vehicle_name} (${vehicle.registration_number})? Retired vehicles cannot be dispatched.`,
    );

    if (!confirmed) {
      return;
    }

    setActionVehicleId(vehicle.id);
    setError("");

    try {
      await apiFetch(
        `/vehicles/${vehicle.id}/retire`,
        {
          method: "PATCH",
        },
      );

      setSuccessMessage(
        "Vehicle retired successfully.",
      );
      await fetchVehicles();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionVehicleId(null);
    }
  };

  const handleDeleteVehicle = async (
    vehicle: Vehicle,
  ): Promise<void> => {
    const confirmed = window.confirm(
      `Permanently delete ${vehicle.vehicle_name} (${vehicle.registration_number})? This is allowed only when the vehicle has no operational history.`,
    );

    if (!confirmed) {
      return;
    }

    setActionVehicleId(vehicle.id);
    setError("");

    try {
      await apiFetch(
        `/vehicles/${vehicle.id}`,
        {
          method: "DELETE",
        },
      );

      setSuccessMessage(
        "Vehicle deleted permanently.",
      );

      if (vehicles.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await fetchVehicles();
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionVehicleId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">
            Vehicle Registry
          </h2>
          <p className="text-sm text-slate-400">
            Manage fleet profiles, capacities, operating
            regions, and lifecycle status.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => void fetchVehicles()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          {canManageVehicles && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              <Plus size={16} />
              Add Vehicle
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
        <div className="flex flex-col gap-3 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void fetchVehicles()}
            className="text-left text-xs font-bold uppercase tracking-wider text-red-300 hover:text-white"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-semibold uppercase text-slate-400">
            Search Fleet
          </span>
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"
              size={16}
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
              placeholder="Registration, name, or model"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-500"
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
              setStatusFilter(
                event.target.value as
                  | VehicleStatus
                  | "",
              );
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
          >
            <option value="">All statuses</option>
            {Object.values(VehicleStatus).map(
              (status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase text-slate-400">
            Vehicle Type
          </span>
          <select
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(
                event.target.value as
                  | VehicleType
                  | "",
              );
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
          >
            <option value="">All types</option>
            {Object.values(VehicleType).map(
              (vehicleType) => (
                <option
                  key={vehicleType}
                  value={vehicleType}
                >
                  {vehicleType}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase text-slate-400">
            Region
          </span>
          <input
            type="text"
            value={regionFilter}
            onChange={(event) => {
              setRegionFilter(event.target.value);
              setPage(1);
            }}
            placeholder="For example, Patna"
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-500"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-slate-400">
            <span>Sort by</span>
            <select
              value={sortBy}
              onChange={(event) => {
                setSortBy(
                  event.target.value as VehicleSortField,
                );
                setPage(1);
              }}
              className="rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-slate-200 outline-none"
            >
              <option value="created_at">
                Date added
              </option>
              <option value="registration_number">
                Registration number
              </option>
              <option value="vehicle_name">
                Vehicle name
              </option>
              <option value="maximum_load_capacity">
                Capacity
              </option>
              <option value="odometer">
                Odometer
              </option>
              <option value="acquisition_cost">
                Acquisition cost
              </option>
              <option value="manufacture_year">
                Manufacture year
              </option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-slate-400">
            <span>Order</span>
            <select
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(
                  event.target.value as SortOrder,
                );
                setPage(1);
              }}
              className="rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-slate-200 outline-none"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-left font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="font-mono text-slate-500">
          Total: {" "}
          <span className="font-bold text-slate-300">
            {totalVehicles}
          </span>{" "}
          vehicles
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {loading ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-12 text-slate-400">
            <RefreshCw
              size={24}
              className="animate-spin text-emerald-400"
            />
            <p className="font-mono text-xs uppercase tracking-wider">
              Loading vehicle records
            </p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <AlertTriangle
              className="mx-auto mb-3 text-slate-600"
              size={36}
            />
            <p className="font-bold text-slate-400">
              No matching vehicles
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Clear the filters or register a new
              vehicle.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-4">
                    Registration
                  </th>
                  <th className="px-5 py-4">
                    Vehicle
                  </th>
                  <th className="px-5 py-4">
                    Type / Fuel
                  </th>
                  <th className="px-5 py-4">
                    Region
                  </th>
                  <th className="px-5 py-4">
                    Capacity
                  </th>
                  <th className="px-5 py-4">
                    Odometer
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
                {vehicles.map((vehicle) => {
                  const isProcessing =
                    actionVehicleId === vehicle.id;
                  const canRetire =
                    canManageVehicles &&
                    vehicle.status !==
                      VehicleStatus.RETIRED &&
                    vehicle.status !==
                      VehicleStatus.ON_TRIP &&
                    vehicle.status !==
                      VehicleStatus.IN_SHOP;

                  return (
                    <tr
                      key={vehicle.id}
                      className="transition-colors hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-4 font-mono font-bold text-slate-100">
                        {vehicle.registration_number}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-200">
                          {vehicle.vehicle_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {vehicle.model} ({" "}
                          {vehicle.manufacture_year})
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div>{vehicle.vehicle_type}</div>
                        <div className="text-xs text-slate-500">
                          {vehicle.fuel_type}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-400">
                        {vehicle.region}
                      </td>

                      <td className="px-5 py-4 font-mono">
                        {vehicle.maximum_load_capacity.toLocaleString()} {" "}
                        kg
                      </td>

                      <td className="px-5 py-4 font-mono">
                        {vehicle.odometer.toLocaleString()} {" "}
                        km
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClass(vehicle.status)}`}
                        >
                          {formatStatus(vehicle.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onViewDetails(vehicle.id)
                            }
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                          >
                            <Eye size={14} />
                            View
                          </button>

                          {canManageVehicles && (
                            <button
                              type="button"
                              onClick={() =>
                                setEditingVehicle(vehicle)
                              }
                              disabled={isProcessing}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-400 transition-colors hover:bg-blue-950/40 hover:text-blue-300 disabled:opacity-50"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>
                          )}

                          {canRetire && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleRetireVehicle(
                                  vehicle,
                                )
                              }
                              disabled={isProcessing}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-amber-400 transition-colors hover:bg-amber-950/40 hover:text-amber-300 disabled:opacity-50"
                            >
                              <Trash2 size={14} />
                              Retire
                            </button>
                          )}

                          {canDeleteVehicles && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleDeleteVehicle(
                                  vehicle,
                                )
                              }
                              disabled={isProcessing}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50"
                              title="Permanent deletion is allowed only when no history exists"
                            >
                              <Trash2 size={14} />
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

        {!loading && totalVehicles > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-950 px-6 py-4 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span className="font-mono text-slate-400">
              Page {page} of {totalPages}
            </span>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setPage((current) =>
                    Math.max(1, current - 1),
                  )
                }
                disabled={page <= 1}
                className="rounded border border-slate-800 bg-slate-900 px-3 py-1.5 font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

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
                className="rounded border border-slate-800 bg-slate-900 px-3 py-1.5 font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <VehicleFormModal
          mode="create"
          onClose={() => setShowCreateModal(false)}
          onSaved={handleSaved}
        />
      )}

      {editingVehicle && (
        <VehicleFormModal
          mode="edit"
          vehicle={editingVehicle}
          onClose={() => setEditingVehicle(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};
