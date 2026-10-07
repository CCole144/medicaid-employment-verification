import { NavLink, Outlet } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { signOut } from "../features/sessionSlice";
export default function Layout() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.session.user);
  return (
    <>
      <header className="header">
        <h1>Missouri Medicaid Verification and Employment–MOVE</h1>
      </header>
      <nav className="navigation" aria-label="Main navigation">
        <strong>Missouri Medicaid</strong>
        <div>
          <NavLink to="/requirements">Requirements</NavLink>
          <NavLink to="/application">Application</NavLink>
          <NavLink to="/review">Employee Review</NavLink>
        </div>
      </nav>
      {user && (
        <div className="account">
          <span>
            Signed in as {user.username} ({user.role.toLowerCase()})
          </span>
          <button className="secondary" onClick={() => dispatch(signOut())}>
            Sign out
          </button>
        </div>
      )}
      <main id="main-content">
        <Outlet />
      </main>
      <footer>
        MOVE course project · Missouri Medicaid Verification and Employment
      </footer>
    </>
  );
}
