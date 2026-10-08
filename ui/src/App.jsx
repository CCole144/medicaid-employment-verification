import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { Routes, Route, Navigate } from "react-router-dom";
import { restoreSession } from "./features/sessionSlice";
import Layout from "./components/Layout";
import RequirementsPage from "./pages/RequirementsPage";
import ApplicationPage from "./pages/ApplicationPage";
import ReviewPage from "./pages/ReviewPage";
export default function App() {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/requirements" replace />} />
        <Route path="requirements" element={<RequirementsPage />} />
        <Route path="application" element={<ApplicationPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="*" element={<Navigate to="/requirements" replace />} />
      </Route>
    </Routes>
  );
}
