'use client';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import styles from '@/css/reports.module.css';
import exportStyles from '../../css/exportReports.module.css';
import TopHeader from '@/components/layout/TopHeader';
import { LuSearch, LuX, LuChevronLeft, LuChevronRight, LuPackage } from 'react-icons/lu';
import { type TabKey, exportCSV, exportExcel, exportPDF } from './exportReports';
import ExportButton from '@/components/features/ExportButton';
import RestrictedAccessModal from '@/components/features/RestrictedAccessModal';
import type { ModulePerms } from '@/types/user';

// ─── Tab config ───────────────────────────────────────────────────────────────
interface TabConfig { key: TabKey; label: string; usesDateFilter: boolean; endpoint: string; }
const TABS: TabConfig[] = [
  { key: 'product-performance', label: 'Product Performance', usesDateFilter: false, endpoint: '/api/reports/product-performance' },
  { key: 'inventory-valuation', label: 'Inventory Valuation', usesDateFilter: false, endpoint: '/api/reports/inventory-valuation' },
  { key: 'stock-ageing',        label: 'Stock Ageing',        usesDateFilter: false, endpoint: '/api/reports/stock-ageing'        },
  { key: 'reorder',             label: 'Reorder Report',      usesDateFilter: false, endpoint: '/api/reports/reorder'             },
  { key: 'customer-sales',      label: 'Customer Sales',      usesDateFilter: false,  endpoint: '/api/reports/customer-sales'      },
];

// ─── Row types ────────────────────────────────────────────────────────────────
interface StockOnHandRow        { sku: string; item_name: string; brand_name: string; uom: string; qty_on_hand: number; unit_cost: number; selling_price: number; stock_status: string; shelf_life: string | null; days_to_expiry: number | null; }
interface ProductPerfRow        { item_name: string; brand_name: string; sku: string; uom: string; units_sold: number; revenue: number; cogs: number; gross_profit: number; margin_pct: number; date_added: string | null; inventory_id: number; inventory_brand_id: number; }
interface InventoryValuationRow { sku: string; item_name: string; brand_name: string; uom: string; qty_on_hand: number; unit_cost: number; total_cost_value: number; selling_price: number; potential_profit: number; margin_pct: number; profit_status: string; stock_status: string; expiry_date: string | null; date_added: string | null; inventory_id: number; inventory_brand_id: number; }
interface StockAgeingRow        { item_name: string; brand_name: string; sku: string; batch_ids: string; qty_on_hand: number; last_received_date: string | null; unit_cost: number; selling_price: number; last_sale_date: string | null; earliest_expiry: string | null; expiry_status: string; days_in_inventory: number | null; ageing_label: string; value_of_aged_stock: number; holding_cost: number; recommended_action: string; inventory_brand_id: number; inventory_id: number; }
interface ReorderRow            { sku: string; item_name: string; brand_name: string; uom: string; qty_on_hand: number; reorder_point: number; min_order_qty: number; lead_time_days: number; suggested_order_qty: number; primary_supplier: string; supplier_contact: string; inventory_brand_id: number; }
interface CustomerSalesRow      { customer_name: string; total_orders: number; total_revenue: number; last_purchase_date: string | null; days_inactive: number | null; activity_status: string; ltv_trend: string; this_month: number; last_month: number; spending_insight: string; preferred_payment: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const peso = (v: number | null | undefined) => `\u20b1${(v ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num  = (v: number | null | undefined) => (v ?? 0).toLocaleString('en-PH');
const fmtDate = (d: string | null | undefined): string | null => {
  if (!d) return null;
  const dt = new Date(d + (d.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

function fmtDays(days: number | null | undefined): string {
  if (days == null) return '—';
  if (days < 30)   return `${days} d`;
  if (days < 365)  return `${Math.round(days / 30)} mo`;
  const yrs = days / 365;
  return `${yrs % 1 === 0 ? yrs : yrs.toFixed(1)} yr`;
}
function sumField<T>(arr: T[], key: keyof T): number {
  return arr.reduce((s, r) => s + (Number(r[key]) || 0), 0);
}

// ─── Sort helpers (defined outside component to avoid re-creation) ────────────
function SortIconBase({ active, desc }: { active: boolean; desc: boolean }) {
  const color = active ? '#1a4263' : '#94a3b8';
  return desc && active
    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>;
}
function EmptyRow({ cols, message }: { cols: number; message?: string }) {
  return <tr><td colSpan={cols} className={styles.emptyCell}>{message ?? 'No data found.'}</td></tr>;
}
function LoadingRow({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j}>
              <div style={{
                height: '12px',
                borderRadius: '4px',
                background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)',
                backgroundSize: '600px 100%',
                animation: 'shimmer 1.4s infinite linear',
                width: j === 0 ? '120px' : `${50 + (j % 4) * 15}px`,
              }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
function SkuCell({ sku }: { sku: string }) {
  return <span className={styles.codeText}>{sku}</span>;
}
function StockStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Available: styles.statusAvailable, 'Low Stock': styles.statusLow,
    'Out of Stock': styles.statusOut, 'Expiring Soon': styles.statusExp, Archived: styles.statusArchived,
  };
  return <span className={`${styles.statusBadge} ${map[status] ?? ''}`}>{status}</span>;
}
function AgeingBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Fresh:    styles.ageActive,
    Ageing:   styles.ageSlow,
    Old:      styles.ageRisk,
    Critical: styles.ageDead,
  };
  return <span className={`${styles.statusBadge} ${map[status] ?? ''}`}>{status}</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ReportsPage({
  role = 'Admin', onLogout, permissions, onNavigate, initialTab, onViewOpened,
}: {
  role?: string;
  onLogout: () => void;
  permissions?: ModulePerms;
  onNavigate?: (tab: string, item?: { inventory_brand_id: number; item_name: string; brand_name: string; uom_name: string; quantity_ordered: number; unit_cost: number; } | string) => void;
  initialTab?: TabKey;
  onViewOpened?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? 'product-performance');
  const [dataMap,   setDataMap]   = useState<Partial<Record<TabKey, Record<string, unknown>[]>>>({});
  const [extraMap,  setExtraMap]  = useState<Partial<Record<TabKey, unknown>>>({});
  const [loading,   setLoading]   = useState(false);
  const [errMsg,    setErrMsg]    = useState<string | null>(null);
  const [search,    setSearch]    = useState('');


  // ── Status / category filter ──
  const [statusFilter, setStatusFilter] = useState('All');
  const [statusOpen,   setStatusOpen]   = useState(false);

  // ── Date range filter — start required, end optional (null = open-ended) ──
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');

  // ── Sort ──
  const [sortKey, setSortKey]   = useState<string>('');
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('asc');
  // ── Pagination ──
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 15;
  // ── Column toggles ──
  const [showDateAdded, setShowDateAdded] = useState(false);
  // ── Stock ageing extra filters ──
  const [ageingExpiryFilter,  setAgeingExpiryFilter]  = useState('');
  const [ageingDateField,     setAgeingDateField]      = useState<'last_sale_date'|'earliest_expiry'|'date_added'>('last_sale_date');
  const [ageingExpiryOpen,    setAgeingExpiryOpen]     = useState(false);
  const [ageingDateFieldOpen, setAgeingDateFieldOpen]  = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg,  setToastMsg]  = useState('');
  const [isError,   setIsError]   = useState(false);
  const [showAgeingExportConfirm, setShowAgeingExportConfirm] = useState(false);
  const [pendingExportType, setPendingExportType] = useState<'csv'|'xlsx'|'pdf'|null>(null);

  // ── Item detail modal ──
  const [itemModalRow,  setItemModalRow]  = useState<Record<string, unknown> | null>(null);
  const [itemModalTab,  setItemModalTab]  = useState<TabKey | null>(null);
  const [itemModalBrand,     setItemModalBrand]     = useState<Record<string, unknown> | null>(null);
  const [itemModalSuppliers, setItemModalSuppliers] = useState<Record<string, unknown>[]>([]);
  const [itemModalLoading,   setItemModalLoading]   = useState(false);
  const [itemModalSuppOpen,  setItemModalSuppOpen]  = useState(false);

  const openItemModal = async (row: Record<string, unknown>, tab: TabKey) => {
    setItemModalRow(row);
    setItemModalTab(tab);
    setItemModalBrand(null);
    setItemModalSuppliers([]);
    setItemModalSuppOpen(false);
    const invId      = row.inventory_id;
    const brandId    = row.inventory_brand_id;
    if (invId) {
      setItemModalLoading(true);
      try {
        const res = await fetch(`/api/inventory/${invId}`);
        if (res.ok) {
          const data = await res.json();
          const brand = (data.brands as Record<string, unknown>[])?.find(
            b => Number(b.inventory_brand_id) === Number(brandId)
          ) ?? null;
          setItemModalBrand(brand);
          setItemModalSuppliers(data.suppliers ?? []);
        }
      } catch { /* fall through — row data used as fallback */ }
      finally { setItemModalLoading(false); }
    }
  };

  const closeItemModal = () => {
    setItemModalRow(null);
    setItemModalTab(null);
    setItemModalBrand(null);
    setItemModalSuppliers([]);
    setItemModalSuppOpen(false);
  };

  const toast = useCallback((msg: string, err = false) => {
    setToastMsg(msg); setIsError(err); setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  }, []);

  const fetchTab = useCallback(async (tab: TabKey, sd: string, ed: string, dateField?: string) => {
    const cfg = TABS.find(t => t.key === tab)!;
    setLoading(true); setErrMsg(null);
    let url = cfg.endpoint;
    const params = new URLSearchParams();
    if (sd) {
      params.set('start_date', sd);
      params.set('end_date', ed || sd);
    }
    if (dateField) params.set('date_field', dateField);
    if (params.toString()) url += `?${params.toString()}`;
    console.log('[reports] fetching:', url);
    try {
      const res  = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Request failed');
      console.log('[reports] got', Array.isArray(json) ? json.length : json, 'rows for', tab);
      setDataMap(prev => ({ ...prev, [tab]: json }));
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Unknown error');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      onViewOpened?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  useEffect(() => {
    fetchTab(activeTab, '', '');
    setSearch(''); setStatusFilter('All'); setFromDate(''); setToDate('');
    setSortKey(''); setSortDir('asc'); setCurrentPage(1);
    setAgeingExpiryFilter(''); setAgeingDateField('last_sale_date');
    setAgeingExpiryOpen(false); setAgeingDateFieldOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);
  const allRows = useMemo<Record<string, unknown>[]>(() => dataMap[activeTab] ?? [], [dataMap, activeTab]);
  const rows = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.toLowerCase();
    return allRows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [allRows, search]);
  const cfg = TABS.find(t => t.key === activeTab)!;
  const canExport = permissions?.can_export ?? false;

  // ── Per-tab filter options ──
  const STATUS_OPTIONS: Partial<Record<TabKey, { label: string; color: string; field: string }[]>> = {
    'stock-ageing': [
      { label: 'All', color: '#9ca3af', field: '' },
      { label: 'Active Stock', color: '#10b981', field: 'ageing_label' },
      { label: 'Slow-Moving',  color: '#f59e0b', field: 'ageing_label' },
      { label: 'Stagnant',     color: '#f97316', field: 'ageing_label' },
      { label: 'Dead Stock',   color: '#ef4444', field: 'ageing_label' },
      { label: 'Non-Mover',    color: '#7c3aed', field: 'ageing_label' },
    ],
    'product-performance': [
      { label: 'All', color: '#9ca3af', field: '' },
      { label: 'High Margin (>=20%)', color: '#10b981', field: '_margin' },
      { label: 'Mid Margin',          color: '#f59e0b', field: '_margin' },
      { label: 'Low Margin (<10%)',   color: '#ef4444', field: '_margin' },
    ],
    'inventory-valuation': [
      { label: 'All',                       color: '#9ca3af', field: '' },
      { label: 'Profitable (≥20% margin)',  color: '#10b981', field: '_profit' },
      { label: 'Break-even (0–20%)',        color: '#f59e0b', field: '_profit' },
      { label: 'Loss (<0%)',                color: '#ef4444', field: '_profit' },
    ],
    'customer-sales': [
      { label: 'All',      color: '#9ca3af', field: '' },
      { label: 'Active',   color: '#10b981', field: 'activity_status' },
      { label: 'Inactive', color: '#f59e0b', field: 'activity_status' },
      { label: 'At Risk',  color: '#f97316', field: 'activity_status' },
      { label: 'Dormant',  color: '#ef4444', field: 'activity_status' },
    ],
  };

  const tabStatusOptions = STATUS_OPTIONS[activeTab] ?? [];
  const dotColor = tabStatusOptions.find(o => o.label === statusFilter)?.color ?? '#9ca3af';

  const filteredRows = useMemo(() => {
    let result = rows;

    // Status / category filter
    if (statusFilter !== 'All' && tabStatusOptions.length > 0) {
      const opt = tabStatusOptions.find(o => o.label === statusFilter);
      if (opt && opt.field) {
        if (opt.field === 'stock_status') result = result.filter(r => (r as Record<string,unknown>).stock_status === opt.label);
        else if (opt.field === 'ageing_status') result = result.filter(r => (r as Record<string,unknown>).ageing_status === opt.label);
        else if (opt.field === 'item_status') result = result.filter(r => (r as Record<string,unknown>).item_status === opt.label);
        else if (opt.field === 'activity_status') result = result.filter(r => (r as Record<string,unknown>).activity_status === opt.label);
        else if (opt.field === 'ageing_label') result = result.filter(r => (r as Record<string,unknown>).ageing_label === opt.label);
        else if (opt.field === '_margin') {
          result = result.filter(r => {
            const m = Number((r as Record<string,unknown>).margin_pct ?? 0);
            if (opt.label.startsWith('High'))  return m >= 20;
            if (opt.label.startsWith('Low'))   return m < 10;
            return m >= 10 && m < 20;
          });
        } else if (opt.field === '_profit') {
          result = result.filter(r => {
            const status = (r as Record<string,unknown>).profit_status as string;
            // Match on the base word before any parenthetical
            const baseLabel = opt.label.split(' (')[0];
            return status === baseLabel;
          });        }
      }
    }

    // Date range filter is handled server-side via fetchTab — no client-side re-filter needed

    // Sort
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = (a as Record<string,unknown>)[sortKey];
        const bv = (b as Record<string,unknown>)[sortKey];
        const an = Number(av), bn = Number(bv);
        const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av ?? '').localeCompare(String(bv ?? ''));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    // Stock ageing extra filters
    if (activeTab === 'stock-ageing') {
      if (ageingExpiryFilter) {
        result = result.filter(r => (r as Record<string,unknown>).expiry_status === ageingExpiryFilter);
      }
    }

    return result;
  }, [rows, statusFilter, sortKey, sortDir, activeTab, tabStatusOptions, ageingExpiryFilter]);

  // ── Shared export runner ──
  const runExport = useCallback(async (type: 'csv'|'xlsx'|'pdf', includeRecommendedAction: boolean) => {
    const fileDate  = fromDate && toDate ? `${fromDate}_to_${toDate}` : new Date().toISOString().slice(0, 10);
    const dateRange = fromDate && toDate ? `${fromDate} → ${toDate}` : fromDate ? `From ${fromDate}` : toDate ? `Until ${toDate}` : 'All Time';
    const tabCfg    = TABS.find(t => t.key === activeTab)!;
    type ColEntry = { header: string; key: string; fmt?: (v: unknown) => string };
    const TAB_COLS: Partial<Record<TabKey, ColEntry[]>> = {
      'product-performance': [
        { header: 'Item Name',              key: 'item_name' },
        { header: 'SKU',                    key: 'sku' },
        { header: 'Qty Sold',               key: 'units_sold' },
        { header: 'Gross Sales (PHP)',       key: 'revenue',      fmt: v => Number(v??0).toFixed(2) },
        { header: 'COGS (PHP)',             key: 'cogs',         fmt: v => Number(v??0).toFixed(2) },
        { header: 'Net Profit (PHP)',       key: 'gross_profit', fmt: v => Number(v??0).toFixed(2) },
        { header: 'Contribution %',         key: 'margin_pct',   fmt: v => Number(v??0).toFixed(1) },
        ...(showDateAdded ? [{ header: 'Date Added', key: 'date_added', fmt: (v: unknown) => fmtDate(v as string) ?? '—' }] : []),
      ],
      'inventory-valuation': [
        { header: 'Item Name',              key: 'item_name' },
        { header: 'SKU',                    key: 'sku' },
        { header: 'Stock on Hand',          key: 'qty_on_hand' },
        { header: 'Unit Cost (PHP)',         key: 'unit_cost',        fmt: v => Number(v??0).toFixed(2) },
        { header: 'Unit Price (PHP)',        key: 'selling_price',    fmt: v => Number(v??0).toFixed(2) },
        { header: 'Total Value (PHP)',       key: 'total_cost_value', fmt: v => Number(v??0).toFixed(2) },
        { header: 'Potential Profit (PHP)', key: 'potential_profit', fmt: v => Number(v??0).toFixed(2) },
        { header: 'Expiry Date',            key: 'expiry_date',      fmt: v => fmtDate(v as string) ?? '—' },
        { header: 'Inventory Status',       key: 'stock_status' },
        { header: 'Profit Status',          key: 'profit_status' },
        ...(showDateAdded ? [{ header: 'Date Added', key: 'date_added', fmt: (v: unknown) => fmtDate(v as string) ?? '—' }] : []),
      ],
      'stock-ageing': [
        { header: 'Item Name',              key: 'item_name' },
        { header: 'SKU',                    key: 'sku' },
        { header: 'Qty on Hand',            key: 'qty_on_hand' },
        { header: 'Date Received',          key: 'last_received_date', fmt: v => fmtDate(v as string) ?? '—' },
        { header: 'Last Sold',              key: 'last_sale_date',     fmt: v => fmtDate(v as string) ?? '—' },
        { header: 'Earliest Expiry',        key: 'earliest_expiry',    fmt: v => fmtDate(v as string) ?? '—' },
        { header: 'Days in Inventory',      key: 'days_in_inventory' },
        { header: 'Total Cost Value (PHP)', key: 'value_of_aged_stock', fmt: v => Number(v??0).toFixed(2) },
        { header: 'Stock Status',           key: 'ageing_label' },
        { header: 'Expiration Status',      key: 'expiry_status' },
        ...(includeRecommendedAction ? [{ header: 'Recommended Action', key: 'recommended_action' }] : []),
      ],
      'reorder': [
        { header: 'SKU',                    key: 'sku' },
        { header: 'Item Name',              key: 'item_name' },
        { header: 'Current Qty',            key: 'qty_on_hand' },
        { header: 'Reorder Point',          key: 'reorder_point' },
        { header: 'Min Order Qty',          key: 'min_order_qty' },
        { header: 'Lead Time (Days)',       key: 'lead_time_days' },
        { header: 'Suggested Order',        key: 'suggested_order_qty' },
        { header: 'Primary Supplier',       key: 'primary_supplier' },
        { header: 'Contact',                key: 'supplier_contact' },
      ],
      'customer-sales': [
        { header: 'Customer Name',          key: 'customer_name' },
        { header: 'Total Orders',           key: 'total_orders' },
        { header: 'Total Revenue (PHP)',    key: 'total_revenue', fmt: v => Number(v??0).toFixed(2) },
        { header: 'Last Purchase Date',     key: 'last_purchase_date', fmt: v => fmtDate(v as string) ?? '—' },
        { header: 'Activity Status',        key: 'activity_status' },
        { header: 'Spending Pattern',       key: 'spending_insight' },
        { header: 'Payment Methods',        key: 'preferred_payment' },
      ],
    };
    const cols = TAB_COLS[activeTab];
    if (!cols) { toast('Export not supported for this tab.', true); return; }
    const headers    = cols.map(c => c.header);
    const exportRows = filteredRows.map(r => cols.map(c => { const v = r[c.key]; return c.fmt ? c.fmt(v) : String(v ?? '—'); }));
    try {
      if (type === 'csv')  exportCSV(activeTab, filteredRows, tabCfg.label, dateRange, fileDate, false, headers, exportRows);
      if (type === 'xlsx') await exportExcel(activeTab, filteredRows, tabCfg.label, dateRange, fileDate, false, headers, exportRows);
      if (type === 'pdf')  await exportPDF(activeTab, filteredRows, tabCfg.label, dateRange, fileDate, false, headers, exportRows);
      toast(`${tabCfg.label} exported as ${type.toUpperCase()} successfully!`);
    } catch { toast('Export failed. Please try again.', true); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filteredRows, fromDate, toDate, showDateAdded]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setCurrentPage(1);
  }

  function SortIcon({ col }: { col: string }) {
    const active = sortKey === col;
    const color = active ? '#1a4263' : '#94a3b8';
    return sortDir === 'desc' && active
      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>;
  }

  const thStyle = (col: string): React.CSSProperties => ({
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  });

  function Th({ col, children, className }: { col: string; children: React.ReactNode; className?: string }) {
    return (
      <th className={className} style={thStyle(col)} onClick={() => toggleSort(col)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {children}<SortIcon col={col} />
        </span>
      </th>
    );
  }

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));
  const paginatedRows = filteredRows.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  const changePage = (page: number) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };

  function renderPageNumbers() {
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage + 1 < maxVisible) startPage = Math.max(1, endPage - maxVisible + 1);
    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button key={i} onClick={() => changePage(i)}
          style={{ width: 32, height: 32, borderRadius: 6, border: currentPage === i ? 'none' : '1px solid #e2e8f0',
            background: currentPage === i ? '#1a4263' : '#fff', color: currentPage === i ? '#fff' : '#374151',
            fontWeight: currentPage === i ? 700 : 400, fontSize: '0.82rem', cursor: 'pointer' }}>
          {i}
        </button>
      );
    }
    return pages;
  }

  // Tabs that show date inputs (server-side via usesDateFilter, or client-side filtering)
  const hasDateFilter = ['product-performance', 'stock-ageing','inventory-valuation'].includes(activeTab);

  function PaginationFooter() {
    if (filteredRows.length <= ROWS_PER_PAGE) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px 0', marginTop: 8 }}>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
          Showing <strong>{Math.min((currentPage - 1) * ROWS_PER_PAGE + 1, filteredRows.length)}–{Math.min(currentPage * ROWS_PER_PAGE, filteredRows.length)}</strong> of <strong>{filteredRows.length}</strong>
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1}
            style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #e2e8f0', background: currentPage === 1 ? '#f8fafc' : '#fff', color: currentPage === 1 ? '#cbd5e1' : '#374151', cursor: currentPage === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LuChevronLeft size={14} />
          </button>
          {renderPageNumbers()}
          <button onClick={() => changePage(currentPage + 1)} disabled={currentPage === totalPages}
            style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #e2e8f0', background: currentPage === totalPages ? '#f8fafc' : '#fff', color: currentPage === totalPages ? '#cbd5e1' : '#374151', cursor: currentPage === totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LuChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className={styles.container}>
      {permissions && !permissions.can_view && (
        <RestrictedAccessModal onClose={onLogout} message="You don't have permission to view Reports. Please contact your administrator." />
      )}
      <div style={{ flexShrink: 0 }}><TopHeader role={role} onLogout={onLogout} /></div>

      {/* Toast */}
      {showToast && (
        <div className={exportStyles.toastBackdrop}>
          <div className={exportStyles.toastCard}>
            <div className={`${exportStyles.toastBand} ${isError ? exportStyles.toastBandError : exportStyles.toastBandSuccess}`}>
              <div className={exportStyles.toastIcon}>
                {isError
                  ? <span className={exportStyles.toastIconExclaim}>!</span>
                  : <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
              </div>
            </div>
            <div className={exportStyles.toastBody}>
              <h2 className={exportStyles.toastTitle}>{isError ? 'Oops!' : 'Success!'}</h2>
              <p className={exportStyles.toastMessage}>{toastMsg}</p>
              <button onClick={() => setShowToast(false)} className={`${exportStyles.toastOkBtn} ${isError ? exportStyles.toastOkBtnError : exportStyles.toastOkBtnSuccess}`}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* ── STOCK AGEING EXPORT CONFIRM ── */}
      {showAgeingExportConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowAgeingExportConfirm(false)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '36px 32px', width: 380, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '2.2rem', marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8, color: '#111' }}>Include Recommended Actions?</p>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 24 }}>
              Do you want to include the <strong>Recommended Action</strong> column in the exported file?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => { setShowAgeingExportConfirm(false); if (pendingExportType) runExport(pendingExportType, false); }}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', color: '#334155' }}>
                No, Skip
              </button>
              <button
                onClick={() => { setShowAgeingExportConfirm(false); if (pendingExportType) runExport(pendingExportType, true); }}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#1a4263', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', color: '#fff' }}>
                Yes, Include
              </button>
            </div>
          </div>
        </div>
      )}

      <main className={styles.mainContent}>
        {/* Header */}
        <div className={styles.headerActions}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#164163', margin: 0 }}>REPORTS</h1>
            <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: '2px 0 0' }}>
              Granular tabular reports across inventory, sales, and customer data.
            </p>
          </div>
          {canExport && (
            <ExportButton onSelect={async (type) => {
              if (!filteredRows.length) { toast('No data to export.', true); return; }
              // Stock ageing: ask about recommended actions first
              if (activeTab === 'stock-ageing') {
                setPendingExportType(type as 'csv'|'xlsx'|'pdf');
                setShowAgeingExportConfirm(true);
                return;
              }
              await runExport(type as 'csv'|'xlsx'|'pdf', false);
            }} />
          )}
        </div>

        {/* Tab bar */}
        <div className={styles.tabBar}>
          {TABS.map(t => (
            <button key={t.key}
              className={`${styles.tabBtn} ${activeTab === t.key ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Report panel */}
        <div className={styles.reportPanel}>
          {errMsg && (
            <div style={{ color: '#b91c1c', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: '0.875rem' }}>
              <strong>Error:</strong> {errMsg}
            </div>
          )}

          {/* Single unified filter row */}
          <div className={styles.filterBar} style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 12, justifyContent: 'space-between' }}>
            {/* LEFT: date inputs */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
              {(cfg.usesDateFilter || hasDateFilter) && (
                <>
                  <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>Start Date</label>
                    <input type="date" className={styles.dateInput}
                      value={fromDate}
                      max={toDate || undefined}
                      onChange={e => {
                        const val = e.target.value;
                        setFromDate(val);
                        setCurrentPage(1);
                        fetchTab(activeTab, val, toDate, activeTab === 'stock-ageing' ? ageingDateField : undefined);
                      }} />
                  </div>
                  <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>End Date <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></label>
                    <input type="date" className={styles.dateInput}
                      value={toDate}
                      min={fromDate || undefined}
                      onChange={e => {
                        const val = e.target.value;
                        setToDate(val);
                        setCurrentPage(1);
                        fetchTab(activeTab, fromDate, val, activeTab === 'stock-ageing' ? ageingDateField : undefined);
                      }} />
                  </div>
                  {fromDate && (
                    <div style={{ alignSelf: 'flex-end', paddingBottom: 8, fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {toDate
                        ? `${new Date(fromDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} → ${new Date(toDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : new Date(fromDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                  {(fromDate || toDate) && (
                    <button onClick={() => { setFromDate(''); setToDate(''); fetchTab(activeTab, '', '', activeTab === 'stock-ageing' ? ageingDateField : undefined); setCurrentPage(1); }}
                      style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 7, padding: '7px 12px', fontSize: '0.8rem', color: '#94a3b8', cursor: 'pointer', alignSelf: 'flex-end' }}>
                      Clear
                    </button>
                  )}
                </>
              )}
            </div>

            {/* RIGHT: status filter + search + count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {tabStatusOptions.length > 1 && (
                <div className={styles.statusFilterContainer}>
                  <button
                    className={`${styles.statusFilterTrigger} ${statusOpen ? styles.statusFilterTriggerOpen : ''}`}
                    onClick={() => { setStatusOpen(p => !p); setAgeingExpiryOpen(false); }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, backgroundColor: dotColor, display: 'inline-block' }} />
                    <span>{statusFilter === 'All' && activeTab === 'stock-ageing' ? 'Stock Status' : statusFilter}</span>
                    <svg className={`${styles.statusFilterChevron} ${statusOpen ? styles.statusFilterChevronOpen : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {statusOpen && (
                    <div className={styles.statusFilterMenu}>
                      {tabStatusOptions.map(opt => (
                        <button key={opt.label}
                          className={`${styles.statusFilterMenuItem} ${statusFilter === opt.label ? styles.statusFilterMenuItemActive : ''}`}
                          onClick={() => { setStatusFilter(opt.label); setStatusOpen(false); }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: opt.color, flexShrink: 0, display: 'inline-block' }} />
                          <span style={{ flex: 1 }}>{opt.label}</span>
                          {statusFilter === opt.label && <svg className={styles.statusFilterCheckmark} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Date Added toggle — only for tabs that have it */}
              {['product-performance', 'inventory-valuation', 'stock-ageing'].includes(activeTab) && (
                <button
                  onClick={() => setShowDateAdded(p => !p)}
                  style={{
                    padding: '6px 12px', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    border: '1px solid #e2e8f0',
                    background: showDateAdded ? '#1a4263' : '#fff',
                    color: showDateAdded ? '#fff' : '#64748b',
                    whiteSpace: 'nowrap',
                  }}>
                  {showDateAdded ? '✓ Date Added' : '+ Date Added'}
                </button>
              )}

              {/* Stock ageing inline filters */}
              {activeTab === 'stock-ageing' && (
                <>
                  {/* Date field selector */}
                  {(() => {
                    const dateFieldOpts: { value: typeof ageingDateField; label: string }[] = [
                      { value: 'last_sale_date', label: 'Last Sold' },
                      { value: 'earliest_expiry', label: 'Earliest Expiry' },
                      { value: 'date_added', label: 'Date Added' },
                    ];
                    const activeLabel = dateFieldOpts.find(o => o.value === ageingDateField)?.label ?? 'Last Sold';
                    return (
                      <div className={styles.statusFilterContainer} style={{ position: 'relative' }}>
                        <button
                          className={`${styles.statusFilterTrigger} ${ageingDateFieldOpen ? styles.statusFilterTriggerOpen : ''}`}
                          onClick={() => { setAgeingDateFieldOpen(p => !p); setStatusOpen(false); setAgeingExpiryOpen(false); }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', marginRight: 4 }}>Filter by:</span>
                          <span>{activeLabel}</span>
                          <svg className={`${styles.statusFilterChevron} ${ageingDateFieldOpen ? styles.statusFilterChevronOpen : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        {ageingDateFieldOpen && (
                          <div className={styles.statusFilterMenu}>
                            {dateFieldOpts.map(opt => (
                              <button key={opt.value}
                                className={`${styles.statusFilterMenuItem} ${ageingDateField === opt.value ? styles.statusFilterMenuItemActive : ''}`}
                                onClick={() => { setAgeingDateField(opt.value); setAgeingDateFieldOpen(false); setCurrentPage(1); fetchTab(activeTab, fromDate, toDate, opt.value); }}>
                                <span style={{ flex: 1 }}>{opt.label}</span>
                                {ageingDateField === opt.value && <svg className={styles.statusFilterCheckmark} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Expiry filter — styled like stock status dropdown */}
                  {(() => {
                    const expiryOpts: { label: string; color: string }[] = [
                      { label: 'All',               color: '#9ca3af' },
                      { label: 'Expired', color: '#1e293b' },
                      { label: 'Critical',          color: '#b91c1c' },
                      { label: 'Near Expiry',       color: '#854d0e' },
                      { label: 'Stable',            color: '#15803d' },
                    ];
                    const activeDot = expiryOpts.find(o => o.label === ageingExpiryFilter)?.color ?? '#9ca3af';
                    
                    return (
                      <div className={styles.statusFilterContainer} style={{ position: 'relative' }}>
                        <button
                          className={`${styles.statusFilterTrigger} ${ageingExpiryOpen ? styles.statusFilterTriggerOpen : ''}`}
                          onClick={() => { setAgeingExpiryOpen(p => !p); setStatusOpen(false); setAgeingDateFieldOpen(false); }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, backgroundColor: activeDot, display: 'inline-block' }} />
                          <span>{ageingExpiryFilter || 'Expiry Status'}</span>
                          <svg className={`${styles.statusFilterChevron} ${ageingExpiryOpen ? styles.statusFilterChevronOpen : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        {ageingExpiryOpen && (
                          <div className={styles.statusFilterMenu}>
                            {expiryOpts.map(opt => (
                              <button key={opt.label}
                                className={`${styles.statusFilterMenuItem} ${(ageingExpiryFilter || 'All') === opt.label ? styles.statusFilterMenuItemActive : ''}`}
                                onClick={() => { setAgeingExpiryFilter(opt.label === 'All' ? '' : opt.label); setAgeingExpiryOpen(false); setCurrentPage(1); }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: opt.color, flexShrink: 0, display: 'inline-block' }} />
                                <span style={{ flex: 1 }}>{opt.label}</span>
                                {(ageingExpiryFilter || 'All') === opt.label && <svg className={styles.statusFilterCheckmark} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {ageingExpiryFilter && (
                    <button onClick={() => { setAgeingExpiryFilter(''); setCurrentPage(1); }}
                      className={styles.statusFilterTrigger} style={{ color: '#94a3b8' }}>
                      Clear
                    </button>
                  )}
                </>
              )}

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <LuSearch size={14} style={{ position: 'absolute', left: 9, color: '#94a3b8', pointerEvents: 'none' }} />
                <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                  className={styles.dateInput} style={{ paddingLeft: 28, paddingRight: search ? 28 : 8, width: 180, fontSize: '0.8rem' }} />
                {search && (
                  <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 7, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}>
                    <LuX size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* PRODUCT PERFORMANCE */}
          {activeTab === 'product-performance' && (() => {
            const r = paginatedRows as unknown as ProductPerfRow[];
            const all = filteredRows as unknown as ProductPerfRow[];
            return (
              <>
              <div className={styles.tableWrapper}>
                <table className={styles.reportTable}>
                  <thead><tr>
                    <Th col="item_name">Item Name</Th><Th col="sku">SKU</Th>
                    <Th col="units_sold" className={styles.numCol}>Qty Sold</Th>
                    <Th col="revenue" className={styles.numCol}>Gross Sales</Th>
                    <Th col="cogs" className={styles.numCol}>COGS</Th>
                    <Th col="gross_profit" className={styles.numCol}>Net Profit</Th>
                    <Th col="margin_pct" className={styles.numCol}>Profit Contribution %</Th>
                    {showDateAdded && <Th col="date_added">Date Added</Th>}
                  </tr></thead>
                  <tbody>
                    {loading ? <LoadingRow cols={showDateAdded ? 8 : 7} /> : r.length === 0 ? <EmptyRow cols={showDateAdded ? 8 : 7} /> : r.map((row, i) => (
                      <tr key={i}
                        style={{ cursor: 'pointer' }}
                        onClick={() => openItemModal(row as unknown as Record<string, unknown>, 'product-performance')}>
                        <td style={{ color: '#1a4263', fontWeight: 600 }}>{row.item_name}</td>
                        <td><SkuCell sku={row.sku} /></td>
                        <td className={styles.numCol}>{num(row.units_sold)}</td>
                        <td className={`${styles.numCol} ${styles.revenueVal}`}>{peso(row.revenue)}</td>
                        <td className={`${styles.numCol} ${styles.soldVal}`}>{peso(row.cogs)}</td>
                        <td className={`${styles.numCol} ${row.gross_profit >= 0 ? styles.addedVal : styles.soldVal}`}>{peso(row.gross_profit)}</td>
                        <td className={`${styles.numCol} ${row.margin_pct >= 20 ? styles.addedVal : row.margin_pct < 5 ? styles.soldVal : ''}`}>
                          {row.margin_pct.toFixed(1)}%
                        </td>
                        {showDateAdded && <td>{fmtDate(row.date_added) ?? <span style={{ color: '#94a3b8' }}>—</span>}</td>}
                      </tr>
                    ))}
                  </tbody>
                  {all.length > 0 && <tfoot><tr>
                    <td colSpan={2} className={styles.totalLabel}>Totals</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{num(sumField(all, 'units_sold'))}</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(all, 'revenue'))}</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(all, 'cogs'))}</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(all, 'gross_profit'))}</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>100%</td>
                    {showDateAdded && <td />}
                  </tr></tfoot>}
                </table>
              </div>
              <PaginationFooter />
              </>
            );
          })()}

          {/* INVENTORY VALUATION */}
          {activeTab === 'inventory-valuation' && (() => {
            const r = paginatedRows as unknown as InventoryValuationRow[];
            const all = filteredRows as unknown as InventoryValuationRow[];
            const totalInventoryValue = sumField(all, 'total_cost_value');
            const totalPotentialProfit = sumField(all, 'potential_profit');
            return (
              <>
              { /* Summary cards
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '2px 0 0' }}>Sum of qty × unit cost</p>
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '2px 0 0' }}>Sum of qty × (price − cost)</p>
              */ }
              {!loading && all.length > 0 && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 20px' }}>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Total Inventory Value</p>
                    <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0c4a6e', margin: '4px 0 0' }}>{peso(totalInventoryValue)}</p>
                  </div>
                  <div style={{ flex: 1, minWidth: 200, background: totalPotentialProfit >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${totalPotentialProfit >= 0 ? '#bbf7d0' : '#fecaca'}`, borderRadius: 10, padding: '12px 20px' }}>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: totalPotentialProfit >= 0 ? '#15803d' : '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Potential Profit</p>
                    <p style={{ fontSize: '1.4rem', fontWeight: 800, color: totalPotentialProfit >= 0 ? '#14532d' : '#7f1d1d', margin: '4px 0 0' }}>{peso(totalPotentialProfit)}</p>
                  </div>
                </div>
              )}
              <div className={styles.tableWrapper}>
                <table className={styles.reportTable}>
                  <thead><tr>
                    <Th col="item_name">Item Name</Th><Th col="sku">SKU</Th>
                    <Th col="qty_on_hand" className={styles.numCol}>Stock on Hand</Th>
                    <Th col="unit_cost" className={styles.numCol}>Unit Cost</Th>
                    <Th col="selling_price" className={styles.numCol}>Unit Price</Th>
                    <Th col="total_cost_value" className={styles.numCol}>Total Value</Th>
                    <Th col="potential_profit" className={styles.numCol}>Potential Profit</Th>
                    <Th col="expiry_date">Expiry Date</Th>
                    <Th col="stock_status">Inventory Status</Th>
                    <Th col="margin_pct">Profit Status</Th>
                    {showDateAdded && <Th col="date_added">Date Added</Th>}
                  </tr></thead>
                  <tbody>
                    {loading ? <LoadingRow cols={showDateAdded ? 11 : 10} /> : r.length === 0 ? <EmptyRow cols={showDateAdded ? 11 : 10} /> : r.map((row, i) => (
                      <tr key={i}
                        style={{ cursor: 'pointer' }}
                        onClick={() => openItemModal(row as unknown as Record<string, unknown>, 'inventory-valuation')}>
                        <td style={{ color: '#1a4263', fontWeight: 600 }}>{row.item_name}</td>
                        <td><SkuCell sku={row.sku} /></td>
                        <td className={styles.numCol}>{num(row.qty_on_hand)}</td>
                        <td className={styles.numCol}>{peso(row.unit_cost)}</td>
                        <td className={styles.numCol}>{peso(row.selling_price)}</td>
                        <td className={`${styles.numCol} ${styles.soldVal}`}>{peso(row.total_cost_value)}</td>
                        <td className={`${styles.numCol} ${row.potential_profit >= 0 ? styles.addedVal : styles.soldVal}`}>{peso(row.potential_profit)}</td>
                        <td>{fmtDate(row.expiry_date) ?? <span style={{ color: '#94a3b8' }}>—</span>}</td>
                        <td><StockStatusBadge status={row.stock_status} /></td>
                        <td>
                          <span className={styles.statusBadge} style={{
                            background: row.profit_status === 'Profitable' ? '#dcfce7' : row.profit_status === 'Loss' ? '#fee2e2' : '#fef9c3',
                            color:      row.profit_status === 'Profitable' ? '#15803d' : row.profit_status === 'Loss' ? '#b91c1c' : '#854d0e',
                          }}>
                            {row.profit_status}
                          </span>
                        </td>
                        {showDateAdded && <td>{fmtDate(row.date_added) ?? <span style={{ color: '#94a3b8' }}>—</span>}</td>}
                      </tr>
                    ))}
                  </tbody>
                  {all.length > 0 && <tfoot><tr>
                    <td colSpan={2} className={styles.totalLabel}>Totals</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{num(sumField(all, 'qty_on_hand'))}</td>
                    <td /><td />
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(all, 'total_cost_value'))}</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(all, 'potential_profit'))}</td>
                    <td colSpan={showDateAdded ? 4 : 3} />
                  </tr></tfoot>}
                </table>
              </div>
              <PaginationFooter />
              </>
            );
          })()}

          {/* STOCK AGEING */}
          {activeTab === 'stock-ageing' && (() => {
            const r = paginatedRows as unknown as StockAgeingRow[];
            const all = filteredRows as unknown as StockAgeingRow[];
            const bucketStyle: Record<string, { color: string; bg: string }> = {
              'Active Stock': { color: '#15803d', bg: '#dcfce7' },
              'Slow-Moving':  { color: '#854d0e', bg: '#fef9c3' },
              'Stagnant':     { color: '#9a3412', bg: '#ffedd5' },
              'Dead Stock':   { color: '#b91c1c', bg: '#fee2e2' },
              'Non-Mover':    { color: '#7c3aed', bg: '#ede9fe' },
            };
            const actionStyle: Record<string, string> = {
              'Maintain':             '#15803d',
              'Promote / Bundle':     '#854d0e',
              'Liquidate / Discount': '#b91c1c',
              'Dispose / Write-off':  '#7f1d1d',
            };
            const expiryOptions = ['', 'Expired', 'Critical', 'Near Expiry', 'Stable'];
            return (
              <>
              <div className={styles.tableWrapper}>
                <table className={styles.reportTable}>
                  <thead><tr>
                    <Th col="item_name">Item Name</Th>
                    <Th col="sku">SKU</Th>
                    <Th col="qty_on_hand" className={styles.numCol}>Qty on Hand</Th>
                    <Th col="last_sale_date">Last Sold</Th>
                    <Th col="earliest_expiry">Earliest Expiry</Th>
                    <Th col="days_in_inventory" className={styles.numCol}>Days in Inventory</Th>
                    <Th col="ageing_label">Stock Status</Th>
                    <Th col="expiry_status">Expiration Status</Th>
                    <Th col="recommended_action">Recommended Action</Th>
                    {showDateAdded && <Th col="last_received_date">Date Added</Th>}
                  </tr></thead>
                  <tbody>
                    {loading ? <LoadingRow cols={showDateAdded ? 10 : 9} /> : r.length === 0 ? <EmptyRow cols={showDateAdded ? 10 : 9} /> : r.map((row, i) => {
                      const bs = bucketStyle[row.ageing_label] ?? { color: '#64748b', bg: '#f1f5f9' };
                      return (
                        <tr key={i}
                          style={{ cursor: 'pointer' }}
                          onClick={() => openItemModal(row as unknown as Record<string, unknown>, 'stock-ageing')}>
                          <td style={{ color: '#1a4263', fontWeight: 600 }}>{row.item_name}</td>
                          <td><SkuCell sku={row.sku} /></td>
                          <td className={styles.numCol}>{num(row.qty_on_hand)}</td>
                          <td>{fmtDate(row.last_sale_date) ?? <span style={{ color: '#94a3b8' }}>—</span>}</td>
                          <td>{fmtDate(row.earliest_expiry) ?? <span style={{ color: '#94a3b8' }}>—</span>}</td>
                          <td className={styles.numCol}>{fmtDays(row.days_in_inventory as number | null)}</td>
                          <td>
                            <span className={styles.statusBadge} style={{ background: bs.bg, color: bs.color }}>
                              {row.ageing_label}
                            </span>
                          </td>
                          <td>{row.expiry_status
                            ? <span className={styles.statusBadge} style={{
                                background: row.expiry_status.startsWith('Expired') ? '#1e293b' :
                                            row.expiry_status === 'Critical'        ? '#fee2e2' :
                                            row.expiry_status === 'Near Expiry'     ? '#fef9c3' :
                                            '#f0fdf4',
                                color:      row.expiry_status.startsWith('Expired') ? '#f8fafc' :
                                            row.expiry_status === 'Critical'        ? '#b91c1c' :
                                            row.expiry_status === 'Near Expiry'     ? '#854d0e' :
                                            '#15803d',
                              }}>{row.expiry_status}</span>
                            : <span style={{ color: '#94a3b8' }}>—</span>
                          }</td>
                          <td style={{ fontSize: '0.82rem', fontWeight: 600, color: actionStyle[row.recommended_action] ?? '#64748b' }}>
                            {row.recommended_action}
                          </td>
                          {showDateAdded && <td>{fmtDate(row.last_received_date) ?? <span style={{ color: '#94a3b8' }}>—</span>}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                  {all.length > 0 && <tfoot><tr>
                    <td colSpan={2} className={styles.totalLabel}>Totals</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{num(sumField(all, 'qty_on_hand'))}</td>
                    <td colSpan={showDateAdded ? 7 : 6} />
                  </tr></tfoot>}
                </table>
              </div>
              <PaginationFooter />
              </>
            );
          })()}

          {/* REORDER REPORT */}
          {activeTab === 'reorder' && (() => {
            const r = paginatedRows as unknown as ReorderRow[];
            const all = filteredRows as unknown as ReorderRow[];
            return (
              <>
                {!loading && all.length > 0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '0.8rem', color: '#92400e' }}>
                    <strong>{all.length} item{all.length !== 1 ? 's' : ''}</strong> {all.length === 1 ? 'has' : 'have'} reached or fallen below their reorder point.
                  </div>
                )}
                <div className={styles.tableWrapper}>
                  <table className={styles.reportTable}>
                    <thead><tr>
                      <Th col="sku">SKU</Th><Th col="item_name">Item Name</Th>
                      <Th col="qty_on_hand" className={styles.numCol}>Current Qty</Th>
                      <Th col="reorder_point" className={styles.numCol}>Reorder Point</Th>
                      <Th col="min_order_qty" className={styles.numCol}>Min Order Qty</Th>
                      <Th col="lead_time_days" className={styles.numCol}>Lead Time (Days)</Th>
                      <Th col="suggested_order_qty" className={styles.numCol}>Suggested Order</Th>
                      <Th col="primary_supplier">Primary Supplier</Th><Th col="supplier_contact">Contact</Th>
                    </tr></thead>
                    <tbody>
                      {loading ? <LoadingRow cols={9} />
                        : r.length === 0
                          ? <tr><td colSpan={9} className={styles.emptyCell} style={{ color: '#15803d' }}>All items are sufficiently stocked.</td></tr>
                          : r.map((row, i) => (
                            <tr key={i}
                              style={{ cursor: 'pointer' }}
                              onClick={() => openItemModal(row as unknown as Record<string, unknown>, 'reorder')}
                              title={`View details for ${row.item_name}`}>
                              <td><SkuCell sku={row.sku} /></td>
                              <td style={{ color: '#1a4263', fontWeight: 600 }}>{row.item_name}</td>
                              <td className={`${styles.numCol} ${row.qty_on_hand === 0 ? styles.soldVal : styles.endingLow}`}>{num(row.qty_on_hand)}</td>
                              <td className={styles.numCol}>{num(row.reorder_point)}</td>
                              <td className={styles.numCol}>{num(row.min_order_qty)}</td>
                              <td className={styles.numCol}>{row.lead_time_days}</td>
                              <td className={`${styles.numCol} ${styles.revenueVal}`} style={{ fontWeight: 700 }}>{num(row.suggested_order_qty)}</td>
                              <td>{row.primary_supplier}</td>
                              <td style={{ color: '#64748b', fontSize: '0.82rem' }}>{row.supplier_contact}</td>
                            </tr>
                          ))
                      }
                    </tbody>
                    {all.length > 0 && <tfoot><tr>
                      <td colSpan={6} className={styles.totalLabel}>Total Suggested Orders</td>
                      <td className={`${styles.numCol} ${styles.totalValue}`}>{num(sumField(all, 'suggested_order_qty'))}</td>
                      <td colSpan={2} />
                    </tr></tfoot>}
                  </table>
                </div>
                <PaginationFooter />
              </>
            );
          })()}

          {/* CUSTOMER SALES */}
          {activeTab === 'customer-sales' && (() => {
            const r = paginatedRows as unknown as CustomerSalesRow[];
            const all = filteredRows as unknown as CustomerSalesRow[];
            return (
              <>
              <div className={styles.tableWrapper}>
                <table className={styles.reportTable}>
                  <thead><tr>
                    <Th col="customer_name">Customer Name</Th>
                    <Th col="total_orders" className={styles.numCol}>Total Orders</Th>
                    <Th col="total_revenue" className={styles.numCol}>Total Revenue</Th>
                    <Th col="last_purchase_date">Last Purchase Date</Th>
                    <Th col="days_inactive">Activity Status</Th>
                    <Th col="ltv_trend">Spending Pattern</Th>
                    <Th col="preferred_payment">Payment Methods</Th>
                  </tr></thead>
                  <tbody>
                    {loading ? <LoadingRow cols={7} /> : r.length === 0 ? <EmptyRow cols={7} /> : r.map((row, i) => {
                      const trendMap: Record<string, { icon: string; label: string; color: string; bg: string }> = {
                        up:   { icon: '↑', label: '', color: '#15803d', bg: '#dcfce7' },
                        down: { icon: '↓', label: '', color: '#b91c1c', bg: '#fee2e2' },
                        flat: { icon: '→', label: '', color: '#854d0e', bg: '#fef9c3' },
                        new:  { icon: '✦', label: 'New', color: '#1d4ed8', bg: '#dbeafe' },
                      };
                      const trend = trendMap[row.ltv_trend] ?? trendMap.flat;
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{row.customer_name}</td>
                          <td className={styles.numCol}>{num(row.total_orders)}</td>
                          <td className={`${styles.numCol} ${styles.revenueVal}`}>{peso(row.total_revenue)}</td>
                          <td>{fmtDate(row.last_purchase_date) ?? <span style={{ color: '#94a3b8' }}>—</span>}</td>
                          <td>{(() => {
                            const riskMap: Record<string, { color: string; bg: string }> = {
                              Active:   { color: '#15803d', bg: '#dcfce7' },
                              Inactive: { color: '#854d0e', bg: '#fef9c3' },
                              Dormant:  { color: '#b91c1c', bg: '#fee2e2' },
                              Unknown:  { color: '#64748b', bg: '#f1f5f9' },
                            };
                            const s = riskMap[row.activity_status] ?? riskMap.Unknown;
                            return (
                              <span className={styles.statusBadge} style={{ background: s.bg, color: s.color }}>
                                {row.activity_status}
                                {row.days_inactive != null && <span style={{ fontWeight: 400, marginLeft: 4 }}>({row.days_inactive}d)</span>}
                              </span>
                            );
                          })()}</td>
                          <td>
                            {row.ltv_trend === 'new'
                              ? <span style={{ color: '#94a3b8' }}>—</span>
                              : <span className={styles.statusBadge} style={{ background: trend.bg, color: trend.color }}>
                                  {trend.icon} {peso(row.this_month)} vs {peso(row.last_month)}
                                </span>
                            }
                          </td>
                          <td><span className={styles.paymentBadge}>{row.preferred_payment}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {all.length > 0 && <tfoot><tr>
                    <td className={styles.totalLabel}>Totals</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{num(sumField(all, 'total_orders'))}</td>
                    <td className={`${styles.numCol} ${styles.totalValue}`}>{peso(sumField(all, 'total_revenue'))}</td>
                    <td colSpan={4} />
                  </tr></tfoot>}
                </table>
              </div>
              <PaginationFooter />
              </>
            );
          })()}

        </div>
      </main>
    </div>

      {/* ===== ITEM DETAIL MODAL ===== */}
      {itemModalRow && itemModalTab && (() => {
        const row = itemModalRow;
        const tab = itemModalTab;

        // Shared helpers
        const itemName   = String(row.item_name ?? '');
        const brandName  = String(row.brand_name ?? '');
        const sku        = String(row.sku ?? '');
        const uom        = String(row.uom ?? '');

        // Per-tab badge colors
        const stockStatusColors: Record<string, { bg: string; color: string }> = {
          Available:      { bg: '#dcfce7', color: '#15803d' },
          'Low Stock':    { bg: '#fef9c3', color: '#854d0e' },
          'Out of Stock': { bg: '#fee2e2', color: '#b91c1c' },
          'Expiring Soon':{ bg: '#ffedd5', color: '#9a3412' },
          Archived:       { bg: '#f1f5f9', color: '#64748b' },
        };
        const ageingColors: Record<string, { bg: string; color: string }> = {
          'Active Stock': { bg: '#dcfce7', color: '#15803d' },
          'Slow-Moving':  { bg: '#fef9c3', color: '#854d0e' },
          'Stagnant':     { bg: '#ffedd5', color: '#9a3412' },
          'Dead Stock':   { bg: '#fee2e2', color: '#b91c1c' },
          'Non-Mover':    { bg: '#ede9fe', color: '#7c3aed' },
        };

        // Shared inline helpers
        const SectionLabel = ({ children }: { children: React.ReactNode }) => (
          <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', margin: '0 0 8px' }}>{children}</p>
        );
        const InfoRow = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500, flexShrink: 0, marginRight: 16 }}>{label}</span>
            <span style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 600, textAlign: 'right', fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
          </div>
        );
        const Badge = ({ label, bg, color }: { label: string; bg: string; color: string }) => (
          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: bg, color }}>{label}</span>
        );
        const Divider = ({ label }: { label: string }) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 10px' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#cbd5e1', whiteSpace: 'nowrap' }}>{label}</span>
            <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
          </div>
        );

        return (
          <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
            onClick={closeItemModal}
          >
            <div
              style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}
            >
              {/* ── Header ── */}
              <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <LuPackage size={18} style={{ color: '#1a4263' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{itemName}</p>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0' }}>
                      {!brandName || brandName === 'No Brand' ? 'Generic' : brandName}
                      {uom ? <span style={{ margin: '0 4px', opacity: 0.5 }}>·</span> : null}
                      {uom || null}
                      {sku ? <span style={{ marginLeft: 6, fontFamily: 'monospace', fontSize: '0.72rem', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, color: '#64748b' }}>{sku}</span> : null}
                    </p>
                  </div>
                </div>
                <button onClick={closeItemModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <LuX size={18} />
                </button>
              </div>

              {/* ── Body ── */}
              <div style={{ padding: '16px 20px', flex: 1 }}>

                {/* ── INVENTORY VALUATION status badges — shown above product info ── */}
                {tab === 'inventory-valuation' && (() => {
                  const r = row as unknown as InventoryValuationRow;
                  const ssColor = stockStatusColors[r.stock_status] ?? { bg: '#f1f5f9', color: '#64748b' };
                  const profitColor = r.profit_status === 'Profitable' ? '#15803d' : r.profit_status === 'Loss' ? '#b91c1c' : '#854d0e';
                  const profitBg    = r.profit_status === 'Profitable' ? '#dcfce7' : r.profit_status === 'Loss' ? '#fee2e2' : '#fef9c3';
                  return (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                      <Badge label={r.stock_status} bg={ssColor.bg} color={ssColor.color} />
                      <Badge label={r.profit_status} bg={profitBg} color={profitColor} />
                    </div>
                  );
                })()}

                {/* ── STOCK AGEING status badges — shown above product info ── */}
                {tab === 'stock-ageing' && (() => {
                  const r = row as unknown as StockAgeingRow;
                  const ac = ageingColors[r.ageing_label] ?? { bg: '#f1f5f9', color: '#64748b' };
                  const expiryColor = r.expiry_status?.startsWith('Expired') ? { bg: '#1e293b', color: '#f8fafc' }
                    : r.expiry_status === 'Critical'    ? { bg: '#fee2e2', color: '#b91c1c' }
                    : r.expiry_status === 'Near Expiry' ? { bg: '#fef9c3', color: '#854d0e' }
                    : { bg: '#f0fdf4', color: '#15803d' };
                  const qty    = Number(itemModalBrand?.qty ?? r.qty_on_hand ?? 0);
                  const expiry = itemModalBrand?.nearest_expiry as string | null ?? r.earliest_expiry ?? null;
                  const daysToExpiry = expiry
                    ? Math.floor((new Date(expiry).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86_400_000)
                    : null;
                  const stockStatus = qty === 0 ? 'Out of Stock'
                    : daysToExpiry !== null && daysToExpiry <= 30 ? 'Expiring Soon'
                    : qty <= 5 ? 'Low Stock'
                    : 'Available';
                  const sc = stockStatusColors[stockStatus] ?? { bg: '#f1f5f9', color: '#64748b' };
                  return (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                      <Badge label={stockStatus} bg={sc.bg} color={sc.color} />
                      <Badge label={r.ageing_label} bg={ac.bg} color={ac.color} />
                      {r.expiry_status && <Badge label={r.expiry_status} bg={expiryColor.bg} color={expiryColor.color} />}
                    </div>
                  );
                })()}

                {/* ── PRODUCT PERFORMANCE status badge ── */}
                {tab === 'product-performance' && (() => {
                  // Derive stock status from the fetched brand data (qty + nearest_expiry)
                  const qty    = Number(itemModalBrand?.qty ?? 0);
                  const expiry = itemModalBrand?.nearest_expiry as string | null ?? null;
                  const daysToExpiry = expiry
                    ? Math.floor((new Date(expiry).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86_400_000)
                    : null;

                  const stockStatus = itemModalLoading ? null
                    : qty === 0                                    ? 'Out of Stock'
                    : daysToExpiry !== null && daysToExpiry <= 30  ? 'Expiring Soon'
                    : qty <= 5                                     ? 'Low Stock'
                    : 'Available';

                  if (!stockStatus) return null;
                  const sc = stockStatusColors[stockStatus] ?? { bg: '#f1f5f9', color: '#64748b' };
                  return (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                      <Badge label={stockStatus} bg={sc.bg} color={sc.color} />
                    </div>
                  );
                })()}

                {(() => {
                  const b = itemModalBrand;
                  const unitCost     = Number(b?.unit_cost     ?? row.unit_cost     ?? 0);
                  const sellingPrice = Number(b?.selling_price ?? row.selling_price ?? 0);
                  const qtyOnHand    = Number(b?.qty           ?? row.qty_on_hand   ?? 0);
                  const expiryDate   = (b?.nearest_expiry ?? row.expiry_date ?? row.earliest_expiry ?? null) as string | null;
                  const description  = String(b?.description ?? '');
                  const dateAdded    = (row.date_added ?? row.last_received_date ?? null) as string | null;

                  const expiryNode = (dateStr: string | null): React.ReactNode => {
                    if (!dateStr) return <span style={{ color: '#cbd5e1' }}>—</span>;
                    const today = new Date(); today.setHours(0,0,0,0);
                    const exp   = new Date(dateStr); exp.setHours(0,0,0,0);
                    const diff  = Math.floor((exp.getTime() - today.getTime()) / 86_400_000);
                    const label = exp.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
                    if (diff < 0)   return <span style={{ color: '#991b1b' }}>{label} <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#fee2e2', padding: '1px 5px', borderRadius: 3 }}>EXPIRED</span></span>;
                    if (diff <= 30) return <span style={{ color: '#b45309' }}>{label} <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#fef3c7', padding: '1px 5px', borderRadius: 3 }}>SOON</span></span>;
                    return <span>{label}</span>;
                  };

                  if (itemModalLoading) return (
                    <div>
                      {[70, 50, 80, 55].map((w, i) => (
                        <div key={i} style={{ height: 10, borderRadius: 4, marginBottom: 10, background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite linear', width: `${w}%` }} />
                      ))}
                    </div>
                  );

                  return (
                    <div>
                      {description && <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 12, lineHeight: 1.55, fontStyle: 'italic' }}>{description}</p>}
                      <InfoRow label="Qty on Hand"    value={<span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{num(qtyOnHand)}</span>} />
                      <InfoRow label="Cost Price"     value={`₱ ${unitCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} />
                      <InfoRow label="Selling Price"  value={`₱ ${sellingPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} />
                      <InfoRow label="Nearest Expiry" value={expiryNode(expiryDate)} />
                      <InfoRow label="Date Added"     value={fmtDate(dateAdded) ?? '—'} />

                      {/* Suppliers — collapsible */}
                      {itemModalSuppliers.length > 0 && (
                        <div style={{ marginTop: 14 }}>
                          <button
                            onClick={() => setItemModalSuppOpen(p => !p)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 8, cursor: 'pointer', padding: '7px 12px' }}
                          >
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                              Suppliers <span style={{ color: '#cbd5e1', fontWeight: 400 }}>({itemModalSuppliers.length})</span>
                            </span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"
                              style={{ transform: itemModalSuppOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.18s' }}>
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </button>
                          {itemModalSuppOpen && (
                            <div style={{ border: '1px solid #f1f5f9', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                              {itemModalSuppliers.map((sup, i) => (
                                <div key={i} style={{ padding: '8px 12px', borderBottom: i < itemModalSuppliers.length - 1 ? '1px solid #f8fafc' : 'none', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', margin: '0 0 2px' }}>{String(sup.supplier_name ?? '—')}</p>
                                  <p style={{ fontSize: '0.73rem', color: '#94a3b8', margin: 0 }}>
                                    {String(sup.contact_person ?? '')}
                                    {sup.contact_person && sup.contact_number ? ' · ' : ''}
                                    {String(sup.contact_number ?? '')}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── REORDER ── */}
                {tab === 'reorder' && (() => {
                  const r = row as unknown as ReorderRow;
                  const isOut = r.qty_on_hand === 0;
                  return (
                    <>
                      <Divider label="Stock Levels" />
                      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                        <Badge label={isOut ? 'Out of Stock' : 'Below Reorder Point'} bg={isOut ? '#fee2e2' : '#fef9c3'} color={isOut ? '#b91c1c' : '#854d0e'} />
                      </div>
                      <InfoRow label="Current Qty"     value={<span style={{ fontWeight: 700, color: isOut ? '#b91c1c' : '#854d0e' }}>{num(r.qty_on_hand)}</span>} />
                      <InfoRow label="Reorder Point"   value={num(r.reorder_point)} />
                      <InfoRow label="Min Order Qty"   value={num(r.min_order_qty)} />
                      <InfoRow label="Lead Time"       value={`${r.lead_time_days} days`} />
                      <InfoRow label="Suggested Order" value={<span style={{ fontWeight: 700, color: '#1a4263' }}>{num(r.suggested_order_qty)}</span>} />
                      <Divider label="Supplier" />
                      <InfoRow label="Primary Supplier" value={r.primary_supplier || '—'} />
                      <InfoRow label="Contact"          value={r.supplier_contact || '—'} />
                    </>
                  );
                })()}

              </div>

              {/* ── Footer ── */}
              <div style={{ padding: '12px 20px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                {(tab === 'product-performance' || tab === 'inventory-valuation' || tab === 'stock-ageing') && onNavigate && (
                  <button
                    onClick={() => { closeItemModal(); onNavigate('Inventory', String(row.inventory_brand_id)); }}
                    style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', color: '#1a4263' }}>
                    View in Inventory
                  </button>
                )}
                {tab === 'reorder' && onNavigate && (() => {
                  const r = row as unknown as ReorderRow;
                  const unitCost = Number(itemModalBrand?.unit_cost ?? 0);
                  return (
                    <button
                      onClick={() => {
                        closeItemModal();
                        onNavigate('Purchases', {
                          inventory_brand_id: Number(r.inventory_brand_id),
                          item_name:          r.item_name,
                          brand_name:         r.brand_name,
                          uom_name:           r.uom,
                          quantity_ordered:   r.suggested_order_qty,
                          unit_cost:          unitCost,
                        });
                      }}
                      style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#0f766e', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', color: '#fff' }}>
                      Reorder
                    </button>
                  );
                })()}
                <button onClick={closeItemModal}
                  style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: '#1a4263', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', color: '#fff' }}>
                  Close
                </button>
              </div>
            </div>
          </div>

          </>
        );
      })()}
    </>
  );
}

