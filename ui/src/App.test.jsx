import { it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import App from "./App";
import { renderWithStore } from "./test/helpers";
import { request } from "./api/client";
vi.mock("./api/client", () => ({ request: vi.fn() }));
it("redirects the root to the requirements page and restores the session", async () => {
  request.mockImplementation((path) =>
    path === "/me"
      ? Promise.reject(new Error("401"))
      : Promise.resolve({
          intro: "Report your activities.",
          categories: [],
          coveredReasons: "Covered reasons",
          guidanceUrl: "https://www.medicaid.gov/renew-info",
        }),
  );
  renderWithStore(<App />, { user: null, route: "/" });
  expect(
    await screen.findByRole("heading", {
      name: "Medicaid Employment Requirements",
    }),
  ).toBeInTheDocument();
  expect(screen.getByRole("navigation")).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith("/me");
});
