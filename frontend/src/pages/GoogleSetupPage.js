import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL, formatINR } from '../constants';
import { useAuth } from '../auth/AuthContext';

const BALANCE_OPTIONS = Array.from({ length: 10 }, (_, index) => (index + 1) * 100000);

function GoogleSetupPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', age: '', initialBalance: 500000 });
  const [message, setMessage] = useState('');

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/auth/google/setup`)
      .then((response) => {
        setProfile(response.data.profile);
        setForm((current) => ({ ...current, name: response.data.profile?.name || '' }));
      })
      .catch((error) => {
        setMessage(error.response?.data?.error || 'Google setup session expired');
      });
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    try {
      await auth.completeGoogleSetup(form);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setMessage(error.response?.data?.error || 'Unable to finish Google account setup');
    }
  };

  return (
    <main className="auth-page register-page">
      <section className="auth-form-panel wide" aria-labelledby="google-setup-title">
        <div>
          <p className="auth-kicker">Google account setup</p>
          <h2 id="google-setup-title">Finish trading profile</h2>
          {profile?.email ? <span className="auth-profile-note">{profile.email}</span> : null}
        </div>

        <form onSubmit={handleSubmit} className="auth-form auth-grid-form">
          <label>
            Full name
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>
          <label>
            Age
            <input
              type="number"
              min="13"
              max="120"
              value={form.age}
              onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))}
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
                  onClick={() => setForm((current) => ({ ...current, initialBalance: amount }))}
                >
                  {formatINR(amount).replace('.00', '')}
                </button>
              ))}
            </div>
          </fieldset>

          {message ? <div className="auth-error full-row">{message}</div> : null}

          <button type="submit" className="auth-primary-button full-row">Open dashboard</button>
        </form>
      </section>
    </main>
  );
}

export default GoogleSetupPage;
