import { useEffect, useRef, useState } from "react";
import Field from "./Field";
import "./EngagementFields.scss";

export const TYPES = {
  EMPLOYMENT: "Employment",
  VOLUNTEERING: "Volunteering",
  EDUCATION: "Education",
  JOB_TRAINING: "Job training",
};

const labels = {
  EMPLOYMENT: ["Name of Employer", "EID"],
  VOLUNTEERING: ["Volunteer Agency", "VID"],
  EDUCATION: ["Name of School", "EID"],
  JOB_TRAINING: ["Job Training Program", "JTID"],
};

export function blankEngagement() {
  return {
    type: "EMPLOYMENT",
    name: "",
    organizationId: "",
    hours: "",
    program: "",
    attendance: "",
  };
}

export default function EngagementFields({
  entry,
  index,
  onChange,
  onRemove,
  canRemove,
  disabled,
  errors = {},
}) {
  const prefix = `engagement-${index}`;
  const names = labels[entry.type];
  const [showIdHelp, setShowIdHelp] = useState(false);
  const helpContainer = useRef(null);
  const helpButton = useRef(null);
  const helpDialog = useRef(null);
  const idLabel = names[1];

  const explanations = {
    EID: [
      "EID on this form means the organization’s federal tax ID, usually called an Employer Identification Number (EIN).",
      "Ask your employer or school for its EIN. Enter the organization’s number here, rather than your Social Security number.",
    ],
    VID: [
      "VID on this form means the volunteer agency’s identifier or reference number.",
      "Ask your volunteer agency which identifier to enter. If you do not have one, contact program staff for guidance.",
    ],
    JTID: [
      "JTID on this form means the job-training program’s identifier or reference number.",
      "Ask your training provider which program identifier to enter. If you do not have one, contact program staff for guidance.",
    ],
  };

  function closeIdHelp() {
    setShowIdHelp(false);
    helpButton.current?.focus();
  }

  useEffect(() => {
    if (!showIdHelp) return;

    helpDialog.current?.focus();

    function closeOutside(event) {
      if (!helpContainer.current?.contains(event.target)) {
        setShowIdHelp(false);
      }
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowIdHelp(false);
        helpButton.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showIdHelp]);

  return (
    <fieldset className="engagement" disabled={disabled}>
      <legend>Engagement {index + 1}</legend>

      <label htmlFor={`${prefix}-type`}>Engagement type</label>

      <select
        id={`${prefix}-type`}
        value={entry.type}
        onChange={(event) => {
          setShowIdHelp(false);
          onChange({ ...blankEngagement(), type: event.target.value });
        }}
      >
        {Object.entries(TYPES).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      <Field
        id={`${prefix}-name`}
        label={names[0]}
        value={entry.name}
        onChange={(event) =>
          onChange({ ...entry, name: event.target.value })
        }
        maxLength={160}
        required
        error={errors[`engagements[${index}].name`]}
      />

      <div className="organization-id-field has-id-help">
        <Field
          id={`${prefix}-id`}
          label={names[1]}
          value={entry.organizationId}
          onChange={(event) =>
            onChange({ ...entry, organizationId: event.target.value })
          }
          maxLength={60}
          required
          error={errors[`engagements[${index}].organizationId`]}
        />

        <div className="id-help" ref={helpContainer}>
          <button
            ref={helpButton}
            type="button"
            className="id-help-button"
            aria-expanded={showIdHelp}
            aria-controls={`${prefix}-id-explanation`}
            aria-haspopup="dialog"
            onClick={() => setShowIdHelp((open) => !open)}
          >
            What is {idLabel}?
          </button>

          {showIdHelp && (
            <div
              id={`${prefix}-id-explanation`}
              className="id-help-popup"
              role="dialog"
              aria-labelledby={`${prefix}-id-title`}
              tabIndex={-1}
              ref={helpDialog}
            >
              <h3 id={`${prefix}-id-title`}>What is {idLabel}?</h3>

              {explanations[idLabel].map((text) => (
                <p key={text}>{text}</p>
              ))}

              <button
                type="button"
                className="secondary"
                onClick={closeIdHelp}
              >
                Close explanation
              </button>
            </div>
          )}
        </div>
      </div>

      {entry.type === "EDUCATION" && (
        <>
          <Field
            id={`${prefix}-program`}
            label="Major/Program"
            value={entry.program || ""}
            onChange={(event) =>
              onChange({ ...entry, program: event.target.value })
            }
            maxLength={160}
            required
          />

          <label htmlFor={`${prefix}-attendance`}>Attendance</label>

          <select
            id={`${prefix}-attendance`}
            value={entry.attendance || ""}
            onChange={(event) =>
              onChange({ ...entry, attendance: event.target.value })
            }
            required
          >
            <option value="">Choose attendance</option>
            <option value="FULL_TIME">Full time</option>
            <option value="HALF_TIME">Half time</option>
            <option value="LESS_THAN_HALF_TIME">Less than half time</option>
          </select>

          <p className="hint">
            Report your enrollment level. Staff review educational eligibility
            separately from reported hours.
          </p>
        </>
      )}

      <Field
        id={`${prefix}-hours`}
        label={
          entry.type === "EDUCATION"
            ? "Classroom hours this month (optional)"
            : "Number of hours this month"
        }
        type="number"
        min="0"
        max="744"
        step="0.25"
        value={entry.hours}
        onChange={(event) =>
          onChange({ ...entry, hours: event.target.value })
        }
        required={entry.type !== "EDUCATION"}
        error={errors[`engagements[${index}].hours`]}
      />

      {canRemove && (
        <button type="button" className="secondary" onClick={onRemove}>
          Remove engagement {index + 1}
        </button>
      )}
    </fieldset>
  );
}