/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.js";
import { UserRole } from "../types.js";
import { Shield, Users, Search, AlertCircle, RefreshCw, KeyRound, Check } from "lucide-react";

export const UsersPage: React.FC = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/users");
      setAccounts(res);
    } catch (err: any) {
      setError(err.message || "Failed to load system profiles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await apiFetch(`/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      setSuccessMsg("System credentials updated successfully.");
      fetchAccounts();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      alert("Failed to modify user roles: " + err.message);
    }
  };

  const handleToggleStatus = async (userId: string, currentActive: boolean) => {
    try {
      await apiFetch(`/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !currentActive }),
      });
      setSuccessMsg("System login state toggled successfully.");
      fetchAccounts();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      alert("Failed to toggle login state: " + err.message);
    }
  };

  if (user?.role !== UserRole.ADMIN) {
    return (
      <div className="bg-[#111111] border border-red-900/40 text-red-200 p-6 rounded-sm flex gap-3 items-start">
        <AlertCircle size={24} className="text-red-400 shrink-0" />
        <div>
          <h4 className="font-bold font-sans text-sm uppercase tracking-wider">Access Blocked</h4>
          <p className="text-xs text-white/50 mt-1">This terminal is strictly restricted to Root System Administrators only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-blue-500 font-bold mb-1.5">
          Secure Access Panel
        </div>
        <h2 className="text-3xl font-light tracking-tight text-white font-sans flex items-center gap-2.5">
          <Shield className="text-blue-500" size={28} /> ADMINISTRATIVE <span className="italic font-serif font-light text-blue-500">controls</span>
        </h2>
        <p className="text-xs text-white/50 mt-1">Promote personnel, toggle login states, and audit operator authentication tokens</p>
      </div>

      {successMsg && (
        <div className="bg-[#111111] border border-blue-500/20 text-blue-400 px-4 py-3 rounded-sm text-[10px] uppercase tracking-wider font-semibold font-mono">
          {successMsg}
        </div>
      )}

      {/* Accounts table */}
      <div className="bg-[#111111]/80 border border-white/5 rounded-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-white/40 font-mono text-[10px] uppercase tracking-widest">
            Loading system profiles...
          </div>
        ) : accounts.length === 0 ? (
          <p className="p-12 text-center text-white/40 italic text-xs font-mono uppercase tracking-wider">No credentials configured.</p>
        ) : (
          <div className="overflow-x-auto text-sm text-white/80">
            <table className="w-full text-left">
              <thead className="bg-black/50 text-white/40 text-[10px] uppercase tracking-wider border-b border-white/5">
                <tr>
                  <th className="px-6 py-4 font-semibold">Account ID</th>
                  <th className="px-6 py-4 font-semibold">Full Name</th>
                  <th className="px-6 py-4 font-semibold">Email Credentials</th>
                  <th className="px-6 py-4 font-semibold">Assigned Role</th>
                  <th className="px-6 py-4 font-semibold">Active Profile</th>
                  <th className="px-6 py-4 text-right font-semibold">State Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-mono text-[10px] text-white/40 uppercase tracking-wider">
                      {acc.id}
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      {acc.full_name}
                    </td>
                    <td className="px-6 py-4 font-mono text-white/60 text-xs">
                      {acc.email}
                    </td>
                    <td className="px-6 py-4">
                      {/* Interactive role selector */}
                      <select
                        value={acc.role}
                        onChange={(e) => handleRoleChange(acc.id, e.target.value as UserRole)}
                        className="bg-black/40 border border-white/10 text-white rounded-sm text-[10px] uppercase tracking-wider px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                        disabled={acc.id === user.id} // cannot demote yourself
                      >
                        {Object.values(UserRole).map((r) => (
                          <option key={r} value={r} className="bg-[#111111] text-white">
                            {r.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      {acc.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-bold font-mono border uppercase tracking-wider bg-blue-500/10 text-blue-400 border-blue-500/20">
                          Active State
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-bold font-mono border uppercase tracking-wider bg-rose-500/10 text-rose-400 border-rose-500/20">
                          Locked State
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {acc.id === user.id ? (
                        <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest px-3">Self profile</span>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(acc.id, acc.is_active)}
                          className={`font-semibold px-3 py-1.5 rounded-sm text-[10px] uppercase tracking-widest cursor-pointer border transition-all ${
                            acc.is_active
                              ? "bg-rose-950/20 text-rose-400 border-rose-900/40 hover:bg-rose-950/40"
                              : "bg-blue-950/20 text-blue-400 border-blue-900/40 hover:bg-blue-950/40"
                          }`}
                        >
                          {acc.is_active ? "Lock Account" : "Unlock Account"}
                        </button>
                      )}
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
