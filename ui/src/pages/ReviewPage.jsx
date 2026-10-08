import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  loadApplications,
  loadApplication,
  loadHistory,
  recordDecision,
  clearCurrent,
} from "../features/applicationSlice";
import SignIn from "../components/SignIn";
import ApplicationSummary, { readable } from "../components/ApplicationSummary";
import DocumentUpload from "../components/DocumentUpload";
export default function ReviewPage() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.session.user);
  const { items, current, history, pending, error } = useSelector(
    (s) => s.applications,
  );
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (user?.role === "REVIEWER") {
      dispatch(clearCurrent());
      dispatch(loadApplications());
    }
  }, [dispatch, user]);
  useEffect(() => {
    setNote("");
    if (current) dispatch(loadHistory(current.id));
  }, [dispatch, current]);
  async function decide(decision) {
    setMessage("");
    const action = await dispatch(
      recordDecision({
        id: current.id,
        version: current.version,
        decision,
        note,
      }),
    );
    if (recordDecision.fulfilled.match(action))
      setMessage("Review decision saved.");
  }
  if (!user) return <SignIn />;
  if (user.role !== "REVIEWER")
    return (
      <section className="card">
        <h2>Employee access required</h2>
        <p>
          Sign out and sign in with an employee account to review submissions.
        </p>
      </section>
    );
  const reviewable =
    current && ["SUBMITTED", "FURTHER_REVIEW"].includes(current.status);
  return (
    <>
      <section className="card">
        <h2>Employee Review</h2>
        <button
          className="secondary"
          disabled={pending > 0}
          onClick={() => {
            dispatch(clearCurrent());
            setMessage("");
            dispatch(loadApplications());
          }}
        >
          Refresh applications
        </button>
        <label htmlFor="review-application">Select an application</label>
        <select
          id="review-application"
          value={current?.id || ""}
          disabled={pending > 0}
          onChange={(e) => {
            setMessage("");
            e.target.value
              ? dispatch(loadApplication(e.target.value))
              : dispatch(clearCurrent());
          }}
        >
          <option value="">Choose an application</option>
          {items.map((a) => (
            <option value={a.id} key={a.id}>
              {a.firstName} {a.lastName} · {a.reportingMonth} ·{" "}
              {readable(a.status)}
            </option>
          ))}
        </select>
        {items.length === 0 && pending === 0 && (
          <p>No submitted applications yet.</p>
        )}
        {current && (
          <p>
            <strong>Status:</strong> {readable(current.status)}
          </p>
        )}
      </section>
      {pending > 0 && <p role="status">Working…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {current && (
        <>
          <ApplicationSummary application={current} />
          <DocumentUpload application={current} />
          <section className="card final-decision">
            <label htmlFor="review-note">Review note</label>
            <textarea
              id="review-note"
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={!reviewable || pending > 0}
            />
            <p className="hint">
              Include a note for corrections or further review.
            </p>
            <div className="decision-buttons">
              <button
                disabled={!reviewable || pending > 0}
                onClick={() => decide("APPROVE")}
              >
                Approve &amp; Submit
              </button>
              <button
                disabled={!reviewable || pending > 0 || !note.trim()}
                onClick={() => decide("FURTHER_REVIEW")}
              >
                Send for Further Review
              </button>
              <button
                disabled={!reviewable || pending > 0 || !note.trim()}
                onClick={() => decide("RETURN")}
              >
                Return for Correction
              </button>
            </div>
          </section>
          <section className="card">
            <h2>Review History</h2>
            {history.length === 0 ? (
              <p>No decisions recorded yet.</p>
            ) : (
              <ul>
                {history.map((event) => (
                  <li key={event.id}>
                    {readable(event.decision)} · {event.reviewer} ·{" "}
                    {new Date(event.at).toLocaleString()}
                    {event.note && <p>{event.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
