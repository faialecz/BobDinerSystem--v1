/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Search } from 'lucide-react';
import { LuPlus, LuTrash2 } from 'react-icons/lu';
import styles from '@/css/inventory.module.css';

// ── Auth helper ────────────────────────────────────────────────────────────────

function authHeader(): Record<string, string> {
  const token = typeof window !== 'undefined' ? (localStorage.getItem('token') ?? '') : '';
  return { Authorization: `Bearer ${token}` };
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface PurchaseOrder {
  purchase_order_id: number;
  po_number:         string;
  supplier_name:     string;
  status:            string;
  order_date:        string | null;
  expected_delivery: string | null;
  notes:             string | null;
}

interface Supplier {
  supplier_id:   number;
  supplier_name: string;
}

interface UOM {
  uom_id:   number;
  uom_name: string;
}

interface ItemRow {
  po_item_id:         number | null;   // null = new row, number = existing row
  inventory_brand_id: number | '';
  brand_name:         string;
  item_name:          string;
  uom_name:           string;
  quantity_ordered:   number | '';
  unit_cost:          number | '';
  expiry_date:        string;
}

interface EditPOModalProps {
  purchaseOrder: PurchaseOrder | null;
  onClose:       () => void;
  onSaved:       () => void;
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  color: '#6b7280', marginBottom: '4px',
};

const FIELD: React.CSSProperties = {
  width: '100%', height: '38px', padding: '8px 12px',
  borderRadius: '6px', border: '1px solid #9ca3af',
  backgroundColor: '#fff', color: '#374151',
  fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
};

// ── Blank row factory ──────────────────────────────────────────────────────────

const BLANK = (): ItemRow => ({
  po_item_id:         null,
  inventory_brand_id: '',
  brand_name:         '',
  item_name:          '',
  uom_name:           '',
  quantity_ordered:   '',
  unit_cost:          '',
  expiry_date:        '',
});

// ── Component ──────────────────────────────────────────────────────────────────

export default function EditPOModal({ purchaseOrder, onClose, onSaved }: EditPOModalProps) {
  const s = styles as Record<string, string>;
  
  const [currentStatus, setCurrentStatus]   = useState('');
  const [suppliers, setSuppliers]           = useState<Supplier[]>([]);
  const [uoms, setUoms]                     = useState<UOM[]>([]);
  const [supplierName, setSupplierName]     = useState('');
  const [supplierId, setSupplierId]         = useState<number | ''>('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes]                   = useState('');
  const [items, setItems]                   = useState<ItemRow[]>([BLANK()]);
  const [submitting, setSubmitting]         = useState(false);
  const [loading, setLoading]               = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [error, setError]                   = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // item search
  const [searchQuery, setSearchQuery]     = useState<Record<number, string>>({});
  const [searchResults, setSearchResults] = useState<Record<number, any[]>>({});
  const [searchOpen, setSearchOpen]       = useState<Record<number, boolean>>({});
  const searchTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const justPicked   = useRef<Record<number, boolean>>({});

  const isOpen = !!purchaseOrder;

  // ── Load data when PO changes ────────────────────────────────────────────────

  useEffect(() => {
    if (!purchaseOrder) return;

    setError('');
    setSubmitAttempted(false);
    setSupplierName(purchaseOrder.supplier_name ?? '');
    setExpectedDelivery(purchaseOrder.expected_delivery?.slice(0, 10) ?? '');
    setNotes(purchaseOrder.notes ?? '');
    setSearchQuery({});
    setSearchResults({});
    setSearchOpen({});
    setCurrentStatus(purchaseOrder.status ?? '');

    // Fetch reference data + existing items in parallel
    setLoading(true);
    Promise.all([
      fetch('/api/suppliers', { headers: authHeader() }).then(r => r.ok ? r.json() : []),
      fetch('/api/uom',       { headers: authHeader() }).then(r => r.ok ? r.json() : []),
      fetch(`/api/purchases/${purchaseOrder.purchase_order_id}/items`, { headers: authHeader() }).then(r => r.ok ? r.json() : []),
    ]).then(([sups, uomData, existingItems]) => {
      const activeSups: Supplier[] = (sups as any[]).filter((s: any) => !s.is_archived);
      setSuppliers(activeSups);

      // Resolve supplier_id from name
      const found = activeSups.find((s: any) => s.supplier_name === purchaseOrder.supplier_name);
      setSupplierId(found ? found.supplier_id : '');

      setUoms((uomData as any[]).map((u: any) => ({
        uom_id:   u.uom_id   ?? u.id,
        uom_name: u.uom_name ?? u.name,
      })));

      if (Array.isArray(existingItems) && existingItems.length > 0) {
        const rows: ItemRow[] = existingItems.map((it: any) => ({
          po_item_id:         it.po_item_id ?? null,
          inventory_brand_id: it.inventory_brand_id,
          brand_name:         it.brand_name,
          item_name:          it.item_name,
          uom_name:           it.uom_name ?? '',
          quantity_ordered:   it.quantity_ordered,
          unit_cost:          it.unit_cost,
          expiry_date:        it.expiry_date?.slice(0, 10) ?? '',
        }));
        setItems(rows);
        // Build search query display for each pre-populated row
        const sq: Record<number, string> = {};
        rows.forEach((r, i) => {
          sq[i] = `${r.item_name} — ${r.brand_name} (${r.uom_name})`;
        });
        setSearchQuery(sq);
      } else {
        setItems([BLANK()]);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [purchaseOrder]);

  // ── Item search ──────────────────────────────────────────────────────────────

  function handleSearchChange(idx: number, value: string) {
    if (justPicked.current[idx]) { justPicked.current[idx] = false; return; }
    setSearchQuery(prev => ({ ...prev, [idx]: value }));
    setSearchOpen(prev  => ({ ...prev, [idx]: true  }));
    clearTimeout(searchTimers.current[idx]);
    if (!value.trim()) { setSearchResults(prev => ({ ...prev, [idx]: [] })); return; }
    searchTimers.current[idx] = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/inventory/search?q=${encodeURIComponent(value)}`, { headers: authHeader() });
        const data = await res.json();
        if (res.ok) setSearchResults(prev => ({ ...prev, [idx]: data }));
      } catch { /* silent */ }
    }, 300);
  }

  function handleItemSelect(idx: number, result: any) {
    justPicked.current[idx] = true;
    setSearchQuery(prev => ({ ...prev, [idx]: `${result.item_name} — ${result.brand_name} (${result.uom_name})` }));
    setSearchOpen(prev  => ({ ...prev, [idx]: false }));
    setItems(prev => prev.map((row, i) => i !== idx ? row : {
      ...row,
      inventory_brand_id: result.inventory_brand_id,
      brand_name:         result.brand_name,
      item_name:          result.item_name,
      uom_name:           result.uom_name,
      unit_cost:          result.item_selling_price ?? '',
    }));
  }

  // ── Row mutations ────────────────────────────────────────────────────────────

  function addRow() { setItems(prev => [...prev, BLANK()]); }

  function removeRow(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
    setSearchQuery(prev  => { const n = { ...prev };  delete n[idx]; return n; });
    setSearchResults(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setSearchOpen(prev   => { const n = { ...prev };  delete n[idx]; return n; });
  }

  function updateRow(idx: number, field: keyof ItemRow, value: any) {
    setItems(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  }

  // ── Supplier select ──────────────────────────────────────────────────────────

  function handleSupplierChange(name: string) {
    setSupplierName(name);
    const found = suppliers.find(s => s.supplier_name === name);
    setSupplierId(found ? found.supplier_id : '');
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setError('');
    setSubmitAttempted(true);
    if (!supplierId)        return setError('Please select a supplier.');
    if (!expectedDelivery)  return setError('Please set an expected delivery date.');
    if (!items.length)      return setError('Add at least one item.');

    for (const [i, row] of items.entries()) {
      if (!row.inventory_brand_id)                                    return setError(`Row ${i + 1}: select an item.`);
      if (!row.quantity_ordered || Number(row.quantity_ordered) <= 0) return setError(`Row ${i + 1}: quantity must be > 0.`);
      if (!row.unit_cost        || Number(row.unit_cost)        <= 0) return setError(`Row ${i + 1}: unit cost must be > 0.`);
    }

    setSubmitting(true);
    try {
      // ── Update status if changed ──
      // ── Update status if changed ──
if (currentStatus !== purchaseOrder!.status) {
  const statusRes = await fetch(`/api/purchases/${purchaseOrder!.purchase_order_id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ status: currentStatus }),
  });
  const statusData = await statusRes.json();
  if (!statusRes.ok) { setError(statusData.error ?? 'Failed to update status.'); setSubmitting(false); return; }
}

const res = await fetch(`/api/purchases/${purchaseOrder!.purchase_order_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          supplier_id:       supplierId,
          expected_delivery: expectedDelivery,
          notes:             notes.trim() || null,
          items: items.map(r => ({
            po_item_id:         r.po_item_id ?? undefined,
            inventory_brand_id: r.inventory_brand_id,
            quantity_ordered:   Number(r.quantity_ordered),
            unit_cost:          Number(r.unit_cost),
            expiry_date:        r.expiry_date || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to update PO.'); return; }
      onSaved();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const supplierHasError = () => submitAttempted && !supplierId;
  const deliveryHasError = () => submitAttempted && !expectedDelivery;
  const rowQtyHasError   = (idx: number) => submitAttempted && (!items[idx]?.quantity_ordered || Number(items[idx]?.quantity_ordered) <= 0);
  const rowCostHasError  = (idx: number) => submitAttempted && (!items[idx]?.unit_cost || Number(items[idx]?.unit_cost) <= 0);

  const handleCancelClick = () => {
  if (supplierName || expectedDelivery || notes || items.some(r => r.inventory_brand_id)) {
    setShowCancelConfirm(true);
  } else {
    onClose();
  }
};

  if (!isOpen) return null;

  const totalCost = items.reduce((sum, r) =>
    sum + (Number(r.quantity_ordered) || 0) * (Number(r.unit_cost) || 0), 0);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={s.modalOverlay} style={{ zIndex: 3000 }}>
      <div className={s.modalContent} style={{
        width: '940px', maxWidth: '95vw', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column', padding: 0,
        borderRadius: '12px', overflow: 'hidden',
      }}>

        {/* Header */}
        <div className={s.modalHeader} style={{
          padding: '20px 24px', backgroundColor: '#fff',
          borderBottom: '1px solid #eaeaea', flexShrink: 0,
        }}>
          <div className={s.modalTitleGroup}>
            <h2 className={s.title} style={{ fontSize: '1.2rem', marginBottom: '2px' }}>
              Edit Purchase Order
            </h2>
            <p className={s.subText}>{purchaseOrder.po_number}</p>
          </div>
          <button
            onClick={handleCancelClick}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px', display: 'flex' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f9fafb', minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
              Loading…
            </div>
          ) : (
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* ── ITEMS CARD ── */}
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>Items *</span>
                  <button
                    onClick={addRow}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    <LuPlus size={14} /> Add Row
                  </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      {['Item / Brand', 'UOM', 'Qty Ordered', 'Unit Cost (₱)', 'Expiry Date', 'Subtotal', ''].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>

                        {/* Item search */}
                        <td style={{ padding: '8px 10px', minWidth: '220px' }}>
                          {row.inventory_brand_id ? (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              background: '#eff6ff', border: '1px solid #bfdbfe',
                              borderRadius: '6px', padding: '4px 10px',
                            }}>
                              <span style={{ fontSize: '0.875rem', color: '#1e40af', fontWeight: 500, flex: 1 }}>
                                {row.item_name}
                                <span style={{ color: '#6b7280', fontWeight: 400 }}> — {row.brand_name}</span>
                              </span>
                              <button
                                type="button"
                                onMouseDown={() => {
                                  setItems(prev => prev.map((r, i) => i !== idx ? r : BLANK()));
                                  setSearchQuery(prev => ({ ...prev, [idx]: '' }));
                                  setSearchResults(prev => ({ ...prev, [idx]: [] }));
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '0 2px', display: 'flex', lineHeight: 1 }}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ position: 'relative' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f9fafb', border: '1px solid #9ca3af', borderRadius: '6px', padding: '0 8px' }}>
                                <Search size={13} color="#9ca3af" style={{ flexShrink: 0 }} />
                                <input
                                  type="text"
                                  placeholder="Search item..."
                                  value={searchQuery[idx] ?? ''}
                                  onChange={e => handleSearchChange(idx, e.target.value)}
                                  onFocus={() => setSearchOpen(prev => ({ ...prev, [idx]: true }))}
                                  onBlur={() => setTimeout(() => setSearchOpen(prev => ({ ...prev, [idx]: false })), 160)}
                                  style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.875rem', padding: '6px 0', width: '100%', color: '#374151' }}
                                />
                              </div>
                              {searchOpen[idx] && searchQuery[idx]?.trim() && (
                                <div style={{
                                  position: 'absolute', top: 'calc(100% + 4px)', left: 0,
                                  minWidth: '400px', background: '#fff', border: '1px solid #e5e7eb',
                                  borderRadius: '8px', boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                                  zIndex: 9999, maxHeight: '200px', overflowY: 'auto',
                                }}>
                                  {(() => {
                                    const pickedIds = new Set(items.map(r => r.inventory_brand_id).filter(Boolean));
                                    const filtered  = (searchResults[idx] ?? []).filter((r: any) => !pickedIds.has(r.inventory_brand_id));
                                    return filtered.length > 0 ? filtered.map((r: any) => (
                                      <button
                                        key={r.inventory_brand_id}
                                        onMouseDown={() => handleItemSelect(idx, r)}
                                        style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                                      >
                                        <div>
                                          <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>
                                            {r.item_name} — {r.brand_name} ({r.uom_name})
                                          </div>
                                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                            Desc: {r.description || 'No description'}
                                          </div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '12px' }}>
                                          <div style={{ fontWeight: 700, color: '#059669', fontSize: '0.9rem' }}>
                                            ₱{Number(r.item_selling_price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                          </div>
                                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Stock: {r.stock_quantity ?? 0}</div>
                                        </div>
                                      </button>
                                    )) : (
                                      <div style={{ padding: '10px 12px', fontSize: '0.82rem', color: '#9ca3af', fontStyle: 'italic' }}>
                                        No items found.
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* UOM */}
                        <td style={{ padding: '8px 10px', minWidth: '110px' }}>
                          <select
                            value={row.uom_name}
                            onChange={e => updateRow(idx, 'uom_name', e.target.value)}
                            style={{ ...FIELD, height: '34px', padding: '4px 8px', fontSize: '0.875rem' }}
                          >
                            <option value=""> UOM </option>
                            {uoms.map(u => (
                              <option key={u.uom_id} value={u.uom_name}>{u.uom_name}</option>
                            ))}
                          </select>
                        </td>

                        {/* Qty */}
                        <td style={{ padding: '8px 10px', width: '100px' }}>
                          <input
                            type="number" min={1} placeholder="0"
                            value={row.quantity_ordered}
                            onChange={e => updateRow(idx, 'quantity_ordered', e.target.value === '' ? '' : Number(e.target.value))}
                            style={{ ...FIELD, 
                              height: '34px', 
                              padding: '4px 8px', 
                              fontSize: '0.875rem', 
                              textAlign: 'center', ...(rowQtyHasError(idx) ? { border: '1px solid #f87171' } : {}) }}
                          />
                        </td>

                        {/* Unit Cost */}
                        <td style={{ padding: '8px 10px', width: '120px' }}>
                          <input
                            type="number" min={0} step="0.01" placeholder="0.00"
                            value={row.unit_cost}
                            onChange={e => updateRow(idx, 'unit_cost', e.target.value === '' ? '' : Number(e.target.value))}
                            style={{ ...FIELD, 
                              height: '34px', 
                              padding: '4px 8px', 
                              fontSize: '0.875rem', 
                              textAlign: 'center', ...(rowCostHasError(idx) ? { border: '1px solid #f87171' } : {}) }}
                          />
                        </td>

                        {/* Expiry */}
                        <td style={{ padding: '8px 10px', width: '140px' }}>
                          <input
                            type="date"
                            value={row.expiry_date}
                            onChange={e => updateRow(idx, 'expiry_date', e.target.value)}
                            style={{ ...FIELD, height: '34px', padding: '4px 8px', fontSize: '0.875rem' }}
                          />
                        </td>

                        {/* Subtotal */}
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', textAlign: 'right' }}>
                          ₱{((Number(row.quantity_ordered) || 0) * (Number(row.unit_cost) || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Remove */}
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <button
                            onClick={() => removeRow(idx)}
                            disabled={items.length === 1}
                            style={{ background: 'none', border: 'none', cursor: items.length === 1 ? 'not-allowed' : 'pointer', color: items.length === 1 ? '#d1d5db' : '#ef4444', padding: '4px', display: 'flex' }}
                          >
                            <LuTrash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                      <td colSpan={5} style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontSize: '0.875rem', color: '#374151' }}>
                        Total Cost
                      </td>
                      <td style={{ padding: '10px', fontWeight: 700, fontSize: '0.95rem', color: '#164163', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        ₱{totalCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* ── SUPPLIER & DELIVERY CARD ── */}
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '20px' }}>
                <h4 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 600, color: '#333', borderBottom: '1px solid #f3f4f6', paddingBottom: '10px' }}>
                  Supplier &amp; Delivery
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={LABEL}>Status</label>
                <select value={currentStatus} onChange={e => setCurrentStatus(e.target.value)} style={FIELD}>
                  {[
                    purchaseOrder!.status,
                    ...(({
                      DRAFT:    ['SENT', 'CANCELLED'],
                      SENT:     ['APPROVED', 'CANCELLED'],
                      APPROVED: ['COMPLETED', 'CANCELLED'],
                    } as Record<string, string[]>)[purchaseOrder!.status] ?? [])
                  ].map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
                </div>
                <div>
                  <label style={LABEL}>Supplier *</label>
                    <select
                    value={supplierName}
                    onChange={e => handleSupplierChange(e.target.value)}
                    style={{ ...FIELD, ...(supplierHasError() ? { border: '1px solid #f87171', backgroundColor: '#fff5f5' } : {}) }}
                    >
                    <option value="">Select Supplier</option>
                    {suppliers.map(sup => (
                      <option key={sup.supplier_id} value={sup.supplier_name}>
                        {sup.supplier_name}
                      </option>
                    ))}
                    </select>
                    {supplierHasError() && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Please select a supplier.</p>
                    )}
                  </div>

                  <div>
                    <input
                    type="date"
                    value={expectedDelivery}
                    onChange={e => setExpectedDelivery(e.target.value)}
                    style={{ ...FIELD, ...(deliveryHasError() ? { border: '1px solid #f87171', backgroundColor: '#fff5f5' } : {}) }}
                  />
                  {deliveryHasError() && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Expected delivery date is required.</p>
                  )}
                </div>
                </div>

                <div style={{ marginTop: '14px' }}>
                  <label style={LABEL}>Notes</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional notes..."
                    style={{ ...FIELD, height: 'auto', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500 }}>
                  <span>⚠</span> {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={s.modalFooter} style={{ padding: '16px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', flexShrink: 0 }}>
          <button type="button" onClick={handleCancelClick} className={s.cancelBtn}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || loading}
            className={s.saveBtn}
            style={{ opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
          >
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {showCancelConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }}
          onClick={() => setShowCancelConfirm(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: '16px', padding: '32px 28px', width: '360px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Discard Changes?</p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 24px' }}>All entered information will be lost.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowCancelConfirm(false)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', color: '#374151' }}
              >
                Keep Editing
              </button>
              <button
                onClick={() => { setShowCancelConfirm(false); onClose(); }}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#ef4444', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', color: '#fff' }}
              >
                Yes, Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}