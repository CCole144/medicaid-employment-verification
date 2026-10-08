import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Field from "./Field";
it("connects a label and error to the input", () => {
  render(<Field id="ssn" label="SSN:" error="Invalid SSN" />);
  const input = screen.getByLabelText("SSN:");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAccessibleDescription("Invalid SSN");
});
