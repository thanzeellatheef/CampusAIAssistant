import { Navigate } from 'react-router-dom';
import { Alert } from '../../../components/common/Alert';
import { TextField } from '../../../components/forms/TextField';
import { homePath } from '../home-path';
import { useAuth } from '../useAuth';
import { useLogin } from '../hooks/useLogin';

export function LoginPage() {
  const { user, loading } = useAuth();
  const { submit, submitting, error, fieldErrors } = useLogin();

  if (loading) {
    return (
      <main className="login-screen login-screen-reimagined login-checking">
        <p className="status">Checking session...</p>
      </main>
    );
  }

  if (user) {
    return <Navigate to={homePath(user)} replace />;
  }

  return (
    <main className="login-screen login-screen-reimagined">
      <section className="login-visual" aria-hidden="true">
        <div className="login-brand-lockup">
          <span className="login-brand-mark">C</span>
          <span><strong>Campus</strong><small>LEARNING PLATFORM</small></span>
        </div>
        <div className="login-visual-copy">
          <p className="login-edition"><span /> YOUR CAMPUS, CONNECTED</p>
          <h2>Make room<br />for <em>what's next.</em></h2>
          <p className="login-visual-caption">One place for the people who teach, learn, and move knowledge forward.</p>
        </div>
        <div className="login-architecture">
          <span className="architecture-column architecture-column-one" />
          <span className="architecture-column architecture-column-two" />
          <span className="architecture-column architecture-column-three" />
          <span className="architecture-crossbar" />
          <span className="architecture-caption">CAMPUS / 2026—27</span>
        </div>
        <div className="login-visual-footer"><span>LEARN WITH PURPOSE</span><span>01 — 04</span></div>
      </section>
      <section className="login-form-stage">
        <form className="login-form" onSubmit={submit}>
          <div className="login-form-heading">
            <p className="login-form-kicker">CAMPUS ACCOUNT</p>
            <h1>Sign in</h1>
            <p>Use your campus credentials to continue.</p>
          </div>
        {error ? <Alert message={error} /> : null}
        <TextField label="Email" name="email" type="email" autoComplete="username" error={fieldErrors.email} />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          error={fieldErrors.password}
        />
          <button className="button login-submit" type="submit" disabled={submitting}>
            <span>{submitting ? 'Signing in...' : 'Sign in'}</span><span aria-hidden="true">↗</span>
          </button>
          <p className="login-form-footnote"><span /> Protected campus session</p>
        </form>
        <p className="login-stage-footer">© Campus learning environment</p>
      </section>
    </main>
  );
}
