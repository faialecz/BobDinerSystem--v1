'use client';

import { useState } from 'react';
import styles from '@/css/suppliers.module.css';
import { LuX } from 'react-icons/lu';

interface AddSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  existingSuppliers?: { supplierName: string }[];
}

const EMPTY_FORM = {
  supplierName: '',
  address: '',
  contactPerson: '',
  contact: '',
  email: '',
  paymentTerms: 'Cash on Delivery',
};

export default function AddSupplierModal({ isOpen, onClose, onSuccess, existingSuppliers = [] }: AddSupplierModalProps) {
  const s = styles as Record<string, string>;
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dupError, setDupError] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setDupError('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.supplierName.trim()) return;

    // ── DUPLICATE NAME CHECK ──
    const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, ' ');
    const newName = normalize(form.supplierName);
    const isDuplicate = existingSuppliers.some(s => normalize(s.supplierName) === newName);
    if (isDuplicate) {
      setDupError(`"${form.supplierName.trim()}" already exists. Please use a different supplier name.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName: form.supplierName,
          address: form.address,
          contactPerson: form.contactPerson,
          contactNumber: form.contact,
          email: form.email,
          paymentTerms: form.paymentTerms,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess(data.message || 'Supplier created successfully!');
        handleClose();
      } else {
        setDupError(data.error || 'Failed to create supplier.');
      }
    } catch {
      setDupError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={s.modalOverlay}>
      <div className={s.modalContent}>
        <div className={s.modalHeader}>
          <div className={s.modalTitleGroup}>
            <h2 className={s.title}>Register New Supplier</h2>
            <p className={s.subText}>Create a profile for a new supplier.</p>
          </div>
          <LuX onClick={handleClose} className={s.closeIcon} />
        </div>

        <div className={`${s.modalForm} ${s.mt_20}`}>
          <h4 className={s.sectionTitle}>Company Information</h4>
          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label>Supplier Name</label>
              <input
                value={form.supplierName}
                onChange={e => { setDupError(''); setForm({ ...form, supplierName: e.target.value }); }}
                style={dupError && dupError.includes(form.supplierName.trim()) ? { borderColor: '#fca5a5' } : {}}
              />
            </div>
          </div>

          {/* ── DUPLICATE ERROR ── */}
          {dupError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: '#fee2e2', border: '1px solid #fca5a5',
              color: '#dc2626', borderRadius: '8px',
              padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500,
              marginBottom: '12px',
            }}>
              <span>⚠</span> {dupError}
            </div>
          )}

          <div className={s.formGroupFull}>
            <label>Address</label>
            <input
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <h4 className={s.sectionTitle}>Primary Contact</h4>
          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label>Contact Person</label>
              <input
                value={form.contactPerson}
                onChange={e => setForm({ ...form, contactPerson: e.target.value })}
              />
            </div>
            <div className={s.formGroup}>
              <label>Contact No.</label>
              <input
                value={form.contact}
                onChange={e => setForm({ ...form, contact: e.target.value.replace(/[^\d]/g, '') })}
              />
            </div>
          </div>
          <div className={s.formGroupFull}>
            <label>Email Address</label>
            <input
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <h4 className={s.sectionTitle}>Terms & Notes</h4>
          <div className={s.formGroup}>
            <label>Payment Terms</label>
            <select
              value={form.paymentTerms}
              onChange={e => setForm({ ...form, paymentTerms: e.target.value })}
            >
              <option>Cash on Delivery</option>
              <option>Card</option>
            </select>
          </div>

          <div className={s.modalFooter}>
            <button type="button" onClick={handleClose} className={s.cancelBtn}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !form.supplierName.trim()}
              className={s.saveBtn}
            >
              {isSubmitting ? 'Creating…' : 'Create Supplier'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}