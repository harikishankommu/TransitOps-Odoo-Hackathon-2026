/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.js";
import { Truck, ShieldCheck, HelpCircle } from "lucide-react";

interface LoginPageProps {
  onRegisterClick: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onRegisterClick }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all credentials.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Failed to log in.");
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { role: "Dispatcher", email: "dispatcher@transitops.com", pass: "Dispatch@123", color: "bg-blue-600/10 text-blue-400 border-blue-900/40" },
    { role: "Fleet Manager", email: "fleet@transitops.com", pass: "Fleet@123", color: "bg-amber-600/10 text-amber-400 border-amber-900/40" },
    { role: "Driver", email: "driver@transitops.com", pass: "Driver@123", color: "bg-emerald-600/10 text-emerald-400 border-emerald-900/40" },
    { role: "Safety Officer", email: "safety@transitops.com", pass: "Safety@123", color: "bg-rose-600/10 text-rose-400 border-rose-900/40" },
    { role: "Financial Analyst", email: "finance@transitops.com", pass: "Finance@123", color: "bg-indigo-600/10 text-indigo-400 border-indigo-900/40" },
    { role: "Admin", email: "admin@transitops.com", pass: "Admin@123", color: "bg-purple-600/10 text-purple-400 border-purple-900/40" }
  ];

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Graphic Elements */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-[#111111] -z-10 border-l border-white/5 pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
      <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-blue-500/5 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center z-10">
        {/* Left pane: Branding and system message */}
        <div className="text-white space-y-6 max-w-md mx-auto md:mx-0">
          <div className="flex items-center gap-3.5">
            <div className="bg-blue-600 text-white p-3 rounded-sm shadow-lg shadow-blue-500/10">
              <Truck size={30} className="stroke-[2]" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-blue-500 font-bold mb-0.5">
                TransitOps Engine
              </div>
              <h1 className="text-3xl font-light tracking-tight font-sans text-white">
                SMART <span className="italic font-serif font-light text-blue-500">operations</span> CONTROL
              </h1>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-normal text-white/80 tracking-wide">
              Centralized Fleet, Dispatch, and Operational Excellence
            </h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Enforce commercial transport workflows. Match capacities, manage drivers, track oil cycles, calculate fuel cost logs, and access secure role-based metrics under one smart platform.
            </p>
          </div>

          {/* Quick Demo Login Cheatsheet */}
          <div className="bg-[#111111]/90 border border-white/5 rounded-sm p-6 space-y-3.5">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 flex items-center gap-2">
              <ShieldCheck size={14} /> Quick Demo Login Selector
            </h3>
            <p className="text-[11px] text-white/40 uppercase tracking-wider font-mono">
              Select an automated session profile:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuickLogin(acc.email, acc.pass)}
                  className={`px-3 py-2 text-left border border-white/5 rounded-sm transition-all text-[10px] font-bold uppercase tracking-wider hover:border-blue-500/30 hover:bg-white/[0.02] truncate cursor-pointer ${acc.color}`}
                >
                  {acc.role}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right pane: Login form */}
        <div className="bg-[#111111]/80 border border-white/5 rounded-sm p-8 shadow-xl max-w-md w-full mx-auto">
          <div className="space-y-2 mb-6 border-b border-white/5 pb-4">
            <h3 className="text-2xl font-light text-white font-sans">
              SIGN <span className="italic font-serif font-light text-blue-500">in</span>
            </h3>
            <p className="text-xs text-white/40 uppercase tracking-widest">Enter your operational credentials</p>
          </div>

          {error && (
            <div className="mb-4 bg-red-950/20 border border-red-900/40 text-red-200 p-3.5 rounded-sm text-xs font-semibold font-mono uppercase tracking-wider">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dispatcher@transitops.com"
                className="w-full bg-black/40 border border-white/10 focus:border-blue-500 rounded-sm px-4 py-3 text-xs text-white focus:outline-none transition-all placeholder-white/20"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black/40 border border-white/10 focus:border-blue-500 rounded-sm px-4 py-3 text-xs text-white focus:outline-none transition-all placeholder-white/20"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3.5 px-4 rounded-sm text-xs uppercase tracking-wider transition-all duration-200 border border-blue-500/10 shadow-lg shadow-blue-500/10 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Verifying Security Token...</span>
              ) : (
                <span>Log In Portal</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 text-center text-xs">
            <span className="text-white/40 uppercase tracking-wider font-mono text-[10px]">New driver or basic employee?</span>{" "}
            <button
              onClick={onRegisterClick}
              className="text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest bg-transparent border-0 cursor-pointer p-0 underline ml-1"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
