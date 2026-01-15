"use client";

import styles from "@/css/dashboard.module.css";

interface DashboardProps {
  role?: string;
  onLogout: () => void;
}

export default function Dashboard({ role = "Admin", onLogout }: DashboardProps) {
  const stats = [
    { title: "Sales Today", value: "₱ 23,840", change: "+7.2%", positive: true },
    { title: "Orders", value: "72", change: "+2.8%", positive: true },
    { title: "Low Stock", value: "10 SKUs", change: "+2.8%", positive: false }, 
  ];

return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <div className={styles.welcomeText}>
          Welcome, <strong>{role}!</strong>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.notificationWrapper}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          </div>
          <div className={styles.avatarContainer} onClick={onLogout}>
            <img src="/ae-logo.png" alt="Admin Logo" className={styles.avatarImage} />
          </div>
        </div>
      </header>

      {/* Stats Section */}
      <div className={styles.statsGrid}>
        {stats.map((item) => (
          <div key={item.title} className={styles.statCard}>
            <p className={styles.statTitle}>{item.title}</p>
            <h2 className={styles.statValue}>{item.value}</h2>
            <span className={`${styles.statChange} ${item.positive ? styles.positive : styles.negative}`}>
              {item.change}
            </span>
          </div>
        ))}
      </div>

      {/* Panels Section */}
      <div className={styles.panelsGrid}>
        
        {/* Forecasting and Revenue */}
        <div className={styles.column}>
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Sales Forecasting</h3>
            <div className={styles.placeholder}>📊 [Weekly/Quarterly Chart]</div>
          </div>
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Forecast Revenue</h3>
            <div className={styles.placeholder}>📈 [Revenue Line Graph]</div>
          </div>
        </div>

        {/* Quick POS and Goal/Sales */}
        <div className={styles.column}>
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Quick POS</h3>
            <div className={styles.placeholder}>🧾 [Table Placeholder]</div>
          </div>
          
          <div className={styles.bottomRow}>
            <div className={styles.miniPanel}>
              <h3 className={styles.panelTitle}>Goal</h3>
              <div className={styles.placeholder}>🎯 [60%]</div>
            </div>
            <div className={styles.miniPanel}>
              <h3 className={styles.panelTitle}>Top Yearly Sales</h3>
              <div className={styles.placeholder}>🏆 [List]</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}