'use client';

import { useState, useRef, useEffect } from 'react';
import styles from "@/css/topheader.module.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

// Alert types → navigation destination
const TYPE_NAV_MAP: Record<string, string> = {
  low_stock:        'Inventory',
  out_of_stock:     'Inventory',
  expiring_soon:    'Inventory',
  inactive_supplier:'Suppliers',
  overdue_payment:  'Orders',
};

// Severity → colors
const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  warning:  { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
  info:     { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
};

const SEVERITY_ICON: Record<string, string> = {
  critical: '🔴',
  warning:  '🟡',
  info:     '🔵',
};

interface Notification {
  id: number;
  key: string;
  type: string;
  label: string;
  reference: string;
  name: string;
  detail: string;
  severity: string;
  category: string;
  date: string;
  time: string;
}

interface TopHeaderProps {
  role?: string;
  onLogout?: () => void;
}

function loadSet(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveSet(storageKey: string, set: Set<string>) {
  try { localStorage.setItem(storageKey, JSON.stringify([...set])); } catch { /* ignore */ }
}

export default function TopHeader({ role }: TopHeaderProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => loadSet('notifDismissed'));
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState<string>(role ?? '');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getKey = () => {
      try {
        const token = localStorage.getItem('token') ?? '';
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.employee_name) setEmployeeName(payload.employee_name);
        return `profilePicture_${payload.employee_id}`;
      } catch { return null; }
    };
    const key = getKey();
    if (key) {
      try { const s = localStorage.getItem(key); if (s) setProfilePic(s); } catch { /* ignore */ }
    }
    const handlePfpUpdate = () => {
      const k = getKey();
      if (!k) return;
      try { setProfilePic(localStorage.getItem(k) ?? null); } catch { /* ignore */ }
    };
    window.addEventListener('pfp:updated', handlePfpUpdate);
    return () => window.removeEventListener('pfp:updated', handlePfpUpdate);
  }, []);

  async function fetchNotifications() {
    try {
      const res = await fetch(`${API}/api/notifications`, { credentials: 'include' });
      if (!res.ok) return;
      const data: Notification[] = await res.json();
      setNotifications(data);
    } catch { /* silently fail */ }
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const visibleNotifications = notifications.filter(n => !dismissedKeys.has(n.key));
  const criticalCount = visibleNotifications.filter(n => n.severity === 'critical').length;
  const unreadCount   = visibleNotifications.length;

  function handleNotifClick(notif: Notification) {
    // Dismiss this specific notification
    const next = new Set([...dismissedKeys, notif.key]);
    setDismissedKeys(next);
    saveSet('notifDismissed', next);
    setOpen(false);

    const tab = TYPE_NAV_MAP[notif.type];
    if (!tab) return;

    const detail: Record<string, unknown> = { tab };

    // Navigate to the right item WITHOUT setting a search term (avoids filtering everything out)
    if (notif.category === 'INVENTORY') {
      detail.view_inventory_id = notif.reference;
    } else if (notif.type === 'overdue_payment') {
      detail.search = notif.reference; // order ID
    }

    window.dispatchEvent(new CustomEvent('app:navigate', { detail }));
  }

  function handleDismissAll() {
    const next = new Set([...dismissedKeys, ...visibleNotifications.map(n => n.key)]);
    setDismissedKeys(next);
    saveSet('notifDismissed', next);
  }

  return (
    <header className={styles.header}>
      <div className={styles.welcomeText}>
        Welcome, <strong>{employeeName.split(' ')[0]}!</strong>
      </div>
      <div className={styles.headerActions}>
        <div className={styles.notificationWrapper} ref={panelRef}>
          <div
            className={styles.bellButton}
            onClick={() => setOpen(p => !p)}
            style={{ color: open ? '#c79518' : undefined }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <span className={styles.badge} style={{ background: criticalCount > 0 ? '#dc2626' : '#f59e0b' }}>
                {unreadCount}
              </span>
            )}
          </div>

          {open && (
            <div className={styles.notifPanel}>
              <div className={styles.notifHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>ALERTS</span>
                {visibleNotifications.length > 0 && (
                  <button onClick={handleDismissAll} style={{ fontSize: '0.72rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Dismiss all
                  </button>
                )}
              </div>
              <div className={styles.notifList}>
                {visibleNotifications.length === 0 ? (
                  <div className={styles.notifEmpty}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>✅</div>
                    All clear — no alerts
                  </div>
                ) : (
                  visibleNotifications.map((notif, index) => {
                    const colors = SEVERITY_COLORS[notif.severity] ?? SEVERITY_COLORS.info;
                    return (
                      <div
                        key={`${notif.key}-${index}`}
                        className={styles.notifItem}
                        onClick={() => handleNotifClick(notif)}
                        style={{ borderLeft: `3px solid ${colors.border}`, background: colors.bg }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
                          <span style={{ fontSize: '0.85rem', flexShrink: 0, marginTop: 1 }}>
                            {SEVERITY_ICON[notif.severity] ?? '⚪'}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <span style={{
                                fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '0.04em', color: colors.text,
                                background: colors.border, borderRadius: 4, padding: '1px 6px',
                              }}>
                                {notif.label}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {notif.name}
                            </p>
                            {notif.detail && (
                              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                                {notif.detail}
                              </p>
                            )}
                          </div>
                          <div style={{ flexShrink: 0, textAlign: 'right' }}>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>{notif.date}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.avatarContainer} onClick={() => {
          window.dispatchEvent(new CustomEvent('app:navigate', { detail: { tab: 'Settings' } }));
          window.dispatchEvent(new CustomEvent('settings:openView', { detail: { view: 'appPreferences' } }));
        }}>
          {profilePic
            ? <img src={profilePic} alt="Profile" className={styles.avatarImage} style={{ objectFit: 'cover' }} />
            : <img src="/ae-logo.png" alt="AE Logo" className={styles.avatarImage} />}
        </div>
      </div>
    </header>
  );
}
