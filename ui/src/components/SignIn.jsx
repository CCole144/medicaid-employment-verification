import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { signIn } from "../features/sessionSlice";
export default function SignIn() {
  const dispatch = useDispatch();
  const { status, error } = useSelector((s) => s.session);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  async function submit(event) {
    event.preventDefault();
    await dispatch(signIn({ username, password }));
    setPassword("");
  }
  return (
    <section className="card sign-in">
      <h2>Sign in</h2>
      <p>Applicants submit records. Employees review submitted applications.</p>
      <form onSubmit={submit}>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p role="alert">{error}</p>}
        <button disabled={status === "loading"}>
          {status === "loading" ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </section>
  );
}
