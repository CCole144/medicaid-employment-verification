import { it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReviewPage from "./ReviewPage";
import { renderWithStore, application } from "../test/helpers";
import { request } from "../api/client";
vi.mock("../api/client", () => ({ request: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it("restricts employee controls to reviewers", () => {
  renderWithStore(<ReviewPage />);
  expect(screen.getByText("Employee access required")).toBeInTheDocument();
  expect(screen.queryByText("Approve & Submit")).not.toBeInTheDocument();
});
it("loads actual submissions and sends a versioned review decision with a required note", async () => {
  const a = { ...application, status: "SUBMITTED" };
  request.mockImplementation((path, options) =>
    Promise.resolve(
      path === "/applications"
        ? [a]
        : path.endsWith("/history")
          ? []
          : options?.method === "POST"
            ? { ...a, status: "RETURNED", version: 1 }
            : a,
    ),
  );
  renderWithStore(<ReviewPage />, {
    user: { username: "reviewer", role: "REVIEWER" },
  });
  await screen.findByRole("option", { name: /Cameron Cole/ });
  await userEvent.selectOptions(
    screen.getByLabelText("Select an application"),
    "a1",
  );
  await screen.findByText("***-**-6789");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Approve & Submit" }),
    ).toBeEnabled(),
  );
  expect(
    screen.getByRole("button", { name: "Return for Correction" }),
  ).toBeDisabled();
  await userEvent.type(
    screen.getByLabelText("Review note"),
    "Please correct the income.",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Return for Correction" }),
  );
  await screen.findByText("Review decision saved.");
  expect(request).toHaveBeenCalledWith("/applications/a1/decision?version=0", {
    method: "POST",
    body: { decision: "RETURN", note: "Please correct the income." },
  });
  expect(
    screen.getByRole("button", { name: "Approve & Submit" }),
  ).toBeDisabled();
});
