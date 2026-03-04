'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from '@/css/suppliers.module.css';
import TopHeader from '@/components/layout/TopHeader';
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
  LuX
} from 'react-icons/lu';

/* ================= TYPES ================= */

type Supplier = {
  id: number;
  supplierName: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  address: string;
  is_archived?: boolean;  
};

type SortKey = keyof Supplier;

const ROWS_PER_PAGE = 10;

/* ================= COMPONENT ================= */

export default function Suppliers({
  role,
  onLogout
}: {
  role: string;
  onLogout: () => void;
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

  // --- CREATE MODAL STATE ---
  const [showModal, setShowModal] = useState(false);
  const [supplierFormData, setSupplierFormData] = useState({
    supplierName: '',
    address: '',
    contactPerson: '',
    contact: '',
    email: '',
    paymentTerms: 'Cash on Delivery'
  });

  // --- EDIT MODAL STATE ---
  const [editModal, setEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Supplier | null>(null);

  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: 'asc' | 'desc' | null;
  }>({
    key: 'id',
    direction: 'asc'
  });

  /* ================= FETCH ================= */

  const fetchSuppliers = async () => {  
    try {
      const res = await fetch('http://127.0.0.1:5000/api/suppliers')
      const data = await res.json()
      setSuppliers(data)
    } catch (err) {
      console.error('Failed to fetch Suppliers', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchSuppliers() }, []);

  /* ================= HANDLERS ================= */

  const handleCreateSupplier = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/api/suppliers', {
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
      })
      const data = await response.json()
      if (response.ok) {
        await fetchSuppliers()
        setShowModal(false)
        setSupplierFormData({
          supplierName: '', address: '', contactPerson: '',
          contact: '', email: '', paymentTerms: 'Cash on Delivery'
        })
        setToastMessage(data.message || 'Supplier created successfully!')
        setIsError(false)
        setShowToast(true)
      } else {
        setToastMessage(data.error || 'Failed to create supplier.')
        setIsError(true)
        setShowToast(true)
      }
    } catch (err) {
      setToastMessage('Network error. Please try again.')
      setIsError(true)
      setShowToast(true)
    }
  }

  const handleEditSupplier = async () => {
    if (!editFormData) return
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/suppliers/${editFormData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName: editFormData.supplierName,
          address: editFormData.address,
          contactPerson: editFormData.contactPerson,
          contactNumber: editFormData.contactNumber,
          email: editFormData.email,
        })
      })
      const data = await response.json()
      if (response.ok) {
        await fetchSuppliers()
        setEditModal(false)
        setEditFormData(null)
        setToastMessage(data.message || 'Supplier updated successfully!')
        setIsError(false)
        setShowToast(true)
      } else {
        setToastMessage(data.error || 'Failed to update supplier.')
        setIsError(true)
        setShowToast(true)
      }
    } catch {
      setToastMessage('Network error. Please try again.')
      setIsError(true)
      setShowToast(true)
    }
  }

  const handleToggleArchive = async (id: number) => {   
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/suppliers/archive/${id}`, {
        method: 'PUT',
      })
      if (response.ok) {
        const apiData = await response.json()
        setSuppliers(prev =>
          prev.map(sup => sup.id === id ? { ...sup, is_archived: apiData.is_archived } : sup)
        )
        setToastMessage(apiData.message)
        setIsError(false)
        setShowToast(true)
        setOpenMenuId(null)
      } else {
        const errorData = await response.json()
        setToastMessage(`Failed: ${errorData.error}`)
        setIsError(true)
        setShowToast(true)
      }
    } catch (err) {
      setToastMessage("Network error.")
      setIsError(true)
      setShowToast(true)
    }
  }

  const handleNumericInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const cleanValue = value.replace(/[^\d]/g, '');
    setSupplierFormData({ ...supplierFormData, [name]: cleanValue });
  };

  const handleSort = (key: SortKey) => {
    if (!key) return;
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  /* ================= DATA PROCESSING ================= */

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return suppliers.filter(sup => {
      const matchesArchiveView = isArchiveView ? Boolean(sup.is_archived) : !sup.is_archived;  
      return matchesArchiveView && (
        sup.id.toString().includes(term) ||
        sup.supplierName.toLowerCase().includes(term) ||
        sup.contactPerson.toLowerCase().includes(term) ||
        sup.contactNumber.toLowerCase().includes(term) ||
        sup.email.toLowerCase().includes(term) ||
        sup.address.toLowerCase().includes(term)
      );
    });
  }, [suppliers, searchTerm, isArchiveView]); 

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (!sortConfig.key || !sortConfig.direction) return arr.sort((a, b) => a.id - b.id);
    return arr.sort((a, b) => {
      const A = a[sortConfig.key!];
      const B = b[sortConfig.key!];
      if (typeof A === 'number' && typeof B === 'number') {
        return sortConfig.direction === 'asc' ? A - B : B - A;
      }
      const strA = String(A).toLowerCase();
      const strB = String(B).toLowerCase();
      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortConfig]);

  /* ================= PAGINATION ================= */

  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE);
  const paginated = sorted.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  const changePage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const renderPageNumbers = () =>
    Array.from({ length: totalPages }, (_, i) => (
      <div
        key={i + 1}
        className={`${s.pageCircle} ${currentPage === i + 1 ? s.pageCircleActive : ''}`}
        onClick={() => changePage(i + 1)}
      >{i + 1}</div>
    ));

  if (isLoading) return <div className={s.loadingContainer}>Loading Suppliers...</div>;

  const columns: { label: string; key: SortKey }[] = [
    { label: 'ID', key: 'id' },
    { label: 'SUPPLIER NAME', key: 'supplierName' },
    { label: 'CONTACT PERSON', key: 'contactPerson' },
    { label: 'CONTACT NUMBER', key: 'contactNumber' },
    { label: 'EMAIL', key: 'email' },
    { label: 'ADDRESS', key: 'address' }
  ];

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
              <button
                className={`${s.okButton} ${isError ? s.okButtonError : ''}`}
                onClick={() => setShowToast(false)}
              >OK</button>
            </div>
          </div>
        </div>
      )}

      <div className={s.mainContent}>

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
                <button
                  className={s.archiveIconBtn}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
                  onClick={() => setIsArchiveView(true)}  
                  title="View Archives"
                >
                  <LuArchive size={20} />
                </button>
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

            <table className={s.table}>
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col.key!} onClick={() => handleSort(col.key)} className={s.sortableHeader}>
                      <div className={s.sortHeaderInner}>
                        <span>{col.label}</span>
                        <div className={s.sortIconsStack}>
                          <LuChevronUp className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                          <LuChevronDown className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''} />
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className={s.actionHeader}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length ? (
                  paginated.map((sup, i) => (
                    <tr key={sup.id} className={i % 2 ? s.altRow : ''}>
                      <td>{sup.id}</td>
                      <td>{sup.supplierName}</td>
                      <td>{sup.contactPerson}</td>
                      <td>{sup.contactNumber}</td>
                      <td>{sup.email}</td>
                      <td>{sup.address}</td>
                      <td className={s.actionCell}>
                        <LuEllipsisVertical
                          className={s.moreIcon}
                          onClick={() => setOpenMenuId(openMenuId === sup.id ? null : sup.id)}
                        />
                        {openMenuId === sup.id && (
                          <div className={s.popupMenu}>
                            <button
                              className={s.popBtnEdit}
                              onClick={() => {
                                setEditFormData(sup)
                                setEditModal(true)
                                setOpenMenuId(null)
                              }}
                            >
                              <LuPencil size={14} /> Edit
                            </button>
                            <button className={s.popBtnArchive} onClick={() => handleToggleArchive(sup.id)}>
                              <LuArchive size={14} /> Archive
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

            <div className={s.footer}>
              <div className={s.showDataText}>
                Showing <span className={s.countBadge}>{paginated.length}</span> of {sorted.length}
              </div>
              {totalPages > 1 && (
                <div className={s.pagination}>
                  <button className={s.nextBtn} onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1}><LuChevronLeft /></button>
                  {renderPageNumbers()}
                  <button className={s.nextBtn} onClick={() => changePage(currentPage + 1)} disabled={currentPage === totalPages}><LuChevronRight /></button>
                </div>
              )}
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
              <LuX onClick={() => setShowModal(false)} className={s.closeIcon} />
            </div>

            <div className={`${s.modalForm} ${s.mt_20}`}>
              <h4 className={s.sectionTitle}>Company Information</h4>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  <label>Supplier Name</label>
                  <input
                    name="supplierName"
                    value={supplierFormData.supplierName}
                    onChange={(e) => setSupplierFormData({...supplierFormData, supplierName: e.target.value})}
                  />
                </div>
              </div>

              <div className={s.formGroupFull}>
                <label>Address</label>
                <input
                  name="address"
                  value={supplierFormData.address}
                  onChange={(e) => setSupplierFormData({...supplierFormData, address: e.target.value})}
                />
              </div>

              <h4 className={s.sectionTitle}>Primary Contact</h4>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  <label>Contact Person</label>
                  <input
                    name="contactPerson"
                    value={supplierFormData.contactPerson}
                    onChange={(e) => setSupplierFormData({...supplierFormData, contactPerson: e.target.value})}
                  />
                </div>
                <div className={s.formGroup}>
                  <label>Contact No.</label>
                  <input
                    name="contact"
                    value={supplierFormData.contact}
                    onChange={handleNumericInputChange}
                  />
                </div>
              </div>

              <div className={s.formGroupFull}>
                <label>Email Address</label>
                <input
                  name="email"
                  value={supplierFormData.email}
                  onChange={(e) => setSupplierFormData({...supplierFormData, email: e.target.value})}
                />
              </div>

              <h4 className={s.sectionTitle}>Terms & Notes</h4>
              <div className={s.formGroup}>
                <label>Payment Terms</label>
                <select
                  name="paymentTerms"
                  value={supplierFormData.paymentTerms}
                  onChange={(e) => setSupplierFormData({...supplierFormData, paymentTerms: e.target.value})}
                >
                  <option>Cash on Delivery</option>
                  <option>Card</option>
                </select>
              </div>

              <div className={s.modalFooter}>
                <button type="button" onClick={() => setShowModal(false)} className={s.cancelBtn}>Cancel</button>
                <button type="button" onClick={handleCreateSupplier} className={s.saveBtn}>
                  Create Supplier
                </button>
              </div>
            </div>
          </div>
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
              <LuX onClick={() => { setEditModal(false); setEditFormData(null); }} className={s.closeIcon} />
            </div>

            <div className={`${s.modalForm} ${s.mt_20}`}>
              <h4 className={s.sectionTitle}>Company Information</h4>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  <label>Supplier Name</label>
                  <input
                    value={editFormData.supplierName}
                    onChange={(e) => setEditFormData({...editFormData, supplierName: e.target.value})}
                  />
                </div>
              </div>

              <div className={s.formGroupFull}>
                <label>Address</label>
                <input
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({...editFormData, address: e.target.value})}
                />
              </div>

              <h4 className={s.sectionTitle}>Primary Contact</h4>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  <label>Contact Person</label>
                  <input
                    value={editFormData.contactPerson}
                    onChange={(e) => setEditFormData({...editFormData, contactPerson: e.target.value})}
                  />
                </div>
                <div className={s.formGroup}>
                  <label>Contact No.</label>
                  <input
                    value={editFormData.contactNumber}
                    onChange={(e) => setEditFormData({...editFormData, contactNumber: e.target.value.replace(/[^\d]/g, '')})}
                  />
                </div>
              </div>

              <div className={s.formGroupFull}>
                <label>Email Address</label>
                <input
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                />
              </div>

              <div className={s.modalFooter}>
                <button type="button" onClick={() => { setEditModal(false); setEditFormData(null); }} className={s.cancelBtn}>Cancel</button>
                <button type="button" onClick={handleEditSupplier} className={s.saveBtn}>
                  Update Supplier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}