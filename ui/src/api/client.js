let csrf;
export class ApiError extends Error {
  constructor(message, status, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}
export function resetCsrf() {
  csrf = undefined;
}
async function token() {
  if (!csrf) {
    const response = await fetch("/api/csrf", { credentials: "same-origin" });
    if (!response.ok)
      throw new ApiError("Could not connect to the API.", response.status);
    csrf = await response.json();
  }
  return csrf;
}
export async function request(
  path,
  { method = "GET", body, blob = false } = {},
) {
  const headers = {};
  if (method !== "GET") {
    const value = await token();
    headers[value.headerName] = value.token;
  }
  if (
    body !== undefined &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams)
  ) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(
      "Could not connect to the API. Check that the Java server is running.",
      0,
    );
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) resetCsrf();
    throw new ApiError(
      error.message || `Request failed (${response.status}).`,
      response.status,
      error.fields,
    );
  }
  if (response.status === 204) return null;
  return blob ? response.blob() : response.json();
}
export async function login(credentials) {
  await request("/login", {
    method: "POST",
    body: new URLSearchParams(credentials),
  });
  resetCsrf();
  return request("/me");
}
export async function logout() {
  await request("/logout", { method: "POST" });
  resetCsrf();
}
export async function downloadDocument(applicationId, document) {
  const blob = await request(
    `/applications/${applicationId}/documents/${document.id}`,
    { blob: true },
  );
  const url = URL.createObjectURL(blob);
  const link = documentElement(document.filename, url);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function documentElement(filename, url) {
  const element = globalThis.document.createElement("a");
  element.href = url;
  element.download = filename;
  globalThis.document.body.appendChild(element);
  return element;
}
