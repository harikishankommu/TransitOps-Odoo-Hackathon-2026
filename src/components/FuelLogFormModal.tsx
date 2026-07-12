/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Fuel, X } from "lucide-react";

export interface FinancialVehicleOption {
  id: string;
  vehicle_name: string;
  registration_number: string;
  odometer: number;
  status: string;
}

export interface FinancialTripOption {
  id: string;
  trip_code: string;
  vehicle_id: string;
  source: string;
  destination: string;
  status: string;
}

export interface FuelFormValue {
  id?: string;
  vehicle_id: string;
  trip_id: string;
  fuel_litres: string;
  price_per_litre: string;
  odometer_reading: string;
  fuel_date: string;
  fuel_station: string;
  receipt_number: string;
  notes: string;
}

interface FuelLogFormModalProps {
  open: boolean;
  initialValue?: FuelFormValue | null;
  vehicles: FinancialVehicleOption[];
  trips: FinancialTripOption[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (value: FuelFormValue) => void;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM: FuelFormValue = {
  vehicle_id: "",
  trip_id: "",
  fuel_litres: "",
  price_per_litre: "",
  odometer_reading: "",
  fuel_date: getToday(),
  fuel_station: "",
  receipt_number: "",
  notes: "",
};

export const FuelLogFormModal: React.FC<
  FuelLogFormModalProps
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
    useState<FuelFormValue>(EMPTY_FORM);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(initialValue ?? {
      ...EMPTY_FORM,
      fuel_date: getToday(),
    });
  }, [initialValue, open]);

  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === form.vehicle_id,
  );

  const filteredTrips = useMemo(
    () =>
      trips.filter(
        (trip) =>
          !form.vehicle_id ||
          trip.vehicle_id === form.vehicle_id,
      ),
    [form.vehicle_id, trips],
  );

  const calculatedCost =
    Number(form.fuel_litres || 0) *
    Number(form.price_per_litre || 0);

  if (!open) {
    return null;
  }

  const updateField = (
    field: keyof FuelFormValue,
    value: string,
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
              <Fuel size={18} className="text-emerald-400" />
              {initialValue?.id
                ? "Edit Fuel Record"
                : "Log Fuel Refill"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Record receipt, quantity, price, odometer, and optional trip linkage.
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
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm normal-case text-slate-100 outline-none focus:border-emerald-500"
              >
                <option value="">
                  Select a vehicle...
                </option>
                {vehicles.map((vehicle) => (
                  <option
                    key={vehicle.id}
                    value={vehicle.id}
                  >
                    {vehicle.vehicle_name} (
                    {vehicle.registration_number}) —{" "}
                    {vehicle.status}
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

          {selectedVehicle && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 text-xs text-slate-400">
              Latest vehicle odometer:{" "}
              <span className="font-mono font-bold text-slate-200">
                {selectedVehicle.odometer.toLocaleString()} km
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="space-y-1.5 text-xs font-semibold uppercase text-slate-400">
              Fuel Litres
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.fuel_litres}
                onChange={(event) =>
                  updateField(
                    "fuel_litres",
                    event.target.value,
                  )
                }
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm normal-case text-slate-100 outline-none focus:border-emerald-500"
              />
            </label>

            <label className="space-y-1.5 text-xs font-semibold uppercase text-slate-400">
              Price Per Litre
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.price_per_litre}
                onChange={(event) =>
                  updateField(
                    "price_per_litre",
                    event.target.value,
                  )
                }
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm normal-case text-slate-100 outline-none focus:border-emerald-500"
              />
            </label>

            <div className="space-y-1.5 text-xs font-semibold uppercase text-slate-400">
              Calculated Cost
              <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2.5 font-mono text-sm normal-case text-emerald-300">
                Rs.{" "}
                {Number.isFinite(calculatedCost)
                  ? calculatedCost.toLocaleString(
                      undefined,
                      {
                        maximumFractionDigits: 2,
                      },
                    )
                  : "0"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold uppercase text-slate-400">
              Odometer Reading
              <input
                type="number"
                min="0"
                step="1"
                value={form.odometer_reading}
                onChange={(event) =>
                  updateField(
                    "odometer_reading",
                    event.target.value,
                  )
                }
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm normal-case text-slate-100 outline-none focus:border-emerald-500"
              />
            </label>

            <label className="space-y-1.5 text-xs font-semibold uppercase text-slate-400">
              Fuel Date
              <input
                type="date"
                max={getToday()}
                value={form.fuel_date}
                onChange={(event) =>
                  updateField(
                    "fuel_date",
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
              Fuel Station
              <input
                type="text"
                maxLength={100}
                value={form.fuel_station}
                onChange={(event) =>
                  updateField(
                    "fuel_station",
                    event.target.value,
                  )
                }
                placeholder="Indian Oil, Patna"
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm normal-case text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
              />
            </label>

            <label className="space-y-1.5 text-xs font-semibold uppercase text-slate-400">
              Receipt Number
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
                placeholder="FUEL-2026-001"
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm normal-case text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
              />
            </label>
          </div>

          <label className="block space-y-1.5 text-xs font-semibold uppercase text-slate-400">
            Notes
            <textarea
              rows={3}
              maxLength={300}
              value={form.notes}
              onChange={(event) =>
                updateField(
                  "notes",
                  event.target.value,
                )
              }
              placeholder="Optional notes..."
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
                  ? "Update Fuel Record"
                  : "Save Fuel Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
