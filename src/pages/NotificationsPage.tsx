/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ShieldAlert,
  Trash2,
} from "lucide-react";

import {
  NotificationType,
  type Notification,
} from "../types.js";
import { apiFetch } from "../utils/api.js";

type NotificationState =
  | "ALL"
  | "UNREAD"
  | "READ";

interface NotificationListResponse {
  data: Notification[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  unread_count: number;
}

interface NotificationsPageProps {
  onNotificationsChanged?: () => void;
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function notificationTone(
  type: NotificationType,
): string {
  switch (type) {
    case NotificationType.LICENCE_EXPIRED:
      return "border-red-500/20 bg-red-500/10 text-red-300";
    case NotificationType.LICENCE_EXPIRING:
    case NotificationType.MAINTENANCE_DUE:
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    case NotificationType.TRIP_ASSIGNED:
      return "border-blue-500/20 bg-blue-500/10 text-blue-300";
    case NotificationType.TRIP_COMPLETED:
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    default:
      return "border-white/10 bg-white/5 text-white/60";
  }
}

export const NotificationsPage: React.FC<
  NotificationsPageProps
> = ({ onNotificationsChanged }) => {
  const [alerts, setAlerts] = useState<
    Notification[]
  >([]);
  const [state, setState] =
    useState<NotificationState>("ALL");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] =
    useState(1);
  const [unreadCount, setUnreadCount] =
    useState(0);

  const [loading, setLoading] =
    useState(true);
  const [actionLoading, setActionLoading] =
    useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchAlerts = useCallback(
    async (): Promise<void> => {
      try {
        setLoading(true);
        setError("");

        const query = new URLSearchParams({
          state,
          page: String(page),
          page_size: String(pageSize),
        });

        if (type) {
          query.set("type", type);
        }

        const data =
          await apiFetch<NotificationListResponse>(
            `/notifications?${query.toString()}`,
          );

        setAlerts(data.data);
        setTotal(data.total);
        setTotalPages(data.total_pages);
        setUnreadCount(data.unread_count);

        if (data.page !== page) {
          setPage(data.page);
        }

        onNotificationsChanged?.();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load notifications.",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      onNotificationsChanged,
      page,
      pageSize,
      state,
      type,
    ],
  );

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  const notifyChanged = (): void => {
    onNotificationsChanged?.();
  };

  const handleMarkRead = async (
    id: string,
  ): Promise<void> => {
    try {
      setActionLoading(id);
      setError("");

      await apiFetch(`/notifications/${id}/read`, {
        method: "PATCH",
      });

      setSuccess("Notification marked as read.");
      await fetchAlerts();
      notifyChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update notification.",
      );
    } finally {
      setActionLoading("");
    }
  };

  const handleMarkAllRead =
    async (): Promise<void> => {
      try {
        setActionLoading("read-all");
        setError("");

        await apiFetch("/notifications/read-all", {
          method: "PATCH",
        });

        setSuccess(
          "All accessible notifications were marked as read.",
        );
        setPage(1);
        await fetchAlerts();
        notifyChanged();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to mark notifications as read.",
        );
      } finally {
        setActionLoading("");
      }
    };

  const handleDelete = async (
    id: string,
  ): Promise<void> => {
    const approved = window.confirm(
      "Delete this notification permanently?",
    );

    if (!approved) {
      return;
    }

    try {
      setActionLoading(id);
      setError("");

      await apiFetch(`/notifications/${id}`, {
        method: "DELETE",
      });

      setSuccess("Notification deleted.");
      await fetchAlerts();
      notifyChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete notification.",
      );
    } finally {
      setActionLoading("");
    }
  };

  const handleClearRead =
    async (): Promise<void> => {
      const approved = window.confirm(
        "Delete all read notifications? Unread notifications will remain.",
      );

      if (!approved) {
        return;
      }

      try {
        setActionLoading("clear-read");
        setError("");

        await apiFetch("/notifications/read", {
          method: "DELETE",
        });

        setSuccess(
          "Read notifications were cleared.",
        );
        setPage(1);
        await fetchAlerts();
        notifyChanged();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to clear read notifications.",
        );
      } finally {
        setActionLoading("");
      }
    };

  const tabs = useMemo(
    () =>
      [
        {
          id: "ALL" as const,
          label: `All (${total})`,
        },
        {
          id: "UNREAD" as const,
          label: `Unread (${unreadCount})`,
        },
        {
          id: "READ" as const,
          label: "Read",
        },
      ],
    [total, unreadCount],
  );

  const setNotificationState = (
    nextState: NotificationState,
  ): void => {
    setState(nextState);
    setPage(1);
    setSuccess("");
  };

  const setNotificationType = (
    nextType: string,
  ): void => {
    setType(nextType);
    setPage(1);
    setSuccess("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-white/5 pb-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Bell
              size={23}
              className="text-blue-400"
            />
            Notifications & Alerts
          </h2>
          <p className="mt-1 text-xs text-white/45">
            Licence, maintenance, trip, and
            operational warnings generated by
            TransitOps.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() =>
                void handleMarkAllRead()
              }
              disabled={
                actionLoading === "read-all"
              }
              className="inline-flex items-center gap-2 rounded-sm border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
            >
              <CheckCheck size={14} />
              Mark All Read
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleClearRead()}
            disabled={
              actionLoading === "clear-read"
            }
            className="inline-flex items-center gap-2 rounded-sm border border-red-500/20 bg-red-500/10 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-500/15 disabled:opacity-50"
          >
            <Trash2 size={14} />
            Clear Read
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-sm border border-red-500/20 bg-red-950/20 p-4 text-red-200">
          <AlertTriangle
            size={18}
            className="mt-0.5 text-red-400"
          />
          <p className="text-xs">{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-sm border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-200">
          {success}
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 rounded-sm border border-white/5 bg-[#111111]/80 p-4 md:flex-row md:items-center">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                setNotificationState(tab.id)
              }
              className={`rounded-sm px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition ${
                state === tab.id
                  ? "bg-white text-black"
                  : "border border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <select
          value={type}
          onChange={(event) =>
            setNotificationType(
              event.target.value,
            )
          }
          className="rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
        >
          <option
            value=""
            className="bg-[#111111]"
          >
            All notification types
          </option>
          {Object.values(NotificationType).map(
            (notificationType) => (
              <option
                key={notificationType}
                value={notificationType}
                className="bg-[#111111]"
              >
                {notificationType.replaceAll(
                  "_",
                  " ",
                )}
              </option>
            ),
          )}
        </select>
      </div>

      {loading ? (
        <div className="rounded-sm border border-white/5 bg-[#111111]/80 p-14 text-center font-mono text-[10px] uppercase tracking-widest text-white/40">
          Loading notification history...
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-sm border border-white/5 bg-[#111111]/80 p-14 text-center">
          <Check
            size={34}
            className="mx-auto text-emerald-400"
          />
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-white/65">
            No notifications found
          </p>
          <p className="mt-1 text-[11px] text-white/35">
            Change the state or type filter to view
            other alerts.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <article
              key={alert.id}
              className={`flex flex-col gap-4 rounded-sm border p-4 transition sm:flex-row sm:items-start ${
                alert.is_read
                  ? "border-white/5 bg-[#111111]/50 opacity-65"
                  : "border-blue-500/15 bg-[#111111]"
              }`}
            >
              <div
                className={`mt-0.5 rounded-sm border p-2 ${notificationTone(
                  alert.notification_type,
                )}`}
              >
                <ShieldAlert size={17} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-white/80">
                        {alert.title}
                      </h3>
                      {!alert.is_read && (
                        <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
                          New
                        </span>
                      )}
                    </div>
                    <span
                      className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-wider ${notificationTone(
                        alert.notification_type,
                      )}`}
                    >
                      {alert.notification_type.replaceAll(
                        "_",
                        " ",
                      )}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-[9px] text-white/30">
                    <Clock3 size={11} />
                    {formatDateTime(
                      alert.created_at,
                    )}
                  </span>
                </div>

                <p className="mt-3 text-xs leading-6 text-white/45">
                  {alert.message}
                </p>
              </div>

              <div className="flex gap-2 self-end sm:self-center">
                {!alert.is_read && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleMarkRead(alert.id)
                    }
                    disabled={
                      actionLoading === alert.id
                    }
                    title="Mark as read"
                    className="rounded-sm border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
                  >
                    <Check size={14} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    void handleDelete(alert.id)
                  }
                  disabled={
                    actionLoading === alert.id
                  }
                  title="Delete notification"
                  className="rounded-sm border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/15 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="flex flex-col justify-between gap-3 border-t border-white/5 pt-4 text-[10px] text-white/35 sm:flex-row sm:items-center">
        <span>
          Showing {alerts.length} of {total} notifications
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.max(1, current - 1),
              )
            }
            disabled={page <= 1 || loading}
            className="rounded-sm border border-white/10 p-2 text-white/55 hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>

          <span className="font-mono">
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.min(
                  totalPages,
                  current + 1,
                ),
              )
            }
            disabled={
              page >= totalPages || loading
            }
            className="rounded-sm border border-white/10 p-2 text-white/55 hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
