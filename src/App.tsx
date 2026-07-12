/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { Sidebar } from "./components/Sidebar.js";
import { LoginPage } from "./pages/LoginPage.js";
import { SignupPage } from "./pages/SignupPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { VehiclesPage } from "./pages/VehiclesPage.js";
import { VehicleDetailsPage } from "./pages/VehicleDetailsPage.js";
import { DriversPage } from "./pages/DriversPage.js";
import { TripsPage } from "./pages/TripsPage.js";
import { TripDetailsPage } from "./pages/TripDetailsPage.js";
import { MaintenancePage } from "./pages/MaintenancePage.js";
import { FuelExpensesPage } from "./pages/FuelExpensesPage.js";
import { ReportsPage } from "./pages/ReportsPage.js";
import { UsersPage } from "./pages/UsersPage.js";
import { NotificationsPage } from "./pages/NotificationsPage.js";
import { apiFetch } from "./utils/api.js";

const AppContent: React.FC = () => {
  const { isAuthenticated, loading, logout, user } = useAuth();
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [showSignup, setShowSignup] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(0);

  // Drill down detailed views states
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  // Sync notification badges
  const syncBadgeCount = async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiFetch("/notifications/count");
      setNotificationsCount(data.count || 0);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      syncBadgeCount();
      const interval = setInterval(syncBadgeCount, 12000); // refresh every 12 seconds
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-mono text-xs uppercase tracking-wider">Verifying Session State...</p>
      </div>
    );
  }

  // Not Authenticated screens
  if (!isAuthenticated) {
    if (showSignup) {
      return <SignupPage onLoginClick={() => setShowSignup(false)} />;
    }
    return <LoginPage onRegisterClick={() => setShowSignup(true)} />;
  }

  // Navigation handlers
  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    // Reset drill downs
    setSelectedVehicleId(null);
    setSelectedTripId(null);
  };

  const handleViewVehicleDetails = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setCurrentTab("vehicles");
  };

  const handleViewTripDetails = (tripId: string) => {
    setSelectedTripId(tripId);
    setCurrentTab("trips");
  };

  // Render correct component block
  const renderTabContent = () => {
    if (currentTab === "vehicles") {
      if (selectedVehicleId) {
        return (
          <VehicleDetailsPage
            vehicleId={selectedVehicleId}
            onBack={() => setSelectedVehicleId(null)}
          />
        );
      }
      return <VehiclesPage onViewDetails={handleViewVehicleDetails} />;
    }

    if (currentTab === "trips") {
      if (selectedTripId) {
        return (
          <TripDetailsPage
            tripId={selectedTripId}
            onBack={() => setSelectedTripId(null)}
          />
        );
      }
      return <TripsPage onViewDetails={handleViewTripDetails} />;
    }

    switch (currentTab) {
      case "dashboard":
        return <DashboardPage />;
      case "drivers":
        return <DriversPage />;
      case "maintenance":
        return <MaintenancePage />;
      case "fuel-expenses":
        return <FuelExpensesPage />;
      case "reports":
        return <ReportsPage />;
      case "users":
        return <UsersPage />;
      case "notifications":
        return <NotificationsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex relative overflow-hidden font-sans">
      {/* Background Graphic Elements */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-[#111111] -z-10 border-l border-white/5 pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
      <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-blue-500/5 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

      {/* Dynamic left sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={handleTabChange}
        onLogout={logout}
        notificationsCount={notificationsCount}
      />

      {/* Main operational view port */}
      <div className="flex-1 pl-64 flex flex-col min-h-screen z-10">
        {/* Upper workspace navigation header */}
        <header className="h-16 border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
          <div>
            <span className="text-[10px] text-white/40 font-mono tracking-[0.2em] uppercase font-semibold">
              {new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[10px] uppercase tracking-wider font-semibold text-white/50">
            <span>Terminal: <span className="font-mono text-blue-400 font-bold">MAIN SERVER</span></span>
            <span className="text-white/10">|</span>
            <span>Auth Session: <span className="font-mono text-blue-400 font-bold">{user?.email}</span></span>
          </div>
        </header>

        {/* Content body with responsive sizing */}
        <main className="p-8 flex-1 max-w-7xl w-full mx-auto pb-16">
          {renderTabContent()}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
