/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import styles from "@/css/inventory.module.css";
import { LuX, LuPlus, LuTrash2 } from "react-icons/lu";

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
  isPrimary: boolean;
}

interface BrandVariant {
  brand_id: string | number;
  brand_name?: string;
  sku: string;
  unit_price: string | number;
  selling_price: string | number;
  qty: string | number;
}

interface EditInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemData: any;
  onSave: (updatedItem: any) => void;
  onOpenUomModal?: () => void;
  suppliers: any[];
  brands: Brand[];
  uoms: any[];
  existingProducts?: { id: string; item_name: string }[];
}

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

const DISABLED_STYLE: React.CSSProperties = {
  ...FIELD_STYLE, backgroundColor: '#f3f4f6', color: '#9ca3af', cursor: 'not-allowed',
};

const BLANK_SUPPLIER: SupplierEntry = {
  supplierName: '', contactPerson: '', contactNumber: '', leadTime: '', minOrder: '', isPrimary: false,
};

const EditInventoryModal = ({ isOpen, onClose, itemData, onSave, suppliers, brands, uoms, existingProducts = [] }: EditInventoryModalProps) => {
  const s = styles as Record<string, string>;

  const [formData, setFormData] = useState<any>(null);
  const [originalData, setOriginalData] = useState<any>(null);
  const [supplierEntries, setSupplierEntries] = useState<SupplierEntry[]>([]);
  const [originalSuppliers, setOriginalSuppliers] = useState<SupplierEntry[]>([]);
  const [brandVariants, setBrandVariants] = useState<BrandVariant[]>([]);
  const [originalBrands, setOriginalBrands] = useState<BrandVariant[]>([]);
  const [dupError, setDupError] = useState('');
  const [supplierError, setSupplierError] = useState('');

  useEffect(() => {
    if (itemData) {
      setDupError('');
      setSupplierError('');

      const sups: SupplierEntry[] = (itemData.suppliers && itemData.suppliers.length > 0)
        ? itemData.suppliers.map((sup: any, i: number) => ({
            supplierName: sup.supplierName || '',
            contactPerson: sup.contactPerson || '',
            contactNumber: sup.contactNumber || '',
            leadTime: String(sup.leadTime ?? ''),
            minOrder: String(sup.minOrder ?? ''),
            isPrimary: i === 0,
          }))
        : [{ supplierName: itemData.supplierName || '', contactPerson: itemData.contactPerson || '', contactNumber: itemData.contactNumber || '', leadTime: String(itemData.leadTime ?? ''), minOrder: String(itemData.minOrder ?? ''), isPrimary: true }];

      setSupplierEntries(sups);
      setOriginalSuppliers(sups);

      const bvs: BrandVariant[] = (itemData.brands || []).map((b: any) => ({
        brand_id: String(b.brand_id),
        brand_name: b.brand_name,
        sku: b.sku || '',
        unit_price: b.unit_price ?? '',
        selling_price: b.selling_price ?? '',
        qty: b.qty ?? '',
      }));
      setBrandVariants(bvs);
      setOriginalBrands(bvs);

      const fd = {
        id: itemData.id,
        itemName: itemData.itemName || '',
        itemDescription: itemData.itemDescription || '',
        uom: itemData.uom || 'Select',
        reorderPoint: itemData.reorderPoint ?? '',
        leadTime: itemData.leadTime ?? '',
        minOrder: itemData.minOrder ?? '',
      };
      setFormData(fd);
      setOriginalData({ ...fd });
    }
  }, [itemData]);

  if (!isOpen || !formData) return null;

  // ── SUPPLIER HANDLERS ──
  const handleSupplierChange = (idx: number, field: keyof SupplierEntry, value: string) => {
    setSupplierError('');
    setSupplierEntries(prev => {
      if (field === 'supplierName' && value) {
        const alreadyUsed = prev.some((e, i) => i !== idx && e.supplierName === value);
        if (alreadyUsed) {
          setSupplierError(`"${value}" is already added.`);
          return prev;
        }
      }
      const updated = [...prev];
      const entry = { ...updated[idx], [field]: value };
      if (field === 'supplierName') {
        const sup = suppliers.find((s: any) => s.supplierName === value);
        entry.contactPerson = sup?.contactPerson || '';
        entry.contactNumber = sup?.contactNumber || '';
      }
      updated[idx] = entry;
      return updated;
    });
  };

  const handleAddSupplier = () => setSupplierEntries(prev => [...prev, { ...BLANK_SUPPLIER }]);
  const handleRemoveSupplier = (idx: number) => {
    setSupplierError('');
    setSupplierEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddBrandVariant = () => {
    setBrandVariants(prev => [...prev, { brand_id: '', sku: '', unit_price: '', selling_price: '', qty: '' }]);
  };

  const handleRemoveBrandVariant = (idx: number) => {
    setBrandVariants(prev => prev.filter((_, i) => i !== idx));
  };

  const handleBrandVariantChange = (idx: number, field: keyof BrandVariant, value: string) => {
    setBrandVariants(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const handleSubmit = () => {
    setDupError('');

    const hasFormChanges = originalData && (
      formData.itemName        !== originalData.itemName        ||
      formData.itemDescription !== originalData.itemDescription ||
      String(formData.uom)     !== String(originalData.uom)     ||
      String(formData.reorderPoint) !== String(originalData.reorderPoint)
    );
    const hasSupplierChange = JSON.stringify(supplierEntries) !== JSON.stringify(originalSuppliers);
    const hasBrandChange    = JSON.stringify(brandVariants)   !== JSON.stringify(originalBrands);

    if (!hasFormChanges && !hasSupplierChange && !hasBrandChange) {
      setDupError('No changes detected. Please modify at least one field before updating.');
      return;
    }

    const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, ' ');
    const conflict = existingProducts.find(
      (p: any) => normalize(p.item_name) === normalize(formData.itemName || '') && String(p.id) !== String(formData.id)
    );
    if (conflict) {
      setDupError(`"${formData.itemName}" already exists. Please use a different item name.`);
      return;
    }

    if (brandVariants.length === 0) {
      setDupError('At least one brand variant is required.');
      return;
    }
    const missingBrand = brandVariants.find(bv => !bv.brand_id);
    if (missingBrand) {
      setDupError('All brand variants must have a brand selected.');
      return;
    }

    const validSuppliers = supplierEntries.filter(e => e.supplierName).map((e, i) => ({ ...e, isPrimary: i === 0 }));
    onSave({
      ...formData,
      suppliers: validSuppliers,
      brands: brandVariants.map(bv => ({
        brand_id: Number(bv.brand_id),
        sku: bv.sku,
        unit_price: Number(bv.unit_price) || 0,
        selling_price: Number(bv.selling_price) || 0,
        qty: Number(bv.qty) || 0,
      })),
    });
  };

  return (
    <div className={s.modalOverlay} style={{ zIndex: 1100 }}>
      <div className={s.modalContent} style={{
        width: '850px', maxHeight: '95vh', display: 'flex',
        flexDirection: 'column', padding: 0, borderRadius: '12px', overflow: 'hidden'
      }}>

        {/* HEADER */}
        <div className={s.modalHeader} style={{ padding: '20px 24px', borderBottom: '1px solid #eaeaea', backgroundColor: '#fff', flexShrink: 0 }}>
          <div className={s.modalTitleGroup}>
            <h2 className={s.title} style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Edit Inventory Item</h2>
            <p className={s.subText}>Update product details, brand variants, and supplier links.</p>
          </div>
          <LuX onClick={onClose} className={s.closeIcon} style={{ cursor: 'pointer', color: '#666' }} />
        </div>

        {/* SCROLLABLE BODY */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', backgroundColor: '#f9fafb' }}>

          {/* Product Identification */}
          <div style={{ backgroundColor: '#eff6ff', padding: '16px 20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #dbeafe' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '0.78rem', textTransform: 'uppercase', color: '#1e40af', letterSpacing: '0.5px' }}>Product Identification</h4>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Product ID: </span>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{formData.id}</span>
          </div>

          {/* Supplier Details */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#1e40af' }}>Supplier Details</h4>
              <button type="button" onClick={handleAddSupplier}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #dbeafe', backgroundColor: '#eff6ff', color: '#1e40af', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                <LuPlus size={13} /> Add Supplier
              </button>
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
                      {suppliers.map((sup: any) => {
                        const used = supplierEntries.some((e, ei) => ei !== idx && e.supplierName === sup.supplierName);
                        return <option key={sup.id} value={sup.supplierName} disabled={used} style={{ color: used ? '#9ca3af' : '#374151' }}>{sup.supplierName}</option>;
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

          {/* Item Details */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 15px', fontSize: '0.95rem', fontWeight: 600, color: '#1e40af' }}>Item Details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Item Name</label>
                <input style={{ ...FIELD_STYLE, borderColor: dupError && dupError.includes(formData.itemName) ? '#fca5a5' : '#9ca3af' }}
                  value={formData.itemName}
                  onChange={e => { setDupError(''); setFormData({ ...formData, itemName: e.target.value }); }} />
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Unit (UOM)</label>
                <select style={{ ...FIELD_STYLE }} value={formData.uom} onChange={e => setFormData({ ...formData, uom: e.target.value })}>
                  <option value="Select">Select</option>
                  {uoms.map((u: any) => <option key={u.id} value={u.code}>{u.name} ({u.code})</option>)}
                </select>
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Reorder Point</label>
                <input type="number" style={{ ...FIELD_STYLE, border: '1px solid #fcd34d' }} value={formData.reorderPoint} onChange={e => setFormData({ ...formData, reorderPoint: e.target.value })} />
              </div>
            </div>
            <div className={s.formGroupFull}>
              <label className={s.miniLabel}>Description</label>
              <input style={{ ...FIELD_STYLE }} value={formData.itemDescription} onChange={e => setFormData({ ...formData, itemDescription: e.target.value })} />
            </div>
          </div>

          {/* Brand Variants */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#1e40af' }}>
                Brand Variants <span style={{ fontSize: '0.78rem', fontWeight: 400, color: '#94a3b8' }}>({brandVariants.length})</span>
              </h4>
              <button type="button" onClick={handleAddBrandVariant}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#1e40af', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                <LuPlus size={13} /> Add Variant
              </button>
            </div>

            {brandVariants.length === 0 && (
              <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem', margin: '20px 0' }}>No brand variants. Click &quot;Add Variant&quot; to begin.</p>
            )}

            {brandVariants.map((bv, idx) => (
              <div key={idx} style={{ backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Variant {idx + 1}</span>
                  <button type="button" onClick={() => handleRemoveBrandVariant(idx)}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem' }}>
                    <LuTrash2 size={12} /> Remove
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#555', marginBottom: '3px' }}>Brand</label>
                    <select style={{ ...FIELD_STYLE, fontSize: '0.85rem' }}
                      value={String(bv.brand_id)}
                      onChange={e => handleBrandVariantChange(idx, 'brand_id', e.target.value)}>
                      <option value="">Select Brand</option>
                      {brands.map(b => (
                        <option key={b.id} value={String(b.id)}>
                          {b.name === 'No Brand' ? '— No Brand' : b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#555', marginBottom: '3px' }}>SKU</label>
                    <input style={{ ...DISABLED_STYLE, fontSize: '0.85rem' }} value={bv.sku} readOnly />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#555', marginBottom: '3px' }}>Cost Price</label>
                    <input type="number" style={{ ...FIELD_STYLE, fontSize: '0.85rem' }} value={bv.unit_price} placeholder="0.00"
                      onChange={e => handleBrandVariantChange(idx, 'unit_price', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#555', marginBottom: '3px' }}>Selling Price</label>
                    <input type="number" style={{ ...FIELD_STYLE, fontSize: '0.85rem' }} value={bv.selling_price} placeholder="0.00"
                      onChange={e => handleBrandVariantChange(idx, 'selling_price', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#555', marginBottom: '3px' }}>Quantity</label>
                    <input type="number" style={{ ...FIELD_STYLE, fontSize: '0.85rem' }} value={bv.qty} placeholder="0"
                      onChange={e => handleBrandVariantChange(idx, 'qty', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <div className={s.modalFooter} style={{ padding: '20px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}>
          {dupError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500 }}>
              <span>⚠</span> {dupError}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button className={s.cancelBtn} onClick={onClose}>Cancel</button>
            <button
              className={s.saveBtn}
              onClick={handleSubmit}
              style={{ backgroundColor: '#111827', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
              Update Item
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EditInventoryModal;
