import { it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RequirementsPage from "./RequirementsPage";
import { renderWithStore } from "../test/helpers";
import { request } from "../api/client";
vi.mock("../api/client", () => ({ request: vi.fn() }));
it("loads requirements and expands covered reasons without a fourth page", async () => {
  request.mockResolvedValue({
    intro: "Report your activities.",
    categories: ["Employment", "Education"],
    coveredReasons: "Staff will review covered reasons.",
    guidanceUrl: "https://www.medicaid.gov/renew-info",
  });
  renderWithStore(<RequirementsPage />);
  await screen.findByText("Report your activities.");
  await userEvent.click(
    screen.getByRole("button", { name: "View Covered Reasons" }),
  );
  expect(
    screen.getByRole("link", {
      name: "Read current official Medicaid guidance",
    }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute(
    "href",
    "/application",
  );
});
