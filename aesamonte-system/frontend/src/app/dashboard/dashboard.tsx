"use client";

import styles from "@/css/dashboard.module.css";

interface DashboardProps {
  role?: string;
  onLogout: () => void;
}

export default function Dashboard({ role = "User", onLogout }: DashboardProps) {
  const stats = [
    { title: "Sales Today", value: "₱23,840", change: "+7.2%" },
    { title: "Orders", value: "248", change: "+3.8%" },
    { title: "Low Stock", value: "10 SKUs", change: "-2.8%" },
  ];

  return (
    <div className={styles.dashboardContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>
            Welcome, <strong>{role}</strong> 👋
          </p>
        </div>
        <button onClick={onLogout} className={styles.logoutButton}>
          Logout
        </button>
      </div>

      {/* Stats Section */}
      <div className={styles.statsGrid}>
        {stats.map((item) => (
          <div key={item.title} className={styles.statCard}>
            <p className={styles.statTitle}>{item.title}</p>
            <h2 className={styles.statValue}>{item.value}</h2>
            <span
              className={`${styles.statChange} ${
                item.change.startsWith("+") ? styles.positive : styles.negative
              }`}
            >
              {item.change}
            </span>
          </div>
        ))}
      </div>

      {/* Panels Section */}
      <div className={styles.panelsGrid}>
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Sales Forecasting</h3>
          <div className={styles.placeholder}>📊 Chart Placeholder</div>
        </div>

        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Quick POS</h3>
          <div className={styles.placeholder}>🧾 Table Placeholder</div>

           <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Forecast Revenue</h3>
          <div className={styles.placeholder}>📊 +7.2%</div>
        </div>
        </div>
      </div>
    </div>
  );
}