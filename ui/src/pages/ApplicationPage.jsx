import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  loadApplications,
  loadApplication,
  saveApplication,
  submitApplication,
  clearCurrent,
} from "../features/applicationSlice";
import SignIn from "../components/SignIn";
import Field from "../components/Field";
import EngagementFields, {
  blankEngagement,
} from "../components/EngagementFields";
import DocumentUpload from "../components/DocumentUpload";
import ApplicationSummary, { readable } from "../components/ApplicationSummary";
export function emptyForm() {
  return {
    lastName: "",
    middleInitial: "",
    firstName: "",
    dob: "",
    ssn: "",
    monthlyIncome: "",
    engagements: [blankEngagement()],
    reportingMonth: new Date().toLocaleDateString("en-CA").slice(0, 7),
    coveredReason: "",
  };
}
export function toInput(form) {
  return {
    ...form,
    monthlyIncome: Number(form.monthlyIncome),
    engagements: form.engagements.map((e) => ({
      ...e,
      hours: Number(e.hours || 0),
      attendance: e.attendance || null,
    })),
  };
}
export default function ApplicationPage() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.session.user);
  const { items, current, pending, error, fields } = useSelector(
    (s) => s.applications,
  );
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (user?.role === "APPLICANT") dispatch(loadApplications());
  }, [dispatch, user]);
  useEffect(() => {
    if (current) {
      const {
        lastName,
        middleInitial,
        firstName,
        dob,
        monthlyIncome,
        engagements,
        reportingMonth,
        coveredReason,
      } = current;
      setForm({
        lastName,
        middleInitial: middleInitial || "",
        firstName,
        dob,
        ssn: "",
        monthlyIncome,
        engagements: engagements.map((e) => ({
          ...e,
          program: e.program || "",
          attendance: e.attendance || "",
        })),
        reportingMonth,
        coveredReason: coveredReason || "",
      });
      setSaved(true);
    }
  }, [current]);
  const editable = !current || ["DRAFT", "RETURNED"].includes(current.status);
  function change(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
    setMessage("");
  }
  async function save(event) {
    event.preventDefault();
    setMessage("");
    const action = await dispatch(
      saveApplication({
        id: current?.id,
        version: current?.version,
        data: toInput(form),
      }),
    );
    if (saveApplication.fulfilled.match(action)) {
      setSaved(true);
      setMessage(
        "Application saved. Upload supporting documents, then submit.",
      );
    }
  }
  async function submit() {
    setMessage("");
    const action = await dispatch(
      submitApplication({ id: current.id, version: current.version }),
    );
    if (submitApplication.fulfilled.match(action))
      setMessage("Application submitted for employee review.");
  }
  function startNew() {
    dispatch(clearCurrent());
    setForm(emptyForm());
    setSaved(false);
    setMessage("");
  }
  if (!user) return <SignIn />;
  if (user.role !== "APPLICANT")
    return (
      <section className="card">
        <h2>Applicant account required</h2>
        <p>Use an applicant account to submit records.</p>
        <Link to="/review">Open Employee Review</Link>
      </section>
    );
  return (
    <>
      <section className="card">
        <h2>My Applications</h2>
        <div className="button-row">
          <button
            type="button"
            className="secondary"
            disabled={pending > 0}
            onClick={startNew}
          >
            Start new application
          </button>
          <button
            type="button"
            className="secondary"
            disabled={pending > 0}
            onClick={() => {
              if (
                current &&
                !saved &&
                !window.confirm("Reload saved data and discard unsaved edits?")
              )
                return;
              current
                ? dispatch(loadApplication(current.id))
                : dispatch(loadApplications());
            }}
          >
            Reload saved data
          </button>
        </div>
        {items.length === 0 && <p>No saved applications yet.</p>}
        <ul className="application-list">
          {items.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="text-button"
                disabled={pending > 0}
                onClick={() => {
                  if (
                    !saved &&
                    (form.firstName || current) &&
                    !window.confirm(
                      "Open this application and discard unsaved edits?",
                    )
                  )
                    return;
                  setMessage("");
                  dispatch(loadApplication(a.id));
                }}
              >
                {a.firstName} {a.lastName} · {a.reportingMonth} ·{" "}
                {readable(a.status)}
              </button>
            </li>
          ))}
        </ul>
        {current && (
          <p>
            <strong>Status:</strong> {readable(current.status)}
            {current.reviewNote && <> · Staff note: {current.reviewNote}</>}
          </p>
        )}
      </section>
      {pending > 0 && <p role="status">Working…</p>}
      {error && (
        <div role="alert" className="error">
          {error}
          {Object.keys(fields).length > 0 && (
            <ul>
              {Object.entries(fields).map(([field, value]) => (
                <li key={field}>
                  {field}: {value}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {editable ? (
        <form onSubmit={save}>
          <fieldset disabled={pending > 0} className="form-fieldset">
            <section className="card">
              <h2>Personal Information</h2>
              <Field
                id="last-name"
                label="Last name:"
                value={form.lastName}
                onChange={(e) => change("lastName", e.target.value)}
                maxLength={80}
                required
                error={fields.lastName}
              />
              <Field
                id="middle-initial"
                label="Middle initial:"
                value={form.middleInitial}
                onChange={(e) => change("middleInitial", e.target.value)}
                maxLength={1}
                pattern="[A-Za-z]?"
                error={fields.middleInitial}
              />
              <Field
                id="first-name"
                label="First name:"
                value={form.firstName}
                onChange={(e) => change("firstName", e.target.value)}
                maxLength={80}
                required
                error={fields.firstName}
              />
              <Field
                id="dob"
                label="DOB:"
                type="date"
                value={form.dob}
                onChange={(e) => change("dob", e.target.value)}
                required
                error={fields.dob}
              />
              <Field
                id="ssn"
                label={
                  current
                    ? `SSN: ${current.ssnMasked} (leave blank to keep)`
                    : "SSN:"
                }
                type="password"
                autoComplete="off"
                placeholder="XXX-XX-XXXX"
                value={form.ssn}
                onChange={(e) => change("ssn", e.target.value)}
                pattern="[0-9]{3}-[0-9]{2}-[0-9]{4}"
                maxLength={11}
                required={!current}
                error={fields.ssn}
              />
              <Field
                id="reporting-month"
                label="Reporting month:"
                type="month"
                max={emptyForm().reportingMonth}
                value={form.reportingMonth}
                onChange={(e) => change("reportingMonth", e.target.value)}
                required
                error={fields.reportingMonth}
              />
            </section>
            <section className="card">
              <h2>Community Engagement</h2>
              <label className="covered-choice">
                <input
                  type="checkbox"
                  checked={form.engagements.length === 0}
                  onChange={(e) =>
                    change(
                      "engagements",
                      e.target.checked ? [] : [blankEngagement()],
                    )
                  }
                />
                I am reporting a covered reason instead of activities
              </label>
              {form.engagements.length === 0 && (
                <p>
                  Describe your covered reason below and upload supporting proof
                  for staff review.
                </p>
              )}
              {form.engagements.map((entry, index) => (
                <EngagementFields
                  key={index}
                  entry={entry}
                  index={index}
                  errors={fields}
                  disabled={pending > 0}
                  canRemove={form.engagements.length > 1}
                  onRemove={() =>
                    change(
                      "engagements",
                      form.engagements.filter((_, i) => i !== index),
                    )
                  }
                  onChange={(value) =>
                    change(
                      "engagements",
                      form.engagements.map((e, i) => (i === index ? value : e)),
                    )
                  }
                />
              ))}
              <button
                type="button"
                className="secondary"
                disabled={form.engagements.length >= 20}
                onClick={() =>
                  change("engagements", [
                    ...form.engagements,
                    blankEngagement(),
                  ])
                }
              >
                Add another engagement type
              </button>
            </section>
            <section className="card">
              <Field
                id="income"
                label="Monthly income (pre-tax):"
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                value={form.monthlyIncome}
                onChange={(e) => change("monthlyIncome", e.target.value)}
                required
                error={fields.monthlyIncome}
              />
              <label htmlFor="covered-reason">
                Covered reason or explanation
              </label>
              <textarea
                id="covered-reason"
                maxLength={2000}
                value={form.coveredReason}
                required={form.engagements.length === 0}
                onChange={(e) => change("coveredReason", e.target.value)}
              />
              <button>Save application</button>
              <p className="hint">
                Save your information first to enable document uploads. Saved
                applications remain drafts until you submit.
              </p>
            </section>
          </fieldset>
        </form>
      ) : (
        <ApplicationSummary application={current} />
      )}
      {current && (
        <DocumentUpload application={current} editable={editable && saved} />
      )}
      {current && editable && (
        <section className="card">
          <button
            type="button"
            disabled={pending > 0 || !saved || current.documents.length === 0}
            onClick={submit}
          >
            Submit application
          </button>
          {!saved && <p>Save your changes before uploading or submitting.</p>}
        </section>
      )}
      <Link className="button secondary" to="/requirements">
        Back
      </Link>
    </>
  );
}
