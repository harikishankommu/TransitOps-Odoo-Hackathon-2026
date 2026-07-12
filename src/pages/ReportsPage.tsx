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
  Download,
  FileSpreadsheet,
  Filter,
  Printer,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

import { useAuth } from "../context/AuthContext.js";
import { apiFetch } from "../utils/api.js";

type AnalyticsReportType =
  | "VEHICLE"
  | "FINANCIAL"
  | "FUEL"
  | "MAINTENANCE"
  | "DRIVER";

type ReportCellFormat =
  | "text"
  | "number"
  | "currency"
  | "percent";

interface SelectOption {
  id: string;
  label: string;
}

interface ReportOptionsResponse {
  report_types: AnalyticsReportType[];
  vehicles: SelectOption[];
  drivers: SelectOption[];
}

interface ReportColumn {
  key: string;
  label: string;
  format: ReportCellFormat;
}

interface ReportSummaryItem {
  label: string;
  value: number;
  format: Exclude<ReportCellFormat, "text">;
}

interface AnalyticsReport {
  type: AnalyticsReportType;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number>>;
  summary: ReportSummaryItem[];
}

const REPORT_LABELS: Record<
  AnalyticsReportType,
  string
> = {
  VEHICLE: "Vehicle Performance & ROI",
  FINANCIAL: "Revenue and Expense Summary",
  FUEL: "Fuel Efficiency Analysis",
  MAINTENANCE: "Maintenance Cost Analysis",
  DRIVER: "Driver Performance",
};

function getDefaultDateRange(): {
  start: string;
  end: string;
} {
  const today = new Date();
  const year = today.getFullYear();

  return {
    start: `${year}-01-01`,
    end: today.toISOString().slice(0, 10),
  };
}

function formatValue(
  value: string | number,
  format: ReportCellFormat,
): string {
  if (format === "text") {
    return String(value);
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "—";
  }

  if (format === "currency") {
    return `₹${numeric.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}`;
  }

  if (format === "percent") {
    return `${numeric.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}%`;
  }

  return numeric.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function csvEscape(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const defaultRange = useMemo(
    () => getDefaultDateRange(),
    [],
  );

  const [options, setOptions] =
    useState<ReportOptionsResponse | null>(null);
  const [report, setReport] =
    useState<AnalyticsReport | null>(null);

  const [type, setType] =
    useState<AnalyticsReportType | null>(null);
  const [startDate, setStartDate] = useState(
    defaultRange.start,
  );
  const [endDate, setEndDate] = useState(
    defaultRange.end,
  );
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");

  const [loadingOptions, setLoadingOptions] =
    useState(true);
  const [loadingReport, setLoadingReport] =
    useState(false);
  const [error, setError] = useState("");

  const loadReport = useCallback(
    async (
      selectedType: AnalyticsReportType,
    ): Promise<void> => {
      try {
        setLoadingReport(true);
        setError("");

        const query = new URLSearchParams({
          type: selectedType,
          start_date: startDate,
          end_date: endDate,
        });

        if (vehicleId) {
          query.set("vehicle_id", vehicleId);
        }

        if (driverId) {
          query.set("driver_id", driverId);
        }

        const data =
          await apiFetch<AnalyticsReport>(
            `/reports/analytics?${query.toString()}`,
          );

        setReport(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to generate the report.",
        );
      } finally {
        setLoadingReport(false);
      }
    },
    [driverId, endDate, startDate, vehicleId],
  );

  useEffect(() => {
    const loadOptions = async (): Promise<void> => {
      try {
        setLoadingOptions(true);
        setError("");

        const data =
          await apiFetch<ReportOptionsResponse>(
            "/reports/options",
          );

        setOptions(data);

        const firstType =
          data.report_types[0] ?? null;
        setType(firstType);

        if (firstType) {
          await loadReport(firstType);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load report options.",
        );
      } finally {
        setLoadingOptions(false);
      }
    };

    void loadOptions();
  }, [loadReport]);

  const handleApplyFilters = (): void => {
    if (!type) {
      return;
    }

    void loadReport(type);
  };

  const handleTypeChange = (
    nextType: AnalyticsReportType,
  ): void => {
    setType(nextType);
    setReport(null);

    window.setTimeout(() => {
      void loadReport(nextType);
    }, 0);
  };

  const handleExportCsv = (): void => {
    if (!report || report.rows.length === 0) {
      return;
    }

    const header = report.columns
      .map((column) =>
        csvEscape(column.label),
      )
      .join(",");
    const rows = report.rows.map((row) =>
      report.columns
        .map((column) =>
          csvEscape(
            String(row[column.key] ?? ""),
          ),
        )
        .join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(
      ["\uFEFF", csv],
      {
        type: "text/csv;charset=utf-8",
      },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download =
      `transitops-${report.type.toLowerCase()}-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const showVehicleFilter =
    type !== "DRIVER" || Boolean(options?.vehicles.length);
  const showDriverFilter =
    type === "DRIVER";

  if (loadingOptions) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 text-white/45">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em]">
          Loading analytics controls...
        </p>
      </div>
    );
  }

  if (!options || options.report_types.length === 0) {
    return (
      <div className="rounded-sm border border-amber-500/20 bg-amber-500/5 p-8 text-center">
        <AlertTriangle
          size={28}
          className="mx-auto text-amber-400"
        />
        <h2 className="mt-3 text-sm font-bold uppercase tracking-wider text-white/75">
          No report access
        </h2>
        <p className="mt-2 text-xs text-white/40">
          Your current role does not include
          analytics reports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-blue-500">
            Analytics Engine
          </div>
          <h2 className="text-3xl font-light tracking-tight text-white">
            BUSINESS{" "}
            <span className="font-serif font-light italic text-blue-500">
              analytics
            </span>{" "}
            & REPORTS
          </h2>
          <p className="mt-1 text-xs text-white/50">
            Role-aware operational analytics for{" "}
            {user?.role.replaceAll("_", " ")}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={
              !report ||
              report.rows.length === 0 ||
              loadingReport
            }
            className="inline-flex items-center gap-2 rounded-sm bg-blue-600 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={14} />
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            disabled={!report}
            className="inline-flex items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white/70 transition hover:bg-white/10 disabled:opacity-40"
          >
            <Printer size={14} />
            Print
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 rounded-sm border border-white/5 bg-[#111111]/80 p-5 md:grid-cols-2 xl:grid-cols-5 print:hidden">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
            Report Type
          </label>
          <select
            value={type ?? ""}
            onChange={(event) =>
              handleTypeChange(
                event.target
                  .value as AnalyticsReportType,
              )
            }
            className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
          >
            {options.report_types.map(
              (reportType) => (
                <option
                  key={reportType}
                  value={reportType}
                  className="bg-[#111111]"
                >
                  {REPORT_LABELS[reportType]}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(event) =>
              setStartDate(event.target.value)
            }
            className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(event) =>
              setEndDate(event.target.value)
            }
            className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
          />
        </div>

        {showVehicleFilter && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Vehicle
            </label>
            <select
              value={vehicleId}
              onChange={(event) =>
                setVehicleId(event.target.value)
              }
              className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
            >
              <option
                value=""
                className="bg-[#111111]"
              >
                All vehicles
              </option>
              {options.vehicles.map((vehicle) => (
                <option
                  key={vehicle.id}
                  value={vehicle.id}
                  className="bg-[#111111]"
                >
                  {vehicle.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {showDriverFilter ? (
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Driver
            </label>
            <select
              value={driverId}
              onChange={(event) =>
                setDriverId(event.target.value)
              }
              className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
            >
              <option
                value=""
                className="bg-[#111111]"
              >
                All drivers
              </option>
              {options.drivers.map((driver) => (
                <option
                  key={driver.id}
                  value={driver.id}
                  className="bg-[#111111]"
                >
                  {driver.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleApplyFilters}
              disabled={loadingReport}
              className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-black transition hover:bg-blue-100 disabled:opacity-50"
            >
              {loadingReport ? (
                <RefreshCw
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <Filter size={14} />
              )}
              Apply Filters
            </button>
          </div>
        )}

        {showDriverFilter && (
          <div className="flex items-end md:col-span-2 xl:col-span-5">
            <button
              type="button"
              onClick={handleApplyFilters}
              disabled={loadingReport}
              className="inline-flex items-center justify-center gap-2 rounded-sm bg-white px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-black transition hover:bg-blue-100 disabled:opacity-50"
            >
              {loadingReport ? (
                <RefreshCw
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <Filter size={14} />
              )}
              Apply Filters
            </button>
          </div>
        )}
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-sm border border-red-500/20 bg-red-950/20 p-4 text-red-200">
          <AlertTriangle
            size={18}
            className="mt-0.5 text-red-400"
          />
          <p className="text-xs">{error}</p>
        </div>
      )}

      {report && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {report.summary.map((item) => (
              <div
                key={item.label}
                className="rounded-sm border border-white/5 bg-[#111111]/80 p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                    {item.label}
                  </span>
                  <TrendingUp
                    size={15}
                    className="text-blue-400"
                  />
                </div>
                <p className="mt-3 text-2xl font-light text-white">
                  {formatValue(
                    item.value,
                    item.format,
                  )}
                </p>
              </div>
            ))}
          </div>

          <section className="overflow-hidden rounded-sm border border-white/5 bg-[#111111]/80">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">
                  {REPORT_LABELS[report.type]}
                </h3>
                <p className="mt-1 text-[10px] text-white/35">
                  {startDate} to {endDate} •{" "}
                  {report.rows.length} rows
                </p>
              </div>
              <FileSpreadsheet
                size={17}
                className="text-blue-400"
              />
            </div>

            {loadingReport ? (
              <div className="p-14 text-center font-mono text-[10px] uppercase tracking-widest text-white/40">
                Compiling analytics...
              </div>
            ) : report.rows.length === 0 ? (
              <div className="p-14 text-center">
                <AlertTriangle
                  size={30}
                  className="mx-auto text-white/20"
                />
                <p className="mt-3 text-xs font-bold uppercase tracking-wider text-white/60">
                  No data in this range
                </p>
                <p className="mt-1 text-[11px] text-white/35">
                  Adjust the dates or entity filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-left">
                  <thead className="border-b border-white/5 bg-black/40">
                    <tr>
                      {report.columns.map(
                        (column) => (
                          <th
                            key={column.key}
                            className="px-5 py-4 text-[9px] font-bold uppercase tracking-wider text-white/40"
                          >
                            {column.label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {report.rows.map(
                      (row, rowIndex) => (
                        <tr
                          key={`${report.type}-${rowIndex}`}
                          className="transition hover:bg-white/[0.02]"
                        >
                          {report.columns.map(
                            (column) => (
                              <td
                                key={column.key}
                                className="px-5 py-4 text-xs text-white/70"
                              >
                                {formatValue(
                                  row[
                                    column.key
                                  ] ?? "",
                                  column.format,
                                )}
                              </td>
                            ),
                          )}
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
