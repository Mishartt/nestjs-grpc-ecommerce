import { type SyntheticEvent, useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { authApi } from '../api/client';
import type { Captcha } from '../types';
import { useAuthStore } from '../shared/auth/store';

export function RegisterPage() {
  const token = useAuthStore((state) => state.token);
  const register = useAuthStore((state) => state.register);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const loadCaptcha = useCallback(async () => {
    setCaptchaCode('');
    setCaptcha(await authApi.captcha());
  }, []);

  useEffect(() => {
    void loadCaptcha().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load CAPTCHA');
    });
  }, [loadCaptcha]);

  if (token) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captcha) {
      return;
    }
    setError('');
    setPending(true);
    try {
      await register({
        email,
        password,
        captchaId: captcha.captchaId,
        captcha: captchaCode,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      await loadCaptcha().catch(() => undefined);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>Create account</h1>
        <p className="muted">Email, password and CAPTCHA.</p>
        {error ? <p className="error">{error}</p> : null}
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>
        <div className="captcha-row">
          {captcha ? (
            <button
              type="button"
              className="captcha-btn"
              onClick={() => void loadCaptcha()}
              title="Refresh CAPTCHA"
            >
              <img src={captcha.image} alt="CAPTCHA" />
            </button>
          ) : (
            <div className="captcha-placeholder">Loading…</div>
          )}
          <label className="grow">
            CAPTCHA
            <input
              value={captchaCode}
              onChange={(e) => setCaptchaCode(e.target.value)}
              autoComplete="off"
              required
              pattern="[A-Za-z0-9]+"
            />
          </label>
        </div>
        <p className="hint">Click the image to refresh.</p>
        <button type="submit" disabled={pending || !captcha}>
          {pending ? 'Creating…' : 'Register'}
        </button>
        <p className="muted">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
