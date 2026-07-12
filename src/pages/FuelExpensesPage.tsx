/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.js";
import { UserRole } from "../types.js";
import { Plus, Search, AlertTriangle, Fuel, DollarSign, Calendar, Eye, CheckCircle } from "lucide-react";

export const FuelExpensesPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"fuel" | "expenses">("fuel");
  
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [expenseLogs, setExpenseLogs] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [search, setSearch] = useState("");

  // Modals
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Fuel Form
  const [fuelForm, setFuelForm] = useState({
    vehicle_id: "",
    fuel_litres: "",
    price_per_litre: "",
    odometer_reading: "",
    refill_date: new Date().toISOString().split("T")[0],
    bill_number: "",
  });

  // Expense Form
  const [expenseForm, setExpenseForm] = useState({
    vehicle_id: "",
    expense_type: "Tolls",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    reference_number: "",
    description: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [fuelData, expenseData, vData] = await Promise.all([
        apiFetch(`/fuel?search=${search}`),
        apiFetch(`/expenses?search=${search}`),
        apiFetch("/vehicles"),
      ]);
      setFuelLogs(fuelData || []);
      setExpenseLogs(expenseData || []);
      setVehicles(vData?.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load financial logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search]);

  const handleAddFuel = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");

    try {
      await apiFetch("/fuel", {
        method: "POST",
        body: JSON.stringify({
          ...fuelForm,
          fuel_litres: Number(fuelForm.fuel_litres),
          price_per_litre: Number(fuelForm.price_per_litre),
          odometer_reading: Number(fuelForm.odometer_reading),
        }),
      });

      setSuccessMsg("Fuel refill logged successfully.");
      setShowFuelModal(false);
      setFuelForm({
        vehicle_id: "",
        fuel_litres: "",
        price_per_litre: "",
        odometer_reading: "",
        refill_date: new Date().toISOString().split("T")[0],
        bill_number: "",
      });
      fetchData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setFormError(err.message || "Failed to log fuel refill.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");

    try {
      await apiFetch("/expenses", {
        method: "POST",
        body: JSON.stringify({
          ...expenseForm,
          amount: Number(expenseForm.amount),
        }),
      });

      setSuccessMsg("Operational expense logged successfully.");
      setShowExpenseModal(false);
      setExpenseForm({
        vehicle_id: "",
        expense_type: "Tolls",
        amount: "",
        expense_date: new Date().toISOString().split("T")[0],
        reference_number: "",
        description: "",
      });
      fetchData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setFormError(err.message || "Failed to log expense.");
    } finally {
      setFormLoading(false);
    }
  };

  // Math calculated automatically for fuel refill modal
  const liveFuelCost = fuelForm.fuel_litres && fuelForm.price_per_litre
    ? (Number(fuelForm.fuel_litres) * Number(fuelForm.price_per_litre)).toLocaleString()
    : "0";

  const isFinancialOrAdmin = user && [UserRole.ADMIN, UserRole.FINANCIAL_ANALYST].includes(user.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Financial Ledger</h2>
          <p className="text-sm text-slate-400">Track fuel refill receipts, operational toll bills, and general expenses</p>
        </div>

        {isFinancialOrAdmin && (
          <div className="flex gap-2.5">
            {activeTab === "fuel" ? (
              <button
                onClick={() => setShowFuelModal(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Plus size={16} className="stroke-[2.5]" />
                <span>Log Fuel Refill</span>
              </button>
            ) : (
              <button
                onClick={() => setShowExpenseModal(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Plus size={16} className="stroke-[2.5]" />
                <span>Log Expense</span>
              </button>
            )}
          </div>
        )}
      </div>

      {successMsg && (
        <div className="bg-emerald-950/40 border border-emerald-900 text-emerald-200 px-4 py-3 rounded-lg text-sm font-semibold">
          {successMsg}
        </div>
      )}

      {/* Dual Tab Switcher */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => { setActiveTab("fuel"); setSearch(""); }}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "fuel"
              ? "border-emerald-500 text-emerald-400 font-bold bg-slate-900/30"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Fuel size={16} />
          <span>Fuel Refills</span>
        </button>
        <button
          onClick={() => { setActiveTab("expenses"); setSearch(""); }}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "expenses"
              ? "border-emerald-500 text-emerald-400 font-bold bg-slate-900/30"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <DollarSign size={16} />
          <span>General Expenses</span>
        </button>
      </div>

      {/* Filter panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <label className="text-xs font-semibold text-slate-400 uppercase block mb-1.5">Search Ledger Logs</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === "fuel"
                ? "Search by vehicle reg, bill number, provider..."
                : "Search by vehicle, expense type, reference number..."
            }
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Tables listing */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-mono text-sm uppercase">
            Loading ledger histories...
          </div>
        ) : activeTab === "fuel" ? (
          /* FUEL TABLE */
          fuelLogs.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              <AlertTriangle className="mx-auto text-slate-600 mb-3" size={36} />
              <p className="font-bold text-slate-400">No Fuel Records Found</p>
              <p className="text-xs text-slate-500 mt-1">Adjust search filter or register a new fuel receipt.</p>
            </div>
          ) : (
            <div className="overflow-x-auto text-sm text-slate-300">
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Vehicle Details</th>
                    <th className="px-6 py-4">Receipt Bill</th>
                    <th className="px-6 py-4">Odometer At Refill</th>
                    <th className="px-6 py-4">Quantity (Ltrs)</th>
                    <th className="px-6 py-4">Price / Ltr</th>
                    <th className="px-6 py-4">Total Cost</th>
                    <th className="px-6 py-4">Date Logged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {fuelLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-100">{log.vehicle_name}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{log.registration_number}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-300">
                        {log.bill_number}
                      </td>
                      <td className="px-6 py-4 font-mono">
                        {(log.odometer_reading ?? 0).toLocaleString()} km
                      </td>
                      <td className="px-6 py-4 font-mono">
                        {(log.fuel_litres ?? 0).toLocaleString()} L
                      </td>
                      <td className="px-6 py-4 font-mono">
                        Rs. {log.price_per_litre}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-emerald-400">
                        Rs. {(log.fuel_cost ?? 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {log.refill_date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* GENERAL EXPENSES TABLE */
          expenseLogs.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              <AlertTriangle className="mx-auto text-slate-600 mb-3" size={36} />
              <p className="font-bold text-slate-400">No Expense Records Found</p>
              <p className="text-xs text-slate-500 mt-1">Adjust search or log a new general invoice.</p>
            </div>
          ) : (
            <div className="overflow-x-auto text-sm text-slate-300">
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Vehicle Details</th>
                    <th className="px-6 py-4">Invoice / Ref No</th>
                    <th className="px-6 py-4">Expense Type</th>
                    <th className="px-6 py-4">Amount (Rs.)</th>
                    <th className="px-6 py-4">Notes Description</th>
                    <th className="px-6 py-4">Invoice Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {expenseLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-100">{log.vehicle_name}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{log.registration_number}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-300">
                        {log.reference_number}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-slate-950 text-slate-300 border border-slate-800 uppercase">
                          {log.expense_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-red-400">
                        Rs. {(log.amount ?? 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-slate-400 max-w-xs truncate italic">
                        "{log.description}"
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {log.expense_date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Log Fuel Modal */}
      {showFuelModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Fuel size={18} className="text-emerald-400" /> Log Fuel Refill Receipt
              </h3>
              <button
                onClick={() => setShowFuelModal(false)}
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

            <form onSubmit={handleAddFuel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Select Vehicle
                </label>
                <select
                  value={fuelForm.vehicle_id}
                  onChange={(e) => setFuelForm({ ...fuelForm, vehicle_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                  required
                >
                  <option value="">Select vehicle...</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_name} ({v.registration_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Quantity (Litres)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fuelForm.fuel_litres}
                    onChange={(e) => setFuelForm({ ...fuelForm, fuel_litres: e.target.value })}
                    placeholder="45"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Price per Litre (Rs.)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fuelForm.price_per_litre}
                    onChange={(e) => setFuelForm({ ...fuelForm, price_per_litre: e.target.value })}
                    placeholder="104.5"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
              </div>

              {/* Automatic total cost display indicator */}
              <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs flex justify-between font-mono">
                <span className="text-slate-500 font-bold uppercase">Computed Total Cost:</span>
                <span className="text-emerald-400 font-extrabold">Rs. {liveFuelCost}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Odometer reading (km)
                  </label>
                  <input
                    type="number"
                    value={fuelForm.odometer_reading}
                    onChange={(e) => setFuelForm({ ...fuelForm, odometer_reading: e.target.value })}
                    placeholder="15600"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Receipt Bill Number
                  </label>
                  <input
                    type="text"
                    value={fuelForm.bill_number}
                    onChange={(e) => setFuelForm({ ...fuelForm, bill_number: e.target.value })}
                    placeholder="BILL-99882"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-700 uppercase"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Refill Date
                </label>
                <input
                  type="date"
                  value={fuelForm.refill_date}
                  onChange={(e) => setFuelForm({ ...fuelForm, refill_date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowFuelModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-transparent border border-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition-colors"
                >
                  {formLoading ? "Recording Receipt..." : "Record Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-400" /> Log Operational Expense
              </h3>
              <button
                onClick={() => setShowExpenseModal(false)}
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

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Select Vehicle
                </label>
                <select
                  value={expenseForm.vehicle_id}
                  onChange={(e) => setExpenseForm({ ...expenseForm, vehicle_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                  required
                >
                  <option value="">Select vehicle...</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_name} ({v.registration_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Expense Category
                  </label>
                  <select
                    value={expenseForm.expense_type}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expense_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="Tolls">Tolls</option>
                    <option value="Parking">Parking</option>
                    <option value="Permits">Permits</option>
                    <option value="Driver Allowances">Driver Allowances</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Amount (Rs.)
                  </label>
                  <input
                    type="number"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    placeholder="450"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Reference / Invoice No
                  </label>
                  <input
                    type="text"
                    value={expenseForm.reference_number}
                    onChange={(e) => setExpenseForm({ ...expenseForm, reference_number: e.target.value })}
                    placeholder="INV-1122"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-700 uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    value={expenseForm.expense_date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Expense Description
                </label>
                <textarea
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="National highway toll receipts, state permits fees..."
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 h-16 resize-none"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-transparent border border-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition-colors"
                >
                  {formLoading ? "Recording Invoice..." : "Record Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
