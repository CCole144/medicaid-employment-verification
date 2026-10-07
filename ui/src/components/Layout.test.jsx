import { it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Layout from "./Layout";
import { renderWithStore } from "../test/helpers";
import { logout } from "../api/client";
vi.mock("../api/client", () => ({ logout: vi.fn() }));
it("links exactly three pages and signs out", async () => {
  logout.mockResolvedValue(null);
  const { store } = renderWithStore(<Layout />);
  expect(screen.getAllByRole("link")).toHaveLength(3);
  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(store.getState().session.user).toBeNull();
});
