import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";
import { decode } from "base64-arraybuffer";
// ============================================================
// Types
// ============================================================
export type DriverStatus = "active" | "on_leave" | "inactive";
export type PaymentType = "advance" | "salary" | "bonus" | "deduction";
export type PaymentMethod = "cash" | "upi" | "bank" | "cheque";

export interface Driver {
  driver_id: string;
  user_id: string;
  name: string;
  phone: string | null;
  profile_image: string | null;
  status: DriverStatus;
  license_number: string | null;
  license_expiry: string | null;
  monthly_salary: number;
  joined_at: string;
  route_id: string | null;
  route_name: string | null;
  vehicle_id: string | null;
  bus_number: string | null;
  total_admissions: number;
  students_on_route: number;
  balance_due: number;
  paid_this_month: number;
  address: string | null;
  emergency_contact: string | null;
  notes: string | null;
  login_phone: string | null;
}

export interface DriverPayment {
  id: string;
  driver_id: string;
  amount: number;
  type: PaymentType;
  period: string; // 'YYYY-MM'
  paid_on: string;
  method: PaymentMethod | null;
  note: string | null;
  recorded_by: string;
  created_at: string;
  recorder?: { id: string; name: string } | null;
}

export interface PeriodSummary {
  driver_id: string;
  period: string;
  monthly_salary: number;
  advances: number;
  salary_paid: number;
  bonuses: number;
  deductions: number;
  balance_due: number;
  payment_count: number;
  last_paid_on: string;
}

export interface Vehicle {
  id: string;
  bus_number: string;
  capacity: number | null;
  next_service_date: string | null;
  assigned_driver_id: string | null;
  assigned_driver_name: string | null;
}

export interface DriverInput {
  name: string;
  phone: string;
  license_number?: string;
  license_expiry?: string | null;
  monthly_salary?: number;
  address?: string;
  emergency_contact?: string;
  route_id?: string | null;
  vehicle_id?: string | null;
  notes?: string;
  /** file:// when freshly picked, https:// when unchanged, null when removed */
  profile_photo_uri?: string | null;
  /** Present only when the image was just picked — this is what uploads */
  profile_photo_base64?: string | null;
}

export interface PaymentInput {
  driver_id: string;
  amount: number;
  type: PaymentType;
  period: string;
  paid_on: string;
  method?: PaymentMethod;
  note?: string;
}

interface DriverState {
  drivers: Driver[];
  loading: boolean;
  error: string | null;

  current: Driver | null;
  currentLoading: boolean;

  payments: DriverPayment[];
  periods: PeriodSummary[];
  paymentsLoading: boolean;

  vehicles: Vehicle[];
  vehiclesLoading: boolean;

  submitting: boolean;
  submitError: string | null;

  payroll: {
    period: string;
    driver_count: number;
    total_salary: number;
    total_paid: number;
    total_outstanding: number;
  } | null;
}

const initialState: DriverState = {
  drivers: [],
  loading: false,
  error: null,
  current: null,
  currentLoading: false,
  payments: [],
  periods: [],
  paymentsLoading: false,
  vehicles: [],
  vehiclesLoading: false,
  submitting: false,
  submitError: null,
  payroll: null,
};

export const currentPeriod = () => new Date().toISOString().slice(0, 7);

// ============================================================
// Validation
// ============================================================
export const validateDriver = (
  input: Partial<DriverInput>,
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (input.name !== undefined) {
    if (!input.name.trim() || input.name.trim().length < 2) {
      errors.name = "Enter the driver's full name";
    }
  }
  if (input.phone !== undefined) {
    if (!/^[0-9]{10}$/.test(input.phone.trim())) {
      errors.phone = "Enter a valid 10-digit mobile number";
    }
  }
  if (input.monthly_salary != null && input.monthly_salary < 0) {
    errors.monthly_salary = "Salary cannot be negative";
  }
  if (input.license_expiry) {
    const expiry = new Date(input.license_expiry);
    if (Number.isNaN(expiry.getTime())) {
      errors.license_expiry = "Enter a valid date";
    }
  }

  return errors;
};

export const validatePayment = (
  input: Partial<PaymentInput>,
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (input.amount == null || input.amount <= 0) {
    errors.amount = "Enter an amount greater than zero";
  }
  if (input.period && !/^[0-9]{4}-[0-9]{2}$/.test(input.period)) {
    errors.period = "Pick a valid month";
  }
  if (input.paid_on) {
    const d = new Date(input.paid_on);
    if (Number.isNaN(d.getTime())) errors.paid_on = "Pick a valid date";
  }

  return errors;
};

const uploadProfilePhoto = async (
  photo: { base64: string; uri: string },
  userId: string,
): Promise<string> => {
  const ext = photo.uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const contentType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("profile-images")
    .upload(path, decode(photo.base64), { contentType, upsert: false });

  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  const { data } = supabase.storage.from("profile-images").getPublicUrl(path);
  return data.publicUrl;
};

// ============================================================
// Helper
// ============================================================
const getCurrentAppUser = async (): Promise<{
  id: string;
  role: string;
} | null> => {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_id", authUser.id)
    .single();

  return data ?? null;
};

// ============================================================
// FETCH — driver directory
// ============================================================
export const fetchDrivers = createAsyncThunk<
  Driver[],
  { status?: DriverStatus | "all"; search?: string } | undefined,
  { rejectValue: string }
>("drivers/fetchAll", async (args, { rejectWithValue }) => {
  try {
    let query = supabase
      .from("driver_directory")
      .select("*")
      .order("status")
      .order("name");

    if (args?.status && args.status !== "all") {
      query = query.eq("status", args.status);
    }

    if (args?.search?.trim()) {
      const term = `%${args.search.trim()}%`;
      query = query.or(`name.ilike.${term},phone.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) return rejectWithValue(error.message);
    return (data ?? []) as Driver[];
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

export const fetchDriverById = createAsyncThunk<
  Driver,
  string,
  { rejectValue: string }
>("drivers/fetchOne", async (driverId, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase
      .from("driver_directory")
      .select("*")
      .eq("driver_id", driverId)
      .maybeSingle();

    if (error) return rejectWithValue(error.message);
    if (!data) return rejectWithValue("Driver not found or access denied");
    return data as Driver;
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// CREATE driver
//
// Two steps: a `users` row (so they can sign in with OTP later)
// and a `drivers` row holding the employment details. The
// auth_id stays null until their first successful OTP login,
// which the existing verifyOtp flow links automatically.
// ============================================================
export const createDriver = createAsyncThunk<
  Driver,
  DriverInput,
  { rejectValue: string }
>("drivers/create", async (input, { rejectWithValue }) => {
  try {
    const errors = validateDriver({
      name: input.name ?? "",
      phone: input.phone ?? "",
      monthly_salary: input.monthly_salary,
      license_expiry: input.license_expiry,
    });
    if (Object.keys(errors).length > 0) {
      return rejectWithValue(Object.values(errors)[0]);
    }

    const appUser = await getCurrentAppUser();
    if (!appUser) return rejectWithValue("Your session expired");
    if (appUser.role !== "admin") {
      return rejectWithValue("Only admins can add drivers");
    }

    const fullPhone = `91${input.phone.trim()}`;

    // Reuse an existing user row if this phone is already known
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, role, name")
      .eq("phone", fullPhone)
      .maybeSingle();

    let userId: string;

    if (existingUser) {
      if (existingUser.role !== "driver") {
        return rejectWithValue(
          `That number is already registered as ${existingUser.role}`,
        );
      }

      const { data: existingDriver } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (existingDriver) {
        return rejectWithValue("A driver with that number already exists");
      }

      userId = existingUser.id;
    } else {
      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({
          name: input.name.trim(),
          phone: fullPhone,
          role: "driver",
        })
        .select("id")
        .single();

      if (userError) {
        return rejectWithValue(`Couldn't create account: ${userError.message}`);
      }
      userId = newUser.id;
    }

    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .insert({
        user_id: userId,
        phone: input.phone.trim(),
        license_number: input.license_number?.trim() || null,
        license_expiry: input.license_expiry || null,
        monthly_salary: input.monthly_salary ?? 0,
        address: input.address?.trim() || null,
        emergency_contact: input.emergency_contact?.trim() || null,
        route_id: input.route_id || null,
        vehicle_id: input.vehicle_id || null,
        notes: input.notes?.trim() || null,
        status: "active",
      })
      .select("id")
      .single();

    if (driverError) {
      return rejectWithValue(driverError.message);
    }

    const { data: full } = await supabase
      .from("driver_directory")
      .select("*")
      .eq("driver_id", driver.id)
      .single();

    return full as Driver;
  } catch (err: any) {
    return rejectWithValue(err.message ?? "Couldn't add driver");
  }
});

// ============================================================
// UPDATE driver — only changed fields
// ============================================================
export const updateDriver = createAsyncThunk<
  Driver,
  { driverId: string; changes: Partial<DriverInput> },
  { rejectValue: string }
>("drivers/update", async ({ driverId, changes }, { rejectWithValue }) => {
  try {
    const errors = validateDriver(changes);
    if (Object.keys(errors).length > 0) {
      return rejectWithValue(Object.values(errors)[0]);
    }

    // Need the user_id for both the name update and the photo path
    const { data: driverRow } = await supabase
      .from("drivers")
      .select("user_id")
      .eq("id", driverId)
      .maybeSingle();

    if (!driverRow) {
      return rejectWithValue("Driver not found or access denied");
    }

    // ---- drivers table ----
    const driverPayload: Record<string, any> = {};
    if (changes.phone !== undefined) driverPayload.phone = changes.phone.trim();
    if (changes.license_number !== undefined)
      driverPayload.license_number = changes.license_number?.trim() || null;
    if (changes.license_expiry !== undefined)
      driverPayload.license_expiry = changes.license_expiry || null;
    if (changes.monthly_salary !== undefined)
      driverPayload.monthly_salary = changes.monthly_salary;
    if (changes.address !== undefined)
      driverPayload.address = changes.address?.trim() || null;
    if (changes.emergency_contact !== undefined)
      driverPayload.emergency_contact =
        changes.emergency_contact?.trim() || null;
    if (changes.route_id !== undefined)
      driverPayload.route_id = changes.route_id || null;
    if (changes.vehicle_id !== undefined)
      driverPayload.vehicle_id = changes.vehicle_id || null;
    if (changes.notes !== undefined)
      driverPayload.notes = changes.notes?.trim() || null;

    if (Object.keys(driverPayload).length > 0) {
      const { error } = await supabase
        .from("drivers")
        .update(driverPayload)
        .eq("id", driverId);
      if (error) return rejectWithValue(error.message);
    }

    // ---- users table: name and photo live here, not on drivers ----
    const userPayload: Record<string, any> = {};

    if (changes.name !== undefined) {
      userPayload.name = changes.name.trim();
    }

    if (changes.profile_photo_uri !== undefined) {
      if (changes.profile_photo_uri === null) {
        userPayload.profile_image = null;
      } else if (changes.profile_photo_base64) {
        userPayload.profile_image = await uploadProfilePhoto(
          {
            base64: changes.profile_photo_base64,
            uri: changes.profile_photo_uri,
          },
          driverRow.user_id,
        );
      }
      // https:// with no base64 means unchanged — omit the column
    }

    if (Object.keys(userPayload).length > 0) {
      const { error } = await supabase
        .from("users")
        .update(userPayload)
        .eq("id", driverRow.user_id);
      if (error) return rejectWithValue(error.message);
    }

    // ---- return the refreshed directory row ----
    const { data: full, error: fetchError } = await supabase
      .from("driver_directory")
      .select("*")
      .eq("driver_id", driverId)
      .maybeSingle();

    if (fetchError) return rejectWithValue(fetchError.message);
    if (!full) {
      return rejectWithValue("You don't have permission to edit this driver");
    }

    return full as Driver;
  } catch (err: any) {
    return rejectWithValue(err.message ?? "Couldn't save changes");
  }
});

// ============================================================
// ASSIGN vehicle / route
//
// A vehicle can only have one driver, so assigning one that's
// already taken must be blocked — otherwise two drivers show
// the same bus number and nobody can tell which is right.
// ============================================================
export const assignVehicle = createAsyncThunk<
  Driver,
  { driverId: string; vehicleId: string | null },
  { rejectValue: string }
>(
  "drivers/assignVehicle",
  async ({ driverId, vehicleId }, { rejectWithValue }) => {
    try {
      if (vehicleId) {
        const { data: taken } = await supabase
          .from("drivers")
          .select("id, users(name)")
          .eq("vehicle_id", vehicleId)
          .neq("id", driverId)
          .maybeSingle();

        if (taken) {
          const holder = (taken as any).users?.name ?? "another driver";
          return rejectWithValue(
            `That vehicle is already assigned to ${holder}`,
          );
        }
      }

      const { error } = await supabase
        .from("drivers")
        .update({ vehicle_id: vehicleId })
        .eq("id", driverId);

      if (error) return rejectWithValue(error.message);

      const { data: full } = await supabase
        .from("driver_directory")
        .select("*")
        .eq("driver_id", driverId)
        .single();

      return full as Driver;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const assignRoute = createAsyncThunk<
  Driver,
  { driverId: string; routeId: string | null },
  { rejectValue: string }
>("drivers/assignRoute", async ({ driverId, routeId }, { rejectWithValue }) => {
  try {
    const { error } = await supabase
      .from("drivers")
      .update({ route_id: routeId })
      .eq("id", driverId);

    if (error) return rejectWithValue(error.message);

    const { data: full } = await supabase
      .from("driver_directory")
      .select("*")
      .eq("driver_id", driverId)
      .single();

    return full as Driver;
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// STATUS — deactivate rather than delete
// ============================================================
export const setDriverStatus = createAsyncThunk<
  { driverId: string; status: DriverStatus },
  { driverId: string; status: DriverStatus },
  { rejectValue: string }
>("drivers/setStatus", async ({ driverId, status }, { rejectWithValue }) => {
  try {
    // Deactivating frees the vehicle and route for someone else
    const payload: Record<string, any> = { status };
    if (status === "inactive") {
      payload.vehicle_id = null;
      payload.route_id = null;
    }

    const { data, error } = await supabase
      .from("drivers")
      .update(payload)
      .eq("id", driverId)
      .select("id")
      .maybeSingle();

    if (error) return rejectWithValue(error.message);
    if (!data) return rejectWithValue("You don't have permission to do that");

    return { driverId, status };
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

/**
 * Hard delete. Only allowed when the driver has no payment
 * history and admitted no students — otherwise the ledger and
 * admission attribution would lose their referent.
 */
export const deleteDriver = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("drivers/delete", async (driverId, { rejectWithValue }) => {
  try {
    const { count: paymentCount } = await supabase
      .from("driver_payments")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", driverId);

    if ((paymentCount ?? 0) > 0) {
      return rejectWithValue(
        `This driver has ${paymentCount} payment record${paymentCount === 1 ? "" : "s"}. Deactivate instead to keep the history.`,
      );
    }

    const { data: d } = await supabase
      .from("drivers")
      .select("user_id")
      .eq("id", driverId)
      .single();

    if (d) {
      const { count: admissionCount } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("admitted_by", d.user_id);

      if ((admissionCount ?? 0) > 0) {
        return rejectWithValue(
          `This driver admitted ${admissionCount} student${admissionCount === 1 ? "" : "s"}. Deactivate instead.`,
        );
      }
    }

    const { error } = await supabase
      .from("drivers")
      .delete()
      .eq("id", driverId);
    if (error) return rejectWithValue(error.message);

    return driverId;
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// PAYMENTS
// ============================================================
export const fetchDriverPayments = createAsyncThunk<
  { payments: DriverPayment[]; periods: PeriodSummary[] },
  { driverId: string; period?: string },
  { rejectValue: string }
>(
  "drivers/fetchPayments",
  async ({ driverId, period }, { rejectWithValue }) => {
    try {
      let paymentQuery = supabase
        .from("driver_payments")
        .select("*, recorder:recorded_by(id, name)")
        .eq("driver_id", driverId)
        .order("paid_on", { ascending: false })
        .order("created_at", { ascending: false });

      if (period) paymentQuery = paymentQuery.eq("period", period);

      const [paymentsRes, periodsRes] = await Promise.all([
        paymentQuery,
        supabase
          .from("driver_period_summary")
          .select("*")
          .eq("driver_id", driverId)
          .order("period", { ascending: false }),
      ]);

      if (paymentsRes.error) return rejectWithValue(paymentsRes.error.message);
      if (periodsRes.error) return rejectWithValue(periodsRes.error.message);

      return {
        payments: (paymentsRes.data ?? []) as DriverPayment[],
        periods: (periodsRes.data ?? []) as PeriodSummary[],
      };
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const recordPayment = createAsyncThunk<
  DriverPayment,
  PaymentInput,
  { rejectValue: string }
>("drivers/recordPayment", async (input, { rejectWithValue }) => {
  try {
    const errors = validatePayment(input);
    if (Object.keys(errors).length > 0) {
      return rejectWithValue(Object.values(errors)[0]);
    }

    const appUser = await getCurrentAppUser();
    if (!appUser) return rejectWithValue("Your session expired");
    if (appUser.role !== "admin") {
      return rejectWithValue("Only admins can record payments");
    }

    const { data, error } = await supabase
      .from("driver_payments")
      .insert({
        driver_id: input.driver_id,
        amount: input.amount,
        type: input.type,
        period: input.period,
        paid_on: input.paid_on,
        method: input.method || null,
        note: input.note?.trim() || null,
        recorded_by: appUser.id,
      })
      .select("*, recorder:recorded_by(id, name)")
      .single();

    if (error) return rejectWithValue(error.message);
    return data as DriverPayment;
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

export const deletePayment = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("drivers/deletePayment", async (paymentId, { rejectWithValue }) => {
  try {
    const { error } = await supabase
      .from("driver_payments")
      .delete()
      .eq("id", paymentId);

    if (error) return rejectWithValue(error.message);
    return paymentId;
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// VEHICLES
// ============================================================
export const fetchVehicles = createAsyncThunk<
  Vehicle[],
  void,
  { rejectValue: string }
>("drivers/fetchVehicles", async (_, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase
      .from("vehicle_directory") 
      .select("*")
      .eq("is_active", true)
      .order("bus_number");

    if (error) return rejectWithValue(error.message);
    return (data ?? []) as Vehicle[];
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

export const createVehicle = createAsyncThunk<
  Vehicle,
  { bus_number: string; capacity?: number; next_service_date?: string },
  { rejectValue: string }
>("drivers/createVehicle", async (input, { rejectWithValue }) => {
  try {
    if (!input.bus_number?.trim()) {
      return rejectWithValue("Enter the vehicle number");
    }

    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        bus_number: input.bus_number.trim().toUpperCase(),
        capacity: input.capacity ?? null,
        next_service_date: input.next_service_date || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return rejectWithValue("A vehicle with that number already exists");
      }
      return rejectWithValue(error.message);
    }

    return {
      ...data,
      assigned_driver_id: null,
      assigned_driver_name: null,
    } as Vehicle;
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// PAYROLL snapshot
// ============================================================
export const fetchPayroll = createAsyncThunk<
  DriverState["payroll"],
  string | undefined,
  { rejectValue: string }
>("drivers/fetchPayroll", async (period, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase.rpc("payroll_snapshot", {
      p_period: period ?? null,
    });

    if (error) return rejectWithValue(error.message);
    return (data?.[0] ?? null) as DriverState["payroll"];
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// Slice
// ============================================================
const driverSlice = createSlice({
  name: "drivers",
  initialState,
  reducers: {
    clearDriverSubmitState: (state) => {
      state.submitError = null;
    },
    clearCurrentDriver: (state) => {
      state.current = null;
      state.payments = [];
      state.periods = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // LIST
      .addCase(fetchDrivers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDrivers.fulfilled, (state, action) => {
        state.loading = false;
        state.drivers = action.payload;
      })
      .addCase(fetchDrivers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Could not load drivers";
      })

      // ONE
      .addCase(fetchDriverById.pending, (state) => {
        state.currentLoading = true;
      })
      .addCase(fetchDriverById.fulfilled, (state, action) => {
        state.currentLoading = false;
        state.current = action.payload;
      })
      .addCase(fetchDriverById.rejected, (state, action) => {
        state.currentLoading = false;
        state.error = action.payload ?? "Could not load driver";
      })

      // CREATE
      .addCase(createDriver.pending, (state) => {
        state.submitting = true;
        state.submitError = null;
      })
      .addCase(createDriver.fulfilled, (state, action) => {
        state.submitting = false;
        state.drivers.unshift(action.payload);
      })
      .addCase(createDriver.rejected, (state, action) => {
        state.submitting = false;
        state.submitError = action.payload ?? "Couldn't add driver";
      })

      // UPDATE / ASSIGN — all return a fresh directory row
      .addCase(updateDriver.pending, (state) => {
        state.submitting = true;
        state.submitError = null;
      })
      .addCase(updateDriver.rejected, (state, action) => {
        state.submitting = false;
        state.submitError = action.payload ?? "Couldn't save changes";
      })
      .addCase(assignVehicle.rejected, (state, action) => {
        state.submitError = action.payload ?? "Couldn't assign vehicle";
      })
      .addCase(assignRoute.rejected, (state, action) => {
        state.submitError = action.payload ?? "Couldn't assign route";
      })

      // STATUS
      .addCase(setDriverStatus.fulfilled, (state, action) => {
        const d = state.drivers.find(
          (x) => x.driver_id === action.payload.driverId,
        );
        if (d) {
          d.status = action.payload.status;
          if (action.payload.status === "inactive") {
            d.vehicle_id = null;
            d.bus_number = null;
            d.route_id = null;
            d.route_name = null;
          }
        }
        if (state.current?.driver_id === action.payload.driverId) {
          state.current.status = action.payload.status;
        }
      })
      .addCase(setDriverStatus.rejected, (state, action) => {
        state.submitError = action.payload ?? "Couldn't update status";
      })

      // DELETE
      .addCase(deleteDriver.fulfilled, (state, action) => {
        state.drivers = state.drivers.filter(
          (d) => d.driver_id !== action.payload,
        );
      })
      .addCase(deleteDriver.rejected, (state, action) => {
        state.submitError = action.payload ?? "Couldn't remove driver";
      })

      // PAYMENTS
      .addCase(fetchDriverPayments.pending, (state) => {
        state.paymentsLoading = true;
      })
      .addCase(fetchDriverPayments.fulfilled, (state, action) => {
        state.paymentsLoading = false;
        state.payments = action.payload.payments;
        state.periods = action.payload.periods;
      })
      .addCase(fetchDriverPayments.rejected, (state, action) => {
        state.paymentsLoading = false;
        state.error = action.payload ?? "Could not load payments";
      })

      .addCase(recordPayment.pending, (state) => {
        state.submitting = true;
        state.submitError = null;
      })
      .addCase(recordPayment.fulfilled, (state, action) => {
        state.submitting = false;
        state.payments.unshift(action.payload);
      })
      .addCase(recordPayment.rejected, (state, action) => {
        state.submitting = false;
        state.submitError = action.payload ?? "Couldn't record payment";
      })

      .addCase(deletePayment.fulfilled, (state, action) => {
        state.payments = state.payments.filter((p) => p.id !== action.payload);
      })
      .addCase(deletePayment.rejected, (state, action) => {
        state.submitError = action.payload ?? "Couldn't delete payment";
      })

      // VEHICLES
      .addCase(fetchVehicles.pending, (state) => {
        state.vehiclesLoading = true;
      })
      .addCase(fetchVehicles.fulfilled, (state, action) => {
        state.vehiclesLoading = false;
        state.vehicles = action.payload;
      })
      .addCase(fetchVehicles.rejected, (state) => {
        state.vehiclesLoading = false;
      })
      .addCase(createVehicle.fulfilled, (state, action) => {
        state.vehicles.push(action.payload);
        state.vehicles.sort((a, b) => a.bus_number.localeCompare(b.bus_number));
      })
      .addCase(createVehicle.rejected, (state, action) => {
        state.submitError = action.payload ?? "Couldn't add vehicle";
      })

      // PAYROLL
      .addCase(fetchPayroll.fulfilled, (state, action) => {
        state.payroll = action.payload;
      });

    // Shared handler: every thunk that returns a fresh Driver row
    // updates both the list entry and `current` in one place
    [updateDriver, assignVehicle, assignRoute].forEach((thunk) => {
      builder.addCase(thunk.fulfilled, (state, action) => {
        state.submitting = false;
        const payload = action.payload as Driver;
        const i = state.drivers.findIndex(
          (d) => d.driver_id === payload.driver_id,
        );
        if (i >= 0) state.drivers[i] = payload;
        if (state.current?.driver_id === payload.driver_id) {
          state.current = payload;
        }
      });
    });
  },
});

export const { clearDriverSubmitState, clearCurrentDriver } =
  driverSlice.actions;
export default driverSlice.reducer;
