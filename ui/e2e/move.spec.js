import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const settings = Object.fromEntries(
  readFileSync(new URL("../../.env", import.meta.url), "utf8")
    .trim()
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

async function login(page, role) {
  await page
    .getByLabel("Username", { exact: true })
    .fill(settings[`MOVE_${role}_USER`]);

  await page
    .getByLabel("Password", { exact: true })
    .fill(settings[`MOVE_${role}_PASSWORD`]);

  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
}

const personal = {
  firstName: "Cameron",
  lastName: `Test${Date.now()}`,
};

test("three-page real API workflow: application, uploads, correction, resubmission and employee approval", async ({
  page,
  browser,
}) => {
  await page.goto("/requirements");

  await expect(
    page.getByRole("heading", {
      name: "Medicaid Employment Requirements",
    }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Covered Reasons" })
    .click();

  await expect(
    page.getByRole("link", {
      name: "Read current official Medicaid guidance",
    }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "Continue", exact: true })
    .click();

  await login(page, "APPLICANT");

  await page
    .getByLabel("Last name:", { exact: true })
    .fill(personal.lastName);

  await page
    .getByLabel("Middle initial:", { exact: true })
    .fill("C");

  await page
    .getByLabel("First name:", { exact: true })
    .fill(personal.firstName);

  await page
    .getByLabel("DOB:", { exact: true })
    .fill("2000-01-01");

  await page
    .getByLabel("SSN:", { exact: true })
    .fill("123456789");

  await expect(
    page.getByLabel("SSN:", { exact: true }),
  ).toHaveValue("123456789");

  await page
    .getByLabel("Reporting month:", { exact: true })
    .fill("2026-01");

  await page
    .getByLabel("Name of Employer", { exact: true })
    .fill("Employer");

  await page
    .getByLabel("EID", { exact: true })
    .fill("123");

  await page
    .getByRole("button", { name: "What is EID?", exact: true })
    .click();

  await expect(
    page.getByRole("dialog", { name: "What is EID?" }),
  ).toContainText("federal tax ID");

  await page
    .getByRole("button", {
      name: "Close explanation",
      exact: true,
    })
    .click();

  await page
    .getByLabel("Number of hours this month", { exact: true })
    .fill("40");

  await page
    .getByRole("button", {
      name: "Add another engagement type",
    })
    .click();

  const entry2 = page.getByRole("group", {
    name: "Engagement 2",
    exact: true,
  });

  await entry2
    .getByLabel("Engagement type", { exact: true })
    .selectOption("VOLUNTEERING");

  await entry2
    .getByLabel("Volunteer Agency", { exact: true })
    .fill("Agency");

  await entry2
    .getByLabel("VID", { exact: true })
    .fill("456");

  await entry2
    .getByLabel("Number of hours this month", { exact: true })
    .fill("40");

  const incomeField = page.getByLabel(
    "Monthly income (pre-tax):",
    { exact: true },
  );

  await incomeField.fill("740.50");
  await incomeField.press("ArrowUp");
  await incomeField.press("ArrowDown");

  await expect(incomeField).toHaveValue("740.50");

  await incomeField.hover();
  await page.mouse.wheel(0, 400);

  await expect(incomeField).toHaveValue("739.50");

  await incomeField.fill("740");

  await page
    .getByRole("button", {
      name: "Save application",
      exact: true,
    })
    .click();

  await expect(
    page.getByText(
      "Application saved. Upload supporting documents, then submit.",
    ),
  ).toBeVisible();

  await page
    .getByLabel("Date", { exact: true })
    .fill("2026-01-15");

  await page
    .getByLabel("Choose file", { exact: true })
    .setInputFiles({
      name: "proof.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(
        "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF",
      ),
    });

  await page
    .getByRole("button", {
      name: "Upload document",
      exact: true,
    })
    .click();

  await expect(
    page.getByText("proof.pdf", { exact: true }),
  ).toBeVisible();

  await page.screenshot({
    path: "test-results/application-desktop.png",
    fullPage: true,
  });

  const downloadPromise = page.waitForEvent("download");

  await page
    .getByRole("button", {
      name: "View / download",
      exact: true,
    })
    .click();

  expect(
    (await downloadPromise).suggestedFilename(),
  ).toBe("proof.pdf");

  await page
    .getByRole("button", {
      name: "Submit application",
      exact: true,
    })
    .click();

  await expect(
    page.getByText(
      "Application submitted for employee review.",
    ),
  ).toBeVisible();

  const reviewerContext = await browser.newContext({
    baseURL: "http://127.0.0.1:5173",
  });

  const reviewer = await reviewerContext.newPage();

  await reviewer.goto("/review");
  await login(reviewer, "REVIEWER");

  await expect(
    reviewer.getByRole("option", {
      name: new RegExp(personal.lastName),
    }),
  ).toBeAttached();

  const option = reviewer.getByRole("option", {
    name: new RegExp(personal.lastName),
  });

  const id = await option.getAttribute("value");

  await reviewer
    .getByLabel("Select an application", { exact: true })
    .selectOption(id);

  await expect(
    reviewer.getByText("***-**-6789", { exact: true }),
  ).toBeVisible();

  await expect(
    reviewer.getByRole("button", {
      name: "Return for Correction",
    }),
  ).toBeDisabled();

  await reviewer
    .getByLabel("Review note", { exact: true })
    .fill("Correct monthly income.");

  await reviewer
    .getByRole("button", { name: "Return for Correction" })
    .click();

  await expect(
    reviewer.getByText("Review decision saved."),
  ).toBeVisible();

  await page.reload();

  await page
    .getByRole("button", {
      name: new RegExp(personal.lastName),
    })
    .click();

  await expect(
    page.getByText(/Correct monthly income/),
  ).toBeVisible();

  await page
    .getByLabel("Monthly income (pre-tax):", { exact: true })
    .fill("750");

  await page
    .getByRole("button", {
      name: "Save application",
      exact: true,
    })
    .click();

  await expect(
    page.getByText(
      "Application saved. Upload supporting documents, then submit.",
    ),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Submit application",
      exact: true,
    })
    .click();

  await expect(
    page.getByText(
      "Application submitted for employee review.",
    ),
  ).toBeVisible();

  await reviewer
    .getByRole("button", { name: "Refresh applications" })
    .click();

  await expect(
    reviewer.getByRole("option", {
      name: new RegExp(personal.lastName),
    }),
  ).toBeAttached();

  await reviewer
    .getByLabel("Select an application", { exact: true })
    .selectOption(id);

  await expect(
    reviewer.getByText("$750.00", { exact: true }),
  ).toBeVisible();

  await reviewer
    .getByRole("button", { name: "Approve & Submit" })
    .click();

  await expect(
    reviewer.getByText("Review decision saved."),
  ).toBeVisible();

  await expect(
    reviewer.getByText("Status: approved", { exact: true }),
  ).toBeVisible();

  await reviewer.screenshot({
    path: "test-results/review-desktop.png",
    fullPage: true,
  });

  await reviewerContext.close();
});

test("mobile layouts have exactly three navigation links and no page overflow", async ({
  page,
}) => {
  await page.goto("/requirements");

  await expect(
    page.getByRole("button", { name: "Covered Reasons" }),
  ).toBeVisible();

  await page.screenshot({
    path: "test-results/requirements-desktop.png",
    fullPage: true,
  });

  await page.setViewportSize({
    width: 390,
    height: 844,
  });

  await page.goto("/requirements");

  await expect(
    page.getByRole("navigation").getByRole("link"),
  ).toHaveCount(3);

  await expect(
    page.getByRole("button", { name: "Covered Reasons" }),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.screenshot({
    path: "test-results/requirements-mobile.png",
    fullPage: true,
  });
});

test("application fields work on mobile with nine-digit SSNs, dollar steps and all ID explanations", async ({
  page,
}) => {
  await page.setViewportSize({
    width: 390,
    height: 844,
  });

  await page.goto("/application");
  await login(page, "APPLICANT");

  const ssn = page.getByLabel("SSN:", { exact: true });

  await expect(ssn).toBeEnabled();

  await ssn.fill("001-23-4567");

  await expect(ssn).toHaveValue("001234567");

  expect(
    await ssn.evaluate((element) => element.checkValidity()),
  ).toBe(true);

  await ssn.fill("12345678");

  expect(
    await ssn.evaluate((element) => element.checkValidity()),
  ).toBe(false);

  await ssn.fill("001234567");

  const income = page.getByLabel(
    "Monthly income (pre-tax):",
    { exact: true },
  );

  await income.fill("740.50");
  await income.press("ArrowUp");
  await income.press("ArrowDown");

  await expect(income).toHaveValue("740.50");

  await income.hover();
  await page.mouse.wheel(0, 300);

  await expect(income).toHaveValue("739.50");

  await income.fill("740.123");

  expect(
    await income.evaluate((element) => element.checkValidity()),
  ).toBe(false);

  await income.fill("740.50");

  const identifiers = [
    ["EMPLOYMENT", "EID"],
    ["VOLUNTEERING", "VID"],
    ["JOB_TRAINING", "JTID"],
    ["EDUCATION", "EID"],
  ];

  for (const [type, id] of identifiers) {
    await page
      .getByLabel("Engagement type", { exact: true })
      .selectOption(type);

    const trigger = page.getByRole("button", {
      name: `What is ${id}?`,
      exact: true,
    });

    await trigger.click();

    await expect(
      page.getByRole("dialog", {
        name: `What is ${id}?`,
      }),
    ).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await page.keyboard.press("Escape");

    await expect(
      page.getByRole("dialog"),
    ).toHaveCount(0);

    await expect(trigger).toBeFocused();
  }
});

test("income accelerates while an arrow is held and stops on key release", async ({
  page,
}) => {
  await page.goto("/application");
  await login(page, "APPLICANT");

  const income = page.getByLabel(
    "Monthly income (pre-tax):",
    { exact: true },
  );

  await income.fill("100.50");
  await income.focus();

  await page.keyboard.down("ArrowUp");

  await page.waitForTimeout(1000);

  const early = Number(await income.inputValue()) - 100.5;

  await page.waitForTimeout(4000);

  const beforeFast = Number(await income.inputValue());

  await page.waitForTimeout(1000);

  const fast = Number(await income.inputValue()) - beforeFast;

  expect(fast).toBeGreaterThan(early);

  await page.keyboard.up("ArrowUp");

  const stopped = await income.inputValue();

  await page.waitForTimeout(500);

  await expect(income).toHaveValue(stopped);

  expect(Number(stopped) % 1).toBe(0.5);

  await page
    .getByRole("button", {
      name: "Increase monthly income by 1 dollar",
    })
    .click();

  await expect(income).toHaveValue(
    (Number(stopped) + 1).toFixed(2),
  );
});