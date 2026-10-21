import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { loadRequirements } from "../features/requirementsSlice";
import "./RequirementsPage.scss";

const GUIDANCE_URL =
  "https://dss.mo.gov/community-engagement-requirements-frequently-asked-questions";

const TOPICS = [
  {
    id: "employment",
    label: "Employment",
    title: "Employment",
    introduction:
      "Paid work, self-employment, and certain unpaid work may count toward your monthly requirement.",
    examples: [
      "Working shifts at a grocery store, restaurant, or other business",
      "Running your own business or providing services as an independent contractor",
      "Earning money through delivery driving, rideshare services, babysitting, or yard work",
      "Working in exchange for food, housing, goods, or services",
    ],
    additionalInformation: (
      <p>
        You may meet the requirement by completing at least{" "}
        <strong>80 hours</strong> of qualifying activities in a month, or by
        meeting the countable monthly income threshold of{" "}
        <strong>$580 (2026 amount)</strong>.
      </p>
    ),
  },
  {
    id: "community-engagement",
    label: "Community Engagement",
    title: "Community Engagement",
    introduction:
      "Certain volunteer and community service activities may count when they are organized through a qualifying public agency or nonprofit organization and directly benefit the community.",
    examples: [
      "Assisting at a community meal program or food bank",
      "Volunteering with a local nonprofit organization",
      "Assisting with community cleanup and other service projects",
      "Helping a public agency deliver eligible community services",
    ],
    additionalInformation: (
      <p>
        Not every volunteer activity qualifies. Check that the organization and
        activity meet program rules and keep a record of your participation hours.
      </p>
    ),
  },
  {
    id: "education",
    label: "Education",
    title: "Education",
    introduction:
      "Attending school or participating in qualifying education or job-training activities may help you meet engagement requirements.",
    examples: [
      "Attending community or four-year college",
      "Enrolling in a technical or vocational education program",
      "Completing a General Education Development (GED) program",
      "Participating in an approved job-training or workforce development program",
    ],
    additionalInformation: (
      <p>
        If your school considers you enrolled at least <strong>half-time</strong>,
        you may meet the requirement for that month. If you attend less than
        half-time, eligible education or training hours may be combined with other
        qualifying activities to reach the required total.
      </p>
    ),
  },
  {
    id: "covered-reasons",
    label: "Covered Reasons",
    title: "You May Qualify for a Covered Reason",
    introduction:
      "Some people may be exempt from community engagement requirements. Review current official guidance and describe your situation on the application so staff can review it.",
    examples: [
      "Being pregnant or receiving qualifying postpartum Medicaid coverage",
      "Caring for a child age 13 or younger, or a person with a disability",
      "Having a medical condition that qualifies under the program’s medical-frailty rules",
      "Being a former foster youth under age 26 who meets applicable criteria",
      "Having Medicare Part A or Part B",
      "Meeting certain other qualifying work-requirement or program-participation criteria",
    ],
    additionalInformation: (
      <p>
        Staff can review whether a covered reason applies to your situation. You
        can add an explanation and supporting documents to your application.
      </p>
    ),
  },
];

export default function RequirementsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { data, status, error } = useSelector(
    (state) => state.requirements
  );

  const [activeTopicId, setActiveTopicId] = useState(null);

  const detailsHeading = useRef(null);
  const lastButton = useRef(null);

  const activeTopic = TOPICS.find(
    (topic) => topic.id === activeTopicId
  );

  useEffect(() => {
    if (status === "idle") {
      dispatch(loadRequirements());
    }
  }, [dispatch, status]);

  // Move keyboard focus to the information that was opened.
  useEffect(() => {
    if (activeTopicId) {
      detailsHeading.current?.focus();
    }
  }, [activeTopicId]);

  function toggleTopic(topicId, event) {
    lastButton.current = event.currentTarget;

    setActiveTopicId((current) =>
      current === topicId ? null : topicId
    );
  }

  function closeDetails() {
    setActiveTopicId(null);
    lastButton.current?.focus();
  }

  return (
    <div className="requirements-page">
      <h2>Medicaid Employment Requirements</h2>

      <p>
        Learn about the requirements and what information you may need to provide
        to maintain your Medicaid coverage.
      </p>

      {status === "loading" && (
        <p role="status">Loading requirements…</p>
      )}

      {error && (
        <div role="alert">
          <p>{error}</p>

          <button
            type="button"
            onClick={() => dispatch(loadRequirements())}
          >
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
              {TOPICS.map((topic) => (
                <li key={topic.id}>
                  <button
                    type="button"
                    className="requirement-topic-button"
                    aria-expanded={activeTopicId === topic.id}
                    aria-controls="requirements-topic-details"
                    onClick={(event) => toggleTopic(topic.id, event)}
                  >
                    {topic.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section
            id="requirements-topic-details"
            className="requirement-details"
            aria-labelledby="requirements-topic-title"
            hidden={!activeTopic}
          >
            {activeTopic && (
              <>
                <h3
                  id="requirements-topic-title"
                  ref={detailsHeading}
                  tabIndex={-1}
                >
                  {activeTopic.title}
                </h3>

                <p>{activeTopic.introduction}</p>

                <p>
                  <strong>Examples include:</strong>
                </p>

                <ul>
                  {activeTopic.examples.map((example) => (
                    <li key={example}>{example}</li>
                  ))}
                </ul>

                {activeTopic.additionalInformation}

                <p>
                  <a
                    href={GUIDANCE_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Read current official Medicaid guidance
                  </a>
                </p>

                <button
                  type="button"
                  className="secondary"
                  onClick={closeDetails}
                >
                  Close information
                </button>
              </>
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