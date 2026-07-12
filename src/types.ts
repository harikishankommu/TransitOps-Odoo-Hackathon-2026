/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  ADMIN = "ADMIN",
  FLEET_MANAGER = "FLEET_MANAGER",
  DISPATCHER = "DISPATCHER",
  SAFETY_OFFICER = "SAFETY_OFFICER",
  FINANCIAL_ANALYST = "FINANCIAL_ANALYST",
  DRIVER = "DRIVER"
}

export enum VehicleStatus {
  AVAILABLE = "AVAILABLE",
  ON_TRIP = "ON_TRIP",
  IN_SHOP = "IN_SHOP",
  RETIRED = "RETIRED"
}

export enum DriverStatus {
  AVAILABLE = "AVAILABLE",
  ON_TRIP = "ON_TRIP",
  OFF_DUTY = "OFF_DUTY",
  SUSPENDED = "SUSPENDED"
}

export enum TripStatus {
  DRAFT = "DRAFT",
  DISPATCHED = "DISPATCHED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED"
}

export enum MaintenanceStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED"
}

export enum MaintenanceType {
  OIL_CHANGE = "Oil Change",
  ENGINE_REPAIR = "Engine Repair",
  TYRE_REPLACEMENT = "Tyre Replacement",
  BRAKE_SERVICE = "Brake Service",
  GENERAL_INSPECTION = "General Inspection",
  ELECTRICAL_REPAIR = "Electrical Repair",
  ACCIDENT_REPAIR = "Accident Repair",
  OTHER = "Other"
}

export enum FuelType {
  DIESEL = "Diesel",
  PETROL = "Petrol",
  ELECTRIC = "Electric",
  CNG = "CNG",
  HYBRID = "Hybrid"
}

export enum VehicleType {
  VAN = "Van",
  TRUCK = "Truck",
  MINI_TRUCK = "Mini Truck",
  PICKUP = "Pickup",
  BUS = "Bus",
  TRAILER = "Trailer"
}

export enum ExpenseType {
  TOLL = "TOLL",
  PARKING = "PARKING",
  MAINTENANCE = "MAINTENANCE",
  PERMIT = "PERMIT",
  DRIVER_ALLOWANCE = "DRIVER_ALLOWANCE",
  REPAIR = "REPAIR",
  INSURANCE = "INSURANCE",
  OTHER = "OTHER"
}

export enum NotificationType {
  LICENCE_EXPIRING = "LICENCE_EXPIRING",
  LICENCE_EXPIRED = "LICENCE_EXPIRED",
  MAINTENANCE_DUE = "MAINTENANCE_DUE",
  TRIP_ASSIGNED = "TRIP_ASSIGNED",
  TRIP_COMPLETED = "TRIP_COMPLETED",
  VEHICLE_UNAVAILABLE = "VEHICLE_UNAVAILABLE",
  SYSTEM = "SYSTEM"
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  registration_number: string;
  vehicle_name: string;
  model: string;
  vehicle_type: VehicleType;
  maximum_load_capacity: number; // in kg
  odometer: number;
  acquisition_cost: number;
  region: string;
  manufacture_year: number;
  fuel_type: FuelType;
  status: VehicleStatus;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  user_id?: string; // Optional, links to a User record
  full_name: string;
  licence_number: string;
  licence_category: string;
  licence_expiry_date: string; // ISO date string (YYYY-MM-DD)
  contact_number: string;
  safety_score: number; // 0 to 100
  region: string;
  status: DriverStatus;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  trip_code: string; // TRIP-0001, TRIP-0002...
  source: string;
  destination: string;
  vehicle_id: string;
  driver_id: string;
  cargo_description: string;
  cargo_weight: number; // in kg
  planned_distance: number; // in km
  actual_distance?: number; // in km
  planned_start_time: string; // ISO datetime
  actual_start_time?: string; // ISO datetime
  completed_at?: string; // ISO datetime
  final_odometer?: number;
  fuel_consumed?: number; // in litres
  revenue: number;
  notes?: string;
  status: TripStatus;
  created_by: string; // user id
  created_at: string;
  updated_at: string;
}

export interface MaintenanceLog {
  id: string;
  vehicle_id: string;
  maintenance_type: MaintenanceType;
  description: string;
  service_provider: string;
  start_date: string; // YYYY-MM-DD
  expected_completion_date: string; // YYYY-MM-DD
  completed_date?: string; // YYYY-MM-DD
  estimated_cost: number;
  actual_cost?: number;
  odometer_at_service: number;
  status: MaintenanceStatus;
  created_by: string; // user id
  created_at: string;
  updated_at: string;
}

export interface FuelLog {
  id: string;
  vehicle_id: string;
  trip_id?: string; // Optional trip connection
  fuel_litres: number;
  fuel_cost: number;
  price_per_litre: number; // calculated: fuel_cost / fuel_litres
  odometer_reading: number;
  fuel_date: string; // YYYY-MM-DD
  fuel_station: string;
  receipt_number: string;
  notes?: string;
  created_by: string; // user id
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  vehicle_id?: string;
  trip_id?: string;
  expense_type: ExpenseType;
  amount: number;
  expense_date: string; // YYYY-MM-DD
  description: string;
  receipt_number: string;
  created_by: string; // user id
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string; // Denormalized for easy rendering
  action: string;
  entity_type: string;
  entity_id: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: NotificationType;
  is_read: boolean;
  created_at: string;
}
