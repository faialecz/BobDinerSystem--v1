"use client";

import { PieChart, Pie, Cell } from "recharts";
import styles from "@/css/dashboard.module.css";

interface GoalPanelProps {
  goalPercent: number;
  loading: boolean;
}

export default function GoalPanel({ goalPercent, loading }: GoalPanelProps) {
  const donutData = [
    { name: "achieved", value: goalPercent },
    { name: "remaining", value: Math.max(100 - goalPercent, 0) },
  ];

  return (
    <div className={styles.miniPanel}>
      <h3 className={styles.panelTitle}>Goal</h3>
      <p className={styles.panelSub}>This year&apos;s goal</p>
      {loading ? (
        <div className={styles.skeletonBlock} />
      ) : (
        <div className={styles.goalWrapper}>
          <PieChart width={150} height={150}>
            <Pie
              data={donutData}
              cx={70}
              cy={70}
              innerRadius={50}
              outerRadius={68}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              strokeWidth={0}
            >
              <Cell fill="#164163" />
              <Cell fill="#e5e7eb" />
            </Pie>
          </PieChart>
          <div className={styles.goalCenter}>
            <p className={styles.goalPct}>{goalPercent.toFixed(0)}%</p>
            <p className={styles.goalLabel}>Growth Rate</p>
          </div>
        </div>
      )}
    </div>
  );
}
