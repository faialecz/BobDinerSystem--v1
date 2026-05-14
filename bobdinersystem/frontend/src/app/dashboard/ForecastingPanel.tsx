"use client";

import { useEffect, useState } from "react";
import styles from "@/css/dashboard.module.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface ForecastItem {
  item_name: string;
  uom: string;
  sku: string;
  brand: string;
  current_stock: number;
  daily_rate: number;
  days_until_stockout: number;
  suggested_reorder_qty: number;
  stockout_date: string;
  inventory_brand_id: number;
  unit_cost: number;
}

interface ReorderPayload {
  inventory_brand_id: number;
  item_name: string;
  brand_name: string;
  uom_name: string;
  quantity_ordered: number;
  unit_cost: number;
}

function stockPct(item: ForecastItem): number {
  const target = item.current_stock + item.suggested_reorder_qty;
  return target > 0 ? Math.round((item.current_stock / target) * 100) : 0;
}

function urgencyClass(days: number) {
  if (days < 7)  return styles.urgencyRed;
  if (days < 15) return styles.urgencyAmber;
  return styles.urgencyGreen;
}

// ── Empty / success state ────────────────────────────────────────────────────
function EmptyState({ slide }: { slide: "reorder" | "stockout" }) {
  return (
    <div className={styles.forecastEmpty}>
      <div className={styles.forecastEmptyCheck}>✓</div>
      <p className={styles.forecastEmptyTitle}>Looking good!</p>
      <p className={styles.forecastEmptyMsg}>
        {slide === "stockout"
          ? "No immediate stock-outs predicted based on your current sales velocity."
          : "No reorder actions needed right now. Inventory levels are healthy."}
      </p>
    </div>
  );
}

// ── Smart Reorder card ───────────────────────────────────────────────────────
function ReorderCard({ item, onCreatePO }: { item: ForecastItem; onCreatePO?: (payload: ReorderPayload) => void }) {
  const target30d = Math.round(item.daily_rate * 30);

  return (
    <div className={styles.insightCard}>
      {/* Identification */}
      <div className={styles.insightProductRow}>
        <p className={styles.insightProductName}>{item.item_name}</p>
        {item.sku && <span className={styles.insightSkuBadge}>SKU: {item.sku}</span>}
      </div>

      {/* Hero — exact qty to order */}
      <div className={styles.reorderHero}>
        <span className={styles.reorderHeroQty}>{item.suggested_reorder_qty}</span>
        <span className={styles.reorderHeroUnit}>{item.uom} to order</span>
      </div>

      {/* AI Analysis math box */}
      <div className={styles.aiAnalysisBox}>
        <p className={styles.aiAnalysisTitle}></p>
        <div className={styles.aiAnalysisRow}>
          <span>30-Day Target</span>
          <span>{target30d} {item.uom}</span>
        </div>
        <div className={styles.aiAnalysisRow}>
          <span>Current Stock</span>
          <span>− {item.current_stock} {item.uom}</span>
        </div>
        <div className={styles.aiAnalysisDivider} />
        <div className={styles.aiAnalysisRow}>
          <span>Suggested Order</span>
          <span className={styles.aiAnalysisTotal}>{item.suggested_reorder_qty} {item.uom}</span>
        </div>
      </div>

      {/* CTA */}
      <button
        className={styles.draftPoBtn}
        onClick={() => onCreatePO?.({
          inventory_brand_id: item.inventory_brand_id,
          item_name:          item.item_name,
          brand_name:         item.brand,
          uom_name:           item.uom,
          quantity_ordered:   item.suggested_reorder_qty,
          unit_cost:          item.unit_cost,
        })}
      >
        Create Purchase Order
      </button>
      <p className={styles.draftPoNote}>
        Provides 30 days of coverage based on current velocity.
      </p>
    </div>
  );
}

// ── Stock-Out Prediction card ────────────────────────────────────────────────
function StockOutCard({ item }: { item: ForecastItem }) {
  const isOutOfStock   = item.current_stock <= 0;
  const hasVelocity    = item.daily_rate > 0;
  const daysLeft       = hasVelocity ? Math.floor(item.current_stock / item.daily_rate) : Infinity;

  const pct = stockPct(item);
  const fillClass = isOutOfStock
    ? styles.stockFillRed
    : !hasVelocity
    ? styles.stockFillGreen
    : daysLeft < 7
    ? styles.stockFillRed
    : daysLeft < 15
    ? styles.stockFillAmber
    : styles.stockFillGreen;

  // Hero display
  let heroLabel: string;
  let heroBadge: React.ReactNode;
  if (isOutOfStock) {
    heroLabel = "Out of Stock";
    heroBadge = (
      <span className={`${styles.stockoutHeroDays} ${styles.urgencyRed}`}>
        Restock Immediately
      </span>
    );
  } else if (!hasVelocity) {
    heroLabel = "Stocked";
    heroBadge = (
      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>No recent consumption</span>
    );
  } else {
    heroLabel = item.stockout_date;
    heroBadge = (
      <span className={`${styles.stockoutHeroDays} ${urgencyClass(daysLeft)}`}>
        {daysLeft} Days Left
      </span>
    );
  }

  return (
    <div className={styles.insightCard}>
      <div className={styles.insightProductRow}>
        <p className={styles.insightProductName}>{item.item_name}</p>
        {item.sku && <span className={styles.insightSkuBadge}>SKU: {item.sku}</span>}
      </div>

      <div>
        <p className={styles.stockoutHeroDate}>{heroLabel}</p>
        {heroBadge}
      </div>

      <div className={styles.aiAnalysisBox}>
        <div className={styles.aiAnalysisRow}>
          <span>Current Stock</span>
          <span>{item.current_stock} {item.uom}</span>
        </div>
        <div className={styles.stockProgressTrack}>
          <div className={`${styles.stockProgressFill} ${fillClass}`} style={{ width: `${pct}%` }} />
        </div>
        <p className={styles.stockProgressInlineLabel}>{pct}% remaining</p>
        <div className={styles.aiAnalysisRow}>
          <span>Avg. Daily Consumption</span>
          <span>{item.daily_rate > 0 ? `${item.daily_rate} / day` : '—'}</span>
        </div>
      </div>

      <div className={styles.restockRow}>
        <button className={styles.restockLink}>Review Supplier →</button>
      </div>
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────
export default function ForecastingPanel({ onCreatePO }: { onCreatePO?: (payload: ReorderPayload) => void } = {}) {
  const [items, setItems]       = useState<ForecastItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);  // 0=Reorder, 1=StockOut
  const [itemIndex, setItemIndex]   = useState(0);  // which item within slide

  useEffect(() => {
    fetch(`${API}/api/dashboard/inventory-forecast`)
      .then((r) => r.json())
      .then((json) => { if (Array.isArray(json)) setItems(json); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const currentItem = items[itemIndex] ?? null;
  const totalItems  = items.length;

  const SLIDES: { title: string; content: React.ReactNode }[] = [
    {
      title: "Smart Reorder Suggestion",
      content: loading
        ? <div className={styles.skeletonBlock} />
        : totalItems === 0
        ? <EmptyState slide="reorder" />
        : currentItem && <ReorderCard item={currentItem} onCreatePO={onCreatePO} />,
    },
    {
      title: "Stock-Out Prediction",
      content: loading
        ? <div className={styles.skeletonBlock} />
        : totalItems === 0
        ? <EmptyState slide="stockout" />
        : currentItem && <StockOutCard item={currentItem} />,
    },
  ];

  return (
    <>
      <div className={`${styles.panel} ${styles.panelCream}`}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>{SLIDES[slideIndex].title}</h3>
        </div>

        <div className={styles.sliderOuter} style={{ height: "320px" }}>
          <div
            className={styles.sliderTrack}
            style={{ transform: `translateX(-${slideIndex * 100}%)` }}
          >
            {SLIDES.map((s, i) => (
              <div key={i} className={styles.slide}>{s.content}</div>
            ))}
          </div>
        </div>

      </div>

      {/* slide-toggle dots (Reorder ↔ StockOut) */}
      <div className={styles.slideDots}>
        {SLIDES.map((_, i) => (
          <button
            key={i}
            className={`${styles.slideDot} ${slideIndex === i ? styles.slideDotActive : ""}`}
            onClick={() => { setSlideIndex(i); setItemIndex(0); }}
          />
        ))}
      </div>
    </>
  );
}
