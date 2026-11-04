import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import IncomeField from "./IncomeField";

function Form({
  initial = "740.50",
  disabled = false,
  onValue = () => {},
}) {
  const [value, setValue] = useState(initial);

  return (
    <IncomeField
      value={value}
      disabled={disabled}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
    />
  );
}

const input = () =>
  screen.getByRole("spinbutton", {
    name: "Monthly income (pre-tax):",
  });

afterEach(() => {
  vi.useRealTimers();
});

it("changes by exactly one dollar with arrows and buttons, preserving cents", () => {
  render(<Form />);

  fireEvent.keyDown(input(), { key: "ArrowUp" });
  fireEvent.keyUp(window, { key: "ArrowUp" });

  expect(input()).toHaveValue("741.50");

  fireEvent.keyDown(input(), { key: "ArrowDown" });
  fireEvent.keyUp(window, { key: "ArrowDown" });

  expect(input()).toHaveValue("740.50");

  fireEvent.click(
    screen.getByRole("button", {
      name: "Increase monthly income by 1 dollar",
    }),
  );

  expect(input()).toHaveValue("741.50");

  fireEvent.click(
    screen.getByRole("button", {
      name: "Decrease monthly income by 1 dollar",
    }),
  );

  expect(input()).toHaveValue("740.50");
});

it("accelerates repeat frequency, ignores OS repeats, and stops on release", () => {
  vi.useFakeTimers();

  const onValue = vi.fn();

  render(<Form initial="100" onValue={onValue} />);

  fireEvent.keyDown(input(), { key: "ArrowUp" });
  fireEvent.keyDown(input(), {
    key: "ArrowUp",
    repeat: true,
  });

  expect(onValue).toHaveBeenCalledTimes(1);

  act(() => {
    vi.advanceTimersByTime(1000);
  });

  const earlyCount = onValue.mock.calls.length;

  act(() => {
    vi.advanceTimersByTime(4000);
  });

  const beforeFast = onValue.mock.calls.length;

  act(() => {
    vi.advanceTimersByTime(1000);
  });

  expect(onValue.mock.calls.length - beforeFast).toBeGreaterThan(
    earlyCount,
  );

  const values = onValue.mock.calls.map(([value]) => Number(value));

  values.forEach((value, index) => {
    const previous = index ? values[index - 1] : 100;
    expect(value - previous).toBe(1);
  });

  fireEvent.keyUp(window, { key: "ArrowUp" });

  const stopped = onValue.mock.calls.length;

  act(() => {
    vi.advanceTimersByTime(5000);
  });

  expect(onValue).toHaveBeenCalledTimes(stopped);
});

it("stops a held key on input blur, window blur, disable and unmount", () => {
  vi.useFakeTimers();

  const onValue = vi.fn();

  const { rerender, unmount } = render(
    <Form onValue={onValue} />,
  );

  for (const blurTarget of [() => input(), () => window]) {
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.blur(blurTarget());

    const count = onValue.mock.calls.length;

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onValue).toHaveBeenCalledTimes(count);
  }

  fireEvent.keyDown(input(), { key: "ArrowUp" });

  rerender(<Form onValue={onValue} disabled />);

  const disabledCount = onValue.mock.calls.length;

  act(() => {
    vi.advanceTimersByTime(3000);
  });

  expect(onValue).toHaveBeenCalledTimes(disabledCount);

  rerender(<Form onValue={onValue} />);

  fireEvent.keyDown(input(), { key: "ArrowUp" });

  const beforeUnmount = onValue.mock.calls.length;

  unmount();

  act(() => {
    vi.advanceTimersByTime(3000);
  });

  expect(onValue).toHaveBeenCalledTimes(beforeUnmount);
});

it("uses wheel steps only while focused and leaves unfocused scrolling alone", () => {
  render(<Form />);

  fireEvent.wheel(input(), { deltaY: -100 });

  expect(input()).toHaveValue("740.50");

  input().focus();

  expect(
    fireEvent.wheel(input(), { deltaY: -100 }),
  ).toBe(false);

  expect(input()).toHaveValue("741.50");

  fireEvent.wheel(input(), { deltaY: 100 });

  expect(input()).toHaveValue("740.50");

  fireEvent.wheel(input(), {
    deltaY: -100,
    ctrlKey: true,
  });

  fireEvent.wheel(input(), {
    deltaY: 0,
    deltaX: 100,
  });

  expect(input()).toHaveValue("740.50");
});

it("respects zero and the API maximum without losing cents to floating point", () => {
  render(<Form initial="0.10" />);

  fireEvent.click(
    screen.getByRole("button", {
      name: "Decrease monthly income by 1 dollar",
    }),
  );

  expect(input()).toHaveValue("0.00");

  expect(
    screen.getByRole("button", {
      name: "Decrease monthly income by 1 dollar",
    }),
  ).toBeDisabled();

  fireEvent.change(input(), {
    target: { value: "9999999.10" },
  });

  fireEvent.click(
    screen.getByRole("button", {
      name: "Increase monthly income by 1 dollar",
    }),
  );

  expect(input()).toHaveValue("10000000.00");

  expect(
    screen.getByRole("button", {
      name: "Increase monthly income by 1 dollar",
    }),
  ).toBeDisabled();
});

it("accepts typed cents, validates decimal syntax and leaves invalid values for correction", () => {
  render(<Form initial="" />);

  expect(input()).toBeInvalid();

  fireEvent.change(input(), {
    target: { value: "740.50" },
  });

  expect(input()).toBeValid();

  for (const value of ["740.123", "-1", "abc", "1e3"]) {
    fireEvent.change(input(), {
      target: { value },
    });

    expect(input()).toBeInvalid();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Increase monthly income by 1 dollar",
      }),
    );

    expect(input()).toHaveValue(value);
  }
});