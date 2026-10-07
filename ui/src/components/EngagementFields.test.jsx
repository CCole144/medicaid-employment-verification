import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EngagementFields, { blankEngagement } from "./EngagementFields";
it("switches engagement type and allows removing another entry", () => {
  const onChange = vi.fn(),
    onRemove = vi.fn();
  render(
    <EngagementFields
      entry={blankEngagement()}
      index={1}
      canRemove
      onChange={onChange}
      onRemove={onRemove}
    />,
  );
  fireEvent.change(screen.getByLabelText("Engagement type"), {
    target: { value: "EDUCATION" },
  });
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ type: "EDUCATION" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove engagement 2" }));
  expect(onRemove).toHaveBeenCalled();
});
it("supports half-time education without mandatory classroom hours", () => {
  render(
    <EngagementFields
      entry={{ ...blankEngagement(), type: "EDUCATION" }}
      index={0}
      onChange={() => {}}
    />,
  );
  expect(screen.getByRole("option", { name: "Half time" })).toBeInTheDocument();
  expect(
    screen.getByLabelText("Classroom hours this month (optional)"),
  ).not.toBeRequired();
  expect(screen.getByLabelText("Major/Program")).toBeRequired();
});
