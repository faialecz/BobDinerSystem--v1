/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { X, PackageCheck } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface POItem {
  po_item_id:         number;
  inventory_brand_id: number;
  item_name:          string;
  brand_name:         string;
  uom_name:           string;
  quantity_ordered:   number;
  quantity_received:  number;
  unit_cost:          number;
  expiry_date:        string | null;
  manufactured_date:  string | null;
}

interface ReceiveRow {
  po_item_id:        number;
  quantity_received: number;
  expiry_date:       string;
  manufactured_date: string;
}

interface ReceiveDeliveryModalProps {
  isOpen:            boolean;
  onClose:           () => void;
  onSaved:           () => void;
  purchaseOrderId:   number | null;
  poNumber:          string;
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: '0.7rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  color: '#6b7280', marginBottom: '3px',
};

const INPUT: React.CSSProperties = {
  width: '100%', padding: '7px 9px', borderRadius: '7px',
  border: '1px solid #e5e7eb', fontSize: '0.875rem',
  color: '#1f2937', outline: 'none', background: '#f9fafb',
  boxSizing: 'border-box',
};

const READ_ONLY: React.CSSProperties = {
  ...INPUT, background: '#f3f4f6', color: '#6b7280', cursor: 'default',
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function ReceiveDeliveryModal({
  isOpen,
  onClose,
  onSaved,
  purchaseOrderId,
  poNumber,
}: ReceiveDeliveryModalProps) {
  const [items, setItems]         = useState<POItem[]>([]);
  const [rows, setRows]           = useState<ReceiveRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');

  // ── Fetch items when modal opens ───────────────────────────────────────────

  useEffect(() => {
    if (!isOpen || !purchaseOrderId) return;
    setError('');
    fetchItems(purchaseOrderId);
  }, [isOpen, purchaseOrderId]);

  async function fetchItems(poId: number) {
    setLoading(true);
    try {
      const res  = await fetch(`/api/purchases/${poId}/items`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to load items.'); return; }
      setItems(data);
      setRows(data.map((item: POItem) => ({
        po_item_id:        item.po_item_id,
        quantity_received: item.quantity_ordered,
        expiry_date:       item.expiry_date?.split('T')[0] ?? '',
        manufactured_date: item.manufactured_date?.split('T')[0] ?? '',
      })));
    } catch {
      setError('Network error loading items.');
    } finally {
      setLoading(false);
    }
  }

  // ── Row state helpers ───────────────────────────────────────────────────────

  function updateRow(idx: number, field: keyof ReceiveRow, value: any) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleConfirm() {
    setError('');
    for (const [i, row] of rows.entries()) {
      if (!row.expiry_date)
        return setError(`Row ${i + 1} (${items[i]?.item_name}): Expiry date is required.`);
      if (row.quantity_received <= 0)
        return setError(`Row ${i + 1} (${items[i]?.item_name}): Qty received must be > 0.`);
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/purchases/${purchaseOrderId}/receive`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: rows.map(r => ({
            po_item_id:        r.po_item_id,
            quantity_received: Number(r.quantity_received),
            expiry_date:       r.expiry_date   || null,
            manufactured_date: r.manufactured_date || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to receive delivery.'); return; }
      onSaved();
      onClose();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <div style={{ background: '#fff', width: '820px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.1rem 1.5rem', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PackageCheck size={20} color="#1e3a5f" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#164163' }}>Receive Delivery</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>{poNumber}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '1.25rem 1.5rem', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: '#6b7280', fontSize: '0.9rem' }}>
              Loading items…
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Item / Brand', 'UOM', 'Qty Ordered', 'Qty Received', 'Unit Cost', 'Expiry Date', 'Mfg. Date'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {items.map((item, idx) => {
                    const row = rows[idx];
                    if (!row) return null;
                    return (
                      <tr key={item.po_item_id} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>

                        {/* Item name */}
                        <td style={{ padding: '10px 12px', minWidth: '180px' }}>
                          <p style={{ margin: 0, fontWeight: 600, color: '#1f2937' }}>{item.item_name}</p>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>{item.brand_name}</p>
                        </td>

                        {/* UOM */}
                        <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {item.uom_name}
                        </td>

                        {/* Qty Ordered — read-only */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <input
                            readOnly
                            value={item.quantity_ordered}
                            style={{ ...READ_ONLY, width: '72px', textAlign: 'center' }}
                          />
                        </td>

                        {/* Qty Received — editable */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <input
                            type="number"
                            min={1}
                            max={item.quantity_ordered}
                            value={row.quantity_received}
                            onChange={e => updateRow(idx, 'quantity_received', Number(e.target.value))}
                            style={{ ...INPUT, width: '72px', textAlign: 'center' }}
                          />
                        </td>

                        {/* Unit Cost — read-only */}
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          <input
                            readOnly
                            value={`₱${item.unit_cost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                            style={{ ...READ_ONLY, width: '110px' }}
                          />
                        </td>

                        {/* Expiry Date — required */}
                        <td style={{ padding: '10px 12px' }}>
                          <div>
                            <input
                              type="date"
                              value={row.expiry_date}
                              onChange={e => updateRow(idx, 'expiry_date', e.target.value)}
                              style={{ ...INPUT, width: '140px', borderColor: !row.expiry_date ? '#fca5a5' : '#e5e7eb' }}
                            />
                            {!row.expiry_date && (
                              <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: '#ef4444' }}>Required</p>
                            )}
                          </div>
                        </td>

                        {/* Mfg. Date — optional */}
                        <td style={{ padding: '10px 12px' }}>
                          <input
                            type="date"
                            value={row.manufactured_date}
                            onChange={e => updateRow(idx, 'manufactured_date', e.target.value)}
                            style={{ ...INPUT, width: '140px' }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <p style={{ margin: '1rem 0 0', fontSize: '0.85rem', color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px' }}>
              {error}
            </p>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '1rem 1.5rem', borderTop: '1px solid #f3f4f6' }}>
          <button
            onClick={onClose}
            style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: '0.875rem', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || loading}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 22px', borderRadius: '8px', border: 'none', background: submitting || loading ? '#93afc8' : '#1e3a5f', color: '#fff', fontSize: '0.875rem', fontWeight: 700, cursor: submitting || loading ? 'not-allowed' : 'pointer' }}
          >
            <PackageCheck size={16} />
            {submitting ? 'Processing…' : 'Confirm Receipt'}
          </button>
        </div>

      </div>
    </div>
  );
}
