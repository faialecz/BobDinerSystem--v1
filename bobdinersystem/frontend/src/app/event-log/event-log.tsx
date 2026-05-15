'use client';

import React, { useEffect, useState } from 'react';
import styles from '@/css/event-log.module.css';
import TopHeader from '@/components/layout/TopHeader';

interface EventItem {
  id: number;
  type: string;
  label: string;
  item_name: string;
  description: string;
  event_date: string;
  event_time: string;
  relative: string;
  from_qty?: number;
  to_qty?: number;
}

const EventLog: React.FC<{ role: string; onLogout: () => void }> = ({ role }) => {
  const s = styles as Record<string, string>;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'reorder' | 'alert' | 'adjustment'>('all');

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const res = await fetch('/api/event-log?period=7days');
        if (!res.ok) throw new Error('Failed to fetch');
        const d = await res.json();
        if (mounted) setData(d);
      } catch (err) {
        console.error('Failed to fetch event log', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => { mounted = false; };
  }, []);

  const events: EventItem[] = (data?.events ?? []) as EventItem[];
  const filtered = activeTab === 'all' ? events : events.filter(e => e.type === activeTab);

  return (
    <div className={s.container}>
      <TopHeader role={role} />
      <main className={s.mainContent}>
        <div className={s.pageHeader}>
          <h1 className={s.pageTitle}>Event Log</h1>
          <p className={s.pageSubtitle}>Recent system events and stock alerts</p>
        </div>

        <div className={s.summaryGrid}>
          <div className={s.summaryCard}>
            <div className={s.summaryIcon}>📊</div>
            <div className={s.summaryText}>
              <div className={s.summaryLabel}>TOTAL</div>
              <div className={s.summaryCount}>{data?.summary?.total ?? '—'}</div>
              <div className={s.summarySub}>Entries in selected period</div>
            </div>
          </div>
          <div className={s.summaryCard}>
            <div className={s.summaryIcon}>🔁</div>
            <div className={s.summaryText}>
              <div className={s.summaryLabel}>Reorders</div>
              <div className={s.summaryCount}>{data?.summary?.reorders ?? '—'}</div>
              <div className={s.summarySub}>Buffer breaches</div>
            </div>
          </div>
          <div className={s.summaryCard}>
            <div className={s.summaryIcon}>⚠️</div>
            <div className={s.summaryText}>
              <div className={s.summaryLabel}>Alerts</div>
              <div className={s.summaryCount}>{data?.summary?.alerts ?? '—'}</div>
              <div className={s.summarySub}>Out of stock events</div>
            </div>
          </div>
        </div>

        <div className={s.contentCard}>
          <div className={s.tabRow}>
            <div className={s.tabs}>
              <button className={`${s.tab} ${activeTab === 'all' ? s.tabActive : ''}`} onClick={() => setActiveTab('all')}>All</button>
              <button className={`${s.tab} ${activeTab === 'reorder' ? s.tabActive : ''}`} onClick={() => setActiveTab('reorder')}>Reorder <span className={s.tabBadge}>{data?.summary?.reorders ?? 0}</span></button>
              <button className={`${s.tab} ${activeTab === 'alert' ? s.tabActive : ''}`} onClick={() => setActiveTab('alert')}>Alert <span className={s.tabBadge}>{data?.summary?.alerts ?? 0}</span></button>
              <button className={`${s.tab} ${activeTab === 'adjustment' ? s.tabActive : ''}`} onClick={() => setActiveTab('adjustment')}>Adjustment <span className={s.tabBadge}>{data?.summary?.adjustments ?? 0}</span></button>
            </div>
            <div className={s.entryCount}>{filtered.length} entries</div>
          </div>

          <div className={s.legend}>
            <div className={s.legendItem}><span className={`${s.legendDot} ${s.dotReorder}`} />Reorder</div>
            <div className={s.legendItem}><span className={`${s.legendDot} ${s.dotAlert}`} />Alert</div>
            <div className={s.legendItem}><span className={`${s.legendDot} ${s.dotAdjustment}`} />Adjustment</div>
          </div>

          {loading ? (
            <div className={s.loadingWrap}>Loading event log…</div>
          ) : (
            <div className={s.feedList}>
              {filtered.length === 0 ? (
                <div className={s.feedEmpty}>No events in this period.</div>
              ) : filtered.map(ev => (
                <div key={ev.id} className={s.feedItem}>
                  <div className={s.feedDot + ' ' + (ev.type === 'alert' ? s.dotAlert : ev.type === 'reorder' ? s.dotReorder : s.dotAdjustment)} />
                  <div className={s.feedCard}>
                    <div className={s.feedCardTop}>
                      <div className={s.feedCardLeft}>
                        <div className={s.feedBadge + ' ' + (ev.type === 'alert' ? s.badgeAlert : ev.type === 'reorder' ? s.badgeReorder : s.badgeAdjustment)}>{ev.label}</div>
                        <div className={s.feedItemName}>{ev.item_name}</div>
                        <div className={s.feedQtyChange}>{ev.from_qty ?? ''} → {ev.to_qty ?? ''}</div>
                      </div>
                      <div className={s.feedTimestamp}>{ev.event_date} · {ev.event_time} · {ev.relative}</div>
                    </div>
                    <div className={s.feedDescription}>{ev.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default EventLog;
