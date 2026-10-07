import { configureStore } from "@reduxjs/toolkit";
import session from "../features/sessionSlice";
import applications from "../features/applicationSlice";
import requirements from "../features/requirementsSlice";
export const makeStore = (preloadedState) =>
  configureStore({
    reducer: { session, applications, requirements },
    preloadedState,
    // Personal records must not be copied into Redux DevTools or browser storage.
    devTools: false,
    middleware: (getDefault) =>
      getDefault({
        serializableCheck: {
          ignoredActions: [
            "applications/upload/pending",
            "applications/upload/fulfilled",
            "applications/upload/rejected",
          ],
          ignoredActionPaths: ["meta.arg.formData"],
        },
      }),
  });
export const store = makeStore();
