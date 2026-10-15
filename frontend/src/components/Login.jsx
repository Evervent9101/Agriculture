import React, { useEffect, useState } from 'react';
import { api, rememberToken } from '../api.js';

// Login and sign-up on one page.
export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [registration, setRegistration] = useState(true);
  const [f, setF] = useState({ full_name: '', username: '', password: '', again: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/auth/config')
      .then((c) => setRegistration(c.registration))
      .catch(() => {});
  }, []);

  const set = (key) => (e) => setF({ ...f, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'register' && f.password !== f.again) {
      setError('The two passwords are not the same');
      return;
    }
    setBusy(true);
    try {
      const body =
        mode === 'register'
          ? { full_name: f.full_name, username: f.username, password: f.password }
          : { username: f.username, password: f.password };
      const res = await api(mode === 'register' ? '/auth/register' : '/auth/login', { method: 'POST', body });
      rememberToken(res.token);
      onLogin(res.user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const register = mode === 'register';

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1 className="login-title">🌾 My Farm</h1>
        <p className="muted">
          {register ? 'Create your account to keep your crops and records safe.' : 'Log in to see your crops and records.'}
        </p>

        <form className="form" onSubmit={submit}>
          {register && (
            <label>
              Your name
              <input value={f.full_name} onChange={set('full_name')} autoComplete="name" required />
            </label>
          )}
          <label>
            Username
            <input
              value={f.username}
              onChange={set('username')}
              autoComplete="username"
              autoCapitalize="none"
              placeholder="for example ramesh or your phone number"
              required
            />
          </label>
          <label>
            Password {register && <span className="muted">(at least 8 characters)</span>}
            <input
              type="password"
              value={f.password}
              onChange={set('password')}
              autoComplete={register ? 'new-password' : 'current-password'}
              required
            />
          </label>
          {register && (
            <label>
              Type the password again
              <input type="password" value={f.again} onChange={set('again')} autoComplete="new-password" required />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? 'Please wait…' : register ? 'Create account' : 'Log in'}
          </button>
        </form>

        {registration ? (
          <p className="login-switch">
            {register ? 'Already have an account?' : 'New here?'}{' '}
            <button
              type="button"
              className="link"
              onClick={() => {
                setMode(register ? 'login' : 'register');
                setError('');
              }}
            >
              {register ? 'Log in' : 'Create an account'}
            </button>
          </p>
        ) : (
          <p className="muted login-switch">New accounts are closed. Ask the person who runs this server.</p>
        )}
      </div>
    </div>
  );
}
