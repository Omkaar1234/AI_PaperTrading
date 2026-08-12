import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../../constants';
import { Badge, SearchBar, Tooltip } from '../ui';

function TopNavigation({ meta, trading, auth }) {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [query, setQuery] = useState('');
  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formattedDateTime = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(now),
    [now]
  );

  const isMarketOpen = useMemo(() => {
    const day = now.getDay();
    const minutes = now.getHours() * 60 + now.getMinutes();
    return day >= 1 && day <= 5 && minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
  }, [now]);

  const handleSearchSubmit = async (event) => {
    event.preventDefault();
    const trimmed = query.trim();

    if (!trimmed) {
      return;
    }

    setStatusText('Searching');
    const asset = await trading.resolveAsset(trimmed);

    if (asset?.symbol) {
      await trading.selectAsset(asset);
      setQuery(asset.symbol);
      setStatusText('Loaded');
      navigate('/trade');
      return;
    }

    setStatusText('No match');
  };

  const handleLogout = async () => {
    await auth.logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="top-navigation">
      <div className="top-navigation-title">
        <p>{meta.eyebrow}</p>
        <h1>{meta.title}</h1>
      </div>

      <SearchBar
        value={query}
        onSubmit={handleSearchSubmit}
        onChange={(event) => {
          setQuery(event.target.value);
          setStatusText('');
        }}
        placeholder="Search NSE symbol, stock, or crypto"
        statusText={statusText}
      />

      <div className="top-navigation-controls">
        <Badge tone={isMarketOpen ? 'positive' : 'negative'} className="market-status">
          <span aria-hidden="true" />
          {isMarketOpen ? 'Market Open' : 'Market Closed'}
        </Badge>

        <div className="clock-chip" aria-label="Current date and time">
          {formattedDateTime}
        </div>

        <Tooltip label="Notifications">
          <button type="button" className="icon-button" aria-label="Notifications">
            <span aria-hidden="true">NT</span>
            {trading.orders?.length ? <em>{Math.min(trading.orders.length, 9)}</em> : null}
          </button>
        </Tooltip>

        <button type="button" className="profile-chip" aria-label="User profile">
          <span aria-hidden="true">U</span>
          <strong>{auth.user?.name || auth.user?.email || formatINR(trading.user?.balance || 0)}</strong>
        </button>

        <Tooltip label="Logout">
          <button type="button" className="icon-button" aria-label="Logout" onClick={handleLogout}>
            <span aria-hidden="true">LO</span>
          </button>
        </Tooltip>
      </div>
    </header>
  );
}

export default TopNavigation;
