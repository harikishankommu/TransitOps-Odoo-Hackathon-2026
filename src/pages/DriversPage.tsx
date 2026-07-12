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
  Check,
  Eye,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";

import { DriverFormModal } from "../components/DriverFormModal.js";
import { useAuth } from "../context/AuthContext.js";
import {
  type Driver,
  DriverStatus,
  UserRole,
} from "../types.js";
import { apiFetch } from "../utils/api.js";

interface DriversPageProps {
  onViewDetails: (driverId: string) => void;
}

interface DriverListResponse {
  data: Driver[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

type DriverSortField =
  | "created_at"
  | "full_name"
  | "licence_number"
  | "licence_expiry_date"
  | "safety_score"
  | "region"
  | "status";

type SortOrder = "asc" | "desc";
type LicenceFilter = "" | "VALID" | "EXPIRING_SOON" | "EXPIRED";

const PAGE_SIZE = 10;

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to load driver records.";
}

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function licenceLimitDate(): string {
  const limit = new Date();
  limit.setUTCDate(limit.getUTCDate() + 30);
  return limit.toISOString().split("T")[0];
}

function getLicenceState(
  expiryDate: string,
): "VALID" | "EXPIRING_SOON" | "EXPIRED" {
  if (expiryDate < todayDate()) {
    return "EXPIRED";
  }

  if (expiryDate <= licenceLimitDate()) {
    return "EXPIRING_SOON";
  }

  return "VALID";
}

function LicenceBadge({ expiryDate }: { expiryDate: string }) {
  const state = getLicenceState(expiryDate);

  const styles = {
    VALID:
      "border-emerald-900/50 bg-emerald-950/50 text-emerald-400",
    EXPIRING_SOON:
      "border-amber-900/50 bg-amber-950/40 text-amber-400",
    EXPIRED:
      "border-red-900/50 bg-red-950/50 text-red-400",
  } as const;

  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-bold ${styles[state]}`}
    >
      {state.replaceAll("_", " ")}
    </span>
  );
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
      {status.replaceAll("_", " ")}
    </span>
  );
}

export const DriversPage: React.FC<DriversPageProps> = ({
  onViewDetails,
}) => {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [licenceFilter, setLicenceFilter] =
    useState<LicenceFilter>("");
  const [regionFilter, setRegionFilter] = useState("");
  const [sortBy, setSortBy] =
    useState<DriverSortField>("created_at");
  const [sortOrder, setSortOrder] =
    useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [formMode, setFormMode] = useState<
    "create" | "edit" | null
  >(null);
  const [selectedDriver, setSelectedDriver] =
    useState<Driver | null>(null);

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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const queryString = useMemo(() => {
    const query = new URLSearchParams({
      page: String(page),
      page_size: String(PAGE_SIZE),
      sort_by: sortBy,
      sort_order: sortOrder,
    });

    if (search) query.set("search", search);
    if (statusFilter) query.set("status", statusFilter);
    if (licenceFilter) {
      query.set("licence_status", licenceFilter);
    }
    if (regionFilter.trim()) {
      query.set("region", regionFilter.trim());
    }

    return query.toString();
  }, [
    licenceFilter,
    page,
    regionFilter,
    search,
    sortBy,
    sortOrder,
    statusFilter,
  ]);

  const fetchDrivers = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch<DriverListResponse>(
        `/drivers?${queryString}`,
      );
      setDrivers(response.data);
      setTotal(response.total);
      setTotalPages(response.total_pages);

      if (response.page !== page) {
        setPage(response.page);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setDrivers([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, queryString]);

  useEffect(() => {
    void fetchDrivers();
  }, [fetchDrivers]);

  const showSuccess = (message: string): void => {
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(""), 4000);
  };

  const openCreateForm = (): void => {
    setSelectedDriver(null);
    setFormMode("create");
  };

  const openEditForm = (driver: Driver): void => {
    setSelectedDriver(driver);
    setFormMode("edit");
  };

  const closeForm = (): void => {
    setFormMode(null);
    setSelectedDriver(null);
  };

  const handleSaved = (message: string): void => {
    closeForm();
    showSuccess(message);
    void fetchDrivers();
  };

  const handleSuspend = async (driver: Driver): Promise<void> => {
    const confirmed = window.confirm(
      `Suspend ${driver.full_name}? Suspended drivers cannot be dispatched.`,
    );
    if (!confirmed) return;

    try {
      await apiFetch(`/drivers/${driver.id}/suspend`, {
        method: "PATCH",
      });
      showSuccess("Driver suspended successfully.");
      await fetchDrivers();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const handleActivate = async (driver: Driver): Promise<void> => {
    try {
      await apiFetch(`/drivers/${driver.id}/activate`, {
        method: "PATCH",
      });
      showSuccess("Driver restored to Available.");
      await fetchDrivers();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const handleDelete = async (driver: Driver): Promise<void> => {
    const confirmed = window.confirm(
      `Permanently delete ${driver.full_name}? Drivers with trip history cannot be deleted.`,
    );
    if (!confirmed) return;

    try {
      await apiFetch(`/drivers/${driver.id}`, {
        method: "DELETE",
      });
      showSuccess("Driver profile deleted successfully.");
      await fetchDrivers();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const toggleSort = (field: DriverSortField): void => {
    setPage(1);

    if (sortBy === field) {
      setSortOrder((current) =>
        current === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortBy(field);
    setSortOrder(field === "safety_score" ? "desc" : "asc");
  };

  const clearFilters = (): void => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("");
    setLicenceFilter("");
    setRegionFilter("");
    setSortBy("created_at");
    setSortOrder("desc");
    setPage(1);
  };

  const hasFilters = Boolean(
    searchInput ||
      statusFilter ||
      licenceFilter ||
      regionFilter,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">
            Drivers Roster
          </h2>
          <p className="text-sm text-slate-400">
            Licence compliance, safety scores, availability, and trip history
          </p>
        </div>

        {canManageProfiles && (
          <button
            type="button"
            onClick={openCreateForm}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400"
          >
            <UserPlus size={16} />
            Add Driver Profile
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
            onClick={() => void fetchDrivers()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-red-100 hover:text-white"
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-semibold uppercase text-slate-400">
            Search Drivers
          </span>
          <span className="relative block">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              size={16}
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
              placeholder="Name, licence number, or contact..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
            />
          </span>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase text-slate-400">
            Driver Status
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
            {Object.values(DriverStatus).map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase text-slate-400">
            Licence Status
          </span>
          <select
            value={licenceFilter}
            onChange={(event) => {
              setLicenceFilter(
                event.target.value as LicenceFilter,
              );
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
          >
            <option value="">All Licences</option>
            <option value="VALID">Valid</option>
            <option value="EXPIRING_SOON">Expiring Soon</option>
            <option value="EXPIRED">Expired</option>
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
            placeholder="e.g. Patna"
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-slate-400">
          <span>Sort:</span>
          {(
            [
              ["full_name", "Name"],
              ["licence_expiry_date", "Licence Expiry"],
              ["safety_score", "Safety Score"],
            ] as const
          ).map(([field, label]) => (
            <button
              key={field}
              type="button"
              onClick={() => toggleSort(field)}
              className={`font-medium hover:text-emerald-400 ${
                sortBy === field
                  ? "font-bold text-emerald-400"
                  : ""
              }`}
            >
              {label}{" "}
              {sortBy === field &&
                (sortOrder === "asc" ? "▲" : "▼")}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-slate-500">
            Total: <strong className="text-slate-300">{total}</strong>
          </span>
          <button
            type="button"
            onClick={() => void fetchDrivers()}
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-slate-400 hover:text-white"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {loading ? (
          <div className="p-12 text-center font-mono text-sm uppercase tracking-wider text-slate-400">
            Loading driver records...
          </div>
        ) : drivers.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <AlertTriangle
              className="mx-auto mb-3 text-slate-600"
              size={36}
            />
            <p className="font-bold text-slate-400">
              No Drivers Found
            </p>
            <p className="mt-1 text-xs">
              Adjust the filters or register a new profile.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-4">Driver</th>
                  <th className="px-5 py-4">Licence</th>
                  <th className="px-5 py-4">Region & Contact</th>
                  <th className="px-5 py-4">Safety</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {drivers.map((driver) => (
                  <tr
                    key={driver.id}
                    className="transition-colors hover:bg-slate-800/35"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-100">
                        {driver.full_name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {driver.licence_category}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-mono text-xs text-slate-200">
                        {driver.licence_number}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">
                          Exp: {driver.licence_expiry_date}
                        </span>
                        <LicenceBadge
                          expiryDate={driver.licence_expiry_date}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div>{driver.region}</div>
                      <div className="mt-1 font-mono text-xs text-slate-500">
                        {driver.contact_number}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`font-mono text-sm font-bold ${
                            driver.safety_score >= 90
                              ? "text-emerald-400"
                              : driver.safety_score >= 75
                                ? "text-amber-400"
                                : "text-red-400"
                          }`}
                        >
                          {driver.safety_score}/100
                        </span>
                        <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-800 sm:block">
                          <div
                            className={`h-full ${
                              driver.safety_score >= 90
                                ? "bg-emerald-500"
                                : driver.safety_score >= 75
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                            }`}
                            style={{
                              width: `${driver.safety_score}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={driver.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onViewDetails(driver.id)}
                          className="inline-flex items-center gap-1 rounded border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
                        >
                          <Eye size={13} /> View
                        </button>

                        {canManageProfiles &&
                          driver.status !== DriverStatus.ON_TRIP && (
                            <button
                              type="button"
                              onClick={() => openEditForm(driver)}
                              className="inline-flex items-center gap-1 rounded border border-blue-900/70 bg-blue-950/30 px-2.5 py-1.5 text-xs text-blue-300 hover:bg-blue-950/60"
                            >
                              <Pencil size={13} /> Edit
                            </button>
                          )}

                        {canSanction &&
                          (driver.status ===
                          DriverStatus.SUSPENDED ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleActivate(driver)
                              }
                              className="inline-flex items-center gap-1 rounded border border-emerald-800 bg-emerald-950 px-2.5 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-900"
                            >
                              <Check size={13} /> Activate
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                void handleSuspend(driver)
                              }
                              disabled={
                                driver.status === DriverStatus.ON_TRIP
                              }
                              className="inline-flex items-center gap-1 rounded border border-red-900/70 bg-red-950/40 px-2.5 py-1.5 text-xs font-bold text-red-400 hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Ban size={13} /> Suspend
                            </button>
                          ))}

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(driver)}
                            disabled={
                              driver.status === DriverStatus.ON_TRIP
                            }
                            className="inline-flex items-center gap-1 rounded border border-red-950 px-2.5 py-1.5 text-xs text-red-400 hover:border-red-800 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-6 py-4 text-xs">
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.max(1, current - 1))
              }
              disabled={page <= 1}
              className="rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
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
              className="rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <ShieldCheck size={13} />
        Dispatch validation rejects expired, Suspended, Off Duty, and On Trip drivers.
      </div>

      {formMode && user && (
        <DriverFormModal
          mode={formMode}
          driver={selectedDriver}
          currentUserRole={user.role}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};
