/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from "@/css/inventory.module.css";
import { LuPlus, LuTrash2 } from "react-icons/lu";

interface Supplier {
  id: number;
  supplierName: string;
  contactPerson?: string;
  contactNumber?: string;
}

interface Brand {
  id: number;
  code: string;
  name: string;
}

interface SupplierEntry {
  supplierName: string;
  contactPerson: string;
  contactNumber: string;
  leadTime: string;
  minOrder: string;
}

interface BrandVariant {
  brand_id: string | number;
  skuSuffix: string;
  sku: string;
  unit_price: string;
  selling_price: string;
  qty: string;
}

interface AddInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (items: any[]) => void;
  onOpenSupplierModal: () => void;
  onOpenUomModal: () => void;
  suppliers: Supplier[];
  brands: Brand[];
  uoms: { id: number; code: string; name: string }[];
  existingProducts?: { item_name: string }[];
  defaultSupplierName?: string;
}

const INITIAL_SUPPLIER: SupplierEntry = {
  supplierName: '', contactPerson: '', contactNumber: '', leadTime: '', minOrder: '',
};

const FIELD_STYLE: React.CSSProperties = {
  width: '100%', height: '38px', padding: '8px 12px',
  borderRadius: '6px', border: '1px solid #9ca3af',
  backgroundColor: '#fff', color: '#374151', fontSize: '0.95rem', outline: 'none',
};

const READ_ONLY_STYLE: React.CSSProperties = {
  padding: '8px 12px', height: '38px', backgroundColor: '#f3f4f6',
  borderRadius: '6px', border: '1px solid #e5e7eb',
  color: '#6b7280', fontSize: '0.9rem', display: 'flex', alignItems: 'center',
};

function computeSkuPrefix(itemName: string): string {
  const name = (itemName || '').trim().toUpperCase();
  const words = name.split(/\s+/).filter((w: string) => w.length > 0);
  let prefix = '';
  for (let i = 0; i < Math.min(3, words.length); i++) prefix += words[i][0];
  if (prefix.length < 3) prefix = prefix.padEnd(3, 'X');
  return prefix;
}

function randomSuffix(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 3; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

const INITIAL_ITEM = {
  itemName: '',
  itemDescription: '',
  uom: 'Select',
  reorderPoint: '',
  brandVariants: [] as BrandVariant[],
};

const AddInventoryModal: React.FC<AddInventoryModalProps> = ({
  isOpen, onClose, onSave, onOpenSupplierModal, suppliers = [], brands = [], uoms = [],
  existingProducts = [], defaultSupplierName = ''
}) => {
  const s = styles as Record<string, string>;

  const [supplierEntries, setSupplierEntries] = useState<SupplierEntry[]>([{ ...INITIAL_SUPPLIER }]);
  const [items, setItems] = useState<any[]>([{ ...INITIAL_ITEM, brandVariants: [] }]);
  const [dupError, setDupError] = useState('');
  const [supplierError, setSupplierError] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [supplierHeight, setSupplierHeight] = useState<number | 'auto'>('auto');
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const supplierSectionRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartHeight.current = supplierSectionRef.current?.offsetHeight ?? 400;
    setSupplierHeight(dragStartHeight.current);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientY - dragStartY.current;
      setSupplierHeight(Math.min(Math.max(dragStartHeight.current + delta, 120), 520));
    };
    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (defaultSupplierName) {
        const sup = suppliers.find(s => s.supplierName === defaultSupplierName);
        setSupplierEntries([{
          supplierName: defaultSupplierName,
          contactPerson: sup?.contactPerson || '',
          contactNumber: sup?.contactNumber || '',
          leadTime: '', minOrder: '',
        }]);
      } else {
        setSupplierEntries([{ ...INITIAL_SUPPLIER }]);
      }
      setItems([{ ...INITIAL_ITEM, brandVariants: [] }]);
      setDupError('');
      setSupplierError('');
      setShowCancelConfirm(false);
      setSupplierHeight('auto');
    }
  }, [isOpen, defaultSupplierName]);

  const isFormDirty = (): boolean => {
    const hasItemData = items.some(item =>
      item.itemName?.trim() || item.itemDescription?.trim() ||
      (item.uom && item.uom !== 'Select') || item.brandVariants?.length > 0
    );
    const hasSupplierData = supplierEntries.some(e => e.supplierName?.trim());
    return hasItemData || hasSupplierData;
  };

  const handleCancelClick = () => {
    if (isFormDirty()) setShowCancelConfirm(true);
    else onClose();
  };

  // ── SUPPLIER HANDLERS ──
  const handleSupplierChange = (idx: number, field: keyof SupplierEntry, value: string) => {
    setSupplierError('');
    setSupplierEntries(prev => {
      if (field === 'supplierName' && value) {
        const alreadyUsed = prev.some((e, i) => i !== idx && e.supplierName === value);
        if (alreadyUsed) {
          setSupplierError(`"${value}" is already added. Please select a different supplier.`);
          return prev;
        }
      }
      const updated = [...prev];
      const entry = { ...updated[idx], [field]: value };
      if (field === 'supplierName') {
        const sup = suppliers.find(s => s.supplierName === value);
        entry.contactPerson = sup?.contactPerson || '';
        entry.contactNumber = sup?.contactNumber || '';
      }
      updated[idx] = entry;
      return updated;
    });
  };

  const handleAddSupplier = () => setSupplierEntries(prev => [...prev, { ...INITIAL_SUPPLIER }]);
  const handleRemoveSupplier = (idx: number) => {
    setSupplierError('');
    setSupplierEntries(prev => prev.filter((_, i) => i !== idx));
  };

  // ── ITEM HANDLERS ──
  const handleAddItem = () => setItems(prev => [...prev, { ...INITIAL_ITEM, brandVariants: [] }]);
  const handleRemoveItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index));

  const handleItemChange = (index: number, field: string, value: string) => {
    setDupError('');
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === 'itemName') {
        const prefix = computeSkuPrefix(value);
        item.brandVariants = (item.brandVariants || []).map((bv: BrandVariant) => ({
          ...bv,
          sku: value.trim() ? `${prefix}-${bv.skuSuffix}` : '',
        }));
      }
      updated[index] = item;
      return updated;
    });
  };

  // ── BRAND VARIANT HANDLERS ──
  const handleAddBrandVariant = (itemIndex: number) => {
    const suffix = randomSuffix();
    const prefix = computeSkuPrefix(items[itemIndex]?.itemName || '');
    const newVariant: BrandVariant = {
      brand_id: '',
      skuSuffix: suffix,
      sku: items[itemIndex]?.itemName?.trim() ? `${prefix}-${suffix}` : '',
      unit_price: '',
      selling_price: '',
      qty: '',
    };
    setItems(prev => {
      const updated = [...prev];
      updated[itemIndex] = {
        ...updated[itemIndex],
        brandVariants: [...(updated[itemIndex].brandVariants || []), newVariant],
      };
      return updated;
    });
  };

  const handleRemoveBrandVariant = (itemIndex: number, variantIndex: number) => {
    setItems(prev => {
      const updated = [...prev];
      updated[itemIndex] = {
        ...updated[itemIndex],
        brandVariants: updated[itemIndex].brandVariants.filter((_: any, i: number) => i !== variantIndex),
      };
      return updated;
    });
  };

  const handleBrandVariantChange = (itemIndex: number, variantIndex: number, field: keyof BrandVariant, value: string) => {
    setItems(prev => {
      const updated = [...prev];
      const variants = [...updated[itemIndex].brandVariants];
      variants[variantIndex] = { ...variants[variantIndex], [field]: value };
      updated[itemIndex] = { ...updated[itemIndex], brandVariants: variants };
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDupError('');
    setSupplierError('');

    const normalize = (str: string) => (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const validItems = items.filter((i: any) => i.itemName?.trim());

    if (!validItems.length) {
      setDupError('Please fill in at least one item name before saving.');
      return;
    }

    const formNames = validItems.map((i: any) => normalize(i.itemName));
    if (formNames.length !== new Set(formNames).size) {
      setDupError('Duplicate item names in your list. Each item must have a unique name.');
      return;
    }

    const conflict = validItems.find((item: any) =>
      existingProducts.some((p: any) => normalize(p.item_name || '') === normalize(item.itemName))
    );
    if (conflict) {
      setDupError(`"${conflict.itemName}" already exists in inventory.`);
      return;
    }

    for (const item of validItems) {
      if (!item.brandVariants || item.brandVariants.length === 0) {
        setDupError(`"${item.itemName}" must have at least one brand variant.`);
        return;
      }
      const missingBrand = item.brandVariants.find((bv: BrandVariant) => !bv.brand_id);
      if (missingBrand) {
        setDupError(`All brand variants for "${item.itemName}" must have a brand selected.`);
        return;
      }
    }

    const validSuppliers = supplierEntries.filter(e => e.supplierName);
    const payload = validItems.map((item: any) => ({
      itemName: item.itemName,
      itemDescription: item.itemDescription,
      uom: item.uom,
      reorderPoint: Number(item.reorderPoint) || 0,
      brands: item.brandVariants.map((bv: BrandVariant) => ({
        brand_id: Number(bv.brand_id),
        sku: bv.sku,
        unit_price: Number(bv.unit_price) || 0,
        selling_price: Number(bv.selling_price) || 0,
        qty: Number(bv.qty) || 0,
      })),
      suppliers: validSuppliers.map((sup, i) => ({
        supplierName: sup.supplierName,
        leadTime: Number(sup.leadTime) || 0,
        minOrder: Number(sup.minOrder) || 0,
        isPrimary: i === 0,
      })),
    }));

    onSave(payload);
  };

  if (!isOpen) return null;

  return (
    <div className={s.modalOverlay} style={{ zIndex: 1000 }}>
      <div className={s.modalContent} style={{
        maxHeight: '95vh', width: '820px', display: 'flex',
        flexDirection: 'column', padding: 0, borderRadius: '12px', overflow: 'hidden'
      }}>

        {/* HEADER */}
        <div className={s.modalHeader} style={{ padding: '20px 24px', backgroundColor: '#fff', borderBottom: '1px solid #eaeaea', flexShrink: 0 }}>
          <div className={s.modalTitleGroup}>
            <h2 className={s.title} style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Add Inventory Items</h2>
            <p className={s.subText}>Suppliers apply to all items. Each item can have multiple brand variants.</p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} style={{
          display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto', backgroundColor: '#f9fafb', minHeight: 0
        }}>

          {/* SUPPLIER SECTION */}
          <div ref={supplierSectionRef} style={{
            height: supplierHeight === 'auto' ? 'auto' : `${supplierHeight}px`,
            minHeight: '120px', flexShrink: 0, padding: '20px 24px',
            backgroundColor: '#fff', borderBottom: '1px solid #eaeaea',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Supplier Details</h4>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span onClick={onOpenSupplierModal} style={{ cursor: 'pointer', fontSize: '0.82rem', color: '#007bff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <LuPlus size={13} /> New Supplier
                </span>
                <button type="button" onClick={handleAddSupplier}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #dbeafe', backgroundColor: '#eff6ff', color: '#1e40af', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                  <LuPlus size={13} /> Add Supplier
                </button>
              </div>
            </div>

            {supplierError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500, marginBottom: '12px' }}>
                <span>⚠</span> {supplierError}
              </div>
            )}

            {supplierEntries.map((entry, idx) => (
              <div key={idx} style={{ border: `1px solid ${idx === 0 ? '#bfdbfe' : '#e5e7eb'}`, borderRadius: '10px', padding: '14px', marginBottom: '10px', backgroundColor: idx === 0 ? '#f0f7ff' : '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  {idx === 0
                    ? <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', backgroundColor: '#dbeafe', padding: '2px 8px', borderRadius: '999px' }}>PRIMARY</span>
                    : <span style={{ fontSize: '0.72rem', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '999px', border: '1px solid #e5e7eb' }}>Alternate</span>
                  }
                  {supplierEntries.length > 1 && (
                    <button type="button" onClick={() => handleRemoveSupplier(idx)} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>
                      <LuTrash2 size={13} /> Remove
                    </button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#555', marginBottom: '4px' }}>Supplier Name</label>
                    <select style={{ ...FIELD_STYLE }} value={entry.supplierName} onChange={e => handleSupplierChange(idx, 'supplierName', e.target.value)}>
                      <option value="">Select Supplier</option>
                      {suppliers.map((sup, i) => {
                        const usedElsewhere = supplierEntries.some((e, ei) => ei !== idx && e.supplierName === sup.supplierName);
                        return (
                          <option key={sup.id || i} value={sup.supplierName} disabled={usedElsewhere} style={{ color: usedElsewhere ? '#9ca3af' : '#374151' }}>
                            {sup.supplierName}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#555', marginBottom: '4px' }}>Lead Time (Days)</label>
                    <input type="number" style={{ ...FIELD_STYLE }} value={entry.leadTime} placeholder="e.g. 7" onChange={e => handleSupplierChange(idx, 'leadTime', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#555', marginBottom: '4px' }}>Min Order (MOQ)</label>
                    <input type="number" style={{ ...FIELD_STYLE }} value={entry.minOrder} placeholder="e.g. 50" onChange={e => handleSupplierChange(idx, 'minOrder', e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#555', marginBottom: '4px' }}>Contact Person</label>
                    <div style={{ ...READ_ONLY_STYLE }}>{entry.contactPerson || '—'}</div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#555', marginBottom: '4px' }}>Contact Number</label>
                    <div style={{ ...READ_ONLY_STYLE }}>{entry.contactNumber || '—'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* DRAG HANDLE */}
          <div onMouseDown={handleMouseDown}
            style={{ height: '10px', flexShrink: 0, backgroundColor: '#e2e8f0', cursor: 'row-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#94a3b8')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
            title="Drag to resize">
            <div style={{ display: 'flex', gap: '4px' }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#94a3b8' }} />)}
            </div>
          </div>

          {/* ITEM LIST */}
          <div style={{ flex: 1, padding: '20px 24px' }}>
            {items.map((item, index) => (
              <div key={index} style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '20px', marginBottom: '20px' }}>
                {/* Item header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#111827', fontWeight: 600, fontSize: '1rem' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>{index + 1}</div>
                    Item Group
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => handleRemoveItem(index)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <LuTrash2 size={14} /> Remove
                    </button>
                  )}
                </div>

                {/* General fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Item Name</label>
                    <input style={{ ...FIELD_STYLE }} value={item.itemName} onChange={e => handleItemChange(index, 'itemName', e.target.value)} placeholder="e.g. Bond Paper A4" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Unit (UOM)</label>
                    <select style={{ ...FIELD_STYLE }} value={item.uom} onChange={e => handleItemChange(index, 'uom', e.target.value)}>
                      <option value="Select">Select</option>
                      {uoms.map(u => <option key={u.id} value={u.code}>{u.name} ({u.code})</option>)}
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Reorder Point</label>
                    <input type="number" style={{ ...FIELD_STYLE, border: '1px solid #fcd34d' }} value={item.reorderPoint} onChange={e => handleItemChange(index, 'reorderPoint', e.target.value)} />
                  </div>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Description</label>
                    <input style={{ ...FIELD_STYLE }} value={item.itemDescription} onChange={e => handleItemChange(index, 'itemDescription', e.target.value)} placeholder="Brief details..." />
                  </div>
                </div>

                {/* Brand Variants Section */}
                <div style={{ backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h5 style={{ margin: 0, fontSize: '0.85rem', color: '#1e40af', fontWeight: 700 }}>
                      Brand Variants <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#94a3b8' }}>({item.brandVariants?.length || 0} added)</span>
                    </h5>
                    <button type="button" onClick={() => handleAddBrandVariant(index)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#1e40af', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                      <LuPlus size={13} /> Add Variant
                    </button>
                  </div>

                  {(!item.brandVariants || item.brandVariants.length === 0) && (
                    <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.83rem', margin: '12px 0' }}>
                      No variants yet. Click &quot;Add Variant&quot; to add a brand, SKU, and pricing.
                    </p>
                  )}

                  {(item.brandVariants || []).map((bv: BrandVariant, vi: number) => (
                    <div key={vi} style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '12px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Variant {vi + 1}</span>
                        <button type="button" onClick={() => handleRemoveBrandVariant(index, vi)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem' }}>
                          <LuTrash2 size={12} /> Remove
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#555', marginBottom: '3px' }}>Brand</label>
                          <select style={{ ...FIELD_STYLE, fontSize: '0.85rem' }}
                            value={String(bv.brand_id)}
                            onChange={e => handleBrandVariantChange(index, vi, 'brand_id', e.target.value)}>
                            <option value="">Select Brand</option>
                            {brands.map(b => (
                              <option key={b.id} value={String(b.id)}>
                                {b.name === 'No Brand' ? '— No Brand' : b.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#555', marginBottom: '3px' }}>SKU (Auto)</label>
                          <input style={{ ...FIELD_STYLE, fontSize: '0.85rem', backgroundColor: '#f3f4f6', color: '#6b7280' }} value={bv.sku} readOnly />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#555', marginBottom: '3px' }}>Cost Price</label>
                          <input type="number" style={{ ...FIELD_STYLE, fontSize: '0.85rem' }} value={bv.unit_price} placeholder="0.00" onChange={e => handleBrandVariantChange(index, vi, 'unit_price', e.target.value)} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#555', marginBottom: '3px' }}>Selling Price</label>
                          <input type="number" style={{ ...FIELD_STYLE, fontSize: '0.85rem' }} value={bv.selling_price} placeholder="0.00" onChange={e => handleBrandVariantChange(index, vi, 'selling_price', e.target.value)} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#555', marginBottom: '3px' }}>Quantity</label>
                          <input type="number" style={{ ...FIELD_STYLE, fontSize: '0.85rem' }} value={bv.qty} placeholder="0" onChange={e => handleBrandVariantChange(index, vi, 'qty', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button type="button" onClick={handleAddItem}
              style={{ width: '100%', padding: '12px', border: '2px dashed #e5e7eb', borderRadius: '8px', backgroundColor: '#fff', color: '#4b5563', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '2rem' }}
              onMouseOver={e => e.currentTarget.style.borderColor = '#3b82f6'}
              onMouseOut={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
              <LuPlus /> Add Another Item
            </button>
          </div>

          {/* FOOTER */}
          <div className={s.modalFooter} style={{ padding: '20px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}>
            {dupError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500 }}>
                <span>⚠</span> {dupError}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={handleCancelClick} className={s.cancelBtn}>Cancel</button>
              <button type="submit" className={s.saveBtn} style={{ backgroundColor: '#1a4263', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>
                Save All Items
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Cancel Confirmation */}
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

export default AddInventoryModal;
