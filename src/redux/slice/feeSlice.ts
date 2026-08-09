import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";

// ============================================================
// Types
// ============================================================
export type FeeMethod = "cash" | "upi" | "card" | "bank" | "cheque";

export interface StudentFeeStatus {
  student_id: string;
  student_name: string;
  student_photo: string | null;
  parent_name: string;
  parent_phone: string;
  route_id: string | null;
  route_name: string | null;
  monthly_fee: number;
  paid: number;
  balance: number;
  last_paid_on: string | null;
  payment_count: number;
}

export interface FeePayment {
  id: string;
  student_id: string;
  amount: number;
  period: string;
  paid_on: string;
  method: FeeMethod | null;
  note: string | null;
  receipt_no: string | null;
  collected_by: string | null;
  created_at: string;
  students?: { id: string; student_name: string } | null;
  collector?: { id: string; name: string } | null;
}

export interface FeeInput {
  student_id: string;
  amount: number;
  period: string;
  paid_on: string;
  method?: FeeMethod;
  note?: string;
}

export interface DashboardSnapshot {
  period: string;
  fees: {
    billed: number;
    collected: number;
    pending: number;
    pending_students: number;
    percent: number;
  };
  students: {
    active: number;
    pending: number;
    unassigned: number;
    new_this_month: number;
  };
  drivers: {
    total: number;
    active: number;
    on_leave: number;
    inactive: number;
    docs_expiring: number;
  };
  payroll: {
    total_salary: number;
    total_paid: number;
    outstanding: number;
  };
  fleet: {
    active: number;
    unassigned: number;
    service_due: number;
    docs_expiring: number;
  };
  routes: { active: number };
}

export interface TrendPoint {
  period: string;
  collected: number;
}

interface FeeState {
  dashboard: DashboardSnapshot | null;
  dashboardLoading: boolean;
  dashboardError: string | null;

  trend: TrendPoint[];

  statuses: StudentFeeStatus[];
  statusesLoading: boolean;

  payments: FeePayment[];
  paymentsLoading: boolean;

  submitting: boolean;
  submitError: string | null;
}

const initialState: FeeState = {
  dashboard: null,
  dashboardLoading: false,
  dashboardError: null,
  trend: [],
  statuses: [],
  statusesLoading: false,
  payments: [],
  paymentsLoading: false,
  submitting: false,
  submitError: null,
};

// ============================================================
// Date helpers
//
// Built from local parts, never toISOString() — in IST that
// shifts a 1st-of-month date into the previous month.
// ============================================================
const pad = (n: number) => String(n).padStart(2, "0");

export const currentFeePeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const recentFeePeriods = (count = 12) => {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  }
  return out;
};

// ============================================================
// Validation
// ============================================================
export const validateFeePayment = (
  input: Partial<FeeInput>
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!input.student_id) errors.student_id = "Pick a student";
  if (input.amount == null || input.amount <= 0) {
    errors.amount = "Enter an amount greater than zero";
  }
  if (input.period && !/^\d{4}-\d{2}$/.test(input.period)) {
    errors.period = "Pick a valid month";
  }
  if (input.paid_on && !/^\d{4}-\d{2}-\d{2}$/.test(input.paid_on)) {
    errors.paid_on = "Use YYYY-MM-DD";
  }

  return errors;
};

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

// ============================================================
// DASHBOARD — one RPC for the whole home screen
// ============================================================
export const fetchDashboard = createAsyncThunk<
  DashboardSnapshot,
  string | undefined,
  { rejectValue: string }
>("fees/fetchDashboard", async (period, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase.rpc("admin_dashboard", {
      p_period: period ?? null,
    });

    if (error) return rejectWithValue(error.message);
    if (!data) return rejectWithValue("No dashboard data returned");
    return data as DashboardSnapshot;
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

export const fetchTrend = createAsyncThunk<
  TrendPoint[],
  number | undefined,
  { rejectValue: string }
>("fees/fetchTrend", async (months, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase.rpc("fee_collection_trend", {
      p_months: months ?? 6,
    });

    if (error) return rejectWithValue(error.message);
    return (data ?? []) as TrendPoint[];
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// STUDENT FEE STATUS for a period
// ============================================================
export const fetchFeeStatuses = createAsyncThunk<
  StudentFeeStatus[],
  { period?: string } | undefined,
  { rejectValue: string }
>("fees/fetchStatuses", async (args, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase.rpc("student_fee_status", {
      p_period: args?.period ?? null,
    });

    if (error) return rejectWithValue(error.message);
    return (data ?? []) as StudentFeeStatus[];
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// PAYMENT LEDGER
// ============================================================
export const fetchPayments = createAsyncThunk<
  FeePayment[],
  { period?: string; studentId?: string; limit?: number } | undefined,
  { rejectValue: string }
>("fees/fetchPayments", async (args, { rejectWithValue }) => {
  try {
    let query = supabase
      .from("fee_payments")
      .select(
        "*, students(id, student_name), collector:collected_by(id, name)"
      )
      .order("paid_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(args?.limit ?? 50);

    if (args?.period) query = query.eq("period", args.period);
    if (args?.studentId) query = query.eq("student_id", args.studentId);

    const { data, error } = await query;
    if (error) return rejectWithValue(error.message);
    return (data ?? []) as FeePayment[];
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

export const recordFeePayment = createAsyncThunk<
  FeePayment,
  FeeInput,
  { rejectValue: string }
>("fees/record", async (input, { rejectWithValue }) => {
  try {
    const errors = validateFeePayment(input);
    if (Object.keys(errors).length > 0) {
      return rejectWithValue(Object.values(errors)[0]);
    }

    const appUser = await getCurrentAppUser();
    if (!appUser) return rejectWithValue("Your session expired");
    if (appUser.role !== "admin") {
      return rejectWithValue("Only admins can record fee payments");
    }

    const { data, error } = await supabase
      .from("fee_payments")
      .insert({
        student_id: input.student_id,
        amount: input.amount,
        period: input.period,
        month: input.period, // legacy column from 01_schema
        paid_on: input.paid_on,
        paid_at: new Date().toISOString(),
        method: input.method || null,
        note: input.note?.trim() || null,
        status: "paid",
        collected_by: appUser.id,
      })
      .select("*, students(id, student_name), collector:collected_by(id, name)")
      .single();

    if (error) return rejectWithValue(error.message);
    return data as FeePayment;
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

export const deleteFeePayment = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("fees/delete", async (paymentId, { rejectWithValue }) => {
  try {
    const { error } = await supabase
      .from("fee_payments")
      .delete()
      .eq("id", paymentId);

    if (error) return rejectWithValue(error.message);
    return paymentId;
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// Slice
// ============================================================
const feeSlice = createSlice({
  name: "fees",
  initialState,
  reducers: {
    clearFeeSubmitState: (state) => {
      state.submitError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state) => {
        state.dashboardLoading = true;
        state.dashboardError = null;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.dashboardLoading = false;
        state.dashboard = action.payload;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.dashboardLoading = false;
        state.dashboardError = action.payload ?? "Could not load dashboard";
      })

      .addCase(fetchTrend.fulfilled, (state, action) => {
        state.trend = action.payload;
      })

      .addCase(fetchFeeStatuses.pending, (state) => {
        state.statusesLoading = true;
      })
      .addCase(fetchFeeStatuses.fulfilled, (state, action) => {
        state.statusesLoading = false;
        state.statuses = action.payload;
      })
      .addCase(fetchFeeStatuses.rejected, (state, action) => {
        state.statusesLoading = false;
        state.submitError = action.payload ?? "Could not load fee status";
      })

      .addCase(fetchPayments.pending, (state) => {
        state.paymentsLoading = true;
      })
      .addCase(fetchPayments.fulfilled, (state, action) => {
        state.paymentsLoading = false;
        state.payments = action.payload;
      })
      .addCase(fetchPayments.rejected, (state) => {
        state.paymentsLoading = false;
      })

      .addCase(recordFeePayment.pending, (state) => {
        state.submitting = true;
        state.submitError = null;
      })
      .addCase(recordFeePayment.fulfilled, (state, action) => {
        state.submitting = false;
        state.payments.unshift(action.payload);

        // Optimistically fold into the matching status row so the
        // list updates before the refetch lands
        const s = state.statuses.find(
          (x) => x.student_id === action.payload.student_id
        );
        if (s) {
          s.paid = Number(s.paid) + Number(action.payload.amount);
          s.balance = Number(s.monthly_fee) - s.paid;
          s.last_paid_on = action.payload.paid_on;
          s.payment_count += 1;
        }
      })
      .addCase(recordFeePayment.rejected, (state, action) => {
        state.submitting = false;
        state.submitError = action.payload ?? "Couldn't record payment";
      })

      .addCase(deleteFeePayment.fulfilled, (state, action) => {
        state.payments = state.payments.filter((p) => p.id !== action.payload);
      })
      .addCase(deleteFeePayment.rejected, (state, action) => {
        state.submitError = action.payload ?? "Couldn't delete payment";
      });
  },
});

export const { clearFeeSubmitState } = feeSlice.actions;
export default feeSlice.reducer;