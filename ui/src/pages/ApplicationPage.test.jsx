import { it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApplicationPage, { toInput } from "./ApplicationPage";
import { renderWithStore, application } from "../test/helpers";
import { request } from "../api/client";
vi.mock("../api/client", () => ({ request: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  request.mockResolvedValue([]);
});
it("requires login and restricts reviewers from creating applications", () => {
  renderWithStore(<ApplicationPage />, { user: null });
  expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
});
it("adds and removes engagement entries and posts real form values", async () => {
  request.mockImplementation((path) =>
    Promise.resolve(path === "/applications" ? [] : application),
  );
  const { store } = renderWithStore(<ApplicationPage />);
  await waitFor(() => expect(store.getState().applications.pending).toBe(0));
  fireEvent.change(screen.getByLabelText("Last name:"), {
    target: { value: "Cole" },
  });
  fireEvent.change(screen.getByLabelText("First name:"), {
    target: { value: "Cameron" },
  });
  fireEvent.change(screen.getByLabelText("DOB:"), {
    target: { value: "2000-01-01" },
  });
  fireEvent.change(screen.getByLabelText("SSN:"), {
    target: { value: "123-45-6789" },
  });
  fireEvent.change(screen.getByLabelText("Name of Employer"), {
    target: { value: "Employer" },
  });
  fireEvent.change(screen.getByLabelText("EID"), { target: { value: "123" } });
  fireEvent.change(screen.getByLabelText("Number of hours this month"), {
    target: { value: "80" },
  });
  fireEvent.change(screen.getByLabelText("Monthly income (pre-tax):"), {
    target: { value: "740" },
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Add another engagement type" }),
  );
  expect(screen.getAllByLabelText("Engagement type")).toHaveLength(2);
  await userEvent.click(
    screen.getByRole("button", { name: "Remove engagement 2" }),
  );
  expect(screen.getAllByLabelText("Engagement type")).toHaveLength(1);
  request.mockImplementation((path, options) =>
    Promise.resolve(options?.method === "POST" ? application : []),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Save application" }),
  );
  await screen.findByText(
    "Application saved. Upload supporting documents, then submit.",
  );
  expect(request).toHaveBeenCalledWith(
    "/applications",
    expect.objectContaining({
      method: "POST",
      body: expect.objectContaining({
        firstName: "Cameron",
        ssn: "123-45-6789",
        monthlyIncome: 740,
      }),
    }),
  );
  expect(
    screen.getByRole("button", { name: "Submit application" }),
  ).toBeDisabled();
});
it("shows returned notes and enables submission after saved documents exist", async () => {
  const a = {
    ...application,
    status: "RETURNED",
    reviewNote: "Correct the income",
    documents: [
      { id: "d1", filename: "proof.pdf", uploadedAt: "2026-01-01T00:00:00Z" },
    ],
  };
  request.mockImplementation((path) =>
    Promise.resolve(
      path === "/applications" ? [a] : { ...a, status: "SUBMITTED" },
    ),
  );
  renderWithStore(<ApplicationPage />, {
    state: {
      applications: {
        items: [a],
        current: a,
        history: [],
        pending: 0,
        error: null,
        fields: {},
      },
    },
  });
  expect(screen.getByText(/Correct the income/)).toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Submit application" }),
    ).toBeEnabled(),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Submit application" }),
  );
  await screen.findByText("Application submitted for employee review.");
  expect(
    screen.queryByRole("button", { name: "Save application" }),
  ).not.toBeInTheDocument();
});
it("converts numbers and optional education hours for the API", () => {
  expect(
    toInput({
      monthlyIncome: "740.50",
      engagements: [{ type: "EDUCATION", hours: "", attendance: "HALF_TIME" }],
    }),
  ).toMatchObject({
    monthlyIncome: 740.5,
    engagements: [{ hours: 0, attendance: "HALF_TIME" }],
  });
});

it("allows an explanation instead of invented activity records", async () => {
  renderWithStore(<ApplicationPage />);
  await userEvent.click(
    screen.getByLabelText(
      "I am reporting a covered reason instead of activities",
    ),
  );
  expect(screen.queryByLabelText("Name of Employer")).not.toBeInTheDocument();
  expect(
    screen.getByLabelText("Covered reason or explanation"),
  ).toBeRequired();
});
