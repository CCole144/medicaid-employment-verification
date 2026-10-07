import { it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithStore } from "../test/helpers";
import SignIn from "./SignIn";
import { login } from "../api/client";
vi.mock("../api/client", () => ({ login: vi.fn() }));
it("signs in through the API and clears the password field", async () => {
  login.mockResolvedValue({ username: "applicant", role: "APPLICANT" });
  renderWithStore(<SignIn />, { user: null });
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Username"), "applicant");
  await user.type(screen.getByLabelText("Password"), "private");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(login).toHaveBeenCalledWith({
    username: "applicant",
    password: "private",
  });
  expect(screen.getByLabelText("Password")).toHaveValue("");
});
