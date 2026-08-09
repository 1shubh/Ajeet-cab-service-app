import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";
import { decode } from "base64-arraybuffer";

// ============================================================
// Types
// ============================================================
export interface Student {
  id: string;
  student_name: string;
  student_photo: string | null;
  school_name: string;
  address: string;
  class_name: string | null;
  date_of_birth: string | null;
  parent_name: string;
  parent_phone: string;
  parent_user_id: string | null;
  route_id: string | null;
  pickup_stop: string | null;
  monthly_fee: number;
  admitted_by: string;
  admitted_by_role: "admin" | "driver";
  admission_date: string;
  status: "active" | "inactive" | "pending";
  created_at: string;
  updated_at: string;
  routes?: { id: string; name: string } | null;
  admitter?: { id: string; name: string; role: string } | null;
}

export interface AdmissionInput {
  student_name: string;
  /** Local file:// URI when freshly picked, https:// when unchanged, null when removed */
  student_photo_uri?: string | null;
  /** Present only when the image was just picked — this is what gets uploaded */
  student_photo_base64?: string | null;
  school_name: string;
  address: string;
  class_name?: string;
  parent_name: string;
  parent_phone: string;
  route_id?: string | null;
  pickup_stop?: string;
  monthly_fee?: number;
}

export interface DriverAdmissionStats {
  driver_id: string;
  user_id: string;
  driver_name: string;
  total_admissions: number;
  active_admissions: number;
  admissions_this_month: number;
}

interface AdmissionState {
  // List
  students: Student[];
  page: number;
  hasMore: boolean;
  listLoading: boolean;
  listError: string | null;

  // Single record (detail / edit screens)
  current: Student | null;
  currentLoading: boolean;
  currentError: string | null;

  // Create / update
  submitting: boolean;
  submitError: string | null;
  lastCreated: Student | null;
  uploadProgress: number; // 0–100

  // Stats
  myStats: DriverAdmissionStats | null;
  allDriverStats: DriverAdmissionStats[];
  statsLoading: boolean;
}

const PAGE_SIZE = 20;

const SELECT_WITH_RELATIONS =
  "*, routes(id, name), admitter:admitted_by(id, name, role)";

const initialState: AdmissionState = {
  students: [],
  page: 0,
  hasMore: true,
  listLoading: false,
  listError: null,

  current: null,
  currentLoading: false,
  currentError: null,

  submitting: false,
  submitError: null,
  lastCreated: null,
  uploadProgress: 0,

  myStats: null,
  allDriverStats: [],
  statsLoading: false,
};

// ============================================================
// Validation
//
// Only checks keys that are actually present, so the same
// function serves a full create and a partial edit.
// ============================================================
export const validateAdmission = (
  input: Partial<AdmissionInput>
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (input.student_name !== undefined) {
    if (!input.student_name.trim() || input.student_name.trim().length < 2) {
      errors.student_name = "Enter the student's full name";
    }
  }
  if (input.parent_name !== undefined) {
    if (!input.parent_name.trim() || input.parent_name.trim().length < 2) {
      errors.parent_name = "Enter the parent or guardian's name";
    }
  }
  if (input.parent_phone !== undefined) {
    if (!/^[0-9]{10}$/.test(input.parent_phone.trim())) {
      errors.parent_phone = "Enter a valid 10-digit mobile number";
    }
  }
  if (input.school_name !== undefined) {
    if (!input.school_name.trim()) {
      errors.school_name = "Enter the school name";
    }
  }
  if (input.address !== undefined) {
    if (!input.address.trim() || input.address.trim().length < 10) {
      errors.address = "Enter a full pickup address";
    }
  }
  if (input.monthly_fee != null && input.monthly_fee < 0) {
    errors.monthly_fee = "Fee cannot be negative";
  }

  return errors;
};

/**
 * Create requires every required field to be present, not just
 * valid-if-given. Forcing the keys in makes a missing field fail
 * rather than silently pass.
 */
export const validateNewAdmission = (
  input: AdmissionInput
): Record<string, string> =>
  validateAdmission({
    student_name: input.student_name ?? "",
    parent_name: input.parent_name ?? "",
    parent_phone: input.parent_phone ?? "",
    school_name: input.school_name ?? "",
    address: input.address ?? "",
    monthly_fee: input.monthly_fee,
  });

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
 * Uploads a photo picked by expo-image-picker.
 *
 * The picker is asked for `base64: true`, so the bytes arrive
 * with the asset and there's no filesystem read here at all.
 * That avoids expo-file-system entirely — its EncodingType API
 * moved to `expo-file-system/legacy` in SDK 54 and reading
 * `.Base64` off the new module throws.
 */
const uploadStudentPhoto = async (
  photo: { base64: string; uri: string },
  ownerId: string
): Promise<string> => {
  const ext = photo.uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const contentType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const path = `${ownerId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("student-photos")
    .upload(path, decode(photo.base64), { contentType, upsert: false });

  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  const { data } = supabase.storage.from("student-photos").getPublicUrl(path);
  return data.publicUrl;
};

// ============================================================
// CREATE
// ============================================================
export const createAdmission = createAsyncThunk<
  Student,
  AdmissionInput,
  { rejectValue: string }
>("admissions/create", async (input, { rejectWithValue, dispatch }) => {
  try {
    const errors = validateNewAdmission(input);
    if (Object.keys(errors).length > 0) {
      return rejectWithValue(Object.values(errors)[0]);
    }

    const appUser = await getCurrentAppUser();
    if (!appUser) {
      return rejectWithValue("Your session expired. Sign in again.");
    }
    if (!["admin", "driver"].includes(appUser.role)) {
      return rejectWithValue("You don't have permission to admit students");
    }

    // Friendlier than letting the unique index throw
    const { data: existing } = await supabase
      .from("students")
      .select("id")
      .ilike("student_name", input.student_name.trim())
      .eq("parent_phone", input.parent_phone.trim())
      .neq("status", "inactive")
      .maybeSingle();

    if (existing) {
      return rejectWithValue(
        "This student is already admitted under that parent number"
      );
    }

    let photoUrl: string | null = null;
    if (input.student_photo_uri && input.student_photo_base64) {
      dispatch(setUploadProgress(30));
      photoUrl = await uploadStudentPhoto(
        { base64: input.student_photo_base64, uri: input.student_photo_uri },
        appUser.id
      );
      dispatch(setUploadProgress(70));
    }

    const { data, error } = await supabase
      .from("students")
      .insert({
        student_name: input.student_name.trim(),
        student_photo: photoUrl,
        school_name: input.school_name.trim(),
        address: input.address.trim(),
        class_name: input.class_name?.trim() || null,
        parent_name: input.parent_name.trim(),
        parent_phone: input.parent_phone.trim(),
        route_id: input.route_id || null,
        pickup_stop: input.pickup_stop?.trim() || null,
        monthly_fee: input.monthly_fee ?? 0,
        admitted_by: appUser.id,
        admitted_by_role: appUser.role,
        status: input.route_id ? "active" : "pending",
      })
      .select(SELECT_WITH_RELATIONS)
      .single();

    if (error) return rejectWithValue(error.message);

    dispatch(setUploadProgress(100));
    return data as Student;
  } catch (err: any) {
    return rejectWithValue(err.message ?? "Admission failed");
  }
});

// ============================================================
// UPDATE
//
// Only the fields present in `changes` are sent, so two people
// editing different fields on the same student don't clobber
// each other's work.
// ============================================================
export const updateStudent = createAsyncThunk<
  Student,
  { id: string; changes: Partial<AdmissionInput> },
  { rejectValue: string }
>(
  "admissions/update",
  async ({ id, changes }, { rejectWithValue, dispatch }) => {
    try {
      const errors = validateAdmission(changes);
      if (Object.keys(errors).length > 0) {
        return rejectWithValue(Object.values(errors)[0]);
      }

      const appUser = await getCurrentAppUser();
      if (!appUser) return rejectWithValue("Your session expired");

      const { data: currentRow } = await supabase
        .from("students")
        .select("student_name, parent_phone, status")
        .eq("id", id)
        .maybeSingle();

      if (!currentRow) {
        return rejectWithValue("Student not found or access denied");
      }

      // Duplicate guard when renaming or changing the parent number
      if (changes.student_name || changes.parent_phone) {
        const nextName = changes.student_name ?? currentRow.student_name;
        const nextPhone = changes.parent_phone ?? currentRow.parent_phone;

        const { data: clash } = await supabase
          .from("students")
          .select("id")
          .ilike("student_name", nextName.trim())
          .eq("parent_phone", nextPhone.trim())
          .neq("id", id)
          .neq("status", "inactive")
          .maybeSingle();

        if (clash) {
          return rejectWithValue(
            "Another student with that name and parent number already exists"
          );
        }
      }

      const payload: Record<string, any> = {};

      // Photo handling:
      //   null            -> user removed it
      //   base64 present  -> user picked a new one, upload it
      //   neither         -> unchanged https:// URL, leave the column alone
      if (changes.student_photo_uri !== undefined) {
        if (changes.student_photo_uri === null) {
          payload.student_photo = null;
        } else if (changes.student_photo_base64) {
          dispatch(setUploadProgress(40));
          payload.student_photo = await uploadStudentPhoto(
            {
              base64: changes.student_photo_base64,
              uri: changes.student_photo_uri,
            },
            appUser.id
          );
          dispatch(setUploadProgress(80));
        }
      }

      if (changes.student_name !== undefined)
        payload.student_name = changes.student_name.trim();
      if (changes.school_name !== undefined)
        payload.school_name = changes.school_name.trim();
      if (changes.address !== undefined)
        payload.address = changes.address.trim();
      if (changes.class_name !== undefined)
        payload.class_name = changes.class_name?.trim() || null;
      if (changes.parent_name !== undefined)
        payload.parent_name = changes.parent_name.trim();
      if (changes.parent_phone !== undefined)
        payload.parent_phone = changes.parent_phone.trim();
      if (changes.pickup_stop !== undefined)
        payload.pickup_stop = changes.pickup_stop?.trim() || null;
      if (changes.monthly_fee !== undefined)
        payload.monthly_fee = changes.monthly_fee;

      // Assigning a route to a pending student activates them
      if (changes.route_id !== undefined) {
        payload.route_id = changes.route_id || null;
        if (changes.route_id && currentRow.status === "pending") {
          payload.status = "active";
        }
      }

      if (Object.keys(payload).length === 0) {
        return rejectWithValue("Nothing to update");
      }

      const { data, error } = await supabase
        .from("students")
        .update(payload)
        .eq("id", id)
        .select(SELECT_WITH_RELATIONS)
        .maybeSingle();

      if (error) return rejectWithValue(error.message);
      // RLS returns no row when the caller isn't allowed to edit it
      if (!data) {
        return rejectWithValue(
          "You don't have permission to edit this student"
        );
      }

      dispatch(setUploadProgress(100));
      return data as Student;
    } catch (err: any) {
      return rejectWithValue(err.message ?? "Update failed");
    }
  }
);

// ============================================================
// STATUS — activate / deactivate without opening the full form
// ============================================================
export const setStudentStatus = createAsyncThunk<
  { id: string; status: Student["status"] },
  { id: string; status: Student["status"] },
  { rejectValue: string }
>("admissions/setStatus", async ({ id, status }, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase
      .from("students")
      .update({ status })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return rejectWithValue(error.message);
    if (!data) return rejectWithValue("You don't have permission to do that");

    return { id, status };
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// FETCH ONE — detail and edit screens
// ============================================================
export const fetchStudentById = createAsyncThunk<
  Student,
  string,
  { rejectValue: string }
>("admissions/fetchOne", async (id, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase
      .from("students")
      .select(SELECT_WITH_RELATIONS)
      .eq("id", id)
      .maybeSingle();

    if (error) return rejectWithValue(error.message);
    if (!data) return rejectWithValue("Student not found or access denied");
    return data as Student;
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// FETCH LIST — paginated, searchable, filterable
//
// RLS already scopes what a driver can see. `scope: 'mine'`
// narrows further to only their own admissions.
// ============================================================
export const fetchStudents = createAsyncThunk<
  { students: Student[]; page: number; hasMore: boolean },
  | {
      page?: number;
      scope?: "all" | "mine";
      search?: string;
      status?: Student["status"] | "all";
      routeId?: string | null;
    }
  | undefined,
  { rejectValue: string }
>("admissions/fetchStudents", async (args, { rejectWithValue }) => {
  try {
    const page = args?.page ?? 0;
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("students")
      .select(SELECT_WITH_RELATIONS)
      .order("admission_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (args?.scope === "mine") {
      const appUser = await getCurrentAppUser();
      if (appUser) query = query.eq("admitted_by", appUser.id);
    }

    if (args?.status && args.status !== "all") {
      query = query.eq("status", args.status);
    }

    if (args?.routeId) {
      query = query.eq("route_id", args.routeId);
    }

    if (args?.search?.trim()) {
      const term = `%${args.search.trim()}%`;
      query = query.or(
        `student_name.ilike.${term},parent_name.ilike.${term},parent_phone.ilike.${term},school_name.ilike.${term}`
      );
    }

    const { data, error } = await query;
    if (error) return rejectWithValue(error.message);

    return {
      students: (data ?? []) as Student[],
      page,
      hasMore: (data?.length ?? 0) === PAGE_SIZE,
    };
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// STATS — the signed-in driver's own counts
// ============================================================
export const fetchMyAdmissionStats = createAsyncThunk<
  DriverAdmissionStats | null,
  void,
  { rejectValue: string }
>("admissions/fetchMyStats", async (_, { rejectWithValue }) => {
  try {
    const appUser = await getCurrentAppUser();
    if (!appUser) return rejectWithValue("No active session");

    const { data, error } = await supabase
      .from("driver_admission_stats")
      .select("*")
      .eq("user_id", appUser.id)
      .maybeSingle();

    if (error) return rejectWithValue(error.message);
    return (data as DriverAdmissionStats) ?? null;
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// STATS — every driver, ranked (admin view)
// ============================================================
export const fetchAllDriverStats = createAsyncThunk<
  DriverAdmissionStats[],
  void,
  { rejectValue: string }
>("admissions/fetchAllDriverStats", async (_, { rejectWithValue }) => {
  try {
    const { data, error } = await supabase
      .from("driver_admission_stats")
      .select("*")
      .order("total_admissions", { ascending: false });

    if (error) return rejectWithValue(error.message);
    return (data ?? []) as DriverAdmissionStats[];
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

// ============================================================
// Slice
// ============================================================
const admissionSlice = createSlice({
  name: "admissions",
  initialState,
  reducers: {
    setUploadProgress: (state, action: PayloadAction<number>) => {
      state.uploadProgress = action.payload;
    },
    clearSubmitState: (state) => {
      state.submitError = null;
      state.lastCreated = null;
      state.uploadProgress = 0;
    },
    clearCurrent: (state) => {
      state.current = null;
      state.currentError = null;
    },
    resetStudentList: (state) => {
      state.students = [];
      state.page = 0;
      state.hasMore = true;
      state.listError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // ---------------- CREATE ----------------
      .addCase(createAdmission.pending, (state) => {
        state.submitting = true;
        state.submitError = null;
        state.uploadProgress = 10;
      })
      .addCase(createAdmission.fulfilled, (state, action) => {
        state.submitting = false;
        state.lastCreated = action.payload;
        state.students.unshift(action.payload);
        state.uploadProgress = 100;
        if (state.myStats) {
          state.myStats.total_admissions += 1;
          state.myStats.admissions_this_month += 1;
          if (action.payload.status === "active") {
            state.myStats.active_admissions += 1;
          }
        }
      })
      .addCase(createAdmission.rejected, (state, action) => {
        state.submitting = false;
        state.submitError = action.payload ?? "Admission failed";
        state.uploadProgress = 0;
      })

      // ---------------- UPDATE ----------------
      .addCase(updateStudent.pending, (state) => {
        state.submitting = true;
        state.submitError = null;
      })
      .addCase(updateStudent.fulfilled, (state, action) => {
        state.submitting = false;
        state.uploadProgress = 0;
        const i = state.students.findIndex((s) => s.id === action.payload.id);
        if (i >= 0) state.students[i] = action.payload;
        state.current = action.payload;
      })
      .addCase(updateStudent.rejected, (state, action) => {
        state.submitting = false;
        state.uploadProgress = 0;
        state.submitError = action.payload ?? "Update failed";
      })

      // ---------------- STATUS ----------------
      .addCase(setStudentStatus.fulfilled, (state, action) => {
        const s = state.students.find((x) => x.id === action.payload.id);
        if (s) s.status = action.payload.status;
        if (state.current?.id === action.payload.id) {
          state.current.status = action.payload.status;
        }
      })
      .addCase(setStudentStatus.rejected, (state, action) => {
        state.submitError = action.payload ?? "Could not change status";
      })

      // ---------------- FETCH ONE ----------------
      .addCase(fetchStudentById.pending, (state) => {
        state.currentLoading = true;
        state.currentError = null;
      })
      .addCase(fetchStudentById.fulfilled, (state, action) => {
        state.currentLoading = false;
        state.current = action.payload;
      })
      .addCase(fetchStudentById.rejected, (state, action) => {
        state.currentLoading = false;
        state.currentError = action.payload ?? "Could not load student";
      })

      // ---------------- LIST ----------------
      .addCase(fetchStudents.pending, (state) => {
        state.listLoading = true;
        state.listError = null;
      })
      .addCase(fetchStudents.fulfilled, (state, action) => {
        state.listLoading = false;
        state.page = action.payload.page;
        state.hasMore = action.payload.hasMore;
        state.students =
          action.payload.page === 0
            ? action.payload.students
            : [...state.students, ...action.payload.students];
      })
      .addCase(fetchStudents.rejected, (state, action) => {
        state.listLoading = false;
        state.listError = action.payload ?? "Could not load students";
      })

      // ---------------- STATS ----------------
      .addCase(fetchMyAdmissionStats.pending, (state) => {
        state.statsLoading = true;
      })
      .addCase(fetchMyAdmissionStats.fulfilled, (state, action) => {
        state.statsLoading = false;
        state.myStats = action.payload;
      })
      .addCase(fetchMyAdmissionStats.rejected, (state) => {
        state.statsLoading = false;
      })
      .addCase(fetchAllDriverStats.fulfilled, (state, action) => {
        state.allDriverStats = action.payload;
      });
  },
});

export const {
  setUploadProgress,
  clearSubmitState,
  clearCurrent,
  resetStudentList,
} = admissionSlice.actions;

export default admissionSlice.reducer;