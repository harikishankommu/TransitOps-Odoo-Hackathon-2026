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

  /**
   * Starts a vehicle maintenance record
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
    operator: { id: string; name: string }
  ): MaintenanceLog {
    const vehicle = db.vehicles.find(v => v.id === logData.vehicle_id);
    if (!vehicle) {
      throw new Error("Vehicle not found.");
    }

    if (vehicle.status === VehicleStatus.ON_TRIP) {
      throw new Error("Maintenance cannot be started while the vehicle is on a trip.");
    }

    if (vehicle.status === VehicleStatus.RETIRED) {
      throw new Error("Selected vehicle has been retired.");
    }

    const oldVehicleStatus = vehicle.status;

    try {
      // 1. Update vehicle status to IN_SHOP
      vehicle.status = VehicleStatus.IN_SHOP;
      vehicle.updated_at = new Date().toISOString();

      // 2. Create Maintenance Log
      const logId = "ml_" + Math.random().toString(36).substr(2, 9);
      const log: MaintenanceLog = {
        id: logId,
        vehicle_id: vehicle.id,
        maintenance_type: logData.maintenance_type,
        description: logData.description,
        service_provider: logData.service_provider,
        start_date: logData.start_date,
        expected_completion_date: logData.expected_completion_date,
        estimated_cost: logData.estimated_cost,
        odometer_at_service: logData.odometer_at_service,
        status: MaintenanceStatus.IN_PROGRESS,
        created_by: operator.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      db.maintenance_logs.unshift(log);
      db.save();

      // 3. Log Activity
      db.logActivity(
        operator.id,
        operator.name,
        `Opened maintenance service for vehicle ${vehicle.registration_number}`,
        "MAINTENANCE",
        log.id,
        oldVehicleStatus,
        VehicleStatus.IN_SHOP
      );

      return log;
    } catch (err) {
      vehicle.status = oldVehicleStatus;
      db.save();
      throw err;
    }
  }

  /**
   * Completes a vehicle maintenance record
   */
  public static completeMaintenance(
    logId: string,
    completionData: {
      actual_cost: number;
      completed_date: string;
      notes?: string;
    },
    operator: { id: string; name: string }
  ): MaintenanceLog {
    const log = db.maintenance_logs.find(m => m.id === logId);
    if (!log) {
      throw new Error("Maintenance log not found.");
    }
    if (log.status !== MaintenanceStatus.IN_PROGRESS && log.status !== MaintenanceStatus.OPEN) {
      throw new Error(`Cannot complete maintenance that is currently ${log.status}.`);
    }

    if (completionData.actual_cost < 0) {
      throw new Error("Actual cost cannot be negative.");
    }

    const vehicle = db.vehicles.find(v => v.id === log.vehicle_id);
    const oldLogStatus = log.status;
    const oldVehicleStatus = vehicle?.status;

    try {
      // 1. Update Maintenance Log
      log.status = MaintenanceStatus.COMPLETED;
      log.actual_cost = completionData.actual_cost;
      log.completed_date = completionData.completed_date;
      if (completionData.notes) {
        log.description += `\n[Completion Notes]: ${completionData.notes}`;
      }
      log.updated_at = new Date().toISOString();

      // 2. Update Vehicle status to AVAILABLE (unless RETIRED)
      if (vehicle) {
        if (vehicle.status !== VehicleStatus.RETIRED) {
          vehicle.status = VehicleStatus.AVAILABLE;
          vehicle.updated_at = new Date().toISOString();
        }
      }

      // 3. Log an Expense for this maintenance
      const expense: Expense = {
        id: "ex_" + Math.random().toString(36).substr(2, 9),
        vehicle_id: log.vehicle_id,
        expense_type: ExpenseType.MAINTENANCE,
        amount: completionData.actual_cost,
        expense_date: completionData.completed_date,
        description: `Maintenance complete: ${log.maintenance_type} - ${log.description}`,
        receipt_number: "MNT-" + log.id.toUpperCase(),
        created_by: operator.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.expenses.unshift(expense);

      db.save();

      // 4. Log Activity
      db.logActivity(
        operator.id,
        operator.name,
        `Completed maintenance for vehicle ${vehicle?.registration_number || ""}`,
        "MAINTENANCE",
        log.id,
        oldLogStatus,
        MaintenanceStatus.COMPLETED
      );

      return log;
    } catch (err) {
      log.status = oldLogStatus;
      log.actual_cost = undefined;
      log.completed_date = undefined;
      if (vehicle && oldVehicleStatus) vehicle.status = oldVehicleStatus;
      db.save();
      throw err;
    }
  }

  /**
   * Cancels a vehicle maintenance record
   */
  public static cancelMaintenance(logId: string, operator: { id: string; name: string }): MaintenanceLog {
    const log = db.maintenance_logs.find(m => m.id === logId);
    if (!log) {
      throw new Error("Maintenance log not found.");
    }
    if (log.status === MaintenanceStatus.COMPLETED || log.status === MaintenanceStatus.CANCELLED) {
      throw new Error(`Cannot cancel a maintenance record that is already ${log.status}.`);
    }

    const vehicle = db.vehicles.find(v => v.id === log.vehicle_id);
    const oldLogStatus = log.status;
    const oldVehicleStatus = vehicle?.status;

    try {
      log.status = MaintenanceStatus.CANCELLED;
      log.updated_at = new Date().toISOString();

      if (vehicle && vehicle.status === VehicleStatus.IN_SHOP) {
        vehicle.status = VehicleStatus.AVAILABLE;
        vehicle.updated_at = new Date().toISOString();
      }

      db.save();

      db.logActivity(
        operator.id,
        operator.name,
        `Cancelled maintenance for vehicle ${vehicle?.registration_number || ""}`,
        "MAINTENANCE",
        log.id,
        oldLogStatus,
        MaintenanceStatus.CANCELLED
      );

      return log;
    } catch (err) {
      log.status = oldLogStatus;
      if (vehicle && oldVehicleStatus) vehicle.status = oldVehicleStatus;
      db.save();
      throw err;
    }
  }
}
