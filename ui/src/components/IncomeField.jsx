import { useEffect, useRef } from "react";
import Field from "./Field";

const MAX_INCOME = 10000000;
const amountPattern = /^[0-9]+([.][0-9]{1,2})?$/;

export default function IncomeField({ value, onChange, error, disabled }) {
  const container = useRef(null);
  const latest = useRef({ value, onChange, disabled });
  latest.current = { value, onChange, disabled };

  const hold = useRef(null);
  const timer = useRef(null);

  function stop() {
    clearTimeout(timer.current);
    timer.current = null;
    hold.current = null;
  }

  function adjust(direction) {
    const current = latest.current;

    if (
      current.disabled ||
      (current.value !== "" && !amountPattern.test(String(current.value)))
    ) {
      return;
    }

    const cents = Math.round(Number(current.value || 0) * 100);

    const next = Math.max(
      0,
      Math.min(MAX_INCOME * 100, cents + direction * 100),
    );

    const formatted = (next / 100).toFixed(2);

    latest.current = { ...current, value: formatted };
    current.onChange(formatted);
  }

  function start(key) {
    stop();

    const direction = key === "ArrowUp" ? 1 : -1;

    hold.current = {
      key,
      started: Date.now(),
    };

    adjust(direction);

    function repeat() {
      if (!hold.current) return;

      adjust(direction);

      const elapsed = Date.now() - hold.current.started;

      // Each step stays $1. Holding the key increases the repeat speed.
      const delay = elapsed >= 4000 ? 40 : elapsed >= 2000 ? 80 : 160;

      timer.current = setTimeout(repeat, delay);
    }

    timer.current = setTimeout(repeat, 450);
  }

  useEffect(() => {
    const input = container.current.querySelector("input");

    function wheel(event) {
      if (
        document.activeElement !== input ||
        event.ctrlKey ||
        !event.deltaY ||
        latest.current.disabled
      ) {
        return;
      }

      event.preventDefault();
      adjust(event.deltaY < 0 ? 1 : -1);
    }

    function release(event) {
      if (event.key === hold.current?.key) {
        stop();
      }
    }

    function hidden() {
      if (document.hidden) {
        stop();
      }
    }

    input.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keyup", release);
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", hidden);

    return () => {
      stop();
      input.removeEventListener("wheel", wheel);
      window.removeEventListener("keyup", release);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      stop();
    }
  }, [disabled]);

  const numeric = amountPattern.test(String(value))
    ? Number(value)
    : undefined;

  return (
    <div ref={container}>
      <Field
        id="income"
        label="Monthly income (pre-tax):"
        type="text"
        role="spinbutton"
        inputMode="decimal"
        pattern="[0-9]+([.][0-9]{1,2})?"
        title="Enter an amount such as 740 or 740.50."
        placeholder="0.00"
        maxLength={11}
        aria-valuemin={0}
        aria-valuemax={MAX_INCOME}
        aria-valuenow={numeric}
        aria-describedby={
          error ? "income-hint income-error" : "income-hint"
        }
        value={value}
        onChange={(event) => {
          stop();
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;

          event.preventDefault();

          if (!event.repeat && hold.current?.key !== event.key) {
            start(event.key);
          }
        }}
        onBlur={stop}
        required
        disabled={disabled}
        error={error}
      />

      <p id="income-hint" className="hint">
        Enter income before taxes, with up to two decimal places. You may also use the
        Arrow keys and the mouse wheel when the box is clicked on to change it by $1.
        Hold an arrow key to change it faster; release to stop.
      </p>
    </div>
  );
}