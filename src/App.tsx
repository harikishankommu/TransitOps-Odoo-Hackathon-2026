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
import { DriversPage } from "./pages/DriversPage.js";
import { FuelExpensesPage } from "./pages/FuelExpensesPage.js";
import { LoginPage } from "./pages/LoginPage.js";
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
> = ({
  onReturnToDashboard,
}) => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="max-w-md w-full border border-red-500/20 bg-red-950/10 p-8 rounded-sm text-center">
      <div className="text-red-400 text-xs font-mono uppercase tracking-[0.2em] mb-3">
        Access Restricted
      </div>

      <h2 className="text-2xl font-bold text-white mb-3">
        You cannot access this module
      </h2>

      <p className="text-sm text-white/50 leading-6 mb-6">
        Your current TransitOps role does not
        include permission to open this page.
      </p>

      <button
        type="button"
        onClick={onReturnToDashboard}
        className="px-5 py-2.5 bg-white text-black text-xs font-bold uppercase tracking-wider rounded-sm"
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

  const [
    notificationsCount,
    setNotificationsCount,
  ] = useState(0);

  const [
    selectedVehicleId,
    setSelectedVehicleId,
  ] = useState<string | null>(null);

  const [
    selectedTripId,
    setSelectedTripId,
  ] = useState<string | null>(null);

  const syncBadgeCount =
    useCallback(async () => {
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
          Number.isFinite(data.count)
            ? data.count
            : 0,
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

    const intervalId = window.setInterval(
      () => {
        void syncBadgeCount();
      },
      12_000,
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    isAuthenticated,
    syncBadgeCount,
  ]);

  useEffect(() => {
    if (
      !user ||
      canAccessTab(user.role, currentTab)
    ) {
      return;
    }

    setSelectedVehicleId(null);
    setSelectedTripId(null);
  }, [
    currentTab,
    user,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />

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
          onLoginClick={() =>
            setShowSignup(false)
          }
        />
      );
    }

    return (
      <LoginPage
        onRegisterClick={() =>
          setShowSignup(true)
        }
      />
    );
  }

  const handleTabChange = (
    tab: AppTab,
  ): void => {
    if (!canAccessTab(user.role, tab)) {
      return;
    }

    setCurrentTab(tab);
    setSelectedVehicleId(null);
    setSelectedTripId(null);
  };

  const handleViewVehicleDetails = (
    vehicleId: string,
  ): void => {
    if (
      !canAccessTab(
        user.role,
        "vehicles",
      )
    ) {
      return;
    }

    setSelectedVehicleId(vehicleId);
    setCurrentTab("vehicles");
  };

  const handleViewTripDetails = (
    tripId: string,
  ): void => {
    if (
      !canAccessTab(
        user.role,
        "trips",
      )
    ) {
      return;
    }

    setSelectedTripId(tripId);
    setCurrentTab("trips");
  };

  const renderTabContent =
    (): React.ReactNode => {
      if (
        !canAccessTab(
          user.role,
          currentTab,
        )
      ) {
        return (
          <AccessDenied
            onReturnToDashboard={() =>
              handleTabChange(
                DEFAULT_TAB,
              )
            }
          />
        );
      }

      if (currentTab === "vehicles") {
        if (selectedVehicleId) {
          return (
            <VehicleDetailsPage
              vehicleId={selectedVehicleId}
              onBack={() =>
                setSelectedVehicleId(null)
              }
            />
          );
        }

        return (
          <VehiclesPage
            onViewDetails={
              handleViewVehicleDetails
            }
          />
        );
      }

      if (currentTab === "trips") {
        if (selectedTripId) {
          return (
            <TripDetailsPage
              tripId={selectedTripId}
              onBack={() =>
                setSelectedTripId(null)
              }
            />
          );
        }

        return (
          <TripsPage
            onViewDetails={
              handleViewTripDetails
            }
          />
        );
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
      <div className="absolute top-0 right-0 w-1/3 h-full bg-[#111111] -z-10 border-l border-white/5 pointer-events-none" />

      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600/5 rounded-full blur-[120px] -z-10 pointer-events-none" />

      <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-blue-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <Sidebar
        currentTab={currentTab}
        onTabChange={handleTabChange}
        onLogout={logout}
        notificationsCount={
          notificationsCount
        }
      />

      <div className="flex-1 pl-64 flex flex-col min-h-screen z-10">
        <header className="h-16 border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
          <span className="text-[10px] text-white/40 font-mono tracking-[0.2em] uppercase font-semibold">
            {new Date().toLocaleDateString(
              [],
              {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              },
            )}
          </span>

          <div className="flex items-center gap-4 text-[10px] uppercase tracking-wider font-semibold text-white/50">
            <span>
              Terminal:{" "}
              <span className="font-mono text-blue-400 font-bold">
                Main Server
              </span>
            </span>

            <span className="text-white/10">
              |
            </span>

            <span>
              Auth Session:{" "}
              <span className="font-mono text-blue-400 font-bold">
                {user.email}
              </span>
            </span>
          </div>
        </header>

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