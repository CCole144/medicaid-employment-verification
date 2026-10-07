import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { loadRequirements } from "../features/requirementsSlice";
export default function RequirementsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data, status, error } = useSelector((s) => s.requirements);
  const [showReasons, setShowReasons] = useState(false);
  useEffect(() => {
    if (status === "idle") dispatch(loadRequirements());
  }, [dispatch, status]);
  return (
    <div className="requirements-page">
      <h2>Medicaid Employment Requirements</h2>
      <p>
        Learn about the requirements and what information you may need to
        provide to maintain your Medicaid coverage.
      </p>
      {status === "loading" && <p role="status">Loading requirements…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => dispatch(loadRequirements())}>
            Try again
          </button>
        </div>
      )}
      {data && (
        <>
          <section className="information-box">
            <h3>WHAT YOU NEED TO KNOW</h3>
            <p>{data.intro}</p>
            <ul className="category-grid">
              {data.categories.map((category) => (
                <li key={category}>{category}</li>
              ))}
            </ul>
          </section>
          <section className="information-box">
            <h3>You May Qualify for a Covered Reason</h3>
            <p>{data.coveredReasons}</p>
            <button
              onClick={() => setShowReasons(!showReasons)}
              aria-expanded={showReasons}
              aria-controls="covered-reasons"
            >
              View Covered Reasons
            </button>
            {showReasons && (
              <div id="covered-reasons">
                <p>
                  Staff can review whether a covered reason applies to your
                  situation. You can add an explanation and supporting documents
                  to your application.
                </p>
                <a href={data.guidanceUrl} target="_blank" rel="noreferrer">
                  Read current official Medicaid guidance
                </a>
              </div>
            )}
          </section>
        </>
      )}
      <div className="button-row">
        <button
          type="button"
          className="secondary"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
        <Link className="button" to="/application">
          Continue
        </Link>
      </div>
    </div>
  );
}
