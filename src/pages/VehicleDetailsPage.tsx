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
  ArrowLeft,
  Fuel,
  ReceiptIndianRupee,
  RefreshCw,
  Route,
  TrendingUp,
  Truck,
  Wrench,
} from "lucide-react";

import {
  type Expense,
  ExpenseType,
  type FuelLog,
  type MaintenanceLog,
  type Trip,
  TripStatus,
  type Vehicle,
  VehicleStatus,
} from "../types.js";
import { apiFetch } from "../utils/api.js";

interface VehicleDetailsPageProps {
  vehicleId: string;
  onBack: () => void;
}

interface VehicleHistoryResponse {
  trips: Trip[];
  maintenance: MaintenanceLog[];
  expenses: Expense[];
  fuel: FuelLog[];
}

const EMPTY_HISTORY: VehicleHistoryResponse = {
  trips: [],
  maintenance: [],
  expenses: [],
  fuel: [],
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to load the vehicle ledger.";
}

function formatDate(value?: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatStatus(value: string): string {
  return value.replaceAll("_", " ");
}

function getVehicleStatusClass(
  status: VehicleStatus,
): string {
  switch (status) {
    case VehicleStatus.AVAILABLE:
      return "text-emerald-400";
    case VehicleStatus.ON_TRIP:
      return "text-blue-400";
    case VehicleStatus.IN_SHOP:
      return "text-amber-400";
    case VehicleStatus.RETIRED:
      return "text-slate-400";
    default:
      return "text-slate-400";
  }
}

function getTripStatusClass(
  status: TripStatus,
): string {
  switch (status) {
    case TripStatus.COMPLETED:
      return "border-emerald-900/40 bg-emerald-950/40 text-emerald-400";
    case TripStatus.DISPATCHED:
      return "border-blue-900/40 bg-blue-950/40 text-blue-400";
    case TripStatus.CANCELLED:
      return "border-red-900/40 bg-red-950/40 text-red-400";
    case TripStatus.DRAFT:
      return "border-slate-700 bg-slate-800 text-slate-400";
    default:
      return "border-slate-700 bg-slate-800 text-slate-400";
  }
}

export const VehicleDetailsPage: React.FC<
  VehicleDetailsPageProps
> = ({ vehicleId, onBack }) => {
  const [vehicle, setVehicle] =
    useState<Vehicle | null>(null);
  const [history, setHistory] =
    useState<VehicleHistoryResponse>(EMPTY_HISTORY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [vehicleData, historyData] =
        await Promise.all([
          apiFetch(
            `/vehicles/${vehicleId}`,
          ) as Promise<Vehicle>,
          apiFetch(
            `/vehicles/${vehicleId}/history`,
          ) as Promise<VehicleHistoryResponse>,
        ]);

      setVehicle(vehicleData);
      setHistory(historyData);
    } catch (requestError) {
      setVehicle(null);
      setHistory(EMPTY_HISTORY);
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const financialMetrics = useMemo(() => {
    const completedTrips = history.trips.filter(
      (trip) => trip.status === TripStatus.COMPLETED,
    );

    const totalRevenue = completedTrips.reduce(
      (sum, trip) => sum + trip.revenue,
      0,
    );

    const fuelCost = history.fuel.reduce(
      (sum, fuelLog) => sum + fuelLog.fuel_cost,
      0,
    );

    const maintenanceCost =
      history.maintenance.reduce(
        (sum, log) => sum + (log.actual_cost ?? 0),
        0,
      );

    // Fuel and completed maintenance workflows automatically create
    // expense records. They are excluded here because their costs are
    // already counted from the source ledgers above.
    const additionalExpenses = history.expenses.filter(
      (expense) =>
        expense.expense_type !==
          ExpenseType.MAINTENANCE &&
        !expense.description
          .trim()
          .toLowerCase()
          .startsWith("fuel purchase:"),
    );

    const additionalExpenseCost =
      additionalExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0,
      );

    const totalOperationalCost =
      fuelCost +
      maintenanceCost +
      additionalExpenseCost;
    const netProfit =
      totalRevenue - totalOperationalCost;

    const totalDistance = completedTrips.reduce(
      (sum, trip) =>
        sum + (trip.actual_distance ?? 0),
      0,
    );
    const totalFuelConsumed = completedTrips.reduce(
      (sum, trip) =>
        sum + (trip.fuel_consumed ?? 0),
      0,
    );

    return {
      completedTrips,
      totalRevenue,
      fuelCost,
      maintenanceCost,
      additionalExpenseCost,
      totalOperationalCost,
      netProfit,
      roi:
        vehicle && vehicle.acquisition_cost > 0
          ? (netProfit / vehicle.acquisition_cost) *
            100
          : 0,
      fuelEfficiency:
        totalFuelConsumed > 0
          ? totalDistance / totalFuelConsumed
          : 0,
    };
  }, [history, vehicle]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-slate-400">
        <RefreshCw
          size={28}
          className="animate-spin text-emerald-400"
        />
        <p className="font-mono text-xs uppercase tracking-wider">
          Loading vehicle ledger
        </p>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Back to vehicle registry
        </button>

        <div className="flex flex-col gap-3 rounded-lg border border-red-900 bg-red-950/20 p-5 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {error ||
              "Vehicle ledger could not be retrieved."}
          </span>
          <button
            type="button"
            onClick={() => void loadDetails()}
            className="text-left text-xs font-bold uppercase tracking-wider text-red-300 hover:text-white"
          >
            Retry
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
          className="flex items-center gap-2 text-xs text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Back to vehicle registry
        </button>

        <button
          type="button"
          onClick={() => void loadDetails()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <RefreshCw size={14} />
          Refresh Ledger
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="w-fit rounded-xl border border-emerald-900/30 bg-emerald-500/10 p-3 text-emerald-400">
              <Truck size={28} />
            </div>

            <div className="min-w-0">
              <h3 className="flex flex-wrap items-center gap-2.5 text-xl font-bold text-white">
                <span>{vehicle.vehicle_name}</span>
                <span className="rounded border border-emerald-900 bg-emerald-950 px-2 py-0.5 font-mono text-sm text-emerald-400">
                  {vehicle.registration_number}
                </span>
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                {vehicle.model} · {vehicle.manufacture_year} · {vehicle.vehicle_type} · {vehicle.region}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-slate-800/60 pt-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <span className="block text-xs font-semibold uppercase text-slate-500">
                Status
              </span>
              <span
                className={`mt-1 block text-xs font-bold ${getVehicleStatusClass(vehicle.status)}`}
              >
                ● {formatStatus(vehicle.status)}
              </span>
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase text-slate-500">
                Capacity
              </span>
              <span className="mt-1 block font-mono font-bold text-slate-200">
                {vehicle.maximum_load_capacity.toLocaleString()} kg
              </span>
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase text-slate-500">
                Odometer
              </span>
              <span className="mt-1 block font-mono font-bold text-slate-200">
                {vehicle.odometer.toLocaleString()} km
              </span>
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase text-slate-500">
                Fuel
              </span>
              <span className="mt-1 block font-semibold text-slate-200">
                {vehicle.fuel_type}
              </span>
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase text-slate-500">
                Added
              </span>
              <span className="mt-1 block font-mono text-xs text-slate-300">
                {formatDate(vehicle.created_at)}
              </span>
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase text-slate-500">
                Updated
              </span>
              <span className="mt-1 block font-mono text-xs text-slate-300">
                {formatDate(vehicle.updated_at)}
              </span>
            </div>
          </div>
        </section>

        <section className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h4 className="flex items-center gap-2 font-bold text-slate-100">
                <TrendingUp
                  size={16}
                  className="text-emerald-400"
                />
                ROI Ledger
              </h4>
              <p className="text-[10px] text-slate-400">
                Revenue minus operational costs
              </p>
            </div>

            <div className="rounded bg-emerald-500/10 p-1.5 font-mono text-xs font-semibold text-emerald-400">
              {financialMetrics.roi.toFixed(1)}% ROI
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex justify-between gap-4">
              <span>Acquisition value</span>
              <span className="font-mono text-slate-200">
                Rs. {vehicle.acquisition_cost.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Completed-trip revenue</span>
              <span className="font-mono font-bold text-emerald-400">
                Rs. {financialMetrics.totalRevenue.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Fuel cost</span>
              <span className="font-mono text-red-400">
                Rs. {financialMetrics.fuelCost.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Maintenance cost</span>
              <span className="font-mono text-red-400">
                Rs. {financialMetrics.maintenanceCost.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Additional expenses</span>
              <span className="font-mono text-red-400">
                Rs. {financialMetrics.additionalExpenseCost.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-800 pt-2 text-sm">
              <span className="font-bold text-slate-300">
                Net profit
              </span>
              <span
                className={`font-mono font-bold ${
                  financialMetrics.netProfit >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                Rs. {financialMetrics.netProfit.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-500" />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="rounded-lg bg-blue-500/10 p-2.5 text-blue-400">
            <Route size={18} />
          </div>
          <div>
            <span className="block text-[10px] font-semibold uppercase text-slate-500">
              Completed Trips
            </span>
            <span className="font-mono text-lg font-bold text-slate-200">
              {financialMetrics.completedTrips.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-400">
            <Wrench size={18} />
          </div>
          <div>
            <span className="block text-[10px] font-semibold uppercase text-slate-500">
              Maintenance Cycles
            </span>
            <span className="font-mono text-lg font-bold text-slate-200">
              {history.maintenance.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-400">
            <Fuel size={18} />
          </div>
          <div>
            <span className="block text-[10px] font-semibold uppercase text-slate-500">
              Fuel Efficiency
            </span>
            <span className="font-mono text-lg font-bold text-slate-200">
              {financialMetrics.fuelEfficiency.toFixed(2)} km/L
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="rounded-lg bg-violet-500/10 p-2.5 text-violet-400">
            <ReceiptIndianRupee size={18} />
          </div>
          <div>
            <span className="block text-[10px] font-semibold uppercase text-slate-500">
              Expense Records
            </span>
            <span className="font-mono text-lg font-bold text-slate-200">
              {history.expenses.length}
            </span>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h4 className="mb-4 flex items-center gap-2 font-bold text-slate-100">
          <Wrench size={16} className="text-amber-400" />
          Maintenance History
        </h4>

        {history.maintenance.length === 0 ? (
          <p className="py-2 text-xs italic text-slate-500">
            No maintenance records exist for this vehicle.
          </p>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full min-w-[850px] text-left">
              <thead className="border-b border-slate-800 bg-slate-950 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Odometer</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {history.maintenance.map((log) => (
                  <tr
                    key={log.id}
                    className="text-slate-300 hover:bg-slate-800/20"
                  >
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-200">
                        {log.maintenance_type}
                      </span>
                      <div className="max-w-sm truncate text-[10px] text-slate-500">
                        {log.description || "No description"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {log.service_provider}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px]">
                      {formatStatus(log.status)}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {log.odometer_at_service.toLocaleString()} km
                    </td>
                    <td className="px-4 py-3 font-mono text-red-400">
                      Rs. {(log.actual_cost ?? log.estimated_cost).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {formatDate(log.start_date)}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {formatDate(log.completed_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h4 className="mb-4 flex items-center gap-2 font-bold text-slate-100">
          <Route size={16} className="text-blue-400" />
          Trip History
        </h4>

        {history.trips.length === 0 ? (
          <p className="py-2 text-xs italic text-slate-500">
            No trip records exist for this vehicle.
          </p>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full min-w-[900px] text-left">
              <thead className="border-b border-slate-800 bg-slate-950 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Trip</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Distance</th>
                  <th className="px-4 py-3">Revenue</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {history.trips.map((trip) => (
                  <tr
                    key={trip.id}
                    className="text-slate-300 hover:bg-slate-800/20"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-400">
                      {trip.trip_code}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-200">
                        {trip.source} → {trip.destination}
                      </span>
                      <div className="text-[10px] text-slate-500">
                        {trip.cargo_description}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {trip.cargo_weight.toLocaleString()} kg
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {(trip.actual_distance ?? trip.planned_distance).toLocaleString()} km
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-400">
                      Rs. {trip.revenue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${getTripStatusClass(trip.status)}`}
                      >
                        {formatStatus(trip.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {formatDate(trip.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h4 className="mb-4 flex items-center gap-2 font-bold text-slate-100">
          <Fuel size={16} className="text-emerald-400" />
          Fuel History
        </h4>

        {history.fuel.length === 0 ? (
          <p className="py-2 text-xs italic text-slate-500">
            No fuel records exist for this vehicle.
          </p>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full min-w-[850px] text-left">
              <thead className="border-b border-slate-800 bg-slate-950 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Litres</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Odometer</th>
                  <th className="px-4 py-3">Station</th>
                  <th className="px-4 py-3">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {history.fuel.map((fuelLog) => (
                  <tr
                    key={fuelLog.id}
                    className="text-slate-300 hover:bg-slate-800/20"
                  >
                    <td className="px-4 py-3 font-mono">
                      {formatDate(fuelLog.fuel_date)}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {fuelLog.fuel_litres.toLocaleString()} L
                    </td>
                    <td className="px-4 py-3 font-mono">
                      Rs. {fuelLog.price_per_litre.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-red-400">
                      Rs. {fuelLog.fuel_cost.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {fuelLog.odometer_reading.toLocaleString()} km
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {fuelLog.fuel_station}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">
                      {fuelLog.receipt_number}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h4 className="mb-4 flex items-center gap-2 font-bold text-slate-100">
          <ReceiptIndianRupee
            size={16}
            className="text-violet-400"
          />
          Expense History
        </h4>

        {history.expenses.length === 0 ? (
          <p className="py-2 text-xs italic text-slate-500">
            No expense records exist for this vehicle.
          </p>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full min-w-[850px] text-left">
              <thead className="border-b border-slate-800 bg-slate-950 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {history.expenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="text-slate-300 hover:bg-slate-800/20"
                  >
                    <td className="px-4 py-3 font-mono">
                      {formatDate(expense.expense_date)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px]">
                      {formatStatus(expense.expense_type)}
                    </td>
                    <td className="max-w-md px-4 py-3 text-slate-400">
                      {expense.description}
                    </td>
                    <td className="px-4 py-3 font-mono text-red-400">
                      Rs. {expense.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">
                      {expense.receipt_number}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
