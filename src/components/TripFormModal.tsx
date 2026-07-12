/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

import {
  type Driver,
  DriverStatus,
  type Trip,
  type Vehicle,
  VehicleStatus,
} from "../types.js";
import { apiFetch } from "../utils/api.js";

interface TripFormModalProps {
  mode: "create" | "edit";
  trip?: Trip | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface TripFormState {
  source: string;
  destination: string;
  vehicle_id: string;
  driver_id: string;
  cargo_description: string;
  cargo_weight: string;
  planned_distance: string;
  planned_start_time: string;
  revenue: string;
  notes: string;
}

interface VehicleListResponse {
  data: Vehicle[];
}

interface DriverListResponse {
  data: Driver[];
}

function toLocalDateTimeInput(value?: string): string {
  if (!value) {
    const date = new Date(Date.now() + 60 * 60 * 1000);
    const local = new Date(
      date.getTime() - date.getTimezoneOffset() * 60_000,
    );
    return local.toISOString().slice(0, 16);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return local.toISOString().slice(0, 16);
}

function makeInitialForm(trip?: Trip | null): TripFormState {
  if (trip) {
    return {
      source: trip.source,
      destination: trip.destination,
      vehicle_id: trip.vehicle_id,
      driver_id: trip.driver_id,
      cargo_description: trip.cargo_description,
      cargo_weight: String(trip.cargo_weight),
      planned_distance: String(trip.planned_distance),
      planned_start_time: toLocalDateTimeInput(
        trip.planned_start_time,
      ),
      revenue: String(trip.revenue),
      notes: trip.notes ?? "",
    };
  }

  return {
    source: "",
    destination: "",
    vehicle_id: "",
    driver_id: "",
    cargo_description: "",
    cargo_weight: "",
    planned_distance: "",
    planned_start_time: toLocalDateTimeInput(),
    revenue: "0",
    notes: "",
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The trip could not be saved.";
}

function validateForm(
  form: TripFormState,
  selectedVehicle?: Vehicle,
): string | null {
  const source = form.source.trim();
  const destination = form.destination.trim();
  const cargoDescription = form.cargo_description.trim();
  const cargoWeight = Number(form.cargo_weight);
  const plannedDistance = Number(form.planned_distance);
  const revenue = Number(form.revenue || 0);
  const plannedStart = new Date(form.planned_start_time);

  if (source.length < 2 || source.length > 120) {
    return "Source must contain between 2 and 120 characters.";
  }

  if (
    destination.length < 2 ||
    destination.length > 120
  ) {
    return "Destination must contain between 2 and 120 characters.";
  }

  if (source.toLowerCase() === destination.toLowerCase()) {
    return "Source and destination must be different.";
  }

  if (!form.vehicle_id) {
    return "Select a vehicle.";
  }

  if (!form.driver_id) {
    return "Select a driver.";
  }

  if (
    cargoDescription.length < 2 ||
    cargoDescription.length > 240
  ) {
    return "Cargo description must contain between 2 and 240 characters.";
  }

  if (!Number.isFinite(cargoWeight) || cargoWeight <= 0) {
    return "Cargo weight must be greater than zero.";
  }

  if (
    selectedVehicle &&
    cargoWeight > selectedVehicle.maximum_load_capacity
  ) {
    return `Cargo weight exceeds the selected vehicle capacity of ${selectedVehicle.maximum_load_capacity.toLocaleString()} kg.`;
  }

  if (
    !Number.isFinite(plannedDistance) ||
    plannedDistance <= 0
  ) {
    return "Planned distance must be greater than zero.";
  }

  if (Number.isNaN(plannedStart.getTime())) {
    return "Enter a valid planned departure time.";
  }

  if (!Number.isFinite(revenue) || revenue < 0) {
    return "Revenue must be zero or greater.";
  }

  if (form.notes.trim().length > 1000) {
    return "Notes cannot exceed 1000 characters.";
  }

  return null;
}

export const TripFormModal: React.FC<TripFormModalProps> = ({
  mode,
  trip,
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState<TripFormState>(() =>
    makeInitialForm(trip),
  );
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(makeInitialForm(trip));
    setError("");
  }, [mode, trip]);

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async (): Promise<void> => {
      setLoadingOptions(true);

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

        if (cancelled) {
          return;
        }

        setVehicles(vehicleResponse.data);
        setDrivers(driverResponse.data);
      } catch (requestError) {
        if (!cancelled) {
          setError(getErrorMessage(requestError));
        }
      } finally {
        if (!cancelled) {
          setLoadingOptions(false);
        }
      }
    };

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectableVehicles = useMemo(
    () =>
      vehicles.filter(
        (vehicle) =>
          vehicle.status === VehicleStatus.AVAILABLE ||
          vehicle.id === trip?.vehicle_id,
      ),
    [trip?.vehicle_id, vehicles],
  );

  const today = new Date().toISOString().slice(0, 10);
  const selectableDrivers = useMemo(
    () =>
      drivers.filter(
        (driver) =>
          (driver.status === DriverStatus.AVAILABLE &&
            driver.licence_expiry_date >= today) ||
          driver.id === trip?.driver_id,
      ),
    [drivers, today, trip?.driver_id],
  );

  const selectedVehicle = selectableVehicles.find(
    (vehicle) => vehicle.id === form.vehicle_id,
  );
  const cargoWeight = Number(form.cargo_weight || 0);
  const isOverweight = Boolean(
    selectedVehicle &&
      cargoWeight > selectedVehicle.maximum_load_capacity,
  );

  const title =
    mode === "create" ? "Create Draft Trip" : "Edit Draft Trip";

  const updateField = <Key extends keyof TripFormState>(
    key: Key,
    value: TripFormState[Key],
  ): void => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setError("");

    const validationError = validateForm(
      form,
      selectedVehicle,
    );

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      source: form.source.trim(),
      destination: form.destination.trim(),
      vehicle_id: form.vehicle_id,
      driver_id: form.driver_id,
      cargo_description: form.cargo_description.trim(),
      cargo_weight: Number(form.cargo_weight),
      planned_distance: Number(form.planned_distance),
      planned_start_time: new Date(
        form.planned_start_time,
      ).toISOString(),
      revenue: Number(form.revenue || 0),
      notes: form.notes.trim() || undefined,
    };

    setSubmitting(true);

    try {
      if (mode === "edit" && trip) {
        await apiFetch(`/trips/${trip.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        onSaved("Draft trip updated successfully.");
      } else {
        await apiFetch("/trips", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onSaved("Draft trip created successfully.");
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trip-form-title"
    >
      <div className="flex min-h-full items-center justify-center">
        <div className="w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-800 px-6 py-4">
            <div>
              <h3
                id="trip-form-title"
                className="text-lg font-bold text-white"
              >
                {title}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Vehicle and driver availability is verified again at dispatch time.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
              aria-label="Close trip form"
            >
              <X size={18} />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="max-h-[calc(100vh-7rem)] space-y-5 overflow-y-auto p-6"
          >
            {error && (
              <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Source
                </span>
                <input
                  type="text"
                  value={form.source}
                  onChange={(event) =>
                    updateField("source", event.target.value)
                  }
                  maxLength={120}
                  placeholder="Patna Warehouse"
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-700 focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Destination
                </span>
                <input
                  type="text"
                  value={form.destination}
                  onChange={(event) =>
                    updateField("destination", event.target.value)
                  }
                  maxLength={120}
                  placeholder="Gaya Distribution Hub"
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-700 focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Vehicle
                </span>
                <select
                  value={form.vehicle_id}
                  onChange={(event) =>
                    updateField("vehicle_id", event.target.value)
                  }
                  required
                  disabled={loadingOptions}
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500 disabled:opacity-50"
                >
                  <option value="">
                    {loadingOptions
                      ? "Loading vehicles..."
                      : "Select available vehicle"}
                  </option>
                  {selectableVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.registration_number} — {vehicle.vehicle_name} ({vehicle.maximum_load_capacity.toLocaleString()} kg)
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Driver
                </span>
                <select
                  value={form.driver_id}
                  onChange={(event) =>
                    updateField("driver_id", event.target.value)
                  }
                  required
                  disabled={loadingOptions}
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500 disabled:opacity-50"
                >
                  <option value="">
                    {loadingOptions
                      ? "Loading drivers..."
                      : "Select available driver"}
                  </option>
                  {selectableDrivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.full_name} — {driver.licence_number}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase text-slate-400">
                Cargo Description
              </span>
              <input
                type="text"
                value={form.cargo_description}
                onChange={(event) =>
                  updateField(
                    "cargo_description",
                    event.target.value,
                  )
                }
                maxLength={240}
                placeholder="Electronics cartons"
                required
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-700 focus:border-emerald-500"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Cargo Weight (kg)
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.cargo_weight}
                  onChange={(event) =>
                    updateField("cargo_weight", event.target.value)
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Planned Distance (km)
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.planned_distance}
                  onChange={(event) =>
                    updateField(
                      "planned_distance",
                      event.target.value,
                    )
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Revenue (Rs.)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.revenue}
                  onChange={(event) =>
                    updateField("revenue", event.target.value)
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
                />
              </label>
            </div>

            {selectedVehicle && (
              <div
                className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-xs ${
                  isOverweight
                    ? "border-red-900 bg-red-950/30 text-red-300"
                    : "border-slate-800 bg-slate-950/40 text-slate-400"
                }`}
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>
                  Selected capacity: {selectedVehicle.maximum_load_capacity.toLocaleString()} kg. Cargo usage: {cargoWeight.toLocaleString()} kg.
                </span>
              </div>
            )}

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase text-slate-400">
                Planned Departure
              </span>
              <input
                type="datetime-local"
                value={form.planned_start_time}
                onChange={(event) =>
                  updateField(
                    "planned_start_time",
                    event.target.value,
                  )
                }
                required
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase text-slate-400">
                Notes
              </span>
              <textarea
                value={form.notes}
                onChange={(event) =>
                  updateField("notes", event.target.value)
                }
                maxLength={1000}
                rows={4}
                placeholder="Route restrictions, handling instructions, or dispatcher notes."
                className="w-full resize-y rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-700 focus:border-emerald-500"
              />
            </label>

            <div className="flex justify-end gap-3 border-t border-slate-800 pt-5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-400 transition-colors hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || loadingOptions || isOverweight}
                className="rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Saving Trip..."
                  : mode === "create"
                    ? "Create Draft"
                    : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
