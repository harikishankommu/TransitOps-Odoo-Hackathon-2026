/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.js";
import { TrendingUp, FileSpreadsheet, Calendar, Search, AlertTriangle, Sparkles } from "lucide-react";

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-12-31");
  const [type, setType] = useState("ROI"); // "ROI" | "FUEL"

  const fetchReports = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        type,
      });
      const data = await apiFetch(`/reports/summary?${query.toString()}`);
      setReportData(data);
    } catch (err: any) {
      setError(err.message || "Failed to query reports summary.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate, type]);

  const handleDownloadCSV = async () => {
    try {
      const query = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        type,
      });
      // Call endpoint which returns CSV text
      const csvText = await apiFetch(`/reports/download?${query.toString()}`);
      
      // Trigger browser download
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `transitops_${type.toLowerCase()}_report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert("Failed to export report CSV: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-blue-500 font-bold mb-1.5">
            Analytics Engine
          </div>
          <h2 className="text-3xl font-light tracking-tight text-white font-sans">
            BUSINESS <span className="italic font-serif font-light text-blue-500">analytics</span> & REPORTS
          </h2>
          <p className="text-xs text-white/50 mt-1">Generate asset ROI sheets, fuel efficiency, and CSV spreadsheet summaries</p>
        </div>

        <button
          onClick={handleDownloadCSV}
          className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2.5 rounded-sm text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all duration-200 border border-blue-500/10 shadow-lg shadow-blue-500/10"
        >
          <FileSpreadsheet size={14} />
          <span>Export CSV Spreadsheet</span>
        </button>
      </div>

      {/* Reports Controls */}
      <div className="bg-[#111111]/80 border border-white/5 rounded-sm p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        {/* Date start */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-black/40 border border-white/10 focus:border-blue-500 rounded-sm px-3 py-2 text-xs uppercase tracking-wider text-white focus:outline-none transition-all"
          />
        </div>

        {/* Date end */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-black/40 border border-white/10 focus:border-blue-500 rounded-sm px-3 py-2 text-xs uppercase tracking-wider text-white focus:outline-none transition-all"
          />
        </div>

        {/* Report type */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Metrics type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full bg-black/40 border border-white/10 focus:border-blue-500 rounded-sm px-3 py-2 text-xs uppercase tracking-wider text-white focus:outline-none transition-all"
          >
            <option value="ROI" className="bg-[#111111] text-white">Asset Return On Investment (ROI)</option>
            <option value="FUEL" className="bg-[#111111] text-white">Fleet Fuel Efficiency Metrics</option>
          </select>
        </div>
      </div>

      {/* Main Ledger Grid */}
      <div className="bg-[#111111]/80 border border-white/5 rounded-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-white/40 font-mono text-[10px] uppercase tracking-widest">
            Compiling ledger computations...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-400 flex items-center justify-center gap-2">
            <AlertTriangle size={18} />
            <span className="text-xs uppercase tracking-wider font-mono">{error}</span>
          </div>
        ) : reportData.length === 0 ? (
          <div className="p-16 text-center text-white/40">
            <AlertTriangle className="mx-auto text-white/20 mb-3" size={36} />
            <p className="font-bold text-white/80 font-sans text-xs uppercase tracking-wider">No Data within Range</p>
            <p className="text-[11px] text-white/40 mt-1">Adjust start/end dates to fetch historical logs.</p>
          </div>
        ) : type === "ROI" ? (
          /* ROI REPORT LIST */
          <div className="overflow-x-auto text-sm text-white/80">
            <table className="w-full text-left">
              <thead className="bg-black/50 text-white/40 text-[10px] uppercase tracking-wider border-b border-white/5">
                <tr>
                  <th className="px-6 py-4 font-semibold">Vehicle Specs</th>
                  <th className="px-6 py-4 font-semibold">Acquisition Value</th>
                  <th className="px-6 py-4 font-semibold">Dispatched Revenue</th>
                  <th className="px-6 py-4 font-semibold">Total Fuel Costs</th>
                  <th className="px-6 py-4 font-semibold">Servicing Costs</th>
                  <th className="px-6 py-4 font-semibold">Net Profit Balance</th>
                  <th className="px-6 py-4 font-semibold">Calculated ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {reportData.map((row) => (
                  <tr key={row.vehicle_id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{row.vehicle_name}</div>
                      <div className="text-[10px] text-white/40 font-mono mt-0.5 uppercase tracking-wider">{row.registration_number}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-white/70">
                      Rs. {(row.acquisition_cost ?? 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-blue-400 font-medium">
                      Rs. {(row.revenue ?? 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-rose-400/80">
                      Rs. {(row.fuel_cost ?? 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-rose-400/80">
                      Rs. {(row.maintenance_cost ?? 0).toLocaleString()}
                    </td>
                    <td className={`px-6 py-4 font-mono text-xs font-bold ${row.net_profit >= 0 ? "text-blue-400" : "text-rose-400"}`}>
                      Rs. {(row.net_profit ?? 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-sm text-[10px] font-bold font-mono border uppercase tracking-wider ${
                        row.roi >= 15 ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                        row.roi >= 0 ? "bg-white/5 text-white/70 border-white/10" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}>
                        {row.roi.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* FUEL EFFICIENCY REPORT */
          <div className="overflow-x-auto text-sm text-white/80">
            <table className="w-full text-left">
              <thead className="bg-black/50 text-white/40 text-[10px] uppercase tracking-wider border-b border-white/5">
                <tr>
                  <th className="px-6 py-4 font-semibold">Vehicle Details</th>
                  <th className="px-6 py-4 font-semibold">Total Transit Distance</th>
                  <th className="px-6 py-4 font-semibold">Total Fuel Consumed</th>
                  <th className="px-6 py-4 font-semibold">Dispatched Odometer</th>
                  <th className="px-6 py-4 font-semibold">Fuel Efficiency Index</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {reportData.map((row) => (
                  <tr key={row.vehicle_id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{row.vehicle_name}</div>
                      <div className="text-[10px] text-white/40 font-mono mt-0.5 uppercase tracking-wider">{row.registration_number}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-white/70">
                      {(row.total_distance ?? 0).toLocaleString()} km
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-white/70">
                      {(row.total_fuel ?? 0).toLocaleString()} Litres
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-white/70">
                      {(row.current_odometer ?? 0).toLocaleString()} km
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-black/40 text-blue-400 border border-white/5 font-mono text-[10px] font-bold">
                        {row.efficiency} km/L
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
