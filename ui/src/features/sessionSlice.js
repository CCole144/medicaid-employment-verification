import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "../api/client";
export const restoreSession = createAsyncThunk("session/restore", async () =>
  api.request("/me"),
);
export const signIn = createAsyncThunk(
  "session/signIn",
  async (credentials, { rejectWithValue }) => {
    try {
      return await api.login(credentials);
    } catch (e) {
      return rejectWithValue(e.message);
    }
  },
);
export const signOut = createAsyncThunk("session/signOut", async () =>
  api.logout(),
);
const slice = createSlice({
  name: "session",
  initialState: { user: null, status: "idle", error: null },
  reducers: {
    expired(state) {
      state.user = null;
      state.error = "Your session expired. Sign in again.";
    },
  },
  extraReducers: (builder) =>
    builder
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "ready";
      })
      .addCase(restoreSession.rejected, (state) => {
        state.status = "ready";
      })
      .addCase(signIn.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "ready";
      })
      .addCase(signIn.rejected, (state, action) => {
        state.status = "ready";
        state.error = action.payload || "Sign in failed.";
      })
      .addCase(signOut.fulfilled, (state) => {
        state.user = null;
        state.error = null;
      })
      .addCase(signOut.rejected, (state) => {
        state.error = "Sign out failed. Try again.";
      }),
});
export const { expired } = slice.actions;
export default slice.reducer;
