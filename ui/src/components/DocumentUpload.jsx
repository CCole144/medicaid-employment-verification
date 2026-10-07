import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { uploadDocument, deleteDocument } from "../features/applicationSlice";
import { downloadDocument } from "../api/client";
import { readable } from "./ApplicationSummary";
export const DOCUMENT_TYPES = {
  PAY_STUB: "Pay stub",
  EMPLOYER_LETTER: "Employer letter",
  SCHOOL_RECORD: "School record",
  VOLUNTEER_RECORD: "Volunteer record",
  TRAINING_RECORD: "Training record",
  OTHER: "Other",
};
export default function DocumentUpload({ application, editable = false }) {
  const dispatch = useDispatch();
  const pending = useSelector((s) => s.applications.pending);
  const [file, setFile] = useState(null);
  const [type, setType] = useState("PAY_STUB");
  const [date, setDate] = useState("");
  const [error, setError] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  async function upload(event) {
    event.preventDefault();
    setError(null);
    if (!file || file.size === 0 || file.size > 10 * 1024 * 1024) {
      setError("Select a nonempty file of 10 MB or less.");
      return;
    }
    if (!/\.(pdf|jpe?g|png|docx?)$/i.test(file.name)) {
      setError("Select a PDF, JPG, PNG, DOC, or DOCX file.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", type);
    formData.append("documentDate", date);
    const action = await dispatch(
      uploadDocument({ id: application.id, formData }),
    );
    if (uploadDocument.fulfilled.match(action)) {
      setFile(null);
      setFileKey((k) => k + 1);
    }
  }
  async function view(document) {
    setError(null);
    try {
      await downloadDocument(application.id, document);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="card documents">
      <h2>{editable ? "Employment Information" : "Supporting Documents"}</h2>
      {editable && (
        <>
          <p>
            Please upload proof of your employment, enrollment, community
            service, or training.
          </p>
          <p>
            <strong>Applicant Name:</strong> {application.firstName}{" "}
            {application.lastName}
          </p>
          <form onSubmit={upload}>
            <fieldset disabled={pending > 0}>
              <legend>Upload file</legend>
              <div className="two-columns">
                <div>
                  <label htmlFor="document-type">Document Type</label>
                  <select
                    id="document-type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {Object.entries(DOCUMENT_TYPES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="document-date">Date</label>
                  <input
                    id="document-date"
                    type="date"
                    max={new Date().toLocaleDateString("en-CA")}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <p id="file-help">
                Accepted formats: PDF, JPG, PNG, DOC/DOCX. Maximum 10 MB per
                file, 20 files per application.
              </p>
              <input
                key={fileKey}
                aria-label="Choose file"
                aria-describedby="file-help"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
              <button disabled={!file || !date}>Upload document</button>
            </fieldset>
          </form>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <h3>Uploaded Documents</h3>
      {application.documents.length === 0 ? (
        <p>No documents uploaded yet.</p>
      ) : (
        <ul className="document-list">
          {application.documents.map((document) => (
            <li key={document.id}>
              <strong>{document.filename}</strong>
              <p>
                Document Type: {DOCUMENT_TYPES[document.documentType]}
                <br />
                Document date: {document.documentDate}
                <br />
                Uploaded: {new Date(document.uploadedAt).toLocaleDateString()}
                <br />
                Status: {readable(document.status)}
              </p>
              <div className="button-row">
                <button type="button" onClick={() => view(document)}>
                  View / download
                </button>
                {editable && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={pending > 0}
                    onClick={() => {
                      if (window.confirm(`Delete ${document.filename}?`))
                        dispatch(
                          deleteDocument({
                            id: application.id,
                            documentId: document.id,
                          }),
                        );
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
