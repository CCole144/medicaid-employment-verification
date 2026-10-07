import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { makeStore } from "../app/store";
export const application = {
  id: "a1",
  version: 0,
  status: "DRAFT",
  firstName: "Cameron",
  lastName: "Cole",
  middleInitial: "C",
  dob: "2000-01-01",
  ssnMasked: "***-**-6789",
  monthlyIncome: 740,
  reportingMonth: "2026-01",
  coveredReason: "",
  totalHours: 80,
  engagements: [
    {
      type: "EMPLOYMENT",
      name: "Employer",
      organizationId: "123",
      hours: 80,
      program: "",
      attendance: null,
    },
  ],
  documents: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
export function renderWithStore(
  element,
  {
    user = { username: "applicant", role: "APPLICANT" },
    state = {},
    route = "/application",
  } = {},
) {
  const store = makeStore({
    session: { user, status: "ready", error: null },
    ...state,
  });
  return {
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>{element}</MemoryRouter>
      </Provider>,
    ),
    store,
  };
}
