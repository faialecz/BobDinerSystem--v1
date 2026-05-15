/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import styles from "@/css/order.module.css";
import { LuPlus, LuTrash2, LuX, LuSearch } from "react-icons/lu";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ingredient {
  ingredient_brand_id: number;
  ingredient_name: string;
}

interface Modification {
  ingredient_brand_id: number;
  action_code: 'REMOVED';
}

interface OrderItem {
  menu_item_id: number | null;
  inventory_brand_id: string | number; // internal — used only for ingredient fetching
  item: string;
  itemDescription: string;
  price: number;
  quantity: string | number;
  amount: number;
  notes: string;
  orderStatus: string;
  paymentMethod: string;
  modifications: Modification[];
  ingredients: Ingredient[];
  ingredientsLoading: boolean;
}

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (orderData: any) => void;
  statuses: any[];
  paymentMethods: any[];
  inventoryItems?: any[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_CUSTOMER = {
  customerName: '',
  contactNumber: '',
};

const BLANK_ITEM = (status: string, payment: string): OrderItem => ({
  menu_item_id: null,
  inventory_brand_id: '',
  item: '',
  itemDescription: '—',
  price: 0,
  quantity: '1',
  amount: 0,
  notes: '',
  orderStatus: status,
  paymentMethod: payment,
  modifications: [],
  ingredients: [],
  ingredientsLoading: false,
});

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  color: '#6b7280', marginBottom: '4px',
};

// ─── Component ────────────────────────────────────────────────────────────────

const AddOrderModal: React.FC<AddOrderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  statuses = [],
  paymentMethods = [],
}) => {
  const s = styles as Record<string, string>;

  const getDefaultStatus = () => {
    if (!statuses || statuses.length === 0) return 'Preparing';
    const match = statuses.find(st => st.status_name.trim().toLowerCase() === 'preparing');
    return match ? match.status_name.trim() : statuses[0].status_name.trim();
  };

  const getDefaultPayment = () => {
    if (!paymentMethods || paymentMethods.length === 0) return 'Cash';
    const match = paymentMethods.find(pm => pm.status_name.trim().toLowerCase() === 'cash');
    return match ? match.status_name.trim() : paymentMethods[0].status_name.trim();
  };

  const [customerData, setCustomerData] = useState({ ...INITIAL_CUSTOMER });
  const [items, setItems] = useState<OrderItem[]>([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<Record<number, any[]>>({});
  const [searchLoading, setSearchLoading] = useState<Record<number, boolean>>({});
  const searchTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const justSelected = useRef<Record<number, boolean>>({});
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCustomerData({ ...INITIAL_CUSTOMER });
      setItems([BLANK_ITEM(getDefaultStatus(), getDefaultPayment())]);
      setSearchResults({});
      setSearchLoading({});
      setShowCancelConfirm(false);
      setSubmitAttempted(false);
      setSubmitError('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && (statuses.length > 0 || paymentMethods.length > 0)) {
      setItems(prev => prev.map(item => ({
        ...item,
        orderStatus: item.orderStatus || getDefaultStatus(),
        paymentMethod: item.paymentMethod || getDefaultPayment(),
      })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, paymentMethods]);

  // ─── Dirty check ─────────────────────────────────────────────────────────

  const isFormDirty = (): boolean => {
    const hasCustomerData =
      customerData.customerName.trim() ||
      customerData.contactNumber.trim();
    const hasItemData = items.some(item =>
      item.item?.trim() ||
      (item.quantity && String(item.quantity) !== '1') ||
      item.amount > 0
    );
    return !!(hasCustomerData || hasItemData);
  };

  const handleCancelClick = () => {
    if (isFormDirty()) setShowCancelConfirm(true);
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
    const fullText = items[index]?.item?.trim() || '';
    const searchText = fullText.split('—')[0].trim();
    if (!(searchResults[index] || []).length) {
      fetchSearchResults(index, searchText);
    }
  };

  const handleItemTextChange = (index: number, text: string) => {
    if (justSelected.current[index]) {
      justSelected.current[index] = false;
      return;
    }
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      item: text,
      menu_item_id: null,
      inventory_brand_id: '',
      itemDescription: '—',
      price: 0,
      amount: 0,
      modifications: [],
      ingredients: [],
    };
    setItems(newItems);

    clearTimeout(searchTimers.current[index]);
    const searchText = text.split('—')[0].trim();
    if (searchText.length >= 2) {
      searchTimers.current[index] = setTimeout(() => fetchSearchResults(index, searchText), 300);
    } else if (searchText.length === 0) {
      fetchSearchResults(index, '');
    } else {
      setSearchResults(prev => ({ ...prev, [index]: [] }));
      setSearchLoading(prev => ({ ...prev, [index]: false }));
    }
  };

  // ─── Ingredient recipe fetch ───────────────────────────────────────────────

  const fetchIngredients = async (itemIndex: number, inventoryBrandId: string | number) => {
    setItems(prev => {
      const updated = [...prev];
      if (updated[itemIndex]) {
        updated[itemIndex] = { ...updated[itemIndex], ingredientsLoading: true };
      }
      return updated;
    });
    try {
      // TODO: Replace with your actual recipe/BOM endpoint.
      // Suggested endpoint: GET /api/inventory/<inventory_brand_id>/ingredients
      // Expected response: [{ ingredient_brand_id: number, ingredient_name: string }, ...]
      const res = await fetch(`/api/inventory/${inventoryBrandId}/ingredients`);
      const data = res.ok ? await res.json() : [];
      setItems(prev => {
        const updated = [...prev];
        if (updated[itemIndex]) {
          updated[itemIndex] = {
            ...updated[itemIndex],
            ingredients: Array.isArray(data) ? data : [],
            ingredientsLoading: false,
          };
        }
        return updated;
      });
    } catch {
      setItems(prev => {
        const updated = [...prev];
        if (updated[itemIndex]) {
          updated[itemIndex] = { ...updated[itemIndex], ingredients: [], ingredientsLoading: false };
        }
        return updated;
      });
    }
  };

  // ─── Item selection ───────────────────────────────────────────────────────

  const handleItemSelect = (index: number, entry: any) => {
    justSelected.current[index] = true;
    const incomingMenuId = entry.menu_item_id;

    // Pre-check for merge using current items snapshot
    const willMerge = items.some(
      (item, i) => i !== index && item.menu_item_id === incomingMenuId
    );

    setItems(prevItems => {
      const newItems = [...prevItems];
      const existingIndex = newItems.findIndex(
        (item, i) => i !== index && item.menu_item_id === incomingMenuId
      );

      if (existingIndex !== -1) {
        const addedQty  = Number(newItems[index].quantity) || 1;
        const mergedQty = (Number(newItems[existingIndex].quantity) || 0) + addedQty;
        const price     = newItems[existingIndex].price || 0;
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: mergedQty,
          amount:   mergedQty * price,
        };
        return newItems.filter((_, i) => i !== index);
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
      return newItems;
    });

    setActiveSearchIndex(null);
    setSearchResults(prev => ({ ...prev, [index]: [] }));

    if (!willMerge && entry.inventory_brand_id != null) {
      fetchIngredients(index, entry.inventory_brand_id);
    }
  };

  // ─── Item field handlers ──────────────────────────────────────────────────

  const handleQtyChange = (index: number, newQty: string) => {
    const newItems = [...items];
    const qtyNum = Number(newQty) || 0;
    const price = newItems[index].price || 0;
    newItems[index] = { ...newItems[index], quantity: newQty, amount: price * qtyNum };
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([...items, BLANK_ITEM(getDefaultStatus(), getDefaultPayment())]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  };

  // ─── Ingredient customization ─────────────────────────────────────────────

  const handleToggleIngredient = (itemIndex: number, ingredientBrandId: number) => {
    setItems(prev => {
      const updated = [...prev];
      const item = updated[itemIndex];
      const alreadyRemoved = item.modifications.some(
        m => m.ingredient_brand_id === ingredientBrandId && m.action_code === 'REMOVED'
      );
      updated[itemIndex] = {
        ...item,
        modifications: alreadyRemoved
          ? item.modifications.filter(m => m.ingredient_brand_id !== ingredientBrandId)
          : [...item.modifications, { ingredient_brand_id: ingredientBrandId, action_code: 'REMOVED' }],
      };
      return updated;
    });
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setSubmitError('');

    if (!customerData.customerName.trim()) {
      setSubmitError('Customer name is required.');
      return;
    }
    if (!customerData.contactNumber.trim()) {
      setSubmitError('Contact number is required.');
      return;
    }
    const hasValidItem = items.some(item => item.menu_item_id && item.item?.trim());
    if (!hasValidItem) {
      setSubmitError('Please select at least one valid item before saving.');
      return;
    }

    const finalItems = items
      .filter(item => item.menu_item_id)
      .map(item => ({
        menu_item_id:       item.menu_item_id,
        quantity:           Number(item.quantity) || 1,
        unit_price:         item.price || 0,
        amount:             item.amount,
        notes:              item.notes || '',
        orderStatus:        item.orderStatus || getDefaultStatus(),
        paymentMethod:      item.paymentMethod || getDefaultPayment(),
        modifications:      item.modifications,
      }));

    onSave({ ...customerData, items: finalItems });
  };

  if (!isOpen) return null;

  const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalAmt = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const hasInvalidQuantities = false; // stock validation handled server-side via BOM/FIFO

  const customerNameHasError = () => submitAttempted && !customerData.customerName.trim();
  const contactHasError      = () => submitAttempted && !customerData.contactNumber.trim();
  const itemHasError         = (index: number) =>
    submitAttempted && !items[index].menu_item_id && items[index].item?.trim().length > 0;

  return (
    <div className={s.modalOverlay} style={{ zIndex: 1000 }}>
      <div
        className={s.modalContent}
        style={{ maxHeight: '95vh', width: '900px', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '12px', overflow: 'hidden' }}
      >

        {/* HEADER */}
        <div className={s.modalHeader} style={{ padding: '20px 24px', flexShrink: 0 }}>
          <div>
            <h2 className={s.headerTitle}>New Order</h2>
            <p className={s.headerSubtext}>Enter customer details and add items to this order.</p>
          </div>
          <LuX className={s.closeIcon} onClick={handleCancelClick} />
        </div>

        <form onSubmit={handleSubmit} className={s.orderForm}>

          {/* CUSTOMER SECTION */}
          <div className={s.customerSection}>
            <div className={s.orderSummaryBar}>
              <div>
                <span className={s.summaryLabel}>Order ID</span>
                <span className={s.summaryValue}>-</span>
              </div>
              <div>
                <span className={s.summaryLabel}>Total Items</span>
                <span className={s.summaryValue}>{totalQty}</span>
              </div>
              <div>
                <span className={s.summaryLabel}>Total Amount</span>
                <span className={s.summaryValue}>₱ {totalAmt.toLocaleString()}</span>
              </div>
            </div>

            <h4 className={s.customerSectionTitle}>Customer Details</h4>

            <div className={s.customerFormGrid}>
              <div className={s.formGroup}>
                <label style={{ ...LABEL_STYLE, color: customerNameHasError() ? '#dc2626' : '#6b7280' }}>
                  Customer Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  className={s.cleanInput}
                  style={customerNameHasError() ? { border: '1px solid #f87171', backgroundColor: '#fff5f5' } : {}}
                  value={customerData.customerName}
                  onChange={(e) => { setSubmitError(''); setCustomerData({ ...customerData, customerName: e.target.value }); }}
                  placeholder="Full Name"
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
                  style={contactHasError() ? { border: '1px solid #f87171', backgroundColor: '#fff5f5' } : {}}
                  value={customerData.contactNumber}
                  onChange={(e) => { setSubmitError(''); setCustomerData({ ...customerData, contactNumber: e.target.value }); }}
                  placeholder="09XXXXXXXXX"
                />
                {contactHasError() && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Contact number is required.</p>
                )}
              </div>
            </div>
          </div>

          {/* ITEM LIST */}
          <div className={s.itemList}>
            {items.map((item, index) => (
              <div key={index} className={s.itemCard}>

                <div className={s.itemCardHeader}>
                  <div className={s.itemCardTitle}>
                    <div className={s.itemCardBadge}>{index + 1}</div>
                    Item Details
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => handleRemoveItem(index)} className={s.itemRemoveBtn}>
                      <LuTrash2 size={14} /> Remove
                    </button>
                  )}
                </div>

                {/* Top row: search / description */}
                <div
                  className={s.itemTopGrid}
                  style={{ gridTemplateColumns: '2fr 1.5fr', gap: '12px', marginBottom: '15px' }}
                >
                  {/* Search */}
                  <div className={s.searchFieldWrapper}>
                    <label style={{ ...LABEL_STYLE, color: itemHasError(index) ? '#dc2626' : '#6b7280', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Item Name <span style={{ color: '#ef4444' }}>*</span></span>
                      <LuSearch size={12} color="#94a3b8" />
                    </label>
                    <input
                      type="text"
                      value={item.item || ''}
                      onChange={(e) => handleItemTextChange(index, e.target.value)}
                      onFocus={() => handleSearchFocus(index)}
                      onBlur={() => setTimeout(() => { if (activeSearchIndex === index) setActiveSearchIndex(null); }, 200)}
                      placeholder="Search items..."
                      autoComplete="off"
                      className={(!item.menu_item_id && item.item.length > 0) ? s.searchInputInvalid : s.searchInputValid}
                      style={itemHasError(index) ? { border: '1px solid #f87171', backgroundColor: '#fff5f5' } : {}}
                    />
                    {itemHasError(index) && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Please select a valid item from the list.</p>
                    )}
                    {activeSearchIndex === index && !item.menu_item_id && (item.item.trim().length >= 2 || (searchResults[index] || []).length > 0 || searchLoading[index]) && (
                      <div className={s.searchDropdown}>
                        {searchLoading[index] ? (
                          <div className={s.outOfStockNotice}>Searching...</div>
                        ) : (searchResults[index] || []).length > 0 ? (
                          (searchResults[index] || [])
                            .filter((entry: any) =>
                              !items.some((it, i) => i !== index && it.menu_item_id === entry.menu_item_id)
                            )
                            .map((entry: any) => (
                              <div
                                key={entry.menu_item_id}
                                onMouseDown={() => handleItemSelect(index, entry)}
                                className={s.searchDropdownItem}
                              >
                                <div className={s.searchDropdownItemLeft}>
                                  <div className={s.searchDropdownItemName}>
                                    {entry.menu_item_name}
                                  </div>
                                  {entry.description && (
                                    <div className={s.searchDropdownItemDesc}>
                                      {entry.description}
                                    </div>
                                  )}
                                </div>
                                <div className={s.searchDropdownItemRight}>
                                  <div className={s.searchDropdownItemPrice}>
                                    ₱{(entry.base_price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                  </div>
                                </div>
                              </div>
                            ))
                        ) : (
                          <div className={s.outOfStockNotice}>No menu items found.</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div className={s.formGroup} style={{ minWidth: 0 }}>
                    <label style={{ ...LABEL_STYLE }}>Description</label>
                    <div className={(!item.menu_item_id && item.item.length > 0) ? s.descFieldInvalid : s.descFieldValid}>
                      {item.itemDescription}
                    </div>
                  </div>
                </div>

                {/* Bottom row: qty / amount / status / payment */}
                <div className={s.itemBottomGrid}>
                  <div className={s.formGroup}>
                    <label style={{ ...LABEL_STYLE }}>Quantity <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="number"
                      className={s.cleanInput}
                      value={item.quantity || ''}
                      min="1"
                      onChange={(e) => handleQtyChange(index, e.target.value)}
                      style={{ height: '38px' }}
                    />
                  </div>
                  <div className={s.formGroup}>
                    <label style={{ ...LABEL_STYLE }}>Amount (₱)</label>
                    <div className={s.amountField}>{Number(item.amount).toLocaleString()}</div>
                  </div>
                  <div className={s.formGroup}>
                    <label style={{ ...LABEL_STYLE }}>Status <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      className={s.cleanInput}
                      value={item.orderStatus || getDefaultStatus()}
                      onChange={(e) => handleItemChange(index, 'orderStatus', e.target.value)}
                      style={{ height: '38px' }}
                    >
                      {statuses.length === 0 && <option value="Preparing">Preparing</option>}
                      {statuses.map((st: any) => (
                        <option key={st.status_id} value={st.status_name.trim()}>{st.status_name.trim()}</option>
                      ))}
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label style={{ ...LABEL_STYLE }}>Payment Method <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      className={s.cleanInput}
                      value={item.paymentMethod || getDefaultPayment()}
                      onChange={(e) => handleItemChange(index, 'paymentMethod', e.target.value)}
                      style={{ height: '38px' }}
                    >
                      {paymentMethods.length === 0 && <option value="Cash">Cash</option>}
                      {paymentMethods.map((pm: any) => (
                        <option key={pm.status_id} value={pm.status_name.trim()}>{pm.status_name.trim()}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ── Order Notes / Ingredient Customisation ───────────── */}
                {item.menu_item_id && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
                    <label style={{ ...LABEL_STYLE }}>Order Notes</label>

                    {item.ingredientsLoading ? (
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>Loading ingredients…</p>
                    ) : item.ingredients.length > 0 ? (
                      <>
                        <p style={{ margin: '4px 0 6px', fontSize: '0.78rem', color: '#9ca3af' }}>Ingredients:</p>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {item.ingredients.map((ing: Ingredient) => {
                            const isRemoved = item.modifications.some(
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

            <button type="button" onClick={handleAddItem} className={s.addItemBtn}>
              <LuPlus /> Add Another Item
            </button>
          </div>

          {/* FOOTER */}
          <div
            className={s.modalFooter}
            style={{ padding: '20px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            {submitError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500 }}>
                <span>⚠</span> {submitError}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={handleCancelClick} className={s.cancelBtn}>Cancel</button>
              <button type="submit" className={s.saveBtn} disabled={hasInvalidQuantities}>Save Order</button>
            </div>
          </div>
        </form>
      </div>

      {/* Cancel confirmation */}
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
    </div>
  );
};

export default AddOrderModal;
