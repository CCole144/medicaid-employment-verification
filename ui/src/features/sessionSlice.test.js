import { it, expect, vi, beforeEach } from "vitest";
import { makeStore } from "../app/store";
import { signIn, signOut, restoreSession } from "./sessionSlice";
import * as api from "../api/client";
vi.mock("../api/client", () => ({
  login: vi.fn(),
  logout: vi.fn(),
  request: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
it("restores and signs in using API role data", async () => {
  const store = makeStore();
  api.request.mockResolvedValue({ username: "reviewer", role: "REVIEWER" });
  await store.dispatch(restoreSession());
  expect(store.getState().session.user.role).toBe("REVIEWER");
  api.login.mockResolvedValue({ username: "applicant", role: "APPLICANT" });
  await store.dispatch(signIn({ username: "applicant", password: "test" }));
  expect(store.getState().session.user.role).toBe("APPLICANT");
  api.logout.mockResolvedValue(null);
  await store.dispatch(signOut());
  expect(store.getState().session.user).toBeNull();
});
it("handles invalid credentials and absent session", async () => {
  const store = makeStore();
  api.request.mockRejectedValue(new Error("401"));
  await store.dispatch(restoreSession());
  expect(store.getState().session.status).toBe("ready");
  api.login.mockRejectedValue(new Error("Invalid password"));
  await store.dispatch(signIn({}));
  expect(store.getState().session.error).toBe("Invalid password");
});
