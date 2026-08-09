import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";
import { decode } from "base64-arraybuffer";

// ============================================================
// Types
// ============================================================
export type FuelType = "diesel" | "petrol" | "cng" | "electric";

export interface Vehicle {
  id: string;
  bus_number: string;
  make: string | null;
  model: string | null;
  year: number | null;
  capacity: number | null;
  fuel_type: FuelType | null;
  image: string | null;
  odometer: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;

  insurance_number: string | null;
  insurance_expiry: string | null;
  fitness_expiry: string | null;
  permit_expiry: string | null;
  puc_expiry: string | null;
  last_service_date: string | null;
  next_service_date: string | null;

  assigned_driver_id: string | null;
  assigned_driver_name: string | null;
  assigned_route_id: string | null;
  assigned_route_name: string | null;
  student_count: number;

  soonest_expiry: string | null;
  expiring_docs: number;
  service_overdue: boolean;
}

export interface VehicleInput {
  bus_number: string;
  make?: string;
  model?: string;
  year?: number | null;
  capacity?: number | null;
  fuel_type?: FuelType | null;
  odometer?: number | null;
  notes?: string;

  insurance_number?: string;
  insurance_expiry?: string | null;
  fitness_expiry?: string | null;
  permit_expiry?: string | null;
  puc_expiry?: string | null;
  last_service_date?: string | null;
  next_service_date?: string | null;

  /** file:// when freshly picked, https:// when unchanged, null when removed */
  image_uri?: string | null;
  /** Present only when just picked — this is what uploads */
  image_base64?: string | null;
}

export interface FleetSnapshot {
  total_vehicles: number;
  active_vehicles: number;
  unassigned: number;
  service_due: number;
  docs_expiring: number;
}

interface VehicleState {
  vehicles: Vehicle[];
  loading: boolean;
  error: string | null;

  current: Vehicle | null;
  currentLoading: boolean;

  submitting: boolean;
  submitError: string | null;

  fleet: FleetSnapshot | null;
}

const initialState: VehicleState = {
  vehicles: [],
  loading: false,
  error: null,
  current: null,
  currentLoading: false,
  submitting: false,
  submitError: null,
  fleet: null,
};

// ============================================================
// Validation
// ============================================================
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const validateVehicle = (
  input: Partial<VehicleInput>
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (input.bus_number !== undefined) {
    const n = input.bus_number.trim();
    if (!n || n.length < 4) {
      errors.bus_number = "Enter the full registration number";
    }
  }

  if (input.capacity != null && (input.capacity < 1 || input.capacity > 100)) {
    errors.capacity = "Capacity should be between 1 and 100";
  }

  if (input.year != null) {
    const thisYear = new Date().getFullYear();
    if (input.year < 1980 || input.year > thisYear + 1) {
      errors.year = `Enter a year between 1980 and ${thisYear + 1}`;
    }
  }

  if (input.odometer != null && input.odometer < 0) {
    errors.odometer = "Odometer can't be negative";
  }

  const dateFields: (keyof VehicleInput)[] = [
    "insurance_expiry",
    "fitness_expiry",
    "permit_expiry",
    "puc_expiry",
    "last_service_date",
    "next_service_date",
  ];

  for (const f of dateFields) {
    const v = input[f] as string | null | undefined;
    if (v && !DATE_RE.test(v)) {
      errors[f] = "Use YYYY-MM-DD";
    }
  }

  return errors;
};

// ============================================================
// Helpers
// ============================================================
const getCurrentAppUser = async (): Promise<
  { id: string; role: string } | null
> => {
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

/**
 * Uploads a vehicle photo picked by expo-image-picker.
 * Takes base64 directly so no filesystem read is needed.
 */
const uploadVehicleImage = async (
  photo: { base64: string; uri: string },
  vehicleKey: string
): Promise<string> => {
  const ext = photo.uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const contentType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const path = `${vehicleKey}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("vehicle-images")
    .upload(path, decode(photo.base64), { contentType, upsert: false });

  if (error) throw new Error(`Image upload failed: ${error.message}`);

  const { data } = supabase.storage.from("vehicle-images").getPublicUrl(path);
  return data.publicUrl;
};

/** Maps VehicleInput fields onto a database payload, skipping undefined */
const buildPayload = (input: Partial<VehicleInput>) => {
  const p: Record<string, any> = {};

  if (input.bus_number !== undefined)
    p.bus_number = input.bus_number.trim().toUpperCase();
  if (input.make !== undefined) p.make = input.make?.trim() || null;
  if (input.model !== undefined) p.model = input.model?.trim() || null;
  if (input.year !== undefined) p.year = input.year || null;
  if (input.capacity !== undefined) p.capacity = input.capacity || null;
  if (input.fuel_type !== undefined) p.fuel_type = input.fuel_type || null;
  if (input.odometer !== undefined) p.odometer = input.odometer ?? null;
  if (input.notes !== undefined) p.notes = input.notes?.trim() || null;

  if (input.insurance_number !== undefined)
    p.insurance_number = input.insurance_number?.trim() || null;
  if (input.insurance_expiry !== undefined)
    p.insurance_expiry = input.insurance_expiry || null;
  if (input.fitness_expiry !== undefined)
    p.fitness_expiry = input.fitness_expiry || null;
  if (input.permit_expiry !== undefined)
    p.permit_expiry = input.permit_expiry || null;
  if (input.puc_expiry !== undefined) p.puc_expiry = input.puc_expiry || null;
  if (input.last_service_date !== undefined)
    p.last_service_date = input.last_service_date || null;
  if (input.next_service_date !== undefined)
    p.next_service_date = input.next_service_date || null;

  return p;
};

// ============================================================
// FETCH
// ============================================================
export const fetchVehicles = createAsyncThunk<
  Vehicle[],
  { search?: string; filter?: "all" | "unassigned" | "attention" } | undefined,
  { rejectValue: string }
>("vehicles/fetchAll", async (args, { rejectWithValue }) => {
  try {
    let query = supabase
      .from("vehicle_directory")
      .select("*")
      .order("is_active", { ascending: false })
      .order("bus_number");

    if (args?.filter === "unassigned") {
      query = query.is("assigned_driver_id", null).eq("is_active", true);
    } else if (args?.filter === "attention") {
      query = query.eq("is_active", true).or(
        "expiring_docs.gt.0,service_overdue.eq.true"
      );
    }

    if (args?.search?.trim()) {
      const term = `%${args.search.trim()}%`;
      query = query.or(
        `bus_number.ilike.${term},model.ilike.${term},make.ilike.${term}`
      );
    }

    const { data, error } = await query;
    if (error) return rejectWithValue(error.message);
    return (data ?? []) as Vehicle[];
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

export const fetchVehicleById = createAsyncThunk<
  Vehicle,
  string,
  { rejectValue: string }
>("vehicles/fetchOne", async (id, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase
      .from("vehicle_directory")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) return rejectWithValue(error.message);
    if (!data) return rejectWithValue("Vehicle not found or access denied");
    return data as Vehicle;
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// CREATE
// ============================================================
export const createVehicle = createAsyncThunk<
  Vehicle,
  VehicleInput,
  { rejectValue: string }
>("vehicles/create", async (input, { rejectWithValue }) => {
  try {
    const errors = validateVehicle({
      ...input,
      bus_number: input.bus_number ?? "",
    });
    if (Object.keys(errors).length > 0) {
      return rejectWithValue(Object.values(errors)[0]);
    }

    const appUser = await getCurrentAppUser();
    if (!appUser) return rejectWithValue("Your session expired");
    if (appUser.role !== "admin") {
      return rejectWithValue("Only admins can add vehicles");
    }

    const number = input.bus_number.trim().toUpperCase();

    const { data: existing } = await supabase
      .from("vehicles")
      .select("id")
      .ilike("bus_number", number)
      .maybeSingle();

    if (existing) {
      return rejectWithValue(`${number} is already in the fleet`);
    }

    // Image is uploaded under the registration number rather than
    // the row id, since the row doesn't exist yet
    let imageUrl: string | null = null;
    if (input.image_uri && input.image_base64) {
      imageUrl = await uploadVehicleImage(
        { base64: input.image_base64, uri: input.image_uri },
        number.replace(/[^A-Z0-9]/gi, "")
      );
    }

    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        ...buildPayload(input),
        bus_number: number,
        image: imageUrl,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return rejectWithValue(`${number} is already in the fleet`);
      }
      return rejectWithValue(error.message);
    }

    const { data: full } = await supabase
      .from("vehicle_directory")
      .select("*")
      .eq("id", data.id)
      .single();

    return full as Vehicle;
  } catch (err: any) {
    return rejectWithValue(err.message ?? "Couldn't add vehicle");
  }
});

// ============================================================
// UPDATE — only changed fields
// ============================================================
export const updateVehicle = createAsyncThunk<
  Vehicle,
  { id: string; changes: Partial<VehicleInput> },
  { rejectValue: string }
>("vehicles/update", async ({ id, changes }, { rejectWithValue }) => {
  try {
    const errors = validateVehicle(changes);
    if (Object.keys(errors).length > 0) {
      return rejectWithValue(Object.values(errors)[0]);
    }

    // Registration numbers must stay unique
    if (changes.bus_number !== undefined) {
      const number = changes.bus_number.trim().toUpperCase();
      const { data: clash } = await supabase
        .from("vehicles")
        .select("id")
        .ilike("bus_number", number)
        .neq("id", id)
        .maybeSingle();

      if (clash) {
        return rejectWithValue(`${number} belongs to another vehicle`);
      }
    }

    const payload = buildPayload(changes);

    // Image: null removes it, base64 means a new pick, an
    // https:// URI with no base64 means unchanged
    if (changes.image_uri !== undefined) {
      if (changes.image_uri === null) {
        payload.image = null;
      } else if (changes.image_base64) {
        payload.image = await uploadVehicleImage(
          { base64: changes.image_base64, uri: changes.image_uri },
          id
        );
      }
    }

    if (Object.keys(payload).length === 0) {
      return rejectWithValue("Nothing to update");
    }

    const { data, error } = await supabase
      .from("vehicles")
      .update(payload)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return rejectWithValue(error.message);
    if (!data) {
      return rejectWithValue("You don't have permission to edit this vehicle");
    }

    const { data: full } = await supabase
      .from("vehicle_directory")
      .select("*")
      .eq("id", id)
      .single();

    return full as Vehicle;
  } catch (err: any) {
    return rejectWithValue(err.message ?? "Couldn't save changes");
  }
});

// ============================================================
// RETIRE / RESTORE
//
// Deactivating is the normal path. A vehicle in service history
// shouldn't vanish, and its driver needs unassigning first.
// ============================================================
export const setVehicleActive = createAsyncThunk<
  { id: string; is_active: boolean },
  { id: string; is_active: boolean },
  { rejectValue: string }
>("vehicles/setActive", async ({ id, is_active }, { rejectWithValue }) => {
  try {
    if (!is_active) {
      const { data: assigned } = await supabase
        .from("drivers")
        .select("id, users(name)")
        .eq("vehicle_id", id)
        .maybeSingle();

      if (assigned) {
        const who = (assigned as any).users?.name ?? "a driver";
        return rejectWithValue(
          `${who} is still assigned to this vehicle. Unassign them first.`
        );
      }
    }

    const { data, error } = await supabase
      .from("vehicles")
      .update({ is_active })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return rejectWithValue(error.message);
    if (!data) return rejectWithValue("You don't have permission to do that");

    return { id, is_active };
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

/**
 * Hard delete. Blocked while a driver is assigned — otherwise
 * the driver's vehicle_id silently nulls and nobody notices the
 * bus disappeared from their profile.
 */
export const deleteVehicle = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("vehicles/delete", async (id, { rejectWithValue }) => {
  try {
    const { data: assigned } = await supabase
      .from("drivers")
      .select("id, users(name)")
      .eq("vehicle_id", id)
      .maybeSingle();

    if (assigned) {
      const who = (assigned as any).users?.name ?? "a driver";
      return rejectWithValue(
        `${who} is assigned to this vehicle. Unassign them first.`
      );
    }

    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) return rejectWithValue(error.message);

    return id;
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// FLEET snapshot
// ============================================================
export const fetchFleet = createAsyncThunk<
  FleetSnapshot | null,
  void,
  { rejectValue: string }
>("vehicles/fetchFleet", async (_, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase.rpc("fleet_snapshot");
    if (error) return rejectWithValue(error.message);
    return (data?.[0] ?? null) as FleetSnapshot | null;
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// Slice
// ============================================================
const vehicleSlice = createSlice({
  name: "vehicles",
  initialState,
  reducers: {
    clearVehicleSubmitState: (state) => {
      state.submitError = null;
    },
    clearCurrentVehicle: (state) => {
      state.current = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVehicles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVehicles.fulfilled, (state, action) => {
        state.loading = false;
        state.vehicles = action.payload;
      })
      .addCase(fetchVehicles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Could not load vehicles";
      })

      .addCase(fetchVehicleById.pending, (state) => {
        state.currentLoading = true;
      })
      .addCase(fetchVehicleById.fulfilled, (state, action) => {
        state.currentLoading = false;
        state.current = action.payload;
      })
      .addCase(fetchVehicleById.rejected, (state, action) => {
        state.currentLoading = false;
        state.error = action.payload ?? "Could not load vehicle";
      })

      .addCase(createVehicle.pending, (state) => {
        state.submitting = true;
        state.submitError = null;
      })
      .addCase(createVehicle.fulfilled, (state, action) => {
        state.submitting = false;
        state.vehicles.unshift(action.payload);
      })
      .addCase(createVehicle.rejected, (state, action) => {
        state.submitting = false;
        state.submitError = action.payload ?? "Couldn't add vehicle";
      })

      .addCase(updateVehicle.pending, (state) => {
        state.submitting = true;
        state.submitError = null;
      })
      .addCase(updateVehicle.fulfilled, (state, action) => {
        state.submitting = false;
        const i = state.vehicles.findIndex((v) => v.id === action.payload.id);
        if (i >= 0) state.vehicles[i] = action.payload;
        state.current = action.payload;
      })
      .addCase(updateVehicle.rejected, (state, action) => {
        state.submitting = false;
        state.submitError = action.payload ?? "Couldn't save changes";
      })

      .addCase(setVehicleActive.fulfilled, (state, action) => {
        const v = state.vehicles.find((x) => x.id === action.payload.id);
        if (v) v.is_active = action.payload.is_active;
        if (state.current?.id === action.payload.id) {
          state.current.is_active = action.payload.is_active;
        }
      })
      .addCase(setVehicleActive.rejected, (state, action) => {
        state.submitError = action.payload ?? "Couldn't update vehicle";
      })

      .addCase(deleteVehicle.fulfilled, (state, action) => {
        state.vehicles = state.vehicles.filter((v) => v.id !== action.payload);
      })
      .addCase(deleteVehicle.rejected, (state, action) => {
        state.submitError = action.payload ?? "Couldn't remove vehicle";
      })

      .addCase(fetchFleet.fulfilled, (state, action) => {
        state.fleet = action.payload;
      });
  },
});

export const { clearVehicleSubmitState, clearCurrentVehicle } =
  vehicleSlice.actions;
export default vehicleSlice.reducer;