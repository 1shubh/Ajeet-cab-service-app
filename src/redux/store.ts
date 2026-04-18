import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/redux/slice/authSlice";
import profileReducer from "@/redux/slice/userdetails";
export const store = configureStore({
  reducer: {
    auth: authReducer,
    profile: profileReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
