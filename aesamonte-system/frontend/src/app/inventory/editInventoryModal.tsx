/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import styles from "@/css/inventory.module.css";
import { LuX} from "react-icons/lu";

interface EditInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemData: any; 
  onSave: (updatedItem: any) => void;
  suppliers: any[];
  uoms: any[]; 
}

const EditInventoryModal = ({ isOpen, onClose, itemData, onSave, suppliers, uoms }: EditInventoryModalProps) => {
  const s = styles as Record<string, string>;
  const [formData, setFormData] = useState<any>(null);

  // Initialize form with data fetched from backend
  useEffect(() => {
    if (itemData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        id: itemData.id,
        sku: itemData.sku || '',
        
        // Identity
        itemName: itemData.itemName || '',
        brand: itemData.brand || '',
        itemDescription: itemData.itemDescription || '',
        
        // Supplier (Read Only mostly, but needs defaults)
        supplierName: itemData.supplierName || '',
        contactPerson: itemData.contactPerson || '—',
        contactNumber: itemData.contactNumber || '—',

        // Stock & Pricing (Using ?? to handle 0 values correctly)
        qty: itemData.qty ?? '', 
        uom: itemData.uom || 'Select',
        reorderPoint: itemData.reorderPoint ?? '', 
        
        // Financials
        unitPrice: itemData.unitPrice ?? '',
        sellingPrice: itemData.sellingPrice ?? '',
        leadTime: itemData.leadTime ?? '',
        minOrder: itemData.minOrder ?? ''
      });
    }
  }, [itemData]);

  // --- CRITICAL GUARD CLAUSE ---
  // This prevents the "Cannot read properties of null" error
  if (!isOpen || !formData) return null;

  // Handle supplier change to auto-update contact info
  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    const supplier = suppliers.find(sup => sup.supplierName === selectedName);
    
    setFormData({
      ...formData,
      supplierName: selectedName,
      contactPerson: supplier?.contactPerson || '',
      contactNumber: supplier?.contactNumber || ''
    });
  };

  const handleSubmit = () => {
    onSave(formData);
  };

  return (
    <div className={s.modalOverlay} style={{ zIndex: 1100 }}> 
      <div className={s.modalContent} style={{ width: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
        
        {/* --- HEADER --- */}
        <div className={s.modalHeader} style={{ padding: '20px 24px', borderBottom: '1px solid #eaeaea', backgroundColor: '#fff' }}>
           <div className={s.modalTitleGroup}>
             <h2 className={s.title} style={{ fontSize: '1.25rem' }}>Edit Inventory Item</h2>
             <p className={s.subText}>Update product details, pricing, and stock levels.</p>
           </div>
           <LuX onClick={onClose} className={s.closeIcon} style={{ cursor: 'pointer', color: '#666' }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#f9fafb' }}>
          
          {/* --- READ-ONLY IDENTITY SECTION --- */}
          <div style={{ backgroundColor: '#eff6ff', padding: '20px', borderRadius: '8px', marginBottom: '24px', border: '1px solid #dbeafe' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', textTransform: 'uppercase', color: '#1e40af', letterSpacing: '0.5px' }}>
              Product Identification
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Product ID</span>
                {/* The guard clause ensures formData is not null here */}
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>{formData.id}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>SKU</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>{formData.sku}</span>
              </div>
            </div>
          </div>

          {/* --- SUPPLIER DETAILS --- */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Supplier Details</h4>
            <div className={s.formRowThree} style={{ gap: '15px' }}>
              
              {/* FIXED: Styles added to match height */}
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Supplier Name</label>
                <select 
                  className={s.cleanInput}
                  value={formData.supplierName} 
                  onChange={handleSupplierChange}
                  style={{ 
                    width: '100%', 
                    padding: '8px 12px', 
                    fontSize: '0.9rem',
                    height: '38px', 
                    backgroundColor: '#fff',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px'
                  }}
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(sup => (
                    <option key={sup.id} value={sup.supplierName}>{sup.supplierName}</option>
                  ))}
                </select>
              </div>

              <div className={s.formGroup}>
                <label className={s.miniLabel}>Contact Person</label>
                <div style={{ padding: '8px 12px', height: '38px', backgroundColor: '#f3f4f6', borderRadius: '6px', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
                  {formData.contactPerson}
                </div>
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Contact Number</label>
                <div style={{ padding: '8px 12px', height: '38px', backgroundColor: '#f3f4f6', borderRadius: '6px', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
                  {formData.contactNumber}
                </div>
              </div>
            </div>
          </div>

          {/* --- ITEM DETAILS --- */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Item Details</h4>
            <div className={s.formRow} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Item Name</label>
                <input 
                  className={s.cleanInput}
                  value={formData.itemName} 
                  onChange={(e) => setFormData({...formData, itemName: e.target.value})}
                />
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Brand</label>
                <input 
                  className={s.cleanInput}
                  value={formData.brand} 
                  onChange={(e) => setFormData({...formData, brand: e.target.value})}
                />
              </div>
            </div>
            <div className={s.formGroupFull}>
              <label className={s.miniLabel}>Description</label>
              <input 
                className={s.cleanInput}
                value={formData.itemDescription} 
                onChange={(e) => setFormData({...formData, itemDescription: e.target.value})}
              />
            </div>
          </div>

          {/* --- STOCK & PRICING --- */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <h5 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
              Stock
            </h5>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Quantity</label>
                <input 
                  type="number"
                  className={s.cleanInput}
                  value={formData.qty} 
                  onChange={(e) => setFormData({...formData, qty: e.target.value})}
                />
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Unit (UOM)</label>
                <select 
                  className={s.cleanInput}
                  value={formData.uom} 
                  onChange={(e) => setFormData({...formData, uom: e.target.value})}
                >
                  <option value="Select">Select</option>
                  {uoms && uoms.map((u: any) => (
                    <option key={u.id} value={u.code}>{u.name} ({u.code})</option>
                  ))}
                </select>
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Reorder Point</label>
                <input 
                  type="number"
                  className={s.cleanInput}
                  style={{ borderColor: '#fcd34d' }}
                  value={formData.reorderPoint} 
                  onChange={(e) => setFormData({...formData, reorderPoint: e.target.value})}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #e5e7eb', margin: '0 -20px 20px -20px' }}></div>

            <h5 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
              Stock & Pricing
            </h5>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px' }}>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Cost Price</label>
                <input 
                  type="number"
                  className={s.cleanInput}
                  value={formData.unitPrice} 
                  onChange={(e) => setFormData({...formData, unitPrice: e.target.value})}
                />
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Selling Price</label>
                <input 
                  type="number"
                  className={s.cleanInput}
                  value={formData.sellingPrice} 
                  onChange={(e) => setFormData({...formData, sellingPrice: e.target.value})}
                />
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Lead Time</label>
                <input 
                  type="number"
                  className={s.cleanInput}
                  value={formData.leadTime} 
                  onChange={(e) => setFormData({...formData, leadTime: e.target.value})}
                />
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Min Order (MOQ)</label>
                <input 
                  type="number"
                  className={s.cleanInput}
                  value={formData.minOrder} 
                  onChange={(e) => setFormData({...formData, minOrder: e.target.value})}
                />
              </div>
            </div>
          </div>

        </div>

        {/* --- FOOTER --- */}
        <div className={s.modalFooter} style={{ padding: '20px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', marginTop: 0 }}>
          <button className={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={s.saveBtn} onClick={handleSubmit}>Update Item</button>
        </div>

      </div>
    </div>
  );
};

export default EditInventoryModal;