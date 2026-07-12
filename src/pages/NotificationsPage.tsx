/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.js";
import { Bell, AlertTriangle, Check, Trash2, ShieldAlert } from "lucide-react";

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/notifications");
      setAlerts(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to sync notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
      setAlerts(alerts.map((al) => (al.id === id ? { ...al, is_read: true } : al)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to dismiss all operational alerts?")) return;
    try {
      await apiFetch("/notifications/clear", { method: "POST" });
      setAlerts([]);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Bell size={24} className="text-emerald-400" /> Notifications & Alerts
          </h2>
          <p className="text-sm text-slate-400">System generated safety, driver licence expiries, and vehicle service flags</p>
        </div>

        {alerts.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-red-400 hover:text-red-300 border border-red-950/60 bg-red-950/20 px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Trash2 size={14} /> Clear Dismissed
          </button>
        )}
      </div>

      {/* Roster list */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 font-mono text-sm uppercase">
            Loading notifications logs...
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center text-slate-500">
            <Check className="mx-auto text-emerald-500 mb-3" size={36} />
            <p className="font-bold text-slate-400">Roster alerts clear</p>
            <p className="text-xs text-slate-500 mt-1">All compliance licensing and asset checklists are currently compliant.</p>
          </div>
        ) : (
          alerts.map((al) => (
            <div
              key={al.id}
              className={`p-4 border rounded-xl flex items-start gap-4 transition-all ${
                al.is_read
                  ? "bg-slate-900/40 border-slate-800/60 opacity-60"
                  : "bg-slate-900 border-slate-800 shadow shadow-emerald-500/5"
              }`}
            >
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg shrink-0 mt-0.5">
                <ShieldAlert size={18} />
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-start gap-4">
                  <h4 className={`text-sm font-bold ${al.is_read ? "text-slate-400" : "text-slate-200"}`}>
                    {al.title}
                  </h4>
                  <span className="font-mono text-[10px] text-slate-500">
                    {new Date(al.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                    {new Date(al.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {al.message}
                </p>
              </div>

              {!al.is_read && (
                <button
                  onClick={() => handleMarkRead(al.id)}
                  className="bg-emerald-950/50 hover:bg-emerald-900 border border-emerald-900/40 text-emerald-400 p-1.5 rounded-lg text-xs cursor-pointer transition-colors self-center"
                  title="Mark as Read"
                >
                  <Check size={14} className="stroke-[2.5]" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
