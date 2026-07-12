/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
export const DATABASE_SCHEMA_VERSION = 1;

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

export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface CreatedEntity {
  id: string;
  created_at: string;
}

export interface User extends BaseEntity {
  full_name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
}

export interface Vehicle extends BaseEntity {
  registration_number: string;
  vehicle_name: string;
  model: string;
  vehicle_type: VehicleType;
  maximum_load_capacity: number;
  odometer: number;
  acquisition_cost: number;
  region: string;
  manufacture_year: number;
  fuel_type: FuelType;
  status: VehicleStatus;
}

export interface Driver extends BaseEntity {
  user_id?: string;
  full_name: string;
  licence_number: string;
  licence_category: string;
  licence_expiry_date: string;
  contact_number: string;
  safety_score: number;
  region: string;
  status: DriverStatus;
}

export interface Trip extends BaseEntity {
  trip_code: string;
  source: string;
  destination: string;
  vehicle_id: string;
  driver_id: string;
  cargo_description: string;
  cargo_weight: number;
  planned_distance: number;
  actual_distance?: number;
  planned_start_time: string;
  actual_start_time?: string;
  completed_at?: string;
  final_odometer?: number;
  fuel_consumed?: number;
  revenue: number;
  notes?: string;
  status: TripStatus;
  created_by: string;
}

export interface MaintenanceLog extends BaseEntity {
  vehicle_id: string;
  maintenance_type: MaintenanceType;
  description: string;
  service_provider: string;
  start_date: string;
  expected_completion_date: string;
  completed_date?: string;
  estimated_cost: number;
  actual_cost?: number;
  odometer_at_service: number;
  status: MaintenanceStatus;
  created_by: string;
}

export interface FuelLog extends BaseEntity {
  vehicle_id: string;
  trip_id?: string;
  fuel_litres: number;
  fuel_cost: number;
  price_per_litre: number;
  odometer_reading: number;
  fuel_date: string;
  fuel_station: string;
  receipt_number: string;
  notes?: string;
  created_by: string;
}

export interface Expense extends BaseEntity {
  vehicle_id?: string;
  trip_id?: string;
  expense_type: ExpenseType;
  amount: number;
  expense_date: string;
  description: string;
  receipt_number: string;
  created_by: string;
}

export interface ActivityLog extends CreatedEntity {
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value?: string;
  new_value?: string;
}

export interface Notification extends CreatedEntity {
  user_id: string;
  title: string;
  message: string;
  notification_type: NotificationType;
  is_read: boolean;
}

export type PublicUser = Omit<User, "password_hash">;

export interface AuthenticatedUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
}

export interface DatabaseValidationIssue {
  collection: string;
  record_id?: string;
  message: string;
}

export interface DatabaseValidationResult {
  valid: boolean;
  issues: DatabaseValidationIssue[];
}