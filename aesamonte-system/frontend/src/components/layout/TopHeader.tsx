'use client';

import { useState, useRef, useEffect } from 'react';
import styles from "@/css/topheader.module.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

type NotifType = 'out_of_stock' | 'low_stock' | 'paid' | 'pending' | 'preparing' | 'cancelled' | 'received';

interface Notification {
  id: number;
  type: NotifType;
  label: string;
  detail: string;
  date: string;
  time: string;
  read: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  out_of_stock: '#e53e3e',
  low_stock: '#dd6b20',
  paid: '#38a169',
  pending: '#d69e2e',
  preparing: '#3182ce',
  cancelled: '#718096',
  received: '#319795',
};

interface TopHeaderProps {
  role: string;
  onLogout?: () => void;
}

export default function TopHeader({ role, onLogout }: TopHeaderProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    try {
      const res = await fetch(`${API}/api/notifications`, { credentials: 'include' });
      if (!res.ok) return;
      const data: Omit<Notification, 'read'>[] = await res.json();
      setNotifications(
        data.map((n) => ({ ...n, read: readIds.has(n.id) }))
      );
    } catch {
      // silently fail — network may not be available
    }
  }

  // Fetch on mount, then poll every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function togglePanel() {
    if (!open) {
      // Mark all current notifications as read when opening
      const allIds = new Set(notifications.map((n) => n.id));
      setReadIds(allIds);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
    setOpen((prev) => !prev);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className={styles.header}>
      <div className={styles.welcomeText}>
        Welcome, <strong>{role}!</strong>
      </div>
      <div className={styles.headerActions}>
        <div className={styles.notificationWrapper} ref={panelRef}>
          <div className={styles.bellButton} onClick={togglePanel}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {unreadCount > 0 && (
              <span className={styles.badge}>{unreadCount}</span>
            )}
          </div>

          {open && (
            <div className={styles.notifPanel}>
              <div className={styles.notifHeader}>NOTIFICATIONS</div>
              <div className={styles.notifList}>
                {notifications.length === 0 ? (
                  <div className={styles.notifEmpty}>No notifications</div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`${styles.notifItem} ${!notif.read ? styles.notifUnread : ''}`}
                    >
                      <div className={styles.notifLeft}>
                        <span
                          className={styles.notifBadge}
                          style={{ backgroundColor: TYPE_COLORS[notif.type] ?? '#718096' }}
                        >
                          {notif.label}
                        </span>
                        <span className={styles.notifDetail}>{notif.detail}</span>
                      </div>
                      <div className={styles.notifRight}>
                        <span className={styles.notifDate}>{notif.date}</span>
                        <span className={styles.notifTime}>{notif.time}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.avatarContainer} onClick={onLogout}>
          <img src="/ae-logo.png" alt="AE Logo" className={styles.avatarImage} />
        </div>
      </div>
    </header>
  );
}
