import React, { useEffect, useMemo, useState } from 'react';

/**
 * Formats ISO timestamps into readable relative strings (e.g., 'Just now', '5m ago').
 */
function formatRelativeTime(dateInput) {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';
  const now = Date.now();
  const diffSec = Math.floor((now - date.getTime()) / 1000);
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

/**
 * Categorizes a notification into one of: 'orders', 'discipline', 'system', 'general'
 */
function getNotificationCategory(item) {
  const type = String(item.type || '').toUpperCase();
  const title = String(item.title || '').toLowerCase();
  const metaCat = String(item.metadata?.category || '').toLowerCase();

  if (metaCat === 'discipline' || title.includes('discipline') || title.includes('academy') || title.includes('habit') || title.includes('milestone')) {
    return 'discipline';
  }
  if (
    title.includes('order') ||
    title.includes('trade') ||
    title.includes('executed') ||
    title.includes('cancelled') ||
    title.includes('placed') ||
    title.includes('rejected') ||
    item.metadata?.orderId
  ) {
    return 'orders';
  }
  if (type === 'SYSTEM' || title.includes('system') || title.includes('engine') || title.includes('maintenance')) {
    return 'system';
  }
  return 'general';
}

/**
 * Returns the semantic tone for a notification item.
 */
function getNotificationTone(item) {
  const type = String(item.type || '').toUpperCase();
  const title = String(item.title || '').toLowerCase();
  if (type === 'ERROR' || title.includes('rejected')) return 'negative';
  if (type === 'WARNING' || title.includes('cancelled')) return 'warning';
  if (type === 'SUCCESS' || title.includes('executed') || title.includes('filled')) return 'positive';
  if (getNotificationCategory(item) === 'discipline') return 'discipline';
  return 'primary';
}

function NotificationDropdown({
  notifications = [],
  unreadCount = 0,
  loading = false,
  error = null,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onRefresh
}) {
  const [activeTab, setActiveTab] = useState('all');

  // Dismiss on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Compute category counts
  const counts = useMemo(() => {
    let unread = 0;
    let orders = 0;
    let system = 0;
    let discipline = 0;

    notifications.forEach((n) => {
      if (!n.read) unread += 1;
      const cat = getNotificationCategory(n);
      if (cat === 'orders') orders += 1;
      else if (cat === 'discipline') discipline += 1;
      else if (cat === 'system') system += 1;
    });

    return {
      all: notifications.length,
      unread,
      orders,
      other: discipline + system
    };
  }, [notifications]);

  // Filtered notifications based on activeTab
  const filteredNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      return notifications.filter((n) => !n.read);
    }
    if (activeTab === 'orders') {
      return notifications.filter((n) => getNotificationCategory(n) === 'orders');
    }
    if (activeTab === 'other') {
      return notifications.filter((n) => {
        const cat = getNotificationCategory(n);
        return cat === 'discipline' || cat === 'system' || cat === 'general';
      });
    }
    return notifications;
  }, [activeTab, notifications]);

  return (
    <>
      {/* Mobile backdrop */}
      <div className="notification-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Main notification panel */}
      <div
        className="notification-dropdown"
        role="dialog"
        aria-label="Notification Center"
        aria-modal="true"
      >
        {/* Panel Header */}
        <div className="notification-header">
          <div className="notification-header-info">
            <span className="notification-eyebrow">ACTIVITY & ALERTS</span>
            <div className="notification-title-wrap">
              <h2 className="notification-heading">Notifications</h2>
              {unreadCount > 0 && (
                <span className="notification-badge-unread" aria-label={`${unreadCount} unread`}>
                  {unreadCount} New
                </span>
              )}
            </div>
          </div>

          <div className="notification-header-actions">
            {unreadCount > 0 && (
              <button
                type="button"
                className="notification-action-btn"
                onClick={onMarkAllRead}
                title="Mark all notifications as read"
                aria-label="Mark all notifications as read"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Mark all read</span>
              </button>
            )}

            {onRefresh && (
              <button
                type="button"
                className={`notification-icon-btn ${loading ? 'is-loading' : ''}`}
                onClick={onRefresh}
                title="Refresh notifications"
                aria-label="Refresh notifications"
                disabled={loading}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
              </button>
            )}

            <button
              type="button"
              className="notification-icon-btn notification-close-btn"
              onClick={onClose}
              title="Close notifications"
              aria-label="Close notification center"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="notification-tabs-bar" role="tablist" aria-label="Notification categories">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            className={`notification-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All <span className="tab-count">{counts.all}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'unread'}
            className={`notification-tab-btn ${activeTab === 'unread' ? 'active' : ''}`}
            onClick={() => setActiveTab('unread')}
          >
            Unread <span className="tab-count">{counts.unread}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'orders'}
            className={`notification-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            Orders <span className="tab-count">{counts.orders}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'other'}
            className={`notification-tab-btn ${activeTab === 'other' ? 'active' : ''}`}
            onClick={() => setActiveTab('other')}
          >
            System & Risk <span className="tab-count">{counts.other}</span>
          </button>
        </div>

        {/* Body content */}
        <div className="notification-content-area">
          {loading && notifications.length === 0 ? (
            <div className="notification-empty-state">
              <div className="notification-spinner" aria-hidden="true" />
              <p className="empty-title">Syncing notifications...</p>
              <p className="empty-subtitle">Checking for real-time execution and risk updates.</p>
            </div>
          ) : error && notifications.length === 0 ? (
            <div className="notification-empty-state is-error">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="empty-title">Unable to load notifications</p>
              <p className="empty-subtitle">{error}</p>
              {onRefresh && (
                <button type="button" className="notification-retry-btn" onClick={onRefresh}>
                  Try Again
                </button>
              )}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="notification-empty-state">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <p className="empty-title">
                {activeTab === 'unread' ? 'All caught up' : 'No notifications'}
              </p>
              <p className="empty-subtitle">
                {activeTab === 'unread'
                  ? 'You have reviewed all recent notifications.'
                  : 'Real-time order fills, cancellations, and risk alerts will appear here.'}
              </p>
            </div>
          ) : (
            <ul className="notification-list">
              {filteredNotifications.map((n) => {
                const id = n.id || n.notificationId;
                const tone = getNotificationTone(n);
                const category = getNotificationCategory(n);
                const relativeTime = formatRelativeTime(n.createdAt || n.timestamp);

                return (
                  <li
                    key={id}
                    className={`notification-item ${n.read ? 'is-read' : 'is-unread'} tone-${tone}`}
                    onClick={() => {
                      if (!n.read) onMarkRead?.(id);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !n.read) {
                        e.preventDefault();
                        onMarkRead?.(id);
                      }
                    }}
                    aria-label={`${n.title}: ${n.message}. ${n.read ? 'Read' : 'Unread'}`}
                  >
                    {/* Status indicator icon */}
                    <div className={`notification-icon-badge tone-${tone}`} aria-hidden="true">
                      {tone === 'positive' && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {tone === 'warning' && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      )}
                      {tone === 'negative' && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      )}
                      {tone === 'discipline' && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      )}
                      {tone === 'primary' && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      )}
                    </div>

                    {/* Notification content */}
                    <div className="notification-body">
                      <div className="notification-meta-row">
                        <span className={`notification-category-tag category-${category}`}>
                          {category.toUpperCase()}
                        </span>
                        {relativeTime && (
                          <span className="notification-time">{relativeTime}</span>
                        )}
                        {!n.read && <span className="notification-unread-dot" title="Unread" />}
                      </div>

                      <div className="notification-item-title">{n.title}</div>
                      <div className="notification-item-message">{n.message}</div>

                      {/* Metadata pills if present */}
                      {n.metadata && (n.metadata.symbol || n.metadata.price || n.metadata.quantity) && (
                        <div className="notification-chips-row">
                          {n.metadata.symbol && (
                            <span className="notification-chip">{n.metadata.symbol}</span>
                          )}
                          {n.metadata.price && (
                            <span className="notification-chip">₹{Number(n.metadata.price).toFixed(2)}</span>
                          )}
                          {n.metadata.quantity && (
                            <span className="notification-chip">{n.metadata.quantity} units</span>
                          )}
                          {n.metadata.side && (
                            <span className={`notification-chip chip-${String(n.metadata.side).toLowerCase()}`}>
                              {n.metadata.side}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick action button */}
                    {!n.read && (
                      <button
                        type="button"
                        className="notification-mark-item-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkRead?.(id);
                        }}
                        title="Mark as read"
                        aria-label={`Mark ${n.title} as read`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Panel Footer */}
        <div className="notification-footer">
          <span className="notification-footer-scope">
            Real-time execution & risk updates · In-session notification center
          </span>
        </div>
      </div>
    </>
  );
}

export default NotificationDropdown;
