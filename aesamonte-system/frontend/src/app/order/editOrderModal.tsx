/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import styles from "@/css/inventory.module.css"; // Using the same styles as inventory
import { LuX } from "react-icons/lu";

interface OrderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: any; 
  onSave: (updatedOrder: any) => void;
  statuses?: any[];       // Added to support dynamic statuses
  paymentMethods?: any[]; // Added to support dynamic payment methods
}

const OrderEditModal = ({ isOpen, onClose, orderData, onSave, statuses = [], paymentMethods = [] }: OrderEditModalProps) => {
  const s = styles as Record<string, string>;
  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    if (orderData) {
      setFormData({
        id: orderData.id,
        customerName: orderData.name || orderData.customer, 
        contact: orderData.contact,
        address: orderData.address,
        item: orderData.item,
        quantity: orderData.quantity || orderData.totalQty,
        amount: orderData.amount || orderData.totalAmount,
        status: orderData.status,
        paymentMethod: orderData.paymentMethod
      });
    }
  }, [orderData]);

  if (!isOpen || !formData) return null;

  return (
    <div className={s.modalOverlay} style={{ zIndex: 1100 }}> 
      <div className={s.modalContent} style={{ width: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
        
        {/* --- HEADER --- */}
        <div className={s.modalHeader} style={{ padding: '20px 24px', borderBottom: '1px solid #eaeaea', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
           <div className={s.modalTitleGroup}>
             <h2 className={s.title} style={{ fontSize: '1.25rem', margin: '0 0 4px 0' }}>Edit Order Details</h2>
             <p className={s.subText} style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>Update customer information, fulfillment status, and payment details.</p>
           </div>
           <LuX onClick={onClose} className={s.closeIcon} style={{ cursor: 'pointer', color: '#666', fontSize: '1.5rem' }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#f9fafb' }}>
          
          {/* --- READ-ONLY IDENTITY SECTION --- */}
          <div style={{ backgroundColor: '#eff6ff', padding: '20px', borderRadius: '8px', marginBottom: '24px', border: '1px solid #dbeafe' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', textTransform: 'uppercase', color: '#1e40af', letterSpacing: '0.5px' }}>
              Order Identification
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Order ID</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>{formData.id}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Primary Item Ordered</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>{formData.item || 'Multiple Items / N/A'}</span>
              </div>
            </div>
          </div>

          {/* --- CUSTOMER DETAILS --- */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Customer Details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Customer Name</label>
                <input 
                  className={s.cleanInput}
                  value={formData.customerName || ''} 
                  onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                />
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Contact Number</label>
                <input 
                  className={s.cleanInput}
                  value={formData.contact || ''} 
                  onChange={(e) => setFormData({...formData, contact: e.target.value})}
                />
              </div>
            </div>
            <div className={s.formGroupFull}>
              <label className={s.miniLabel}>Delivery Address</label>
              <input 
                className={s.cleanInput}
                value={formData.address || ''} 
                onChange={(e) => setFormData({...formData, address: e.target.value})}
              />
            </div>
          </div>

          {/* --- ORDER SUMMARY --- */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>Order Totals</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Total Quantity</label>
                <input 
                  type="number"
                  className={s.cleanInput}
                  value={formData.quantity || ''} 
                  onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                />
              </div>
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Total Amount (₱)</label>
                <input 
                  type="number"
                  className={s.cleanInput}
                  value={formData.amount || ''} 
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* --- STATUS & PAYMENT --- */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <h5 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
              Fulfillment & Payment
            </h5>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              
              <div className={s.formGroup}>
                <label className={s.miniLabel}>Order Status</label>
                <select 
                  className={s.cleanInput}
                  value={formData.status || ''} 
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="">Select Status</option>
                  {statuses.length > 0 ? statuses.map((st: any) => (
                    <option key={st.status_id} value={st.status_name}>{st.status_name}</option>
                  )) : (
                    // Fallback in case props aren't loaded yet
                    <>
                      <option value="Preparing">Preparing</option>
                      <option value="To Ship">To Ship</option>
                      <option value="Received">Received</option>
                      <option value="Cancelled">Cancelled</option>
                    </>
                  )}
                </select>
              </div>

              <div className={s.formGroup}>
                <label className={s.miniLabel}>Payment Method</label>
                <select 
                  className={s.cleanInput}
                  value={formData.paymentMethod || ''} 
                  onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                >
                  <option value="">Select Method</option>
                  {paymentMethods.length > 0 ? paymentMethods.map((pm: any) => (
                    <option key={pm.status_id} value={pm.status_name}>{pm.status_name}</option>
                  )) : (
                    // Fallback in case props aren't loaded yet
                    <>
                      <option value="Cash">Cash</option>
                      <option value="E-Wallet">E-Wallet</option>
                      <option value="Bank Transaction">Bank Transaction</option>
                    </>
                  )}
                </select>
              </div>

            </div>
          </div>

        </div>

        {/* --- FOOTER --- */}
        <div className={s.modalFooter} style={{ padding: '20px 24px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', marginTop: 0, display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={s.saveBtn} onClick={() => onSave(formData)}>Update Order</button>
        </div>

      </div>
    </div>
  );
};

export default OrderEditModal;