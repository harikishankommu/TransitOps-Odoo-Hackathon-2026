import { db } from "../database.js";
import {
  Trip,
  TripStatus,
  Vehicle,
  VehicleStatus,
  Driver,
  DriverStatus,
  MaintenanceLog,
  MaintenanceStatus,
  MaintenanceType,
  Expense,
  ExpenseType,
  NotificationType,
  User
} from "../../types.js";

export class OperationsService {
  /**
   * Generates a unique trip code, for example TRIP-0005.
   */
  public static generateTripCode(): string {
    let maximum = 0;

    for (const trip of db.trips) {
      const match = /^TRIP-(\d+)$/.exec(trip.trip_code);
      if (!match) {
        continue;
      }

      const value = Number.parseInt(match[1], 10);
      if (value > maximum) {
        maximum = value;
      }
    }

    return `TRIP-${String(maximum + 1).padStart(4, "0")}`;
  }

  /**
   * Ensures a vehicle is eligible for dispatch.
   */
  public static validateVehicleForDispatch(
    vehicle: Vehicle,
    tripId: string,
  ): void {
    if (vehicle.status !== VehicleStatus.AVAILABLE) {
      const reason =
        vehicle.status === VehicleStatus.ON_TRIP
          ? "currently on a trip"
          : vehicle.status === VehicleStatus.IN_SHOP
            ? "under maintenance"
            : "retired";

      throw new Error(
        `Vehicle ${vehicle.registration_number} is ${reason}.`,
      );
    }

    const activeTrip = db.trips.find(
      (trip) =>
        trip.id !== tripId &&
        trip.vehicle_id === vehicle.id &&
        trip.status === TripStatus.DISPATCHED,
    );

    if (activeTrip) {
      throw new Error(
        `Vehicle ${vehicle.registration_number} is assigned to active trip ${activeTrip.trip_code}.`,
      );
    }
  }

  /**
   * Ensures a driver is eligible for dispatch.
   */
  public static validateDriverForDispatch(
    driver: Driver,
    tripId: string,
  ): void {
    if (driver.status !== DriverStatus.AVAILABLE) {
      const reason =
        driver.status === DriverStatus.ON_TRIP
          ? "currently assigned to another trip"
          : driver.status === DriverStatus.SUSPENDED
            ? "suspended"
            : "off duty";

      throw new Error(`Driver ${driver.full_name} is ${reason}.`);
    }

    const today = new Date().toISOString().slice(0, 10);
    if (driver.licence_expiry_date < today) {
      throw new Error(
        `Driver licence expired on ${driver.licence_expiry_date}.`,
      );
    }

    const activeTrip = db.trips.find(
      (trip) =>
        trip.id !== tripId &&
        trip.driver_id === driver.id &&
        trip.status === TripStatus.DISPATCHED,
    );

    if (activeTrip) {
      throw new Error(
        `Driver ${driver.full_name} is assigned to active trip ${activeTrip.trip_code}.`,
      );
    }
  }

  /**
   * Transitions a draft trip to DISPATCHED and locks its resources.
   */
  public static dispatchTrip(
    tripId: string,
    dispatcher: { id: string; name: string },
  ): Trip {
    const trip = db.trips.find(
      (candidate) => candidate.id === tripId,
    );

    if (!trip) {
      throw new Error("Trip not found.");
    }

    if (trip.status !== TripStatus.DRAFT) {
      throw new Error(
        `Only draft trips can be dispatched. Current status: ${trip.status}.`,
      );
    }

    const vehicle = db.vehicles.find(
      (candidate) => candidate.id === trip.vehicle_id,
    );
    const driver = db.drivers.find(
      (candidate) => candidate.id === trip.driver_id,
    );

    if (!vehicle) {
      throw new Error("Assigned vehicle not found.");
    }

    if (!driver) {
      throw new Error("Assigned driver not found.");
    }

    this.validateVehicleForDispatch(vehicle, trip.id);
    this.validateDriverForDispatch(driver, trip.id);

    if (trip.cargo_weight > vehicle.maximum_load_capacity) {
      throw new Error(
        `Cargo weight of ${trip.cargo_weight} kg exceeds vehicle capacity of ${vehicle.maximum_load_capacity} kg.`,
      );
    }

    const oldTrip = { ...trip };
    const oldVehicle = { ...vehicle };
    const oldDriver = { ...driver };
    const now = new Date().toISOString();

    trip.status = TripStatus.DISPATCHED;
    trip.actual_start_time = now;
    trip.updated_at = now;
    vehicle.status = VehicleStatus.ON_TRIP;
    vehicle.updated_at = now;
    driver.status = DriverStatus.ON_TRIP;
    driver.updated_at = now;

    try {
      db.save();
    } catch (error) {
      Object.assign(trip, oldTrip);
      Object.assign(vehicle, oldVehicle);
      Object.assign(driver, oldDriver);
      throw error;
    }

    db.logActivity(
      dispatcher.id,
      dispatcher.name,
      `Dispatched trip ${trip.trip_code}`,
      "TRIP",
      trip.id,
      oldTrip.status,
      TripStatus.DISPATCHED,
    );

    if (driver.user_id) {
      db.notify(
        driver.user_id,
        "Trip Dispatched",
        `You have been assigned to ${trip.trip_code} from ${trip.source} to ${trip.destination}.`,
        NotificationType.TRIP_ASSIGNED,
      );
    }

    return trip;
  }

  /**
   * Completes a dispatched trip and releases its vehicle and driver.
   */
  public static completeTrip(
    tripId: string,
    completionData: {
      actual_distance: number;
      final_odometer: number;
      fuel_consumed: number;
      revenue?: number;
      notes?: string;
    },
    operator: { id: string; name: string },
  ): Trip {
    const trip = db.trips.find(
      (candidate) => candidate.id === tripId,
    );

    if (!trip) {
      throw new Error("Trip not found.");
    }

    if (trip.status !== TripStatus.DISPATCHED) {
      throw new Error(
        "Only dispatched trips can be completed.",
      );
    }

    const vehicle = db.vehicles.find(
      (candidate) => candidate.id === trip.vehicle_id,
    );
    const driver = db.drivers.find(
      (candidate) => candidate.id === trip.driver_id,
    );

    if (!vehicle) {
      throw new Error("Trip vehicle not found.");
    }

    if (!driver) {
      throw new Error("Trip driver not found.");
    }

    if (vehicle.status !== VehicleStatus.ON_TRIP) {
      throw new Error(
        "The assigned vehicle is not in ON_TRIP status.",
      );
    }

    if (driver.status !== DriverStatus.ON_TRIP) {
      throw new Error(
        "The assigned driver is not in ON_TRIP status.",
      );
    }

    const {
      actual_distance: actualDistance,
      final_odometer: finalOdometer,
      fuel_consumed: fuelConsumed,
      revenue,
      notes,
    } = completionData;

    if (!Number.isFinite(actualDistance) || actualDistance <= 0) {
      throw new Error(
        "Actual distance must be greater than zero.",
      );
    }

    if (!Number.isFinite(fuelConsumed) || fuelConsumed < 0) {
      throw new Error(
        "Fuel consumed must be zero or greater.",
      );
    }

    if (!Number.isFinite(finalOdometer)) {
      throw new Error("Final odometer must be a valid number.");
    }

    if (finalOdometer < vehicle.odometer) {
      throw new Error(
        `Final odometer cannot be below the current reading of ${vehicle.odometer}.`,
      );
    }

    if (finalOdometer < vehicle.odometer + actualDistance) {
      throw new Error(
        "Final odometer must be at least the current odometer plus the actual distance.",
      );
    }

    if (
      revenue !== undefined &&
      (!Number.isFinite(revenue) || revenue < 0)
    ) {
      throw new Error("Revenue must be zero or greater.");
    }

    const oldTrip = { ...trip };
    const oldVehicle = { ...vehicle };
    const oldDriver = { ...driver };
    const now = new Date().toISOString();
    let newFuelLogId: string | null = null;

    trip.status = TripStatus.COMPLETED;
    trip.completed_at = now;
    trip.actual_distance = actualDistance;
    trip.final_odometer = finalOdometer;
    trip.fuel_consumed = fuelConsumed;
    trip.revenue = revenue ?? trip.revenue;
    if (notes !== undefined) {
      trip.notes = notes || undefined;
    }
    trip.updated_at = now;

    vehicle.odometer = finalOdometer;
    vehicle.status = VehicleStatus.AVAILABLE;
    vehicle.updated_at = now;

    driver.status = DriverStatus.AVAILABLE;
    driver.updated_at = now;

    if (fuelConsumed > 0) {
      const pricePerLitre = 98;
      newFuelLogId = db.generateId("fl");
      db.fuel_logs.unshift({
        id: newFuelLogId,
        vehicle_id: vehicle.id,
        trip_id: trip.id,
        fuel_litres: fuelConsumed,
        fuel_cost: fuelConsumed * pricePerLitre,
        price_per_litre: pricePerLitre,
        odometer_reading: finalOdometer,
        fuel_date: now.slice(0, 10),
        fuel_station: "Operational Hub Pump",
        receipt_number: `AUTO-${trip.trip_code}`,
        notes: "Automatically logged on trip completion",
        created_by: operator.id,
        created_at: now,
        updated_at: now,
      });
    }

    try {
      db.save();
    } catch (error) {
      Object.assign(trip, oldTrip);
      Object.assign(vehicle, oldVehicle);
      Object.assign(driver, oldDriver);

      if (newFuelLogId) {
        const fuelIndex = db.fuel_logs.findIndex(
          (fuelLog) => fuelLog.id === newFuelLogId,
        );
        if (fuelIndex >= 0) {
          db.fuel_logs.splice(fuelIndex, 1);
        }
      }

      throw error;
    }

    db.logActivity(
      operator.id,
      operator.name,
      `Completed trip ${trip.trip_code}`,
      "TRIP",
      trip.id,
      oldTrip.status,
      TripStatus.COMPLETED,
    );

    if (driver.user_id) {
      db.notify(
        driver.user_id,
        "Trip Completed",
        `${trip.trip_code} was completed successfully. Final odometer: ${finalOdometer}.`,
        NotificationType.TRIP_COMPLETED,
      );
    }

    return trip;
  }

  /**
   * Cancels a draft or dispatched trip and releases active resources.
   */
  public static cancelTrip(
    tripId: string,
    operator: { id: string; name: string },
  ): Trip {
    const trip = db.trips.find(
      (candidate) => candidate.id === tripId,
    );

    if (!trip) {
      throw new Error("Trip not found.");
    }

    if (
      ![
        TripStatus.DRAFT,
        TripStatus.DISPATCHED,
      ].includes(trip.status)
    ) {
      throw new Error(
        `A trip in ${trip.status} status cannot be cancelled.`,
      );
    }

    const vehicle = db.vehicles.find(
      (candidate) => candidate.id === trip.vehicle_id,
    );
    const driver = db.drivers.find(
      (candidate) => candidate.id === trip.driver_id,
    );
    const oldTrip = { ...trip };
    const oldVehicle = vehicle ? { ...vehicle } : null;
    const oldDriver = driver ? { ...driver } : null;
    const wasDispatched = trip.status === TripStatus.DISPATCHED;
    const now = new Date().toISOString();

    trip.status = TripStatus.CANCELLED;
    trip.updated_at = now;

    if (wasDispatched) {
      if (vehicle?.status === VehicleStatus.ON_TRIP) {
        vehicle.status = VehicleStatus.AVAILABLE;
        vehicle.updated_at = now;
      }

      if (driver?.status === DriverStatus.ON_TRIP) {
        driver.status = DriverStatus.AVAILABLE;
        driver.updated_at = now;
      }
    }

    try {
      db.save();
    } catch (error) {
      Object.assign(trip, oldTrip);
      if (vehicle && oldVehicle) {
        Object.assign(vehicle, oldVehicle);
      }
      if (driver && oldDriver) {
        Object.assign(driver, oldDriver);
      }
      throw error;
    }

    db.logActivity(
      operator.id,
      operator.name,
      `Cancelled trip ${trip.trip_code}`,
      "TRIP",
      trip.id,
      oldTrip.status,
      TripStatus.CANCELLED,
    );

    return trip;
  }

  private static isIsoDate(
    value: string,
  ): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const [year, month, day] = value
      .split("-")
      .map(Number);
    const date = new Date(
      Date.UTC(year, month - 1, day),
    );

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  /**
   * Starts a maintenance workflow and marks the vehicle IN_SHOP.
   */
  public static startMaintenance(
    logData: {
      vehicle_id: string;
      maintenance_type: MaintenanceType;
      description: string;
      service_provider: string;
      start_date: string;
      expected_completion_date: string;
      estimated_cost: number;
      odometer_at_service: number;
    },
    operator: { id: string; name: string },
  ): MaintenanceLog {
    const vehicle = db.vehicles.find(
      (candidate) =>
        candidate.id === logData.vehicle_id,
    );

    if (!vehicle) {
      throw new Error("Vehicle not found.");
    }

    if (vehicle.status !== VehicleStatus.AVAILABLE) {
      const reason =
        vehicle.status === VehicleStatus.ON_TRIP
          ? "currently on a trip"
          : vehicle.status === VehicleStatus.IN_SHOP
            ? "already in maintenance"
            : "retired";

      throw new Error(
        `Maintenance cannot start because the vehicle is ${reason}.`,
      );
    }

    const duplicateActiveRecord =
      db.maintenance_logs.find(
        (log) =>
          log.vehicle_id === vehicle.id &&
          [
            MaintenanceStatus.OPEN,
            MaintenanceStatus.IN_PROGRESS,
          ].includes(log.status),
      );

    if (duplicateActiveRecord) {
      throw new Error(
        "This vehicle already has an active maintenance record.",
      );
    }

    if (
      !Object.values(MaintenanceType).includes(
        logData.maintenance_type,
      )
    ) {
      throw new Error(
        "A valid maintenance type is required.",
      );
    }

    if (
      logData.description.trim().length < 3 ||
      logData.description.trim().length > 500
    ) {
      throw new Error(
        "Description must contain between 3 and 500 characters.",
      );
    }

    if (
      logData.service_provider.trim().length < 2 ||
      logData.service_provider.trim().length > 100
    ) {
      throw new Error(
        "Service provider must contain between 2 and 100 characters.",
      );
    }

    if (
      !this.isIsoDate(logData.start_date) ||
      !this.isIsoDate(
        logData.expected_completion_date,
      )
    ) {
      throw new Error(
        "Start and expected completion dates must be valid dates.",
      );
    }

    if (
      logData.expected_completion_date <
      logData.start_date
    ) {
      throw new Error(
        "Expected completion date cannot be before the start date.",
      );
    }

    if (
      !Number.isFinite(logData.estimated_cost) ||
      logData.estimated_cost < 0
    ) {
      throw new Error(
        "Estimated cost must be zero or greater.",
      );
    }

    if (
      !Number.isFinite(
        logData.odometer_at_service,
      ) ||
      logData.odometer_at_service <
        vehicle.odometer
    ) {
      throw new Error(
        `Service odometer cannot be below the current vehicle reading of ${vehicle.odometer}.`,
      );
    }

    const oldVehicle = { ...vehicle };
    const now = new Date().toISOString();
    const log: MaintenanceLog = {
      id: db.generateId("ml"),
      vehicle_id: vehicle.id,
      maintenance_type:
        logData.maintenance_type,
      description: logData.description
        .trim()
        .replace(/\s+/g, " "),
      service_provider:
        logData.service_provider
          .trim()
          .replace(/\s+/g, " "),
      start_date: logData.start_date,
      expected_completion_date:
        logData.expected_completion_date,
      estimated_cost: logData.estimated_cost,
      odometer_at_service:
        logData.odometer_at_service,
      status: MaintenanceStatus.IN_PROGRESS,
      created_by: operator.id,
      created_at: now,
      updated_at: now,
    };

    vehicle.status = VehicleStatus.IN_SHOP;
    vehicle.updated_at = now;
    db.maintenance_logs.unshift(log);

    try {
      db.save();
    } catch (error) {
      Object.assign(vehicle, oldVehicle);

      const logIndex =
        db.maintenance_logs.findIndex(
          (candidate) =>
            candidate.id === log.id,
        );

      if (logIndex >= 0) {
        db.maintenance_logs.splice(
          logIndex,
          1,
        );
      }

      throw error;
    }

    db.logActivity(
      operator.id,
      operator.name,
      `Started ${log.maintenance_type} for vehicle ${vehicle.registration_number}`,
      "MAINTENANCE",
      log.id,
      oldVehicle.status,
      VehicleStatus.IN_SHOP,
    );

    return log;
  }

  /**
   * Completes an active maintenance workflow, creates its expense,
   * and returns the vehicle to AVAILABLE.
   */
  public static completeMaintenance(
    logId: string,
    completionData: {
      actual_cost: number;
      completed_date: string;
      notes?: string;
    },
    operator: { id: string; name: string },
  ): MaintenanceLog {
    const log = db.maintenance_logs.find(
      (candidate) => candidate.id === logId,
    );

    if (!log) {
      throw new Error(
        "Maintenance record not found.",
      );
    }

    if (
      ![
        MaintenanceStatus.OPEN,
        MaintenanceStatus.IN_PROGRESS,
      ].includes(log.status)
    ) {
      throw new Error(
        `Only active maintenance can be completed. Current status: ${log.status}.`,
      );
    }

    if (
      !Number.isFinite(
        completionData.actual_cost,
      ) ||
      completionData.actual_cost < 0
    ) {
      throw new Error(
        "Actual cost must be zero or greater.",
      );
    }

    if (
      !this.isIsoDate(
        completionData.completed_date,
      )
    ) {
      throw new Error(
        "Completed date must be a valid date.",
      );
    }

    if (
      completionData.completed_date <
      log.start_date
    ) {
      throw new Error(
        "Completed date cannot be before the maintenance start date.",
      );
    }

    const vehicle = db.vehicles.find(
      (candidate) =>
        candidate.id === log.vehicle_id,
    );

    if (!vehicle) {
      throw new Error(
        "The vehicle linked to this maintenance record was not found.",
      );
    }

    if (vehicle.status !== VehicleStatus.IN_SHOP) {
      throw new Error(
        "The linked vehicle is not currently IN_SHOP.",
      );
    }

    const oldLog = { ...log };
    const oldVehicle = { ...vehicle };
    const now = new Date().toISOString();
    const notes =
      completionData.notes?.trim() ?? "";
    const receiptNumber = `MNT-${log.id.toUpperCase()}`;
    const existingExpense = db.expenses.find(
      (expense) =>
        expense.receipt_number === receiptNumber,
    );

    if (existingExpense) {
      throw new Error(
        "A maintenance expense already exists for this record.",
      );
    }

    const expense: Expense = {
      id: db.generateId("ex"),
      vehicle_id: vehicle.id,
      expense_type: ExpenseType.MAINTENANCE,
      amount: completionData.actual_cost,
      expense_date:
        completionData.completed_date,
      description: `Maintenance completed: ${log.maintenance_type} — ${log.description}`,
      receipt_number: receiptNumber,
      created_by: operator.id,
      created_at: now,
      updated_at: now,
    };

    log.status = MaintenanceStatus.COMPLETED;
    log.actual_cost =
      completionData.actual_cost;
    log.completed_date =
      completionData.completed_date;
    log.description = notes
      ? `${log.description}\n[Completion Notes] ${notes}`
      : log.description;
    log.updated_at = now;

    vehicle.status = VehicleStatus.AVAILABLE;
    vehicle.updated_at = now;
    db.expenses.unshift(expense);

    try {
      db.save();
    } catch (error) {
      Object.assign(log, oldLog);
      Object.assign(vehicle, oldVehicle);

      const expenseIndex =
        db.expenses.findIndex(
          (candidate) =>
            candidate.id === expense.id,
        );

      if (expenseIndex >= 0) {
        db.expenses.splice(
          expenseIndex,
          1,
        );
      }

      throw error;
    }

    db.logActivity(
      operator.id,
      operator.name,
      `Completed maintenance for vehicle ${vehicle.registration_number}`,
      "MAINTENANCE",
      log.id,
      oldLog.status,
      MaintenanceStatus.COMPLETED,
    );

    return log;
  }

  /**
   * Cancels active maintenance and releases the vehicle.
   */
  public static cancelMaintenance(
    logId: string,
    operator: { id: string; name: string },
  ): MaintenanceLog {
    const log = db.maintenance_logs.find(
      (candidate) => candidate.id === logId,
    );

    if (!log) {
      throw new Error(
        "Maintenance record not found.",
      );
    }

    if (
      ![
        MaintenanceStatus.OPEN,
        MaintenanceStatus.IN_PROGRESS,
      ].includes(log.status)
    ) {
      throw new Error(
        `Only active maintenance can be cancelled. Current status: ${log.status}.`,
      );
    }

    const vehicle = db.vehicles.find(
      (candidate) =>
        candidate.id === log.vehicle_id,
    );

    if (!vehicle) {
      throw new Error(
        "The vehicle linked to this maintenance record was not found.",
      );
    }

    if (vehicle.status !== VehicleStatus.IN_SHOP) {
      throw new Error(
        "The linked vehicle is not currently IN_SHOP.",
      );
    }

    const oldLog = { ...log };
    const oldVehicle = { ...vehicle };
    const now = new Date().toISOString();

    log.status = MaintenanceStatus.CANCELLED;
    log.updated_at = now;
    vehicle.status = VehicleStatus.AVAILABLE;
    vehicle.updated_at = now;

    try {
      db.save();
    } catch (error) {
      Object.assign(log, oldLog);
      Object.assign(vehicle, oldVehicle);
      throw error;
    }

    db.logActivity(
      operator.id,
      operator.name,
      `Cancelled maintenance for vehicle ${vehicle.registration_number}`,
      "MAINTENANCE",
      log.id,
      oldLog.status,
      MaintenanceStatus.CANCELLED,
    );

    return log;
  }
}
