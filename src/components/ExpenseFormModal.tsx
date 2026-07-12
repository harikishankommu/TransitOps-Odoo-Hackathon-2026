/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import { DollarSign, X } from "lucide-react";
import { ExpenseType } from "../types.js";
import {
  type FinancialTripOption,
  type FinancialVehicleOption,
} from "./FuelLogFormModal.js";

export interface ExpenseFormValue {
  id?: string;
  vehicle_id: string;
  trip_id: string;
  expense_type: ExpenseType;
  amount: string;
  expense_date: string;
  receipt_number: string;
  description: string;
}

interface ExpenseFormModalProps {
  open: boolean;
  initialValue?: ExpenseFormValue | null;
  vehicles: FinancialVehicleOption[];
  trips: FinancialTripOption[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (value: ExpenseFormValue) => void;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM: ExpenseFormValue = {
  vehicle_id: "",
  trip_id: "",
  expense_type: ExpenseType.TOLL,
  amount: "",
  expense_date: getToday(),
  receipt_number: "",
  description: "",
};

export const ExpenseFormModal: React.FC<
  ExpenseFormModalProps
> = ({
  open,
  initialValue,
  vehicles,
  trips,
  saving,
  error,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] =
    useState<ExpenseFormValue>(EMPTY_FORM);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(initialValue ?? {
      ...EMPTY_FORM,
      expense_date: getToday(),
    });
  }, [initialValue, open]);

  const filteredTrips = useMemo(
    () =>
      trips.filter(
        (trip) =>
          !form.vehicle_id ||
          trip.vehicle_id === form.vehicle_id,
      ),
    [form.vehicle_id, trips],
  );

  if (!open) {
    return null;
  }

  const updateField = <
    Field extends keyof ExpenseFormValue,
  >(
    field: Field,
    value: ExpenseFormValue[Field],
  ): void => {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "vehicle_id"
        ? { trip_id: "" }
        : {}),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
              <DollarSign
                size={18}
                className="text-emerald-400"
              />
              {initialValue?.id
                ? "Edit Expense"
                : "Log Operational Expense"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Record a manual operating cost and optionally connect it to a vehicle or trip.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(form);
          }}
          className="space-y-5 p-6"
        >
          {error && (
            <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold uppercase text-slate-400">
              Vehicle
              <select
                value={form.vehicle_id}
                onChange={(event) =>
                  updateField(
                    "vehicle_id",
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm normal-case text-slate-100 outline-none focus:border-emerald-500"
              >
                <option value="">
                  General expense
                </option>
                {vehicles.map((vehicle) => (
                  <option
                    key={vehicle.id}
                    value={vehicle.id}
                  >
                    {vehicle.vehicle_name} (
                    {vehicle.registration_number})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-xs font-semibold uppercase text-slate-400">
              Linked Trip
              <select
                value={form.trip_id}
                onChange={(event) =>
                  updateField(
                    "trip_id",
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm normal-case text-slate-100 outline-none focus:border-emerald-500"
              >
                <option value="">
                  No linked trip
                </option>
                {filteredTrips.map((trip) => (
                  <option
                    key={trip.id}
                    value={trip.id}
                  >
                    {trip.trip_code} — {trip.source} to{" "}
                    {trip.destination}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold uppercase text-slate-400">
              Expense Type
              <select
                value={form.expense_type}
                onChange={(event) =>
                  updateField(
                    "expense_type",
                    event.target.value as ExpenseType,
                  )
                }
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm normal-case text-slate-100 outline-none focus:border-emerald-500"
              >
                {Object.values(ExpenseType).map(
                  (expenseType) => (
                    <option
                      key={expenseType}
                      value={expenseType}
                    >
                      {expenseType.replaceAll("_", " ")}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="space-y-1.5 text-xs font-semibold uppercase text-slate-400">
              Amount
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) =>
                  updateField(
                    "amount",
                    event.target.value,
                  )
                }
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm normal-case text-slate-100 outline-none focus:border-emerald-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold uppercase text-slate-400">
              Expense Date
              <input
                type="date"
                max={getToday()}
                value={form.expense_date}
                onChange={(event) =>
                  updateField(
                    "expense_date",
                    event.target.value,
                  )
                }
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm normal-case text-slate-100 outline-none focus:border-emerald-500"
              />
            </label>

            <label className="space-y-1.5 text-xs font-semibold uppercase text-slate-400">
              Receipt / Reference
              <input
                type="text"
                maxLength={80}
                value={form.receipt_number}
                onChange={(event) =>
                  updateField(
                    "receipt_number",
                    event.target.value,
                  )
                }
                placeholder="EXP-2026-001"
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm normal-case text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
              />
            </label>
          </div>

          <label className="block space-y-1.5 text-xs font-semibold uppercase text-slate-400">
            Description
            <textarea
              rows={4}
              maxLength={500}
              value={form.description}
              onChange={(event) =>
                updateField(
                  "description",
                  event.target.value,
                )
              }
              placeholder="Describe the cost, vendor, and any supporting notes..."
              required
              className="w-full resize-none rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm normal-case text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
            />
          </label>

          <div className="flex justify-end gap-3 border-t border-slate-800 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : initialValue?.id
                  ? "Update Expense"
                  : "Save Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
