import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";

// ============================================================
// Types
// ============================================================
export interface RouteStop {
  id: string;
  route_id: string;
  name: string;
  sequence: number;
  pickup_time: string | null;
  drop_time: string | null;
}

export interface Route {
  id: string;
  name: string;
  start_point: string | null;
  end_point: string | null;
  default_fee: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface RouteSummary extends Route {
  stop_count: number;
  student_count: number;
  driver_count: number;
  driver_name: string | null;
}

export interface RouteInput {
  name: string;
  start_point?: string;
  end_point?: string;
  default_fee?: number;
  notes?: string;
  stops?: { name: string; pickup_time?: string | null }[];
}

interface RouteState {
  routes: Route[];               // active only — feeds the admission picker
  summaries: RouteSummary[];     // full list for the admin screen
  stops: Record<string, RouteStop[]>;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  submitError: string | null;
}

const initialState: RouteState = {
  routes: [],
  summaries: [],
  stops: {},
  loading: false,
  submitting: false,
  error: null,
  submitError: null,
};

// ============================================================
// Validation
// ============================================================
export const validateRoute = (input: RouteInput): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!input.name?.trim() || input.name.trim().length < 3) {
    errors.name = "Give the route a name of at least 3 characters";
  }
  if (!input.start_point?.trim()) {
    errors.start_point = "Enter where the route starts";
  }
  if (!input.end_point?.trim()) {
    errors.end_point = "Enter where the route ends";
  }
  if (input.default_fee != null && input.default_fee < 0) {
    errors.default_fee = "Fee cannot be negative";
  }

  const named = (input.stops ?? []).filter((s) => s.name.trim());
  const hasDupe = named.some(
    (s, i) =>
      named.findIndex(
        (o) => o.name.trim().toLowerCase() === s.name.trim().toLowerCase()
      ) !== i
  );
  if (hasDupe) {
    errors.stops = "Two stops have the same name";
  }

  return errors;
};

// ============================================================
// Fetch — active routes (used by the admission form picker)
// ============================================================
export const fetchRoutes = createAsyncThunk<
  Route[],
  void,
  { rejectValue: string }
>("routes/fetchRoutes", async (_, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase
      .from("routes")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) return rejectWithValue(error.message);
    return (data ?? []) as Route[];
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// Fetch — summaries with counts (admin routes screen)
// ============================================================
export const fetchRouteSummaries = createAsyncThunk<
  RouteSummary[],
  void,
  { rejectValue: string }
>("routes/fetchSummaries", async (_, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase
      .from("route_summary")
      .select("*")
      .order("is_active", { ascending: false })
      .order("name");

    if (error) return rejectWithValue(error.message);
    return (data ?? []) as RouteSummary[];
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// Fetch — stops for one route
// ============================================================
export const fetchRouteStops = createAsyncThunk<
  { routeId: string; stops: RouteStop[] },
  string,
  { rejectValue: string }
>("routes/fetchStops", async (routeId, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase
      .from("route_stops")
      .select("*")
      .eq("route_id", routeId)
      .order("sequence");

    if (error) return rejectWithValue(error.message);
    return { routeId, stops: (data ?? []) as RouteStop[] };
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// Create route (+ its stops in one flow)
// ============================================================
export const createRoute = createAsyncThunk<
  Route,
  RouteInput,
  { rejectValue: string }
>("routes/create", async (input, { rejectWithValue }) => {
  try {
    const errors = validateRoute(input);
    if (Object.keys(errors).length > 0) {
      return rejectWithValue(Object.values(errors)[0]);
    }

    // Reject duplicate route names — the picker becomes useless otherwise
    const { data: existing } = await supabase
      .from("routes")
      .select("id")
      .ilike("name", input.name.trim())
      .maybeSingle();

    if (existing) {
      return rejectWithValue("A route with that name already exists");
    }

    const { data: route, error } = await supabase
      .from("routes")
      .insert({
        name: input.name.trim(),
        start_point: input.start_point?.trim() || null,
        end_point: input.end_point?.trim() || null,
        default_fee: input.default_fee ?? 0,
        notes: input.notes?.trim() || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) return rejectWithValue(error.message);

    // Insert stops in the order they were entered
    const stops = (input.stops ?? []).filter((s) => s.name.trim());
    if (stops.length > 0) {
      const { error: stopError } = await supabase.from("route_stops").insert(
        stops.map((s, i) => ({
          route_id: route.id,
          name: s.name.trim(),
          sequence: i + 1,
          pickup_time: s.pickup_time || null,
        }))
      );

      // The route exists even if stops failed — surface it, don't roll back
      if (stopError) {
        return rejectWithValue(
          `Route created, but stops failed: ${stopError.message}`
        );
      }
    }

    return route as Route;
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// Update route details
// ============================================================
export const updateRoute = createAsyncThunk<
  Route,
  { id: string; changes: Partial<RouteInput> },
  { rejectValue: string }
>("routes/update", async ({ id, changes }, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase
      .from("routes")
      .update({
        ...(changes.name && { name: changes.name.trim() }),
        ...(changes.start_point !== undefined && {
          start_point: changes.start_point?.trim() || null,
        }),
        ...(changes.end_point !== undefined && {
          end_point: changes.end_point?.trim() || null,
        }),
        ...(changes.default_fee !== undefined && {
          default_fee: changes.default_fee,
        }),
        ...(changes.notes !== undefined && {
          notes: changes.notes?.trim() || null,
        }),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return rejectWithValue(error.message);
    return data as Route;
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// Toggle active — never hard-delete a route with students on it
// ============================================================
export const toggleRouteActive = createAsyncThunk<
  { id: string; is_active: boolean },
  { id: string; is_active: boolean },
  { rejectValue: string }
>("routes/toggleActive", async ({ id, is_active }, { rejectWithValue }) => {
  try {
    if (!is_active) {
      const { count } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("route_id", id)
        .eq("status", "active");

      if ((count ?? 0) > 0) {
        return rejectWithValue(
          `${count} active student${count === 1 ? " is" : "s are"} still on this route. Reassign them first.`
        );
      }
    }

    const { error } = await supabase
      .from("routes")
      .update({ is_active })
      .eq("id", id);

    if (error) return rejectWithValue(error.message);
    return { id, is_active };
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// Add / remove a single stop on an existing route
// ============================================================
export const addRouteStop = createAsyncThunk<
  RouteStop,
  { routeId: string; name: string; pickup_time?: string },
  { rejectValue: string }
>(
  "routes/addStop",
  async ({ routeId, name, pickup_time }, { rejectWithValue }) => {
    try {
      const { data: last } = await supabase
        .from("route_stops")
        .select("sequence")
        .eq("route_id", routeId)
        .order("sequence", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data, error } = await supabase
        .from("route_stops")
        .insert({
          route_id: routeId,
          name: name.trim(),
          sequence: (last?.sequence ?? 0) + 1,
          pickup_time: pickup_time || null,
        })
        .select()
        .single();

      if (error) return rejectWithValue(error.message);
      return data as RouteStop;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

export const deleteRouteStop = createAsyncThunk<
  { routeId: string; stopId: string },
  { routeId: string; stopId: string },
  { rejectValue: string }
>("routes/deleteStop", async ({ routeId, stopId }, { rejectWithValue }) => {
  try {
    const { error } = await supabase
      .from("route_stops")
      .delete()
      .eq("id", stopId);

    if (error) return rejectWithValue(error.message);

    // Close the gap so sequences stay 1..n
    await supabase.rpc("resequence_route_stops", { p_route_id: routeId });

    return { routeId, stopId };
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// Slice
// ============================================================
const routeSlice = createSlice({
  name: "routes",
  initialState,
  reducers: {
    clearRouteSubmitState: (state) => {
      state.submitError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoutes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRoutes.fulfilled, (state, action) => {
        state.loading = false;
        state.routes = action.payload;
      })
      .addCase(fetchRoutes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Could not load routes";
      })

      .addCase(fetchRouteSummaries.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchRouteSummaries.fulfilled, (state, action) => {
        state.loading = false;
        state.summaries = action.payload;
      })
      .addCase(fetchRouteSummaries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Could not load routes";
      })

      .addCase(fetchRouteStops.fulfilled, (state, action) => {
        state.stops[action.payload.routeId] = action.payload.stops;
      })

      .addCase(createRoute.pending, (state) => {
        state.submitting = true;
        state.submitError = null;
      })
      .addCase(createRoute.fulfilled, (state, action) => {
        state.submitting = false;
        state.routes.push(action.payload);
        state.routes.sort((a, b) => a.name.localeCompare(b.name));
      })
      .addCase(createRoute.rejected, (state, action) => {
        state.submitting = false;
        state.submitError = action.payload ?? "Could not create route";
      })

      .addCase(updateRoute.fulfilled, (state, action) => {
        const i = state.routes.findIndex((r) => r.id === action.payload.id);
        if (i >= 0) state.routes[i] = action.payload;
        const j = state.summaries.findIndex((r) => r.id === action.payload.id);
        if (j >= 0)
          state.summaries[j] = { ...state.summaries[j], ...action.payload };
      })

      .addCase(toggleRouteActive.fulfilled, (state, action) => {
        const s = state.summaries.find((r) => r.id === action.payload.id);
        if (s) s.is_active = action.payload.is_active;
        if (!action.payload.is_active) {
          state.routes = state.routes.filter((r) => r.id !== action.payload.id);
        }
      })
      .addCase(toggleRouteActive.rejected, (state, action) => {
        state.submitError = action.payload ?? "Could not update route";
      })

      .addCase(addRouteStop.fulfilled, (state, action) => {
        const list = state.stops[action.payload.route_id] ?? [];
        state.stops[action.payload.route_id] = [...list, action.payload];
      })
      .addCase(deleteRouteStop.fulfilled, (state, action) => {
        const list = state.stops[action.payload.routeId] ?? [];
        state.stops[action.payload.routeId] = list
          .filter((s) => s.id !== action.payload.stopId)
          .map((s, i) => ({ ...s, sequence: i + 1 }));
      });
  },
});

export const { clearRouteSubmitState } = routeSlice.actions;
export default routeSlice.reducer;