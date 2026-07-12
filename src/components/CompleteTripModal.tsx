/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

import { apiFetch } from "../utils/api.js";

interface CompleteTripModalProps {
  tripId: string;
  tripCode: string;
  plannedDistance: number;
  currentOdometer: number;
  currentRevenue: number;
  onClose: () => void;
  onCompleted: (message: string) => void;
}

interface CompletionFormState {
  actual_distance: string;
  final_odometer: string;
  fuel_consumed: string;
  revenue: string;
  notes: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The trip could not be completed.";
}

export const CompleteTripModal: React.FC<
  CompleteTripModalProps
> = ({
  tripId,
  tripCode,
  plannedDistance,
  currentOdometer,
  currentRevenue,
  onClose,
  onCompleted,
}) => {
  const [form, setForm] = useState<CompletionFormState>({
    actual_distance: String(plannedDistance),
    final_odometer: String(
      currentOdometer + plannedDistance,
    ),
    fuel_consumed: "0",
    revenue: String(currentRevenue),
    notes: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm({
      actual_distance: String(plannedDistance),
      final_odometer: String(
        currentOdometer + plannedDistance,
      ),
      fuel_consumed: "0",
      revenue: String(currentRevenue),
      notes: "",
    });
    setError("");
  }, [currentOdometer, currentRevenue, plannedDistance]);

  const updateField = <Key extends keyof CompletionFormState>(
    key: Key,
    value: CompletionFormState[Key],
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

    const actualDistance = Number(form.actual_distance);
    const finalOdometer = Number(form.final_odometer);
    const fuelConsumed = Number(form.fuel_consumed);
    const revenue = Number(form.revenue);

    if (
      !Number.isFinite(actualDistance) ||
      actualDistance <= 0
    ) {
      setError("Actual distance must be greater than zero.");
      return;
    }

    if (
      !Number.isFinite(finalOdometer) ||
      finalOdometer < currentOdometer
    ) {
      setError(
        `Final odometer cannot be below ${currentOdometer.toLocaleString()} km.`,
      );
      return;
    }

    if (finalOdometer < currentOdometer + actualDistance) {
      setError(
        "Final odometer must be at least the current odometer plus the actual distance.",
      );
      return;
    }

    if (
      !Number.isFinite(fuelConsumed) ||
      fuelConsumed < 0
    ) {
      setError("Fuel consumed must be zero or greater.");
      return;
    }

    if (!Number.isFinite(revenue) || revenue < 0) {
      setError("Revenue must be zero or greater.");
      return;
    }

    if (form.notes.trim().length > 1000) {
      setError("Notes cannot exceed 1000 characters.");
      return;
    }

    setSubmitting(true);

    try {
      await apiFetch(`/trips/${tripId}/complete`, {
        method: "POST",
        body: JSON.stringify({
          actual_distance: actualDistance,
          final_odometer: finalOdometer,
          fuel_consumed: fuelConsumed,
          revenue,
          notes: form.notes.trim() || undefined,
        }),
      });

      onCompleted(`Trip ${tripCode} completed successfully.`);
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
      aria-labelledby="complete-trip-title"
    >
      <div className="flex min-h-full items-center justify-center">
        <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-800 px-6 py-4">
            <div>
              <h3
                id="complete-trip-title"
                className="text-lg font-bold text-white"
              >
                Complete {tripCode}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Completion releases the assigned vehicle and driver.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md p-2 text-slate-500 hover:bg-slate-800 hover:text-white disabled:opacity-50"
              aria-label="Close completion form"
            >
              <X size={18} />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4 p-6"
          >
            {error && (
              <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Actual Distance (km)
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.actual_distance}
                  onChange={(event) =>
                    updateField(
                      "actual_distance",
                      event.target.value,
                    )
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Final Odometer (km)
                </span>
                <input
                  type="number"
                  min={currentOdometer}
                  step="0.01"
                  value={form.final_odometer}
                  onChange={(event) =>
                    updateField(
                      "final_odometer",
                      event.target.value,
                    )
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
                />
                <span className="block text-[10px] text-slate-600">
                  Current: {currentOdometer.toLocaleString()} km
                </span>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Fuel Consumed (L)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.fuel_consumed}
                  onChange={(event) =>
                    updateField(
                      "fuel_consumed",
                      event.target.value,
                    )
                  }
                  required
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Final Revenue (Rs.)
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

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase text-slate-400">
                Completion Notes
              </span>
              <textarea
                value={form.notes}
                onChange={(event) =>
                  updateField("notes", event.target.value)
                }
                maxLength={1000}
                rows={4}
                placeholder="Arrival condition, route deviations, tolls, or operational notes."
                className="w-full resize-y rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-700 focus:border-emerald-500"
              />
            </label>

            <div className="flex justify-end gap-3 border-t border-slate-800 pt-5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Completing Trip..."
                  : "Authorize Completion"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
