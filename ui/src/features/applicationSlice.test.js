import { it, expect, vi, beforeEach } from "vitest";
import { makeStore } from "../app/store";
import * as api from "../api/client";
import { application } from "../test/helpers";
import {
  loadApplications,
  loadApplication,
  saveApplication,
  submitApplication,
  uploadDocument,
  deleteDocument,
  recordDecision,
  loadHistory,
  clearCurrent,
} from "./applicationSlice";
import { signOut } from "./sessionSlice";
vi.mock("../api/client", () => ({ request: vi.fn(), logout: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it("loads a list and current application", async () => {
  const store = makeStore();
  api.request
    .mockResolvedValueOnce([application])
    .mockResolvedValueOnce(application);
  await store.dispatch(loadApplications());
  await store.dispatch(loadApplication("a1"));
  expect(store.getState().applications.current).toEqual(application);
  expect(store.getState().applications.items).toHaveLength(1);
  expect(store.getState().applications.pending).toBe(0);
  store.dispatch(clearCurrent());
  expect(store.getState().applications.current).toBeNull();
});
it("uses the same versioned API contract for create, update, submit, upload, delete, and decisions", async () => {
  const store = makeStore();
  api.request.mockResolvedValue(application);
  await store.dispatch(saveApplication({ data: { firstName: "Cameron" } }));
  await store.dispatch(saveApplication({ id: "a1", version: 3, data: {} }));
  await store.dispatch(submitApplication({ id: "a1", version: 3 }));
  const formData = new FormData();
  await store.dispatch(uploadDocument({ id: "a1", formData }));
  await store.dispatch(deleteDocument({ id: "a1", documentId: "d1" }));
  await store.dispatch(
    recordDecision({
      id: "a1",
      version: 3,
      decision: "APPROVE",
      note: "Reviewed",
    }),
  );
  expect(api.request).toHaveBeenCalledWith("/applications/a1?version=3", {
    method: "PUT",
    body: {},
  });
  expect(api.request).toHaveBeenCalledWith(
    "/applications/a1/submit?version=3",
    { method: "POST" },
  );
  expect(api.request).toHaveBeenCalledWith("/applications/a1/documents", {
    method: "POST",
    body: formData,
  });
  expect(api.request).toHaveBeenCalledWith("/applications/a1/documents/d1", {
    method: "DELETE",
  });
  expect(api.request).toHaveBeenCalledWith(
    "/applications/a1/decision?version=3",
    expect.objectContaining({
      body: { decision: "APPROVE", note: "Reviewed" },
    }),
  );
});
it("loads history, handles rejected validation and clears personal records on logout", async () => {
  const store = makeStore();
  api.request.mockResolvedValueOnce([{ id: "r1" }]);
  await store.dispatch(loadHistory("a1"));
  expect(store.getState().applications.history).toHaveLength(1);
  api.request.mockRejectedValueOnce({
    message: "Invalid SSN",
    fields: { ssn: "Invalid" },
  });
  await store.dispatch(saveApplication({ data: {} }));
  expect(store.getState().applications.error).toBe("Invalid SSN");
  api.logout.mockResolvedValue(null);
  await store.dispatch(signOut());
  expect(store.getState().applications.history).toHaveLength(0);
});
it("expires the session on unauthorized responses", async () => {
  const store = makeStore({
    session: { user: { role: "APPLICANT" }, status: "ready" },
  });
  api.request.mockRejectedValue({ status: 401, message: "Expired" });
  await store.dispatch(loadApplications());
  expect(store.getState().session.user).toBeNull();
});
