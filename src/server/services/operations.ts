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
   * Generates a unique trip code (e.g. TRIP-0003)
   */
  public static generateTripCode(): string {
    const existing = db.trips;
    let maxId = 0;
    for (const t of existing) {
      const match = t.trip_code.match(/TRIP-(\d+)/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val > maxId) maxId = val;
      }
    }
    const nextNum = maxId + 1;
    return "TRIP-" + String(nextNum).padStart(4, "0");
  }

  /**
   * Enforces vehicle validations before dispatch
   */
  public static validateVehicleForDispatch(vehicle: Vehicle, tripId: string) {
    if (vehicle.status === VehicleStatus.ON_TRIP) {
      throw new Error(`Vehicle ${vehicle.registration_number} is currently on a trip.`);
    }
    if (vehicle.status === VehicleStatus.IN_SHOP) {
      throw new Error(`Vehicle ${vehicle.registration_number} is under maintenance.`);
    }
    if (vehicle.status === VehicleStatus.RETIRED) {
      throw new Error(`Vehicle ${vehicle.registration_number} has been retired.`);
    }

    // Check if double-assigned to another DISPATCHED trip
    const activeTrip = db.trips.find(
      t => t.id !== tripId && t.vehicle_id === vehicle.id && t.status === TripStatus.DISPATCHED
    );
    if (activeTrip) {
      throw new Error(`Vehicle ${vehicle.registration_number} is currently assigned to another active trip ${activeTrip.trip_code}.`);
    }
  }

  /**
   * Enforces driver validations before dispatch
   */
  public static validateDriverForDispatch(driver: Driver, tripId: string) {
    if (driver.status === DriverStatus.ON_TRIP) {
      throw new Error(`Driver ${driver.full_name} is currently assigned to another active trip.`);
    }
    if (driver.status === DriverStatus.SUSPENDED) {
      throw new Error(`Driver ${driver.full_name} is currently suspended.`);
    }
    if (driver.status === DriverStatus.OFF_DUTY) {
      throw new Error(`Driver ${driver.full_name} is currently off duty.`);
    }

    // Check licence expiry date
    const todayStr = new Date().toISOString().split("T")[0];
    if (driver.licence_expiry_date < todayStr) {
      throw new Error(`Driver licence expired on ${driver.licence_expiry_date}.`);
    }

    // Check if double-assigned to another DISPATCHED trip
    const activeTrip = db.trips.find(
      t => t.id !== tripId && t.driver_id === driver.id && t.status === TripStatus.DISPATCHED
    );
    if (activeTrip) {
      throw new Error(`Driver ${driver.full_name} is already assigned to another active trip ${activeTrip.trip_code}.`);
    }
  }

  /**
   * Executes the dispatch transition
   */
  public static dispatchTrip(tripId: string, dispatcher: { id: string; name: string }): Trip {
    const trip = db.trips.find(t => t.id === tripId);
    if (!trip) {
      throw new Error("Trip not found");
    }
    if (trip.status !== TripStatus.DRAFT) {
      throw new Error(`Cannot dispatch a trip in ${trip.status} status.`);
    }

    const vehicle = db.vehicles.find(v => v.id === trip.vehicle_id);
    const driver = db.drivers.find(d => d.id === trip.driver_id);

    if (!vehicle) throw new Error("Assigned vehicle not found.");
    if (!driver) throw new Error("Assigned driver not found.");

    // Validate rules
    this.validateVehicleForDispatch(vehicle, tripId);
    this.validateDriverForDispatch(driver, tripId);

    // Validate Cargo capacity
    if (trip.cargo_weight > vehicle.maximum_load_capacity) {
      throw new Error(`Cargo weight of ${trip.cargo_weight} kg exceeds vehicle capacity of ${vehicle.maximum_load_capacity} kg.`);
    }

    // ----------------------------------------------------
    // Begin State Transitions (Atomic Update)
    // ----------------------------------------------------
    const oldTripStatus = trip.status;
    const oldVehicleStatus = vehicle.status;
    const oldDriverStatus = driver.status;

    try {
      // 1. Update Trip
      trip.status = TripStatus.DISPATCHED;
      trip.actual_start_time = new Date().toISOString();
      trip.updated_at = new Date().toISOString();

      // 2. Update Vehicle
      vehicle.status = VehicleStatus.ON_TRIP;
      vehicle.updated_at = new Date().toISOString();

      // 3. Update Driver
      driver.status = DriverStatus.ON_TRIP;
      driver.updated_at = new Date().toISOString();

      // Save database
      db.save();

      // 4. Log Activity
      db.logActivity(
        dispatcher.id,
        dispatcher.name,
        `Dispatched trip ${trip.trip_code}`,
        "TRIP",
        trip.id,
        oldTripStatus,
        TripStatus.DISPATCHED
      );

      // 5. Send Notification to Driver if linked
      if (driver.user_id) {
        db.notify(
          driver.user_id,
          "Trip Dispatched",
          `You have been dispatched for trip ${trip.trip_code} from ${trip.source} to ${trip.destination}. Cargo: ${trip.cargo_description}.`,
          NotificationType.TRIP_ASSIGNED
        );
      }

      return trip;
    } catch (err) {
      // Rollback memory states if disk save fails (highly unlikely, but safe-practice)
      trip.status = oldTripStatus;
      trip.actual_start_time = undefined;
      vehicle.status = oldVehicleStatus;
      driver.status = oldDriverStatus;
      db.save();
      throw err;
    }
  }

  /**
   * Executes the complete trip transition
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
    operator: { id: string; name: string }
  ): Trip {
    const trip = db.trips.find(t => t.id === tripId);
    if (!trip) {
      throw new Error("Trip not found");
    }
    if (trip.status !== TripStatus.DISPATCHED) {
      throw new Error("Only dispatched trips can be completed.");
    }

    const vehicle = db.vehicles.find(v => v.id === trip.vehicle_id);
    const driver = db.drivers.find(d => d.id === trip.driver_id);

    if (!vehicle) throw new Error("Trip vehicle not found.");
    if (!driver) throw new Error("Trip driver not found.");

    // Validations
    if (completionData.actual_distance < 0) {
      throw new Error("Actual distance cannot be negative.");
    }
    if (completionData.fuel_consumed < 0) {
      throw new Error("Fuel consumed cannot be negative.");
    }
    if (completionData.final_odometer < vehicle.odometer) {
      throw new Error(`Final odometer (${completionData.final_odometer}) cannot be lower than the current odometer (${vehicle.odometer}).`);
    }

    // Begin updates
    const oldTripStatus = trip.status;
    const oldVehicleStatus = vehicle.status;
    const oldDriverStatus = driver.status;
    const oldOdometer = vehicle.odometer;

    try {
      // 1. Update Trip
      trip.status = TripStatus.COMPLETED;
      trip.completed_at = new Date().toISOString();
      trip.actual_distance = completionData.actual_distance;
      trip.final_odometer = completionData.final_odometer;
      trip.fuel_consumed = completionData.fuel_consumed;
      if (completionData.revenue !== undefined && completionData.revenue >= 0) {
        trip.revenue = completionData.revenue;
      }
      if (completionData.notes) {
        trip.notes = completionData.notes;
      }
      trip.updated_at = new Date().toISOString();

      // 2. Update Vehicle Odometer & Status
      vehicle.odometer = completionData.final_odometer;
      vehicle.status = VehicleStatus.AVAILABLE;
      vehicle.updated_at = new Date().toISOString();

      // 3. Update Driver Status
      driver.status = DriverStatus.AVAILABLE;
      driver.updated_at = new Date().toISOString();

      // 4. Record Fuel Log if fuel consumed is logged and positive
      if (completionData.fuel_consumed > 0) {
        const estimatedFuelCost = completionData.fuel_consumed * 98; // assume average 98 per litre
        const fLog = {
          id: "fl_" + Math.random().toString(36).substr(2, 9),
          vehicle_id: vehicle.id,
          trip_id: trip.id,
          fuel_litres: completionData.fuel_consumed,
          fuel_cost: estimatedFuelCost,
          price_per_litre: 98,
          odometer_reading: completionData.final_odometer,
          fuel_date: new Date().toISOString().split("T")[0],
          fuel_station: "Operational Hub Pump",
          receipt_number: "AUTO-" + trip.trip_code,
          notes: "Automatically logged upon trip completion",
          created_by: operator.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        db.fuel_logs.unshift(fLog);
      }

      // Save to file
      db.save();

      // 5. Activity Log
      db.logActivity(
        operator.id,
        operator.name,
        `Completed trip ${trip.trip_code}`,
        "TRIP",
        trip.id,
        oldTripStatus,
        TripStatus.COMPLETED
      );

      // Notify Driver and Fleet managers
      if (driver.user_id) {
        db.notify(
          driver.user_id,
          "Trip Completed Successfully",
          `Trip ${trip.trip_code} from ${trip.source} to ${trip.destination} has been completed. Odometer recorded: ${completionData.final_odometer}.`,
          NotificationType.TRIP_COMPLETED
        );
      }

      return trip;
    } catch (err) {
      // rollback memory
      trip.status = oldTripStatus;
      trip.completed_at = undefined;
      trip.actual_distance = undefined;
      trip.final_odometer = undefined;
      trip.fuel_consumed = undefined;
      vehicle.odometer = oldOdometer;
      vehicle.status = oldVehicleStatus;
      driver.status = oldDriverStatus;
      db.save();
      throw err;
    }
  }

  /**
   * Executes the cancel trip transition
   */
  public static cancelTrip(tripId: string, operator: { id: string; name: string }): Trip {
    const trip = db.trips.find(t => t.id === tripId);
    if (!trip) {
      throw new Error("Trip not found");
    }
    if (trip.status === TripStatus.COMPLETED) {
      throw new Error("Completed trips cannot be cancelled.");
    }
    if (trip.status === TripStatus.CANCELLED) {
      throw new Error("Trip is already cancelled.");
    }

    const vehicle = db.vehicles.find(v => v.id === trip.vehicle_id);
    const driver = db.drivers.find(d => d.id === trip.driver_id);

    const oldTripStatus = trip.status;
    const oldVehicleStatus = vehicle?.status;
    const oldDriverStatus = driver?.status;

    try {
      // 1. Update Trip
      trip.status = TripStatus.CANCELLED;
      trip.updated_at = new Date().toISOString();

      // 2. If it was dispatched, restore vehicle and driver to AVAILABLE
      if (oldTripStatus === TripStatus.DISPATCHED) {
        if (vehicle && vehicle.status === VehicleStatus.ON_TRIP) {
          vehicle.status = VehicleStatus.AVAILABLE;
          vehicle.updated_at = new Date().toISOString();
        }
        if (driver && driver.status === DriverStatus.ON_TRIP) {
          driver.status = DriverStatus.AVAILABLE;
          driver.updated_at = new Date().toISOString();
        }
      }

      db.save();

      // 3. Activity Log
      db.logActivity(
        operator.id,
        operator.name,
        `Cancelled trip ${trip.trip_code}`,
        "TRIP",
        trip.id,
        oldTripStatus,
        TripStatus.CANCELLED
      );

      return trip;
    } catch (err) {
      trip.status = oldTripStatus;
      if (vehicle && oldVehicleStatus) vehicle.status = oldVehicleStatus;
      if (driver && oldDriverStatus) driver.status = oldDriverStatus;
      db.save();
      throw err;
    }
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
