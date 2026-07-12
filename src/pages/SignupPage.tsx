/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.js";
import { Truck } from "lucide-react";

interface SignupPageProps {
  onLoginClick: () => void;
}

export const SignupPage: React.FC<SignupPageProps> = ({ onLoginClick }) => {
  const { signup } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await signup({
        full_name: fullName,
        email,
        password,
        confirm_password: confirmPassword
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to register new account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl shadow-slate-950/50">
        <div className="flex flex-col items-center text-center space-y-3 mb-6">
          <div className="bg-emerald-500 text-slate-950 p-2.5 rounded-xl">
            <Truck size={28} className="stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Driver Portal Signup</h3>
            <p className="text-xs text-slate-400 mt-1">
              Create a driver / operator account. Accounts are assigned DRIVER access by default. Admins must promote accounts to manager status.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-950/40 border border-red-900 text-red-200 p-3 rounded-lg text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Kumar"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@transitops.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Password (Min 6 chars)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 px-4 rounded-lg text-sm transition-colors cursor-pointer"
          >
            {loading ? "Creating Credentials..." : "Register Driver Account"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800 text-center text-sm">
          <span className="text-slate-500">Already registered on TransitOps?</span>{" "}
          <button
            onClick={onLoginClick}
            className="text-emerald-400 hover:text-emerald-300 font-semibold underline bg-transparent border-0 cursor-pointer p-0"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
