import { db } from "../database.js";
import {
  Driver,
  MaintenanceStatus,
  Notification,
  NotificationType,
  TripStatus,
  UserRole,
  VehicleStatus,
} from "../../types.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const LICENCE_WARNING_DAYS = 30;
const MAINTENANCE_STALE_DAYS = 7;
const DISPATCH_STALE_HOURS = 24;
const DRAFT_OVERDUE_HOURS = 2;
const HIGH_ODOMETER_START = 100_000;
const HIGH_ODOMETER_STEP = 25_000;

function toTimestamp(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function userIdsForRoles(roles: readonly UserRole[]): string[] {
  return db.users
    .filter(
      (user) =>
        user.is_active &&
        roles.includes(user.role),
    )
    .map((user) => user.id);
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function driverRecipients(driver: Driver): string[] {
  return unique([
    driver.user_id,
    ...userIdsForRoles([
      UserRole.ADMIN,
      UserRole.DISPATCHER,
      UserRole.SAFETY_OFFICER,
    ]),
  ]);
}

function hasNotification(
  userId: string,
  title: string,
  type: NotificationType,
): boolean {
  return db.notifications.some(
    (notification) =>
      notification.user_id === userId &&
      notification.title === title &&
      notification.notification_type === type,
  );
}

function queueNotification(
  pending: Notification[],
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
): void {
  if (
    hasNotification(userId, title, type) ||
    pending.some(
      (notification) =>
        notification.user_id === userId &&
        notification.title === title &&
        notification.notification_type === type,
    )
  ) {
    return;
  }

  pending.push({
    id: db.generateId("notif"),
    user_id: userId,
    title,
    message,
    notification_type: type,
    is_read: false,
    created_at: new Date().toISOString(),
  });
}

/**
 * Generates deterministic operational alerts.
 *
 * The title includes the relevant record/date milestone so repeated syncs do
 * not generate duplicates. The function is intentionally idempotent and is
 * called from dashboard and notification reads instead of relying on a
 * background scheduler.
 */
export function syncAutomatedNotifications(): number {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const licenceLimit = new Date(
    now + LICENCE_WARNING_DAYS * DAY_IN_MS,
  )
    .toISOString()
    .slice(0, 10);
  const pending: Notification[] = [];

  for (const driver of db.drivers) {
    if (driver.licence_expiry_date < today) {
      const title =
        `Licence expired — ${driver.full_name} (${driver.licence_expiry_date})`;

      for (const userId of driverRecipients(driver)) {
        queueNotification(
          pending,
          userId,
          title,
          `Licence ${driver.licence_number} expired on ${driver.licence_expiry_date}. The driver must not be dispatched until the licence is renewed.`,
          NotificationType.LICENCE_EXPIRED,
        );
      }
    } else if (driver.licence_expiry_date <= licenceLimit) {
      const title =
        `Licence expiring — ${driver.full_name} (${driver.licence_expiry_date})`;

      for (const userId of driverRecipients(driver)) {
        queueNotification(
          pending,
          userId,
          title,
          `Licence ${driver.licence_number} expires on ${driver.licence_expiry_date}. Renew it before assigning future trips.`,
          NotificationType.LICENCE_EXPIRING,
        );
      }
    }
  }

  const maintenanceRecipients = userIdsForRoles([
    UserRole.ADMIN,
    UserRole.FLEET_MANAGER,
  ]);

  for (const log of db.maintenance_logs) {
    if (
      ![
        MaintenanceStatus.OPEN,
        MaintenanceStatus.IN_PROGRESS,
      ].includes(log.status)
    ) {
      continue;
    }

    const vehicle = db.vehicles.find(
      (candidate) => candidate.id === log.vehicle_id,
    );
    const expectedTimestamp = toTimestamp(
      log.expected_completion_date,
    );
    const startTimestamp = toTimestamp(log.start_date);

    if (
      expectedTimestamp !== null &&
      expectedTimestamp < now
    ) {
      const title =
        `Maintenance overdue — ${vehicle?.registration_number ?? log.vehicle_id} (${log.expected_completion_date})`;

      for (const userId of maintenanceRecipients) {
        queueNotification(
          pending,
          userId,
          title,
          `${vehicle?.vehicle_name ?? "Vehicle"} remains in active maintenance after the expected completion date.`,
          NotificationType.MAINTENANCE_DUE,
        );
      }
    }

    if (
      startTimestamp !== null &&
      now - startTimestamp >=
        MAINTENANCE_STALE_DAYS * DAY_IN_MS
    ) {
      const title =
        `Vehicle in workshop over ${MAINTENANCE_STALE_DAYS} days — ${vehicle?.registration_number ?? log.vehicle_id}`;

      for (const userId of maintenanceRecipients) {
        queueNotification(
          pending,
          userId,
          title,
          `${vehicle?.vehicle_name ?? "Vehicle"} entered maintenance on ${log.start_date}. Review the workshop order and expected release date.`,
          NotificationType.VEHICLE_UNAVAILABLE,
        );
      }
    }
  }

  for (const vehicle of db.vehicles) {
    if (
      vehicle.status === VehicleStatus.RETIRED ||
      vehicle.odometer < HIGH_ODOMETER_START
    ) {
      continue;
    }

    const milestone =
      Math.floor(vehicle.odometer / HIGH_ODOMETER_STEP) *
      HIGH_ODOMETER_STEP;
    const title =
      `High odometer milestone — ${vehicle.registration_number} (${milestone} km)`;

    for (const userId of maintenanceRecipients) {
      queueNotification(
        pending,
        userId,
        title,
        `${vehicle.vehicle_name} has reached ${vehicle.odometer.toLocaleString()} km. Review preventive-maintenance requirements.`,
        NotificationType.MAINTENANCE_DUE,
      );
    }
  }

  const dispatchRecipients = userIdsForRoles([
    UserRole.ADMIN,
    UserRole.DISPATCHER,
  ]);

  for (const trip of db.trips) {
    if (trip.status === TripStatus.DRAFT) {
      const plannedTimestamp = toTimestamp(
        trip.planned_start_time,
      );

      if (
        plannedTimestamp !== null &&
        now - plannedTimestamp >=
          DRAFT_OVERDUE_HOURS * 60 * 60 * 1000
      ) {
        const title =
          `Draft trip overdue — ${trip.trip_code}`;

        for (const userId of dispatchRecipients) {
          queueNotification(
            pending,
            userId,
            title,
            `${trip.trip_code} was planned for ${new Date(trip.planned_start_time).toLocaleString()} but is still in DRAFT status.`,
            NotificationType.SYSTEM,
          );
        }
      }
    }

    if (trip.status === TripStatus.DISPATCHED) {
      const startTimestamp = toTimestamp(
        trip.actual_start_time,
      );

      if (
        startTimestamp !== null &&
        now - startTimestamp >=
          DISPATCH_STALE_HOURS * 60 * 60 * 1000
      ) {
        const title =
          `Long-running trip — ${trip.trip_code}`;

        for (const userId of dispatchRecipients) {
          queueNotification(
            pending,
            userId,
            title,
            `${trip.trip_code} has remained DISPATCHED for more than ${DISPATCH_STALE_HOURS} hours. Confirm its operational status.`,
            NotificationType.SYSTEM,
          );
        }
      }
    }
  }

  if (pending.length > 0) {
    db.notifications.unshift(...pending);
    db.save();
  }

  return pending.length;
}
