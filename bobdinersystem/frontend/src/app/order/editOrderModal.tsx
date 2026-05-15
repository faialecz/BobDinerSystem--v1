/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from 'react';
import styles from "@/css/order.module.css";
import { LuX, LuPlus, LuTrash2, LuSearch } from "react-icons/lu";
import Modal from '@/components/ui/Modal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ingredient {
  ingredient_brand_id: number;
  ingredient_name: string;
}

interface Modification {
  ingredient_brand_id: number;
  action_code: 'REMOVED';
}

interface OrderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: any;
  onSave: (updatedOrder: any) => void;
  statuses?: any[];
  paymentMethods?: any[];
  inventoryItems?: any[];
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  color: '#6b7280', marginBottom: '4px',
};

const FIELD_ERROR_STYLE: React.CSSProperties = {
  border: '1px solid #f87171',
  backgroundColor: '#fff5f5',
};

// ─── Component ────────────────────────────────────────────────────────────────

const OrderEditModal = ({
  isOpen, onClose, orderData, onSave,
  statuses = [], paymentMethods = [],
}: OrderEditModalProps) => {
  const s = styles as Record<string, string>;
  const [formData, setFormData]           = useState<any>(null);
  const [originalData, setOriginalData]   = useState<any>(null);
  const [submitError, setSubmitError]     = useState('');
  const [isConfirmEditOpen, setIsConfirmEditOpen] = useState(false);
  const [submitAttempted, setSubmitAttempted]     = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<Record<number, any[]>>({});
  const [searchLoading, setSearchLoading] = useState<Record<number, boolean>>({});
  const searchTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const justSelected = useRef<Record<number, boolean>>({});

  // ─── Initialise from orderData ──────────────────────────────────────────

  useEffect(() => {
    if (orderData) {
      const initialItems = orderData.items && orderData.items.length > 0
        ? orderData.items.map((i: any) => {
            const qty    = Number(i.order_quantity) || 1;
            const amount = Number(i.amount) || 0;
            return {
              menu_item_id:       i.menu_item_id ?? null,
              inventory_brand_id: i.inventory_brand_id || i.inventory_id || '',
              inventory_id:       i.inventory_id,
              item:               i.menu_item_name || i.item_name || '',
              itemDescription:    i.item_description || '—',
              quantity:           i.order_quantity || '',
              amount,
              price:              qty > 0 ? amount / qty : 0,
              notes:              i.notes || '',
              modifications:      Array.isArray(i.modifications) ? i.modifications : [],
              ingredients:        Array.isArray(i.ingredients)   ? i.ingredients   : [],
              ingredientsLoading: false,
            };
          })
        : [{
            menu_item_id: null, inventory_brand_id: '', inventory_id: '',
            item: '', itemDescription: '—',
            quantity: '1', amount: 0, price: 0, notes: '',
            modifications: [], ingredients: [], ingredientsLoading: false,
          }];

      const built = {
        id:                 orderData.id,
        customerName:       orderData.name || orderData.customer,
        contact:            orderData.contact || '',
        status:             orderData.status || 'Preparing',
        payment_status_id:  orderData.payment_status_id || 30,
        amount_paid:        orderData.amount_paid || 0,
        deposit_date:       orderData.deposit_date || '',
        final_payment_date: orderData.final_payment_date || '',
        paymentMethod:      orderData.paymentMethod || 'Cash',
        items:              initialItems,
      };

      setFormData(built);
      setOriginalData(JSON.parse(JSON.stringify(built)));
      setSubmitError('');
      setSubmitAttempted(false);
      setShowCancelConfirm(false);
    }
  }, [orderData]);

  const hasChanges = () => {
    if (!formData || !originalData) return false;
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  };

  const handleCancelClick = () => {
    if (hasChanges()) setShowCancelConfirm(true);
    else onClose();
  };

  // ─── Inventory search ─────────────────────────────────────────────────────

  const fetchSearchResults = async (index: number, q: string) => {
    console.log('[menu search] starting fetch, q=', JSON.stringify(q));
    setSearchLoading(prev => ({ ...prev, [index]: true }));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('[menu search] TIMEOUT — aborting fetch after 8s');
      controller.abort();
    }, 8000);
    try {
      const res = await fetch(`/api/orders/menu?q=${encodeURIComponent(q)}`, { signal: controller.signal });
      console.log('[menu search] response status:', res.status);
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('[menu search] HTTP error:', res.status, res.statusText, errText);
        setSearchResults(prev => ({ ...prev, [index]: [] }));
        return;
      }
      const data = await res.json();
      console.log('[menu search] API response:', data);
      setSearchResults(prev => ({ ...prev, [index]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error('[menu search] fetch error:', err);
      setSearchResults(prev => ({ ...prev, [index]: [] }));
    } finally {
      clearTimeout(timeoutId);
      console.log('[menu search] finally — clearing loading state');
      setSearchLoading(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleSearchFocus = (index: number) => {
    setActiveSearchIndex(index);
    const currentItem = (formData?.items || [])[index];
    if (currentItem?.menu_item_id) {
      fetchSearchResults(index, '');
    } else if (!currentItem?.item?.trim() && !(searchResults[index] || []).length) {
      fetchSearchResults(index, '');
    }
  };

  const handleItemTextChange = (index: number, text: string) => {
    if (justSelected.current[index]) { justSelected.current[index] = false; return; }
    const newItems = [...(formData.items || [])];
    newItems[index] = {
      ...newItems[index],
      item: text, menu_item_id: null, inventory_brand_id: '',
      itemDescription: '—',
      price: 0, amount: 0,
      modifications: [], ingredients: [],
    };
    setFormData({ ...formData, items: newItems });

    clearTimeout(searchTimers.current[index]);
    if (text.trim().length >= 2) {
      searchTimers.current[index] = setTimeout(() => fetchSearchResults(index, text.trim()), 300);
    } else if (text.trim().length === 0) {
      fetchSearchResults(index, '');
    } else {
      setSearchResults(prev => ({ ...prev, [index]: [] }));
      setSearchLoading(prev => ({ ...prev, [index]: false }));
    }
  };

  // ─── Ingredient recipe fetch ───────────────────────────────────────────────

  const fetchIngredients = async (itemIndex: number, inventoryBrandId: string | number) => {
    setFormData((prev: any) => {
      const newItems = [...(prev.items || [])];
      if (newItems[itemIndex]) {
        newItems[itemIndex] = { ...newItems[itemIndex], ingredientsLoading: true };
      }
      return { ...prev, items: newItems };
    });
    try {
      // TODO: Replace with your actual recipe/BOM endpoint.
      // Suggested endpoint: GET /api/inventory/<inventory_brand_id>/ingredients
      // Expected response: [{ ingredient_brand_id: number, ingredient_name: string }, ...]
      const res = await fetch(`/api/inventory/${inventoryBrandId}/ingredients`);
      const data = res.ok ? await res.json() : [];
      setFormData((prev: any) => {
        const newItems = [...(prev.items || [])];
        if (newItems[itemIndex]) {
          newItems[itemIndex] = {
            ...newItems[itemIndex],
            ingredients: Array.isArray(data) ? data : [],
            ingredientsLoading: false,
          };
        }
        return { ...prev, items: newItems };
      });
    } catch {
      setFormData((prev: any) => {
        const newItems = [...(prev.items || [])];
        if (newItems[itemIndex]) {
          newItems[itemIndex] = { ...newItems[itemIndex], ingredients: [], ingredientsLoading: false };
        }
        return { ...prev, items: newItems };
      });
    }
  };

  // ─── Item selection ───────────────────────────────────────────────────────

  const handleItemSelect = (index: number, entry: any) => {
    justSelected.current[index] = true;
    const incomingMenuId = entry.menu_item_id;
    const safeItems      = formData?.items || [];

    const willMerge = safeItems.some(
      (item: any, i: number) => i !== index && item.menu_item_id === incomingMenuId
    );

    setFormData((prev: any) => {
      const prevItems = prev.items || [];
      const newItems  = [...prevItems];
      const existingIndex = newItems.findIndex(
        (item: any, i: number) => i !== index && item.menu_item_id === incomingMenuId
      );

      if (existingIndex !== -1) {
        const addedQty  = Number(newItems[index].quantity) || 1;
        const mergedQty = (Number(newItems[existingIndex].quantity) || 0) + addedQty;
        const price     = newItems[existingIndex].price || 0;
        newItems[existingIndex] = { ...newItems[existingIndex], quantity: mergedQty, amount: mergedQty * price };
        return { ...prev, items: newItems.filter((_: any, i: number) => i !== index) };
      }

      const currentQty = Number(newItems[index].quantity) || 1;
      const price      = entry.base_price ?? 0;
      newItems[index] = {
        ...newItems[index],
        menu_item_id:       entry.menu_item_id,
        inventory_brand_id: entry.inventory_brand_id,
        item:               entry.menu_item_name,
        itemDescription:    entry.description || '—',
        price,
        quantity:           currentQty,
        amount:             currentQty * price,
        modifications:      [],
        ingredients:        [],
      };
      return { ...prev, items: newItems };
    });

    setActiveSearchIndex(null);
    setSearchResults(prev => ({ ...prev, [index]: [] }));

    if (!willMerge && entry.inventory_brand_id != null) {
      fetchIngredients(index, entry.inventory_brand_id);
    }
  };

  // ─── Other item field handlers ────────────────────────────────────────────

  const handleQtyChange = (index: number, newQty: string) => {
    const newItems = [...(formData.items || [])];
    const qtyNum = Number(newQty) || 0;
    const price  = newItems[index].price ||
      (Number(newItems[index].amount) / (Number(newItems[index].quantity) || 1)) || 0;
    newItems[index] = { ...newItems[index], quantity: newQty, amount: price * qtyNum };
    setFormData({ ...formData, items: newItems });
  };

  const handleAddItem = () => {
    const safeItems = formData.items || [];
    setFormData({
      ...formData,
      items: [
        ...safeItems,
        {
          inventory_brand_id: '', menu_item_id: null, inventory_id: '',
          item: '', itemDescription: '—',
          quantity: '1', amount: 0, price: 0, notes: '',
          modifications: [], ingredients: [], ingredientsLoading: false,
        },
      ],
    });
  };

  const handleRemoveItem = (index: number) => {
    const safeItems = formData.items || [];
    if (safeItems.length > 1) {
      setFormData({ ...formData, items: safeItems.filter((_: any, i: number) => i !== index) });
    }
  };

  // ─── Ingredient customization ─────────────────────────────────────────────

  const handleToggleIngredient = (itemIndex: number, ingredientBrandId: number) => {
    setFormData((prev: any) => {
      const newItems = [...(prev.items || [])];
      const item = newItems[itemIndex];
      const alreadyRemoved = item.modifications.some(
        (m: Modification) => m.ingredient_brand_id === ingredientBrandId && m.action_code === 'REMOVED'
      );
      newItems[itemIndex] = {
        ...item,
        modifications: alreadyRemoved
          ? item.modifications.filter((m: Modification) => m.ingredient_brand_id !== ingredientBrandId)
          : [...item.modifications, { ingredient_brand_id: ingredientBrandId, action_code: 'REMOVED' }],
      };
      return { ...prev, items: newItems };
    });
  };

  // ─── Payment handlers ─────────────────────────────────────────────────────

  const handleAmountPaidChange = (newAmountPaid: number) => {
    let newPaymentStatusId = 30;
    let newDepositDate     = formData.deposit_date;
    if (newAmountPaid === 0) {
      newPaymentStatusId = 30;
    } else if (newAmountPaid > 0 && newAmountPaid < totalAmt) {
      newPaymentStatusId = 31;
      if (!newDepositDate) newDepositDate = new Date().toISOString().split('T')[0];
    } else if (newAmountPaid >= totalAmt) {
      newPaymentStatusId = 29;
    }
    setFormData({ ...formData, amount_paid: newAmountPaid, payment_status_id: newPaymentStatusId, deposit_date: newDepositDate });
  };

  const handlePaymentStatusChange = (newStatusId: number) => {
    if (newStatusId === 30) {
      setFormData({ ...formData, payment_status_id: newStatusId, amount_paid: 0 });
    } else if (newStatusId === 29) {
      setFormData({ ...formData, payment_status_id: newStatusId, amount_paid: totalAmt, final_payment_date: new Date().toISOString().split('T')[0], deposit_date: '' });
    } else {
      setFormData({ ...formData, payment_status_id: newStatusId });
    }
  };

  // ─── Guard ────────────────────────────────────────────────────────────────

  if (!isOpen || !formData) return null;

  const safeItems    = formData.items || [];
  const safeStatus   = formData.status || 'Preparing';
  const safePayment  = formData.paymentMethod || 'Cash';
  const isLocked     = ['received', 'cancelled'].includes(originalData?.status?.trim().toLowerCase() ?? '');
  const canCancel    = !['PACKED', 'SHIPPING', 'RECEIVED'].includes(originalData?.status?.trim().toUpperCase() ?? '');
  const isPastPreparing = ['PACKED', 'SHIPPING', 'RECEIVED'].includes(originalData?.status?.trim().toUpperCase() ?? '');
  const isPreparing  = safeStatus.trim().toLowerCase() === 'preparing';
  const totalQty     = safeItems.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);
  const totalAmt     = safeItems.reduce((sum: number, it: any) => sum + (Number(it.amount) || 0), 0);
  const hasInvalidQuantities = false; // stock validation handled server-side via BOM/FIFO

  const customerNameHasError = () => submitAttempted && !formData.customerName?.trim();
  const contactHasError      = () => submitAttempted && !formData.contact?.trim();

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    setSubmitAttempted(true);
    setSubmitError('');
    if (!formData.customerName?.trim()) { setSubmitError('Customer name is required.'); return; }
    if (!formData.contact?.trim())      { setSubmitError('Contact number is required.'); return; }
    if (!hasChanges()) { setSubmitError('No changes detected. Please modify at least one field before updating.'); return; }
    setSubmitError('');
    setIsConfirmEditOpen(true);
  };

  const handleConfirmSave = () => {
    const payload = {
      ...formData,
      items: safeItems.map((it: any) => ({
        inventory_brand_id: it.inventory_brand_id,
        menu_item_id:       it.menu_item_id ?? null,
        quantity:           it.quantity,
        amount:             it.amount,
        unit_price:         it.price || 0,
        notes:              it.notes || '',
        modifications:      it.modifications || [],
      })),
      totalQty,
      totalAmt,
    };
    onSave(payload);
  };

  return (
    <div className={s.modalOverlay} style={{ zIndex: 1100 }}>
      <div
        className={s.modalContent}
        style={{ width: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}
      >

        {/* HEADER */}
        <div
          className={s.modalHeader}
          style={{ padding: '20px 24px', borderBottom: '1px solid #eaeaea', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <div className={s.modalTitleGroup}>
            <h2 className={s.title} style={{ fontSize: '1.25rem', margin: '0 0 4px 0' }}>Edit Order Details</h2>
            <p className={s.subText} style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
              Update customer information, items, and fulfillment status.
            </p>
          </div>
          <LuX onClick={handleCancelClick} className={s.closeIcon} style={{ cursor: 'pointer', color: '#666', fontSize: '1.5rem' }} />
        </div>

        {/* SCROLLABLE BODY */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#f9fafb' }}>

          {/* Summary bar */}
          <div style={{ backgroundColor: '#eff6ff', padding: '15px 20px', borderRadius: '8px', marginBottom: '24px', border: '1px solid #dbeafe', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Order ID</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e40af' }}>{formData.id}</span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Items</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e40af' }}>{totalQty}</span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Amount</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e40af' }}>₱{totalAmt.toLocaleString()}</span>
            </div>
          </div>

          {/* Customer Details */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Customer Details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className={s.formGroup}>
                <label style={{ ...LABEL_STYLE, color: customerNameHasError() ? '#dc2626' : '#6b7280' }}>
                  Customer Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  className={s.cleanInput}
                  style={customerNameHasError() ? FIELD_ERROR_STYLE : {}}
                  value={formData.customerName || ''}
                  disabled={isLocked}
                  onChange={(e) => { setSubmitError(''); setFormData({ ...formData, customerName: e.target.value }); }}
                />
                {customerNameHasError() && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Customer name is required.</p>
                )}
              </div>
              <div className={s.formGroup}>
                <label style={{ ...LABEL_STYLE, color: contactHasError() ? '#dc2626' : '#6b7280' }}>
                  Contact Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  className={s.cleanInput}
                  style={contactHasError() ? FIELD_ERROR_STYLE : {}}
                  value={formData.contact || ''}
                  disabled={isLocked}
                  onChange={(e) => { setSubmitError(''); setFormData({ ...formData, contact: e.target.value }); }}
                />
                {contactHasError() && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Contact number is required.</p>
                )}
              </div>
            </div>
          </div>

          {/* Fulfillment & Payment */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Fulfillment & Payment</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              <div className={s.formGroup}>
                <label style={{ ...LABEL_STYLE }}>Status</label>
                <select
                  className={s.cleanInput}
                  value={safeStatus.trim()}
                  disabled={isLocked}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  {statuses.length === 0 && <option value={safeStatus.trim()}>{safeStatus.trim()}</option>}
                  {statuses.map((st: any) => {
                    const name  = st.status_name.trim();
                    const upper = name.toUpperCase();
                    if (upper === 'CANCELLED' && !canCancel)      return null;
                    if (upper === 'PREPARING' && isPastPreparing) return null;
                    return <option key={st.status_id} value={name}>{name}</option>;
                  })}
                </select>
              </div>
              <div className={s.formGroup}>
                <label style={{ ...LABEL_STYLE }}>Payment Method</label>
                <select
                  className={s.cleanInput}
                  value={safePayment.trim()}
                  disabled={isLocked}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                >
                  {paymentMethods.length === 0 && <option value={safePayment.trim()}>{safePayment.trim()}</option>}
                  {paymentMethods.map((pm: any) => (
                    <option key={pm.status_id} value={pm.status_name.trim()}>{pm.status_name.trim()}</option>
                  ))}
                </select>
              </div>
              <div className={s.formGroup}>
                <label style={{ ...LABEL_STYLE }}>Payment Status</label>
                <select
                  className={s.cleanInput}
                  value={formData.payment_status_id || 30}
                  disabled={isLocked}
                  onChange={(e) => handlePaymentStatusChange(Number(e.target.value))}
                >
                  <option value={29}>Paid</option>
                  <option value={30}>Unpaid</option>
                  <option value={31}>Partial</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: (formData.payment_status_id === 31 || formData.payment_status_id === 29) ? '1fr 1fr' : '1fr', gap: '15px', marginTop: '15px' }}>
              <div className={s.formGroup}>
                <label style={{ ...LABEL_STYLE }}>Amount Paid (₱)</label>
                <input
                  type="number" className={s.cleanInput}
                  value={formData.amount_paid || ''} min="0"
                  disabled={isLocked || formData.payment_status_id === 29}
                  onChange={(e) => handleAmountPaidChange(Number(e.target.value) || 0)}
                  placeholder="0"
                  style={{
                    height: '38px', padding: '8px 12px', fontSize: '0.9rem',
                    borderColor:       formData.payment_status_id === 29 ? '#16a34a' : undefined,
                    backgroundColor:   formData.payment_status_id === 29 ? '#f0fdf4' : undefined,
                    fontWeight:        formData.payment_status_id === 29 ? 600       : undefined,
                  }}
                />
              </div>
              {formData.payment_status_id === 31 && (
                <div className={s.formGroup}>
                  <label style={{ ...LABEL_STYLE }}>Deposit Date</label>
                  <input type="date" className={s.cleanInput} value={formData.deposit_date || ''} disabled={isLocked}
                    onChange={(e) => setFormData({ ...formData, deposit_date: e.target.value })}
                    style={{ height: '38px', padding: '8px 12px', fontSize: '0.9rem' }}
                  />
                </div>
              )}
              {formData.payment_status_id === 29 && (
                <div className={s.formGroup}>
                  <label style={{ ...LABEL_STYLE }}>Final Payment Date</label>
                  <input type="date" className={s.cleanInput} value={formData.final_payment_date || ''} disabled={isLocked}
                    onChange={(e) => setFormData({ ...formData, final_payment_date: e.target.value })}
                    style={{ height: '38px', padding: '8px 12px', fontSize: '0.9rem' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Order Items</h4>

            {safeItems.map((item: any, index: number) => (
              <div
                key={index}
                style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: index < safeItems.length - 1 ? '1px dashed #e5e7eb' : 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>Item {index + 1}</span>
                  {isPreparing && safeItems.length > 1 && (
                    <button
                      type="button" onClick={() => handleRemoveItem(index)}
                      style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                    >
                      <LuTrash2 size={14} /> Remove
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 0.6fr 1fr', gap: '10px' }}>

                  {/* Item Name */}
                  <div className={s.formGroup} style={{ position: 'relative', minWidth: 0 }}>
                    <label style={{ ...LABEL_STYLE, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Item Name <span style={{ color: '#ef4444' }}>*</span></span>
                      <LuSearch size={12} color="#94a3b8" />
                    </label>
                    <input
                      type="text" className={s.cleanInput}
                      value={item.item || ''}
                      onChange={(e) => handleItemTextChange(index, e.target.value)}
                      onFocus={() => handleSearchFocus(index)}
                      onBlur={() => setTimeout(() => { if (activeSearchIndex === index) setActiveSearchIndex(null); }, 200)}
                      disabled={!isPreparing}
                      placeholder="Search items..."
                      autoComplete="off"
                      style={{
                        height: '38px', padding: '8px 12px', fontSize: '0.9rem',
                        border: (!item.menu_item_id && item.item?.length > 0) ? '1px solid #f87171' : '1px solid #d1d5db',
                        backgroundColor: (!item.menu_item_id && item.item?.length > 0) ? '#fff5f5' : '#fff',
                      }}
                    />
                    {activeSearchIndex === index && isPreparing && !item.menu_item_id && (item.item?.trim().length >= 2 || (searchResults[index] || []).length > 0 || searchLoading[index]) && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '250px', overflowY: 'auto', marginTop: '4px' }}>
                        {searchLoading[index] ? (
                          <div style={{ padding: '10px 12px', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>Searching...</div>
                        ) : (searchResults[index] || []).length > 0 ? (
                          (searchResults[index] || []).map((entry: any) => {
                            const isActive    = entry.menu_item_id === item.menu_item_id;
                            const isUsedOther = safeItems.some((other: any, oi: number) =>
                              oi !== index && other.menu_item_id === entry.menu_item_id
                            );
                            if (isUsedOther) return null;
                            return (
                              <div
                                key={entry.menu_item_id}
                                onMouseDown={() => handleItemSelect(index, entry)}
                                style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isActive ? '#eff6ff' : '#fff' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isActive ? '#dbeafe' : '#f8fafc'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isActive ? '#eff6ff' : '#fff'}
                              >
                                <div style={{ overflow: 'hidden', paddingRight: '10px' }}>
                                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {entry.menu_item_name}
                                  </div>
                                  {entry.description && (
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {entry.description}
                                    </div>
                                  )}
                                </div>
                                <div style={{ textAlign: 'right', minWidth: '80px', flexShrink: 0 }}>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#059669' }}>
                                    ₱{(entry.base_price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ padding: '10px 12px', fontSize: '0.8rem', color: '#ef4444', textAlign: 'center', backgroundColor: '#fef2f2' }}>
                            No menu items found.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div className={s.formGroup} style={{ minWidth: 0 }}>
                    <label style={{ ...LABEL_STYLE }}>Description</label>
                    <div style={{ padding: '0 12px', height: '38px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '0.9rem', lineHeight: '36px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', backgroundColor: (!item.menu_item_id && item.item?.length > 0) ? '#fff5f5' : '#f3f4f6', color: (!item.menu_item_id && item.item?.length > 0) ? '#ef4444' : '#6b7280' }}>
                      {item.itemDescription}
                    </div>
                  </div>

                  {/* Qty */}
                  <div className={s.formGroup} style={{ minWidth: 0 }}>
                    <label style={{ ...LABEL_STYLE }}>Qty <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="number" className={s.cleanInput}
                      value={item.quantity || ''}
                      min="1"
                      onChange={(e) => handleQtyChange(index, e.target.value)}
                      disabled={!isPreparing}
                      style={{ height: '38px', padding: '8px 12px', fontSize: '0.9rem', width: '100%' }}
                    />
                  </div>

                  {/* Amount */}
                  <div className={s.formGroup} style={{ minWidth: 0 }}>
                    <label style={{ ...LABEL_STYLE }}>Amount (₱)</label>
                    <div style={{ padding: '8px 12px', height: '38px', backgroundColor: '#f3f4f6', borderRadius: '6px', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
                      {Number(item.amount).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* ── Order Notes / Ingredient Customisation ───────────── */}
                {isPreparing && item.menu_item_id && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
                    <label style={{ ...LABEL_STYLE }}>Order Notes</label>

                    {item.ingredientsLoading ? (
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>Loading ingredients…</p>
                    ) : (item.ingredients || []).length > 0 ? (
                      <>
                        <p style={{ margin: '4px 0 6px', fontSize: '0.78rem', color: '#9ca3af' }}>Ingredients:</p>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {(item.ingredients as Ingredient[]).map((ing) => {
                            const isRemoved = (item.modifications as Modification[]).some(
                              m => m.ingredient_brand_id === ing.ingredient_brand_id && m.action_code === 'REMOVED'
                            );
                            return (
                              <li
                                key={ing.ingredient_brand_id}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}
                              >
                                <span style={{
                                  fontSize: '0.85rem',
                                  color: isRemoved ? '#9ca3af' : '#374151',
                                  textDecoration: isRemoved ? 'line-through' : 'none',
                                }}>
                                  {ing.ingredient_name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleIngredient(index, ing.ingredient_brand_id)}
                                  style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: '0.78rem', fontWeight: 500, padding: '2px 6px',
                                    color: isRemoved ? '#3b82f6' : '#ef4444',
                                  }}
                                >
                                  {isRemoved ? 'Undo' : 'Remove'}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : (
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>No ingredients on record.</p>
                    )}
                  </div>
                )}

              </div>
            ))}

            {isPreparing && (
              <button
                type="button" onClick={handleAddItem}
                style={{ width: '100%', padding: '10px', border: '1px dashed #cbd5e1', borderRadius: '6px', backgroundColor: '#f8fafc', color: '#475569', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem' }}
              >
                <LuPlus /> Add Another Item
              </button>
            )}
          </div>

        </div>

        {/* FOOTER */}
        <div
          className={s.modalFooter}
          style={{ padding: '20px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', marginTop: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          {submitError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500 }}>
              <span>⚠</span> {submitError}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button className={s.cancelBtn} onClick={handleCancelClick}>Cancel</button>
            {!isLocked && (
              <button className={s.saveBtn} onClick={handleSubmit} disabled={hasInvalidQuantities}>Save Changes</button>
            )}
          </div>
        </div>

      </div>

      {/* Discard confirm */}
      {showCancelConfirm && (
        <div className={s.confirmOverlay} onClick={() => setShowCancelConfirm(false)}>
          <div className={s.confirmBox} onClick={e => e.stopPropagation()}>
            <div className={s.confirmIconWrap}><div className={s.confirmIcon}>⚠️</div></div>
            <div className={s.confirmTextWrap}>
              <p className={s.confirmTitle}>Discard Changes?</p>
              <p className={s.confirmSubtext}>All entered information will be lost.</p>
            </div>
            <div className={s.confirmButtons}>
              <button className={s.keepEditingBtn} onClick={() => setShowCancelConfirm(false)}>Keep Editing</button>
              <button className={s.discardBtn} onClick={() => { setShowCancelConfirm(false); onClose(); }}>Yes, Discard</button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={isConfirmEditOpen}
        onClose={() => setIsConfirmEditOpen(false)}
        onConfirm={handleConfirmSave}
        type="info"
        mode="confirm"
        title="Save Changes"
        message="Are you sure you want to apply these changes to the record?"
        confirmLabel="Save Changes"
      />

    </div>
  );
};

export default OrderEditModal;
