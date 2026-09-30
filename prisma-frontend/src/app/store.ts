import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { authSlice } from "@/features/auth";
import { usersUiSlice } from "@/features/users";
import { baseApi } from "@/shared/api/baseApi";

/**
 * The ONLY place that knows every slice. Each feature exports its slice; adding a
 * feature = one more argument here. Keys come from each slice's `name`, so there is
 * no "mount it under exactly this key" rule to remember.
 */
export const rootReducer = combineSlices(baseApi, authSlice, usersUiSlice);

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
