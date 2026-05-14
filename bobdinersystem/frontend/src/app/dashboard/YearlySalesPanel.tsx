"use client";

import styles from "@/css/dashboard.module.css";
import { YearlySales } from "./types";

function fmt(n: number | undefined | null) {
  if (n == null || isNaN(n as number)) return "₱ 0";
  return "₱ " + n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface YearlySalesPanelProps {
  yearlySales: YearlySales[] | undefined;
  loading: boolean;
}

export default function YearlySalesPanel({ yearlySales, loading }: YearlySalesPanelProps) {
  return (
    <div className={styles.miniPanel}>
      <h3 className={styles.panelTitle}>Top Yearly Sales</h3>
      {loading ? (
        <div className={styles.skeletonBlock} />
      ) : (
        <div className={styles.yearlyList}>
          {yearlySales?.map((y) => (
            <div key={y.year} className={styles.yearlyRow}>
              <span className={styles.yearlyYear}>{y.year}</span>
              <div className={styles.yearlyRight}>
                <span className={styles.yearlyTotal}>{fmt(y.total)}</span>
                {y.change != null && (
                  <span
                    className={`${styles.yearlyChange} ${
                      y.change >= 0 ? styles.positive : styles.negative
                    }`}
                  >
                    {y.change >= 0 ? "+" : ""}
                    {y.change}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
