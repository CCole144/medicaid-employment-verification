import { it, expect, vi } from "vitest";
import { makeStore } from "../app/store";
import { loadRequirements } from "./requirementsSlice";
import { request } from "../api/client";
vi.mock("../api/client", () => ({ request: vi.fn() }));
it("loads API requirements and exposes errors for retry", async () => {
  const store = makeStore();
  request.mockResolvedValueOnce({ categories: ["Employment"] });
  await store.dispatch(loadRequirements());
  expect(store.getState().requirements.status).toBe("ready");
  request.mockRejectedValueOnce(new Error("Offline"));
  await store.dispatch(loadRequirements());
  expect(store.getState().requirements.status).toBe("failed");
});
