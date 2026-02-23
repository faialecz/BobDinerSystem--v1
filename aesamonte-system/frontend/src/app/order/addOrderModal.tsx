/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import styles from "@/css/order.module.css";
import { LuPlus, LuTrash2, LuX, LuMapPin } from "react-icons/lu";

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (orderData: any) => void;
  statuses: any[];       // Dynamic statuses from DB
  paymentMethods: any[]; // Dynamic payment methods from DB
}

const INITIAL_ITEM = {
  item: '',
  itemDescription: '',
  quantity: '',
  amount: '',
  orderStatus: '',   // Clear default to force selection
  paymentMethod: ''  // Clear default to force selection
};

const INITIAL_CUSTOMER = {
  customerName: '',
  contactNumber: '',
  deliveryAddress: ''
};

const AddOrderModal: React.FC<AddOrderModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  statuses = [],       
  paymentMethods = []  
}) => {
  const s = styles as Record<string, string>;

  const [customerData, setCustomerData] = useState({ ...INITIAL_CUSTOMER });
  const [items, setItems] = useState<any[]>([{ ...INITIAL_ITEM }]);

  useEffect(() => {
    if (isOpen) {
      setCustomerData({ ...INITIAL_CUSTOMER });
      setItems([{ ...INITIAL_ITEM }]);
    }
  }, [isOpen]);

  const handleAddItem = () => setItems([...items, { ...INITIAL_ITEM }]);
  
  const handleRemoveItem = (index: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...customerData, items });
  };

  if (!isOpen) return null;

  return (
    <div className={s.modalOverlay} style={{ zIndex: 1000 }}>
      <div className={s.modalContent} style={{ maxHeight: '95vh', width: '900px', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '12px', overflow: 'hidden' }}>
        
        <div className={s.modalHeader} style={{ padding: '20px 24px', backgroundColor: '#fff', borderBottom: '1px solid #eaeaea', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className={s.headerTitle} style={{ fontSize: '1.25rem', marginBottom: '4px', fontWeight: 700 }}>New Order Information</h2>
            <p className={s.subText} style={{ color: '#666', fontSize: '0.85rem' }}>Enter customer details and add multiple items to this order.</p>
          </div>
          <LuX onClick={onClose} style={{ cursor: 'pointer', fontSize: '1.5rem', color: '#666' }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', backgroundColor: '#f9fafb' }}>
          
          <div style={{ padding: '20px 24px', backgroundColor: '#fff', borderBottom: '1px solid #eaeaea', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', zIndex: 10 }}>
              <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 600, color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LuMapPin size={16} /> Customer & Delivery Details
              </h4>
              <div className={s.formGridTwo} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                
                {/* --- RESTORED: Manual Customer Text Input --- */}
                <div className={s.formGroup}>
                  <label className={s.miniLabel}>Customer Name</label>
                  <input 
                    className={s.cleanInput}
                    value={customerData.customerName}
                    onChange={(e) => setCustomerData({...customerData, customerName: e.target.value})}
                    placeholder="Full Name"
                    required
                  />
                </div>
                {/* ------------------------------------------- */}

                <div className={s.formGroup}>
                  <label className={s.miniLabel}>Contact Number</label>
                  <input className={s.cleanInput} value={customerData.contactNumber} onChange={(e) => setCustomerData({...customerData, contactNumber: e.target.value})} placeholder="09XXXXXXXXX" />
                </div>
              </div>
              <div className={s.formGroupFull}>
                <label className={s.miniLabel}>Delivery Address</label>
                <input className={s.cleanInput} value={customerData.deliveryAddress} onChange={(e) => setCustomerData({...customerData, deliveryAddress: e.target.value})} placeholder="Street, Barangay, City" required />
              </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
            {items.map((item, index) => (
              <div key={index} style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#111827', fontWeight: 600 }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>{index + 1}</div>
                    Item Details
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => handleRemoveItem(index)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <LuTrash2 size={14} /> Remove
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px', marginBottom: '15px' }}>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Item Name</label>
                    <input className={s.cleanInput} value={item.item} onChange={(e) => handleItemChange(index, 'item', e.target.value)} required />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Description</label>
                    <input className={s.cleanInput} value={item.itemDescription} onChange={(e) => handleItemChange(index, 'itemDescription', e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px' }}>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Quantity</label>
                    <input type="number" className={s.cleanInput} value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} required />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Amount (Total)</label>
                    <input type="number" className={s.cleanInput} value={item.amount} onChange={(e) => handleItemChange(index, 'amount', e.target.value)} required />
                  </div>
                  
                  {/* --- Dynamic Status Dropdown --- */}
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Status</label>
                    <select className={s.cleanInput} value={item.orderStatus} onChange={(e) => handleItemChange(index, 'orderStatus', e.target.value)} required>
                      <option value="">Select</option>
                      {statuses.map((st: any) => (
                        <option key={st.status_id} value={st.status_name}>
                          {st.status_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* --- Dynamic Payment Method Dropdown --- */}
                  <div className={s.formGroup}>
                    <label className={s.miniLabel}>Payment Method</label>
                    <select className={s.cleanInput} value={item.paymentMethod} onChange={(e) => handleItemChange(index, 'paymentMethod', e.target.value)} required>
                      <option value="">Select</option>
                      {paymentMethods.map((pm: any) => (
                        <option key={pm.status_id} value={pm.status_name}>
                          {pm.status_name}
                        </option>
                      ))}
                    </select>
                  </div>

                </div>
              </div>
            ))}
            
            <button type="button" onClick={handleAddItem} style={{ width: '100%', padding: '12px', border: '2px dashed #e5e7eb', borderRadius: '8px', backgroundColor: '#fff', color: '#4b5563', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <LuPlus /> Add Another Item
            </button>
          </div>

          <div className={s.modalFooter} style={{ padding: '20px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} className={s.cancelBtn}>Cancel</button>
            <button type="submit" className={s.saveBtn}>Save Order</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddOrderModal;