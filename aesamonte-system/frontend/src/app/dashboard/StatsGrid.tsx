"use client";

import styles from "@/css/dashboard.module.css";
import { GrLineChart } from "react-icons/gr";
import { PiShoppingBag } from "react-icons/pi";
import { MdOutlineInventory2 } from "react-icons/md";
import { AiOutlineRise, AiOutlineFall } from "react-icons/ai";
import { Metrics } from "./types";

function fmt(n: number | undefined | null) {
  if (n == null || isNaN(n as number)) return "₱ 0";
  return "₱ " + n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface StatsGridProps {
  metrics: Metrics | null;
  loading: boolean;
  onNavigate?: (tab: string) => void;
}

export default function StatsGrid({ metrics, loading, onNavigate }: StatsGridProps) {
  const statCards =
    metrics && metrics.salesToday != null
      ? [
          {
            title: "Sales Today",
            value: fmt(metrics.salesToday),
            change: `${metrics.salesChange >= 0 ? "+" : ""}${metrics.salesChange}%`,
            positive: metrics.salesChange >= 0,
            sub: "Sales up from yesterday's total.",
            icon: <GrLineChart size={20} />,
            tab: "Sales",
          },
          {
            title: "Orders",
            value: String(metrics.pendingOrders),
            change: `${metrics.ordersChange >= 0 ? "+" : ""}${metrics.ordersChange}%`,
            positive: metrics.ordersChange >= 0,
            sub: "Orders awaiting processing.",
            icon: <PiShoppingBag size={20} />,
            tab: "Orders",
          },
          {
            title: "Low Stock",
            value: `${metrics.lowStock} SKUs`,
            change: metrics.lowStock === 0 ? "All stocked" : "",
            positive: metrics.lowStock === 0,
            hideBadge: metrics.lowStock > 0,
            sub: "Immediate restock needed for items.",
            icon: <MdOutlineInventory2 size={20} />,
            tab: "Inventory",
          },
        ]
      : [];

  return (
    <div className={styles.statsGrid}>
      {loading || statCards.length === 0
        ? [1, 2, 3].map((i) => (
            <div
              key={i}
              className={`${styles.statCard} ${styles.skeleton}`}
              style={!loading ? { opacity: 0.4 } : undefined}
            />
          ))
        : statCards.map((item) => (
            <div key={item.title} className={styles.statCard}>
              <div className={styles.statCardTop}>
                <p className={styles.statTitle}>{item.title}</p>
                <button
                  className={styles.statIconBtn}
                  onClick={() => onNavigate?.(item.tab)}
                  title={`Go to ${item.tab}`}
                >
                  {item.icon}
                </button>
              </div>
              <h2 className={styles.statValue}>{item.value}</h2>
              <div className={styles.statFooter}>
                <span className={styles.statSub}>{item.sub}</span>
                {!item.hideBadge && (
                  <span
                    className={`${styles.statBadge} ${
                      item.positive ? styles.badgeGreen : styles.badgeRed
                    }`}
                  >
                    {item.change}{" "}
                    {item.positive ? <AiOutlineRise size={13} /> : <AiOutlineFall size={13} />}
                  </span>
                )}
              </div>
            </div>
          ))}
    </div>
  );
}
