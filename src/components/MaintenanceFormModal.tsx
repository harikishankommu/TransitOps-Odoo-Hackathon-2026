/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Wrench, X } from "lucide-react";

import {
  MaintenanceType,
  type Vehicle,
} from "../types.js";
import { apiFetch } from "../utils/api.js";

interface MaintenanceFormModalProps {
  vehicles: Vehicle[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface MaintenanceFormState {
  vehicle_id: string;
  maintenance_type: MaintenanceType;
  description: string;
  service_provider: string;
  start_date: string;
  expected_completion_date: string;
  estimated_cost: string;
  odometer_at_service: string;
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getInitialForm(): MaintenanceFormState {
  const today = new Date();
  const expected = new Date(today);
  expected.setDate(expected.getDate() + 3);

  return {
    vehicle_id: "",
    maintenance_type:
      MaintenanceType.GENERAL_INSPECTION,
    description: "",
    service_provider: "",
    start_date: toDateInputValue(today),
    expected_completion_date:
      toDateInputValue(expected),
    estimated_cost: "0",
    odometer_at_service: "",
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "The maintenance record could not be created.";
}

export const MaintenanceFormModal: React.FC<
  MaintenanceFormModalProps
> = ({
  vehicles,
  onClose,
  onSaved,
}) => {
  const [form, setForm] =
    useState<MaintenanceFormState>(
      getInitialForm,
    );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] =
    useState(false);

  const selectedVehicle = useMemo(
    () =>
      vehicles.find(
        (vehicle) =>
          vehicle.id === form.vehicle_id,
      ) ?? null,
    [form.vehicle_id, vehicles],
  );

  useEffect(() => {
    if (!selectedVehicle) {
      return;
    }

    setForm((current) => ({
      ...current,
      odometer_at_service: String(
        selectedVehicle.odometer,
      ),
    }));
  }, [selectedVehicle]);

  const updateField = <
    Key extends keyof MaintenanceFormState,
  >(
    key: Key,
    value: MaintenanceFormState[Key],
  ): void => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const validateForm = (): string | null => {
    if (!selectedVehicle) {
      return "Select an available vehicle.";
    }

    if (
      form.description.trim().length < 3 ||
      form.description.trim().length > 500
    ) {
      return "Description must contain between 3 and 500 characters.";
    }

    if (
      form.service_provider.trim().length < 2 ||
      form.service_provider.trim().length > 100
    ) {
      return "Service provider must contain between 2 and 100 characters.";
    }

    if (
      form.expected_completion_date <
      form.start_date
    ) {
      return "Expected completion date cannot be before the start date.";
    }

    const estimatedCost = Number(
      form.estimated_cost,
    );
    const serviceOdometer = Number(
      form.odometer_at_service,
    );

    if (
      !Number.isFinite(estimatedCost) ||
      estimatedCost < 0
    ) {
      return "Estimated cost must be zero or greater.";
    }

    if (
      !Number.isFinite(serviceOdometer) ||
      serviceOdometer < selectedVehicle.odometer
    ) {
      return `Service odometer cannot be below the current vehicle reading of ${selectedVehicle.odometer.toLocaleString()} km.`;
    }

    return null;
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setError("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      await apiFetch("/maintenance", {
        method: "POST",
        body: JSON.stringify({
          vehicle_id: form.vehicle_id,
          maintenance_type:
            form.maintenance_type,
          description: form.description.trim(),
          service_provider:
            form.service_provider.trim(),
          start_date: form.start_date,
          expected_completion_date:
            form.expected_completion_date,
          estimated_cost: Number(
            form.estimated_cost,
          ),
          odometer_at_service: Number(
            form.odometer_at_service,
          ),
        }),
      });

      onSaved(
        "Maintenance started. The vehicle is now IN SHOP.",
      );
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
      aria-labelledby="maintenance-form-title"
    >
      <div className="flex min-h-full items-center justify-center">
        <div className="w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
            <div>
              <h3
                id="maintenance-form-title"
                className="flex items-center gap-2 text-lg font-bold text-white"
              >
                <Wrench
                  size={18}
                  className="text-emerald-400"
                />
                Start Maintenance
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Starting maintenance marks the selected
                vehicle as IN SHOP and blocks dispatch.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Close maintenance form"
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
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Available Vehicle
                </span>
                <select
                  value={form.vehicle_id}
                  onChange={(event) =>
                    updateField(
                      "vehicle_id",
                      event.target.value,
                    )
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-500"
                >
                  <option value="">
                    Select an available vehicle
                  </option>
                  {vehicles.map((vehicle) => (
                    <option
                      key={vehicle.id}
                      value={vehicle.id}
                    >
                      {vehicle.vehicle_name} (
                      {vehicle.registration_number}) —
                      {vehicle.odometer.toLocaleString()} km
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Maintenance Type
                </span>
                <select
                  value={form.maintenance_type}
                  onChange={(event) =>
                    updateField(
                      "maintenance_type",
                      event.target
                        .value as MaintenanceType,
                    )
                  }
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-500"
                >
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
                  Service Provider
                </span>
                <input
                  type="text"
                  value={form.service_provider}
                  onChange={(event) =>
                    updateField(
                      "service_provider",
                      event.target.value,
                    )
                  }
                  maxLength={100}
                  placeholder="TransitOps Central Workshop"
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-700 focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Start Date
                </span>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(event) =>
                    updateField(
                      "start_date",
                      event.target.value,
                    )
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Expected Completion
                </span>
                <input
                  type="date"
                  min={form.start_date}
                  value={
                    form.expected_completion_date
                  }
                  onChange={(event) =>
                    updateField(
                      "expected_completion_date",
                      event.target.value,
                    )
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Estimated Cost (Rs.)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.estimated_cost}
                  onChange={(event) =>
                    updateField(
                      "estimated_cost",
                      event.target.value,
                    )
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Odometer at Service (km)
                </span>
                <input
                  type="number"
                  min={
                    selectedVehicle?.odometer ?? 0
                  }
                  step="1"
                  value={form.odometer_at_service}
                  onChange={(event) =>
                    updateField(
                      "odometer_at_service",
                      event.target.value,
                    )
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Description
                </span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateField(
                      "description",
                      event.target.value,
                    )
                  }
                  maxLength={500}
                  rows={4}
                  placeholder="Describe the issue, inspection requirements, or repair work."
                  required
                  className="w-full resize-y rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-700 focus:border-emerald-500"
                />
              </label>
            </div>

            {vehicles.length === 0 && (
              <div className="mt-5 rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs text-amber-300">
                No AVAILABLE vehicle can currently enter
                maintenance.
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-800 pt-5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-md border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  submitting ||
                  vehicles.length === 0
                }
                className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Starting Maintenance..."
                  : "Start Maintenance"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
