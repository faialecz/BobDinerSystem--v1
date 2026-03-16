"use client";

import { useEffect, useState } from "react";
import styles from "@/css/dashboard.module.css";
import TopHeader from "@/components/layout/TopHeader";
import StatsGrid from "./StatsGrid";
import ForecastingPanel from "./ForecastingPanel";
import ForecastRevenuePanel from "./ForecastRevenuePanel";
import QuickPOSPanel from "./QuickPOSPanel";
import GoalPanel from "./GoalPanel";
import YearlySalesPanel from "./YearlySalesPanel";
import ReceiptModal from "./ReceiptModal";
import {
  Metrics,
  RecentOrder,
  ChartsData,
  InsightsData,
  OrderReceipt,
} from "./types";

interface DashboardProps {
  role?: string;
  onLogout: () => void;
  onNavigate?: (tab: string) => void;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export default function Dashboard({ role = "Admin", onLogout, onNavigate }: DashboardProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [charts, setCharts] = useState<ChartsData | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/dashboard/all`, { credentials: "include" })
      .then((r) => r.json())
      .then(({ metrics: m, recentOrders: ro, charts: ch, insights: ins }) => {
        if (m && !m.error) setMetrics(m);
        if (Array.isArray(ro)) setRecentOrders(ro);
        if (ch && !ch.error) setCharts(ch);
        if (ins && !ins.error) setInsights(ins);
      })
      .catch((e) => console.error("Dashboard fetch error:", e))
      .finally(() => setLoading(false));
  }, []);

  const handleOrderClick = async (orderId: number) => {
    setReceiptLoading(true);
    setReceipt({
      orderId,
      customerName: "",
      customerAddress: "",
      orderDate: "",
      totalAmount: 0,
      status: "",
      paymentMethod: "",
      items: [],
    });
    try {
      const res = await fetch(`${API}/api/dashboard/order-receipt/${orderId}`, {
        credentials: "include",
      });
      const data = JSON.parse(await res.text());
      setReceipt(data);
    } catch (err) {
      console.error("Receipt fetch error:", err);
      setReceipt(null);
    } finally {
      setReceiptLoading(false);
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      <TopHeader role={role} onLogout={onLogout} />
      <div className={styles.mainContent}>

        <StatsGrid metrics={metrics} loading={loading} onNavigate={onNavigate} />

        <div className={styles.panelsGrid}>

          {/* Left column */}
          <div className={styles.column}>
            <ForecastingPanel charts={charts} insights={insights} loading={loading} />
            <ForecastRevenuePanel charts={charts} metrics={metrics} loading={loading} />
          </div>

          {/* Right column */}
          <div className={styles.column}>
            <QuickPOSPanel
              recentOrders={recentOrders}
              loading={loading}
              onNavigate={onNavigate}
              onOrderClick={handleOrderClick}
            />
            <div className={styles.bottomRow}>
              <GoalPanel goalPercent={charts?.goalPercent ?? 0} loading={loading} />
              <YearlySalesPanel yearlySales={charts?.yearlySales} loading={loading} />
            </div>
          </div>

        </div>
      </div>

      {receipt && (
        <ReceiptModal
          receipt={receipt}
          receiptLoading={receiptLoading}
          onClose={() => setReceipt(null)}
          onOrdersUpdate={setRecentOrders}
        />
      )}
    </div>
  );
}
