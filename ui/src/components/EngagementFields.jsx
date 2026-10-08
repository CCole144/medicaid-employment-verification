import Field from "./Field";
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
  return (
    <fieldset className="engagement" disabled={disabled}>
      <legend>Engagement {index + 1}</legend>
      <label htmlFor={`${prefix}-type`}>Engagement type</label>
      <select
        id={`${prefix}-type`}
        value={entry.type}
        onChange={(e) =>
          onChange({ ...blankEngagement(), type: e.target.value })
        }
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
        onChange={(e) => onChange({ ...entry, name: e.target.value })}
        maxLength={160}
        required
        error={errors[`engagements[${index}].name`]}
      />
      <Field
        id={`${prefix}-id`}
        label={names[1]}
        value={entry.organizationId}
        onChange={(e) => onChange({ ...entry, organizationId: e.target.value })}
        maxLength={60}
        required
        error={errors[`engagements[${index}].organizationId`]}
      />
      {entry.type === "EDUCATION" && (
        <>
          <Field
            id={`${prefix}-program`}
            label="Major/Program"
            value={entry.program || ""}
            onChange={(e) => onChange({ ...entry, program: e.target.value })}
            maxLength={160}
            required
          />
          <label htmlFor={`${prefix}-attendance`}>Attendance</label>
          <select
            id={`${prefix}-attendance`}
            value={entry.attendance || ""}
            onChange={(e) => onChange({ ...entry, attendance: e.target.value })}
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
        onChange={(e) => onChange({ ...entry, hours: e.target.value })}
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
