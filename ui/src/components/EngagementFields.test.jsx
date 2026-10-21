import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import EngagementFields, { blankEngagement } from "./EngagementFields";

it("switches engagement type and allows removing another entry", () => {
  const onChange = vi.fn();
  const onRemove = vi.fn();

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

  fireEvent.click(
    screen.getByRole("button", { name: "Remove engagement 2" }),
  );

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

  expect(
    screen.getByRole("option", { name: "Half time" }),
  ).toBeInTheDocument();

  expect(
    screen.getByLabelText("Classroom hours this month (optional)"),
  ).not.toBeRequired();

  expect(screen.getByLabelText("Major/Program")).toBeRequired();
});

it("explains EID as the organization's federal tax ID and restores focus when closed", async () => {
  render(
    <EngagementFields
      entry={blankEngagement()}
      index={0}
      onChange={() => {}}
    />,
  );

  const button = screen.getByRole("button", { name: "What is EID?" });

  await userEvent.click(button);

  const popup = screen.getByRole("dialog", { name: "What is EID?" });

  expect(popup).toHaveFocus();
  expect(within(popup).getByText(/federal tax ID/)).toBeVisible();

  expect(
    within(popup).getByText(/Employer Identification Number/),
  ).toBeVisible();

  await userEvent.click(
    within(popup).getByRole("button", { name: "Close explanation" }),
  );

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(button).toHaveFocus();
});

it("supports opening EID help by keyboard and closing with Escape", async () => {
  render(
    <EngagementFields
      entry={blankEngagement()}
      index={0}
      onChange={() => {}}
    />,
  );

  const user = userEvent.setup();
  const button = screen.getByRole("button", { name: "What is EID?" });

  button.focus();
  await user.keyboard("{Enter}");

  expect(
    screen.getByRole("dialog", { name: "What is EID?" }),
  ).toBeVisible();

  await user.keyboard("{Escape}");

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(button).toHaveFocus();
});

it("closes EID help when the user moves to another field", async () => {
  render(
    <EngagementFields
      entry={blankEngagement()}
      index={0}
      onChange={() => {}}
    />,
  );

  await userEvent.click(
    screen.getByRole("button", { name: "What is EID?" }),
  );

  await userEvent.click(screen.getByLabelText("Name of Employer"));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("offers the appropriate explanation for each organization identifier", () => {
  const { rerender } = render(
    <EngagementFields
      entry={{ ...blankEngagement(), type: "EDUCATION" }}
      index={0}
      onChange={() => {}}
    />,
  );

  expect(
    screen.getByRole("button", { name: "What is EID?" }),
  ).toBeInTheDocument();

  rerender(
    <EngagementFields
      entry={{ ...blankEngagement(), type: "VOLUNTEERING" }}
      index={0}
      onChange={() => {}}
    />,
  );

  expect(
    screen.getByRole("button", { name: "What is VID?" }),
  ).toBeInTheDocument();
});

it.each([
  ["EMPLOYMENT", "EID", "Employer Identification Number"],
  ["EDUCATION", "EID", "employer or school"],
  ["VOLUNTEERING", "VID", "volunteer agency’s identifier"],
  ["JOB_TRAINING", "JTID", "job-training program’s identifier"],
])("shows accurate ID help for %s", async (type, id, text) => {
  render(
    <EngagementFields
      entry={{ ...blankEngagement(), type }}
      index={0}
      onChange={() => {}}
    />,
  );

  const trigger = screen.getByRole("button", {
    name: `What is ${id}?`,
  });

  await userEvent.click(trigger);

  const dialog = screen.getByRole("dialog", {
    name: `What is ${id}?`,
  });

  expect(dialog).toHaveTextContent(text);
  expect(trigger).toHaveAttribute("aria-expanded", "true");

  await userEvent.keyboard("{Escape}");

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("closes ID help when switching activity types", async () => {
  const onChange = vi.fn();

  const { rerender } = render(
    <EngagementFields
      entry={blankEngagement()}
      index={0}
      onChange={onChange}
    />,
  );

  await userEvent.click(
    screen.getByRole("button", { name: "What is EID?" }),
  );

  fireEvent.change(screen.getByLabelText("Engagement type"), {
    target: { value: "JOB_TRAINING" },
  });

  rerender(
    <EngagementFields
      entry={{ ...blankEngagement(), type: "JOB_TRAINING" }}
      index={0}
      onChange={onChange}
    />,
  );

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  expect(
    screen.getByRole("button", { name: "What is JTID?" }),
  ).toHaveAttribute("aria-expanded", "false");
});