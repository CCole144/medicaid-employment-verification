import { it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DocumentUpload from "./DocumentUpload";
import { renderWithStore, application } from "../test/helpers";
import { request, downloadDocument } from "../api/client";
vi.mock("../api/client", () => ({
  request: vi.fn(),
  downloadDocument: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
it("uploads metadata and file together, then clears the file input", async () => {
  request.mockResolvedValue(application);
  renderWithStore(<DocumentUpload application={application} editable />);
  const file = new File(["%PDF-1.4"], "proof.pdf", { type: "application/pdf" });
  await userEvent.upload(screen.getByLabelText("Choose file"), file);
  fireEvent.change(screen.getByLabelText("Date"), {
    target: { value: "2026-01-01" },
  });
  /* jsdom's file-input constraint validation does not recognize user-event's synthetic FileList. Browser behavior is covered by Playwright. */ fireEvent.submit(
    screen.getByRole("button", { name: "Upload document" }).closest("form"),
  );
  expect(request).toHaveBeenCalledWith(
    "/applications/a1/documents",
    expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
  );
  const body = request.mock.calls[0][1].body;
  expect(body.get("documentType")).toBe("PAY_STUB");
  expect(body.get("file").name).toBe("proof.pdf");
  await waitFor(() =>
    expect(screen.getByLabelText("Choose file").files).toHaveLength(0),
  );
});
it("views and deletes saved documents, while review mode is read only", async () => {
  const doc = {
    id: "d1",
    filename: "proof.pdf",
    documentType: "PAY_STUB",
    documentDate: "2026-01-01",
    uploadedAt: "2026-01-01T00:00:00Z",
    status: "Received",
  };
  const a = { ...application, documents: [doc] };
  request.mockResolvedValue(application);
  downloadDocument.mockResolvedValue(null);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  renderWithStore(<DocumentUpload application={a} editable />);
  await userEvent.click(
    screen.getByRole("button", { name: "View / download" }),
  );
  expect(downloadDocument).toHaveBeenCalledWith("a1", doc);
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(request).toHaveBeenCalledWith("/applications/a1/documents/d1", {
    method: "DELETE",
  });
});
it("does not allow reviewer upload/delete controls", () => {
  renderWithStore(<DocumentUpload application={application} />);
  expect(screen.queryByLabelText("Choose file")).not.toBeInTheDocument();
});
