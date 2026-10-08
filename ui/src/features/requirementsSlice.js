import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { request } from "../api/client";
export const loadRequirements = createAsyncThunk("requirements/load", () =>
  request("/requirements"),
);
const slice = createSlice({
  name: "requirements",
  initialState: { data: null, status: "idle", error: null },
  reducers: {},
  extraReducers: (b) =>
    b
      .addCase(loadRequirements.pending, (s) => {
        s.status = "loading";
        s.error = null;
      })
      .addCase(loadRequirements.fulfilled, (s, a) => {
        s.data = a.payload;
        s.status = "ready";
      })
      .addCase(loadRequirements.rejected, (s) => {
        s.status = "failed";
        s.error =
          "Requirements could not be loaded. Check that the API is running.";
      }),
});
export default slice.reducer;
