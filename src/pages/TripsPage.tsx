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
  Calendar,
  Edit3,
  Eye,
  Navigation,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { TripFormModal } from "../components/TripFormModal.js";
import { useAuth } from "../context/AuthContext.js";
import {
  type Driver,
  type Trip,
  TripStatus,
  UserRole,
  type Vehicle,
} from "../types.js";
import { apiFetch } from "../utils/api.js";

interface TripsPageProps {
  onViewDetails: (tripId: string) => void;
}

interface TripListItem extends Trip {
  vehicle_name: string;
  vehicle_registration: string;
  vehicle_capacity: number;
  driver_name: string;
  driver_licence: string;
  driver_licence_valid: boolean;
}

interface TripListResponse {
  data: TripListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface VehicleListResponse {
  data: Vehicle[];
}

interface DriverListResponse {
  data: Driver[];
}

type TripSortField =
  | "created_at"
  | "trip_code"
  | "planned_start_time"
  | "planned_distance"
  | "cargo_weight"
  | "revenue"
  | "status";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to load trips.";
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
      return "border-slate-700 bg-slate-800 text-slate-400";
  }
}

export const TripsPage: React.FC<TripsPageProps> = ({
  onViewDetails,
}) => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [sortBy, setSortBy] =
    useState<TripSortField>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    "desc",
  );
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [showCreateModal, setShowCreateModal] =
    useState(false);
  const [editingTrip, setEditingTrip] =
    useState<TripListItem | null>(null);

  const canManageTrips = Boolean(
    user &&
      [UserRole.ADMIN, UserRole.DISPATCHER].includes(
        user.role,
      ),
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const fetchTrips = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({
        search,
        status: statusFilter,
        vehicle_id: vehicleFilter,
        driver_id: driverFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: String(page),
        page_size: "10",
      });

      const response = await apiFetch<TripListResponse>(
        `/trips?${query.toString()}`,
      );

      setTrips(response.data);
      setTotal(response.total);
      setPage(response.page);
      setTotalPages(response.total_pages);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [
    driverFilter,
    page,
    search,
    sortBy,
    sortOrder,
    statusFilter,
    vehicleFilter,
  ]);

  useEffect(() => {
    void fetchTrips();
  }, [fetchTrips]);

  useEffect(() => {
    if (!canManageTrips) {
      return;
    }

    let cancelled = false;

    const loadFilterOptions = async (): Promise<void> => {
      try {
        const [vehicleResponse, driverResponse] =
          await Promise.all([
            apiFetch<VehicleListResponse>(
              "/vehicles?page_size=100&sort_by=registration_number&sort_order=asc",
            ),
            apiFetch<DriverListResponse>(
              "/drivers?page_size=100&sort_by=full_name&sort_order=asc",
            ),
          ]);

        if (!cancelled) {
          setVehicles(vehicleResponse.data);
          setDrivers(driverResponse.data);
        }
      } catch {
        // The trip list still works even if filter metadata fails.
      }
    };

    void loadFilterOptions();

    return () => {
      cancelled = true;
    };
  }, [canManageTrips]);

  const clearFilters = (): void => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("");
    setVehicleFilter("");
    setDriverFilter("");
    setSortBy("created_at");
    setSortOrder("desc");
    setPage(1);
  };

  const handleSaved = async (message: string): Promise<void> => {
    setShowCreateModal(false);
    setEditingTrip(null);
    setSuccessMessage(message);
    await fetchTrips();
    window.setTimeout(() => setSuccessMessage(""), 4500);
  };

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        searchInput ||
          statusFilter ||
          vehicleFilter ||
          driverFilter ||
          sortBy !== "created_at" ||
          sortOrder !== "desc",
      ),
    [
      driverFilter,
      searchInput,
      sortBy,
      sortOrder,
      statusFilter,
      vehicleFilter,
    ],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">
            Dispatches & Trips
          </h2>
          <p className="text-sm text-slate-400">
            Plan routes, assign resources, dispatch trips, and close completed operations.
          </p>
        </div>

        {canManageTrips && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400"
          >
            <Plus size={16} />
            Create New Trip
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
            onClick={() => void fetchTrips()}
            className="inline-flex items-center gap-2 font-bold text-red-300 hover:text-white"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-semibold uppercase text-slate-400">
            Search Trips
          </span>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
              placeholder="Trip code, route, or cargo"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-700 focus:border-emerald-500"
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
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
          >
            <option value="">All Statuses</option>
            {Object.values(TripStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        {canManageTrips && (
          <>
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
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
              >
                <option value="">All Vehicles</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration_number}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase text-slate-400">
                Driver
              </span>
              <select
                value={driverFilter}
                onChange={(event) => {
                  setDriverFilter(event.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
              >
                <option value="">All Drivers</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.full_name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-slate-400">
          <SlidersHorizontal size={14} />
          <select
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as TripSortField);
              setPage(1);
            }}
            className="rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-slate-300 outline-none"
          >
            <option value="created_at">Created Date</option>
            <option value="trip_code">Trip Code</option>
            <option value="planned_start_time">Departure</option>
            <option value="planned_distance">Distance</option>
            <option value="cargo_weight">Cargo Weight</option>
            <option value="revenue">Revenue</option>
            <option value="status">Status</option>
          </select>
          <select
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value as "asc" | "desc");
              setPage(1);
            }}
            className="rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-slate-300 outline-none"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="font-bold text-emerald-400 hover:text-emerald-300"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="font-mono text-slate-500">
          Total: <span className="font-bold text-slate-300">{total}</span>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-14 text-center font-mono text-sm uppercase tracking-wider text-slate-400">
          Loading trip records...
        </div>
      ) : trips.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-16 text-center text-slate-500">
          <AlertTriangle
            size={36}
            className="mx-auto mb-3 text-slate-600"
          />
          <p className="font-bold text-slate-300">
            No Trips Found
          </p>
          <p className="mt-1 text-xs">
            {user?.role === UserRole.DRIVER
              ? "No trips are linked to your driver profile."
              : "Adjust the filters or create a draft trip."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {trips.map((trip) => (
            <article
              key={trip.id}
              className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900 p-5 transition-colors hover:border-slate-700"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded border border-emerald-900/40 bg-emerald-950/40 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
                    {trip.trip_code}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${statusClasses(trip.status)}`}
                  >
                    {trip.status}
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-slate-950 p-2 text-slate-400">
                    <Navigation size={18} className="rotate-45" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-slate-100">
                      {trip.source} → {trip.destination}
                    </h3>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {trip.planned_distance.toLocaleString()} km planned
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800/60 bg-slate-950/50 p-3 text-xs text-slate-400">
                  <p>
                    <span className="font-semibold text-slate-300">
                      Cargo:
                    </span>{" "}
                    {trip.cargo_description}
                  </p>
                  <div className="mt-2 flex flex-wrap justify-between gap-2 font-mono">
                    <span>
                      {trip.cargo_weight.toLocaleString()} kg
                    </span>
                    <span>
                      Capacity: {trip.vehicle_capacity.toLocaleString()} kg
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <span className="block text-[10px] font-semibold uppercase text-slate-600">
                      Vehicle
                    </span>
                    <span className="mt-1 block truncate font-semibold text-slate-300">
                      {trip.vehicle_name}
                    </span>
                    <span className="font-mono text-slate-500">
                      {trip.vehicle_registration}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold uppercase text-slate-600">
                      Driver
                    </span>
                    <span className="mt-1 block truncate font-semibold text-slate-300">
                      {trip.driver_name}
                    </span>
                    <span className="font-mono text-slate-500">
                      {trip.driver_licence}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-slate-800/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar size={13} />
                  {new Date(
                    trip.planned_start_time,
                  ).toLocaleString()}
                </span>

                <div className="flex items-center gap-2">
                  {canManageTrips &&
                    trip.status === TripStatus.DRAFT && (
                      <button
                        type="button"
                        onClick={() => setEditingTrip(trip)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white"
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => onViewDetails(trip.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white"
                  >
                    <Eye size={13} /> Open
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-5 py-4 text-xs">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="rounded border border-slate-800 bg-slate-900 px-3 py-1.5 font-bold text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="font-mono text-slate-400">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.min(totalPages, current + 1),
              )
            }
            disabled={page >= totalPages}
            className="rounded border border-slate-800 bg-slate-900 px-3 py-1.5 font-bold text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {showCreateModal && (
        <TripFormModal
          mode="create"
          onClose={() => setShowCreateModal(false)}
          onSaved={(message) => void handleSaved(message)}
        />
      )}

      {editingTrip && (
        <TripFormModal
          mode="edit"
          trip={editingTrip}
          onClose={() => setEditingTrip(null)}
          onSaved={(message) => void handleSaved(message)}
        />
      )}
    </div>
  );
};
