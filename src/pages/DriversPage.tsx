/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.js";
import { DriverStatus, UserRole } from "../types.js";
import { Search, UserPlus, AlertTriangle, ShieldCheck, Ban, Check, Shield } from "lucide-react";

export const DriversPage: React.FC = () => {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [licenceFilter, setLicenceFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");

  // Add Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    licence_number: "",
    licence_category: "Heavy Commercial",
    licence_expiry_date: "",
    contact_number: "",
    safety_score: "100",
    region: "Patna",
    status: DriverStatus.AVAILABLE,
  });

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        search,
        status: statusFilter,
        licence_status: licenceFilter,
        region: regionFilter,
      });
      const data = await apiFetch(`/drivers?${query.toString()}`);
      setDrivers(data);
    } catch (err: any) {
      setError(err.message || "Failed to load drivers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, [search, statusFilter, licenceFilter, regionFilter]);

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");

    try {
      await apiFetch("/drivers", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          safety_score: Number(form.safety_score),
        }),
      });

      setSuccessMsg("Driver profile registered successfully.");
      setShowAddModal(false);
      setForm({
        full_name: "",
        licence_number: "",
        licence_category: "Heavy Commercial",
        licence_expiry_date: "",
        contact_number: "",
        safety_score: "100",
        region: "Patna",
        status: DriverStatus.AVAILABLE,
      });
      fetchDrivers();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setFormError(err.message || "Failed to create driver.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleSuspend = async (driverId: string) => {
    if (!confirm("Are you sure you want to SUSPEND this driver? Suspended drivers cannot be assigned on active trips.")) return;
    try {
      await apiFetch(`/drivers/${driverId}/suspend`, { method: "PATCH" });
      setSuccessMsg("Driver status updated to SUSPENDED.");
      fetchDrivers();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleActivate = async (driverId: string) => {
    try {
      await apiFetch(`/drivers/${driverId}/activate`, { method: "PATCH" });
      setSuccessMsg("Driver status restored to AVAILABLE.");
      fetchDrivers();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Helper: get licence validity styling
  const getLicenceBadge = (expiryStr: string) => {
    const today = new Date();
    const expiry = new Date(expiryStr);
    const limit30 = new Date(Date.now() + 30 * 86400000);

    const todayStr = today.toISOString().split("T")[0];
    const limitStr = limit30.toISOString().split("T")[0];

    if (expiryStr < todayStr) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-900 uppercase">
          EXPIRED
        </span>
      );
    } else if (expiryStr <= limitStr) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-955 text-amber-400 border border-amber-900 uppercase">
          EXPIRING SOON
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-900/40 uppercase">
          VALID
        </span>
      );
    }
  };

  const isSafetyOfficerOrAdmin = user && [UserRole.ADMIN, UserRole.SAFETY_OFFICER, UserRole.DISPATCHER].includes(user.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Drivers Roster</h2>
          <p className="text-sm text-slate-400">Driver licence records, compliance tracking, and safety scores</p>
        </div>
        {isSafetyOfficerOrAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 cursor-pointer transition-colors"
          >
            <UserPlus size={16} className="stroke-[2.5]" />
            <span>Add Driver Profile</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="bg-emerald-950/40 border border-emerald-900 text-emerald-200 px-4 py-3 rounded-lg text-sm font-semibold">
          {successMsg}
        </div>
      )}

      {/* Query Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        {/* Search */}
        <div className="space-y-1.5 col-span-1 md:col-span-2">
          <label className="text-xs font-semibold text-slate-400 uppercase">Search drivers</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by full name, licence, contact..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Status filter */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase">Driver Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Statuses</option>
            {Object.values(DriverStatus).map((st) => (
              <option key={st} value={st}>
                {st.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        {/* Licence status */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase">Licence status</label>
          <select
            value={licenceFilter}
            onChange={(e) => setLicenceFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Licences</option>
            <option value="VALID">Valid Only</option>
            <option value="EXPIRING_SOON">Expiring Soon</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      </div>

      {/* Listing */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-mono text-sm uppercase">
            Loading roster telemetries...
          </div>
        ) : drivers.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <AlertTriangle className="mx-auto text-slate-600 mb-3" size={36} />
            <p className="font-bold text-slate-400">No Drivers Found</p>
            <p className="text-xs text-slate-500 mt-1">Adjust filters or create a new operator profile.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Full Name</th>
                  <th className="px-6 py-4">Licence Info</th>
                  <th className="px-6 py-4">Region & Contact</th>
                  <th className="px-6 py-4">Safety Score</th>
                  <th className="px-6 py-4">Status</th>
                  {user && [UserRole.ADMIN, UserRole.SAFETY_OFFICER].includes(user.role) && (
                    <th className="px-6 py-4 text-right">Sanctions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {drivers.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-100">
                      {d.full_name}
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      <div className="font-mono text-xs text-slate-200">{d.licence_number}</div>
                      <div className="text-xs text-slate-500">{d.licence_category}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-500">Exp: {d.licence_expiry_date}</span>
                        {getLicenceBadge(d.licence_expiry_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-300">{d.region}</div>
                      <div className="text-xs text-slate-500 font-mono">{d.contact_number}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <span className={`text-sm font-bold font-mono ${
                          d.safety_score >= 90 ? "text-emerald-400" :
                          d.safety_score >= 75 ? "text-amber-400" : "text-rose-500"
                        }`}>
                          {d.safety_score}/100
                        </span>
                        {/* Tiny score visual bar */}
                        <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className={`h-full rounded-full ${
                              d.safety_score >= 90 ? "bg-emerald-500" :
                              d.safety_score >= 75 ? "bg-amber-500" : "bg-rose-500"
                            }`}
                            style={{ width: `${d.safety_score}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {d.status === DriverStatus.AVAILABLE && (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-900/50">
                          Available
                        </span>
                      )}
                      {d.status === DriverStatus.ON_TRIP && (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-900/50">
                          On Trip
                        </span>
                      )}
                      {d.status === DriverStatus.OFF_DUTY && (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/20 text-amber-500 border border-amber-900/50">
                          Off Duty
                        </span>
                      )}
                      {d.status === DriverStatus.SUSPENDED && (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-red-950 text-red-400 border border-red-900/50">
                          Suspended
                        </span>
                      )}
                    </td>
                    {user && [UserRole.ADMIN, UserRole.SAFETY_OFFICER].includes(user.role) && (
                      <td className="px-6 py-4 text-right">
                        {d.status === DriverStatus.SUSPENDED ? (
                          <button
                            onClick={() => handleActivate(d.id)}
                            className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-400 font-bold px-3 py-1.5 rounded text-xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Check size={12} /> Un-Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSuspend(d.id)}
                            className="bg-red-950/50 hover:bg-red-900 border border-red-900/60 text-red-400 font-bold px-3 py-1.5 rounded text-xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                            disabled={d.status === DriverStatus.ON_TRIP}
                            title={d.status === DriverStatus.ON_TRIP ? "Driver is currently on active trip" : "Suspend driver"}
                          >
                            <Ban size={12} /> Suspend
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Driver Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3.5 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield size={18} className="text-emerald-400" /> Create Driver License Record
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 hover:text-slate-300 text-lg font-bold bg-transparent border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 bg-red-950/40 border border-red-900 text-red-200 p-3 rounded text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddDriver} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Driver Full Name
                </label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Manoj Verma"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-700"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Licence Number
                  </label>
                  <input
                    type="text"
                    value={form.licence_number}
                    onChange={(e) => setForm({ ...form, licence_number: e.target.value })}
                    placeholder="DL-44444"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-700 uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Licence Category
                  </label>
                  <input
                    type="text"
                    value={form.licence_category}
                    onChange={(e) => setForm({ ...form, licence_category: e.target.value })}
                    placeholder="Heavy Commercial"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Licence Expiry Date
                  </label>
                  <input
                    type="date"
                    value={form.licence_expiry_date}
                    onChange={(e) => setForm({ ...form, licence_expiry_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Safety Score (0 - 100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.safety_score}
                    onChange={(e) => setForm({ ...form, safety_score: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={form.contact_number}
                    onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
                    placeholder="9876543213"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Region
                  </label>
                  <input
                    type="text"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    placeholder="Patna"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-transparent border border-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition-colors"
                >
                  {formLoading ? "Creating Profile..." : "Register Driver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
