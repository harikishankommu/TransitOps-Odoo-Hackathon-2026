/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

import {
  FuelType,
  type Vehicle,
  VehicleType,
} from "../types.js";
import { apiFetch } from "../utils/api.js";

interface VehicleFormModalProps {
  mode: "create" | "edit";
  vehicle?: Vehicle | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface VehicleFormState {
  registration_number: string;
  vehicle_name: string;
  model: string;
  vehicle_type: VehicleType;
  maximum_load_capacity: string;
  odometer: string;
  acquisition_cost: string;
  region: string;
  manufacture_year: string;
  fuel_type: FuelType;
}

const CURRENT_YEAR = new Date().getFullYear();
const MIN_MANUFACTURE_YEAR = 1900;
const REGISTRATION_PATTERN = /^[A-Z0-9-]{4,20}$/;

function makeInitialForm(
  vehicle?: Vehicle | null,
): VehicleFormState {
  if (vehicle) {
    return {
      registration_number:
        vehicle.registration_number,
      vehicle_name: vehicle.vehicle_name,
      model: vehicle.model,
      vehicle_type: vehicle.vehicle_type,
      maximum_load_capacity: String(
        vehicle.maximum_load_capacity,
      ),
      odometer: String(vehicle.odometer),
      acquisition_cost: String(
        vehicle.acquisition_cost,
      ),
      region: vehicle.region,
      manufacture_year: String(
        vehicle.manufacture_year,
      ),
      fuel_type: vehicle.fuel_type,
    };
  }

  return {
    registration_number: "",
    vehicle_name: "",
    model: "",
    vehicle_type: VehicleType.VAN,
    maximum_load_capacity: "",
    odometer: "0",
    acquisition_cost: "0",
    region: "Patna",
    manufacture_year: String(CURRENT_YEAR),
    fuel_type: FuelType.DIESEL,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "The vehicle could not be saved.";
}

function normalizeRegistrationNumber(
  value: string,
): string {
  return value
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function validateForm(
  form: VehicleFormState,
  originalVehicle?: Vehicle | null,
): string | null {
  const registrationNumber =
    normalizeRegistrationNumber(
      form.registration_number,
    );

  if (!REGISTRATION_PATTERN.test(registrationNumber)) {
    return "Registration number must contain 4–20 letters, numbers, or hyphens.";
  }

  if (
    form.vehicle_name.trim().length < 2 ||
    form.vehicle_name.trim().length > 80
  ) {
    return "Vehicle name must contain between 2 and 80 characters.";
  }

  if (
    form.model.trim().length < 2 ||
    form.model.trim().length > 80
  ) {
    return "Model must contain between 2 and 80 characters.";
  }

  if (
    form.region.trim().length < 2 ||
    form.region.trim().length > 80
  ) {
    return "Region must contain between 2 and 80 characters.";
  }

  const capacity = Number(
    form.maximum_load_capacity,
  );
  const odometer = Number(form.odometer);
  const acquisitionCost = Number(
    form.acquisition_cost,
  );
  const manufactureYear = Number(
    form.manufacture_year,
  );

  if (!Number.isFinite(capacity) || capacity <= 0) {
    return "Maximum load capacity must be greater than zero.";
  }

  if (!Number.isFinite(odometer) || odometer < 0) {
    return "Odometer must be zero or greater.";
  }

  if (
    originalVehicle &&
    odometer < originalVehicle.odometer
  ) {
    return `Odometer cannot be reduced below ${originalVehicle.odometer.toLocaleString()} km.`;
  }

  if (
    !Number.isFinite(acquisitionCost) ||
    acquisitionCost < 0
  ) {
    return "Acquisition cost must be zero or greater.";
  }

  if (
    !Number.isInteger(manufactureYear) ||
    manufactureYear < MIN_MANUFACTURE_YEAR ||
    manufactureYear > CURRENT_YEAR + 1
  ) {
    return `Manufacture year must be between ${MIN_MANUFACTURE_YEAR} and ${CURRENT_YEAR + 1}.`;
  }

  return null;
}

export const VehicleFormModal: React.FC<
  VehicleFormModalProps
> = ({
  mode,
  vehicle,
  onClose,
  onSaved,
}) => {
  const [form, setForm] =
    useState<VehicleFormState>(() =>
      makeInitialForm(vehicle),
    );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] =
    useState(false);

  useEffect(() => {
    setForm(makeInitialForm(vehicle));
    setError("");
  }, [mode, vehicle]);

  const title = useMemo(
    () =>
      mode === "create"
        ? "Register Vehicle"
        : "Edit Vehicle",
    [mode],
  );

  const updateField = <
    Key extends keyof VehicleFormState,
  >(
    key: Key,
    value: VehicleFormState[Key],
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
      vehicle,
    );

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      registration_number:
        normalizeRegistrationNumber(
          form.registration_number,
        ),
      vehicle_name: form.vehicle_name.trim(),
      model: form.model.trim(),
      vehicle_type: form.vehicle_type,
      maximum_load_capacity: Number(
        form.maximum_load_capacity,
      ),
      odometer: Number(form.odometer),
      acquisition_cost: Number(
        form.acquisition_cost,
      ),
      region: form.region.trim(),
      manufacture_year: Number(
        form.manufacture_year,
      ),
      fuel_type: form.fuel_type,
    };

    setSubmitting(true);

    try {
      if (mode === "edit" && vehicle) {
        await apiFetch(
          `/vehicles/${vehicle.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          },
        );

        onSaved("Vehicle updated successfully.");
      } else {
        await apiFetch("/vehicles", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        onSaved("Vehicle registered successfully.");
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
      aria-labelledby="vehicle-form-title"
    >
      <div className="flex min-h-full items-center justify-center">
        <div className="w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
            <div>
              <h3
                id="vehicle-form-title"
                className="text-lg font-bold text-white"
              >
                {title}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Vehicle lifecycle status is controlled by
                trip, maintenance, and retirement workflows.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Close vehicle form"
            >
              <X size={18} />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="max-h-[calc(100vh-8rem)] overflow-y-auto p-6"
          >
            {error && (
              <div className="mb-5 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Registration Number
                </span>
                <input
                  type="text"
                  value={form.registration_number}
                  onChange={(event) =>
                    updateField(
                      "registration_number",
                      event.target.value.toUpperCase(),
                    )
                  }
                  maxLength={20}
                  placeholder="BR01AB1234"
                  autoComplete="off"
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm uppercase text-slate-100 outline-none transition-colors placeholder:text-slate-700 focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Vehicle Name
                </span>
                <input
                  type="text"
                  value={form.vehicle_name}
                  onChange={(event) =>
                    updateField(
                      "vehicle_name",
                      event.target.value,
                    )
                  }
                  maxLength={80}
                  placeholder="Van-05"
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-700 focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Model
                </span>
                <input
                  type="text"
                  value={form.model}
                  onChange={(event) =>
                    updateField(
                      "model",
                      event.target.value,
                    )
                  }
                  maxLength={80}
                  placeholder="Tata Winger"
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-700 focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Manufacture Year
                </span>
                <input
                  type="number"
                  min={MIN_MANUFACTURE_YEAR}
                  max={CURRENT_YEAR + 1}
                  step="1"
                  value={form.manufacture_year}
                  onChange={(event) =>
                    updateField(
                      "manufacture_year",
                      event.target.value,
                    )
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Vehicle Type
                </span>
                <select
                  value={form.vehicle_type}
                  onChange={(event) =>
                    updateField(
                      "vehicle_type",
                      event.target.value as VehicleType,
                    )
                  }
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-500"
                >
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
                  Fuel Type
                </span>
                <select
                  value={form.fuel_type}
                  onChange={(event) =>
                    updateField(
                      "fuel_type",
                      event.target.value as FuelType,
                    )
                  }
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-500"
                >
                  {Object.values(FuelType).map(
                    (fuelType) => (
                      <option
                        key={fuelType}
                        value={fuelType}
                      >
                        {fuelType}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Maximum Capacity (kg)
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.maximum_load_capacity}
                  onChange={(event) =>
                    updateField(
                      "maximum_load_capacity",
                      event.target.value,
                    )
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Odometer (km)
                </span>
                <input
                  type="number"
                  min={vehicle?.odometer ?? 0}
                  step="0.01"
                  value={form.odometer}
                  onChange={(event) =>
                    updateField(
                      "odometer",
                      event.target.value,
                    )
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Acquisition Cost (Rs.)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.acquisition_cost}
                  onChange={(event) =>
                    updateField(
                      "acquisition_cost",
                      event.target.value,
                    )
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Operating Region
                </span>
                <input
                  type="text"
                  value={form.region}
                  onChange={(event) =>
                    updateField(
                      "region",
                      event.target.value,
                    )
                  }
                  maxLength={80}
                  placeholder="Patna"
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-700 focus:border-emerald-500"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Saving..."
                  : mode === "create"
                    ? "Register Vehicle"
                    : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
