import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const saveSessionToSecureStore = async (session: {
  access_token: string;
  refresh_token: string;
  user_id: string;
}) => {
  await SecureStore.setItemAsync("user_session", JSON.stringify(session));
};

export const getSessionFromSecureStore = async () => {
  const stored = await SecureStore.getItemAsync("user_session");
  return stored ? JSON.parse(stored) : null;
};

export const removeSessionFromSecureStore = async () => {
  await SecureStore.deleteItemAsync("user_session");
};
// =======================
// 🔹 Send OTP
// =======================
export const sendOtp = createAsyncThunk(
  "auth/sendOtp",
  async (phone: string, { rejectWithValue }) => {
    try {
      const fullPhone = `91${phone}`;
      // Check if user exists
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("*")
        .eq("phone", fullPhone)
        .maybeSingle();

      if (checkError || !existingUser) {
        return rejectWithValue({
          message: "This phone number is not registered",
          otpSent: false,
        });
      }

      // Send OTP
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });

      if (error) {
        return rejectWithValue({
          message: error.message,
          otpSent: false,
        });
      }

      return {
        phone: fullPhone,
        otpSent: true,
        message: "OTP sent successfully",
      };
    } catch (err: any) {
      return rejectWithValue({
        message: err.message,
        otpSent: false,
      });
    }
  },
);

// =======================
// 🔹 Verify OTP + Link User
// =======================
export const verifyOtp = createAsyncThunk<
  { session: any; user: any; otpVerified: boolean },
  { phone: string; otp: string },
  { rejectValue: { message: string; otpVerified: boolean } }
>("auth/verifyOtp", async ({ phone, otp }, { rejectWithValue }) => {
  try {
    const fullPhone = `91${phone}`;

    // 1️⃣ Verify OTP via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.verifyOtp({
      phone: phone,
      token: otp,
      type: "sms",
    });

    if (authError) {
      return rejectWithValue({
        message: authError.message,
        otpVerified: false,
      });
    }

    const authUser = authData.user;
    if (!authUser) {
      return rejectWithValue({
        message: "OTP verified but user not returned",
        otpVerified: false,
      });
    }

    // 2️⃣ Link users table via auth_id if null
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({ auth_id: authUser.id })
      .eq("phone", phone)
      .is("auth_id", null) // only update if auth_id is null
      .select()
      .maybeSingle();

    if (updateError) {
      return rejectWithValue({
        message: "Failed to link auth_id: " + updateError.message,
        otpVerified: true,
      });
    }

    // 3️⃣ Fetch user by auth_id OR phone
    const { data: fetchedUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .or(`auth_id.eq.${authUser.id},phone.eq.${phone}`)
      .maybeSingle();

    if (fetchError || !fetchedUser) {
      return rejectWithValue({
        message: "Failed to fetch user after OTP verification",
        otpVerified: true,
      });
    }

    // ✅ 4️⃣ Return session and user (no AsyncStorage)
    return {
      auth_id: authUser.id,
      session: authData.session, // Supabase keeps it in memory
      user: fetchedUser,
      otpVerified: true,
    };
  } catch (err: any) {
    return rejectWithValue({
      message: err.message,
      otpVerified: false,
    });
  }
});

// =======================
// 🔹 Restore Session
// =======================
export const getSession = createAsyncThunk(
  "auth/getSession",
  async (_, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase.auth.getSession();
      console.log(data);
      if (error) throw error;

      return data.session;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

// =======================
// 🔹 Auth State
// =======================
interface AuthState {
  phone: string | null;
  session: any;
  user: any;
  loading: boolean;
  error: string | null;
  message: string | null;
  otpSent: boolean;
  otpVerified: boolean;
  auth_id: any;
}

const initialState: AuthState = {
  phone: null,
  session: null,
  user: null,
  loading: false,
  error: null,
  message: null,
  otpSent: false,
  otpVerified: false,
  auth_id: null,
};

// =======================
// 🔹 Slice
// =======================
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout: (state) => {
      state.session = null;
      state.user = null;
      state.phone = null;
      state.error = null;
      state.message = null;
      state.otpSent = false;
      state.otpVerified = false;
      supabase.auth.signOut();
      AsyncStorage.removeItem("supabase_session");
    },

    resetOtpState: (state) => {
      state.otpSent = false;
      state.otpVerified = false;
      state.message = null;
      state.error = null;
    },

    setSession: (state, action: PayloadAction<any>) => {
      state.session = action.payload;
    },

    setUser: (state, action: PayloadAction<any>) => {
      state.user = action.payload;
    },
  },

  extraReducers: (builder) => {
    builder
      // SEND OTP
      .addCase(sendOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
        state.otpSent = false;
      })
      .addCase(sendOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.phone = action.payload.phone;
        state.otpSent = true;
        state.message = action.payload.message;
      })
      .addCase(sendOtp.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as any)?.message || "Something went wrong";
        state.otpSent = false;
      })

      // VERIFY OTP
      .addCase(verifyOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
        state.otpVerified = false;
      })
      // .addCase(verifyOtp.fulfilled, (state, action) => {
      //   state.loading = false;
      //   state.session = action.payload.session;
      //   state.user = action.payload.user;
      //   state.otpVerified = true;
      //   state.message = "OTP verified successfully";

      // })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.session = action.payload.session;
        state.user = action.payload.user;
        state.otpVerified = true;
        state.message = "OTP verified successfully";

        saveSessionToSecureStore({
          access_token: action.payload.session.access_token,
          refresh_token: action.payload.session.refresh_token,
          user_id: action.payload.auth_id,
        });
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as any)?.message || "OTP verification failed";
        state.otpVerified = (action.payload as any)?.otpVerified || false;
      })

      // GET SESSION
      .addCase(getSession.pending, (state) => {
        state.loading = true;
      })
      .addCase(getSession.fulfilled, (state, action) => {
        state.loading = false;
        state.session = action.payload;
      })
      .addCase(getSession.rejected, (state) => {
        state.loading = false;
        state.session = null;
      });
  },
});

// =======================
// 🔹 Exports
// =======================
export const { logout, resetOtpState, setSession, setUser } = authSlice.actions;
export default authSlice.reducer;
