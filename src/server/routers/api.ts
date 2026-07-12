import { Router } from "express";
import { db } from "../database.js";
import { Security, authenticateJWT, requireRole, AuthenticatedRequest } from "../utils/auth.js";
import { OperationsService } from "../services/operations.js";
import {
  User,
  UserRole,
  VehicleStatus,
  VehicleType,
  FuelType,
  DriverStatus,
  TripStatus,
  MaintenanceStatus,
  MaintenanceType,
  ExpenseType,
  NotificationType,
  Vehicle,
  Driver,
  Trip,
  MaintenanceLog,
  FuelLog,
  Expense,
} from "../../types.js";

const apiRouter = Router();

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function serializeManagedUser(user: User) {
  return {
    ...Security.serializeUser(user),
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

function countActiveAdmins(): number {
  return db.users.filter(
    (user) =>
      user.role === UserRole.ADMIN &&
      user.is_active,
  ).length;
}
// ============================================================================
// 1. AUTHENTICATION ENDPOINTS
// ============================================================================

apiRouter.post("/auth/signup", (req, res) => {
  const {
    full_name,
    email,
    password,
    confirm_password,
  } = req.body ?? {};

  if (
    typeof full_name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof confirm_password !== "string"
  ) {
    return res.status(400).json({
      error: "All signup fields are required.",
    });
  }

  const normalizedName = full_name.trim();
  const normalizedEmail = normalizeEmail(email);

  if (
    normalizedName.length < 2 ||
    normalizedName.length > 80
  ) {
    return res.status(400).json({
      error:
        "Full name must contain between 2 and 80 characters.",
    });
  }

  if (
    normalizedEmail.length > 254 ||
    !EMAIL_PATTERN.test(normalizedEmail)
  ) {
    return res.status(400).json({
      error: "Enter a valid email address.",
    });
  }

  if (
    password.length < 8 ||
    password.length > 128
  ) {
    return res.status(400).json({
      error:
        "Password must contain between 8 and 128 characters.",
    });
  }

  if (password !== confirm_password) {
    return res.status(400).json({
      error: "Passwords do not match.",
    });
  }

  const existingUser = db.users.find(
    (user) =>
      normalizeEmail(user.email) === normalizedEmail,
  );

  if (existingUser) {
    return res.status(409).json({
      error:
        "An account with this email address already exists.",
    });
  }

  const now = new Date().toISOString();

  const newUser: User = {
    id: db.generateId("usr"),
    full_name: normalizedName,
    email: normalizedEmail,
    password_hash:
      Security.hashPassword(password),

    // Users cannot select or elevate their role at signup.
    role: UserRole.DRIVER,

    is_active: true,
    created_at: now,
    updated_at: now,
  };

  db.users.push(newUser);

  try {
    db.save();
  } catch (error) {
    const newUserIndex = db.users.findIndex(
      (user) => user.id === newUser.id,
    );

    if (newUserIndex >= 0) {
      db.users.splice(newUserIndex, 1);
    }

    throw error;
  }

  db.logActivity(
    newUser.id,
    newUser.full_name,
    "Registered a new account",
    "USER",
    newUser.id,
  );

  const token = Security.generateToken(newUser);

  return res.status(201).json({
    token,
    user: Security.serializeUser(newUser),
  });
});

apiRouter.post("/auth/login", (req, res) => {
  const { email, password } = req.body ?? {};

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    return res.status(400).json({
      error:
        "Email and password are required.",
    });
  }

  const normalizedEmail = normalizeEmail(email);

  const user = db.users.find(
    (candidate) =>
      normalizeEmail(candidate.email) ===
      normalizedEmail,
  );

  if (
    !user ||
    !Security.comparePassword(
      password,
      user.password_hash,
    )
  ) {
    return res.status(401).json({
      error: "Invalid email or password.",
    });
  }

  if (!user.is_active) {
    return res.status(403).json({
      error:
        "Your account is disabled. Please contact an administrator.",
    });
  }

  const token = Security.generateToken(user);

  db.logActivity(
    user.id,
    user.full_name,
    "Logged in successfully",
    "USER",
    user.id,
  );

  return res.json({
    token,
    user: Security.serializeUser(user),
  });
});

apiRouter.get(
  "/auth/me",
  authenticateJWT,
  (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication is required.",
      });
    }

    return res.json(
      Security.serializeUser(req.user),
    );
  },
);

apiRouter.post(
  "/auth/logout",
  authenticateJWT,
  (req: AuthenticatedRequest, res) => {
    if (req.user) {
      db.logActivity(
        req.user.id,
        req.user.full_name,
        "Logged out",
        "USER",
        req.user.id,
      );
    }

    return res.json({
      success: true,
    });
  },
);

const VEHICLE_READ_ROLES = [
  UserRole.ADMIN,
  UserRole.FLEET_MANAGER,
  UserRole.DISPATCHER,
];

const DRIVER_READ_ROLES = [
  UserRole.ADMIN,
  UserRole.DISPATCHER,
  UserRole.SAFETY_OFFICER,
];

const TRIP_READ_ROLES = [
  UserRole.ADMIN,
  UserRole.DISPATCHER,
  UserRole.DRIVER,
];

const MAINTENANCE_ROLES = [
  UserRole.ADMIN,
  UserRole.FLEET_MANAGER,
];

const FINANCIAL_ROLES = [
  UserRole.ADMIN,
  UserRole.FLEET_MANAGER,
  UserRole.FINANCIAL_ANALYST,
];

const REPORT_ROLES = [
  UserRole.ADMIN,
  UserRole.FLEET_MANAGER,
  UserRole.SAFETY_OFFICER,
  UserRole.FINANCIAL_ANALYST,
];

// ============================================================================
// 2. USER ENDPOINTS
// ============================================================================

apiRouter.get(
  "/users",
  authenticateJWT,
  requireRole([UserRole.ADMIN]),
  (_req, res) => {
    const users = db.users.map(
      serializeManagedUser,
    );

    return res.json(users);
  },
);

apiRouter.get(
  "/users/:id",
  authenticateJWT,
  requireRole([UserRole.ADMIN]),
  (req, res) => {
    const targetUser = db.users.find(
      (user) => user.id === req.params.id,
    );

    if (!targetUser) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    return res.json(
      serializeManagedUser(targetUser),
    );
  },
);

apiRouter.patch(
  "/users/:id/role",
  authenticateJWT,
  requireRole([UserRole.ADMIN]),
  (req: AuthenticatedRequest, res) => {
    const { role } = req.body ?? {};

    if (
      typeof role !== "string" ||
      !Object.values(UserRole).includes(
        role as UserRole,
      )
    ) {
      return res.status(400).json({
        error: "A valid role is required.",
      });
    }

    const requestedRole = role as UserRole;

    const targetUser = db.users.find(
      (user) => user.id === req.params.id,
    );

    if (!targetUser) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    if (targetUser.id === req.user?.id) {
      return res.status(400).json({
        error:
          "You cannot change your own role.",
      });
    }

    if (
      targetUser.role === UserRole.ADMIN &&
      requestedRole !== UserRole.ADMIN &&
      targetUser.is_active &&
      countActiveAdmins() <= 1
    ) {
      return res.status(409).json({
        error:
          "The final active administrator cannot be demoted.",
      });
    }

    const oldRole = targetUser.role;

    targetUser.role = requestedRole;
    targetUser.updated_at =
      new Date().toISOString();

    db.save();

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Changed ${targetUser.full_name}'s role`,
      "USER",
      targetUser.id,
      oldRole,
      requestedRole,
    );

    return res.json({
      success: true,
      user: serializeManagedUser(targetUser),
    });
  },
);

apiRouter.patch(
  "/users/:id/status",
  authenticateJWT,
  requireRole([UserRole.ADMIN]),
  (req: AuthenticatedRequest, res) => {
    const { is_active } = req.body ?? {};

    if (typeof is_active !== "boolean") {
      return res.status(400).json({
        error:
          "is_active must be either true or false.",
      });
    }

    const targetUser = db.users.find(
      (user) => user.id === req.params.id,
    );

    if (!targetUser) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    if (targetUser.id === req.user?.id) {
      return res.status(400).json({
        error:
          "You cannot disable your own account.",
      });
    }

    if (
      targetUser.role === UserRole.ADMIN &&
      targetUser.is_active &&
      !is_active &&
      countActiveAdmins() <= 1
    ) {
      return res.status(409).json({
        error:
          "The final active administrator cannot be disabled.",
      });
    }

    const oldStatus = targetUser.is_active
      ? "ACTIVE"
      : "DISABLED";

    targetUser.is_active = is_active;
    targetUser.updated_at =
      new Date().toISOString();

    db.save();

    const newStatus = targetUser.is_active
      ? "ACTIVE"
      : "DISABLED";

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Changed ${targetUser.full_name}'s account status`,
      "USER",
      targetUser.id,
      oldStatus,
      newStatus,
    );

    return res.json({
      success: true,
      user: serializeManagedUser(targetUser),
    });
  },
);
// ============================================================================
// 3. VEHICLE MODULE ENDPOINTS
// ============================================================================

type VehicleSortField =
  | "created_at"
  | "registration_number"
  | "vehicle_name"
  | "vehicle_type"
  | "maximum_load_capacity"
  | "odometer"
  | "acquisition_cost"
  | "region"
  | "manufacture_year"
  | "fuel_type"
  | "status";

const VEHICLE_SORT_FIELDS = new Set<VehicleSortField>([
  "created_at",
  "registration_number",
  "vehicle_name",
  "vehicle_type",
  "maximum_load_capacity",
  "odometer",
  "acquisition_cost",
  "region",
  "manufacture_year",
  "fuel_type",
  "status",
]);

const VEHICLE_REGISTRATION_PATTERN =
  /^[A-Z0-9-]{4,20}$/;
const MIN_MANUFACTURE_YEAR = 1900;

function hasOwnProperty(
  value: object,
  key: PropertyKey,
): boolean {
  return Object.prototype.hasOwnProperty.call(
    value,
    key,
  );
}

function getSingleQueryValue(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(
    getSingleQueryValue(value),
    10,
  );

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function parseFiniteNumber(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim())
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeVehicleRegistration(
  value: string,
): string {
  return value
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function normalizeVehicleText(
  value: string,
): string {
  return value.trim().replace(/\s+/g, " ");
}

function isVehicleType(
  value: unknown,
): value is VehicleType {
  return (
    typeof value === "string" &&
    Object.values(VehicleType).includes(
      value as VehicleType,
    )
  );
}

function isFuelType(
  value: unknown,
): value is FuelType {
  return (
    typeof value === "string" &&
    Object.values(FuelType).includes(
      value as FuelType,
    )
  );
}

function compareVehicleValues(
  first: Vehicle,
  second: Vehicle,
  field: VehicleSortField,
  order: 1 | -1,
): number {
  const firstValue = first[field];
  const secondValue = second[field];

  if (
    typeof firstValue === "number" &&
    typeof secondValue === "number"
  ) {
    return (firstValue - secondValue) * order;
  }

  return (
    String(firstValue).localeCompare(
      String(secondValue),
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    ) * order
  );
}

apiRouter.get(
  "/vehicles/available",
  authenticateJWT,
  requireRole(VEHICLE_READ_ROLES),
  (_req, res) => {
    const result = db.vehicles
      .filter(
        (vehicle) =>
          vehicle.status ===
          VehicleStatus.AVAILABLE,
      )
      .sort((first, second) =>
        first.registration_number.localeCompare(
          second.registration_number,
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          },
        ),
      );

    return res.json(result);
  },
);

apiRouter.get(
  "/vehicles",
  authenticateJWT,
  requireRole(VEHICLE_READ_ROLES),
  (req, res) => {
    const search = getSingleQueryValue(
      req.query.search,
    ).toLowerCase();
    const status = getSingleQueryValue(
      req.query.status,
    );
    const vehicleType = getSingleQueryValue(
      req.query.vehicle_type,
    );
    const region = getSingleQueryValue(
      req.query.region,
    ).toLowerCase();
    const requestedSortField =
      getSingleQueryValue(req.query.sort_by) ||
      "created_at";
    const requestedSortOrder =
      getSingleQueryValue(req.query.sort_order) ||
      "desc";

    if (
      status &&
      !Object.values(VehicleStatus).includes(
        status as VehicleStatus,
      )
    ) {
      return res.status(400).json({
        error: "Invalid vehicle status filter.",
      });
    }

    if (
      vehicleType &&
      !Object.values(VehicleType).includes(
        vehicleType as VehicleType,
      )
    ) {
      return res.status(400).json({
        error: "Invalid vehicle type filter.",
      });
    }

    if (
      !VEHICLE_SORT_FIELDS.has(
        requestedSortField as VehicleSortField,
      )
    ) {
      return res.status(400).json({
        error: "Invalid vehicle sort field.",
      });
    }

    if (
      requestedSortOrder !== "asc" &&
      requestedSortOrder !== "desc"
    ) {
      return res.status(400).json({
        error:
          "Vehicle sort order must be asc or desc.",
      });
    }

    let list = [...db.vehicles];

    if (search) {
      list = list.filter((vehicle) =>
        [
          vehicle.registration_number,
          vehicle.vehicle_name,
          vehicle.model,
          vehicle.region,
        ].some((value) =>
          value.toLowerCase().includes(search),
        ),
      );
    }

    if (status) {
      list = list.filter(
        (vehicle) => vehicle.status === status,
      );
    }

    if (vehicleType) {
      list = list.filter(
        (vehicle) =>
          vehicle.vehicle_type === vehicleType,
      );
    }

    if (region) {
      list = list.filter((vehicle) =>
        vehicle.region.toLowerCase().includes(region),
      );
    }

    const sortField =
      requestedSortField as VehicleSortField;
    const sortOrder: 1 | -1 =
      requestedSortOrder === "asc" ? 1 : -1;

    list.sort((first, second) =>
      compareVehicleValues(
        first,
        second,
        sortField,
        sortOrder,
      ),
    );

    const pageSize = parsePositiveInteger(
      req.query.page_size,
      15,
      100,
    );
    const requestedPage = parsePositiveInteger(
      req.query.page,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const total = list.length;
    const totalPages = Math.max(
      1,
      Math.ceil(total / pageSize),
    );
    const page = Math.min(
      requestedPage,
      totalPages,
    );
    const startIndex = (page - 1) * pageSize;
    const data = list.slice(
      startIndex,
      startIndex + pageSize,
    );

    return res.json({
      data,
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
    });
  },
);

apiRouter.get(
  "/vehicles/:id",
  authenticateJWT,
  requireRole(VEHICLE_READ_ROLES),
  (req, res) => {
    const vehicle = db.vehicles.find(
      (candidate) =>
        candidate.id === req.params.id,
    );

    if (!vehicle) {
      return res.status(404).json({
        error: "Vehicle not found.",
      });
    }

    return res.json(vehicle);
  },
);

apiRouter.get(
  "/vehicles/:id/history",
  authenticateJWT,
  requireRole(VEHICLE_READ_ROLES),
  (req, res) => {
    const vehicle = db.vehicles.find(
      (candidate) =>
        candidate.id === req.params.id,
    );

    if (!vehicle) {
      return res.status(404).json({
        error: "Vehicle not found.",
      });
    }

    const newestFirst = <
      Entity extends { created_at: string },
    >(
      first: Entity,
      second: Entity,
    ): number =>
      second.created_at.localeCompare(
        first.created_at,
      );

    const trips = db.trips
      .filter(
        (trip) => trip.vehicle_id === vehicle.id,
      )
      .sort(newestFirst);
    const maintenance = db.maintenance_logs
      .filter(
        (log) => log.vehicle_id === vehicle.id,
      )
      .sort(newestFirst);
    const expenses = db.expenses
      .filter(
        (expense) =>
          expense.vehicle_id === vehicle.id,
      )
      .sort(newestFirst);
    const fuel = db.fuel_logs
      .filter(
        (fuelLog) =>
          fuelLog.vehicle_id === vehicle.id,
      )
      .sort(newestFirst);

    return res.json({
      trips,
      maintenance,
      expenses,
      fuel,
    });
  },
);

apiRouter.post(
  "/vehicles",
  authenticateJWT,
  requireRole([
    UserRole.ADMIN,
    UserRole.FLEET_MANAGER,
  ]),
  (req: AuthenticatedRequest, res) => {
    const body = req.body ?? {};

    if (
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        error: "A valid vehicle payload is required.",
      });
    }

    const registrationNumber =
      typeof body.registration_number === "string"
        ? normalizeVehicleRegistration(
            body.registration_number,
          )
        : "";
    const vehicleName =
      typeof body.vehicle_name === "string"
        ? normalizeVehicleText(body.vehicle_name)
        : "";
    const model =
      typeof body.model === "string"
        ? normalizeVehicleText(body.model)
        : "";
    const region =
      typeof body.region === "string"
        ? normalizeVehicleText(body.region)
        : "";
    const maximumLoadCapacity =
      parseFiniteNumber(
        body.maximum_load_capacity,
      );
    const odometer =
      body.odometer === undefined
        ? 0
        : parseFiniteNumber(body.odometer);
    const acquisitionCost =
      body.acquisition_cost === undefined
        ? 0
        : parseFiniteNumber(
            body.acquisition_cost,
          );
    const manufactureYear =
      body.manufacture_year === undefined
        ? new Date().getFullYear()
        : parseFiniteNumber(
            body.manufacture_year,
          );

    if (
      !VEHICLE_REGISTRATION_PATTERN.test(
        registrationNumber,
      )
    ) {
      return res.status(400).json({
        error:
          "Registration number must contain 4–20 letters, numbers, or hyphens.",
      });
    }

    if (
      vehicleName.length < 2 ||
      vehicleName.length > 80
    ) {
      return res.status(400).json({
        error:
          "Vehicle name must contain between 2 and 80 characters.",
      });
    }

    if (model.length < 2 || model.length > 80) {
      return res.status(400).json({
        error:
          "Model must contain between 2 and 80 characters.",
      });
    }

    if (region.length < 2 || region.length > 80) {
      return res.status(400).json({
        error:
          "Region must contain between 2 and 80 characters.",
      });
    }

    if (!isVehicleType(body.vehicle_type)) {
      return res.status(400).json({
        error: "A valid vehicle type is required.",
      });
    }

    if (!isFuelType(body.fuel_type)) {
      return res.status(400).json({
        error: "A valid fuel type is required.",
      });
    }

    if (
      maximumLoadCapacity === null ||
      maximumLoadCapacity <= 0
    ) {
      return res.status(400).json({
        error:
          "Maximum load capacity must be greater than zero.",
      });
    }

    if (odometer === null || odometer < 0) {
      return res.status(400).json({
        error: "Odometer must be zero or greater.",
      });
    }

    if (
      acquisitionCost === null ||
      acquisitionCost < 0
    ) {
      return res.status(400).json({
        error:
          "Acquisition cost must be zero or greater.",
      });
    }

    const maximumManufactureYear =
      new Date().getFullYear() + 1;

    if (
      manufactureYear === null ||
      !Number.isInteger(manufactureYear) ||
      manufactureYear < MIN_MANUFACTURE_YEAR ||
      manufactureYear > maximumManufactureYear
    ) {
      return res.status(400).json({
        error: `Manufacture year must be between ${MIN_MANUFACTURE_YEAR} and ${maximumManufactureYear}.`,
      });
    }

    const duplicateVehicle = db.vehicles.find(
      (vehicle) =>
        normalizeVehicleRegistration(
          vehicle.registration_number,
        ) === registrationNumber,
    );

    if (duplicateVehicle) {
      return res.status(409).json({
        error: `Vehicle registration number ${registrationNumber} already exists.`,
      });
    }

    const now = new Date().toISOString();
    const newVehicle: Vehicle = {
      id: db.generateId("vh"),
      registration_number: registrationNumber,
      vehicle_name: vehicleName,
      model,
      vehicle_type: body.vehicle_type,
      maximum_load_capacity:
        maximumLoadCapacity,
      odometer,
      acquisition_cost: acquisitionCost,
      region,
      manufacture_year: manufactureYear,
      fuel_type: body.fuel_type,
      status: VehicleStatus.AVAILABLE,
      created_at: now,
      updated_at: now,
    };

    db.vehicles.push(newVehicle);

    try {
      db.save();
    } catch (error) {
      const index = db.vehicles.findIndex(
        (vehicle) => vehicle.id === newVehicle.id,
      );

      if (index >= 0) {
        db.vehicles.splice(index, 1);
      }

      throw error;
    }

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Created vehicle ${newVehicle.vehicle_name} (${newVehicle.registration_number})`,
      "VEHICLE",
      newVehicle.id,
    );

    return res.status(201).json(newVehicle);
  },
);

apiRouter.put(
  "/vehicles/:id",
  authenticateJWT,
  requireRole([
    UserRole.ADMIN,
    UserRole.FLEET_MANAGER,
  ]),
  (req: AuthenticatedRequest, res) => {
    const vehicleIndex = db.vehicles.findIndex(
      (candidate) =>
        candidate.id === req.params.id,
    );

    if (vehicleIndex === -1) {
      return res.status(404).json({
        error: "Vehicle not found.",
      });
    }

    const vehicle = db.vehicles[vehicleIndex];

    if (vehicle.status === VehicleStatus.ON_TRIP) {
      return res.status(409).json({
        error:
          "Complete or cancel the active trip before editing this vehicle.",
      });
    }

    const body = req.body ?? {};

    if (
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        error: "A valid vehicle payload is required.",
      });
    }

    if (hasOwnProperty(body, "status")) {
      return res.status(400).json({
        error:
          "Vehicle status cannot be edited directly. Use trip, maintenance, or retirement workflows.",
      });
    }

    const editableFields = [
      "registration_number",
      "vehicle_name",
      "model",
      "vehicle_type",
      "maximum_load_capacity",
      "odometer",
      "acquisition_cost",
      "region",
      "manufacture_year",
      "fuel_type",
    ] as const;

    const hasEditableField = editableFields.some(
      (field) => hasOwnProperty(body, field),
    );

    if (!hasEditableField) {
      return res.status(400).json({
        error: "No editable vehicle fields were supplied.",
      });
    }

    // Validate against a copy so a rejected request cannot partially mutate
    // the in-memory database before db.save() is called.
    const updatedVehicle: Vehicle = {
      ...vehicle,
    };

    if (hasOwnProperty(body, "registration_number")) {
      if (
        typeof body.registration_number !== "string"
      ) {
        return res.status(400).json({
          error:
            "Registration number must be a string.",
        });
      }

      const registrationNumber =
        normalizeVehicleRegistration(
          body.registration_number,
        );

      if (
        !VEHICLE_REGISTRATION_PATTERN.test(
          registrationNumber,
        )
      ) {
        return res.status(400).json({
          error:
            "Registration number must contain 4–20 letters, numbers, or hyphens.",
        });
      }

      const duplicateVehicle = db.vehicles.find(
        (candidate) =>
          candidate.id !== vehicle.id &&
          normalizeVehicleRegistration(
            candidate.registration_number,
          ) === registrationNumber,
      );

      if (duplicateVehicle) {
        return res.status(409).json({
          error:
            "Vehicle registration number already exists.",
        });
      }

      updatedVehicle.registration_number =
        registrationNumber;
    }

    if (hasOwnProperty(body, "vehicle_name")) {
      if (typeof body.vehicle_name !== "string") {
        return res.status(400).json({
          error: "Vehicle name must be a string.",
        });
      }

      const vehicleName = normalizeVehicleText(
        body.vehicle_name,
      );

      if (
        vehicleName.length < 2 ||
        vehicleName.length > 80
      ) {
        return res.status(400).json({
          error:
            "Vehicle name must contain between 2 and 80 characters.",
        });
      }

      updatedVehicle.vehicle_name = vehicleName;
    }

    if (hasOwnProperty(body, "model")) {
      if (typeof body.model !== "string") {
        return res.status(400).json({
          error: "Model must be a string.",
        });
      }

      const model = normalizeVehicleText(body.model);

      if (model.length < 2 || model.length > 80) {
        return res.status(400).json({
          error:
            "Model must contain between 2 and 80 characters.",
        });
      }

      updatedVehicle.model = model;
    }

    if (hasOwnProperty(body, "region")) {
      if (typeof body.region !== "string") {
        return res.status(400).json({
          error: "Region must be a string.",
        });
      }

      const region = normalizeVehicleText(body.region);

      if (region.length < 2 || region.length > 80) {
        return res.status(400).json({
          error:
            "Region must contain between 2 and 80 characters.",
        });
      }

      updatedVehicle.region = region;
    }

    if (hasOwnProperty(body, "vehicle_type")) {
      if (!isVehicleType(body.vehicle_type)) {
        return res.status(400).json({
          error: "A valid vehicle type is required.",
        });
      }

      updatedVehicle.vehicle_type = body.vehicle_type;
    }

    if (hasOwnProperty(body, "fuel_type")) {
      if (!isFuelType(body.fuel_type)) {
        return res.status(400).json({
          error: "A valid fuel type is required.",
        });
      }

      updatedVehicle.fuel_type = body.fuel_type;
    }

    if (
      hasOwnProperty(
        body,
        "maximum_load_capacity",
      )
    ) {
      const maximumLoadCapacity =
        parseFiniteNumber(
          body.maximum_load_capacity,
        );

      if (
        maximumLoadCapacity === null ||
        maximumLoadCapacity <= 0
      ) {
        return res.status(400).json({
          error:
            "Maximum load capacity must be greater than zero.",
        });
      }

      updatedVehicle.maximum_load_capacity =
        maximumLoadCapacity;
    }

    if (hasOwnProperty(body, "odometer")) {
      const odometer = parseFiniteNumber(
        body.odometer,
      );

      if (odometer === null || odometer < 0) {
        return res.status(400).json({
          error: "Odometer must be zero or greater.",
        });
      }

      if (odometer < vehicle.odometer) {
        return res.status(409).json({
          error: `Odometer cannot be reduced below the current reading of ${vehicle.odometer}.`,
        });
      }

      updatedVehicle.odometer = odometer;
    }

    if (
      hasOwnProperty(body, "acquisition_cost")
    ) {
      const acquisitionCost = parseFiniteNumber(
        body.acquisition_cost,
      );

      if (
        acquisitionCost === null ||
        acquisitionCost < 0
      ) {
        return res.status(400).json({
          error:
            "Acquisition cost must be zero or greater.",
        });
      }

      updatedVehicle.acquisition_cost = acquisitionCost;
    }

    if (
      hasOwnProperty(body, "manufacture_year")
    ) {
      const manufactureYear = parseFiniteNumber(
        body.manufacture_year,
      );
      const maximumManufactureYear =
        new Date().getFullYear() + 1;

      if (
        manufactureYear === null ||
        !Number.isInteger(manufactureYear) ||
        manufactureYear < MIN_MANUFACTURE_YEAR ||
        manufactureYear > maximumManufactureYear
      ) {
        return res.status(400).json({
          error: `Manufacture year must be between ${MIN_MANUFACTURE_YEAR} and ${maximumManufactureYear}.`,
        });
      }

      updatedVehicle.manufacture_year = manufactureYear;
    }

    updatedVehicle.updated_at =
      new Date().toISOString();
    db.vehicles[vehicleIndex] = updatedVehicle;

    try {
      db.save();
    } catch (error) {
      db.vehicles[vehicleIndex] = vehicle;
      throw error;
    }

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Updated vehicle ${updatedVehicle.vehicle_name} (${updatedVehicle.registration_number})`,
      "VEHICLE",
      updatedVehicle.id,
    );

    return res.json(updatedVehicle);
  },
);

apiRouter.patch(
  "/vehicles/:id/retire",
  authenticateJWT,
  requireRole([
    UserRole.ADMIN,
    UserRole.FLEET_MANAGER,
  ]),
  (req: AuthenticatedRequest, res) => {
    const vehicle = db.vehicles.find(
      (candidate) =>
        candidate.id === req.params.id,
    );

    if (!vehicle) {
      return res.status(404).json({
        error: "Vehicle not found.",
      });
    }

    if (vehicle.status === VehicleStatus.RETIRED) {
      return res.json(vehicle);
    }

    const hasActiveTrip = db.trips.some(
      (trip) =>
        trip.vehicle_id === vehicle.id &&
        trip.status === TripStatus.DISPATCHED,
    );
    const hasActiveMaintenance =
      db.maintenance_logs.some(
        (log) =>
          log.vehicle_id === vehicle.id &&
          [
            MaintenanceStatus.OPEN,
            MaintenanceStatus.IN_PROGRESS,
          ].includes(log.status),
      );

    if (
      vehicle.status === VehicleStatus.ON_TRIP ||
      hasActiveTrip
    ) {
      return res.status(409).json({
        error:
          "A vehicle on an active trip cannot be retired.",
      });
    }

    if (
      vehicle.status === VehicleStatus.IN_SHOP ||
      hasActiveMaintenance
    ) {
      return res.status(409).json({
        error:
          "Complete or cancel active maintenance before retiring this vehicle.",
      });
    }

    const oldStatus = vehicle.status;
    vehicle.status = VehicleStatus.RETIRED;
    vehicle.updated_at = new Date().toISOString();
    db.save();

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Retired vehicle ${vehicle.vehicle_name} (${vehicle.registration_number})`,
      "VEHICLE",
      vehicle.id,
      oldStatus,
      VehicleStatus.RETIRED,
    );

    return res.json(vehicle);
  },
);

apiRouter.delete(
  "/vehicles/:id",
  authenticateJWT,
  requireRole([UserRole.ADMIN]),
  (req: AuthenticatedRequest, res) => {
    const index = db.vehicles.findIndex(
      (vehicle) => vehicle.id === req.params.id,
    );

    if (index === -1) {
      return res.status(404).json({
        error: "Vehicle not found.",
      });
    }

    const vehicle = db.vehicles[index];

    if (
      vehicle.status === VehicleStatus.ON_TRIP ||
      vehicle.status === VehicleStatus.IN_SHOP
    ) {
      return res.status(409).json({
        error:
          "A vehicle that is on a trip or in maintenance cannot be deleted.",
      });
    }

    const references = {
      trips: db.trips.filter(
        (trip) => trip.vehicle_id === vehicle.id,
      ).length,
      maintenance: db.maintenance_logs.filter(
        (log) => log.vehicle_id === vehicle.id,
      ).length,
      fuel_logs: db.fuel_logs.filter(
        (fuelLog) =>
          fuelLog.vehicle_id === vehicle.id,
      ).length,
      expenses: db.expenses.filter(
        (expense) =>
          expense.vehicle_id === vehicle.id,
      ).length,
    };

    const referenceCount = Object.values(
      references,
    ).reduce((sum, count) => sum + count, 0);

    if (referenceCount > 0) {
      return res.status(409).json({
        error:
          "This vehicle has operational history and cannot be deleted. Retire it instead.",
        references,
      });
    }

    db.vehicles.splice(index, 1);

    try {
      db.save();
    } catch (error) {
      db.vehicles.splice(index, 0, vehicle);
      throw error;
    }

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Deleted vehicle ${vehicle.vehicle_name} (${vehicle.registration_number})`,
      "VEHICLE",
      vehicle.id,
    );

    return res.json({
      success: true,
    });
  },
);

// ============================================================================
// 4. DRIVER MODULE ENDPOINTS
// ============================================================================

type DriverSortField =
  | "created_at"
  | "full_name"
  | "licence_number"
  | "licence_expiry_date"
  | "safety_score"
  | "region"
  | "status";

type LicenceState =
  | "VALID"
  | "EXPIRING_SOON"
  | "EXPIRED";

const DRIVER_SORT_FIELDS = new Set<DriverSortField>([
  "created_at",
  "full_name",
  "licence_number",
  "licence_expiry_date",
  "safety_score",
  "region",
  "status",
]);

const DRIVER_PROFILE_WRITE_ROLES = [
  UserRole.ADMIN,
  UserRole.DISPATCHER,
  UserRole.SAFETY_OFFICER,
];

const DRIVER_SANCTION_ROLES = [
  UserRole.ADMIN,
  UserRole.SAFETY_OFFICER,
];

const DRIVER_LICENCE_PATTERN =
  /^[A-Z0-9/-]{4,30}$/;
const DRIVER_CONTACT_PATTERN =
  /^[0-9+()\- ]{7,20}$/;

function normalizeDriverText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeDriverLicence(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function isDriverStatus(
  value: unknown,
): value is DriverStatus {
  return (
    typeof value === "string" &&
    Object.values(DriverStatus).includes(
      value as DriverStatus,
    )
  );
}

function isIsoDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
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

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function getLicenceLimitDate(): string {
  const limit = new Date();
  limit.setUTCDate(limit.getUTCDate() + 30);
  return limit.toISOString().split("T")[0];
}

function getDriverLicenceState(
  expiryDate: string,
): LicenceState {
  if (expiryDate < getTodayDate()) {
    return "EXPIRED";
  }

  if (expiryDate <= getLicenceLimitDate()) {
    return "EXPIRING_SOON";
  }

  return "VALID";
}

function compareDriverValues(
  first: Driver,
  second: Driver,
  field: DriverSortField,
  order: 1 | -1,
): number {
  const firstValue = first[field];
  const secondValue = second[field];

  if (
    typeof firstValue === "number" &&
    typeof secondValue === "number"
  ) {
    return (firstValue - secondValue) * order;
  }

  return (
    String(firstValue).localeCompare(
      String(secondValue),
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    ) * order
  );
}

function serializeDriverProfile(driver: Driver) {
  const linkedUser = driver.user_id
    ? db.users.find(
        (user) => user.id === driver.user_id,
      )
    : undefined;

  return {
    ...driver,
    licence_status: getDriverLicenceState(
      driver.licence_expiry_date,
    ),
    linked_user: linkedUser
      ? {
          id: linkedUser.id,
          full_name: linkedUser.full_name,
          email: linkedUser.email,
          is_active: linkedUser.is_active,
        }
      : null,
  };
}

function validateDriverUserLink(
  requestedUserId: unknown,
  currentDriverId?: string,
):
  | { userId: string | undefined }
  | { error: string; status: number } {
  if (
    requestedUserId === null ||
    requestedUserId === undefined ||
    requestedUserId === ""
  ) {
    return { userId: undefined };
  }

  if (typeof requestedUserId !== "string") {
    return {
      error: "Linked user ID must be a string or null.",
      status: 400,
    };
  }

  const user = db.users.find(
    (candidate) => candidate.id === requestedUserId,
  );

  if (!user) {
    return {
      error: "Selected driver login account was not found.",
      status: 400,
    };
  }

  if (!user.is_active) {
    return {
      error: "A disabled account cannot be linked to a driver profile.",
      status: 409,
    };
  }

  if (user.role !== UserRole.DRIVER) {
    return {
      error: "Only accounts with the Driver role can be linked.",
      status: 409,
    };
  }

  const existingLink = db.drivers.find(
    (driver) =>
      driver.id !== currentDriverId &&
      driver.user_id === user.id,
  );

  if (existingLink) {
    return {
      error: "This login account is already linked to another driver profile.",
      status: 409,
    };
  }

  return { userId: user.id };
}

apiRouter.get(
  "/drivers/available",
  authenticateJWT,
  requireRole(DRIVER_READ_ROLES),
  (_req, res) => {
    const result = db.drivers
      .filter(
        (driver) =>
          driver.status ===
            DriverStatus.AVAILABLE &&
          getDriverLicenceState(
            driver.licence_expiry_date,
          ) !== "EXPIRED",
      )
      .sort((first, second) =>
        first.full_name.localeCompare(
          second.full_name,
          undefined,
          { sensitivity: "base" },
        ),
      );

    return res.json(result);
  },
);

apiRouter.get(
  "/drivers/linkable-users",
  authenticateJWT,
  requireRole([UserRole.ADMIN]),
  (req, res) => {
    const includeUserId = getSingleQueryValue(
      req.query.include_user_id,
    );
    const linkedUserIds = new Set(
      db.drivers
        .map((driver) => driver.user_id)
        .filter((userId): userId is string =>
          Boolean(userId),
        ),
    );

    const users = db.users
      .filter(
        (user) =>
          user.role === UserRole.DRIVER &&
          user.is_active &&
          (!linkedUserIds.has(user.id) ||
            user.id === includeUserId),
      )
      .map((user) => ({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        is_active: user.is_active,
      }))
      .sort((first, second) =>
        first.full_name.localeCompare(
          second.full_name,
          undefined,
          { sensitivity: "base" },
        ),
      );

    return res.json(users);
  },
);

apiRouter.get(
  "/drivers",
  authenticateJWT,
  requireRole(DRIVER_READ_ROLES),
  (req, res) => {
    const search = getSingleQueryValue(
      req.query.search,
    ).toLowerCase();
    const status = getSingleQueryValue(
      req.query.status,
    );
    const licenceStatus = getSingleQueryValue(
      req.query.licence_status,
    );
    const region = getSingleQueryValue(
      req.query.region,
    ).toLowerCase();
    const requestedSortField =
      getSingleQueryValue(req.query.sort_by) ||
      "created_at";
    const requestedSortOrder =
      getSingleQueryValue(req.query.sort_order) ||
      "desc";

    if (status && !isDriverStatus(status)) {
      return res.status(400).json({
        error: "Invalid driver status filter.",
      });
    }

    if (
      licenceStatus &&
      ![
        "VALID",
        "EXPIRING_SOON",
        "EXPIRED",
      ].includes(licenceStatus)
    ) {
      return res.status(400).json({
        error: "Invalid licence status filter.",
      });
    }

    if (
      !DRIVER_SORT_FIELDS.has(
        requestedSortField as DriverSortField,
      )
    ) {
      return res.status(400).json({
        error: "Invalid driver sort field.",
      });
    }

    if (
      requestedSortOrder !== "asc" &&
      requestedSortOrder !== "desc"
    ) {
      return res.status(400).json({
        error: "Driver sort order must be asc or desc.",
      });
    }

    let list = [...db.drivers];

    if (search) {
      list = list.filter((driver) =>
        [
          driver.full_name,
          driver.licence_number,
          driver.contact_number,
          driver.licence_category,
          driver.region,
        ].some((value) =>
          value.toLowerCase().includes(search),
        ),
      );
    }

    if (status) {
      list = list.filter(
        (driver) => driver.status === status,
      );
    }

    if (licenceStatus) {
      list = list.filter(
        (driver) =>
          getDriverLicenceState(
            driver.licence_expiry_date,
          ) === licenceStatus,
      );
    }

    if (region) {
      list = list.filter((driver) =>
        driver.region.toLowerCase().includes(region),
      );
    }

    const sortField =
      requestedSortField as DriverSortField;
    const sortOrder: 1 | -1 =
      requestedSortOrder === "asc" ? 1 : -1;

    list.sort((first, second) =>
      compareDriverValues(
        first,
        second,
        sortField,
        sortOrder,
      ),
    );

    const pageSize = parsePositiveInteger(
      req.query.page_size,
      15,
      100,
    );
    const requestedPage = parsePositiveInteger(
      req.query.page,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const total = list.length;
    const totalPages = Math.max(
      1,
      Math.ceil(total / pageSize),
    );
    const page = Math.min(
      requestedPage,
      totalPages,
    );
    const startIndex = (page - 1) * pageSize;
    const data = list.slice(
      startIndex,
      startIndex + pageSize,
    );

    return res.json({
      data,
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
    });
  },
);

apiRouter.get(
  "/drivers/:id/history",
  authenticateJWT,
  requireRole(DRIVER_READ_ROLES),
  (req, res) => {
    const driver = db.drivers.find(
      (candidate) =>
        candidate.id === req.params.id,
    );

    if (!driver) {
      return res.status(404).json({
        error: "Driver not found.",
      });
    }

    const trips = db.trips
      .filter(
        (trip) => trip.driver_id === driver.id,
      )
      .sort((first, second) =>
        second.created_at.localeCompare(
          first.created_at,
        ),
      )
      .map((trip) => {
        const vehicle = db.vehicles.find(
          (candidate) =>
            candidate.id === trip.vehicle_id,
        );

        return {
          ...trip,
          vehicle_name:
            vehicle?.vehicle_name ??
            "Unknown Vehicle",
          vehicle_registration:
            vehicle?.registration_number ?? "N/A",
        };
      });

    const completedTrips = trips.filter(
      (trip) =>
        trip.status === TripStatus.COMPLETED,
    );

    return res.json({
      trips,
      summary: {
        total_trips: trips.length,
        active_trips: trips.filter(
          (trip) =>
            trip.status === TripStatus.DISPATCHED,
        ).length,
        completed_trips: completedTrips.length,
        cancelled_trips: trips.filter(
          (trip) =>
            trip.status === TripStatus.CANCELLED,
        ).length,
        total_distance: completedTrips.reduce(
          (sum, trip) =>
            sum + (trip.actual_distance ?? 0),
          0,
        ),
      },
    });
  },
);

apiRouter.get(
  "/drivers/:id",
  authenticateJWT,
  requireRole(DRIVER_READ_ROLES),
  (req, res) => {
    const driver = db.drivers.find(
      (candidate) =>
        candidate.id === req.params.id,
    );

    if (!driver) {
      return res.status(404).json({
        error: "Driver not found.",
      });
    }

    return res.json(serializeDriverProfile(driver));
  },
);

apiRouter.post(
  "/drivers",
  authenticateJWT,
  requireRole(DRIVER_PROFILE_WRITE_ROLES),
  (req: AuthenticatedRequest, res) => {
    const body = req.body ?? {};

    if (
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        error: "A valid driver payload is required.",
      });
    }

    const fullName =
      typeof body.full_name === "string"
        ? normalizeDriverText(body.full_name)
        : "";
    const licenceNumber =
      typeof body.licence_number === "string"
        ? normalizeDriverLicence(
            body.licence_number,
          )
        : "";
    const licenceCategory =
      typeof body.licence_category === "string"
        ? normalizeDriverText(
            body.licence_category,
          )
        : "";
    const contactNumber =
      typeof body.contact_number === "string"
        ? normalizeDriverText(
            body.contact_number,
          )
        : "";
    const region =
      typeof body.region === "string"
        ? normalizeDriverText(body.region)
        : "";
    const safetyScore =
      body.safety_score === undefined
        ? 100
        : parseFiniteNumber(body.safety_score);
    const requestedStatus =
      body.status === undefined
        ? DriverStatus.AVAILABLE
        : body.status;

    if (
      fullName.length < 2 ||
      fullName.length > 80
    ) {
      return res.status(400).json({
        error: "Driver name must contain between 2 and 80 characters.",
      });
    }

    if (
      !DRIVER_LICENCE_PATTERN.test(
        licenceNumber,
      )
    ) {
      return res.status(400).json({
        error: "Licence number must contain 4–30 letters, numbers, slashes, or hyphens.",
      });
    }

    if (
      licenceCategory.length < 2 ||
      licenceCategory.length > 60
    ) {
      return res.status(400).json({
        error: "Licence category must contain between 2 and 60 characters.",
      });
    }

    if (!isIsoDate(body.licence_expiry_date)) {
      return res.status(400).json({
        error: "A valid licence expiry date is required.",
      });
    }

    if (
      !DRIVER_CONTACT_PATTERN.test(contactNumber)
    ) {
      return res.status(400).json({
        error: "Contact number must contain 7–20 valid phone characters.",
      });
    }

    if (
      safetyScore === null ||
      safetyScore < 0 ||
      safetyScore > 100
    ) {
      return res.status(400).json({
        error: "Safety score must be between 0 and 100.",
      });
    }

    if (
      region.length < 2 ||
      region.length > 80
    ) {
      return res.status(400).json({
        error: "Region must contain between 2 and 80 characters.",
      });
    }

    if (
      requestedStatus !== DriverStatus.AVAILABLE &&
      requestedStatus !== DriverStatus.OFF_DUTY
    ) {
      return res.status(400).json({
        error: "New drivers can only start as Available or Off Duty.",
      });
    }

    if (
      requestedStatus === DriverStatus.AVAILABLE &&
      getDriverLicenceState(
        body.licence_expiry_date,
      ) === "EXPIRED"
    ) {
      return res.status(409).json({
        error: "An expired licence cannot be marked Available.",
      });
    }

    const duplicateDriver = db.drivers.find(
      (driver) =>
        normalizeDriverLicence(
          driver.licence_number,
        ) === licenceNumber,
    );

    if (duplicateDriver) {
      return res.status(409).json({
        error: "Licence number already exists.",
      });
    }

    let linkedUserId: string | undefined;

    if (hasOwnProperty(body, "user_id")) {
      if (req.user?.role !== UserRole.ADMIN) {
        return res.status(403).json({
          error: "Only an administrator can link driver login accounts.",
        });
      }

      const linkResult = validateDriverUserLink(
        body.user_id,
      );

      if ("error" in linkResult) {
        return res
          .status(linkResult.status)
          .json({ error: linkResult.error });
      }

      linkedUserId = linkResult.userId;
    }

    const now = new Date().toISOString();
    const newDriver: Driver = {
      id: db.generateId("dr"),
      user_id: linkedUserId,
      full_name: fullName,
      licence_number: licenceNumber,
      licence_category: licenceCategory,
      licence_expiry_date:
        body.licence_expiry_date,
      contact_number: contactNumber,
      safety_score: safetyScore,
      region,
      status: requestedStatus,
      created_at: now,
      updated_at: now,
    };

    db.drivers.push(newDriver);

    try {
      db.save();
    } catch (error) {
      const index = db.drivers.findIndex(
        (driver) => driver.id === newDriver.id,
      );
      if (index >= 0) db.drivers.splice(index, 1);
      throw error;
    }

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Registered driver ${newDriver.full_name} (${newDriver.licence_number})`,
      "DRIVER",
      newDriver.id,
    );

    return res
      .status(201)
      .json(serializeDriverProfile(newDriver));
  },
);

apiRouter.put(
  "/drivers/:id",
  authenticateJWT,
  requireRole(DRIVER_PROFILE_WRITE_ROLES),
  (req: AuthenticatedRequest, res) => {
    const driverIndex = db.drivers.findIndex(
      (candidate) =>
        candidate.id === req.params.id,
    );

    if (driverIndex === -1) {
      return res.status(404).json({
        error: "Driver not found.",
      });
    }

    const driver = db.drivers[driverIndex];

    if (driver.status === DriverStatus.ON_TRIP) {
      return res.status(409).json({
        error: "Complete or cancel the active trip before editing this driver.",
      });
    }

    const body = req.body ?? {};

    if (
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        error: "A valid driver payload is required.",
      });
    }

    const editableFields = [
      "full_name",
      "licence_number",
      "licence_category",
      "licence_expiry_date",
      "contact_number",
      "safety_score",
      "region",
      "status",
      "user_id",
    ] as const;

    if (
      !editableFields.some((field) =>
        hasOwnProperty(body, field),
      )
    ) {
      return res.status(400).json({
        error: "No editable driver fields were supplied.",
      });
    }

    const updatedDriver: Driver = { ...driver };

    if (hasOwnProperty(body, "full_name")) {
      if (typeof body.full_name !== "string") {
        return res.status(400).json({
          error: "Driver name must be a string.",
        });
      }
      const fullName = normalizeDriverText(
        body.full_name,
      );
      if (
        fullName.length < 2 ||
        fullName.length > 80
      ) {
        return res.status(400).json({
          error: "Driver name must contain between 2 and 80 characters.",
        });
      }
      updatedDriver.full_name = fullName;
    }

    if (hasOwnProperty(body, "licence_number")) {
      if (
        typeof body.licence_number !== "string"
      ) {
        return res.status(400).json({
          error: "Licence number must be a string.",
        });
      }
      const licenceNumber =
        normalizeDriverLicence(
          body.licence_number,
        );
      if (
        !DRIVER_LICENCE_PATTERN.test(
          licenceNumber,
        )
      ) {
        return res.status(400).json({
          error: "Licence number must contain 4–30 letters, numbers, slashes, or hyphens.",
        });
      }
      const duplicateDriver = db.drivers.find(
        (candidate) =>
          candidate.id !== driver.id &&
          normalizeDriverLicence(
            candidate.licence_number,
          ) === licenceNumber,
      );
      if (duplicateDriver) {
        return res.status(409).json({
          error: "Licence number already exists.",
        });
      }
      updatedDriver.licence_number = licenceNumber;
    }

    if (
      hasOwnProperty(body, "licence_category")
    ) {
      if (
        typeof body.licence_category !== "string"
      ) {
        return res.status(400).json({
          error: "Licence category must be a string.",
        });
      }
      const category = normalizeDriverText(
        body.licence_category,
      );
      if (
        category.length < 2 ||
        category.length > 60
      ) {
        return res.status(400).json({
          error: "Licence category must contain between 2 and 60 characters.",
        });
      }
      updatedDriver.licence_category = category;
    }

    if (
      hasOwnProperty(
        body,
        "licence_expiry_date",
      )
    ) {
      if (!isIsoDate(body.licence_expiry_date)) {
        return res.status(400).json({
          error: "A valid licence expiry date is required.",
        });
      }
      updatedDriver.licence_expiry_date =
        body.licence_expiry_date;
    }

    if (hasOwnProperty(body, "contact_number")) {
      if (
        typeof body.contact_number !== "string"
      ) {
        return res.status(400).json({
          error: "Contact number must be a string.",
        });
      }
      const contact = normalizeDriverText(
        body.contact_number,
      );
      if (!DRIVER_CONTACT_PATTERN.test(contact)) {
        return res.status(400).json({
          error: "Contact number must contain 7–20 valid phone characters.",
        });
      }
      updatedDriver.contact_number = contact;
    }

    if (hasOwnProperty(body, "safety_score")) {
      const score = parseFiniteNumber(
        body.safety_score,
      );
      if (
        score === null ||
        score < 0 ||
        score > 100
      ) {
        return res.status(400).json({
          error: "Safety score must be between 0 and 100.",
        });
      }
      updatedDriver.safety_score = score;
    }

    if (hasOwnProperty(body, "region")) {
      if (typeof body.region !== "string") {
        return res.status(400).json({
          error: "Region must be a string.",
        });
      }
      const region = normalizeDriverText(body.region);
      if (
        region.length < 2 ||
        region.length > 80
      ) {
        return res.status(400).json({
          error: "Region must contain between 2 and 80 characters.",
        });
      }
      updatedDriver.region = region;
    }

    if (hasOwnProperty(body, "status")) {
      if (driver.status === DriverStatus.SUSPENDED) {
        return res.status(409).json({
          error: "Use the activation workflow before changing a suspended driver's status.",
        });
      }

      if (
        body.status !== DriverStatus.AVAILABLE &&
        body.status !== DriverStatus.OFF_DUTY
      ) {
        return res.status(400).json({
          error: "Driver status can only be edited to Available or Off Duty. Use trip or suspension workflows for other statuses.",
        });
      }
      updatedDriver.status = body.status;
    }

    if (hasOwnProperty(body, "user_id")) {
      if (req.user?.role !== UserRole.ADMIN) {
        return res.status(403).json({
          error: "Only an administrator can link driver login accounts.",
        });
      }

      const linkResult = validateDriverUserLink(
        body.user_id,
        driver.id,
      );

      if ("error" in linkResult) {
        return res
          .status(linkResult.status)
          .json({ error: linkResult.error });
      }

      updatedDriver.user_id = linkResult.userId;
    }

    if (
      updatedDriver.status ===
        DriverStatus.AVAILABLE &&
      getDriverLicenceState(
        updatedDriver.licence_expiry_date,
      ) === "EXPIRED"
    ) {
      return res.status(409).json({
        error: "An expired licence cannot be marked Available. Renew the licence or set the driver Off Duty.",
      });
    }

    updatedDriver.updated_at =
      new Date().toISOString();
    db.drivers[driverIndex] = updatedDriver;

    try {
      db.save();
    } catch (error) {
      db.drivers[driverIndex] = driver;
      throw error;
    }

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Updated driver profile for ${updatedDriver.full_name}`,
      "DRIVER",
      updatedDriver.id,
    );

    return res.json(
      serializeDriverProfile(updatedDriver),
    );
  },
);

apiRouter.patch(
  "/drivers/:id/suspend",
  authenticateJWT,
  requireRole(DRIVER_SANCTION_ROLES),
  (req: AuthenticatedRequest, res) => {
    const driver = db.drivers.find(
      (candidate) =>
        candidate.id === req.params.id,
    );

    if (!driver) {
      return res.status(404).json({
        error: "Driver not found.",
      });
    }

    const hasActiveTrip = db.trips.some(
      (trip) =>
        trip.driver_id === driver.id &&
        trip.status === TripStatus.DISPATCHED,
    );

    if (
      driver.status === DriverStatus.ON_TRIP ||
      hasActiveTrip
    ) {
      return res.status(409).json({
        error: "A driver on an active trip cannot be suspended.",
      });
    }

    if (driver.status === DriverStatus.SUSPENDED) {
      return res.json(serializeDriverProfile(driver));
    }

    const oldStatus = driver.status;
    driver.status = DriverStatus.SUSPENDED;
    driver.updated_at = new Date().toISOString();
    db.save();

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Suspended driver ${driver.full_name}`,
      "DRIVER",
      driver.id,
      oldStatus,
      DriverStatus.SUSPENDED,
    );

    return res.json(serializeDriverProfile(driver));
  },
);

apiRouter.patch(
  "/drivers/:id/activate",
  authenticateJWT,
  requireRole(DRIVER_SANCTION_ROLES),
  (req: AuthenticatedRequest, res) => {
    const driver = db.drivers.find(
      (candidate) =>
        candidate.id === req.params.id,
    );

    if (!driver) {
      return res.status(404).json({
        error: "Driver not found.",
      });
    }

    if (driver.status !== DriverStatus.SUSPENDED) {
      return res.status(409).json({
        error: "Only a suspended driver can be activated through this workflow.",
      });
    }

    if (
      getDriverLicenceState(
        driver.licence_expiry_date,
      ) === "EXPIRED"
    ) {
      return res.status(409).json({
        error: "Renew the expired licence before activating this driver.",
      });
    }

    const oldStatus = driver.status;
    driver.status = DriverStatus.AVAILABLE;
    driver.updated_at = new Date().toISOString();
    db.save();

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Activated driver ${driver.full_name}`,
      "DRIVER",
      driver.id,
      oldStatus,
      DriverStatus.AVAILABLE,
    );

    return res.json(serializeDriverProfile(driver));
  },
);

apiRouter.delete(
  "/drivers/:id",
  authenticateJWT,
  requireRole([UserRole.ADMIN]),
  (req: AuthenticatedRequest, res) => {
    const index = db.drivers.findIndex(
      (driver) => driver.id === req.params.id,
    );

    if (index === -1) {
      return res.status(404).json({
        error: "Driver not found.",
      });
    }

    const driver = db.drivers[index];
    const activeTrip = db.trips.find(
      (trip) =>
        trip.driver_id === driver.id &&
        trip.status === TripStatus.DISPATCHED,
    );

    if (
      driver.status === DriverStatus.ON_TRIP ||
      activeTrip
    ) {
      return res.status(409).json({
        error: "A driver on an active trip cannot be deleted.",
      });
    }

    const tripHistoryCount = db.trips.filter(
      (trip) => trip.driver_id === driver.id,
    ).length;

    if (tripHistoryCount > 0) {
      return res.status(409).json({
        error: "This driver has trip history and cannot be deleted. Set the profile Off Duty or Suspended instead.",
        references: {
          trips: tripHistoryCount,
        },
      });
    }

    db.drivers.splice(index, 1);

    try {
      db.save();
    } catch (error) {
      db.drivers.splice(index, 0, driver);
      throw error;
    }

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Deleted driver ${driver.full_name} (${driver.licence_number})`,
      "DRIVER",
      driver.id,
    );

    return res.json({ success: true });
  },
);

// ============================================================================
// 5. TRIP MODULE ENDPOINTS
// ============================================================================

type TripSortField =
  | "created_at"
  | "trip_code"
  | "planned_start_time"
  | "planned_distance"
  | "cargo_weight"
  | "revenue"
  | "status";

const TRIP_SORT_FIELDS = new Set<TripSortField>([
  "created_at",
  "trip_code",
  "planned_start_time",
  "planned_distance",
  "cargo_weight",
  "revenue",
  "status",
]);

const TRIP_WRITE_ROLES = [
  UserRole.ADMIN,
  UserRole.DISPATCHER,
];

function normalizeTripText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isTripStatus(value: unknown): value is TripStatus {
  return (
    typeof value === "string" &&
    Object.values(TripStatus).includes(value as TripStatus)
  );
}

function compareTripValues(
  first: Trip,
  second: Trip,
  field: TripSortField,
  order: 1 | -1,
): number {
  const firstValue = first[field];
  const secondValue = second[field];

  if (
    typeof firstValue === "number" &&
    typeof secondValue === "number"
  ) {
    return (firstValue - secondValue) * order;
  }

  return (
    String(firstValue).localeCompare(
      String(secondValue),
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    ) * order
  );
}

function getDriverProfileForUser(userId: string): Driver | undefined {
  return db.drivers.find(
    (driver) => driver.user_id === userId,
  );
}

function canDriverAccessTrip(
  userId: string,
  trip: Trip,
): boolean {
  const driverProfile = getDriverProfileForUser(userId);
  return Boolean(
    driverProfile && trip.driver_id === driverProfile.id,
  );
}

function validateDraftTripResources(
  vehicle: Vehicle,
  driver: Driver,
  cargoWeight: number,
): string | null {
  if (vehicle.status !== VehicleStatus.AVAILABLE) {
    return `Vehicle ${vehicle.registration_number} is not available.`;
  }

  if (driver.status !== DriverStatus.AVAILABLE) {
    return `Driver ${driver.full_name} is not available.`;
  }

  const today = new Date().toISOString().slice(0, 10);
  if (driver.licence_expiry_date < today) {
    return `Driver licence expired on ${driver.licence_expiry_date}.`;
  }

  if (cargoWeight > vehicle.maximum_load_capacity) {
    return `Cargo weight of ${cargoWeight} kg exceeds vehicle capacity of ${vehicle.maximum_load_capacity} kg.`;
  }

  return null;
}

function serializeTrip(trip: Trip) {
  const vehicle = db.vehicles.find(
    (candidate) => candidate.id === trip.vehicle_id,
  );
  const driver = db.drivers.find(
    (candidate) => candidate.id === trip.driver_id,
  );
  const today = new Date().toISOString().slice(0, 10);

  return {
    ...trip,
    vehicle_name: vehicle?.vehicle_name ?? "Unknown Vehicle",
    vehicle_registration:
      vehicle?.registration_number ?? "Unknown",
    vehicle_capacity:
      vehicle?.maximum_load_capacity ?? 0,
    vehicle_odometer: vehicle?.odometer ?? 0,
    vehicle_status:
      vehicle?.status ?? VehicleStatus.RETIRED,
    driver_name: driver?.full_name ?? "Unknown Driver",
    driver_licence: driver?.licence_number ?? "Unknown",
    driver_licence_expiry:
      driver?.licence_expiry_date ?? "",
    driver_licence_valid: Boolean(
      driver && driver.licence_expiry_date >= today,
    ),
    driver_phone: driver?.contact_number ?? "",
    driver_score: driver?.safety_score ?? 0,
    driver_status:
      driver?.status ?? DriverStatus.SUSPENDED,
  };
}

apiRouter.get(
  "/trips",
  authenticateJWT,
  requireRole(TRIP_READ_ROLES),
  (req: AuthenticatedRequest, res) => {
    const search = getSingleQueryValue(
      req.query.search,
    ).toLowerCase();
    const status = getSingleQueryValue(
      req.query.status,
    );
    const vehicleId = getSingleQueryValue(
      req.query.vehicle_id,
    );
    const driverId = getSingleQueryValue(
      req.query.driver_id,
    );
    const requestedSortField =
      getSingleQueryValue(req.query.sort_by) ||
      "created_at";
    const requestedSortOrder =
      getSingleQueryValue(req.query.sort_order) ||
      "desc";

    if (status && !isTripStatus(status)) {
      return res.status(400).json({
        error: "Invalid trip status filter.",
      });
    }

    if (
      !TRIP_SORT_FIELDS.has(
        requestedSortField as TripSortField,
      )
    ) {
      return res.status(400).json({
        error: "Invalid trip sort field.",
      });
    }

    if (
      requestedSortOrder !== "asc" &&
      requestedSortOrder !== "desc"
    ) {
      return res.status(400).json({
        error: "Trip sort order must be asc or desc.",
      });
    }

    let list = [...db.trips];

    if (req.user?.role === UserRole.DRIVER) {
      const driverProfile = getDriverProfileForUser(
        req.user.id,
      );
      list = driverProfile
        ? list.filter(
            (trip) => trip.driver_id === driverProfile.id,
          )
        : [];
    }

    if (search) {
      list = list.filter((trip) =>
        [
          trip.trip_code,
          trip.source,
          trip.destination,
          trip.cargo_description,
        ].some((value) =>
          value.toLowerCase().includes(search),
        ),
      );
    }

    if (status) {
      list = list.filter(
        (trip) => trip.status === status,
      );
    }

    if (vehicleId) {
      list = list.filter(
        (trip) => trip.vehicle_id === vehicleId,
      );
    }

    if (driverId) {
      list = list.filter(
        (trip) => trip.driver_id === driverId,
      );
    }

    const sortField =
      requestedSortField as TripSortField;
    const sortOrder: 1 | -1 =
      requestedSortOrder === "asc" ? 1 : -1;

    list.sort((first, second) =>
      compareTripValues(
        first,
        second,
        sortField,
        sortOrder,
      ),
    );

    const pageSize = parsePositiveInteger(
      req.query.page_size,
      10,
      100,
    );
    const requestedPage = parsePositiveInteger(
      req.query.page,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const total = list.length;
    const totalPages = Math.max(
      1,
      Math.ceil(total / pageSize),
    );
    const page = Math.min(requestedPage, totalPages);
    const startIndex = (page - 1) * pageSize;
    const data = list
      .slice(startIndex, startIndex + pageSize)
      .map(serializeTrip);

    return res.json({
      data,
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
    });
  },
);

apiRouter.get(
  "/trips/:id",
  authenticateJWT,
  requireRole(TRIP_READ_ROLES),
  (req: AuthenticatedRequest, res) => {
    const trip = db.trips.find(
      (candidate) => candidate.id === req.params.id,
    );

    if (!trip) {
      return res.status(404).json({
        error: "Trip not found.",
      });
    }

    if (
      req.user?.role === UserRole.DRIVER &&
      !canDriverAccessTrip(req.user.id, trip)
    ) {
      return res.status(403).json({
        error:
          "You can only view trips assigned to your driver profile.",
      });
    }

    return res.json(serializeTrip(trip));
  },
);

apiRouter.post(
  "/trips",
  authenticateJWT,
  requireRole(TRIP_WRITE_ROLES),
  (req: AuthenticatedRequest, res) => {
    const body = req.body ?? {};

    if (
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        error: "A valid trip payload is required.",
      });
    }

    const source =
      typeof body.source === "string"
        ? normalizeTripText(body.source)
        : "";
    const destination =
      typeof body.destination === "string"
        ? normalizeTripText(body.destination)
        : "";
    const cargoDescription =
      typeof body.cargo_description === "string"
        ? normalizeTripText(body.cargo_description)
        : "";
    const notes =
      typeof body.notes === "string"
        ? body.notes.trim()
        : undefined;
    const vehicleId =
      typeof body.vehicle_id === "string"
        ? body.vehicle_id.trim()
        : "";
    const driverId =
      typeof body.driver_id === "string"
        ? body.driver_id.trim()
        : "";
    const cargoWeight = parseFiniteNumber(
      body.cargo_weight,
    );
    const plannedDistance = parseFiniteNumber(
      body.planned_distance,
    );
    const revenue =
      body.revenue === undefined
        ? 0
        : parseFiniteNumber(body.revenue);
    const plannedStartTime =
      typeof body.planned_start_time === "string"
        ? body.planned_start_time.trim()
        : "";
    const plannedStartDate = new Date(
      plannedStartTime,
    );

    if (source.length < 2 || source.length > 120) {
      return res.status(400).json({
        error:
          "Source must contain between 2 and 120 characters.",
      });
    }

    if (
      destination.length < 2 ||
      destination.length > 120
    ) {
      return res.status(400).json({
        error:
          "Destination must contain between 2 and 120 characters.",
      });
    }

    if (source.toLowerCase() === destination.toLowerCase()) {
      return res.status(400).json({
        error: "Source and destination must be different.",
      });
    }

    if (
      cargoDescription.length < 2 ||
      cargoDescription.length > 240
    ) {
      return res.status(400).json({
        error:
          "Cargo description must contain between 2 and 240 characters.",
      });
    }

    if (cargoWeight === null || cargoWeight <= 0) {
      return res.status(400).json({
        error: "Cargo weight must be greater than zero.",
      });
    }

    if (
      plannedDistance === null ||
      plannedDistance <= 0
    ) {
      return res.status(400).json({
        error:
          "Planned distance must be greater than zero.",
      });
    }

    if (revenue === null || revenue < 0) {
      return res.status(400).json({
        error: "Revenue must be zero or greater.",
      });
    }

    if (Number.isNaN(plannedStartDate.getTime())) {
      return res.status(400).json({
        error: "A valid planned departure time is required.",
      });
    }

    if (notes && notes.length > 1000) {
      return res.status(400).json({
        error: "Notes cannot exceed 1000 characters.",
      });
    }

    const vehicle = db.vehicles.find(
      (candidate) => candidate.id === vehicleId,
    );
    const driver = db.drivers.find(
      (candidate) => candidate.id === driverId,
    );

    if (!vehicle) {
      return res.status(400).json({
        error: "Selected vehicle does not exist.",
      });
    }

    if (!driver) {
      return res.status(400).json({
        error: "Selected driver does not exist.",
      });
    }

    const resourceError = validateDraftTripResources(
      vehicle,
      driver,
      cargoWeight,
    );

    if (resourceError) {
      return res.status(409).json({
        error: resourceError,
      });
    }

    const now = new Date().toISOString();
    const trip: Trip = {
      id: db.generateId("tr"),
      trip_code: OperationsService.generateTripCode(),
      source,
      destination,
      vehicle_id: vehicle.id,
      driver_id: driver.id,
      cargo_description: cargoDescription,
      cargo_weight: cargoWeight,
      planned_distance: plannedDistance,
      planned_start_time:
        plannedStartDate.toISOString(),
      revenue,
      notes,
      status: TripStatus.DRAFT,
      created_by: req.user!.id,
      created_at: now,
      updated_at: now,
    };

    db.trips.push(trip);

    try {
      db.save();
    } catch (error) {
      const index = db.trips.findIndex(
        (candidate) => candidate.id === trip.id,
      );
      if (index >= 0) {
        db.trips.splice(index, 1);
      }
      throw error;
    }

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Created draft trip ${trip.trip_code}`,
      "TRIP",
      trip.id,
    );

    return res.status(201).json(
      serializeTrip(trip),
    );
  },
);

apiRouter.put(
  "/trips/:id",
  authenticateJWT,
  requireRole(TRIP_WRITE_ROLES),
  (req: AuthenticatedRequest, res) => {
    const tripIndex = db.trips.findIndex(
      (candidate) => candidate.id === req.params.id,
    );

    if (tripIndex === -1) {
      return res.status(404).json({
        error: "Trip not found.",
      });
    }

    const currentTrip = db.trips[tripIndex];

    if (currentTrip.status !== TripStatus.DRAFT) {
      return res.status(409).json({
        error: "Only draft trips can be edited.",
      });
    }

    const body = req.body ?? {};
    if (
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        error: "A valid trip payload is required.",
      });
    }

    if (hasOwnProperty(body, "status")) {
      return res.status(400).json({
        error:
          "Trip status is controlled by dispatch, completion, and cancellation workflows.",
      });
    }

    const updatedTrip: Trip = {
      ...currentTrip,
    };

    if (hasOwnProperty(body, "source")) {
      if (typeof body.source !== "string") {
        return res.status(400).json({
          error: "Source must be a string.",
        });
      }
      updatedTrip.source = normalizeTripText(body.source);
    }

    if (hasOwnProperty(body, "destination")) {
      if (typeof body.destination !== "string") {
        return res.status(400).json({
          error: "Destination must be a string.",
        });
      }
      updatedTrip.destination = normalizeTripText(
        body.destination,
      );
    }

    if (hasOwnProperty(body, "vehicle_id")) {
      if (typeof body.vehicle_id !== "string") {
        return res.status(400).json({
          error: "Vehicle ID must be a string.",
        });
      }
      updatedTrip.vehicle_id = body.vehicle_id.trim();
    }

    if (hasOwnProperty(body, "driver_id")) {
      if (typeof body.driver_id !== "string") {
        return res.status(400).json({
          error: "Driver ID must be a string.",
        });
      }
      updatedTrip.driver_id = body.driver_id.trim();
    }

    if (hasOwnProperty(body, "cargo_description")) {
      if (typeof body.cargo_description !== "string") {
        return res.status(400).json({
          error: "Cargo description must be a string.",
        });
      }
      updatedTrip.cargo_description = normalizeTripText(
        body.cargo_description,
      );
    }

    if (hasOwnProperty(body, "cargo_weight")) {
      const cargoWeight = parseFiniteNumber(
        body.cargo_weight,
      );
      if (cargoWeight === null || cargoWeight <= 0) {
        return res.status(400).json({
          error: "Cargo weight must be greater than zero.",
        });
      }
      updatedTrip.cargo_weight = cargoWeight;
    }

    if (hasOwnProperty(body, "planned_distance")) {
      const plannedDistance = parseFiniteNumber(
        body.planned_distance,
      );
      if (
        plannedDistance === null ||
        plannedDistance <= 0
      ) {
        return res.status(400).json({
          error:
            "Planned distance must be greater than zero.",
        });
      }
      updatedTrip.planned_distance = plannedDistance;
    }

    if (hasOwnProperty(body, "planned_start_time")) {
      if (typeof body.planned_start_time !== "string") {
        return res.status(400).json({
          error:
            "Planned departure time must be a string.",
        });
      }
      const plannedStartDate = new Date(
        body.planned_start_time,
      );
      if (Number.isNaN(plannedStartDate.getTime())) {
        return res.status(400).json({
          error:
            "A valid planned departure time is required.",
        });
      }
      updatedTrip.planned_start_time =
        plannedStartDate.toISOString();
    }

    if (hasOwnProperty(body, "revenue")) {
      const revenue = parseFiniteNumber(body.revenue);
      if (revenue === null || revenue < 0) {
        return res.status(400).json({
          error: "Revenue must be zero or greater.",
        });
      }
      updatedTrip.revenue = revenue;
    }

    if (hasOwnProperty(body, "notes")) {
      if (
        body.notes !== undefined &&
        body.notes !== null &&
        typeof body.notes !== "string"
      ) {
        return res.status(400).json({
          error: "Notes must be a string.",
        });
      }
      const notes =
        typeof body.notes === "string"
          ? body.notes.trim()
          : "";
      updatedTrip.notes = notes || undefined;
    }

    if (
      updatedTrip.source.length < 2 ||
      updatedTrip.source.length > 120
    ) {
      return res.status(400).json({
        error:
          "Source must contain between 2 and 120 characters.",
      });
    }

    if (
      updatedTrip.destination.length < 2 ||
      updatedTrip.destination.length > 120
    ) {
      return res.status(400).json({
        error:
          "Destination must contain between 2 and 120 characters.",
      });
    }

    if (
      updatedTrip.source.toLowerCase() ===
      updatedTrip.destination.toLowerCase()
    ) {
      return res.status(400).json({
        error: "Source and destination must be different.",
      });
    }

    if (
      updatedTrip.cargo_description.length < 2 ||
      updatedTrip.cargo_description.length > 240
    ) {
      return res.status(400).json({
        error:
          "Cargo description must contain between 2 and 240 characters.",
      });
    }

    if ((updatedTrip.notes?.length ?? 0) > 1000) {
      return res.status(400).json({
        error: "Notes cannot exceed 1000 characters.",
      });
    }

    const vehicle = db.vehicles.find(
      (candidate) =>
        candidate.id === updatedTrip.vehicle_id,
    );
    const driver = db.drivers.find(
      (candidate) =>
        candidate.id === updatedTrip.driver_id,
    );

    if (!vehicle) {
      return res.status(400).json({
        error: "Selected vehicle does not exist.",
      });
    }

    if (!driver) {
      return res.status(400).json({
        error: "Selected driver does not exist.",
      });
    }

    const resourceError = validateDraftTripResources(
      vehicle,
      driver,
      updatedTrip.cargo_weight,
    );

    if (resourceError) {
      return res.status(409).json({
        error: resourceError,
      });
    }

    updatedTrip.updated_at = new Date().toISOString();
    db.trips[tripIndex] = updatedTrip;

    try {
      db.save();
    } catch (error) {
      db.trips[tripIndex] = currentTrip;
      throw error;
    }

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Updated draft trip ${updatedTrip.trip_code}`,
      "TRIP",
      updatedTrip.id,
    );

    return res.json(serializeTrip(updatedTrip));
  },
);

apiRouter.delete(
  "/trips/:id",
  authenticateJWT,
  requireRole([UserRole.ADMIN]),
  (req: AuthenticatedRequest, res) => {
    const index = db.trips.findIndex(
      (candidate) => candidate.id === req.params.id,
    );

    if (index === -1) {
      return res.status(404).json({
        error: "Trip not found.",
      });
    }

    const trip = db.trips[index];

    if (
      ![
        TripStatus.DRAFT,
        TripStatus.CANCELLED,
      ].includes(trip.status)
    ) {
      return res.status(409).json({
        error:
          "Only draft or cancelled trips can be permanently deleted.",
      });
    }

    const linkedFuelLogs = db.fuel_logs.filter(
      (fuelLog) => fuelLog.trip_id === trip.id,
    ).length;
    const linkedExpenses = db.expenses.filter(
      (expense) => expense.trip_id === trip.id,
    ).length;

    if (linkedFuelLogs > 0 || linkedExpenses > 0) {
      return res.status(409).json({
        error:
          "This trip has financial history and cannot be deleted.",
        references: {
          fuel_logs: linkedFuelLogs,
          expenses: linkedExpenses,
        },
      });
    }

    db.trips.splice(index, 1);

    try {
      db.save();
    } catch (error) {
      db.trips.splice(index, 0, trip);
      throw error;
    }

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Deleted trip ${trip.trip_code}`,
      "TRIP",
      trip.id,
    );

    return res.json({ success: true });
  },
);

apiRouter.post(
  "/trips/:id/dispatch",
  authenticateJWT,
  requireRole(TRIP_WRITE_ROLES),
  (req: AuthenticatedRequest, res) => {
    try {
      const trip = OperationsService.dispatchTrip(
        req.params.id,
        {
          id: req.user!.id,
          name: req.user!.full_name,
        },
      );

      return res.json(serializeTrip(trip));
    } catch (error: unknown) {
      return res.status(409).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to dispatch the trip.",
      });
    }
  },
);

apiRouter.post(
  "/trips/:id/complete",
  authenticateJWT,
  requireRole([
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.DRIVER,
  ]),
  (req: AuthenticatedRequest, res) => {
    const trip = db.trips.find(
      (candidate) => candidate.id === req.params.id,
    );

    if (!trip) {
      return res.status(404).json({
        error: "Trip not found.",
      });
    }

    if (
      req.user?.role === UserRole.DRIVER &&
      !canDriverAccessTrip(req.user.id, trip)
    ) {
      return res.status(403).json({
        error:
          "You can only complete a trip assigned to your driver profile.",
      });
    }

    const body = req.body ?? {};
    const actualDistance = parseFiniteNumber(
      body.actual_distance,
    );
    const finalOdometer = parseFiniteNumber(
      body.final_odometer,
    );
    const fuelConsumed = parseFiniteNumber(
      body.fuel_consumed,
    );
    const revenue =
      body.revenue === undefined
        ? undefined
        : parseFiniteNumber(body.revenue);
    const notes =
      typeof body.notes === "string"
        ? body.notes.trim()
        : undefined;

    if (
      actualDistance === null ||
      actualDistance <= 0
    ) {
      return res.status(400).json({
        error:
          "Actual distance must be greater than zero.",
      });
    }

    if (finalOdometer === null || finalOdometer < 0) {
      return res.status(400).json({
        error:
          "Final odometer must be zero or greater.",
      });
    }

    if (fuelConsumed === null || fuelConsumed < 0) {
      return res.status(400).json({
        error:
          "Fuel consumed must be zero or greater.",
      });
    }

    if (revenue === null || (revenue !== undefined && revenue < 0)) {
      return res.status(400).json({
        error: "Revenue must be zero or greater.",
      });
    }

    if (notes && notes.length > 1000) {
      return res.status(400).json({
        error: "Notes cannot exceed 1000 characters.",
      });
    }

    try {
      const completedTrip = OperationsService.completeTrip(
        trip.id,
        {
          actual_distance: actualDistance,
          final_odometer: finalOdometer,
          fuel_consumed: fuelConsumed,
          revenue,
          notes,
        },
        {
          id: req.user!.id,
          name: req.user!.full_name,
        },
      );

      return res.json(serializeTrip(completedTrip));
    } catch (error: unknown) {
      return res.status(409).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete the trip.",
      });
    }
  },
);

apiRouter.post(
  "/trips/:id/cancel",
  authenticateJWT,
  requireRole(TRIP_WRITE_ROLES),
  (req: AuthenticatedRequest, res) => {
    try {
      const trip = OperationsService.cancelTrip(
        req.params.id,
        {
          id: req.user!.id,
          name: req.user!.full_name,
        },
      );

      return res.json(serializeTrip(trip));
    } catch (error: unknown) {
      return res.status(409).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to cancel the trip.",
      });
    }
  },
);

// ============================================================================
// 6. MAINTENANCE MODULE ENDPOINTS
// ============================================================================

type MaintenanceSortField =
  | "created_at"
  | "start_date"
  | "expected_completion_date"
  | "completed_date"
  | "estimated_cost"
  | "actual_cost"
  | "status"
  | "maintenance_type"
  | "service_provider";

const MAINTENANCE_SORT_FIELDS =
  new Set<MaintenanceSortField>([
    "created_at",
    "start_date",
    "expected_completion_date",
    "completed_date",
    "estimated_cost",
    "actual_cost",
    "status",
    "maintenance_type",
    "service_provider",
  ]);

function isMaintenanceStatus(
  value: unknown,
): value is MaintenanceStatus {
  return (
    typeof value === "string" &&
    Object.values(MaintenanceStatus).includes(
      value as MaintenanceStatus,
    )
  );
}

function isMaintenanceType(
  value: unknown,
): value is MaintenanceType {
  return (
    typeof value === "string" &&
    Object.values(MaintenanceType).includes(
      value as MaintenanceType,
    )
  );
}

function normalizeMaintenanceText(
  value: string,
): string {
  return value.trim().replace(/\s+/g, " ");
}

function compareMaintenanceValues(
  first: MaintenanceLog,
  second: MaintenanceLog,
  field: MaintenanceSortField,
  order: 1 | -1,
): number {
  const firstValue = first[field] ?? "";
  const secondValue = second[field] ?? "";

  if (
    typeof firstValue === "number" &&
    typeof secondValue === "number"
  ) {
    return (firstValue - secondValue) * order;
  }

  return (
    String(firstValue).localeCompare(
      String(secondValue),
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    ) * order
  );
}

function serializeMaintenanceRecord(
  log: MaintenanceLog,
) {
  const vehicle = db.vehicles.find(
    (candidate) =>
      candidate.id === log.vehicle_id,
  );

  return {
    ...log,
    vehicle_name:
      vehicle?.vehicle_name ?? "Unknown Vehicle",
    registration_number:
      vehicle?.registration_number ?? "Unknown",
    vehicle_reg:
      vehicle?.registration_number ?? "Unknown",
    vehicle_status: vehicle?.status ?? null,
    vehicle_odometer: vehicle?.odometer ?? null,
    vehicle_model: vehicle?.model ?? null,
    vehicle_type: vehicle?.vehicle_type ?? null,
    vehicle_region: vehicle?.region ?? null,
  };
}

apiRouter.get(
  "/maintenance",
  authenticateJWT,
  requireRole(MAINTENANCE_ROLES),
  (req, res) => {
    const search = getSingleQueryValue(
      req.query.search,
    ).toLowerCase();
    const status = getSingleQueryValue(
      req.query.status,
    );
    const maintenanceType =
      getSingleQueryValue(
        req.query.maintenance_type,
      );
    const vehicleId = getSingleQueryValue(
      req.query.vehicle_id,
    );
    const requestedSortField =
      getSingleQueryValue(req.query.sort_by) ||
      "created_at";
    const requestedSortOrder =
      getSingleQueryValue(req.query.sort_order) ||
      "desc";

    if (
      status &&
      !isMaintenanceStatus(status)
    ) {
      return res.status(400).json({
        error:
          "Invalid maintenance status filter.",
      });
    }

    if (
      maintenanceType &&
      !isMaintenanceType(maintenanceType)
    ) {
      return res.status(400).json({
        error:
          "Invalid maintenance type filter.",
      });
    }

    if (
      vehicleId &&
      !db.vehicles.some(
        (vehicle) => vehicle.id === vehicleId,
      )
    ) {
      return res.status(400).json({
        error: "Invalid vehicle filter.",
      });
    }

    if (
      !MAINTENANCE_SORT_FIELDS.has(
        requestedSortField as MaintenanceSortField,
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid maintenance sort field.",
      });
    }

    if (
      requestedSortOrder !== "asc" &&
      requestedSortOrder !== "desc"
    ) {
      return res.status(400).json({
        error:
          "Maintenance sort order must be asc or desc.",
      });
    }

    let list = [...db.maintenance_logs];

    if (search) {
      list = list.filter((log) => {
        const vehicle = db.vehicles.find(
          (candidate) =>
            candidate.id === log.vehicle_id,
        );

        return [
          log.id,
          log.maintenance_type,
          log.description,
          log.service_provider,
          vehicle?.vehicle_name ?? "",
          vehicle?.registration_number ?? "",
          vehicle?.model ?? "",
          vehicle?.region ?? "",
        ].some((value) =>
          value.toLowerCase().includes(search),
        );
      });
    }

    if (status) {
      list = list.filter(
        (log) => log.status === status,
      );
    }

    if (maintenanceType) {
      list = list.filter(
        (log) =>
          log.maintenance_type ===
          maintenanceType,
      );
    }

    if (vehicleId) {
      list = list.filter(
        (log) => log.vehicle_id === vehicleId,
      );
    }

    const sortField =
      requestedSortField as MaintenanceSortField;
    const sortOrder: 1 | -1 =
      requestedSortOrder === "asc" ? 1 : -1;

    list.sort((first, second) =>
      compareMaintenanceValues(
        first,
        second,
        sortField,
        sortOrder,
      ),
    );

    const pageSize = parsePositiveInteger(
      req.query.page_size,
      10,
      100,
    );
    const requestedPage = parsePositiveInteger(
      req.query.page,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const total = list.length;
    const totalPages = Math.max(
      1,
      Math.ceil(total / pageSize),
    );
    const page = Math.min(
      requestedPage,
      totalPages,
    );
    const startIndex = (page - 1) * pageSize;
    const data = list
      .slice(
        startIndex,
        startIndex + pageSize,
      )
      .map(serializeMaintenanceRecord);

    return res.json({
      data,
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
    });
  },
);

apiRouter.get(
  "/maintenance/:id",
  authenticateJWT,
  requireRole(MAINTENANCE_ROLES),
  (req, res) => {
    const log = db.maintenance_logs.find(
      (candidate) =>
        candidate.id === req.params.id,
    );

    if (!log) {
      return res.status(404).json({
        error:
          "Maintenance record not found.",
      });
    }

    return res.json(
      serializeMaintenanceRecord(log),
    );
  },
);

apiRouter.post(
  "/maintenance",
  authenticateJWT,
  requireRole(MAINTENANCE_ROLES),
  (req: AuthenticatedRequest, res) => {
    const body = req.body ?? {};

    if (
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        error:
          "A valid maintenance payload is required.",
      });
    }

    const vehicleId =
      typeof body.vehicle_id === "string"
        ? body.vehicle_id.trim()
        : "";
    const description =
      typeof body.description === "string"
        ? normalizeMaintenanceText(
            body.description,
          )
        : "";
    const serviceProvider =
      typeof body.service_provider === "string"
        ? normalizeMaintenanceText(
            body.service_provider,
          )
        : "";
    const estimatedCost = parseFiniteNumber(
      body.estimated_cost,
    );
    const serviceOdometer =
      parseFiniteNumber(
        body.odometer_at_service,
      );

    if (!vehicleId) {
      return res.status(400).json({
        error: "A vehicle is required.",
      });
    }

    const vehicle = db.vehicles.find(
      (candidate) =>
        candidate.id === vehicleId,
    );

    if (!vehicle) {
      return res.status(400).json({
        error: "Selected vehicle was not found.",
      });
    }

    if (
      vehicle.status !==
      VehicleStatus.AVAILABLE
    ) {
      return res.status(409).json({
        error:
          "Only AVAILABLE vehicles can enter maintenance.",
      });
    }

    if (
      !isMaintenanceType(
        body.maintenance_type,
      )
    ) {
      return res.status(400).json({
        error:
          "A valid maintenance type is required.",
      });
    }

    if (
      description.length < 3 ||
      description.length > 500
    ) {
      return res.status(400).json({
        error:
          "Description must contain between 3 and 500 characters.",
      });
    }

    if (
      serviceProvider.length < 2 ||
      serviceProvider.length > 100
    ) {
      return res.status(400).json({
        error:
          "Service provider must contain between 2 and 100 characters.",
      });
    }

    if (
      !isIsoDate(body.start_date) ||
      !isIsoDate(
        body.expected_completion_date,
      )
    ) {
      return res.status(400).json({
        error:
          "Start and expected completion dates must be valid dates.",
      });
    }

    if (
      body.expected_completion_date <
      body.start_date
    ) {
      return res.status(400).json({
        error:
          "Expected completion date cannot be before the start date.",
      });
    }

    if (
      estimatedCost === null ||
      estimatedCost < 0
    ) {
      return res.status(400).json({
        error:
          "Estimated cost must be zero or greater.",
      });
    }

    if (
      serviceOdometer === null ||
      serviceOdometer < vehicle.odometer
    ) {
      return res.status(400).json({
        error: `Service odometer cannot be below the current vehicle reading of ${vehicle.odometer}.`,
      });
    }

    try {
      const log =
        OperationsService.startMaintenance(
          {
            vehicle_id: vehicle.id,
            maintenance_type:
              body.maintenance_type,
            description,
            service_provider:
              serviceProvider,
            start_date: body.start_date,
            expected_completion_date:
              body.expected_completion_date,
            estimated_cost: estimatedCost,
            odometer_at_service:
              serviceOdometer,
          },
          {
            id: req.user!.id,
            name: req.user!.full_name,
          },
        );

      return res.status(201).json(
        serializeMaintenanceRecord(log),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Maintenance could not be started.";

      return res.status(409).json({
        error: message,
      });
    }
  },
);

apiRouter.post(
  "/maintenance/:id/complete",
  authenticateJWT,
  requireRole(MAINTENANCE_ROLES),
  (req: AuthenticatedRequest, res) => {
    const body = req.body ?? {};
    const actualCost = parseFiniteNumber(
      body.actual_cost,
    );
    const notes =
      typeof body.notes === "string"
        ? body.notes.trim()
        : "";

    if (
      actualCost === null ||
      actualCost < 0
    ) {
      return res.status(400).json({
        error:
          "Actual cost must be zero or greater.",
      });
    }

    if (!isIsoDate(body.completed_date)) {
      return res.status(400).json({
        error:
          "Completed date must be a valid date.",
      });
    }

    if (notes.length > 500) {
      return res.status(400).json({
        error:
          "Completion notes cannot exceed 500 characters.",
      });
    }

    try {
      const log =
        OperationsService.completeMaintenance(
          req.params.id,
          {
            actual_cost: actualCost,
            completed_date:
              body.completed_date,
            notes,
          },
          {
            id: req.user!.id,
            name: req.user!.full_name,
          },
        );

      return res.json(
        serializeMaintenanceRecord(log),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Maintenance could not be completed.";

      return res.status(409).json({
        error: message,
      });
    }
  },
);

apiRouter.post(
  "/maintenance/:id/cancel",
  authenticateJWT,
  requireRole(MAINTENANCE_ROLES),
  (req: AuthenticatedRequest, res) => {
    try {
      const log =
        OperationsService.cancelMaintenance(
          req.params.id,
          {
            id: req.user!.id,
            name: req.user!.full_name,
          },
        );

      return res.json(
        serializeMaintenanceRecord(log),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Maintenance could not be cancelled.";

      return res.status(409).json({
        error: message,
      });
    }
  },
);

apiRouter.delete(
  "/maintenance/:id",
  authenticateJWT,
  requireRole([UserRole.ADMIN]),
  (req: AuthenticatedRequest, res) => {
    const index =
      db.maintenance_logs.findIndex(
        (log) => log.id === req.params.id,
      );

    if (index === -1) {
      return res.status(404).json({
        error:
          "Maintenance record not found.",
      });
    }

    const log = db.maintenance_logs[index];

    if (
      log.status !==
      MaintenanceStatus.CANCELLED
    ) {
      return res.status(409).json({
        error:
          "Only cancelled maintenance records can be permanently deleted.",
      });
    }

    const receiptNumber = `MNT-${log.id.toUpperCase()}`;
    const linkedExpense = db.expenses.find(
      (expense) =>
        expense.receipt_number === receiptNumber,
    );

    if (linkedExpense) {
      return res.status(409).json({
        error:
          "This maintenance record has a linked expense and cannot be deleted.",
      });
    }

    db.maintenance_logs.splice(index, 1);

    try {
      db.save();
    } catch (error) {
      db.maintenance_logs.splice(
        index,
        0,
        log,
      );
      throw error;
    }

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Deleted cancelled maintenance record ${log.id}`,
      "MAINTENANCE",
      log.id,
    );

    return res.json({
      success: true,
    });
  },
);

// ============================================================================
// 7. FUEL LOGS & EXPENSE MODULE ENDPOINTS
// ============================================================================

type FinancialRecordSource =
  | "MANUAL"
  | "TRIP_COMPLETION"
  | "MAINTENANCE_COMPLETION"
  | "LEGACY_FUEL_MIRROR";

type FuelSortField =
  | "created_at"
  | "fuel_date"
  | "fuel_litres"
  | "fuel_cost"
  | "price_per_litre"
  | "odometer_reading"
  | "receipt_number";

type ExpenseSortField =
  | "created_at"
  | "expense_date"
  | "amount"
  | "expense_type"
  | "receipt_number";

const FUEL_SORT_FIELDS = new Set<FuelSortField>([
  "created_at",
  "fuel_date",
  "fuel_litres",
  "fuel_cost",
  "price_per_litre",
  "odometer_reading",
  "receipt_number",
]);

const EXPENSE_SORT_FIELDS = new Set<ExpenseSortField>([
  "created_at",
  "expense_date",
  "amount",
  "expense_type",
  "receipt_number",
]);

function normalizeFinancialText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeReceiptNumber(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function getFuelSource(log: FuelLog): FinancialRecordSource {
  const storedSource = (
    log as FuelLog & {
      source?: FinancialRecordSource;
    }
  ).source;

  if (storedSource) {
    return storedSource;
  }

  if (
    log.trip_id &&
    /^AUTO-/i.test(log.receipt_number)
  ) {
    return "TRIP_COMPLETION";
  }

  return "MANUAL";
}

function getExpenseSource(
  expense: Expense,
): FinancialRecordSource {
  const storedSource = (
    expense as Expense & {
      source?: FinancialRecordSource;
    }
  ).source;

  if (storedSource) {
    return storedSource;
  }

  if (
    /^MNT-/i.test(expense.receipt_number) ||
    /^Maintenance completed:/i.test(
      expense.description,
    )
  ) {
    return "MAINTENANCE_COMPLETION";
  }

  if (/^Fuel Purchase:/i.test(expense.description)) {
    return "LEGACY_FUEL_MIRROR";
  }

  return "MANUAL";
}

function getVehicleForFinancialRecord(
  vehicleId: string | undefined,
) {
  return vehicleId
    ? db.vehicles.find(
        (vehicle) => vehicle.id === vehicleId,
      )
    : undefined;
}

function getTripForFinancialRecord(
  tripId: string | undefined,
) {
  return tripId
    ? db.trips.find((trip) => trip.id === tripId)
    : undefined;
}

function validateFinancialTripLink(
  tripId: string | undefined,
  vehicleId: string | undefined,
):
  | {
      trip: Trip | undefined;
      resolvedVehicleId: string | undefined;
    }
  | { error: string; status: number } {
  if (!tripId) {
    return {
      trip: undefined,
      resolvedVehicleId: vehicleId,
    };
  }

  const trip = getTripForFinancialRecord(tripId);

  if (!trip) {
    return {
      error: "The selected trip was not found.",
      status: 400,
    };
  }

  if (
    ![
      TripStatus.DISPATCHED,
      TripStatus.COMPLETED,
    ].includes(trip.status)
  ) {
    return {
      error:
        "Financial records can only be linked to dispatched or completed trips.",
      status: 409,
    };
  }

  if (vehicleId && trip.vehicle_id !== vehicleId) {
    return {
      error:
        "The selected trip belongs to a different vehicle.",
      status: 409,
    };
  }

  return {
    trip,
    resolvedVehicleId: trip.vehicle_id,
  };
}

function compareFinancialValues(
  firstValue: unknown,
  secondValue: unknown,
  order: 1 | -1,
): number {
  if (
    typeof firstValue === "number" &&
    typeof secondValue === "number"
  ) {
    return (firstValue - secondValue) * order;
  }

  return (
    String(firstValue ?? "").localeCompare(
      String(secondValue ?? ""),
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    ) * order
  );
}

function serializeFuelLog(log: FuelLog) {
  const vehicle = getVehicleForFinancialRecord(
    log.vehicle_id,
  );
  const trip = getTripForFinancialRecord(log.trip_id);
  const source = getFuelSource(log);

  return {
    ...log,
    vehicle_name:
      vehicle?.vehicle_name ?? "Unknown Vehicle",
    registration_number:
      vehicle?.registration_number ?? "Unknown",
    vehicle_odometer: vehicle?.odometer ?? null,
    trip_code: trip?.trip_code ?? null,
    source,
    is_protected: source !== "MANUAL",
  };
}

function serializeExpense(expense: Expense) {
  const vehicle = getVehicleForFinancialRecord(
    expense.vehicle_id,
  );
  const trip = getTripForFinancialRecord(
    expense.trip_id,
  );
  const source = getExpenseSource(expense);

  return {
    ...expense,
    vehicle_name:
      vehicle?.vehicle_name ??
      "General Operational Expense",
    registration_number:
      vehicle?.registration_number ?? "N/A",
    trip_code: trip?.trip_code ?? null,
    source,
    is_protected: source !== "MANUAL",
  };
}

apiRouter.get(
  "/financial/options",
  authenticateJWT,
  requireRole(FINANCIAL_ROLES),
  (_req, res) => {
    const vehicles = [...db.vehicles]
      .sort((first, second) =>
        first.registration_number.localeCompare(
          second.registration_number,
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          },
        ),
      )
      .map((vehicle) => ({
        id: vehicle.id,
        vehicle_name: vehicle.vehicle_name,
        registration_number:
          vehicle.registration_number,
        odometer: vehicle.odometer,
        status: vehicle.status,
      }));

    const trips = db.trips
      .filter((trip) =>
        [
          TripStatus.DISPATCHED,
          TripStatus.COMPLETED,
        ].includes(trip.status),
      )
      .sort((first, second) =>
        second.created_at.localeCompare(
          first.created_at,
        ),
      )
      .map((trip) => ({
        id: trip.id,
        trip_code: trip.trip_code,
        vehicle_id: trip.vehicle_id,
        source: trip.source,
        destination: trip.destination,
        status: trip.status,
      }));

    return res.json({
      vehicles,
      trips,
      expense_types: Object.values(ExpenseType),
    });
  },
);

apiRouter.get(
  ["/fuel-logs", "/fuel"],
  authenticateJWT,
  requireRole(FINANCIAL_ROLES),
  (req, res) => {
    const search = getSingleQueryValue(
      req.query.search,
    ).toLowerCase();
    const vehicleId = getSingleQueryValue(
      req.query.vehicle_id,
    );
    const dateFrom = getSingleQueryValue(
      req.query.date_from,
    );
    const dateTo = getSingleQueryValue(
      req.query.date_to,
    );
    const requestedSortField =
      getSingleQueryValue(req.query.sort_by) ||
      "fuel_date";
    const requestedSortOrder =
      getSingleQueryValue(req.query.sort_order) ||
      "desc";

    if (
      dateFrom &&
      !isIsoDate(dateFrom)
    ) {
      return res.status(400).json({
        error: "Fuel start date is invalid.",
      });
    }

    if (
      dateTo &&
      !isIsoDate(dateTo)
    ) {
      return res.status(400).json({
        error: "Fuel end date is invalid.",
      });
    }

    if (dateFrom && dateTo && dateFrom > dateTo) {
      return res.status(400).json({
        error:
          "Fuel start date cannot be after the end date.",
      });
    }

    if (
      !FUEL_SORT_FIELDS.has(
        requestedSortField as FuelSortField,
      )
    ) {
      return res.status(400).json({
        error: "Invalid fuel sort field.",
      });
    }

    if (
      requestedSortOrder !== "asc" &&
      requestedSortOrder !== "desc"
    ) {
      return res.status(400).json({
        error:
          "Fuel sort order must be asc or desc.",
      });
    }

    let list = db.fuel_logs.map(serializeFuelLog);

    if (search) {
      list = list.filter((log) =>
        [
          log.vehicle_name,
          log.registration_number,
          log.receipt_number,
          log.fuel_station,
          log.trip_code ?? "",
          log.notes ?? "",
        ].some((value) =>
          value.toLowerCase().includes(search),
        ),
      );
    }

    if (vehicleId) {
      list = list.filter(
        (log) => log.vehicle_id === vehicleId,
      );
    }

    if (dateFrom) {
      list = list.filter(
        (log) => log.fuel_date >= dateFrom,
      );
    }

    if (dateTo) {
      list = list.filter(
        (log) => log.fuel_date <= dateTo,
      );
    }

    const sortField =
      requestedSortField as FuelSortField;
    const sortOrder: 1 | -1 =
      requestedSortOrder === "asc" ? 1 : -1;

    list.sort((first, second) =>
      compareFinancialValues(
        first[sortField],
        second[sortField],
        sortOrder,
      ),
    );

    const summary = {
      total_litres: list.reduce(
        (sum, log) => sum + log.fuel_litres,
        0,
      ),
      total_cost: list.reduce(
        (sum, log) => sum + log.fuel_cost,
        0,
      ),
      average_price:
        list.reduce(
          (sum, log) => sum + log.fuel_litres,
          0,
        ) > 0
          ? list.reduce(
              (sum, log) => sum + log.fuel_cost,
              0,
            ) /
            list.reduce(
              (sum, log) => sum + log.fuel_litres,
              0,
            )
          : 0,
    };

    const pageSize = parsePositiveInteger(
      req.query.page_size,
      10,
      100,
    );
    const requestedPage = parsePositiveInteger(
      req.query.page,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const total = list.length;
    const totalPages = Math.max(
      1,
      Math.ceil(total / pageSize),
    );
    const page = Math.min(
      requestedPage,
      totalPages,
    );
    const startIndex = (page - 1) * pageSize;

    return res.json({
      data: list.slice(
        startIndex,
        startIndex + pageSize,
      ),
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      summary,
    });
  },
);

apiRouter.post(
  ["/fuel-logs", "/fuel"],
  authenticateJWT,
  requireRole(FINANCIAL_ROLES),
  (req: AuthenticatedRequest, res) => {
    const body = req.body ?? {};

    if (
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        error: "A valid fuel payload is required.",
      });
    }

    const requestedVehicleId =
      typeof body.vehicle_id === "string"
        ? body.vehicle_id.trim()
        : "";
    const requestedTripId =
      typeof body.trip_id === "string" &&
      body.trip_id.trim()
        ? body.trip_id.trim()
        : undefined;
    const tripValidation =
      validateFinancialTripLink(
        requestedTripId,
        requestedVehicleId || undefined,
      );

    if ("error" in tripValidation) {
      return res
        .status(tripValidation.status)
        .json({ error: tripValidation.error });
    }

    const vehicleId =
      tripValidation.resolvedVehicleId;

    if (!vehicleId) {
      return res.status(400).json({
        error: "A vehicle is required.",
      });
    }

    const vehicle =
      getVehicleForFinancialRecord(vehicleId);

    if (!vehicle) {
      return res.status(400).json({
        error: "The selected vehicle was not found.",
      });
    }

    if (vehicle.status === VehicleStatus.RETIRED) {
      return res.status(409).json({
        error:
          "Fuel cannot be logged for a retired vehicle.",
      });
    }

    const fuelLitres = parseFiniteNumber(
      body.fuel_litres,
    );
    const pricePerLitre = parseFiniteNumber(
      body.price_per_litre,
    );
    const suppliedFuelCost = parseFiniteNumber(
      body.fuel_cost,
    );
    const odometerReading = parseFiniteNumber(
      body.odometer_reading,
    );
    const fuelDate =
      typeof body.fuel_date === "string"
        ? body.fuel_date.trim()
        : typeof body.refill_date === "string"
          ? body.refill_date.trim()
          : "";
    const fuelStation =
      typeof body.fuel_station === "string"
        ? normalizeFinancialText(
            body.fuel_station,
          )
        : "";
    const receiptNumber =
      typeof body.receipt_number === "string"
        ? normalizeReceiptNumber(
            body.receipt_number,
          )
        : typeof body.bill_number === "string"
          ? normalizeReceiptNumber(
              body.bill_number,
            )
          : "";
    const notes =
      typeof body.notes === "string"
        ? normalizeFinancialText(body.notes)
        : "";

    if (
      fuelLitres === null ||
      fuelLitres <= 0
    ) {
      return res.status(400).json({
        error:
          "Fuel litres must be greater than zero.",
      });
    }

    if (
      pricePerLitre === null ||
      pricePerLitre <= 0
    ) {
      return res.status(400).json({
        error:
          "Price per litre must be greater than zero.",
      });
    }

    const calculatedFuelCost =
      fuelLitres * pricePerLitre;
    const fuelCost =
      suppliedFuelCost === null
        ? calculatedFuelCost
        : suppliedFuelCost;

    if (
      fuelCost <= 0 ||
      Math.abs(
        fuelCost - calculatedFuelCost,
      ) > 1
    ) {
      return res.status(400).json({
        error:
          "Fuel cost must match litres multiplied by price per litre.",
      });
    }

    if (
      odometerReading === null ||
      odometerReading < 0
    ) {
      return res.status(400).json({
        error:
          "Odometer reading must be zero or greater.",
      });
    }

    const maximumKnownFuelOdometer =
      db.fuel_logs
        .filter(
          (log) => log.vehicle_id === vehicle.id,
        )
        .reduce(
          (maximum, log) =>
            Math.max(
              maximum,
              log.odometer_reading,
            ),
          0,
        );
    const minimumOdometer = Math.max(
      vehicle.odometer,
      maximumKnownFuelOdometer,
    );

    if (odometerReading < minimumOdometer) {
      return res.status(409).json({
        error: `Odometer reading cannot be below the latest known reading of ${minimumOdometer}.`,
      });
    }

    if (
      !isIsoDate(fuelDate) ||
      fuelDate > getTodayDate()
    ) {
      return res.status(400).json({
        error:
          "Fuel date must be a valid date that is not in the future.",
      });
    }

    if (
      fuelStation.length < 2 ||
      fuelStation.length > 100
    ) {
      return res.status(400).json({
        error:
          "Fuel station must contain between 2 and 100 characters.",
      });
    }

    if (
      receiptNumber.length < 2 ||
      receiptNumber.length > 80
    ) {
      return res.status(400).json({
        error:
          "Receipt number must contain between 2 and 80 characters.",
      });
    }

    const duplicateReceipt = db.fuel_logs.find(
      (log) =>
        normalizeReceiptNumber(
          log.receipt_number,
        ) === receiptNumber,
    );

    if (duplicateReceipt) {
      return res.status(409).json({
        error:
          "A fuel record with this receipt number already exists.",
      });
    }

    const duplicateEntry = db.fuel_logs.find(
      (log) =>
        log.vehicle_id === vehicle.id &&
        log.fuel_date === fuelDate &&
        log.odometer_reading ===
          odometerReading &&
        Math.abs(
          log.fuel_litres - fuelLitres,
        ) < 0.001 &&
        Math.abs(log.fuel_cost - fuelCost) < 0.01,
    );

    if (duplicateEntry) {
      return res.status(409).json({
        error:
          "A matching fuel entry already exists for this vehicle.",
      });
    }

    const now = new Date().toISOString();
    const fuelLog: FuelLog = {
      id: db.generateId("fl"),
      vehicle_id: vehicle.id,
      trip_id: requestedTripId,
      fuel_litres: fuelLitres,
      fuel_cost: Number(fuelCost.toFixed(2)),
      price_per_litre: Number(
        pricePerLitre.toFixed(2),
      ),
      odometer_reading: odometerReading,
      fuel_date: fuelDate,
      fuel_station: fuelStation,
      receipt_number: receiptNumber,
      notes: notes || undefined,
      created_by: req.user!.id,
      created_at: now,
      updated_at: now,
    };

    const oldVehicleOdometer = vehicle.odometer;
    db.fuel_logs.unshift(fuelLog);

    if (odometerReading > vehicle.odometer) {
      vehicle.odometer = odometerReading;
      vehicle.updated_at = now;
    }

    try {
      db.save();
    } catch (error) {
      const index = db.fuel_logs.findIndex(
        (log) => log.id === fuelLog.id,
      );

      if (index >= 0) {
        db.fuel_logs.splice(index, 1);
      }

      vehicle.odometer = oldVehicleOdometer;
      throw error;
    }

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Logged ${fuelLitres} litres of fuel for ${vehicle.registration_number}`,
      "FUEL_LOG",
      fuelLog.id,
    );

    return res
      .status(201)
      .json(serializeFuelLog(fuelLog));
  },
);

apiRouter.put(
  ["/fuel-logs/:id", "/fuel/:id"],
  authenticateJWT,
  requireRole(FINANCIAL_ROLES),
  (req: AuthenticatedRequest, res) => {
    const index = db.fuel_logs.findIndex(
      (log) => log.id === req.params.id,
    );

    if (index === -1) {
      return res.status(404).json({
        error: "Fuel record not found.",
      });
    }

    const original = db.fuel_logs[index];

    if (getFuelSource(original) !== "MANUAL") {
      return res.status(409).json({
        error:
          "Automatically generated fuel records cannot be edited.",
      });
    }

    const body = req.body ?? {};

    if (
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        error: "A valid fuel payload is required.",
      });
    }

    const requestedVehicleId =
      typeof body.vehicle_id === "string"
        ? body.vehicle_id.trim()
        : original.vehicle_id;
    const requestedTripId =
      body.trip_id === null ||
      body.trip_id === ""
        ? undefined
        : typeof body.trip_id === "string"
          ? body.trip_id.trim()
          : original.trip_id;
    const tripValidation =
      validateFinancialTripLink(
        requestedTripId,
        requestedVehicleId,
      );

    if ("error" in tripValidation) {
      return res
        .status(tripValidation.status)
        .json({ error: tripValidation.error });
    }

    const vehicleId =
      tripValidation.resolvedVehicleId;

    if (!vehicleId) {
      return res.status(400).json({
        error: "A vehicle is required.",
      });
    }

    const vehicle =
      getVehicleForFinancialRecord(vehicleId);

    if (!vehicle) {
      return res.status(400).json({
        error: "The selected vehicle was not found.",
      });
    }

    if (vehicle.status === VehicleStatus.RETIRED) {
      return res.status(409).json({
        error:
          "Fuel cannot be assigned to a retired vehicle.",
      });
    }

    const fuelLitres =
      hasOwnProperty(body, "fuel_litres")
        ? parseFiniteNumber(body.fuel_litres)
        : original.fuel_litres;
    const pricePerLitre =
      hasOwnProperty(body, "price_per_litre")
        ? parseFiniteNumber(
            body.price_per_litre,
          )
        : original.price_per_litre;
    const odometerReading =
      hasOwnProperty(body, "odometer_reading")
        ? parseFiniteNumber(
            body.odometer_reading,
          )
        : original.odometer_reading;
    const fuelDate =
      typeof body.fuel_date === "string"
        ? body.fuel_date.trim()
        : original.fuel_date;
    const fuelStation =
      typeof body.fuel_station === "string"
        ? normalizeFinancialText(
            body.fuel_station,
          )
        : original.fuel_station;
    const receiptNumber =
      typeof body.receipt_number === "string"
        ? normalizeReceiptNumber(
            body.receipt_number,
          )
        : original.receipt_number;
    const notes =
      body.notes === null ||
      body.notes === ""
        ? undefined
        : typeof body.notes === "string"
          ? normalizeFinancialText(body.notes)
          : original.notes;

    if (
      fuelLitres === null ||
      fuelLitres <= 0 ||
      pricePerLitre === null ||
      pricePerLitre <= 0
    ) {
      return res.status(400).json({
        error:
          "Fuel litres and price per litre must be greater than zero.",
      });
    }

    if (
      odometerReading === null ||
      odometerReading < 0
    ) {
      return res.status(400).json({
        error:
          "Odometer reading must be zero or greater.",
      });
    }

    const odometerChanged =
      odometerReading !==
        original.odometer_reading ||
      vehicle.id !== original.vehicle_id;

    if (odometerChanged) {
      const maximumOtherFuelOdometer =
        db.fuel_logs
          .filter(
            (log) =>
              log.id !== original.id &&
              log.vehicle_id === vehicle.id,
          )
          .reduce(
            (maximum, log) =>
              Math.max(
                maximum,
                log.odometer_reading,
              ),
            0,
          );
      const minimumOdometer = Math.max(
        vehicle.odometer,
        maximumOtherFuelOdometer,
      );

      if (odometerReading < minimumOdometer) {
        return res.status(409).json({
          error: `Odometer reading cannot be below the latest known reading of ${minimumOdometer}.`,
        });
      }
    }

    if (
      !isIsoDate(fuelDate) ||
      fuelDate > getTodayDate()
    ) {
      return res.status(400).json({
        error:
          "Fuel date must be a valid date that is not in the future.",
      });
    }

    if (
      fuelStation.length < 2 ||
      fuelStation.length > 100 ||
      receiptNumber.length < 2 ||
      receiptNumber.length > 80
    ) {
      return res.status(400).json({
        error:
          "Fuel station and receipt number are invalid.",
      });
    }

    const duplicateReceipt = db.fuel_logs.find(
      (log) =>
        log.id !== original.id &&
        normalizeReceiptNumber(
          log.receipt_number,
        ) ===
          normalizeReceiptNumber(receiptNumber),
    );

    if (duplicateReceipt) {
      return res.status(409).json({
        error:
          "A fuel record with this receipt number already exists.",
      });
    }

    const fuelCost = Number(
      (fuelLitres * pricePerLitre).toFixed(2),
    );
    const updated: FuelLog = {
      ...original,
      vehicle_id: vehicle.id,
      trip_id: requestedTripId,
      fuel_litres: fuelLitres,
      fuel_cost: fuelCost,
      price_per_litre: Number(
        pricePerLitre.toFixed(2),
      ),
      odometer_reading: odometerReading,
      fuel_date: fuelDate,
      fuel_station: fuelStation,
      receipt_number:
        normalizeReceiptNumber(receiptNumber),
      notes,
      updated_at: new Date().toISOString(),
    };

    const oldVehicleOdometer = vehicle.odometer;
    db.fuel_logs[index] = updated;

    if (odometerReading > vehicle.odometer) {
      vehicle.odometer = odometerReading;
      vehicle.updated_at =
        updated.updated_at;
    }

    try {
      db.save();
    } catch (error) {
      db.fuel_logs[index] = original;
      vehicle.odometer = oldVehicleOdometer;
      throw error;
    }

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Updated fuel record ${updated.receipt_number}`,
      "FUEL_LOG",
      updated.id,
    );

    return res.json(serializeFuelLog(updated));
  },
);

apiRouter.delete(
  ["/fuel-logs/:id", "/fuel/:id"],
  authenticateJWT,
  requireRole(FINANCIAL_ROLES),
  (req: AuthenticatedRequest, res) => {
    const index = db.fuel_logs.findIndex(
      (log) => log.id === req.params.id,
    );

    if (index === -1) {
      return res.status(404).json({
        error: "Fuel record not found.",
      });
    }

    const log = db.fuel_logs[index];

    if (getFuelSource(log) !== "MANUAL") {
      return res.status(409).json({
        error:
          "Automatically generated fuel records cannot be deleted.",
      });
    }

    db.fuel_logs.splice(index, 1);

    try {
      db.save();
    } catch (error) {
      db.fuel_logs.splice(index, 0, log);
      throw error;
    }

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Deleted fuel record ${log.receipt_number}`,
      "FUEL_LOG",
      log.id,
    );

    return res.json({ success: true });
  },
);

apiRouter.get(
  "/expenses",
  authenticateJWT,
  requireRole(FINANCIAL_ROLES),
  (req, res) => {
    const search = getSingleQueryValue(
      req.query.search,
    ).toLowerCase();
    const vehicleId = getSingleQueryValue(
      req.query.vehicle_id,
    );
    const expenseType = getSingleQueryValue(
      req.query.expense_type,
    );
    const dateFrom = getSingleQueryValue(
      req.query.date_from,
    );
    const dateTo = getSingleQueryValue(
      req.query.date_to,
    );
    const requestedSortField =
      getSingleQueryValue(req.query.sort_by) ||
      "expense_date";
    const requestedSortOrder =
      getSingleQueryValue(req.query.sort_order) ||
      "desc";

    if (
      expenseType &&
      !Object.values(ExpenseType).includes(
        expenseType as ExpenseType,
      )
    ) {
      return res.status(400).json({
        error: "Invalid expense type filter.",
      });
    }

    if (dateFrom && !isIsoDate(dateFrom)) {
      return res.status(400).json({
        error: "Expense start date is invalid.",
      });
    }

    if (dateTo && !isIsoDate(dateTo)) {
      return res.status(400).json({
        error: "Expense end date is invalid.",
      });
    }

    if (dateFrom && dateTo && dateFrom > dateTo) {
      return res.status(400).json({
        error:
          "Expense start date cannot be after the end date.",
      });
    }

    if (
      !EXPENSE_SORT_FIELDS.has(
        requestedSortField as ExpenseSortField,
      )
    ) {
      return res.status(400).json({
        error: "Invalid expense sort field.",
      });
    }

    if (
      requestedSortOrder !== "asc" &&
      requestedSortOrder !== "desc"
    ) {
      return res.status(400).json({
        error:
          "Expense sort order must be asc or desc.",
      });
    }

    let list = db.expenses.map(serializeExpense);

    if (search) {
      list = list.filter((expense) =>
        [
          expense.vehicle_name,
          expense.registration_number,
          expense.receipt_number,
          expense.expense_type,
          expense.description,
          expense.trip_code ?? "",
        ].some((value) =>
          value.toLowerCase().includes(search),
        ),
      );
    }

    if (vehicleId) {
      list = list.filter(
        (expense) =>
          expense.vehicle_id === vehicleId,
      );
    }

    if (expenseType) {
      list = list.filter(
        (expense) =>
          expense.expense_type === expenseType,
      );
    }

    if (dateFrom) {
      list = list.filter(
        (expense) =>
          expense.expense_date >= dateFrom,
      );
    }

    if (dateTo) {
      list = list.filter(
        (expense) =>
          expense.expense_date <= dateTo,
      );
    }

    const sortField =
      requestedSortField as ExpenseSortField;
    const sortOrder: 1 | -1 =
      requestedSortOrder === "asc" ? 1 : -1;

    list.sort((first, second) =>
      compareFinancialValues(
        first[sortField],
        second[sortField],
        sortOrder,
      ),
    );

    const summary = {
      total_expenses: list.reduce(
        (sum, expense) =>
          sum + expense.amount,
        0,
      ),
    };

    const pageSize = parsePositiveInteger(
      req.query.page_size,
      10,
      100,
    );
    const requestedPage = parsePositiveInteger(
      req.query.page,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const total = list.length;
    const totalPages = Math.max(
      1,
      Math.ceil(total / pageSize),
    );
    const page = Math.min(
      requestedPage,
      totalPages,
    );
    const startIndex = (page - 1) * pageSize;

    return res.json({
      data: list.slice(
        startIndex,
        startIndex + pageSize,
      ),
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      summary,
    });
  },
);

apiRouter.post(
  "/expenses",
  authenticateJWT,
  requireRole(FINANCIAL_ROLES),
  (req: AuthenticatedRequest, res) => {
    const body = req.body ?? {};

    if (
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        error:
          "A valid expense payload is required.",
      });
    }

    const requestedVehicleId =
      typeof body.vehicle_id === "string" &&
      body.vehicle_id.trim()
        ? body.vehicle_id.trim()
        : undefined;
    const requestedTripId =
      typeof body.trip_id === "string" &&
      body.trip_id.trim()
        ? body.trip_id.trim()
        : undefined;
    const tripValidation =
      validateFinancialTripLink(
        requestedTripId,
        requestedVehicleId,
      );

    if ("error" in tripValidation) {
      return res
        .status(tripValidation.status)
        .json({ error: tripValidation.error });
    }

    const vehicleId =
      tripValidation.resolvedVehicleId;

    if (
      vehicleId &&
      !getVehicleForFinancialRecord(vehicleId)
    ) {
      return res.status(400).json({
        error: "The selected vehicle was not found.",
      });
    }

    if (
      typeof body.expense_type !== "string" ||
      !Object.values(ExpenseType).includes(
        body.expense_type as ExpenseType,
      )
    ) {
      return res.status(400).json({
        error:
          "A valid expense type is required.",
      });
    }

    const amount = parseFiniteNumber(body.amount);
    const expenseDate =
      typeof body.expense_date === "string"
        ? body.expense_date.trim()
        : "";
    const description =
      typeof body.description === "string"
        ? normalizeFinancialText(
            body.description,
          )
        : "";
    const receiptNumber =
      typeof body.receipt_number === "string"
        ? normalizeReceiptNumber(
            body.receipt_number,
          )
        : typeof body.reference_number === "string"
          ? normalizeReceiptNumber(
              body.reference_number,
            )
          : "";

    if (amount === null || amount <= 0) {
      return res.status(400).json({
        error:
          "Expense amount must be greater than zero.",
      });
    }

    if (
      !isIsoDate(expenseDate) ||
      expenseDate > getTodayDate()
    ) {
      return res.status(400).json({
        error:
          "Expense date must be a valid date that is not in the future.",
      });
    }

    if (
      description.length < 2 ||
      description.length > 500
    ) {
      return res.status(400).json({
        error:
          "Description must contain between 2 and 500 characters.",
      });
    }

    if (
      receiptNumber.length < 2 ||
      receiptNumber.length > 80
    ) {
      return res.status(400).json({
        error:
          "Receipt number must contain between 2 and 80 characters.",
      });
    }

    const duplicateReceipt = db.expenses.find(
      (expense) =>
        normalizeReceiptNumber(
          expense.receipt_number,
        ) === receiptNumber,
    );

    if (duplicateReceipt) {
      return res.status(409).json({
        error:
          "An expense with this receipt number already exists.",
      });
    }

    const duplicateEntry = db.expenses.find(
      (expense) =>
        expense.vehicle_id === vehicleId &&
        expense.trip_id === requestedTripId &&
        expense.expense_type ===
          body.expense_type &&
        expense.expense_date === expenseDate &&
        Math.abs(expense.amount - amount) <
          0.01 &&
        expense.description.toLowerCase() ===
          description.toLowerCase(),
    );

    if (duplicateEntry) {
      return res.status(409).json({
        error:
          "A matching expense record already exists.",
      });
    }

    const now = new Date().toISOString();
    const expense: Expense = {
      id: db.generateId("ex"),
      vehicle_id: vehicleId,
      trip_id: requestedTripId,
      expense_type:
        body.expense_type as ExpenseType,
      amount: Number(amount.toFixed(2)),
      expense_date: expenseDate,
      description,
      receipt_number: receiptNumber,
      created_by: req.user!.id,
      created_at: now,
      updated_at: now,
    };

    db.expenses.unshift(expense);

    try {
      db.save();
    } catch (error) {
      const index = db.expenses.findIndex(
        (candidate) =>
          candidate.id === expense.id,
      );

      if (index >= 0) {
        db.expenses.splice(index, 1);
      }

      throw error;
    }

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Logged ${expense.expense_type} expense of Rs. ${expense.amount}`,
      "EXPENSE",
      expense.id,
    );

    return res
      .status(201)
      .json(serializeExpense(expense));
  },
);

apiRouter.put(
  "/expenses/:id",
  authenticateJWT,
  requireRole(FINANCIAL_ROLES),
  (req: AuthenticatedRequest, res) => {
    const index = db.expenses.findIndex(
      (expense) =>
        expense.id === req.params.id,
    );

    if (index === -1) {
      return res.status(404).json({
        error: "Expense record not found.",
      });
    }

    const original = db.expenses[index];

    if (
      getExpenseSource(original) !== "MANUAL"
    ) {
      return res.status(409).json({
        error:
          "Automatically generated expenses cannot be edited.",
      });
    }

    const body = req.body ?? {};

    if (
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        error:
          "A valid expense payload is required.",
      });
    }

    const requestedVehicleId =
      body.vehicle_id === null ||
      body.vehicle_id === ""
        ? undefined
        : typeof body.vehicle_id === "string"
          ? body.vehicle_id.trim()
          : original.vehicle_id;
    const requestedTripId =
      body.trip_id === null ||
      body.trip_id === ""
        ? undefined
        : typeof body.trip_id === "string"
          ? body.trip_id.trim()
          : original.trip_id;
    const tripValidation =
      validateFinancialTripLink(
        requestedTripId,
        requestedVehicleId,
      );

    if ("error" in tripValidation) {
      return res
        .status(tripValidation.status)
        .json({ error: tripValidation.error });
    }

    const vehicleId =
      tripValidation.resolvedVehicleId;

    if (
      vehicleId &&
      !getVehicleForFinancialRecord(vehicleId)
    ) {
      return res.status(400).json({
        error: "The selected vehicle was not found.",
      });
    }

    const expenseType =
      typeof body.expense_type === "string"
        ? body.expense_type
        : original.expense_type;

    if (
      !Object.values(ExpenseType).includes(
        expenseType as ExpenseType,
      )
    ) {
      return res.status(400).json({
        error:
          "A valid expense type is required.",
      });
    }

    const amount =
      hasOwnProperty(body, "amount")
        ? parseFiniteNumber(body.amount)
        : original.amount;
    const expenseDate =
      typeof body.expense_date === "string"
        ? body.expense_date.trim()
        : original.expense_date;
    const description =
      typeof body.description === "string"
        ? normalizeFinancialText(
            body.description,
          )
        : original.description;
    const receiptNumber =
      typeof body.receipt_number === "string"
        ? normalizeReceiptNumber(
            body.receipt_number,
          )
        : original.receipt_number;

    if (amount === null || amount <= 0) {
      return res.status(400).json({
        error:
          "Expense amount must be greater than zero.",
      });
    }

    if (
      !isIsoDate(expenseDate) ||
      expenseDate > getTodayDate()
    ) {
      return res.status(400).json({
        error:
          "Expense date must be a valid date that is not in the future.",
      });
    }

    if (
      description.length < 2 ||
      description.length > 500 ||
      receiptNumber.length < 2 ||
      receiptNumber.length > 80
    ) {
      return res.status(400).json({
        error:
          "Expense description or receipt number is invalid.",
      });
    }

    const duplicateReceipt = db.expenses.find(
      (expense) =>
        expense.id !== original.id &&
        normalizeReceiptNumber(
          expense.receipt_number,
        ) ===
          normalizeReceiptNumber(receiptNumber),
    );

    if (duplicateReceipt) {
      return res.status(409).json({
        error:
          "An expense with this receipt number already exists.",
      });
    }

    const updated: Expense = {
      ...original,
      vehicle_id: vehicleId,
      trip_id: requestedTripId,
      expense_type:
        expenseType as ExpenseType,
      amount: Number(amount.toFixed(2)),
      expense_date: expenseDate,
      description,
      receipt_number:
        normalizeReceiptNumber(receiptNumber),
      updated_at: new Date().toISOString(),
    };

    db.expenses[index] = updated;

    try {
      db.save();
    } catch (error) {
      db.expenses[index] = original;
      throw error;
    }

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Updated expense ${updated.receipt_number}`,
      "EXPENSE",
      updated.id,
    );

    return res.json(serializeExpense(updated));
  },
);

apiRouter.delete(
  "/expenses/:id",
  authenticateJWT,
  requireRole(FINANCIAL_ROLES),
  (req: AuthenticatedRequest, res) => {
    const index = db.expenses.findIndex(
      (expense) =>
        expense.id === req.params.id,
    );

    if (index === -1) {
      return res.status(404).json({
        error: "Expense record not found.",
      });
    }

    const expense = db.expenses[index];

    if (
      getExpenseSource(expense) !== "MANUAL"
    ) {
      return res.status(409).json({
        error:
          "Automatically generated expenses cannot be deleted.",
      });
    }

    db.expenses.splice(index, 1);

    try {
      db.save();
    } catch (error) {
      db.expenses.splice(index, 0, expense);
      throw error;
    }

    db.logActivity(
      req.user!.id,
      req.user!.full_name,
      `Deleted expense ${expense.receipt_number}`,
      "EXPENSE",
      expense.id,
    );

    return res.json({ success: true });
  },
);


// ============================================================================
// 8. DASHBOARD ANALYTICS ENDPOINTS

// ============================================================================

apiRouter.get("/dashboard/summary", authenticateJWT, (req, res) => {
  const totalVehicles = db.vehicles.length;
  const nonRetiredVehicles = db.vehicles.filter(v => v.status !== VehicleStatus.RETIRED).length;
  const availableVehicles = db.vehicles.filter(v => v.status === VehicleStatus.AVAILABLE).length;
  const onTripVehicles = db.vehicles.filter(v => v.status === VehicleStatus.ON_TRIP).length;
  const inMaintenanceVehicles = db.vehicles.filter(v => v.status === VehicleStatus.IN_SHOP).length;

  const totalDrivers = db.drivers.length;
  const availableDrivers = db.drivers.filter(d => d.status === DriverStatus.AVAILABLE).length;
  const onTripDrivers = db.drivers.filter(d => d.status === DriverStatus.ON_TRIP).length;

  const activeTrips = db.trips.filter(t => t.status === TripStatus.DISPATCHED).length;
  const draftTrips = db.trips.filter(t => t.status === TripStatus.DRAFT).length;

  // Fleet utilization formula: Vehicles On Trip / Non-Retired Vehicles * 100
  const utilization = nonRetiredVehicles > 0 ? (onTripVehicles / nonRetiredVehicles) * 100 : 0;

  // Financial math (all-time or monthly)
  const totalFuelCost = db.fuel_logs.reduce((sum, f) => sum + f.fuel_cost, 0);
  const totalMaintenanceCost = db.maintenance_logs.reduce((sum, m) => sum + (m.actual_cost || 0), 0);
  const totalOtherExpenses = db.expenses
    .filter(
      (expense) =>
        expense.expense_type !==
          ExpenseType.MAINTENANCE &&
        getExpenseSource(expense) !==
          "LEGACY_FUEL_MIRROR",
    )
    .reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );

  const totalOperationalCost =
    totalFuelCost +
    totalMaintenanceCost +
    totalOtherExpenses;

  res.json({
    kpi: {
      totalVehicles,
      availableVehicles,
      onTripVehicles,
      inMaintenanceVehicles,
      totalDrivers,
      availableDrivers,
      onTripDrivers,
      activeTrips,
      draftTrips,
      fleetUtilization: Math.round(utilization),
      totalFuelCost,
      totalMaintenanceCost,
      totalOperationalCost
    }
  });
});

apiRouter.get("/dashboard/vehicle-status", authenticateJWT, (req, res) => {
  const statuses = [VehicleStatus.AVAILABLE, VehicleStatus.ON_TRIP, VehicleStatus.IN_SHOP, VehicleStatus.RETIRED];
  const distribution = statuses.map(st => {
    const count = db.vehicles.filter(v => v.status === st).length;
    return { name: st.replace("_", " "), value: count };
  });
  res.json(distribution);
});

apiRouter.get("/dashboard/trip-status", authenticateJWT, (req, res) => {
  const statuses = [TripStatus.DRAFT, TripStatus.DISPATCHED, TripStatus.COMPLETED, TripStatus.CANCELLED];
  const distribution = statuses.map(st => {
    const count = db.trips.filter(t => t.status === st).length;
    return { name: st, value: count };
  });
  res.json(distribution);
});

apiRouter.get("/dashboard/monthly-costs", authenticateJWT, (req, res) => {
  // Return costs grouped by type for charts
  const fuel = db.fuel_logs.reduce((sum, f) => sum + f.fuel_cost, 0);
  const maintenance = db.maintenance_logs.reduce((sum, m) => sum + (m.actual_cost || 0), 0);
  const others = db.expenses
    .filter(
      (expense) =>
        expense.expense_type !==
          ExpenseType.MAINTENANCE &&
        getExpenseSource(expense) !==
          "LEGACY_FUEL_MIRROR",
    )
    .reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );

  res.json([
    { name: "Fuel Logs", cost: fuel },
    { name: "Maintenance", cost: maintenance },
    { name: "Other Expenses", cost: others }
  ]);
});

apiRouter.get("/dashboard/fuel-efficiency", authenticateJWT, (req, res) => {
  // Fuel Efficiency: Distance / fuel_consumed
  const vehiclesWithTrips = db.vehicles.map(v => {
    const vTrips = db.trips.filter(t => t.vehicle_id === v.id && t.status === TripStatus.COMPLETED);
    let totalDist = 0;
    let totalFuel = 0;

    vTrips.forEach(t => {
      totalDist += t.actual_distance || 0;
      totalFuel += t.fuel_consumed || 0;
    });

    const efficiency = totalFuel > 0 ? Number((totalDist / totalFuel).toFixed(2)) : 0;
    return {
      vehicle_name: `${v.vehicle_name} (${v.registration_number})`,
      efficiency
    };
  }).filter(item => item.efficiency > 0);

  res.json(vehiclesWithTrips);
});

apiRouter.get("/dashboard/recent-activity", authenticateJWT, (req, res) => {
  res.json(db.activity_logs.slice(0, 10)); // Top 10 activities
});

apiRouter.get("/dashboard/licence-alerts", authenticateJWT, (req, res) => {
  const today = new Date();
  const limit30 = new Date(Date.now() + 30 * 86400000);
  const todayStr = today.toISOString().split("T")[0];
  const limitStr = limit30.toISOString().split("T")[0];

  const expired = db.drivers.filter(d => d.licence_expiry_date < todayStr).map(d => ({
    driver_id: d.id,
    driver_name: d.full_name,
    licence: d.licence_number,
    expiry: d.licence_expiry_date,
    status: "EXPIRED"
  }));

  const expiring = db.drivers.filter(d => d.licence_expiry_date >= todayStr && d.licence_expiry_date <= limitStr).map(d => ({
    driver_id: d.id,
    driver_name: d.full_name,
    licence: d.licence_number,
    expiry: d.licence_expiry_date,
    status: "EXPIRING_SOON"
  }));

  res.json({
    expired,
    expiring_soon: expiring
  });
});


// ============================================================================
// 9. REPORTS MODULE ENDPOINTS
// ============================================================================

apiRouter.get(
  "/reports/vehicle-performance",
  authenticateJWT,
  requireRole(REPORT_ROLES),
  (req, res) => {
  const list = db.vehicles.map(v => {
    const vTrips = db.trips.filter(t => t.vehicle_id === v.id);
    const completed = vTrips.filter(t => t.status === TripStatus.COMPLETED);
    const distance = completed.reduce((sum, t) => sum + (t.actual_distance || 0), 0);
    const revenue = completed.reduce((sum, t) => sum + t.revenue, 0);

    const fuel = db.fuel_logs.filter(f => f.vehicle_id === v.id).reduce((sum, f) => sum + f.fuel_cost, 0);
    const maintenance = db.maintenance_logs.filter(m => m.vehicle_id === v.id).reduce((sum, m) => sum + (m.actual_cost || 0), 0);
    const totalCost = fuel + maintenance;

    return {
      vehicle_id: v.id,
      registration_number: v.registration_number,
      vehicle_name: v.vehicle_name,
      total_trips: vTrips.length,
      completed_trips: completed.length,
      total_distance: distance,
      total_revenue: revenue,
      operational_cost: totalCost,
      net_profit: revenue - totalCost
    };
  });
  res.json(list);
});

apiRouter.get(
  "/reports/fuel-efficiency",
  authenticateJWT,
  requireRole(REPORT_ROLES),
  (req, res) => {
  const list = db.vehicles.map(v => {
    const completed = db.trips.filter(t => t.vehicle_id === v.id && t.status === TripStatus.COMPLETED);
    const dist = completed.reduce((sum, t) => sum + (t.actual_distance || 0), 0);
    const fuel = completed.reduce((sum, t) => sum + (t.fuel_consumed || 0), 0);

    const efficiency = fuel > 0 ? Number((dist / fuel).toFixed(2)) : 0;
    return {
      registration_number: v.registration_number,
      vehicle_name: v.vehicle_name,
      completed_trips: completed.length,
      total_distance: dist,
      total_fuel_consumed: fuel,
      efficiency_km_per_litre: efficiency
    };
  });
  res.json(list);
});

apiRouter.get(
  "/reports/vehicle-roi",
  authenticateJWT,
  requireRole(REPORT_ROLES),
  (req, res) => {
  // ROI Formula: (Revenue - Operational Cost) / Acquisition Cost
  const list = db.vehicles.map(v => {
    const completed = db.trips.filter(t => t.vehicle_id === v.id && t.status === TripStatus.COMPLETED);
    const revenue = completed.reduce((sum, t) => sum + t.revenue, 0);

    const fuel = db.fuel_logs.filter(f => f.vehicle_id === v.id).reduce((sum, f) => sum + f.fuel_cost, 0);
    const maintenance = db.maintenance_logs.filter(m => m.vehicle_id === v.id).reduce((sum, m) => sum + (m.actual_cost || 0), 0);
    const expenses = db.expenses.filter(e => e.vehicle_id === v.id).reduce((sum, e) => sum + e.amount, 0);
    const totalCost = fuel + maintenance + expenses;

    const netProfit = revenue - totalCost;
    const roi = v.acquisition_cost > 0 ? (netProfit / v.acquisition_cost) * 100 : 0;

    return {
      registration_number: v.registration_number,
      vehicle_name: v.vehicle_name,
      acquisition_cost: v.acquisition_cost,
      total_revenue: revenue,
      operational_cost: totalCost,
      net_profit: netProfit,
      roi_percentage: Number(roi.toFixed(2))
    };
  });
  res.json(list);
});

apiRouter.get(
  "/reports/summary",
  authenticateJWT,
  requireRole(REPORT_ROLES),
  (req, res) => {
  const { start_date, end_date, type } = req.query;
  const start = start_date ? new Date(start_date as string) : null;
  const end = end_date ? new Date(end_date as string) : null;

  if (start) start.setHours(0, 0, 0, 0);
  if (end) end.setHours(23, 59, 59, 999);

  const isWithinRange = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  };

  if (type === "ROI") {
    const list = db.vehicles.map(v => {
      const completed = db.trips.filter(t => t.vehicle_id === v.id && t.status === TripStatus.COMPLETED && isWithinRange(t.completed_at || t.created_at));
      const revenue = completed.reduce((sum, t) => sum + t.revenue, 0);

      const fuel = db.fuel_logs.filter(f => f.vehicle_id === v.id && isWithinRange(f.fuel_date || f.created_at)).reduce((sum, f) => sum + f.fuel_cost, 0);
      const maintenance = db.maintenance_logs.filter(m => m.vehicle_id === v.id && isWithinRange(m.completed_date || m.start_date || m.created_at)).reduce((sum, m) => sum + (m.actual_cost || 0), 0);
      const totalCost = fuel + maintenance;

      const netProfit = revenue - totalCost;
      const roi = v.acquisition_cost > 0 ? (netProfit / v.acquisition_cost) * 100 : 0;

      return {
        vehicle_id: v.id,
        registration_number: v.registration_number,
        vehicle_name: v.vehicle_name,
        acquisition_cost: v.acquisition_cost || 0,
        revenue: revenue,
        fuel_cost: fuel,
        maintenance_cost: maintenance,
        net_profit: netProfit,
        roi: Number(roi.toFixed(2))
      };
    });
    return res.json(list);
  } else {
    // type === "FUEL"
    const list = db.vehicles.map(v => {
      const completed = db.trips.filter(t => t.vehicle_id === v.id && t.status === TripStatus.COMPLETED && isWithinRange(t.completed_at || t.created_at));
      const dist = completed.reduce((sum, t) => sum + (t.actual_distance || 0), 0);
      const fuel = completed.reduce((sum, t) => sum + (t.fuel_consumed || 0), 0);

      const efficiency = fuel > 0 ? Number((dist / fuel).toFixed(2)) : 0;
      return {
        vehicle_id: v.id,
        registration_number: v.registration_number,
        vehicle_name: v.vehicle_name,
        total_distance: dist,
        total_fuel: fuel,
        current_odometer: v.odometer || 0,
        efficiency: efficiency
      };
    });
    return res.json(list);
  }
});

apiRouter.get(
  "/reports/download",
  authenticateJWT,
  requireRole(REPORT_ROLES),
  (req, res) => {
  const { start_date, end_date, type } = req.query;
  const start = start_date ? new Date(start_date as string) : null;
  const end = end_date ? new Date(end_date as string) : null;

  if (start) start.setHours(0, 0, 0, 0);
  if (end) end.setHours(23, 59, 59, 999);

  const isWithinRange = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  };

  let csvContent = "";

  if (type === "ROI") {
    csvContent += "Registration,Vehicle Name,Acquisition Cost (Rs.),Total Revenue (Rs.),Total Fuel Cost (Rs.),Servicing Cost (Rs.),Net Profit (Rs.),ROI (%)\n";
    db.vehicles.forEach(v => {
      const completed = db.trips.filter(t => t.vehicle_id === v.id && t.status === TripStatus.COMPLETED && isWithinRange(t.completed_at || t.created_at));
      const revenue = completed.reduce((sum, t) => sum + t.revenue, 0);
      const fuel = db.fuel_logs.filter(f => f.vehicle_id === v.id && isWithinRange(f.fuel_date || f.created_at)).reduce((sum, f) => sum + f.fuel_cost, 0);
      const mnt = db.maintenance_logs.filter(m => m.vehicle_id === v.id && isWithinRange(m.completed_date || m.start_date || m.created_at)).reduce((sum, m) => sum + (m.actual_cost || 0), 0);
      const cost = fuel + mnt;
      const netProfit = revenue - cost;
      const roi = v.acquisition_cost > 0 ? ((netProfit / v.acquisition_cost) * 100).toFixed(1) : "0.0";
      csvContent += `"${v.registration_number}","${v.vehicle_name}",${v.acquisition_cost || 0},${revenue},${fuel},${mnt},${netProfit},${roi}%\n`;
    });
  } else {
    csvContent += "Registration,Vehicle Name,Total Distance (km),Total Fuel Consumed (L),Current Odometer (km),Efficiency (km/L)\n";
    db.vehicles.forEach(v => {
      const completed = db.trips.filter(t => t.vehicle_id === v.id && t.status === TripStatus.COMPLETED && isWithinRange(t.completed_at || t.created_at));
      const dist = completed.reduce((sum, t) => sum + (t.actual_distance || 0), 0);
      const fuel = completed.reduce((sum, t) => sum + (t.fuel_consumed || 0), 0);
      const eff = fuel > 0 ? (dist / fuel).toFixed(2) : "0.00";
      csvContent += `"${v.registration_number}","${v.vehicle_name}",${dist},${fuel},${v.odometer || 0},${eff}\n`;
    });
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=transitops-${type || "report"}-${new Date().toISOString().split("T")[0]}.csv`);
  res.status(200).send(csvContent);
});

apiRouter.get(
  "/reports/export/csv",
  authenticateJWT,
  requireRole(REPORT_ROLES),
  (req, res) => {
  const { type } = req.query;

  let csvContent = "";

  if (type === "vehicle-performance") {
    csvContent += "Registration,Vehicle Name,Total Trips,Total Distance (km),Total Revenue (Rs.),Operational Cost (Rs.),Net Profit (Rs.)\n";
    db.vehicles.forEach(v => {
      const vTrips = db.trips.filter(t => t.vehicle_id === v.id);
      const completed = vTrips.filter(t => t.status === TripStatus.COMPLETED);
      const distance = completed.reduce((sum, t) => sum + (t.actual_distance || 0), 0);
      const revenue = completed.reduce((sum, t) => sum + t.revenue, 0);
      const fuel = db.fuel_logs.filter(f => f.vehicle_id === v.id).reduce((sum, f) => sum + f.fuel_cost, 0);
      const mnt = db.maintenance_logs.filter(m => m.vehicle_id === v.id).reduce((sum, m) => sum + (m.actual_cost || 0), 0);
      const cost = fuel + mnt;
      csvContent += `"${v.registration_number}","${v.vehicle_name}",${vTrips.length},${distance},${revenue},${cost},${revenue - cost}\n`;
    });
  } else if (type === "fuel-efficiency") {
    csvContent += "Registration,Vehicle Name,Completed Trips,Total Distance (km),Fuel Consumed (L),Efficiency (km/L)\n";
    db.vehicles.forEach(v => {
      const completed = db.trips.filter(t => t.vehicle_id === v.id && t.status === TripStatus.COMPLETED);
      const dist = completed.reduce((sum, t) => sum + (t.actual_distance || 0), 0);
      const fuel = completed.reduce((sum, t) => sum + (t.fuel_consumed || 0), 0);
      const eff = fuel > 0 ? (dist / fuel).toFixed(2) : "0.00";
      csvContent += `"${v.registration_number}","${v.vehicle_name}",${completed.length},${dist},${fuel},${eff}\n`;
    });
  } else {
    csvContent += "Operational Overview Report\n";
    csvContent += `Total Vehicles,${db.vehicles.length}\n`;
    csvContent += `Total Drivers,${db.drivers.length}\n`;
    csvContent += `Total Trips Logged,${db.trips.length}\n`;
    csvContent += `Total Expenses Logged,${db.expenses.reduce((sum, e) => sum + e.amount, 0)}\n`;
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=transitops-${type || "report"}-${new Date().toISOString().split("T")[0]}.csv`);
  res.status(200).send(csvContent);
});


// ============================================================================
// 10. NOTIFICATIONS ENDPOINTS
// ============================================================================

function canAccessNotification(
  userId: string,
  notification: {
    user_id: string;
    notification_type: NotificationType;
  },
): boolean {
  return (
    notification.user_id === userId ||
    notification.user_id === "all" ||
    notification.notification_type ===
      NotificationType.SYSTEM
  );
}

apiRouter.get(
  "/notifications",
  authenticateJWT,
  (req: AuthenticatedRequest, res) => {
    const list = db.notifications.filter(
      (notification) =>
        canAccessNotification(
          req.user!.id,
          notification,
        ),
    );

    return res.json(list);
  },
);

apiRouter.get(
  "/notifications/count",
  authenticateJWT,
  (req: AuthenticatedRequest, res) => {
    const count = db.notifications.filter(
      (notification) =>
        !notification.is_read &&
        canAccessNotification(
          req.user!.id,
          notification,
        ),
    ).length;

    return res.json({
      count,
    });
  },
);

apiRouter.patch(
  "/notifications/:id/read",
  authenticateJWT,
  (req: AuthenticatedRequest, res) => {
    const notification =
      db.notifications.find(
        (candidate) =>
          candidate.id === req.params.id,
      );

    if (!notification) {
      return res.status(404).json({
        error: "Notification not found.",
      });
    }

    if (
      !canAccessNotification(
        req.user!.id,
        notification,
      )
    ) {
      return res.status(403).json({
        error:
          "You cannot modify another user's notification.",
      });
    }

    notification.is_read = true;
    db.save();

    return res.json({
      success: true,
      notification,
    });
  },
);

apiRouter.patch(
  "/notifications/read-all",
  authenticateJWT,
  (req: AuthenticatedRequest, res) => {
    let updatedCount = 0;

    for (const notification of db.notifications) {
      if (
        !notification.is_read &&
        canAccessNotification(
          req.user!.id,
          notification,
        )
      ) {
        notification.is_read = true;
        updatedCount += 1;
      }
    }

    if (updatedCount > 0) {
      db.save();
    }

    return res.json({
      success: true,
      updated_count: updatedCount,
    });
  },
);

export { apiRouter };
