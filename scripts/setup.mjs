import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env"))
  console.log(".env already exists; it was left unchanged.");
else {
  const text = `MOVE_APPLICANT_USER=applicant\nMOVE_APPLICANT_PASSWORD=${randomBytes(18).toString("base64url")}\nMOVE_REVIEWER_USER=reviewer\nMOVE_REVIEWER_PASSWORD=${randomBytes(18).toString("base64url")}\nMOVE_DB_PASSWORD=${randomBytes(18).toString("base64url")}\nMOVE_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}\n`;
  writeFileSync(".env", text, { mode: 0o600 });
  console.log(
    "Created .env. Open it in VS Code for the applicant and reviewer login passwords. Keep it private and keep the same encryption key for existing data.",
  );
}
