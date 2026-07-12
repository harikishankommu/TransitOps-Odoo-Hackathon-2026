import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

import {
  DATABASE_SCHEMA_VERSION,
  User,
  UserRole,
  Vehicle,
  VehicleStatus,
  VehicleType,
  FuelType,
  Driver,
  DriverStatus,
  Trip,
  TripStatus,
  MaintenanceLog,
  MaintenanceStatus,
  MaintenanceType,
  FuelLog,
  Expense,
  ExpenseType,
  ActivityLog,
  Notification,
  NotificationType,
  DatabaseValidationIssue,
  DatabaseValidationResult,
} from "../types.js";

const DEFAULT_DB_FILE_PATH = path.join(
  process.cwd(),
  "src",
  "server",
  "db.json",
);

const DB_FILE_PATH = process.env.DB_FILE_PATH
  ? path.resolve(process.cwd(), process.env.DB_FILE_PATH)
  : DEFAULT_DB_FILE_PATH;

const DB_TEMP_FILE_PATH = `${DB_FILE_PATH}.tmp`;

export interface DatabaseSchema {
  schema_version: number;
  users: User[];
  vehicles: Vehicle[];
  drivers: Driver[];
  trips: Trip[];
  maintenance_logs: MaintenanceLog[];
  fuel_logs: FuelLog[];
  expenses: Expense[];
  activity_logs: ActivityLog[];
  notifications: Notification[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class DatabaseManager {
  private data: DatabaseSchema = this.createEmptyDatabase();

  constructor() {
    this.init();
  }

  private createEmptyDatabase(): DatabaseSchema {
    return {
      schema_version: DATABASE_SCHEMA_VERSION,
      users: [],
      vehicles: [],
      drivers: [],
      trips: [],
      maintenance_logs: [],
      fuel_logs: [],
      expenses: [],
      activity_logs: [],
      notifications: [],
    };
  }

  private normalizeDatabase(rawData: unknown): DatabaseSchema {
    const source = isRecord(rawData) ? rawData : {};

    return {
      schema_version:
        typeof source.schema_version === "number"
          ? source.schema_version
          : DATABASE_SCHEMA_VERSION,

      users: Array.isArray(source.users) ? (source.users as User[]) : [],

      vehicles: Array.isArray(source.vehicles)
        ? (source.vehicles as Vehicle[])
        : [],

      drivers: Array.isArray(source.drivers)
        ? (source.drivers as Driver[])
        : [],

      trips: Array.isArray(source.trips) ? (source.trips as Trip[]) : [],

      maintenance_logs: Array.isArray(source.maintenance_logs)
        ? (source.maintenance_logs as MaintenanceLog[])
        : [],

      fuel_logs: Array.isArray(source.fuel_logs)
        ? (source.fuel_logs as FuelLog[])
        : [],

      expenses: Array.isArray(source.expenses)
        ? (source.expenses as Expense[])
        : [],

      activity_logs: Array.isArray(source.activity_logs)
        ? (source.activity_logs as ActivityLog[])
        : [],

      notifications: Array.isArray(source.notifications)
        ? (source.notifications as Notification[])
        : [],
    };
  }

  private requiresMigration(rawData: unknown): boolean {
    if (!isRecord(rawData)) {
      return true;
    }

    const collections = [
      "users",
      "vehicles",
      "drivers",
      "trips",
      "maintenance_logs",
      "fuel_logs",
      "expenses",
      "activity_logs",
      "notifications",
    ];

    return (
      rawData.schema_version !== DATABASE_SCHEMA_VERSION ||
      collections.some((collection) => !Array.isArray(rawData[collection]))
    );
  }

  private backupCorruptedDatabase(): void {
    if (!fs.existsSync(DB_FILE_PATH)) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    const backupPath = DB_FILE_PATH.replace(
      /\.json$/i,
      `.corrupt-${timestamp}.json`,
    );

    try {
      fs.copyFileSync(DB_FILE_PATH, backupPath);

      console.warn("Corrupted database backup created at:", backupPath);
    } catch (error) {
      console.error("Failed to create corrupted database backup:", error);
    }
  }

  private init(): void {
    const databaseDirectory = path.dirname(DB_FILE_PATH);

    fs.mkdirSync(databaseDirectory, {
      recursive: true,
    });

    if (!fs.existsSync(DB_FILE_PATH)) {
      this.seed();
      return;
    }

    try {
      const rawText = fs.readFileSync(DB_FILE_PATH, "utf-8");

      if (!rawText.trim()) {
        throw new Error("Database file is empty.");
      }

      const parsedData: unknown = JSON.parse(rawText);

      this.data = this.normalizeDatabase(parsedData);

      if (this.requiresMigration(parsedData)) {
        this.data.schema_version = DATABASE_SCHEMA_VERSION;

        this.save();

        console.log(
          `Database migrated to schema version ${DATABASE_SCHEMA_VERSION}.`,
        );
      }

      console.log("Database loaded successfully from", DB_FILE_PATH);
      this.reportIntegrity();
    } catch (error) {
      console.error(
        "Database could not be loaded. A fresh database will be seeded.",
        error,
      );

      this.backupCorruptedDatabase();
      this.data = this.createEmptyDatabase();
      this.seed();
    }
  }

  public save(): void {
    this.data.schema_version = DATABASE_SCHEMA_VERSION;

    const serializedData = JSON.stringify(this.data, null, 2);

    try {
      fs.writeFileSync(DB_TEMP_FILE_PATH, serializedData, "utf-8");

      try {
        fs.renameSync(DB_TEMP_FILE_PATH, DB_FILE_PATH);
      } catch (renameError) {
        const errorCode = (renameError as NodeJS.ErrnoException).code;

        // Windows may refuse to replace an existing file directly.
        if (errorCode === "EEXIST" || errorCode === "EPERM") {
          fs.rmSync(DB_FILE_PATH, {
            force: true,
          });

          fs.renameSync(DB_TEMP_FILE_PATH, DB_FILE_PATH);
        } else {
          throw renameError;
        }
      }
    } catch (error) {
      try {
        fs.rmSync(DB_TEMP_FILE_PATH, {
          force: true,
        });
      } catch {
        // Ignore temporary-file cleanup errors.
      }

      console.error("Failed to save TransitOps database:", error);

      throw new Error("The database could not be saved.", {
        cause: error,
      });
    }
  }

  public generateId(prefix: string): string {
    const normalizedPrefix = prefix
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    const uniquePart = randomUUID().replaceAll("-", "").slice(0, 16);

    return `${normalizedPrefix || "record"}_${uniquePart}`;
  }

  public get databasePath(): string {
    return DB_FILE_PATH;
  }

  public get schemaVersion(): number {
    return this.data.schema_version;
  }

  public get users(): User[] {
    return this.data.users;
  }

  public get vehicles(): Vehicle[] {
    return this.data.vehicles;
  }

  public get drivers(): Driver[] {
    return this.data.drivers;
  }

  public get trips(): Trip[] {
    return this.data.trips;
  }

  public get maintenance_logs(): MaintenanceLog[] {
    return this.data.maintenance_logs;
  }

  public get fuel_logs(): FuelLog[] {
    return this.data.fuel_logs;
  }

  public get expenses(): Expense[] {
    return this.data.expenses;
  }

  public get activity_logs(): ActivityLog[] {
    return this.data.activity_logs;
  }

  public get notifications(): Notification[] {
    return this.data.notifications;
  }

  public logActivity(
    userId: string,
    userName: string,
    action: string,
    entityType: string,
    entityId: string,
    oldValue?: string,
    newValue?: string,
  ): ActivityLog {
    const log: ActivityLog = {
      id: this.generateId("act"),
      user_id: userId,
      user_name: userName,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_value: oldValue,
      new_value: newValue,
      created_at: new Date().toISOString(),
    };

    this.data.activity_logs.unshift(log);
    this.save();

    return log;
  }

  public notify(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
  ): Notification {
    const notification: Notification = {
      id: this.generateId("notif"),
      user_id: userId,
      title,
      message,
      notification_type: type,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    this.data.notifications.unshift(notification);
    this.save();

    return notification;
  }

    private addDuplicateIssues<T extends { id: string }>(
    issues: DatabaseValidationIssue[],
    collection: string,
    records: T[],
    fieldName: string,
    getValue: (record: T) => string | undefined,
  ): void {
    const seen = new Map<string, string>();

    for (const record of records) {
      const rawValue = getValue(record);

      if (!rawValue?.trim()) {
        continue;
      }

      const normalizedValue = rawValue
        .trim()
        .toLowerCase();

      const existingRecordId = seen.get(normalizedValue);

      if (existingRecordId) {
        issues.push({
          collection,
          record_id: record.id,
          message:
            `Duplicate ${fieldName} "${rawValue}" also exists on record ${existingRecordId}.`,
        });
      } else {
        seen.set(normalizedValue, record.id);
      }
    }
  }

  private isValidDate(value: string | undefined): boolean {
    return (
      typeof value === "string" &&
      value.trim().length > 0 &&
      !Number.isNaN(Date.parse(value))
    );
  }

  private isNonNegativeNumber(value: number): boolean {
    return Number.isFinite(value) && value >= 0;
  }

  public validateIntegrity(): DatabaseValidationResult {
    const issues: DatabaseValidationIssue[] = [];

    const collections: Array<{
      name: string;
      records: Array<{ id: string }>;
    }> = [
      {
        name: "users",
        records: this.data.users,
      },
      {
        name: "vehicles",
        records: this.data.vehicles,
      },
      {
        name: "drivers",
        records: this.data.drivers,
      },
      {
        name: "trips",
        records: this.data.trips,
      },
      {
        name: "maintenance_logs",
        records: this.data.maintenance_logs,
      },
      {
        name: "fuel_logs",
        records: this.data.fuel_logs,
      },
      {
        name: "expenses",
        records: this.data.expenses,
      },
      {
        name: "activity_logs",
        records: this.data.activity_logs,
      },
      {
        name: "notifications",
        records: this.data.notifications,
      },
    ];

    // Validate IDs inside each collection.
    for (const collection of collections) {
      this.addDuplicateIssues(
        issues,
        collection.name,
        collection.records,
        "ID",
        (record) => record.id,
      );

      for (const record of collection.records) {
        if (!record.id?.trim()) {
          issues.push({
            collection: collection.name,
            message: "A record is missing its ID.",
          });
        }
      }
    }

    // Validate domain-specific unique fields.
    this.addDuplicateIssues(
      issues,
      "users",
      this.data.users,
      "email",
      (user) => user.email,
    );

    this.addDuplicateIssues(
      issues,
      "vehicles",
      this.data.vehicles,
      "registration number",
      (vehicle) => vehicle.registration_number,
    );

    this.addDuplicateIssues(
      issues,
      "drivers",
      this.data.drivers,
      "licence number",
      (driver) => driver.licence_number,
    );

    this.addDuplicateIssues(
      issues,
      "trips",
      this.data.trips,
      "trip code",
      (trip) => trip.trip_code,
    );

    const userIds = new Set(
      this.data.users.map((user) => user.id),
    );

    const vehicleIds = new Set(
      this.data.vehicles.map((vehicle) => vehicle.id),
    );

    const driverIds = new Set(
      this.data.drivers.map((driver) => driver.id),
    );

    const tripIds = new Set(
      this.data.trips.map((trip) => trip.id),
    );

    // User validation.
    for (const user of this.data.users) {
      if (!user.full_name.trim()) {
        issues.push({
          collection: "users",
          record_id: user.id,
          message: "User full name is required.",
        });
      }

      if (!user.email.includes("@")) {
        issues.push({
          collection: "users",
          record_id: user.id,
          message: "User email is invalid.",
        });
      }

      if (!user.password_hash.trim()) {
        issues.push({
          collection: "users",
          record_id: user.id,
          message: "User password hash is missing.",
        });
      }
    }

    // Vehicle validation.
    for (const vehicle of this.data.vehicles) {
      if (!vehicle.registration_number.trim()) {
        issues.push({
          collection: "vehicles",
          record_id: vehicle.id,
          message: "Registration number is required.",
        });
      }

      if (
        !Number.isFinite(vehicle.maximum_load_capacity) ||
        vehicle.maximum_load_capacity <= 0
      ) {
        issues.push({
          collection: "vehicles",
          record_id: vehicle.id,
          message:
            "Maximum load capacity must be greater than zero.",
        });
      }

      if (!this.isNonNegativeNumber(vehicle.odometer)) {
        issues.push({
          collection: "vehicles",
          record_id: vehicle.id,
          message: "Vehicle odometer cannot be negative.",
        });
      }

      if (
        !this.isNonNegativeNumber(vehicle.acquisition_cost)
      ) {
        issues.push({
          collection: "vehicles",
          record_id: vehicle.id,
          message:
            "Vehicle acquisition cost cannot be negative.",
        });
      }
    }

    // Driver validation.
    for (const driver of this.data.drivers) {
      if (
        driver.user_id &&
        !userIds.has(driver.user_id)
      ) {
        issues.push({
          collection: "drivers",
          record_id: driver.id,
          message:
            `Driver references missing user ${driver.user_id}.`,
        });
      }

      if (
        !this.isValidDate(
          driver.licence_expiry_date,
        )
      ) {
        issues.push({
          collection: "drivers",
          record_id: driver.id,
          message:
            "Driver licence expiry date is invalid.",
        });
      }

      if (
        !Number.isFinite(driver.safety_score) ||
        driver.safety_score < 0 ||
        driver.safety_score > 100
      ) {
        issues.push({
          collection: "drivers",
          record_id: driver.id,
          message:
            "Driver safety score must be between 0 and 100.",
        });
      }
    }

    // Trip validation.
    for (const trip of this.data.trips) {
      if (!vehicleIds.has(trip.vehicle_id)) {
        issues.push({
          collection: "trips",
          record_id: trip.id,
          message:
            `Trip references missing vehicle ${trip.vehicle_id}.`,
        });
      }

      if (!driverIds.has(trip.driver_id)) {
        issues.push({
          collection: "trips",
          record_id: trip.id,
          message:
            `Trip references missing driver ${trip.driver_id}.`,
        });
      }

      if (!userIds.has(trip.created_by)) {
        issues.push({
          collection: "trips",
          record_id: trip.id,
          message:
            `Trip references missing creator ${trip.created_by}.`,
        });
      }

      if (
        !Number.isFinite(trip.cargo_weight) ||
        trip.cargo_weight <= 0
      ) {
        issues.push({
          collection: "trips",
          record_id: trip.id,
          message:
            "Trip cargo weight must be greater than zero.",
        });
      }

      if (
        !Number.isFinite(trip.planned_distance) ||
        trip.planned_distance <= 0
      ) {
        issues.push({
          collection: "trips",
          record_id: trip.id,
          message:
            "Trip planned distance must be greater than zero.",
        });
      }

      if (!this.isNonNegativeNumber(trip.revenue)) {
        issues.push({
          collection: "trips",
          record_id: trip.id,
          message: "Trip revenue cannot be negative.",
        });
      }

      if (
        !this.isValidDate(
          trip.planned_start_time,
        )
      ) {
        issues.push({
          collection: "trips",
          record_id: trip.id,
          message:
            "Trip planned start time is invalid.",
        });
      }
    }

    // Maintenance validation.
    for (const maintenance of this.data.maintenance_logs) {
      if (!vehicleIds.has(maintenance.vehicle_id)) {
        issues.push({
          collection: "maintenance_logs",
          record_id: maintenance.id,
          message:
            `Maintenance references missing vehicle ${maintenance.vehicle_id}.`,
        });
      }

      if (!userIds.has(maintenance.created_by)) {
        issues.push({
          collection: "maintenance_logs",
          record_id: maintenance.id,
          message:
            `Maintenance references missing creator ${maintenance.created_by}.`,
        });
      }

      if (
        !this.isNonNegativeNumber(
          maintenance.estimated_cost,
        )
      ) {
        issues.push({
          collection: "maintenance_logs",
          record_id: maintenance.id,
          message:
            "Estimated maintenance cost cannot be negative.",
        });
      }

      if (
        maintenance.actual_cost !== undefined &&
        !this.isNonNegativeNumber(
          maintenance.actual_cost,
        )
      ) {
        issues.push({
          collection: "maintenance_logs",
          record_id: maintenance.id,
          message:
            "Actual maintenance cost cannot be negative.",
        });
      }

      if (
        !this.isValidDate(maintenance.start_date)
      ) {
        issues.push({
          collection: "maintenance_logs",
          record_id: maintenance.id,
          message:
            "Maintenance start date is invalid.",
        });
      }
    }

    // Fuel-log validation.
    for (const fuelLog of this.data.fuel_logs) {
      if (!vehicleIds.has(fuelLog.vehicle_id)) {
        issues.push({
          collection: "fuel_logs",
          record_id: fuelLog.id,
          message:
            `Fuel log references missing vehicle ${fuelLog.vehicle_id}.`,
        });
      }

      if (
        fuelLog.trip_id &&
        !tripIds.has(fuelLog.trip_id)
      ) {
        issues.push({
          collection: "fuel_logs",
          record_id: fuelLog.id,
          message:
            `Fuel log references missing trip ${fuelLog.trip_id}.`,
        });
      }

      if (!userIds.has(fuelLog.created_by)) {
        issues.push({
          collection: "fuel_logs",
          record_id: fuelLog.id,
          message:
            `Fuel log references missing creator ${fuelLog.created_by}.`,
        });
      }

      if (
        !Number.isFinite(fuelLog.fuel_litres) ||
        fuelLog.fuel_litres <= 0
      ) {
        issues.push({
          collection: "fuel_logs",
          record_id: fuelLog.id,
          message:
            "Fuel litres must be greater than zero.",
        });
      }

      if (
        !this.isNonNegativeNumber(
          fuelLog.fuel_cost,
        )
      ) {
        issues.push({
          collection: "fuel_logs",
          record_id: fuelLog.id,
          message:
            "Fuel cost cannot be negative.",
        });
      }

      if (
        !this.isNonNegativeNumber(
          fuelLog.odometer_reading,
        )
      ) {
        issues.push({
          collection: "fuel_logs",
          record_id: fuelLog.id,
          message:
            "Fuel-log odometer cannot be negative.",
        });
      }
    }

    // Expense validation.
    for (const expense of this.data.expenses) {
      if (!expense.vehicle_id && !expense.trip_id) {
        issues.push({
          collection: "expenses",
          record_id: expense.id,
          message:
            "Expense must reference a vehicle or trip.",
        });
      }

      if (
        expense.vehicle_id &&
        !vehicleIds.has(expense.vehicle_id)
      ) {
        issues.push({
          collection: "expenses",
          record_id: expense.id,
          message:
            `Expense references missing vehicle ${expense.vehicle_id}.`,
        });
      }

      if (
        expense.trip_id &&
        !tripIds.has(expense.trip_id)
      ) {
        issues.push({
          collection: "expenses",
          record_id: expense.id,
          message:
            `Expense references missing trip ${expense.trip_id}.`,
        });
      }

      if (!userIds.has(expense.created_by)) {
        issues.push({
          collection: "expenses",
          record_id: expense.id,
          message:
            `Expense references missing creator ${expense.created_by}.`,
        });
      }

      if (
        !this.isNonNegativeNumber(expense.amount)
      ) {
        issues.push({
          collection: "expenses",
          record_id: expense.id,
          message:
            "Expense amount cannot be negative.",
        });
      }
    }

    // Notification ownership validation.
    for (const notification of this.data.notifications) {
      if (!userIds.has(notification.user_id)) {
        issues.push({
          collection: "notifications",
          record_id: notification.id,
          message:
            `Notification references missing user ${notification.user_id}.`,
        });
      }
    }

    const dispatchedTrips = this.data.trips.filter(
      (trip) => trip.status === TripStatus.DISPATCHED,
    );

    const dispatchedVehicleCounts = new Map<
      string,
      number
    >();

    const dispatchedDriverCounts = new Map<
      string,
      number
    >();

    for (const trip of dispatchedTrips) {
      dispatchedVehicleCounts.set(
        trip.vehicle_id,
        (dispatchedVehicleCounts.get(
          trip.vehicle_id,
        ) ?? 0) + 1,
      );

      dispatchedDriverCounts.set(
        trip.driver_id,
        (dispatchedDriverCounts.get(
          trip.driver_id,
        ) ?? 0) + 1,
      );

      const vehicle = this.data.vehicles.find(
        (item) => item.id === trip.vehicle_id,
      );

      const driver = this.data.drivers.find(
        (item) => item.id === trip.driver_id,
      );

      if (
        vehicle &&
        vehicle.status !== VehicleStatus.ON_TRIP
      ) {
        issues.push({
          collection: "trips",
          record_id: trip.id,
          message:
            `Dispatched trip vehicle ${vehicle.id} is not ON_TRIP.`,
        });
      }

      if (
        driver &&
        driver.status !== DriverStatus.ON_TRIP
      ) {
        issues.push({
          collection: "trips",
          record_id: trip.id,
          message:
            `Dispatched trip driver ${driver.id} is not ON_TRIP.`,
        });
      }
    }

    for (
      const [vehicleId, count]
      of dispatchedVehicleCounts
    ) {
      if (count > 1) {
        issues.push({
          collection: "trips",
          record_id: vehicleId,
          message:
            `Vehicle is assigned to ${count} dispatched trips.`,
        });
      }
    }

    for (
      const [driverId, count]
      of dispatchedDriverCounts
    ) {
      if (count > 1) {
        issues.push({
          collection: "trips",
          record_id: driverId,
          message:
            `Driver is assigned to ${count} dispatched trips.`,
        });
      }
    }

    for (const vehicle of this.data.vehicles) {
      if (vehicle.status === VehicleStatus.ON_TRIP) {
        const activeTripCount =
          dispatchedVehicleCounts.get(vehicle.id) ?? 0;

        if (activeTripCount !== 1) {
          issues.push({
            collection: "vehicles",
            record_id: vehicle.id,
            message:
              `ON_TRIP vehicle must have exactly one dispatched trip; found ${activeTripCount}.`,
          });
        }
      }
    }

    for (const driver of this.data.drivers) {
      if (driver.status === DriverStatus.ON_TRIP) {
        const activeTripCount =
          dispatchedDriverCounts.get(driver.id) ?? 0;

        if (activeTripCount !== 1) {
          issues.push({
            collection: "drivers",
            record_id: driver.id,
            message:
              `ON_TRIP driver must have exactly one dispatched trip; found ${activeTripCount}.`,
          });
        }
      }
    }

    const activeMaintenanceRecords =
      this.data.maintenance_logs.filter(
        (maintenance) =>
          maintenance.status ===
            MaintenanceStatus.OPEN ||
          maintenance.status ===
            MaintenanceStatus.IN_PROGRESS,
      );

    const activeMaintenanceCounts = new Map<
      string,
      number
    >();

    for (const maintenance of activeMaintenanceRecords) {
      activeMaintenanceCounts.set(
        maintenance.vehicle_id,
        (activeMaintenanceCounts.get(
          maintenance.vehicle_id,
        ) ?? 0) + 1,
      );

      const vehicle = this.data.vehicles.find(
        (item) =>
          item.id === maintenance.vehicle_id,
      );

      if (
        vehicle &&
        vehicle.status !== VehicleStatus.IN_SHOP
      ) {
        issues.push({
          collection: "maintenance_logs",
          record_id: maintenance.id,
          message:
            `Active maintenance vehicle ${vehicle.id} is not IN_SHOP.`,
        });
      }
    }

    for (
      const [vehicleId, count]
      of activeMaintenanceCounts
    ) {
      if (count > 1) {
        issues.push({
          collection: "maintenance_logs",
          record_id: vehicleId,
          message:
            `Vehicle has ${count} active maintenance records.`,
        });
      }
    }

    for (const vehicle of this.data.vehicles) {
      if (vehicle.status === VehicleStatus.IN_SHOP) {
        const activeMaintenanceCount =
          activeMaintenanceCounts.get(
            vehicle.id,
          ) ?? 0;

        if (activeMaintenanceCount !== 1) {
          issues.push({
            collection: "vehicles",
            record_id: vehicle.id,
            message:
              `IN_SHOP vehicle must have exactly one active maintenance record; found ${activeMaintenanceCount}.`,
          });
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  public reportIntegrity(): DatabaseValidationResult {
    const result = this.validateIntegrity();

    if (result.valid) {
      console.log(
        "Database integrity check passed.",
      );

      return result;
    }

    console.warn(
      `Database integrity check found ${result.issues.length} issue(s).`,
    );

    for (const issue of result.issues) {
      const recordReference = issue.record_id
        ? ` [${issue.record_id}]`
        : "";

      console.warn(
        `- ${issue.collection}${recordReference}: ${issue.message}`,
      );
    }

    return result;
  }

  private seed() {
    console.log("Seeding initial data for TransitOps...");
    
    const DAY_IN_MS = 24 * 60 * 60 * 1000;

    const dateFromToday = (days: number): string =>
      new Date(Date.now() + days * DAY_IN_MS)
        .toISOString()
        .slice(0, 10);

    const alexLicenceExpiry = dateFromToday(365);
    const raviLicenceExpiry = dateFromToday(540);
    const priyaLicenceExpiry = dateFromToday(270);
    const manojLicenceExpiry = dateFromToday(-30);
    const sureshLicenceExpiry = dateFromToday(180);
    // Create password hashes
    const adminHash = bcrypt.hashSync("Admin@123", 8);
    const fleetHash = bcrypt.hashSync("Fleet@123", 8);
    const dispatcherHash = bcrypt.hashSync("Dispatch@123", 8);
    const safetyHash = bcrypt.hashSync("Safety@123", 8);
    const financeHash = bcrypt.hashSync("Finance@123", 8);
    const driverHash = bcrypt.hashSync("Driver@123", 8);

    const users: User[] = [
      {
        id: "usr_admin",
        full_name: "Admin User",
        email: "admin@transitops.com",
        password_hash: adminHash,
        role: UserRole.ADMIN,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "usr_fleet",
        full_name: "Fleet Manager",
        email: "fleet@transitops.com",
        password_hash: fleetHash,
        role: UserRole.FLEET_MANAGER,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "usr_dispatcher",
        full_name: "Dispatcher User",
        email: "dispatcher@transitops.com",
        password_hash: dispatcherHash,
        role: UserRole.DISPATCHER,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "usr_safety",
        full_name: "Safety Officer",
        email: "safety@transitops.com",
        password_hash: safetyHash,
        role: UserRole.SAFETY_OFFICER,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "usr_finance",
        full_name: "Financial Analyst",
        email: "finance@transitops.com",
        password_hash: financeHash,
        role: UserRole.FINANCIAL_ANALYST,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "usr_driver",
        full_name: "Alex Kumar",
        email: "driver@transitops.com",
        password_hash: driverHash,
        role: UserRole.DRIVER,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "usr_priya",
        full_name: "Priya Sharma",
        email: "priya@transitops.com",
        password_hash: driverHash,
        role: UserRole.DRIVER,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const vehicles: Vehicle[] = [
      {
        id: "vh_van05",
        registration_number: "BR01AB1234",
        vehicle_name: "Van-05",
        model: "Tata Winger",
        vehicle_type: VehicleType.VAN,
        maximum_load_capacity: 500, // kg
        odometer: 12000,
        acquisition_cost: 800000,
        region: "Patna",
        manufacture_year: 2021,
        fuel_type: FuelType.DIESEL,
        status: VehicleStatus.AVAILABLE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "vh_truck12",
        registration_number: "BR01CD5678",
        vehicle_name: "Truck-12",
        model: "Tata 407",
        vehicle_type: VehicleType.TRUCK,
        maximum_load_capacity: 2500, // kg
        odometer: 45000,
        acquisition_cost: 1500000,
        region: "Patna",
        manufacture_year: 2019,
        fuel_type: FuelType.DIESEL,
        status: VehicleStatus.AVAILABLE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "vh_cargo07",
        registration_number: "TS09EF9012",
        vehicle_name: "Cargo-07",
        model: "Ashok Leyland Dost",
        vehicle_type: VehicleType.MINI_TRUCK,
        maximum_load_capacity: 1500, // kg
        odometer: 23000,
        acquisition_cost: 950000,
        region: "Hyderabad",
        manufacture_year: 2022,
        fuel_type: FuelType.DIESEL,
        status: VehicleStatus.ON_TRIP,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "vh_pickup03",
        registration_number: "KA01GH3456",
        vehicle_name: "Pickup-03",
        model: "Mahindra Bolero Pickup",
        vehicle_type: VehicleType.PICKUP,
        maximum_load_capacity: 1200, // kg
        odometer: 18500,
        acquisition_cost: 1100000,
        region: "Bengaluru",
        manufacture_year: 2023,
        fuel_type: FuelType.DIESEL,
        status: VehicleStatus.IN_SHOP,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "vh_truckold",
        registration_number: "BR01IJ7890",
        vehicle_name: "Truck-Old",
        model: "Eicher Pro",
        vehicle_type: VehicleType.TRUCK,
        maximum_load_capacity: 3000, // kg
        odometer: 180000,
        acquisition_cost: 1200000,
        region: "Patna",
        manufacture_year: 2014,
        fuel_type: FuelType.DIESEL,
        status: VehicleStatus.RETIRED,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const drivers: Driver[] = [
      {
        id: "dr_alex",
        user_id: "usr_driver",
        full_name: "Alex Kumar",
        licence_number: "DL-11111",
        licence_category: "Heavy Commercial",
        licence_expiry_date: alexLicenceExpiry,
        contact_number: "9876543210",
        safety_score: 92,
        region: "Patna",
        status: DriverStatus.AVAILABLE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "dr_ravi",
        full_name: "Ravi Singh",
        licence_number: "DL-22222",
        licence_category: "Heavy Commercial",
        licence_expiry_date: raviLicenceExpiry,
        contact_number: "9876543211",
        safety_score: 86,
        region: "Patna",
        status: DriverStatus.AVAILABLE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "dr_priya",
        user_id: "usr_priya",
        full_name: "Priya Sharma",
        licence_number: "DL-33333",
        licence_category: "Medium Commercial",
        licence_expiry_date: priyaLicenceExpiry,
        contact_number: "9876543212",
        safety_score: 95,
        region: "Hyderabad",
        status: DriverStatus.ON_TRIP,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "dr_manoj",
        full_name: "Manoj Verma",
        licence_number: "DL-44444",
        licence_category: "Light Motor Vehicle",
        licence_expiry_date: manojLicenceExpiry, // Expired licence
        contact_number: "9876543213",
        safety_score: 75,
        region: "Patna",
        status: DriverStatus.AVAILABLE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "dr_suresh",
        full_name: "Suresh Yadav",
        licence_number: "DL-55555",
        licence_category: "Heavy Commercial",
        licence_expiry_date: sureshLicenceExpiry,
        contact_number: "9876543214",
        safety_score: 45,
        region: "Patna",
        status: DriverStatus.SUSPENDED,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Seed Trips
    const trips: Trip[] = [
      {
        id: "tr_0001",
        trip_code: "TRIP-0001",
        source: "Patna",
        destination: "Muzaffarpur",
        vehicle_id: "vh_van05",
        driver_id: "dr_alex",
        cargo_description: "Medical Supply Kits",
        cargo_weight: 350,
        planned_distance: 85,
        actual_distance: 87,
        planned_start_time: "2026-07-01T08:00:00.000Z",
        actual_start_time: "2026-07-01T08:15:00.000Z",
        completed_at: "2026-07-01T11:30:00.000Z",
        final_odometer: 12000,
        fuel_consumed: 15,
        revenue: 8500,
        notes: "Delivered successfully. Heavy traffic near toll plaza.",
        status: TripStatus.COMPLETED,
        created_by: "usr_dispatcher",
        created_at: "2026-07-01T07:30:00.000Z",
        updated_at: "2026-07-01T11:30:00.000Z",
      },
      {
        id: "tr_0002",
        trip_code: "TRIP-0002",
        source: "Hyderabad",
        destination: "Warangal",
        vehicle_id: "vh_cargo07",
        driver_id: "dr_priya",
        cargo_description: "Electronic components",
        cargo_weight: 1200,
        planned_distance: 150,
        planned_start_time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        actual_start_time: new Date(Date.now() - 3000000).toISOString(),
        revenue: 18000,
        notes: "High value cargo. Speed limit enforced.",
        status: TripStatus.DISPATCHED,
        created_by: "usr_dispatcher",
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 3000000).toISOString(),
      },
      {
        id: "tr_0003",
        trip_code: "TRIP-0003",
        source: "Patna",
        destination: "Gaya",
        vehicle_id: "vh_truck12",
        driver_id: "dr_ravi",
        cargo_description: "Agricultural seeds",
        cargo_weight: 2000,
        planned_distance: 105,
        planned_start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        revenue: 12500,
        notes: "Scheduled distribution dispatch",
        status: TripStatus.DRAFT,
        created_by: "usr_dispatcher",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "tr_0004",
        trip_code: "TRIP-0004",
        source: "Patna",
        destination: "Ara",
        vehicle_id: "vh_van05",
        driver_id: "dr_alex",
        cargo_description: "Stationery boxes",
        cargo_weight: 480,
        planned_distance: 55,
        planned_start_time: "2026-07-05T09:00:00.000Z",
        revenue: 4000,
        notes: "Cancelled because driver was re-routed.",
        status: TripStatus.CANCELLED,
        created_by: "usr_dispatcher",
        created_at: "2026-07-05T07:00:00.000Z",
        updated_at: "2026-07-05T08:00:00.000Z",
      },
    ];

    // Seed Maintenance logs
    const maintenance_logs: MaintenanceLog[] = [
      {
        id: "ml_0001",
        vehicle_id: "vh_van05",
        maintenance_type: MaintenanceType.OIL_CHANGE,
        description: "Routine Engine Oil and Air Filter replacement.",
        service_provider: "Tata Motors Patna Center",
        start_date: "2026-06-15",
        expected_completion_date: "2026-06-15",
        completed_date: "2026-06-15",
        estimated_cost: 3500,
        actual_cost: 3800,
        odometer_at_service: 11500,
        status: MaintenanceStatus.COMPLETED,
        created_by: "usr_fleet",
        created_at: "2026-06-15T08:00:00.000Z",
        updated_at: "2026-06-15T16:00:00.000Z",
      },
      {
        id: "ml_0002",
        vehicle_id: "vh_pickup03",
        maintenance_type: MaintenanceType.BRAKE_SERVICE,
        description:
          "Brake shoe replacement and fluid flush due to soft pedal.",
        service_provider: "Mahindra Service Junction, Bengaluru",
        start_date: new Date().toISOString().split("T")[0],
        expected_completion_date: new Date(Date.now() + 86400000)
          .toISOString()
          .split("T")[0], // Tomorrow
        estimated_cost: 7500,
        odometer_at_service: 18500,
        status: MaintenanceStatus.IN_PROGRESS,
        created_by: "usr_fleet",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Seed Fuel logs
    const fuel_logs: FuelLog[] = [
      {
        id: "fl_0001",
        vehicle_id: "vh_van05",
        trip_id: "tr_0001",
        fuel_litres: 15,
        fuel_cost: 1470,
        price_per_litre: 98,
        odometer_reading: 12000,
        fuel_date: "2026-07-01",
        fuel_station: "HP Petrol Pump Patna East",
        receipt_number: "RCPT-9871",
        notes: "Topped up before trip start",
        created_by: "usr_driver",
        created_at: "2026-07-01T08:10:00.000Z",
        updated_at: "2026-07-01T08:10:00.000Z",
      },
      {
        id: "fl_0002",
        vehicle_id: "vh_cargo07",
        fuel_litres: 25,
        fuel_cost: 2450,
        price_per_litre: 98,
        odometer_reading: 22850,
        fuel_date: "2026-07-10",
        fuel_station: "Indian Oil Hyderabad Hub",
        receipt_number: "RCPT-5512",
        notes: "Regular fuel refill",
        created_by: "usr_priya",
        created_at: "2026-07-10T12:00:00.000Z",
        updated_at: "2026-07-10T12:00:00.000Z",
      },
    ];

    // Seed Expenses
    const expenses: Expense[] = [
      {
        id: "ex_0001",
        vehicle_id: "vh_van05",
        trip_id: "tr_0001",
        expense_type: ExpenseType.TOLL,
        amount: 240,
        expense_date: "2026-07-01",
        description: "Patna-Muzzafarpur NH Fastag Toll Fee",
        receipt_number: "FASTAG-88219",
        created_by: "usr_driver",
        created_at: "2026-07-01T09:15:00.000Z",
        updated_at: "2026-07-01T09:15:00.000Z",
      },
      {
        id: "ex_0002",
        vehicle_id: "vh_cargo07",
        expense_type: ExpenseType.INSURANCE,
        amount: 18000,
        expense_date: "2026-06-25",
        description:
          "Annual Commercial Vehicle Comprehensive Insurance Cover renewal",
        receipt_number: "INS-992123",
        created_by: "usr_fleet",
        created_at: "2026-06-25T11:00:00.000Z",
        updated_at: "2026-06-25T11:00:00.000Z",
      },
    ];

    // Seed Activity logs
    const activity_logs: ActivityLog[] = [
      {
        id: "act_1",
        user_id: "usr_admin",
        user_name: "Admin User",
        action: "Database initialized with seed data",
        entity_type: "SYSTEM",
        entity_id: "sys_init",
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: "act_2",
        user_id: "usr_fleet",
        user_name: "Fleet Manager",
        action: "Opened maintenance log",
        entity_type: "MAINTENANCE",
        entity_id: "ml_0002",
        old_value: "AVAILABLE",
        new_value: "IN_SHOP",
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
      {
        id: "act_3",
        user_id: "usr_dispatcher",
        user_name: "Dispatcher User",
        action: "Dispatched trip",
        entity_type: "TRIP",
        entity_id: "tr_0002",
        old_value: "DRAFT",
        new_value: "DISPATCHED",
        created_at: new Date(Date.now() - 3000000).toISOString(),
      },
    ];

    // Seed Notifications
    const notifications: Notification[] = [
      {
        id: "not_1",
        user_id: "usr_driver",
        title: "New Trip Assigned",
        message:
          "You have been assigned to trip TRIP-0001 (Patna to Muzaffarpur). Please review notes.",
        notification_type: NotificationType.TRIP_ASSIGNED,
        is_read: true,
        created_at: "2026-07-01T07:31:00.000Z",
      },
      {
        id: "not_2",
        user_id: "usr_safety",
        title: "Licence Expiry Warning",
        message:
               `Driver Manoj Verma's licence (DL-44444) expired on ${manojLicenceExpiry}.`,
        notification_type: NotificationType.LICENCE_EXPIRED,
        is_read: false,
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: "not_3",
        user_id: "usr_fleet",
        title: "Maintenance Service Required",
        message: "Vehicle Pickup-03 is currently IN_SHOP under Brake Service.",
        notification_type: NotificationType.MAINTENANCE_DUE,
        is_read: false,
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
    ];
    
    this.data.schema_version = DATABASE_SCHEMA_VERSION;
    this.data.users = users;
    this.data.vehicles = vehicles;
    this.data.drivers = drivers;
    this.data.trips = trips;
    this.data.maintenance_logs = maintenance_logs;
    this.data.fuel_logs = fuel_logs;
    this.data.expenses = expenses;
    this.data.activity_logs = activity_logs;
    this.data.notifications = notifications;

    this.save();
    this.reportIntegrity();

    console.log(
      `Database seeded successfully with ${users.length} users, ${vehicles.length} vehicles, and ${drivers.length} drivers.`,
    );
      }
    }

export const db = new DatabaseManager();
