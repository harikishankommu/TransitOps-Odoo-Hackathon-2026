import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import {
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
  NotificationType
} from "../types.js";

const DB_FILE_PATH = path.join(process.cwd(), "src", "server", "db.json");

export interface DatabaseSchema {
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

class DatabaseManager {
  private data: DatabaseSchema = {
    users: [],
    vehicles: [],
    drivers: [],
    trips: [],
    maintenance_logs: [],
    fuel_logs: [],
    expenses: [],
    activity_logs: [],
    notifications: []
  };

  constructor() {
    this.init();
  }

  private init() {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(DB_FILE_PATH)) {
      try {
        const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
        this.data = JSON.parse(raw);
        console.log("Database loaded successfully from", DB_FILE_PATH);
        return;
      } catch (err) {
        console.error("Error reading database file, re-seeding...", err);
      }
    }

    this.seed();
  }

  public save() {
    try {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to write database to disk", err);
    }
  }

  public get users() { return this.data.users; }
  public get vehicles() { return this.data.vehicles; }
  public get drivers() { return this.data.drivers; }
  public get trips() { return this.data.trips; }
  public get maintenance_logs() { return this.data.maintenance_logs; }
  public get fuel_logs() { return this.data.fuel_logs; }
  public get expenses() { return this.data.expenses; }
  public get activity_logs() { return this.data.activity_logs; }
  public get notifications() { return this.data.notifications; }

  public logActivity(userId: string, userName: string, action: string, entityType: string, entityId: string, oldValue?: string, newValue?: string) {
    const log: ActivityLog = {
      id: "act_" + Math.random().toString(36).substr(2, 9),
      user_id: userId,
      user_name: userName,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_value: oldValue,
      new_value: newValue,
      created_at: new Date().toISOString()
    };
    this.data.activity_logs.unshift(log); // newest first
    this.save();
    return log;
  }

  public notify(userId: string, title: string, message: string, type: NotificationType) {
    const notification: Notification = {
      id: "notif_" + Math.random().toString(36).substr(2, 9),
      user_id: userId,
      title,
      message,
      notification_type: type,
      is_read: false,
      created_at: new Date().toISOString()
    };
    this.data.notifications.unshift(notification);
    this.save();
    return notification;
  }

  private seed() {
    console.log("Seeding initial data for TransitOps...");

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
        updated_at: new Date().toISOString()
      },
      {
        id: "usr_fleet",
        full_name: "Fleet Manager",
        email: "fleet@transitops.com",
        password_hash: fleetHash,
        role: UserRole.FLEET_MANAGER,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "usr_dispatcher",
        full_name: "Dispatcher User",
        email: "dispatcher@transitops.com",
        password_hash: dispatcherHash,
        role: UserRole.DISPATCHER,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "usr_safety",
        full_name: "Safety Officer",
        email: "safety@transitops.com",
        password_hash: safetyHash,
        role: UserRole.SAFETY_OFFICER,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "usr_finance",
        full_name: "Financial Analyst",
        email: "finance@transitops.com",
        password_hash: financeHash,
        role: UserRole.FINANCIAL_ANALYST,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "usr_driver",
        full_name: "Alex Kumar",
        email: "driver@transitops.com",
        password_hash: driverHash,
        role: UserRole.DRIVER,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "usr_priya",
        full_name: "Priya Sharma",
        email: "priya@transitops.com",
        password_hash: driverHash,
        role: UserRole.DRIVER,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
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
        updated_at: new Date().toISOString()
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
        updated_at: new Date().toISOString()
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
        updated_at: new Date().toISOString()
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
        updated_at: new Date().toISOString()
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
        updated_at: new Date().toISOString()
      }
    ];

    const drivers: Driver[] = [
      {
        id: "dr_alex",
        user_id: "usr_driver",
        full_name: "Alex Kumar",
        licence_number: "DL-11111",
        licence_category: "Heavy Commercial",
        licence_expiry_date: "2026-12-15",
        contact_number: "9876543210",
        safety_score: 92,
        region: "Patna",
        status: DriverStatus.AVAILABLE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "dr_ravi",
        full_name: "Ravi Singh",
        licence_number: "DL-22222",
        licence_category: "Heavy Commercial",
        licence_expiry_date: "2027-01-10",
        contact_number: "9876543211",
        safety_score: 86,
        region: "Patna",
        status: DriverStatus.AVAILABLE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "dr_priya",
        user_id: "usr_priya",
        full_name: "Priya Sharma",
        licence_number: "DL-33333",
        licence_category: "Medium Commercial",
        licence_expiry_date: "2026-11-20",
        contact_number: "9876543212",
        safety_score: 95,
        region: "Hyderabad",
        status: DriverStatus.ON_TRIP,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "dr_manoj",
        full_name: "Manoj Verma",
        licence_number: "DL-44444",
        licence_category: "Light Motor Vehicle",
        licence_expiry_date: "2026-06-15", // Expired licence
        contact_number: "9876543213",
        safety_score: 75,
        region: "Patna",
        status: DriverStatus.AVAILABLE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "dr_suresh",
        full_name: "Suresh Yadav",
        licence_number: "DL-55555",
        licence_category: "Heavy Commercial",
        licence_expiry_date: "2026-10-30",
        contact_number: "9876543214",
        safety_score: 45,
        region: "Patna",
        status: DriverStatus.SUSPENDED,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    // Seed Trips
    const trips: Trip[] = [
      {
        id: "tr_0001",
        trip_code: "TRIP-0001",
        source: "Patna",
        destination: "Muzzafarpur",
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
        updated_at: "2026-07-01T11:30:00.000Z"
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
        updated_at: new Date(Date.now() - 3000000).toISOString()
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
        updated_at: new Date().toISOString()
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
        updated_at: "2026-07-05T08:00:00.000Z"
      }
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
        updated_at: "2026-06-15T16:00:00.000Z"
      },
      {
        id: "ml_0002",
        vehicle_id: "vh_pickup03",
        maintenance_type: MaintenanceType.BRAKE_SERVICE,
        description: "Brake shoe replacement and fluid flush due to soft pedal.",
        service_provider: "Mahindra Service Junction, Bengaluru",
        start_date: new Date().toISOString().split("T")[0],
        expected_completion_date: new Date(Date.now() + 86400000).toISOString().split("T")[0], // Tomorrow
        estimated_cost: 7500,
        odometer_at_service: 18500,
        status: MaintenanceStatus.IN_PROGRESS,
        created_by: "usr_fleet",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
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
        updated_at: "2026-07-01T08:10:00.000Z"
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
        updated_at: "2026-07-10T12:00:00.000Z"
      }
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
        updated_at: "2026-07-01T09:15:00.000Z"
      },
      {
        id: "ex_0002",
        vehicle_id: "vh_cargo07",
        expense_type: ExpenseType.INSURANCE,
        amount: 18000,
        expense_date: "2026-06-25",
        description: "Annual Commercial Vehicle Comprehensive Insurance Cover renewal",
        receipt_number: "INS-992123",
        created_by: "usr_fleet",
        created_at: "2026-06-25T11:00:00.000Z",
        updated_at: "2026-06-25T11:00:00.000Z"
      }
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
        created_at: new Date(Date.now() - 86400000 * 2).toISOString()
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
        created_at: new Date(Date.now() - 3600000 * 4).toISOString()
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
        created_at: new Date(Date.now() - 3000000).toISOString()
      }
    ];

    // Seed Notifications
    const notifications: Notification[] = [
      {
        id: "not_1",
        user_id: "usr_driver",
        title: "New Trip Assigned",
        message: "You have been assigned to trip TRIP-0001 (Patna to Muzzafarpur). Please review notes.",
        notification_type: NotificationType.TRIP_ASSIGNED,
        is_read: true,
        created_at: "2026-07-01T07:31:00.000Z"
      },
      {
        id: "not_2",
        user_id: "usr_safety",
        title: "Licence Expiry Warning",
        message: "Driver Manoj Verma's licence (DL-44444) has expired on 2026-06-15.",
        notification_type: NotificationType.LICENCE_EXPIRED,
        is_read: false,
        created_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: "not_3",
        user_id: "usr_fleet",
        title: "Maintenance Service Required",
        message: "Vehicle Pickup-03 is currently IN_SHOP under Brake Service.",
        notification_type: NotificationType.MAINTENANCE_DUE,
        is_read: false,
        created_at: new Date(Date.now() - 3600000 * 4).toISOString()
      }
    ];

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
    console.log("Database seeded successfully with", users.length, "users,", vehicles.length, "vehicles, and", drivers.length, "drivers.");
  }
}

export const db = new DatabaseManager();
