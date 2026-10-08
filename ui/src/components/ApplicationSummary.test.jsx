import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ApplicationSummary from "./ApplicationSummary";
import { application } from "../test/helpers";
it("renders actual submitted data, masked SSN, total hours, income and education", () => {
  const a = {
    ...application,
    engagements: [
      ...application.engagements,
      {
        type: "EDUCATION",
        name: "STLCC",
        program: "Software Development",
        attendance: "HALF_TIME",
        organizationId: "s1",
        hours: 0,
      },
    ],
  };
  render(<ApplicationSummary application={a} />);
  expect(screen.getByText("***-**-6789")).toBeInTheDocument();
  expect(screen.getByText("$740.00")).toBeInTheDocument();
  expect(screen.getByText("half time")).toBeInTheDocument();
  expect(screen.getByText("Software Development")).toBeInTheDocument();
});
