'use client';

import { useState } from 'react';
import styles from '@/css/suppliers.module.css';
import { LuX } from 'react-icons/lu';

interface AddSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  existingSuppliers?: { supplier_name: string }[];
}

const EMPTY_FORM = {
  supplierName: '',
  address: '',
  contactPerson: '',
  contact: '',
  email: '',
  paymentTerms: 'Cash on Delivery',
};

const REQUIRED_FIELDS: (keyof typeof EMPTY_FORM)[] = [
  'supplierName',
  'address',
  'contactPerson',
  'contact',
];

const FIELD_LABELS: Record<string, string> = {
  supplierName: 'Supplier Name',
  address: 'Address',
  contactPerson: 'Contact Person',
  contact: 'Contact No.',
};

export default function AddSupplierModal({
  isOpen,
  onClose,
  onSuccess,
  existingSuppliers = [],
}: AddSupplierModalProps) {
  const s = styles as Record<string, string>;
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dupError, setDupError] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  // ── CHANGED: replaced fieldErrors with single banner + empty set for red borders ──
  const [formError, setFormError] = useState('');
  const [emptyFields, setEmptyFields] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const isFormDirty = (): boolean => {
    return !!(
      form.supplierName.trim() ||
      form.address.trim() ||
      form.contactPerson.trim() ||
      form.contact.trim() ||
      form.email.trim()
    );
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setDupError('');
    setFormError('');
    setEmptyFields(new Set());
    setShowCancelConfirm(false);
    onClose();
  };

  const handleCancelClick = () => {
    if (isFormDirty()) {
      setShowCancelConfirm(true);
    } else {
      handleClose();
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirm(false);
    handleClose();
  };

  // ── Clears a field's red border when user starts typing ──
  const clearEmpty = (field: string) => {
    setEmptyFields(prev => { const next = new Set(prev); next.delete(field); return next; });
    if (formError) setFormError('');
  };

  // ── CHANGED: single banner validation ──
  const validate = (): boolean => {
    const missing: string[] = [];
    const empty = new Set<string>();

    REQUIRED_FIELDS.forEach(field => {
      if (!form[field].trim()) {
        missing.push(FIELD_LABELS[field]);
        empty.add(field);
      }
    });

    setEmptyFields(empty);

    if (missing.length > 0) {
      setFormError(`Please fill in the following required fields: ${missing.join(', ')}.`);
      return false;
    }

    setFormError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, ' ');
    const newName = normalize(form.supplierName);
    const isDuplicate = existingSuppliers.some(s => normalize(s.supplier_name) === newName);
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

  const errorBorder = { borderColor: '#fca5a5', backgroundColor: '#fff5f5' };

  return (
    <div className={s.modalOverlay}>
      <div className={s.modalContent}>
        <div className={s.modalHeader}>
          <div className={s.modalTitleGroup}>
            <h2 className={s.title}>Register New Supplier</h2>
            <p className={s.subText}>Create a profile for a new supplier.</p>
          </div>
          <LuX onClick={handleCancelClick} className={s.closeIcon} />
        </div>

        <div className={`${s.modalForm} ${s.mt_20}`}>
          <h4 className={s.sectionTitle}>Company Information</h4>

          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label>
                Supplier Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                value={form.supplierName}
                onChange={e => {
                  setDupError('');
                  clearEmpty('supplierName');
                  setForm({ ...form, supplierName: e.target.value });
                }}
                style={emptyFields.has('supplierName') || dupError ? errorBorder : {}}
                placeholder="e.g. Juan dela Cruz Trading"
              />
            </div>
          </div>

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
            <label>
              Address <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              value={form.address}
              onChange={e => {
                clearEmpty('address');
                setForm({ ...form, address: e.target.value });
              }}
              style={emptyFields.has('address') ? errorBorder : {}}
              placeholder="Street, Barangay, City"
            />
          </div>

          <h4 className={s.sectionTitle}>Primary Contact</h4>
          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label>
                Contact Person <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                value={form.contactPerson}
                onChange={e => {
                  clearEmpty('contactPerson');
                  setForm({ ...form, contactPerson: e.target.value });
                }}
                style={emptyFields.has('contactPerson') ? errorBorder : {}}
                placeholder="Full name"
              />
            </div>

            <div className={s.formGroup}>
              <label>
                Contact No. <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                value={form.contact}
                onChange={e => {
                  clearEmpty('contact');
                  setForm({ ...form, contact: e.target.value.replace(/[^\d]/g, '').slice(0, 11) });
                }}
                style={emptyFields.has('contact') ? errorBorder : {}}
                placeholder="09XXXXXXXXX"
                maxLength={11}
              />
            </div>
          </div>

          <div className={s.formGroupFull}>
            <label>Email Address</label>
            <input
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="supplier@email.com"
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
              <option>Bank Transaction</option>
            </select>
          </div>

          {/* ── SINGLE BANNER above footer ── */}
          {formError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: '#fee2e2', border: '1px solid #fca5a5',
              color: '#dc2626', borderRadius: '8px',
              padding: '12px 16px', fontSize: '0.85rem', fontWeight: 500,
              marginTop: '8px',
            }}>
              ⚠ {formError}
            </div>
          )}

          <div className={s.modalFooter}>
            <button type="button" onClick={handleCancelClick} className={s.cancelBtn}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={s.saveBtn}
            >
              {isSubmitting ? 'Creating…' : 'Create Supplier'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Discard Changes confirm dialog ── */}
      {showCancelConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setShowCancelConfirm(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: '20px',
              padding: '40px 36px', width: '380px', textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⚠️</div>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px', color: '#111' }}>
              Discard Changes?
            </p>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '28px' }}>
              All entered information will be lost.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowCancelConfirm(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: '1.5px solid #ddd', background: '#fff',
                  fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', color: '#333',
                }}
              >
                Keep Editing
              </button>
              <button
                onClick={handleConfirmCancel}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: 'none', background: '#ef4444',
                  fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', color: '#fff',
                }}
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