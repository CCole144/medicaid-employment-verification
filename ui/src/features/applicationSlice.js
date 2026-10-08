import { createAsyncThunk, createSlice, isAnyOf } from "@reduxjs/toolkit";
import { request } from "../api/client";
import { expired, signIn, signOut } from "./sessionSlice";
const thunk = (name, fn) =>
  createAsyncThunk(`applications/${name}`, async (arg, context) => {
    try {
      return await fn(arg);
    } catch (e) {
      if (e.status === 401) context.dispatch(expired());
      return context.rejectWithValue({
        message: e.message,
        fields: e.fields || {},
      });
    }
  });
export const loadApplications = thunk("list", () => request("/applications"));
export const loadApplication = thunk("load", (id) =>
  request(`/applications/${id}`),
);
export const saveApplication = thunk("save", ({ id, version, data }) =>
  request(id ? `/applications/${id}?version=${version}` : "/applications", {
    method: id ? "PUT" : "POST",
    body: data,
  }),
);
export const submitApplication = thunk("submit", ({ id, version }) =>
  request(`/applications/${id}/submit?version=${version}`, { method: "POST" }),
);
export const uploadDocument = thunk("upload", ({ id, formData }) =>
  request(`/applications/${id}/documents`, { method: "POST", body: formData }),
);
export const deleteDocument = thunk("delete", async ({ id, documentId }) => {
  await request(`/applications/${id}/documents/${documentId}`, {
    method: "DELETE",
  });
  return request(`/applications/${id}`);
});
export const recordDecision = thunk(
  "decision",
  ({ id, version, decision, note }) =>
    request(`/applications/${id}/decision?version=${version}`, {
      method: "POST",
      body: { decision, note },
    }),
);
export const loadHistory = thunk("history", (id) =>
  request(`/applications/${id}/history`),
);
const changes = [
  loadApplication,
  saveApplication,
  submitApplication,
  uploadDocument,
  deleteDocument,
  recordDecision,
];
const operations = [loadApplications, loadHistory, ...changes];
const initialState = {
  items: [],
  current: null,
  history: [],
  pending: 0,
  error: null,
  fields: {},
};
const slice = createSlice({
  name: "applications",
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
      state.fields = {};
    },
    clearCurrent(state) {
      state.current = null;
      state.history = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signOut.fulfilled, () => initialState)
      .addCase(signIn.fulfilled, () => initialState)
      .addCase(expired, () => initialState)
      .addCase(loadApplications.fulfilled, (state, action) => {
        state.items = action.payload;
      })
      .addCase(loadHistory.fulfilled, (state, action) => {
        state.history = action.payload;
      })
      .addMatcher(
        isAnyOf(...changes.map((t) => t.fulfilled)),
        (state, action) => {
          state.current = action.payload;
          const index = state.items.findIndex(
            (a) => a.id === action.payload.id,
          );
          if (index < 0) state.items.unshift(action.payload);
          else state.items[index] = action.payload;
        },
      )
      .addMatcher(isAnyOf(...operations.map((t) => t.pending)), (state) => {
        state.pending += 1;
        state.error = null;
        state.fields = {};
      })
      .addMatcher(isAnyOf(...operations.map((t) => t.fulfilled)), (state) => {
        state.pending = Math.max(0, state.pending - 1);
      })
      .addMatcher(
        isAnyOf(...operations.map((t) => t.rejected)),
        (state, action) => {
          state.pending = Math.max(0, state.pending - 1);
          state.error = action.payload?.message || action.error.message;
          state.fields = action.payload?.fields || {};
        },
      );
  },
});
export const { clearError, clearCurrent } = slice.actions;
export default slice.reducer;
