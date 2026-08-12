import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatINR } from '../constants';
import { useAuth } from '../auth/AuthContext';

const BALANCE_OPTIONS = Array.from({ length: 10 }, (_, index) => (index + 1) * 100000);

function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    name: '',
    age: '',
    email: '',
    password: '',
    confirmPassword: '',
    initialBalance: 500000
  });

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    try {
      await auth.register(form);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setMessage(error.response?.data?.error || 'Unable to create account');
    }
  };

  return (
    <main className="auth-page register-page">
      <section className="auth-form-panel wide" aria-labelledby="register-title">
        <div>
          <h2 id="register-title" align="center">Create account</h2>
        </div>

        <form onSubmit={handleSubmit} className="auth-form auth-grid-form">
          <label>
            Full name
            <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
          </label>
          <label className="age-field">
            Age
            <input
              type="number"
              min="13"
              max="100"
              value={form.age}
              onChange={(event) => updateField('age', event.target.value)}
              required
            />
          </label>
          <label className="full-row">
            Gmail / Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) => updateField('confirmPassword', event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <fieldset className="balance-selector full-row">
            <legend>Initial paper trading balance</legend>
            <div>
              {BALANCE_OPTIONS.map((amount) => (
                <button
                  type="button"
                  key={amount}
                  className={form.initialBalance === amount ? 'selected' : ''}
                  onClick={() => updateField('initialBalance', amount)}
                >
                  {formatINR(amount).replace('.00', '')}
                </button>
              ))}
            </div><br></br>
          </fieldset>

          {message ? <div className="auth-error full-row">{message}</div> : null}

          <button type="submit" className="auth-primary-button full-row">Create account</button>
        </form>

        <p className="auth-secondary-action" align="center">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}

export default RegisterPage;
