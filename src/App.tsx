/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import { Sidebar } from "./components/Sidebar.js";

import {
  AuthProvider,
  useAuth,
} from "./context/AuthContext.js";

import { DashboardPage } from "./pages/DashboardPage.js";
import { DriverDetailsPage } from "./pages/DriverDetailsPage.js";
import { DriversPage } from "./pages/DriversPage.js";
import { FuelExpensesPage } from "./pages/FuelExpensesPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { MaintenanceDetailsPage } from "./pages/MaintenanceDetailsPage.js";
import { MaintenancePage } from "./pages/MaintenancePage.js";
import { NotificationsPage } from "./pages/NotificationsPage.js";
import { ReportsPage } from "./pages/ReportsPage.js";
import { SignupPage } from "./pages/SignupPage.js";
import { TripDetailsPage } from "./pages/TripDetailsPage.js";
import { TripsPage } from "./pages/TripsPage.js";
import { UsersPage } from "./pages/UsersPage.js";
import { VehicleDetailsPage } from "./pages/VehicleDetailsPage.js";
import { VehiclesPage } from "./pages/VehiclesPage.js";

import { apiFetch } from "./utils/api.js";

import {
  type AppTab,
  canAccessTab,
} from "./utils/permissions.js";

const DEFAULT_TAB: AppTab = "dashboard";

interface NotificationCountResponse {
  count: number;
}

interface AccessDeniedProps {
  onReturnToDashboard: () => void;
}

const AccessDenied: React.FC<
  AccessDeniedProps
> = ({ onReturnToDashboard }) => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="w-full max-w-md rounded-sm border border-red-500/20 bg-red-950/10 p-8 text-center">
      <div className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-red-400">
        Access Restricted
      </div>

      <h2 className="mb-3 text-2xl font-bold text-white">
        You cannot access this module
      </h2>

      <p className="mb-6 text-sm leading-6 text-white/50">
        Your current TransitOps role does not include
        permission to open this page.
      </p>

      <button
        type="button"
        onClick={onReturnToDashboard}
        className="rounded-sm bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-black"
      >
        Return to Dashboard
      </button>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const {
    isAuthenticated,
    loading,
    logout,
    user,
  } = useAuth();

  const [currentTab, setCurrentTab] =
    useState<AppTab>(DEFAULT_TAB);
  const [showSignup, setShowSignup] =
    useState(false);
  const [notificationsCount, setNotificationsCount] =
    useState(0);

  const [selectedVehicleId, setSelectedVehicleId] =
    useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] =
    useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] =
    useState<string | null>(null);
  const [selectedMaintenanceId, setSelectedMaintenanceId] =
    useState<string | null>(null);

  const syncBadgeCount = useCallback(async () => {
    if (!isAuthenticated) {
      setNotificationsCount(0);
      return;
    }

    try {
      const data =
        await apiFetch<NotificationCountResponse>(
          "/notifications/count",
        );

      setNotificationsCount(
        Number.isFinite(data.count) ? data.count : 0,
      );
    } catch {
      setNotificationsCount(0);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void syncBadgeCount();

    const intervalId = window.setInterval(() => {
      void syncBadgeCount();
    }, 12_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, syncBadgeCount]);

  useEffect(() => {
    if (!user || canAccessTab(user.role, currentTab)) {
      return;
    }

    setSelectedVehicleId(null);
    setSelectedDriverId(null);
    setSelectedTripId(null);
    setSelectedMaintenanceId(null);
  }, [currentTab, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center space-y-4 bg-slate-950 text-slate-400">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <p className="font-mono text-xs uppercase tracking-wider">
          Verifying Session State...
        </p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    if (showSignup) {
      return (
        <SignupPage
          onLoginClick={() => setShowSignup(false)}
        />
      );
    }

    return (
      <LoginPage
        onRegisterClick={() => setShowSignup(true)}
      />
    );
  }

  const resetDetailViews = (): void => {
    setSelectedVehicleId(null);
    setSelectedDriverId(null);
    setSelectedTripId(null);
    setSelectedMaintenanceId(null);
  };

  const handleTabChange = (tab: AppTab): void => {
    if (!canAccessTab(user.role, tab)) {
      return;
    }

    setCurrentTab(tab);
    resetDetailViews();
  };

  const handleViewVehicleDetails = (
    vehicleId: string,
  ): void => {
    if (!canAccessTab(user.role, "vehicles")) {
      return;
    }

    setSelectedVehicleId(vehicleId);
    setSelectedDriverId(null);
    setSelectedTripId(null);
    setSelectedMaintenanceId(null);
    setCurrentTab("vehicles");
  };

  const handleViewDriverDetails = (
    driverId: string,
  ): void => {
    if (!canAccessTab(user.role, "drivers")) {
      return;
    }

    setSelectedDriverId(driverId);
    setSelectedVehicleId(null);
    setSelectedTripId(null);
    setSelectedMaintenanceId(null);
    setCurrentTab("drivers");
  };

  const handleViewTripDetails = (
    tripId: string,
  ): void => {
    if (!canAccessTab(user.role, "trips")) {
      return;
    }

    setSelectedTripId(tripId);
    setSelectedVehicleId(null);
    setSelectedDriverId(null);
    setSelectedMaintenanceId(null);
    setCurrentTab("trips");
  };

  const handleViewMaintenanceDetails = (
    maintenanceId: string,
  ): void => {
    if (!canAccessTab(user.role, "maintenance")) {
      return;
    }

    setSelectedMaintenanceId(maintenanceId);
    setSelectedVehicleId(null);
    setSelectedDriverId(null);
    setSelectedTripId(null);
    setCurrentTab("maintenance");
  };

  const renderTabContent = (): React.ReactNode => {
    if (!canAccessTab(user.role, currentTab)) {
      return (
        <AccessDenied
          onReturnToDashboard={() =>
            handleTabChange(DEFAULT_TAB)
          }
        />
      );
    }

    if (currentTab === "vehicles") {
      if (selectedVehicleId) {
        return (
          <VehicleDetailsPage
            vehicleId={selectedVehicleId}
            onBack={() => setSelectedVehicleId(null)}
          />
        );
      }

      return (
        <VehiclesPage
          onViewDetails={handleViewVehicleDetails}
        />
      );
    }

    if (currentTab === "drivers") {
      if (selectedDriverId) {
        return (
          <DriverDetailsPage
            driverId={selectedDriverId}
            onBack={() => setSelectedDriverId(null)}
          />
        );
      }

      return (
        <DriversPage
          onViewDetails={handleViewDriverDetails}
        />
      );
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

      return (
        <TripsPage
          onViewDetails={handleViewTripDetails}
        />
      );
    }

    if (currentTab === "maintenance") {
      if (selectedMaintenanceId) {
        return (
          <MaintenanceDetailsPage
            maintenanceId={selectedMaintenanceId}
            onBack={() =>
              setSelectedMaintenanceId(null)
            }
          />
        );
      }

      return (
        <MaintenancePage
          onViewDetails={
            handleViewMaintenanceDetails
          }
        />
      );
    }

    switch (currentTab) {
      case "dashboard":
        return <DashboardPage />;
      case "fuel-expenses":
        return <FuelExpensesPage />;
      case "reports":
        return <ReportsPage />;
      case "users":
        return <UsersPage />;
      case "notifications":
        return (
          <NotificationsPage
            onNotificationsChanged={syncBadgeCount}
          />
        );
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#0A0A0A] font-sans text-white">
      <div className="pointer-events-none absolute right-0 top-0 -z-10 h-full w-1/3 border-l border-white/5 bg-[#111111]" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 -z-10 h-96 w-96 rounded-full bg-blue-600/5 blur-[120px]" />
      <div className="pointer-events-none absolute left-1/3 top-1/4 -z-10 h-72 w-72 rounded-full bg-blue-500/5 blur-[100px]" />

      <Sidebar
        currentTab={currentTab}
        onTabChange={handleTabChange}
        onLogout={logout}
        notificationsCount={notificationsCount}
      />

      <div className="z-10 flex min-h-screen flex-1 flex-col pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/5 bg-[#0A0A0A]/80 px-8 backdrop-blur-md">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
            {new Date().toLocaleDateString([], {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>

          <div className="flex items-center gap-4 text-[10px] font-semibold uppercase tracking-wider text-white/50">
            <span>
              Terminal:{" "}
              <span className="font-mono font-bold text-blue-400">
                Main Server
              </span>
            </span>
            <span className="text-white/10">|</span>
            <span>
              Auth Session:{" "}
              <span className="font-mono font-bold text-blue-400">
                {user.email}
              </span>
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-8 pb-16">
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
