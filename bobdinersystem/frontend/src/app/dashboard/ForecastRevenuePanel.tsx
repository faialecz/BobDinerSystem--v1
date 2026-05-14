"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import styles from "@/css/dashboard.module.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

function fmt(n: number | undefined | null) {
  if (n == null || isNaN(n as number)) return "₱ 0";
  return "₱ " + n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return String(n);
}

function niceYAxis(max: number): { domain: [number, number]; ticks: number[] } {
  if (max === 0) return { domain: [0, 10000], ticks: [0, 5000, 10000] };
  const step =
    max <= 4000  ? 1000 :
    max <= 10000 ? 2000 :
    max <= 30000 ? 5000 :
    max <= 100000 ? 10000 : 50000;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= niceMax; v += step) ticks.push(v);
  return { domain: [0, niceMax], ticks };
}

interface MonthPoint { month: string; sales: number; }

interface SalesRevenueData {
  year: number;
  monthlySales: MonthPoint[];
  total: number;
  change: number;
}

const CURRENT_YEAR  = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1; // 1–12
const YEAR_OPTIONS  = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i);

export default function ForecastRevenuePanel() {
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [data, setData] = useState<SalesRevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`${API}/api/dashboard/sales-revenue?year=${selectedYear}`)
      .then((r) => r.json())
      .then((json) => { if (!json.error) setData(json); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedYear]);

  // Null out future months so the line stops at today instead of crashing to 0.
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.monthlySales.map((point, i) => ({
      ...point,
      sales: selectedYear === CURRENT_YEAR && (i + 1) > CURRENT_MONTH ? null : point.sales,
    }));
  }, [data, selectedYear]);

  const { domain, ticks } = useMemo(() => {
    const max = Math.max(0, ...chartData.map((d) => d.sales ?? 0));
    return niceYAxis(max);
  }, [chartData]);

  const isUp = (data?.change ?? 0) >= 0;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>Sales Revenue</h3>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{
              fontSize: '0.78rem',
              color: '#64748b',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              outline: 'none',
              padding: 0,
              fontFamily: 'inherit',
              marginTop: '2px',
            }}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>January 1 – December 31, {y}</option>
            ))}
          </select>
        </div>
        {data && (
          <div className={styles.revenueSummary}>
            <p className={styles.revenueTotal}>{fmt(data.total)}</p>
            <span className={`${styles.statBadge} ${isUp ? styles.badgeGreen : styles.badgeRed}`}>
              {isUp ? "↗ " : "↘ "}{Math.abs(data.change)}%
            </span>
            <p className={styles.panelSub}>From last year</p>
          </div>
        )}
      </div>

      {loading ? (
        <div className={styles.skeletonBlock} />
      ) : (
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#164163" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#164163" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={domain}
              ticks={ticks}
              tickFormatter={fmtK}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              formatter={(value) => [fmt(typeof value === "number" ? value : Number(value)), "Revenue"]}
              labelStyle={{ color: "#164163", fontWeight: 600, marginBottom: 2 }}
              contentStyle={{ fontSize: '0.78rem', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              cursor={{ stroke: '#164163', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="#164163"
              strokeWidth={2}
              fill="url(#salesGrad)"
              dot={false}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
