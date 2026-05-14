'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from '@/css/suppliers.module.css';
import TopHeader from '@/components/layout/TopHeader';
import PageHeader from '@/components/layout/PageHeader';
import ArchiveSupplierTable from './archiveSupModal';
import {
  LuSearch,
  LuEllipsisVertical,
  LuChevronUp,
  LuChevronDown,
  LuPencil,
  LuArchive,
  LuChevronRight,
  LuChevronLeft,
  LuX,
  LuPrinter,
  LuPhone,
  LuMail,
  LuMapPin,
  LuUser,
} from 'react-icons/lu';

/* ================= TYPES ================= */

type Supplier = {
  supplier_id: number;
  supplier_name: string;
  contact_person: string;
  supplier_contact: string;
  supplier_email: string;
  supplier_address: string;
  paymentTerms?: string;
  is_archived?: boolean;
  status_code?: string;
  status?: string;
  created_at?: string;
  date_added?: string | null;
  inactive_date?: string | null;
};

type SortKey = keyof Supplier;

const ROWS_PER_PAGE = 10;

/* ================= HELPERS ================= */

const getViewStatusClass = (isArchived: boolean | undefined, s: Record<string, string>) => {
  return isArchived ? s.viewStatusArchived : s.viewStatusActive;
};

const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, ' ');

const CREATE_REQUIRED: { field: keyof typeof EMPTY_CREATE_FORM; label: string }[] = [
  { field: 'supplierName', label: 'Supplier Name' },
  { field: 'address',      label: 'Address' },
  { field: 'contactPerson', label: 'Contact Person' },
  { field: 'contact',      label: 'Contact No.' },
];

const EMPTY_CREATE_FORM = {
  supplierName: '',
  address: '',
  contactPerson: '',
  contact: '',
  email: '',
  paymentTerms: 'Cash on Delivery'
};

// Required fields for EDIT modal
const EDIT_REQUIRED: { field: keyof Supplier; label: string }[] = [
  { field: 'supplier_name',    label: 'Supplier Name' },
  { field: 'supplier_address', label: 'Address' },
  { field: 'contact_person',   label: 'Contact Person' },
  { field: 'supplier_contact', label: 'Contact No.' },
];

const errStyle = { borderColor: '#fca5a5', backgroundColor: '#fff5f5' };

// ── ADDED: matches Add Order LABEL_STYLE ──
const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  color: '#6b7280', marginBottom: '4px',
};

/* ================= COMPONENT ================= */

export default function Suppliers({
  role,
  onLogout,
  onNavigate,
}: {
  role: string;
  onLogout: () => void;
  onNavigate?: (tab: string, id?: string) => void;
}) {
  const s = styles as Record<string, string>;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [isArchiveView, setIsArchiveView] = useState(false);

  // Toast states
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // View modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedSupplierForView, setSelectedSupplierForView] = useState<Supplier | null>(null);
  const [showSupplierItems, setShowSupplierItems] = useState(false);
  const [supplierItems, setSupplierItems] = useState<{ item_name: string; brand_name: string; sku: string; inventory_id: number; inventory_brand_id: number }[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // --- CREATE MODAL STATE ---
  const [showModal, setShowModal] = useState(false);
  const [supplierFormData, setSupplierFormData] = useState({ ...EMPTY_CREATE_FORM });
  const [createDupError, setCreateDupError] = useState('');
  const [createFormError, setCreateFormError] = useState('');
  const [createEmptyFields, setCreateEmptyFields] = useState<Set<string>>(new Set());
  const [showCreateCancelConfirm, setShowCreateCancelConfirm] = useState(false);
  // ── ADDED ──
  const [createSubmitAttempted, setCreateSubmitAttempted] = useState(false);

  // --- EDIT MODAL STATE ---
  const [editModal, setEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Supplier | null>(null);
  const [editOriginalData, setEditOriginalData] = useState<Supplier | null>(null);
  const [editDupError, setEditDupError] = useState('');
  const [editFormError, setEditFormError] = useState('');
  const [editEmptyFields, setEditEmptyFields] = useState<Set<string>>(new Set());
  const [editSubmitAttempted, setEditSubmitAttempted] = useState(false);
  const [showEditCancelConfirm, setShowEditCancelConfirm] = useState(false);

  const [sortConfig, setSortConfig] = useState<{
    key: SortKey | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: null, direction: null });

  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  /* ================= FETCH ================= */

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch Suppliers', err);
      setSuppliers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, []);


  /* ================= CREATE MODAL HELPERS ================= */

  const isCreateFormDirty = (): boolean => {
    return !!(
      supplierFormData.supplierName.trim() ||
      supplierFormData.address.trim() ||
      supplierFormData.contactPerson.trim() ||
      supplierFormData.contact.trim() ||
      supplierFormData.email.trim()
    );
  };

  const clearCreateEmpty = (field: string) => {
    setCreateEmptyFields(prev => { const next = new Set(prev); next.delete(field); return next; });
    if (createFormError) setCreateFormError('');
  };

  const validateCreate = (): boolean => {
    const missing: string[] = [];
    const empty = new Set<string>();
    CREATE_REQUIRED.forEach(({ field, label }) => {
      if (!supplierFormData[field].trim()) { missing.push(label); empty.add(field); }
    });
    setCreateEmptyFields(empty);
    if (missing.length > 0) {
      setCreateFormError(`Please fill in the following required fields: ${missing.join(', ')}.`);
      return false;
    }
    setCreateFormError('');
    return true;
  };

  const handleCloseCreateModal = () => {
    setShowModal(false);
    setSupplierFormData({ ...EMPTY_CREATE_FORM });
    setCreateDupError('');
    setCreateFormError('');
    setCreateEmptyFields(new Set());
    setShowCreateCancelConfirm(false);
    setCreateSubmitAttempted(false); // ── ADDED ──
  };

    const handleCreateCancelClick = () => {
      if (isCreateFormDirty()) setShowCreateCancelConfirm(true);
      else handleCloseCreateModal();
    };

    /* ================= EDIT MODAL HELPERS ================= */

    const isEditFormDirty = (): boolean => {
      if (!editFormData || !editOriginalData) return false;
      return (
        editFormData.supplier_name    !== editOriginalData.supplier_name    ||
        editFormData.supplier_address !== editOriginalData.supplier_address ||
        editFormData.contact_person   !== editOriginalData.contact_person   ||
        editFormData.supplier_contact !== editOriginalData.supplier_contact ||
        editFormData.supplier_email   !== editOriginalData.supplier_email   ||
        (editFormData.paymentTerms    !== editOriginalData.paymentTerms)    ||
        editFormData.status_code      !== editOriginalData.status_code
      );
    };

    const clearEditEmpty = (field: string) => {
      setEditEmptyFields(prev => { const next = new Set(prev); next.delete(field); return next; });
      if (editFormError) setEditFormError('');
    };

    const validateEdit = (): boolean => {
      if (!editFormData) return false;
      const missing: string[] = [];
      const empty = new Set<string>();
      EDIT_REQUIRED.forEach(({ field, label }) => {
        if (!String(editFormData[field] ?? '').trim()) { missing.push(label); empty.add(field); }
      });
      setEditEmptyFields(empty);
      if (missing.length > 0) {
        setEditFormError(`Please fill in the following required fields: ${missing.join(', ')}.`);
        return false;
      }
      setEditFormError('');
      return true;
    };

    const handleOpenEditModal = (sup: Supplier) => {
      setEditFormData({ ...sup });
      setEditOriginalData({ ...sup });
      setEditDupError('');
      setEditFormError('');
      setEditEmptyFields(new Set());
      setEditSubmitAttempted(false);
      setShowEditCancelConfirm(false);
      setEditModal(true);
      setOpenMenuId(null);
    };

    const handleCloseEditModal = () => {
      setEditModal(false);
      setEditFormData(null);
      setEditOriginalData(null);
      setEditDupError('');
      setEditFormError('');
      setEditEmptyFields(new Set());
      setEditSubmitAttempted(false);
      setShowEditCancelConfirm(false);
    };

    const handleEditCancelClick = () => {
      if (isEditFormDirty()) setShowEditCancelConfirm(true);
      else handleCloseEditModal();
    };

    /* ================= HANDLERS ================= */

    const handleCreateSupplier = async () => {
      setCreateSubmitAttempted(true); // ── ADDED ──
      if (!validateCreate()) return;

      const newName = normalize(supplierFormData.supplierName);
      const isDuplicate = suppliers.some(sup => normalize(sup.supplier_name) === newName);
      if (isDuplicate) {
        setCreateDupError(`"${supplierFormData.supplierName.trim()}" already exists. Please use a different supplier name.`);
        return;
      }

    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName: supplierFormData.supplierName,
          address: supplierFormData.address,
          contactPerson: supplierFormData.contactPerson,
          contactNumber: supplierFormData.contact,
          email: supplierFormData.email,
          paymentTerms: supplierFormData.paymentTerms,
        })
      });
      const data = await response.json();
      if (response.ok) {
        await fetchSuppliers();
        handleCloseCreateModal();
        setToastMessage(data.message || 'Supplier created successfully!');
        setIsError(false);
        setShowToast(true);
      } else {
        setToastMessage(data.error || 'Failed to create supplier.');
        setIsError(true);
        setShowToast(true);
      }
    } catch {
      setToastMessage('Network error. Please try again.');
      setIsError(true);
      setShowToast(true);
    }
  };

  const handleEditSupplier = async () => {
    if (!editFormData) return;

    setEditSubmitAttempted(true);

    // 1. Required fields
    if (!validateEdit()) return;

    // 2. No changes check
    if (!isEditFormDirty()) {
      setEditFormError('No changes detected. Please modify at least one field before updating.');
      return;
    }

    // 3. Duplicate name check
    const newName = normalize(editFormData.supplier_name);
    const conflict = suppliers.find(
      sup => normalize(sup.supplier_name) === newName && sup.supplier_id !== editFormData.supplier_id
    );
    if (conflict) {
      setEditDupError(`"${editFormData.supplier_name.trim()}" already exists. Please use a different supplier name.`);
      return;
    }

    try {
      const response = await fetch(`/api/suppliers/${editFormData.supplier_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName: editFormData.supplier_name,
          address: editFormData.supplier_address,
          contactPerson: editFormData.contact_person,
          contactNumber: editFormData.supplier_contact,
          email: editFormData.supplier_email,
          paymentTerms: editFormData.paymentTerms,
        })
      });
      const data = await response.json();
      if (response.ok) {
        // If status changed, toggle it via the archive endpoint
        if (editFormData.status_code !== editOriginalData?.status_code) {
          await fetch(`/api/suppliers/archive/${editFormData.supplier_id}`, { method: 'PUT' });
        }
        await fetchSuppliers();
        handleCloseEditModal();
        setToastMessage(data.message || 'Supplier updated successfully!');
        setIsError(false);
        setShowToast(true);
      } else {
        setToastMessage(data.error || 'Failed to update supplier.');
        setIsError(true);
        setShowToast(true);
      }
    } catch {
      setToastMessage('Network error. Please try again.');
      setIsError(true);
      setShowToast(true);
    }
  };

  const handleToggleArchive = async (id: number) => {
    try {
      const response = await fetch(`/api/suppliers/archive/${id}`, { method: 'PUT' });
      if (response.ok) {
        const apiData = await response.json();
        setSuppliers(prev =>
          prev.map(sup => sup.supplier_id === id
            ? { ...sup, is_archived: false, status_code: apiData.is_archived ? 'INACTIVE' : 'ACTIVE', status: apiData.is_archived ? 'Inactive' : 'Active' }
            : sup)
        );
        setToastMessage(apiData.message);
        setIsError(false);
        setShowToast(true);
        setOpenMenuId(null);
      } else {
        const errorData = await response.json();
        setToastMessage(`Failed: ${errorData.error}`);
        setIsError(true);
        setShowToast(true);
      }
    } catch {
      setToastMessage('Network error.');
      setIsError(true);
      setShowToast(true);
    }
  };

  const handleToggleStatusFromView = async () => {
    if (!selectedSupplierForView) return;
    await handleToggleArchive(selectedSupplierForView.supplier_id);
    const nowInactive = selectedSupplierForView.status_code !== 'INACTIVE';
    setSelectedSupplierForView({
      ...selectedSupplierForView,
      is_archived:  nowInactive,
      status_code:  nowInactive ? 'INACTIVE' : 'ACTIVE',
      status:       nowInactive ? 'Inactive' : 'Active',
    });
  };

  const handleSort = (key: SortKey, direction: 'asc' | 'desc') => {
    if (!key) return;
    setSortConfig({ key, direction });
  };

  const handleOpenView = (supplier: Supplier) => {
    setSelectedSupplierForView(supplier);
    setShowViewModal(true);
    setShowSupplierItems(false);
    setSupplierItems([]);
  };

  const closeViewModal = () => {
    setShowViewModal(false);
    setSelectedSupplierForView(null);
    setShowSupplierItems(false);
    setSupplierItems([]);
  };

  const handleToggleSupplierItems = async () => {
    if (showSupplierItems) { setShowSupplierItems(false); return; }
    if (!selectedSupplierForView) return;
    setLoadingItems(true);
    setShowSupplierItems(true);
    try {
      const res = await fetch(`/api/suppliers/${selectedSupplierForView.supplier_id}/items`);
      const data = await res.json();
      setSupplierItems(Array.isArray(data) ? data : []);
    } catch { setSupplierItems([]); }
    finally { setLoadingItems(false); }
  };

  const [showPrintConfirm, setShowPrintConfirm] = useState(false);

  const handlePrint = () => {
    if (!selectedSupplierForView) return;
    setShowPrintConfirm(true);
  };

  const executePrint = async (includeItems: boolean) => {
    setShowPrintConfirm(false);
    if (!selectedSupplierForView) return;

    let items: { item_name: string; brand_name: string; uom: string }[] = [];
    if (includeItems) {
      try {
        const res = await fetch(`/api/suppliers/${selectedSupplierForView.supplier_id}/items`);
        const data = await res.json();
        items = Array.isArray(data) ? data : [];
      } catch { items = []; }
    }

    const pw = window.open('', '_blank');
    if (!pw) {
      alert('Pop-up blocked. Please allow pop-ups for this site in your browser settings, then try again.');
      return;
    }

    pw.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Supplier Profile - No. ${String(selectedSupplierForView.supplier_id).padStart(4, '0')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 24px 28px; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 12px; }
    .company h1 { font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .company p  { font-size: 10px; line-height: 1.65; }
    .receipt-block { text-align: right; }
    .receipt-title { font-size: 13px; font-weight: 700; letter-spacing: 1px; margin-bottom: 4px; }
    .receipt-no    { font-size: 24px; font-weight: 900; color: #1a4263; letter-spacing: 2px; }
    .receipt-no span { font-size: 13px; font-weight: 700; color: #000; }
    .section { margin-bottom: 16px; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 10px; color: #1a4263; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .info-item label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #666; display: block; margin-bottom: 2px; }
    .info-item span  { font-size: 11px; color: #000; }
    .info-full { margin-bottom: 10px; }
    .info-full label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #666; display: block; margin-bottom: 2px; }
    .info-full span  { font-size: 11px; color: #000; }
    .status-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .print-footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 9px; color: #666; display: flex; justify-content: space-between; }
    @media print { body { padding: 10px 14px; } @page { margin: 0.4in; size: letter; } }
  </style>
</head>
<body>
  <div class="top">
    <div class="company">
      <h1>AE Samonte Merchandise</h1>
      <p>ALAIN E. SAMONTE - Prop.</p>
      <p>VAT Reg. TIN : 263-884-036-00000</p>
      <p>1457 A. Leon Guinto St., Zone 73 Barangay 676,</p>
      <p>1000 Ermita NCR, City of Manila, First District, Philippines</p>
    </div>
    <div class="receipt-block">
      <div class="receipt-title">SUPPLIER PROFILE</div>
      <div class="receipt-no"><span>S-</span>${String(selectedSupplierForView.supplier_id).padStart(4, '0')}</div>
      <div style="margin-top:6px; font-size:10px;">Printed: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      ${selectedSupplierForView.date_added ? `<div style="margin-top:2px; font-size:10px; color:#666;">Date Added: ${selectedSupplierForView.date_added}</div>` : ''}
      <div style="margin-top:4px;"><span class="status-badge">${selectedSupplierForView.is_archived ? 'INACTIVE' : 'ACTIVE'}</span></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Company Information</div>
    <div class="info-full">
      <label>Supplier Name</label>
      <span style="font-size:15px; font-weight:700;">${selectedSupplierForView.supplier_name}</span>
    </div>
    <div class="info-full">
      <label>Address</label>
      <span>${selectedSupplierForView.supplier_address}</span>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Contact Information</div>
    <div class="info-grid">
      <div class="info-item">
        <label>Contact Person</label>
        <span>${selectedSupplierForView.contact_person}</span>
      </div>
      <div class="info-item">
        <label>Contact Number</label>
        <span>${selectedSupplierForView.supplier_contact}</span>
      </div>
    </div>
    <div class="info-full" style="margin-top:10px;">
      <label>Email Address</label>
      <span>${selectedSupplierForView.supplier_email}</span>
    </div>
  </div>
  ${selectedSupplierForView.paymentTerms ? `
  <div class="section">
    <div class="section-title">Payment Terms</div>
    <div class="info-item">
      <label>Terms</label>
      <span>${selectedSupplierForView.paymentTerms}</span>
    </div>
  </div>
  ` : ''}
  ${includeItems ? `
  <div class="section">
    <div class="section-title">Inventory Items</div>
    ${items.length === 0
      ? '<p style="font-size:10px;color:#94a3b8;">No items linked to this supplier.</p>'
      : `<table style="width:100%;border-collapse:collapse;font-size:10px;">
          <thead>
            <tr style="border-bottom:1px solid #ccc;">
              <th style="text-align:left;padding:4px 6px;color:#666;font-size:9px;text-transform:uppercase;">Item</th>
              <th style="text-align:left;padding:4px 6px;color:#666;font-size:9px;text-transform:uppercase;">Brand</th>
              <th style="text-align:left;padding:4px 6px;color:#666;font-size:9px;text-transform:uppercase;">SKU</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => `
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:4px 6px;font-weight:600;">${it.item_name}</td>
                <td style="padding:4px 6px;color:#475569;">${it.brand_name}</td>
                <td style="padding:4px 6px;color:#475569;font-family:monospace;">${(it as any).sku ?? '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>`
    }
  </div>
  ` : ''}
  <div class="print-footer">
    <div>AE Samonte Merchandise — Supplier Management System</div>
    <div>Document generated on ${new Date().toLocaleString('en-PH')}</div>
  </div>
</body>
</html>`);

    pw.document.close();
    pw.focus();
    pw.print();
  };

  /* ================= DATA PROCESSING ================= */

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return suppliers.filter(sup => {
      // Archive view shows only truly archived (handled by backend — not returned in main list)
      // Main view shows both Active and Inactive
      if (isArchiveView) return false; // archive view handled separately
      const matchesStatus = statusFilter === 'All' ? true
        : statusFilter === 'Active'   ? sup.status_code === 'ACTIVE'
        : sup.status_code === 'INACTIVE';
      return matchesStatus && (
        sup.supplier_id.toString().includes(term) ||
        (sup.supplier_name || '').toLowerCase().includes(term) ||
        (sup.contact_person || '').toLowerCase().includes(term) ||
        (sup.supplier_contact || '').toLowerCase().includes(term) ||
        (sup.supplier_email || '').toLowerCase().includes(term) ||
        (sup.supplier_address || '').toLowerCase().includes(term)
      );
    });
  }, [suppliers, searchTerm, isArchiveView, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (!sortConfig.key || !sortConfig.direction) {
      return arr.sort((a, b) => {
        const numA = Number(String(a.supplier_id).replace(/\D/g, '')) || 0;
        const numB = Number(String(b.supplier_id).replace(/\D/g, '')) || 0;
        return numA - numB;
      });
    }
    const { key, direction } = sortConfig;
    return arr.sort((a, b) => {
      const A = a[key!];
      const B = b[key!];
      if (key === 'supplier_id') {
        const numA = Number(String(A).replace(/\D/g, '')) || 0;
        const numB = Number(String(B).replace(/\D/g, '')) || 0;
        return direction === 'asc' ? numA - numB : numB - numA;
      }
      const strA = String(A ?? '').toLowerCase();
      const strB = String(B ?? '').toLowerCase();
      if (strA < strB) return direction === 'asc' ? -1 : 1;
      if (strA > strB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortConfig]);

  /* ================= PAGINATION ================= */

  const totalPages = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE));
  const paginated = sorted.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  const changePage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const renderPageNumbers = () => {
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) startPage = Math.max(1, endPage - maxVisiblePages + 1);
    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button key={i} className={currentPage === i ? s.pageCircleActive : s.pageCircle} onClick={() => setCurrentPage(i)}>
          {i}
        </button>
      );
    }
    return pages;
  };

  if (false) { /* dead skeleton block removed */ }

  const columns: { label: string; key: SortKey }[] = [
    { label: 'ID',             key: 'supplier_id' },
    { label: 'SUPPLIER NAME',  key: 'supplier_name' },
    { label: 'CONTACT PERSON', key: 'contact_person' },
    { label: 'CONTACT NUMBER', key: 'supplier_contact' },
    { label: 'EMAIL',          key: 'supplier_email' },
    { label: 'ADDRESS',        key: 'supplier_address' },
  ];

  /* ================= RENDER ================= */

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      {/* TOAST */}
      {showToast && (
        <div className={s.toastOverlay}>
          <div className={s.alertBox}>
            <div className={`${s.alertHeader} ${isError ? s.alertHeaderError : ''}`}>
              <div className={`${s.checkCircle} ${isError ? s.checkCircleError : ''}`}>
                {isError ? '!' : '✓'}
              </div>
            </div>
            <div className={s.alertBody}>
              <h2 className={s.alertTitle}>{isError ? 'Oops!' : 'Success!'}</h2>
              <p className={s.alertMessage}>{toastMessage}</p>
              <button className={`${s.okButton} ${isError ? s.okButtonError : ''}`} onClick={() => setShowToast(false)}>OK</button>
            </div>
          </div>
        </div>
      )}

      <div className={s.mainContent}>
        <PageHeader title="SUPPLIERS" subtitle="Manage vendor relationships and contact information." />
        {isArchiveView ? (
          <ArchiveSupplierTable
            suppliers={suppliers}
            onRestore={handleToggleArchive}
            onBack={() => setIsArchiveView(false)}
          />
        ) : (
          <div className={s.tableContainer}>
            <div className={s.header}>
              <h2 className={s.title}>Suppliers</h2>
              <div className={s.controls}>
                <button className={s.archiveIconBtn} onClick={() => setIsArchiveView(true)} title="View Archives">
                  <LuArchive size={20} />
                </button>
                {/* Status filter */}
                <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
                  {(['All', 'Active', 'Inactive'] as const).map(s2 => (
                    <button key={s2} onClick={() => setStatusFilter(s2)}
                      style={{
                        padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                        background: statusFilter === s2 ? '#fff' : 'transparent',
                        color: statusFilter === s2
                          ? s2 === 'Active' ? '#15803d' : s2 === 'Inactive' ? '#b91c1c' : '#1a4263'
                          : '#64748b',
                        boxShadow: statusFilter === s2 ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      }}>
                      {s2}
                    </button>
                  ))}
                </div>
                <div className={s.searchWrapper}>
                  <input
                    className={s.searchInput}
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  <LuSearch size={18} />
                </div>
                <button className={s.addButton} onClick={() => setShowModal(true)}>ADD</button>
              </div>
            </div>

            <div className={s.tableResponsive}>
              <table className={s.table}>
                <thead>
                  <tr>
                    {columns.map(col => {
                      const isSortable = col.key === 'supplier_id'
                      return (
                        <th key={col.key!}>
                          <div className={isSortable ? s.sortableHeader : s.nonSortableHeader}>
                            <span>{col.label}</span>
                            {isSortable && (
                              <div className={s.sortIconsStack}>
                                <span
                                  className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''}
                                  onClick={() => handleSort(col.key, 'asc')}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <LuChevronUp size={12} />
                                </span>
                                <span
                                  className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''}
                                  onClick={() => handleSort(col.key, 'desc')}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <LuChevronDown size={12} />
                                </span>
                              </div>
                            )}
                          </div>
                        </th>
                      )
                    })}
                    <th className={s.nonSortableHeader} style={{ whiteSpace: 'nowrap' }}>STATUS</th>
                    <th className={s.actionHeader}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                {isLoading ? (
                  <>
                    {[0,1,2,3,4,5,6,7].map(i => (
                      <tr key={i}>
                        {[40,140,120,100,160,200,40].map((w,j) => (
                          <td key={j}>
                            <div style={{
                              height: '12px',
                              borderRadius: '4px',
                              background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)',
                              backgroundSize: '600px 100%',
                              animation: 'shimmer 1.4s infinite linear',
                              width: `${w}px`,
                            }} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ) : paginated.length ? (
                    paginated.map((sup, i) => (
                      <tr key={sup.supplier_id} className={i % 2 ? s.altRow : ''} onClick={() => handleOpenView(sup)} style={{ cursor: 'pointer' }}>
                        <td>{sup.supplier_id}</td>
                        <td><strong>{sup.supplier_name}</strong></td>
                        <td>{sup.contact_person}</td>
                        <td>{sup.supplier_contact}</td>
                        <td>{sup.supplier_email}</td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sup.supplier_address}</td>
                        <td onClick={e => e.stopPropagation()}>
                          {(() => {
                            const isInactive = sup.status_code === 'INACTIVE';
                            const daysLeft = sup.inactive_date
                              ? 30 - Math.floor((Date.now() - new Date(sup.inactive_date).getTime()) / 86400000)
                              : null;
                            return (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                                background: isInactive ? '#fef9c3' : '#dcfce7',
                                color:      isInactive ? '#854d0e' : '#15803d',
                              }}>
                                {isInactive ? 'Inactive' : 'Active'}
                                {isInactive && daysLeft !== null && daysLeft > 0 && (
                                  <span style={{ fontWeight: 400, fontSize: '0.7rem' }}>({daysLeft}d to archive)</span>
                                )}
                                {isInactive && daysLeft !== null && daysLeft <= 0 && (
                                  <span style={{ fontWeight: 400, fontSize: '0.7rem' }}>(archiving soon)</span>
                                )}
                              </span>
                            );
                          })()}
                        </td>
                        <td className={s.actionCell} onClick={e => e.stopPropagation()}>
                          <LuEllipsisVertical className={s.moreIcon} onClick={() => setOpenMenuId(openMenuId === sup.supplier_id ? null : sup.supplier_id)} />
                          {openMenuId === sup.supplier_id && (
                            <div className={s.popupMenu}>
                              <button className={s.popBtnEdit} onClick={() => handleOpenEditModal(sup)}>
                                <LuPencil size={14} /> Edit
                              </button>
                              <button className={s.popBtnArchive} onClick={() => handleToggleArchive(sup.supplier_id)}>
                                <LuArchive size={14} /> Mark as Archive
                              </button>
                              <button className={s.closeX} onClick={() => setOpenMenuId(null)}>×</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>No suppliers found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className={s.footer}>
              <div className={s.showDataText}>
                Showing <span className={s.countBadge}>
                {Math.min(currentPage * ROWS_PER_PAGE, sorted.length)}
              </span> of {sorted.length}
              </div>
              <div className={s.pagination}>
                <button className={s.nextBtn} disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>
                  <LuChevronLeft />
                </button>
                {renderPageNumbers()}
                <button className={s.nextBtn} disabled={currentPage >= totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>
                  <LuChevronRight />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= NEW SUPPLIER MODAL ================= */}
      {showModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <div className={s.modalTitleGroup}>
                <h2 className={s.title}>Register New Supplier</h2>
                <p className={s.subText}>Create a profile for a new supplier.</p>
              </div>
              <LuX onClick={handleCreateCancelClick} className={s.closeIcon} />
            </div>

            <div className={`${s.modalForm} ${s.mt_20}`}>
              <h4 className={s.sectionTitle}>Company Information</h4>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  {/* ── CHANGED: label now uses LABEL_STYLE, turns red on error ── */}
                  <label style={{ ...LABEL_STYLE, color: createSubmitAttempted && createEmptyFields.has('supplierName') ? '#dc2626' : '#6b7280' }}>
                    Supplier Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    name="supplierName"
                    value={supplierFormData.supplierName}
                    onChange={e => {
                      setCreateDupError('');
                      clearCreateEmpty('supplierName');
                      setSupplierFormData({ ...supplierFormData, supplierName: e.target.value });
                    }}
                    style={createEmptyFields.has('supplierName') || createDupError ? errStyle : {}}
                    placeholder="e.g. Juan dela Cruz Trading"
                  />
                  {/* ── ADDED: helper text below field ── */}
                  {createSubmitAttempted && createEmptyFields.has('supplierName') && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Supplier name is required.</p>
                  )}
                </div>
              </div>

              {createDupError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500, marginBottom: '12px' }}>
                  <span>⚠</span> {createDupError}
                </div>
              )}

              <div className={s.formGroupFull}>
                {/* ── CHANGED ── */}
                <label style={{ ...LABEL_STYLE, color: createSubmitAttempted && createEmptyFields.has('address') ? '#dc2626' : '#6b7280' }}>
                  Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  name="address"
                  value={supplierFormData.address}
                  onChange={e => { clearCreateEmpty('address'); setSupplierFormData({ ...supplierFormData, address: e.target.value }); }}
                  style={createEmptyFields.has('address') ? errStyle : {}}
                  placeholder="Street, Barangay, City"
                />
                {/* ── ADDED ── */}
                {createSubmitAttempted && createEmptyFields.has('address') && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Address is required.</p>
                )}
              </div>

              <h4 className={s.sectionTitle}>Primary Contact</h4>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  {/* ── CHANGED ── */}
                  <label style={{ ...LABEL_STYLE, color: createSubmitAttempted && createEmptyFields.has('contactPerson') ? '#dc2626' : '#6b7280' }}>
                    Contact Person <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    name="contactPerson"
                    value={supplierFormData.contactPerson}
                    onChange={e => { clearCreateEmpty('contactPerson'); setSupplierFormData({ ...supplierFormData, contactPerson: e.target.value }); }}
                    style={createEmptyFields.has('contactPerson') ? errStyle : {}}
                    placeholder="Full name"
                  />
                  {/* ── ADDED ── */}
                  {createSubmitAttempted && createEmptyFields.has('contactPerson') && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Contact person is required.</p>
                  )}
                </div>
                <div className={s.formGroup}>
                  {/* ── CHANGED ── */}
                  <label style={{ ...LABEL_STYLE, color: createSubmitAttempted && createEmptyFields.has('contact') ? '#dc2626' : '#6b7280' }}>
                    Contact No. <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    name="contact"
                    value={supplierFormData.contact}
                    onChange={e => { clearCreateEmpty('contact'); setSupplierFormData({ ...supplierFormData, contact: e.target.value.replace(/[^\d]/g, '').slice(0, 11) }); }}
                    style={createEmptyFields.has('contact') ? errStyle : {}}
                    placeholder="09XXXXXXXXX"
                    maxLength={11}
                  />
                  {/* ── ADDED ── */}
                  {createSubmitAttempted && createEmptyFields.has('contact') && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Contact number is required.</p>
                  )}
                </div>
              </div>

              <div className={s.formGroupFull}>
                <label style={{ ...LABEL_STYLE }}>Email Address</label>
                <input
                  name="email"
                  value={supplierFormData.email}
                  onChange={e => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                  placeholder="supplier@email.com"
                />
              </div>

              <h4 className={s.sectionTitle}>Terms & Notes</h4>
              <div className={s.formGroup}>
                <label style={{ ...LABEL_STYLE }}>Payment Terms</label>
                <select
                  name="paymentTerms"
                  value={supplierFormData.paymentTerms}
                  onChange={e => setSupplierFormData({ ...supplierFormData, paymentTerms: e.target.value })}
                >
                  <option>Cash on Delivery</option>
                  <option>Bank Transaction</option>
                </select>
              </div>

              {createFormError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '12px 16px', fontSize: '0.85rem', fontWeight: 500, marginTop: '8px' }}>
                  ⚠ {createFormError}
                </div>
              )}

              <div className={s.modalFooter}>
                <button type="button" onClick={handleCreateCancelClick} className={s.cancelBtn}>Cancel</button>
                <button type="button" onClick={handleCreateSupplier} className={s.saveBtn}>Create Supplier</button>
              </div>
            </div>
          </div>

          {/* Create discard confirm */}
          {showCreateCancelConfirm && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCreateCancelConfirm(false)}>
              <div style={{ background: '#fff', borderRadius: '20px', padding: '40px 36px', width: '380px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⚠️</div>
                <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px', color: '#111' }}>Discard Changes?</p>
                <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '28px' }}>All entered information will be lost.</p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button onClick={() => setShowCreateCancelConfirm(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1.5px solid #ddd', background: '#fff', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', color: '#333' }}>Keep Editing</button>
                  <button onClick={handleCloseCreateModal} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#ef4444', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', color: '#fff' }}>Yes, Discard</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= EDIT SUPPLIER MODAL ================= */}
      {editModal && editFormData && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <div className={s.modalTitleGroup}>
                <h2 className={s.title}>Edit Supplier</h2>
                <p className={s.subText}>Update supplier information.</p>
              </div>
              <LuX onClick={handleEditCancelClick} className={s.closeIcon} />
            </div>

            <div className={`${s.modalForm} ${s.mt_20}`}>
              <h4 className={s.sectionTitle}>Company Information</h4>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  {/* ── CHANGED ── */}
                  <label style={{ ...LABEL_STYLE, color: editSubmitAttempted && editEmptyFields.has('supplier_name') ? '#dc2626' : '#6b7280' }}>
                    Supplier Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    value={editFormData.supplier_name}
                    onChange={e => {
                      setEditDupError('');
                      clearEditEmpty('supplier_name');
                      setEditFormData({ ...editFormData, supplier_name: e.target.value });
                    }}
                    style={editEmptyFields.has('supplier_name') ? { borderColor: '#f87171', backgroundColor: '#fff5f5' } : editDupError ? errStyle : {}}
                  />
                  {/* ── ADDED ── */}
                  {editSubmitAttempted && editEmptyFields.has('supplier_name') && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Supplier name is required.</p>
                  )}
                </div>
              </div>

              {editDupError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500, marginBottom: '12px' }}>
                  <span>⚠</span> {editDupError}
                </div>
              )}

              <div className={s.formGroupFull}>
                {/* ── CHANGED ── */}
                <label style={{ ...LABEL_STYLE, color: editSubmitAttempted && editEmptyFields.has('supplier_address') ? '#dc2626' : '#6b7280' }}>
                  Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  value={editFormData.supplier_address}
                  onChange={e => { clearEditEmpty('supplier_address'); setEditFormData({ ...editFormData, supplier_address: e.target.value }); }}
                  style={editEmptyFields.has('supplier_address') ? { borderColor: '#f87171', backgroundColor: '#fff5f5' } : {}}
                />
                {/* ── ADDED ── */}
                {editSubmitAttempted && editEmptyFields.has('supplier_address') && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Address is required.</p>
                )}
              </div>

              <h4 className={s.sectionTitle}>Primary Contact</h4>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  {/* ── CHANGED ── */}
                  <label style={{ ...LABEL_STYLE, color: editSubmitAttempted && editEmptyFields.has('contact_person') ? '#dc2626' : '#6b7280' }}>
                    Contact Person <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    value={editFormData.contact_person}
                    onChange={e => { clearEditEmpty('contact_person'); setEditFormData({ ...editFormData, contact_person: e.target.value }); }}
                    style={editEmptyFields.has('contact_person') ? { borderColor: '#f87171', backgroundColor: '#fff5f5' } : {}}
                  />
                  {/* ── ADDED ── */}
                  {editSubmitAttempted && editEmptyFields.has('contact_person') && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Contact person is required.</p>
                  )}
                </div>
                <div className={s.formGroup}>
                  {/* ── CHANGED ── */}
                  <label style={{ ...LABEL_STYLE, color: editSubmitAttempted && editEmptyFields.has('supplier_contact') ? '#dc2626' : '#6b7280' }}>
                    Contact No. <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    value={editFormData.supplier_contact}
                    onChange={e => { clearEditEmpty('supplier_contact'); setEditFormData({ ...editFormData, supplier_contact: e.target.value.replace(/[^\d]/g, '').slice(0, 11) }); }}
                    style={editEmptyFields.has('supplier_contact') ? { borderColor: '#f87171', backgroundColor: '#fff5f5' } : {}}
                    maxLength={11}
                  />
                  {/* ── ADDED ── */}
                  {editSubmitAttempted && editEmptyFields.has('supplier_contact') && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Contact number is required.</p>
                  )}
                </div>
              </div>

              <div className={s.formGroupFull}>
                <label style={{ ...LABEL_STYLE }}>Email Address</label>
                <input
                  value={editFormData.supplier_email}
                  onChange={e => setEditFormData({ ...editFormData, supplier_email: e.target.value })}
                />
              </div>

              <h4 className={s.sectionTitle}>Terms</h4>
              <div className={s.formGroup}>
                <label style={{ ...LABEL_STYLE }}>Payment Terms</label>
                <select
                  value={editFormData.paymentTerms || 'Cash on Delivery'}
                  onChange={e => setEditFormData({ ...editFormData, paymentTerms: e.target.value })}
                >
                  <option>Cash on Delivery</option>
                  <option>Bank Transaction</option>
                </select>
              </div>

              {editFormError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '12px 16px', fontSize: '0.85rem', fontWeight: 500, marginTop: '8px' }}>
                  ⚠ {editFormError}
                </div>
              )}

              {/* Status toggle */}
              <div style={{ marginTop: 16, padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>Supplier Status</p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                    {editFormData.status_code === 'INACTIVE' ? 'Marked inactive — will auto-archive after 30 days' : 'Currently active'}
                  </p>
                </div>
                <button type="button"
                  onClick={() => setEditFormData({
                    ...editFormData,
                    status_code: editFormData.status_code === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE',
                    is_archived: editFormData.status_code !== 'INACTIVE',
                  })}
                  style={{
                    padding: '6px 14px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                    background: editFormData.status_code === 'INACTIVE' ? '#dcfce7' : '#fee2e2',
                    color:      editFormData.status_code === 'INACTIVE' ? '#15803d' : '#b91c1c',
                  }}>
                  {editFormData.status_code === 'INACTIVE' ? '✓ Restore to Active' : '✕ Mark as Inactive'}
                </button>
              </div>

              <div className={s.modalFooter}>
                <button type="button" onClick={handleEditCancelClick} className={s.cancelBtn}>Cancel</button>
                <button type="button" onClick={handleEditSupplier} className={s.saveBtn}>Update Supplier</button>
              </div>
            </div>
          </div>

          {/* Edit discard confirm */}
          {showEditCancelConfirm && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowEditCancelConfirm(false)}>
              <div style={{ background: '#fff', borderRadius: '20px', padding: '40px 36px', width: '380px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⚠️</div>
                <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px', color: '#111' }}>Discard Changes?</p>
                <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '28px' }}>All entered information will be lost.</p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button onClick={() => setShowEditCancelConfirm(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1.5px solid #ddd', background: '#fff', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', color: '#333' }}>Keep Editing</button>
                  <button onClick={handleCloseEditModal} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: '#ef4444', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', color: '#fff' }}>Yes, Discard</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== VIEW / SUPPLIER PROFILE MODAL ===== */}
      {showViewModal && selectedSupplierForView && (
        <div className={s.viewBackdrop} onClick={closeViewModal}>
          <div className={s.viewModal} onClick={e => e.stopPropagation()}>
            <div className={s.viewModalHeader}>
              <div>
                <h2 className={s.viewCompanyName}>AE Samonte Merchandise</h2>
                <p className={s.viewOrderNumber}>S-{String(selectedSupplierForView.supplier_id).padStart(4, '0')}</p>
                {selectedSupplierForView.date_added && (
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                    Date Added: {selectedSupplierForView.date_added}
                  </p>
                )}
              </div>
              <div className={s.viewHeaderRight}>
                <button className={s.viewCloseBtn} onClick={closeViewModal}><LuX size={20} /></button>
              </div>
            </div>

            <div className={s.viewSupplierBanner}>
              <div>
                <p className={s.viewSupplierLabel}>Supplier Name</p>
                <p className={s.viewSupplierNameLarge}>{selectedSupplierForView.supplier_name}</p>
                <p className={s.viewSupplierAddress}>{selectedSupplierForView.supplier_address}</p>
              </div>
            </div>

            <div className={s.viewPrintBody}>
              <div className={s.viewCustomerSection}>
                <p className={s.viewSectionTitle}>Contact Information</p>
                <div className={s.viewSupplierDetailsGrid}>
                  <div className={s.viewDetailItem}>
                    <div className={s.viewDetailIcon}><LuUser size={14} /></div>
                    <div>
                      <p className={s.viewInfoLabel}>Contact Person</p>
                      <p className={s.viewInfoValue}>{selectedSupplierForView.contact_person || '—'}</p>
                    </div>
                  </div>
                  <div className={s.viewDetailItem}>
                    <div className={s.viewDetailIcon}><LuPhone size={14} /></div>
                    <div>
                      <p className={s.viewInfoLabel}>Contact Number</p>
                      <p className={s.viewInfoValue}>{selectedSupplierForView.supplier_contact || '—'}</p>
                    </div>
                  </div>
                  <div className={s.viewDetailItem}>
                    <div className={s.viewDetailIcon}><LuMail size={14} /></div>
                    <div>
                      <p className={s.viewInfoLabel}>Email Address</p>
                      <p className={s.viewInfoValue}>{selectedSupplierForView.supplier_email || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {selectedSupplierForView.paymentTerms && selectedSupplierForView.paymentTerms !== '—' && (
                <div className={s.viewCustomerSection}>
                  <p className={s.viewSectionTitle}>Terms</p>
                  <div className={s.viewTotalsWrapper}>
                    <div className={s.viewTotalsBox}>
                      <div className={s.viewTotalLine}>
                        <span>Payment Terms</span>
                        <span>{selectedSupplierForView.paymentTerms}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Collapsible inventory items */}
              <div className={s.viewCustomerSection}>
                <button
                  onClick={handleToggleSupplierItems}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <p className={s.viewSectionTitle} style={{ margin: 0 }}>Inventory Items</p>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"
                    style={{ transform: showSupplierItems ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {showSupplierItems && (
                  <div style={{ marginTop: 10 }}>
                    {loadingItems ? (
                      <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Loading...</p>
                    ) : supplierItems.length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No items linked to this supplier.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Item</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Brand</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>SKU</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplierItems.map((item, i) => (
                            <tr key={i}
                              onClick={() => { if (onNavigate) { closeViewModal(); onNavigate('Inventory', String(item.inventory_brand_id)); } }}
                              style={{ borderBottom: '1px solid #f1f5f9', cursor: onNavigate ? 'pointer' : undefined }}
                              title={onNavigate ? `View ${item.item_name} in Inventory` : undefined}
                            >
                              <td style={{ padding: '7px 8px', color: '#1e293b', fontWeight: 500 }}>{item.item_name}</td>
                              <td style={{ padding: '7px 8px', color: '#475569' }}>{item.brand_name}</td>
                              <td style={{ padding: '7px 8px', color: '#475569', fontFamily: 'monospace', fontSize: '0.78rem' }}>{item.sku}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className={s.viewModalFooter}>
              <button
                onClick={handleToggleStatusFromView}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                  background: selectedSupplierForView.status_code === 'INACTIVE' ? '#dcfce7' : '#fee2e2',
                  color:      selectedSupplierForView.status_code === 'INACTIVE' ? '#15803d' : '#b91c1c',
                }}>
                {selectedSupplierForView.status_code === 'INACTIVE' ? '✓ Restore to Active' : '✕ Mark as Inactive'}
              </button>
              <button className={s.viewBtnPrint} onClick={handlePrint}><LuPrinter size={14} /> Print</button>
            </div>
          </div>
        </div>
      )}

      {/* Print confirm dialog */}
      {showPrintConfirm && selectedSupplierForView && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowPrintConfirm(false)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '36px 32px', width: 360, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🖨️</div>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8, color: '#111' }}>Include Inventory Items?</p>
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: 24 }}>
              Do you want to include the list of items supplied by <strong>{selectedSupplierForView.supplier_name}</strong> in the printout?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => executePrint(false)}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', color: '#334155' }}>
                No, Skip
              </button>
              <button onClick={() => executePrint(true)}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#1a4263', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', color: '#fff' }}>
                Yes, Include
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}