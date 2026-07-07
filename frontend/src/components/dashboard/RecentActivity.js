import React, { useMemo } from 'react';

function formatTime(value) {
  if (!value) {
    return 'Now';
  }
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function RecentActivity({ orders, recentTrades, prediction, suggestion }) {
  const activities = useMemo(() => {
    const orderItems = orders.slice(-4).map((order) => ({
      id: `order-${order.id}`,
      time: order.timestamp,
      icon: order.side === 'BUY' ? 'B' : 'S',
      status: order.status,
      text: `${order.side} ${order.quantity} ${order.symbol}`
    }));

    const tradeItems = recentTrades.slice(-3).map((trade, index) => ({
      id: `trade-${trade.id || index}`,
      time: trade.executedAt || trade.timestamp,
      icon: 'EX',
      status: 'FILLED',
      text: `${trade.quantity} ${trade.symbol || 'shares'} executed`
    }));

    const aiItems = prediction || suggestion
      ? [{
          id: 'ai-latest',
          time: Date.now(),
          icon: 'AI',
          status: suggestion?.action || prediction?.prediction || 'READY',
          text: 'AI analysis updated for selected asset'
        }]
      : [];

    return [...aiItems, ...tradeItems, ...orderItems].slice(0, 8);
  }, [orders, prediction, recentTrades, suggestion]);

  return (
    <section className="dashboard-section activity-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Recent activity</p>
          <h3>Desk timeline</h3>
        </div>
      </div>

      <div className="activity-timeline">
        {activities.length ? (
          activities.map((activity) => (
            <div className="activity-item" key={activity.id}>
              <span className="activity-icon">{activity.icon}</span>
              <div>
                <strong>{activity.text}</strong>
                <small>{formatTime(activity.time)} · {activity.status}</small>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-panel small">Orders, trades, deposits, signals, and AI predictions will appear here.</div>
        )}
      </div>
    </section>
  );
}

export default RecentActivity;
