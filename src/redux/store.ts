import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/redux/slice/authSlice";
import profileReducer from "@/redux/slice/userdetails";
import admissionReducer from "@/redux/slice/admissionslice";
import routeReducer from "@/redux/slice/routeslice";
import driverReducer from "@/redux/slice/driverSlice";
import vehicleReducer from "@/redux/slice/vehicleSlice";
import feeReducer from "@/redux/slice/feeSlice"
export const store = configureStore({
  reducer: {
    auth: authReducer,
    profile: profileReducer,
    admissions: admissionReducer,
    routes: routeReducer,
    drivers: driverReducer,
    vehicles: vehicleReducer,
    fees:feeReducer
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
