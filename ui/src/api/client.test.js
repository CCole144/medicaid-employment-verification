import { describe, it, expect, vi, beforeEach } from "vitest";
import { request, login, logout, resetCsrf, downloadDocument } from "./client";
function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    blob: async () => new Blob(["pdf"]),
  };
}
beforeEach(() => {
  resetCsrf();
  vi.stubGlobal("fetch", vi.fn());
});
describe("API client", () => {
  it("sends JSON with CSRF and session credentials", async () => {
    fetch
      .mockResolvedValueOnce(
        response({ token: "token", headerName: "X-CSRF-TOKEN" }),
      )
      .mockResolvedValueOnce(response({ id: "a1" }));
    expect(
      await request("/applications", {
        method: "POST",
        body: { firstName: "Cameron" },
      }),
    ).toEqual({ id: "a1" });
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/applications",
      expect.objectContaining({
        credentials: "same-origin",
        headers: {
          "X-CSRF-TOKEN": "token",
          "Content-Type": "application/json",
        },
        body: '{"firstName":"Cameron"}',
      }),
    );
  });
  it("lets the browser set the multipart content type", async () => {
    fetch
      .mockResolvedValueOnce(
        response({ token: "t", headerName: "X-CSRF-TOKEN" }),
      )
      .mockResolvedValueOnce(response({}));
    await request("/upload", { method: "POST", body: new FormData() });
    expect(fetch.mock.calls[1][1].headers).not.toHaveProperty("Content-Type");
  });
  it("surfaces validation and network errors", async () => {
    fetch.mockResolvedValueOnce(
      response({ message: "Invalid", fields: { ssn: "bad" } }, 400),
    );
    await expect(request("/application")).rejects.toMatchObject({
      message: "Invalid",
      status: 400,
      fields: { ssn: "bad" },
    });
    fetch.mockRejectedValueOnce(new Error("network"));
    await expect(request("/application")).rejects.toMatchObject({ status: 0 });
  });
  it("renews the token after login and logs out", async () => {
    fetch
      .mockResolvedValueOnce(
        response({ token: "old", headerName: "X-CSRF-TOKEN" }),
      )
      .mockResolvedValueOnce(response(null, 204))
      .mockResolvedValueOnce(response({ role: "APPLICANT" }))
      .mockResolvedValueOnce(
        response({ token: "new", headerName: "X-CSRF-TOKEN" }),
      )
      .mockResolvedValueOnce(response(null, 204));
    expect(
      await login({ username: "applicant", password: "password" }),
    ).toEqual({ role: "APPLICANT" });
    await logout();
    expect(fetch.mock.calls[4][1].headers["X-CSRF-TOKEN"]).toBe("new");
  });
  it("downloads authenticated document bytes without exposing an unauthenticated URL", async () => {
    fetch.mockResolvedValueOnce(response({}));
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:proof"),
        revokeObjectURL: vi.fn(),
      }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    await downloadDocument("a1", { id: "d1", filename: "proof.pdf" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/applications/a1/documents/d1",
      expect.anything(),
    );
    expect(click).toHaveBeenCalled();
  });
});
