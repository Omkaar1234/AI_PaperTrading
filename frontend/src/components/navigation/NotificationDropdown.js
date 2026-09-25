import React from 'react';

function NotificationDropdown({ notifications = [], unreadCount = 0, onClose, onMarkRead, onMarkAllRead }) {
  return (
    <div
      className="notification-dropdown"
      style={{
        position: 'absolute',
        right: 0,
        top: '100%',
        marginTop: '8px',
        width: '320px',
        maxHeight: '400px',
        overflowY: 'auto',
        background: 'var(--surface-color, #1e293b)',
        border: '1px solid var(--border-color, #334155)',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
        zIndex: 1000,
        padding: '12px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color, #334155)', paddingBottom: '8px' }}>
        <strong style={{ fontSize: '14px', color: 'var(--text-primary, #f8fafc)' }}>
          Notifications {unreadCount > 0 && <span style={{ fontSize: '12px', opacity: 0.8 }}>({unreadCount})</span>}
        </strong>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            style={{ fontSize: '11px', background: 'none', border: 'none', color: 'var(--primary-color, #38bdf8)', cursor: 'pointer' }}
          >
            Mark all read
          </button>
        )}
      </div>
      {notifications.length === 0 ? (
        <div style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)', fontSize: '13px' }}>
          No notifications
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {notifications.map((n) => (
            <li
              key={n.id || n.notificationId || Math.random()}
              onClick={() => onMarkRead?.(n.id || n.notificationId)}
              style={{
                padding: '8px',
                borderRadius: '4px',
                marginBottom: '4px',
                cursor: 'pointer',
                background: n.read ? 'transparent' : 'rgba(56, 189, 248, 0.1)',
                borderLeft: n.read ? 'none' : '3px solid var(--primary-color, #38bdf8)'
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>{n.title}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>{n.message}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default NotificationDropdown;

