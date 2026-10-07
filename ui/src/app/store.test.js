import { it, expect } from "vitest";
import { makeStore } from "./store";
it("creates independent stores with all three slices", () => {
  const a = makeStore(),
    b = makeStore();
  expect(Object.keys(a.getState())).toEqual([
    "session",
    "applications",
    "requirements",
  ]);
  expect(a).not.toBe(b);
  expect(a.getState().applications.items).toEqual([]);
});
