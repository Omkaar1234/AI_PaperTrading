import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, SearchBar, Tooltip } from '../ui';
import NotificationDropdown from './NotificationDropdown';
import { useTheme } from '../../context/ThemeContext';

function TopNavigation({ meta, trading, auth }) {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [now, setNow] = useState(() => new Date());
  const [query, setQuery] = useState('');
  const [statusText, setStatusText] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.notification-bell-container')) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showNotifications]);

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

  const unreadCount = trading.unreadNotificationCount ?? trading.notifications?.filter((n) => !n.read).length ?? 0;

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
          {isMarketOpen ? 'NSE · 09:15–15:30 IST · OPEN' : 'NSE · 09:15–15:30 IST · CLOSED'}
        </Badge>

        <div className="clock-chip" aria-label="Current date and time">
          {formattedDateTime}
        </div>

        <div className="notification-bell-container" style={{ position: 'relative' }}>
          <Tooltip label="Notifications">
            <button
              type="button"
              className={`icon-button ${showNotifications ? 'active' : ''}`}
              aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
              aria-haspopup="dialog"
              aria-expanded={showNotifications}
              onClick={() => setShowNotifications((prev) => !prev)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 ? <em>{Math.min(unreadCount, 9)}</em> : null}
            </button>
          </Tooltip>

          {showNotifications && (
            <NotificationDropdown
              notifications={trading.notifications || []}
              unreadCount={unreadCount}
              loading={trading.notificationsLoading}
              error={trading.notificationsError}
              onClose={() => setShowNotifications(false)}
              onMarkRead={(id) => trading.markNotificationRead?.(id)}
              onMarkAllRead={() => trading.markAllNotificationsRead?.()}
              onRefresh={() => trading.fetchNotifications?.()}
            />
          )}
        </div>

        <Tooltip label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
          <button
            type="button"
            className="icon-button theme-toggle-btn"
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-pressed={isDark}
            onClick={toggleTheme}
          >
            {isDark ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </Tooltip>

        <div className="profile-chip" aria-label="User profile">
          <span className="profile-avatar" aria-hidden="true">
            {(auth.user?.name?.[0] || auth.user?.email?.[0] || 'T').toUpperCase()}
          </span>
          <span className="profile-name">
            {auth.user?.name || auth.user?.email?.split('@')[0] || 'Trader'}
          </span>
        </div>

        <Tooltip label="Sign out">
          <button type="button" className="icon-button logout-button" aria-label="Sign out" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </Tooltip>
      </div>
    </header>
  );
}

export default TopNavigation;
