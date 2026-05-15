"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ShoppingCart,
  AlertTriangle,
  Package,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import TopHeader from "@/components/layout/TopHeader";
import styles from "@/css/dashboard.module.css";

// ─── API response shape ───────────────────────────────────────────────────────

interface DashboardApiResponse {
  metrics: {
    salesToday:       number;
    salesChange:      number;
    lowStockCount:    number;
    activeItemsCount: number;
    criticalAlerts:   number;
    warningAlerts:    number;
    avgFillRate:      number;
    optimalItems:     number;
  };
  alerts: Array<{
    id:         number;
    name:       string;
    stock:      number;
    alertLevel: string;
    status:     "critical" | "low_stock";
  }>;
  health: {
    optimal:  number;
    lowStock: number;
    critical: number;
  };
  smartReorder: {
    itemName:         string;
    sku:              string;
    unit:             string;
    brand:            string;
    inventoryBrandId: number;
    unitCost:         number;
    current:          number;
    target:           number;
    suggested:        number;
  } | null;
}

interface ReorderPayload {
  inventory_brand_id: number;
  item_name:          string;
  brand_name:         string;
  uom_name:           string;
  quantity_ordered:   number;
  unit_cost:          number;
}

// ─── Public prop interfaces ───────────────────────────────────────────────────

export interface DashboardMetrics {
  salesToday:       number;
  salesChange:      number;
  lowStockCount:    number;
  activeItemsCount: number;
  criticalAlerts:   number;
  warningAlerts:    number;
  avgFillRate:      number;
  optimalItems:     number;
}

export interface AlertItem {
  name:       string;
  stock:      number;
  alertLevel: string;
  status:     "critical" | "low_stock";
}

export interface HealthDistribution {
  optimal:  number;
  lowStock: number;
  critical: number;
}

export interface SmartReorderData {
  itemName:  string;
  sku:       string;
  unit:      string;
  target:    number;
  current:   number;
  suggested: number;
}

interface DashboardProps {
  role?:       string;
  onLogout:    () => void;
  onNavigate?: (tab: string) => void;
  onCreatePO?: (payload: ReorderPayload) => void;
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  label:    string;
  value:    string | number;
  icon:     ReactNode;
  iconBg:   string;
  iconColor: string;
  pills:    Array<{ label: string; bg: string; text: string }>;
}

function MetricCard({ label, value, icon, iconBg, iconColor, pills }: MetricCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 leading-snug max-w-[65%]">
          {label}
        </span>
        <div className={`${iconBg} ${iconColor} p-2.5 rounded-xl flex-shrink-0`}>
          {icon}
        </div>
      </div>
      <p className="text-4xl font-bold text-gray-900 leading-none">{value}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {pills.map((pill, i) => (
          <span
            key={i}
            className={`${pill.bg} ${pill.text} text-xs font-semibold px-2.5 py-1 rounded-full`}
          >
            {pill.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── DonutChart ───────────────────────────────────────────────────────────────

interface DonutChartProps {
  health:   HealthDistribution;
  fillRate: number;
}

function DonutChart({ health, fillRate }: DonutChartProps) {
  const r            = 44;
  const circumference = 2 * Math.PI * r;
  const total        = Math.max(1, health.optimal + health.lowStock + health.critical);

  const segmentDefs = [
    { value: health.optimal,  color: "#22c55e" },
    { value: health.lowStock, color: "#f97316" },
    { value: health.critical, color: "#ef4444" },
  ];

  let cumulative = 0;
  const segments = segmentDefs.map((seg) => {
    const len    = (seg.value / total) * circumference;
    const offset = cumulative;
    cumulative  += len;
    return { ...seg, len, offset };
  });

  return (
    <svg viewBox="0 0 100 100" className="w-52 h-52">
      <circle cx={50} cy={50} r={r} fill="none" stroke="#f1f5f9" strokeWidth={12} />
      {segments.map((seg, i) => (
        <circle
          key={i}
          cx={50}
          cy={50}
          r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth={12}
          strokeDasharray={`${seg.len} ${circumference - seg.len}`}
          strokeDashoffset={-seg.offset}
          transform="rotate(-90 50 50)"
          strokeLinecap="butt"
        />
      ))}
      <text x="50" y="44" textAnchor="middle" fontSize="15" fontWeight="bold" fill="#111827">
        {fillRate}%
      </text>
      <text x="50" y="57" textAnchor="middle" fontSize="7.5" fill="#9ca3af" letterSpacing="0.5">
        FILL RATE
      </text>
    </svg>
  );
}

// ─── SmartReorderCard ─────────────────────────────────────────────────────────

interface SmartReorderCardProps {
  data:         SmartReorderData;
  totalItems:   number;
  currentIndex: number;
  onPrev:       () => void;
  onNext:       () => void;
  onCreatePO?:  () => void;
}

function SmartReorderCard({
  data,
  totalItems,
  currentIndex,
  onPrev,
  onNext,
  onCreatePO,
}: SmartReorderCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      {/* Card header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Smart Reorder Suggestion</h2>
          <p className="text-xs text-gray-400 mt-0.5">Based on 30-day consumption velocity</p>
        </div>
        {totalItems > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 mr-1">
              {currentIndex + 1} of {totalItems}
            </span>
            <button
              onClick={onPrev}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={onNext}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Item name + SKU */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-semibold text-gray-700">{data.itemName}</p>
        {data.sku && (
          <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2.5 py-1 rounded-full">
            SKU: {data.sku}
          </span>
        )}
      </div>

      {/* Hero quantity */}
      <div className="flex items-end gap-3 mb-6">
        <span className="text-6xl font-bold text-gray-900 leading-none tracking-tight">
          {data.suggested}
        </span>
        <span className="text-base font-medium text-gray-400 mb-1">
          {data.unit} to order
        </span>
      </div>

      {/* Breakdown box */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">30-Day Target</span>
          <span className="text-sm font-medium text-gray-700">
            {data.target} {data.unit}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Current Stock</span>
          <span className="text-sm font-medium text-gray-400">
            − {data.current} {data.unit}
          </span>
        </div>
        <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Suggested Order</span>
          <span className="text-sm font-bold text-slate-900">
            {data.suggested} {data.unit}
          </span>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={onCreatePO}
        className="w-full bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white text-sm font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <ClipboardList size={15} />
        Create Purchase Order
      </button>
    </div>
  );
}

// ─── SmartReorderEmpty ────────────────────────────────────────────────────────

function SmartReorderEmpty() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center text-center">
      <div className="w-11 h-11 bg-green-50 rounded-full flex items-center justify-center mb-3">
        <span className="text-green-500 text-lg font-bold">✓</span>
      </div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">All stocked up!</h3>
      <p className="text-xs text-gray-400 max-w-xs">
        No reorder actions needed right now. Inventory levels are healthy.
      </p>
    </div>
  );
}

// ─── API base ─────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard({ role = "Admin", onLogout, onCreatePO }: DashboardProps) {
  const [data, setData]       = useState<DashboardApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchData = () => {
      fetch(`${API}/api/dashboard`, { headers: { "Cache-Control": "no-cache" } })
        .then((r) => {
          if (!r.ok) throw new Error(`Dashboard API ${r.status}`);
          return r.json() as Promise<DashboardApiResponse>;
        })
        .then((json) => {
          if (!cancelled) setData(json);
        })
        .catch((e) => console.error("Dashboard fetch error:", e))
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // ─── Derived display values ─────────────────────────────────────────────────

  const m = data?.metrics;

  const dashMetrics: DashboardMetrics = {
    salesToday:       m?.salesToday       ?? 0,
    salesChange:      m?.salesChange      ?? 0,
    lowStockCount:    m?.lowStockCount    ?? 0,
    activeItemsCount: m?.activeItemsCount ?? 0,
    criticalAlerts:   m?.criticalAlerts   ?? 0,
    warningAlerts:    m?.warningAlerts    ?? 0,
    avgFillRate:      m?.avgFillRate      ?? 0,
    optimalItems:     m?.optimalItems     ?? 0,
  };

  const alertItems: AlertItem[] = (data?.alerts ?? []).map((a) => ({
    name:       a.name,
    stock:      a.stock,
    alertLevel: a.alertLevel,
    status:     a.status,
  }));

  const healthDist: HealthDistribution = {
    optimal:  data?.health.optimal  ?? 0,
    lowStock: data?.health.lowStock ?? 0,
    critical: data?.health.critical ?? 0,
  };

  const healthTotal   = healthDist.optimal + healthDist.lowStock + healthDist.critical;
  const criticalCount = alertItems.filter((a) => a.status === "critical").length;

  const salesPill =
    dashMetrics.salesChange >= 0
      ? { label: `+${dashMetrics.salesChange}% today`, bg: "bg-green-100", text: "text-green-700" }
      : { label: `${dashMetrics.salesChange}% today`,  bg: "bg-red-100",   text: "text-red-700"   };

  const sr = data?.smartReorder ?? null;
  const smartReorder: SmartReorderData | null = sr
    ? {
        itemName:  sr.itemName,
        sku:       sr.sku,
        unit:      sr.unit,
        target:    sr.target,
        current:   sr.current,
        suggested: sr.suggested,
      }
    : null;

  const handleCreatePO = () => {
    if (!sr || !onCreatePO) return;
    onCreatePO({
      inventory_brand_id: sr.inventoryBrandId,
      item_name:          sr.itemName,
      brand_name:         sr.brand,
      uom_name:           sr.unit,
      quantity_ordered:   sr.suggested,
      unit_cost:          sr.unitCost,
    });
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.dashboardContainer}>
      <TopHeader role={role} onLogout={onLogout} />

      <div className={styles.mainContent}>
        <div className="bg-slate-50 min-h-full p-6 space-y-5">

          {/* ── Page header ───────────────────────────────────────────── */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">
              {loading
                ? "Loading…"
                : `${dashMetrics.activeItemsCount} tracked items · Stock monitoring · Live data`}
            </p>
          </div>

          {/* ── Top row: 3 metric cards ──────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <MetricCard
              label="Sales Today"
              value={`₱${dashMetrics.salesToday.toLocaleString()}`}
              icon={<ShoppingCart size={18} />}
              iconBg="bg-green-50"
              iconColor="text-green-500"
              pills={[salesPill]}
            />
            <MetricCard
              label="Low Stock"
              value={dashMetrics.lowStockCount}
              icon={<AlertTriangle size={18} strokeWidth={1.75} />}
              iconBg="bg-red-50"
              iconColor="text-red-400"
              pills={[
                { label: `${dashMetrics.criticalAlerts} critical`, bg: "bg-red-100",    text: "text-red-700"    },
                { label: `${dashMetrics.warningAlerts} warning`,   bg: "bg-orange-100", text: "text-orange-700" },
              ]}
            />
            <MetricCard
              label="Inventory"
              value={dashMetrics.activeItemsCount}
              icon={<Package size={18} />}
              iconBg="bg-blue-50"
              iconColor="text-blue-400"
              pills={[
                { label: `${dashMetrics.activeItemsCount} active items`, bg: "bg-blue-100", text: "text-blue-700" },
              ]}
            />
          </div>

          {/* ── Middle row: table (65%) + donut (35%) ───────────────── */}
          <div className="grid gap-4" style={{ gridTemplateColumns: "65fr 35fr" }}>

            {/* Low Stock Alerts table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-base font-semibold text-gray-800">Low Stock Alerts</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {alertItems.length} {alertItems.length === 1 ? "item needs" : "items need"} attention
                  </p>
                </div>
                {criticalCount > 0 && (
                  <span className="bg-red-50 border border-red-100 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {criticalCount} Critical
                  </span>
                )}
              </div>

              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    {(["Item", "Stock", "Alert Level"] as const).map((col) => (
                      <th
                        key={col}
                        className="text-left text-xs font-semibold uppercase tracking-widest text-gray-400 pb-3"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alertItems.map((alert, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-50 last:border-0 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-3 pr-4 text-sm font-medium text-gray-700">
                        {alert.name}
                      </td>
                      <td
                        className="py-3 pr-4 text-sm font-bold tabular-nums"
                        style={{ color: alert.status === "critical" ? "#ef4444" : "#f97316" }}
                      >
                        {alert.stock}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                            alert.status === "critical"
                              ? "bg-red-50 border border-red-100 text-red-600"
                              : "bg-orange-50 border border-orange-100 text-orange-600"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              alert.status === "critical" ? "bg-red-500" : "bg-orange-400"
                            }`}
                          />
                          {alert.alertLevel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Inventory Health donut */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-gray-800">Inventory Health</h2>
                <p className="text-xs text-gray-400 mt-0.5">{healthTotal} total items</p>
              </div>

              <div className="flex justify-center flex-1 items-center py-2">
                <DonutChart health={healthDist} fillRate={dashMetrics.avgFillRate} />
              </div>

              <div className="space-y-3 mt-4">
                {(
                  [
                    { label: "Optimal",   count: healthDist.optimal,  dot: "bg-green-500",  text: "text-green-600"  },
                    { label: "Low Stock", count: healthDist.lowStock, dot: "bg-orange-400", text: "text-orange-600" },
                    { label: "Critical",  count: healthDist.critical, dot: "bg-red-500",    text: "text-red-600"   },
                  ] as const
                ).map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${row.dot}`} />
                      <span className="text-xs text-gray-500">{row.label}</span>
                    </div>
                    <span className={`text-xs font-bold ${row.text}`}>
                      {row.count} {row.count === 1 ? "item" : "items"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ── Bottom: full-width Smart Reorder ────────────────────── */}
          {!loading && (
            smartReorder ? (
              <SmartReorderCard
                data={smartReorder}
                totalItems={1}
                currentIndex={0}
                onPrev={() => {}}
                onNext={() => {}}
                onCreatePO={handleCreatePO}
              />
            ) : (
              <SmartReorderEmpty />
            )
          )}

        </div>
      </div>
    </div>
  );
}
