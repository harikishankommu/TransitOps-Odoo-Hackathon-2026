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
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Droplets,
  Fuel,
  Gauge,
  Lock,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import {
  ExpenseType,
  UserRole,
} from "../types.js";
import { apiFetch } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.js";
import {
  ExpenseFormModal,
  type ExpenseFormValue,
} from "../components/ExpenseFormModal.js";
import {
  FuelLogFormModal,
  type FinancialTripOption,
  type FinancialVehicleOption,
  type FuelFormValue,
} from "../components/FuelLogFormModal.js";

type LedgerTab = "fuel" | "expenses";
type SortOrder = "asc" | "desc";

interface FuelRecord {
  id: string;
  vehicle_id: string;
  trip_id?: string;
  fuel_litres: number;
  fuel_cost: number;
  price_per_litre: number;
  odometer_reading: number;
  fuel_date: string;
  fuel_station: string;
  receipt_number: string;
  notes?: string;
  vehicle_name: string;
  registration_number: string;
  trip_code: string | null;
  source: string;
  is_protected: boolean;
}

interface ExpenseRecord {
  id: string;
  vehicle_id?: string;
  trip_id?: string;
  expense_type: ExpenseType;
  amount: number;
  expense_date: string;
  description: string;
  receipt_number: string;
  vehicle_name: string;
  registration_number: string;
  trip_code: string | null;
  source: string;
  is_protected: boolean;
}

interface FuelSummary {
  total_litres: number;
  total_cost: number;
  average_price: number;
}

interface ExpenseSummary {
  total_expenses: number;
}

interface PaginatedResponse<
  RecordType,
  SummaryType,
> {
  data: RecordType[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  summary: SummaryType;
}

interface FinancialOptionsResponse {
  vehicles: FinancialVehicleOption[];
  trips: FinancialTripOption[];
  expense_types: ExpenseType[];
}

const EMPTY_FUEL_RESPONSE: PaginatedResponse<
  FuelRecord,
  FuelSummary
> = {
  data: [],
  total: 0,
  page: 1,
  page_size: 10,
  total_pages: 1,
  summary: {
    total_litres: 0,
    total_cost: 0,
    average_price: 0,
  },
};

const EMPTY_EXPENSE_RESPONSE: PaginatedResponse<
  ExpenseRecord,
  ExpenseSummary
> = {
  data: [],
  total: 0,
  page: 1,
  page_size: 10,
  total_pages: 1,
  summary: {
    total_expenses: 0,
  },
};

function formatCurrency(value: number): string {
  return `Rs. ${Number(value || 0).toLocaleString(
    undefined,
    {
      maximumFractionDigits: 2,
    },
  )}`;
}

function sourceLabel(source: string): string {
  return source
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(" ");
}

export const FuelExpensesPage: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] =
    useState<LedgerTab>("fuel");
  const [fuelResponse, setFuelResponse] =
    useState(EMPTY_FUEL_RESPONSE);
  const [expenseResponse, setExpenseResponse] =
    useState(EMPTY_EXPENSE_RESPONSE);
  const [vehicles, setVehicles] = useState<
    FinancialVehicleOption[]
  >([]);
  const [trips, setTrips] = useState<
    FinancialTripOption[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] =
    useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [searchInput, setSearchInput] =
    useState("");
  const [search, setSearch] = useState("");
  const [vehicleFilter, setVehicleFilter] =
    useState("");
  const [expenseTypeFilter, setExpenseTypeFilter] =
    useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [fuelPage, setFuelPage] = useState(1);
  const [expensePage, setExpensePage] =
    useState(1);
  const [fuelSortBy, setFuelSortBy] =
    useState("fuel_date");
  const [expenseSortBy, setExpenseSortBy] =
    useState("expense_date");
  const [sortOrder, setSortOrder] =
    useState<SortOrder>("desc");

  const [showFuelModal, setShowFuelModal] =
    useState(false);
  const [showExpenseModal, setShowExpenseModal] =
    useState(false);
  const [editingFuel, setEditingFuel] =
    useState<FuelRecord | null>(null);
  const [editingExpense, setEditingExpense] =
    useState<ExpenseRecord | null>(null);
  const [formSaving, setFormSaving] =
    useState(false);
  const [formError, setFormError] = useState("");

  const canManage =
    user &&
    [
      UserRole.ADMIN,
      UserRole.FLEET_MANAGER,
      UserRole.FINANCIAL_ANALYST,
    ].includes(user.role);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setFuelPage(1);
      setExpensePage(1);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

  useEffect(() => {
    setFuelPage(1);
    setExpensePage(1);
  }, [
    vehicleFilter,
    expenseTypeFilter,
    dateFrom,
    dateTo,
    fuelSortBy,
    expenseSortBy,
    sortOrder,
  ]);

  const loadOptions = useCallback(async () => {
    try {
      setOptionsLoading(true);
      const data =
        await apiFetch<FinancialOptionsResponse>(
          "/financial/options",
        );
      setVehicles(data.vehicles);
      setTrips(data.trips);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Failed to load financial form options.";
      setError(message);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const loadLedger = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const commonParameters = {
        search,
        vehicle_id: vehicleFilter,
        date_from: dateFrom,
        date_to: dateTo,
        page_size: "10",
        sort_order: sortOrder,
      };

      const fuelQuery = new URLSearchParams({
        ...commonParameters,
        page: String(fuelPage),
        sort_by: fuelSortBy,
      });
      const expenseQuery = new URLSearchParams({
        ...commonParameters,
        expense_type: expenseTypeFilter,
        page: String(expensePage),
        sort_by: expenseSortBy,
      });

      const [fuelData, expenseData] =
        await Promise.all([
          apiFetch<
            PaginatedResponse<
              FuelRecord,
              FuelSummary
            >
          >(`/fuel?${fuelQuery.toString()}`),
          apiFetch<
            PaginatedResponse<
              ExpenseRecord,
              ExpenseSummary
            >
          >(
            `/expenses?${expenseQuery.toString()}`,
          ),
        ]);

      setFuelResponse(fuelData);
      setExpenseResponse(expenseData);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Failed to load the financial ledger.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    dateFrom,
    dateTo,
    expensePage,
    expenseSortBy,
    expenseTypeFilter,
    fuelPage,
    fuelSortBy,
    search,
    sortOrder,
    vehicleFilter,
  ]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  const showSuccess = (message: string): void => {
    setSuccessMessage(message);
    window.setTimeout(() => {
      setSuccessMessage("");
    }, 4500);
  };

  const resetFilters = (): void => {
    setSearchInput("");
    setSearch("");
    setVehicleFilter("");
    setExpenseTypeFilter("");
    setDateFrom("");
    setDateTo("");
    setFuelPage(1);
    setExpensePage(1);
  };

  const fuelInitialValue =
    useMemo<FuelFormValue | null>(
      () =>
        editingFuel
          ? {
              id: editingFuel.id,
              vehicle_id:
                editingFuel.vehicle_id,
              trip_id:
                editingFuel.trip_id ?? "",
              fuel_litres: String(
                editingFuel.fuel_litres,
              ),
              price_per_litre: String(
                editingFuel.price_per_litre,
              ),
              odometer_reading: String(
                editingFuel.odometer_reading,
              ),
              fuel_date: editingFuel.fuel_date,
              fuel_station:
                editingFuel.fuel_station,
              receipt_number:
                editingFuel.receipt_number,
              notes: editingFuel.notes ?? "",
            }
          : null,
      [editingFuel],
    );

  const expenseInitialValue =
    useMemo<ExpenseFormValue | null>(
      () =>
        editingExpense
          ? {
              id: editingExpense.id,
              vehicle_id:
                editingExpense.vehicle_id ?? "",
              trip_id:
                editingExpense.trip_id ?? "",
              expense_type:
                editingExpense.expense_type,
              amount: String(
                editingExpense.amount,
              ),
              expense_date:
                editingExpense.expense_date,
              receipt_number:
                editingExpense.receipt_number,
              description:
                editingExpense.description,
            }
          : null,
      [editingExpense],
    );

  const handleFuelSubmit = async (
    value: FuelFormValue,
  ): Promise<void> => {
    try {
      setFormSaving(true);
      setFormError("");

      const payload = {
        vehicle_id: value.vehicle_id,
        trip_id: value.trip_id || null,
        fuel_litres: Number(value.fuel_litres),
        price_per_litre: Number(
          value.price_per_litre,
        ),
        odometer_reading: Number(
          value.odometer_reading,
        ),
        fuel_date: value.fuel_date,
        fuel_station: value.fuel_station,
        receipt_number: value.receipt_number,
        notes: value.notes || null,
      };

      await apiFetch(
        editingFuel
          ? `/fuel/${editingFuel.id}`
          : "/fuel",
        {
          method: editingFuel ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );

      setShowFuelModal(false);
      setEditingFuel(null);
      showSuccess(
        editingFuel
          ? "Fuel record updated successfully."
          : "Fuel refill logged successfully.",
      );
      await Promise.all([
        loadLedger(),
        loadOptions(),
      ]);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Failed to save the fuel record.";
      setFormError(message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleExpenseSubmit = async (
    value: ExpenseFormValue,
  ): Promise<void> => {
    try {
      setFormSaving(true);
      setFormError("");

      const payload = {
        vehicle_id: value.vehicle_id || null,
        trip_id: value.trip_id || null,
        expense_type: value.expense_type,
        amount: Number(value.amount),
        expense_date: value.expense_date,
        receipt_number: value.receipt_number,
        description: value.description,
      };

      await apiFetch(
        editingExpense
          ? `/expenses/${editingExpense.id}`
          : "/expenses",
        {
          method: editingExpense
            ? "PUT"
            : "POST",
          body: JSON.stringify(payload),
        },
      );

      setShowExpenseModal(false);
      setEditingExpense(null);
      showSuccess(
        editingExpense
          ? "Expense updated successfully."
          : "Expense logged successfully.",
      );
      await loadLedger();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Failed to save the expense.";
      setFormError(message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteFuel = async (
    record: FuelRecord,
  ): Promise<void> => {
    if (
      !window.confirm(
        `Delete fuel receipt ${record.receipt_number}? This cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await apiFetch(`/fuel/${record.id}`, {
        method: "DELETE",
      });
      showSuccess("Fuel record deleted.");
      await loadLedger();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to delete the fuel record.",
      );
    }
  };

  const handleDeleteExpense = async (
    record: ExpenseRecord,
  ): Promise<void> => {
    if (
      !window.confirm(
        `Delete expense ${record.receipt_number}? This cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await apiFetch(`/expenses/${record.id}`, {
        method: "DELETE",
      });
      showSuccess("Expense deleted.");
      await loadLedger();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to delete the expense.",
      );
    }
  };

  const activeTotal =
    activeTab === "fuel"
      ? fuelResponse.total
      : expenseResponse.total;
  const activePage =
    activeTab === "fuel"
      ? fuelResponse.page
      : expenseResponse.page;
  const activeTotalPages =
    activeTab === "fuel"
      ? fuelResponse.total_pages
      : expenseResponse.total_pages;

  const changeActivePage = (
    nextPage: number,
  ): void => {
    if (
      nextPage < 1 ||
      nextPage > activeTotalPages
    ) {
      return;
    }

    if (activeTab === "fuel") {
      setFuelPage(nextPage);
    } else {
      setExpensePage(nextPage);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">
            Fuel & Expense Ledger
          </h2>
          <p className="text-sm text-slate-400">
            Track fuel consumption, receipts, and fleet operating costs.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              setFormError("");
              if (activeTab === "fuel") {
                setEditingFuel(null);
                setShowFuelModal(true);
              } else {
                setEditingExpense(null);
                setShowExpenseModal(true);
              }
            }}
            disabled={optionsLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} />
            {activeTab === "fuel"
              ? "Log Fuel Refill"
              : "Log Expense"}
          </button>
        )}
      </div>

      {successMessage && (
        <div className="rounded-lg border border-emerald-900 bg-emerald-950/30 px-4 py-3 text-sm font-semibold text-emerald-200">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setError("");
              void loadLedger();
            }}
            className="rounded border border-red-800 px-3 py-1.5 text-xs"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Droplets size={18} />}
          label="Fuel Consumed"
          value={`${fuelResponse.summary.total_litres.toLocaleString(
            undefined,
            {
              maximumFractionDigits: 2,
            },
          )} L`}
        />
        <SummaryCard
          icon={<Fuel size={18} />}
          label="Fuel Cost"
          value={formatCurrency(
            fuelResponse.summary.total_cost,
          )}
        />
        <SummaryCard
          icon={<Gauge size={18} />}
          label="Average Fuel Price"
          value={`${formatCurrency(
            fuelResponse.summary.average_price,
          )} / L`}
        />
        <SummaryCard
          icon={<ReceiptText size={18} />}
          label="Other Expenses"
          value={formatCurrency(
            expenseResponse.summary.total_expenses,
          )}
        />
      </div>

      <div className="flex border-b border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab("fuel")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-colors ${
            activeTab === "fuel"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-200"
          }`}
        >
          <Fuel size={16} />
          Fuel Records
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px]">
            {fuelResponse.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("expenses")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-colors ${
            activeTab === "expenses"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-200"
          }`}
        >
          <DollarSign size={16} />
          Expenses
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px]">
            {expenseResponse.total}
          </span>
        </button>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <label className="space-y-1.5 lg:col-span-2">
            <span className="text-xs font-semibold uppercase text-slate-400">
              Search
            </span>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              />
              <input
                value={searchInput}
                onChange={(event) =>
                  setSearchInput(event.target.value)
                }
                placeholder={
                  activeTab === "fuel"
                    ? "Vehicle, receipt, station, trip..."
                    : "Vehicle, receipt, type, description..."
                }
                className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
              />
            </div>
          </label>

          <FilterSelect
            label="Vehicle"
            value={vehicleFilter}
            onChange={setVehicleFilter}
          >
            <option value="">All Vehicles</option>
            {vehicles.map((vehicle) => (
              <option
                key={vehicle.id}
                value={vehicle.id}
              >
                {vehicle.registration_number}
              </option>
            ))}
          </FilterSelect>

          {activeTab === "expenses" ? (
            <FilterSelect
              label="Expense Type"
              value={expenseTypeFilter}
              onChange={setExpenseTypeFilter}
            >
              <option value="">All Types</option>
              {Object.values(ExpenseType).map(
                (expenseType) => (
                  <option
                    key={expenseType}
                    value={expenseType}
                  >
                    {expenseType.replaceAll(
                      "_",
                      " ",
                    )}
                  </option>
                ),
              )}
            </FilterSelect>
          ) : (
            <FilterSelect
              label="Sort By"
              value={fuelSortBy}
              onChange={setFuelSortBy}
            >
              <option value="fuel_date">
                Fuel Date
              </option>
              <option value="fuel_cost">
                Total Cost
              </option>
              <option value="fuel_litres">
                Fuel Litres
              </option>
              <option value="odometer_reading">
                Odometer
              </option>
              <option value="receipt_number">
                Receipt
              </option>
            </FilterSelect>
          )}

          {activeTab === "expenses" ? (
            <FilterSelect
              label="Sort By"
              value={expenseSortBy}
              onChange={setExpenseSortBy}
            >
              <option value="expense_date">
                Expense Date
              </option>
              <option value="amount">
                Amount
              </option>
              <option value="expense_type">
                Expense Type
              </option>
              <option value="receipt_number">
                Receipt
              </option>
            </FilterSelect>
          ) : (
            <FilterSelect
              label="Order"
              value={sortOrder}
              onChange={(value) =>
                setSortOrder(value as SortOrder)
              }
            >
              <option value="desc">
                Descending
              </option>
              <option value="asc">
                Ascending
              </option>
            </FilterSelect>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase text-slate-400">
              Date From
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) =>
                setDateFrom(event.target.value)
              }
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase text-slate-400">
              Date To
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) =>
                setDateTo(event.target.value)
              }
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
            />
          </label>

          {activeTab === "expenses" && (
            <FilterSelect
              label="Order"
              value={sortOrder}
              onChange={(value) =>
                setSortOrder(value as SortOrder)
              }
            >
              <option value="desc">
                Descending
              </option>
              <option value="asc">
                Ascending
              </option>
            </FilterSelect>
          )}

          <div className="flex items-end gap-2 lg:col-span-2">
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-800"
            >
              Clear Filters
            </button>
            <button
              type="button"
              onClick={() => void loadLedger()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-800"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {loading ? (
          <div className="p-14 text-center font-mono text-xs uppercase tracking-wider text-slate-500">
            Loading financial ledger...
          </div>
        ) : activeTab === "fuel" ? (
          <FuelTable
            records={fuelResponse.data}
            canManage={Boolean(canManage)}
            onEdit={(record) => {
              setFormError("");
              setEditingFuel(record);
              setShowFuelModal(true);
            }}
            onDelete={(record) =>
              void handleDeleteFuel(record)
            }
          />
        ) : (
          <ExpenseTable
            records={expenseResponse.data}
            canManage={Boolean(canManage)}
            onEdit={(record) => {
              setFormError("");
              setEditingExpense(record);
              setShowExpenseModal(true);
            }}
            onDelete={(record) =>
              void handleDeleteExpense(record)
            }
          />
        )}

        {!loading && activeTotal > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-800 px-5 py-4 sm:flex-row">
            <span className="text-xs text-slate-500">
              Page {activePage} of{" "}
              {activeTotalPages} · {activeTotal}{" "}
              records
            </span>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  changeActivePage(activePage - 1)
                }
                disabled={activePage <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  changeActivePage(activePage + 1)
                }
                disabled={
                  activePage >= activeTotalPages
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      <FuelLogFormModal
        open={showFuelModal}
        initialValue={fuelInitialValue}
        vehicles={vehicles.filter(
          (vehicle) =>
            vehicle.status !== "RETIRED",
        )}
        trips={trips}
        saving={formSaving}
        error={formError}
        onClose={() => {
          if (!formSaving) {
            setShowFuelModal(false);
            setEditingFuel(null);
            setFormError("");
          }
        }}
        onSubmit={(value) =>
          void handleFuelSubmit(value)
        }
      />

      <ExpenseFormModal
        open={showExpenseModal}
        initialValue={expenseInitialValue}
        vehicles={vehicles}
        trips={trips}
        saving={formSaving}
        error={formError}
        onClose={() => {
          if (!formSaving) {
            setShowExpenseModal(false);
            setEditingExpense(null);
            setFormError("");
          }
        }}
        onSubmit={(value) =>
          void handleExpenseSubmit(value)
        }
      />
    </div>
  );
};

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  icon,
  label,
  value,
}) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-950/40 text-emerald-400">
      {icon}
    </div>
    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
      {label}
    </p>
    <p className="mt-1 font-mono text-xl font-bold text-slate-100">
      {value}
    </p>
  </div>
);

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}

const FilterSelect: React.FC<
  FilterSelectProps
> = ({
  label,
  value,
  onChange,
  children,
}) => (
  <label className="space-y-1.5">
    <span className="text-xs font-semibold uppercase text-slate-400">
      {label}
    </span>
    <select
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
    >
      {children}
    </select>
  </label>
);

interface FuelTableProps {
  records: FuelRecord[];
  canManage: boolean;
  onEdit: (record: FuelRecord) => void;
  onDelete: (record: FuelRecord) => void;
}

const FuelTable: React.FC<FuelTableProps> = ({
  records,
  canManage,
  onEdit,
  onDelete,
}) => {
  if (records.length === 0) {
    return (
      <EmptyLedgerState
        title="No fuel records found"
        message="Adjust the filters or log a new fuel refill."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1050px] text-left text-sm">
        <thead className="border-b border-slate-800 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-5 py-4">Vehicle</th>
            <th className="px-5 py-4">Receipt</th>
            <th className="px-5 py-4">Fuel</th>
            <th className="px-5 py-4">Cost</th>
            <th className="px-5 py-4">Odometer</th>
            <th className="px-5 py-4">Date / Station</th>
            <th className="px-5 py-4">Source</th>
            {canManage && (
              <th className="px-5 py-4 text-right">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70">
          {records.map((record) => (
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
                {record.trip_code && (
                  <div className="mt-1 text-[10px] font-bold text-blue-400">
                    {record.trip_code}
                  </div>
                )}
              </td>
              <td className="px-5 py-4 font-mono text-xs text-slate-300">
                {record.receipt_number}
              </td>
              <td className="px-5 py-4">
                <div className="font-mono font-bold text-slate-200">
                  {record.fuel_litres.toLocaleString()} L
                </div>
                <div className="mt-0.5 font-mono text-xs text-slate-500">
                  {formatCurrency(
                    record.price_per_litre,
                  )}{" "}
                  / L
                </div>
              </td>
              <td className="px-5 py-4 font-mono font-bold text-emerald-400">
                {formatCurrency(record.fuel_cost)}
              </td>
              <td className="px-5 py-4 font-mono text-slate-300">
                {record.odometer_reading.toLocaleString()}{" "}
                km
              </td>
              <td className="px-5 py-4">
                <div className="text-slate-300">
                  {record.fuel_date}
                </div>
                <div className="mt-0.5 max-w-[220px] truncate text-xs text-slate-500">
                  {record.fuel_station}
                </div>
              </td>
              <td className="px-5 py-4">
                {record.is_protected ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-900/50 bg-blue-950/40 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-300">
                    <Lock size={10} />
                    {sourceLabel(record.source)}
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-400">
                    Manual
                  </span>
                )}
              </td>
              {canManage && (
                <td className="px-5 py-4 text-right">
                  {record.is_protected ? (
                    <span className="text-xs text-slate-600">
                      Protected
                    </span>
                  ) : (
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(record)}
                        className="rounded-lg border border-slate-700 p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                        title="Edit fuel record"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onDelete(record)
                        }
                        className="rounded-lg border border-red-900/70 p-2 text-red-400 transition-colors hover:bg-red-950/40"
                        title="Delete fuel record"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface ExpenseTableProps {
  records: ExpenseRecord[];
  canManage: boolean;
  onEdit: (record: ExpenseRecord) => void;
  onDelete: (record: ExpenseRecord) => void;
}

const ExpenseTable: React.FC<
  ExpenseTableProps
> = ({
  records,
  canManage,
  onEdit,
  onDelete,
}) => {
  if (records.length === 0) {
    return (
      <EmptyLedgerState
        title="No expenses found"
        message="Adjust the filters or log a new operational expense."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1050px] text-left text-sm">
        <thead className="border-b border-slate-800 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-5 py-4">Vehicle / Trip</th>
            <th className="px-5 py-4">Reference</th>
            <th className="px-5 py-4">Type</th>
            <th className="px-5 py-4">Description</th>
            <th className="px-5 py-4">Amount</th>
            <th className="px-5 py-4">Date</th>
            <th className="px-5 py-4">Source</th>
            {canManage && (
              <th className="px-5 py-4 text-right">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70">
          {records.map((record) => (
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
                {record.trip_code && (
                  <div className="mt-1 text-[10px] font-bold text-blue-400">
                    {record.trip_code}
                  </div>
                )}
              </td>
              <td className="px-5 py-4 font-mono text-xs text-slate-300">
                {record.receipt_number}
              </td>
              <td className="px-5 py-4">
                <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-300">
                  {record.expense_type.replaceAll(
                    "_",
                    " ",
                  )}
                </span>
              </td>
              <td className="max-w-[300px] px-5 py-4 text-xs leading-5 text-slate-400">
                {record.description}
              </td>
              <td className="px-5 py-4 font-mono font-bold text-amber-300">
                {formatCurrency(record.amount)}
              </td>
              <td className="px-5 py-4 text-slate-300">
                {record.expense_date}
              </td>
              <td className="px-5 py-4">
                {record.is_protected ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-900/50 bg-blue-950/40 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-300">
                    <Lock size={10} />
                    {sourceLabel(record.source)}
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-400">
                    Manual
                  </span>
                )}
              </td>
              {canManage && (
                <td className="px-5 py-4 text-right">
                  {record.is_protected ? (
                    <span className="text-xs text-slate-600">
                      Protected
                    </span>
                  ) : (
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(record)}
                        className="rounded-lg border border-slate-700 p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                        title="Edit expense"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onDelete(record)
                        }
                        className="rounded-lg border border-red-900/70 p-2 text-red-400 transition-colors hover:bg-red-950/40"
                        title="Delete expense"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface EmptyLedgerStateProps {
  title: string;
  message: string;
}

const EmptyLedgerState: React.FC<
  EmptyLedgerStateProps
> = ({ title, message }) => (
  <div className="p-16 text-center">
    <ReceiptText
      size={36}
      className="mx-auto mb-3 text-slate-700"
    />
    <p className="font-bold text-slate-400">
      {title}
    </p>
    <p className="mt-1 text-xs text-slate-600">
      {message}
    </p>
  </div>
);
