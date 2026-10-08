import { TYPES } from "./EngagementFields";
export const readable = (value) =>
  (value || "").replaceAll("_", " ").toLowerCase();
export default function ApplicationSummary({ application: a }) {
  const education = a.engagements.filter((e) => e.type === "EDUCATION");
  return (
    <>
      <section className="card">
        <h2>Personal Information</h2>
        <dl className="personal-info">
          <dt>Last name:</dt>
          <dd>{a.lastName}</dd>
          <dt>Middle initial:</dt>
          <dd>{a.middleInitial || "—"}</dd>
          <dt>First name:</dt>
          <dd>{a.firstName}</dd>
          <dt>DOB:</dt>
          <dd>{a.dob}</dd>
          <dt>SSN:</dt>
          <dd>{a.ssnMasked}</dd>
        </dl>
      </section>
      <section className="card">
        <h2>Community Engagement</h2>
        <p>Reporting month: {a.reportingMonth}</p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>ID</th>
                <th>Hours worked</th>
              </tr>
            </thead>
            <tbody>
              {a.engagements.map((entry, index) => (
                <tr key={index}>
                  <td>{TYPES[entry.type]}</td>
                  <td>{entry.name}</td>
                  <td>{entry.organizationId}</td>
                  <td>{entry.hours}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan="3">Total:</th>
                <td>{a.totalHours}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p>
          <strong>Monthly income (pre-tax):</strong>
        </p>
        <p className="muted">
          {Number(a.monthlyIncome).toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          })}
        </p>
        {education.length > 0 && (
          <>
            <p>Student information:</p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Major/Program</th>
                    <th>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {education.map((entry, index) => (
                    <tr key={index}>
                      <td>{entry.name}</td>
                      <td>{entry.program}</td>
                      <td>{readable(entry.attendance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {a.coveredReason && (
          <p>
            <strong>Covered reason provided:</strong> {a.coveredReason}
          </p>
        )}
      </section>
    </>
  );
}
