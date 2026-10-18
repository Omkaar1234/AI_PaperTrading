import React from 'react';
import ReactDOMServer from 'react-dom/server';
import NotificationDropdown from './NotificationDropdown';

const mockNotifications = [
  {
    id: 'n1',
    notificationId: 'n1',
    userId: 'u1',
    title: 'Order Executed',
    message: 'BUY 20/20 RELIANCE.NS @ ₹2850.00',
    type: 'SUCCESS',
    read: false,
    createdAt: new Date().toISOString(),
    metadata: { orderId: 'ord_1', symbol: 'RELIANCE.NS', side: 'BUY', price: 2850, quantity: 20 }
  },
  {
    id: 'n2',
    notificationId: 'n2',
    userId: 'u1',
    title: 'Order Cancelled',
    message: 'Market BUY order for 25 INFY.NS cancelled: No counterparty liquidity.',
    type: 'WARNING',
    read: true,
    createdAt: new Date().toISOString(),
    metadata: { orderId: 'ord_2', symbol: 'INFY.NS', quantity: 25 }
  },
  {
    id: 'n3',
    notificationId: 'n3',
    userId: 'u1',
    title: 'Discipline Milestone Reached',
    message: 'Completed Stop-Loss module in UPRISE Academy.',
    type: 'INFO',
    read: false,
    createdAt: new Date().toISOString(),
    metadata: { category: 'discipline' }
  }
];

describe('NotificationDropdown Component', () => {
  test('renders empty state when there are no notifications', () => {
    const html = ReactDOMServer.renderToString(
      <NotificationDropdown notifications={[]} unreadCount={0} />
    );
    expect(html).toContain('No notifications');
    expect(html).toContain('Real-time order fills, cancellations, and risk alerts will appear here');
  });

  test('renders notifications with categories, titles, messages, and unread badges', () => {
    const html = ReactDOMServer.renderToString(
      <NotificationDropdown
        notifications={mockNotifications}
        unreadCount={2}
      />
    );

    expect(html).toContain('Notifications');
    expect(html).toContain('New');
    expect(html).toContain('Order Executed');
    expect(html).toContain('BUY 20/20 RELIANCE.NS @ ₹2850.00');
    expect(html).toContain('Order Cancelled');
    expect(html).toContain('Discipline Milestone Reached');
    expect(html).toContain('is-unread');
    expect(html).toContain('notification-unread-dot');
  });

  test('renders category tabs with accurate counts', () => {
    const html = ReactDOMServer.renderToString(
      <NotificationDropdown
        notifications={mockNotifications}
        unreadCount={2}
      />
    );

    expect(html).toContain('All');
    expect(html).toContain('Unread');
    expect(html).toContain('Orders');
    expect(html).toContain('System &amp; Risk');
    expect(html).toContain('tab-count');
  });

  test('renders metadata chips for symbols, quantities, and prices', () => {
    const html = ReactDOMServer.renderToString(
      <NotificationDropdown
        notifications={mockNotifications}
        unreadCount={2}
      />
    );

    expect(html).toContain('RELIANCE.NS');
    expect(html).toContain('units');
    expect(html).toContain('2850.00');
  });

  test('renders loading state when loading={true}', () => {
    const html = ReactDOMServer.renderToString(
      <NotificationDropdown notifications={[]} loading={true} />
    );
    expect(html).toContain('Syncing notifications...');
    expect(html).toContain('notification-spinner');
  });

  test('renders error state and retry button when error is passed', () => {
    const html = ReactDOMServer.renderToString(
      <NotificationDropdown
        notifications={[]}
        error="Unable to connect to live notification service"
        onRefresh={() => {}}
      />
    );

    expect(html).toContain('Unable to load notifications');
    expect(html).toContain('Unable to connect to live notification service');
    expect(html).toContain('Try Again');
  });

  test('renders accessible dialog container with ARIA attributes', () => {
    const html = ReactDOMServer.renderToString(
      <NotificationDropdown
        notifications={mockNotifications}
        unreadCount={2}
      />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Notification Center"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('notification-backdrop');
  });
});

