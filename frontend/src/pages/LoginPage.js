import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../constants';
import { useAuth } from '../auth/AuthContext';

function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const from = location.state?.from?.pathname || '/dashboard';

  const googleError = useMemo(() => {
    if (searchParams.get('error') === 'google_state') {
      return 'Google sign-in expired. Start again from this page.';
    }
    if (searchParams.get('error') === 'google_auth_failed') {
      return 'Google authentication failed. Check configuration and try again.';
    }
    return '';
  }, [searchParams]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    try {
      await auth.login(form);
      navigate(from, { replace: true });
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
        'Unable to sign in with those credentials'
      );
    }
  };

  return (
    <main className="auth-page login-page">

      {/* LEFT SIDE */}
      <section className="auth-landing-panel">

        <div className="auth-brand-strip">
          <strong align="center">UPRISE </strong><p>       </p><span>RISE WITH THE MARKET</span>
        </div>

        {/* MARKET TICKER */}
        <div className="auth-market-tape" aria-hidden="true">

          {/* ROW 1 */}
          <div className="market-tape-row">
            <div className="market-tape-track">

              <span>RELIANCE.NS</span>
              <b>₹2,918.40</b>

              <span>TCS.NS</span>
              <b>₹3,842.15</b>

              <span>INFY.NS</span>
              <b>₹1,574.90</b>

              <span>HDFCBANK.NS</span>
              <b>₹1,865.20</b>

              <span>ICICIBANK.NS</span>
              <b>₹1,432.60</b>

              <span>SBIN.NS</span>
              <b>₹812.35</b>

              <span>ITC.NS</span>
              <b>₹421.80</b>

              <span>BHARTIARTL.NS</span>
              <b>₹1,924.50</b>

              <span>LT.NS</span>
              <b>₹3,672.25</b>

              <span>MARUTI.NS</span>
              <b>₹12,845.00</b>

              {/* Duplicate for seamless scrolling */}

              <span>RELIANCE.NS</span>
              <b>₹2,918.40</b>

              <span>TCS.NS</span>
              <b>₹3,842.15</b>

              <span>INFY.NS</span>
              <b>₹1,574.90</b>

              <span>HDFCBANK.NS</span>
              <b>₹1,865.20</b>

              <span>ICICIBANK.NS</span>
              <b>₹1,432.60</b>

            </div>
          </div>

          {/* ROW 2 */}
          <div className="market-tape-row market-tape-row-reverse">
            <div className="market-tape-track">

              <span>AXISBANK.NS</span>
              <b>₹1,248.30</b>

              <span>HINDUNILVR.NS</span>
              <b>₹2,615.40</b>

              <span>ADANIENT.NS</span>
              <b>₹2,487.20</b>

              <span>WIPRO.NS</span>
              <b>₹528.75</b>

              <span>KOTAKBANK.NS</span>
              <b>₹2,135.60</b>

              <span>ASIANPAINT.NS</span>
              <b>₹2,412.90</b>

              <span>TATAMOTORS.NS</span>
              <b>₹718.40</b>

              <span>SUNPHARMA.NS</span>
              <b>₹1,756.25</b>

              <span>NTPC.NS</span>
              <b>₹386.70</b>

              <span>POWERGRID.NS</span>
              <b>₹342.80</b>

              {/* Duplicate for seamless scrolling */}

              <span>AXISBANK.NS</span>
              <b>₹1,248.30</b>

              <span>HINDUNILVR.NS</span>
              <b>₹2,615.40</b>

              <span>ADANIENT.NS</span>
              <b>₹2,487.20</b>

              <span>WIPRO.NS</span>
              <b>₹528.75</b>

              <span>KOTAKBANK.NS</span>
              <b>₹2,135.60</b>

            </div>
          </div>

        </div>

        {/* LANDING CONTENT */}
        <div className="auth-copy">
          <h1>
            Practice execution discipline before capital is Real
          </h1><br></br><br></br>

          <span>
            A simulated Indian equity portfolio with live market context, AI analysis and account-level risk controls tied to your own workspace.
          </span>
        </div>

      </section>

      {/* RIGHT SIDE LOGIN */}
      <section className="auth-form-panel" aria-labelledby="login-title">

        <div>
          <p className="auth-kicker"></p>

          <h2 id="login-title" align="center">
            LOGIN
          </h2>

          <br />
        </div>

        {/* GOOGLE LOGIN */}
        <a
          className="google-auth-button"
          href={`${API_BASE_URL}/api/auth/google/start`}
        >
          Continue with Google
        </a><br></br>

        <div className="auth-divider">
          <span>or email</span>
        </div>

        {/* EMAIL LOGIN */}
        <form onSubmit={handleSubmit} className="auth-form">

          <label>
            Email

            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value
                }))
              }
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password

            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password: event.target.value
                }))
              }
              autoComplete="current-password"
              required
            />
          </label>

          {(message || googleError) ? (
            <div className="auth-error">
              {message || googleError}
            </div>
          ) : null}

          <button
            type="submit"
            className="auth-primary-button"
          >
            Log in
          </button>

        </form>

        <p
          className="auth-secondary-action"
          align="center"
        >
          New to Uprise?
          <Link to="/register">
              Create account
          </Link>
        </p>

      </section>

    </main>
  );
}

export default LoginPage;