'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from '@/css/suppliers.module.css';
import TopHeader from '@/components/layout/TopHeader';
import {
  LuSearch,
  LuEllipsisVertical,
  LuChevronUp,
  LuChevronDown,
  LuPencil,
  LuArchive,
  LuChevronRight,
  LuChevronLeft
} from 'react-icons/lu';

/* ================= TYPES ================= */

type Supplier = {
  id: number;
  supplierName: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  address: string;
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

  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: 'asc' | 'desc' | null;
  }>({
    key: 'id',
    direction: 'asc'
  });

  /* ================= FETCH ================= */

  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/suppliers')
      .then(res => res.json())
      .then(data => setSuppliers(data))
      .catch(err => console.error('Failed to fetch suppliers', err))
      .finally(() => setIsLoading(false));
  }, []);

  /* ================= SORT AND FILTER ================= */

  const handleSort = (key: SortKey) => {
    if (!key) return;

    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return suppliers.filter(sup =>
      sup.id.toString().includes(term) ||
      sup.supplierName.toLowerCase().includes(term) ||
      sup.contactPerson.toLowerCase().includes(term) ||
      sup.contactNumber.toLowerCase().includes(term) ||
      sup.email.toLowerCase().includes(term) ||
      sup.address.toLowerCase().includes(term)
    );
  }, [suppliers, searchTerm]);

  const sorted = useMemo(() => {
    const arr = [...filtered];

    if (!sortConfig.key || !sortConfig.direction) {
      return arr.sort((a, b) => a.id - b.id);
    }

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

  const paginated = sorted.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const changePage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const renderPageNumbers = () =>
    Array.from({ length: totalPages }, (_, i) => (
      <div
        key={i + 1}
        className={`${s.pageCircle} ${
          currentPage === i + 1 ? s.pageCircleActive : ''
        }`}
        onClick={() => changePage(i + 1)}
      >
        {i + 1}
      </div>
    ));

  if (isLoading) {
    return <div className={s.loadingContainer}>Loading Suppliers...</div>;
  }

  /* ================= COLUMNS ================= */

  const columns: { label: string; key: SortKey }[] = [
    { label: 'ID', key: 'id' },
    { label: 'SUPPLIER NAME', key: 'supplierName' },
    { label: 'CONTACT PERSON', key: 'contactPerson' },
    { label: 'CONTACT NUMBER', key: 'contactNumber' },
    { label: 'EMAIL', key: 'email' },
    { label: 'ADDRESS', key: 'address' }
  ];

  /* ================= UI ================= */

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      <div className={s.mainContent}>
        <div className={s.tableContainer}>
          {/* HEADER */}
          <div className={s.header}>
            <h2 className={s.title}>Suppliers</h2>

            <div className={s.controls}>
              <button className={s.archiveIconBtn}><LuArchive size={20} /></button>

              <div className={s.searchWrapper}>
                <input
                  className={s.searchInput}
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <LuSearch size={18} />
              </div>

              <button className={s.addButton}>ADD</button>
            </div>
          </div>

          {/* TABLE */}
          <table className={s.table}>
            <thead>
              <tr>
                {columns.map(col => (
                  <th
                    key={col.key!}
                    onClick={() => handleSort(col.key)}
                    className={s.sortableHeader}
                  >
                    <div className={s.sortHeaderInner}>
                      <span>{col.label}</span>
                      <div className={s.sortIconsStack}>
                        <LuChevronUp
                          className={
                            sortConfig.key === col.key &&
                            sortConfig.direction === 'asc'
                              ? s.activeSort
                              : ''
                          }
                        />
                        <LuChevronDown
                          className={
                            sortConfig.key === col.key &&
                            sortConfig.direction === 'desc'
                              ? s.activeSort
                              : ''
                          }
                        />
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
                        onClick={() =>
                          setOpenMenuId(openMenuId === sup.id ? null : sup.id)
                        }
                      />

                      {openMenuId === sup.id && (
                        <div className={s.popupMenu}>
                          <button className={s.popBtnEdit}><LuPencil size={14} /> Edit</button>
                          <button className={s.popBtnArchive}><LuArchive size={14} /> Archive</button>
                          <button className={s.closeX} onClick={() => setOpenMenuId(null)}>×</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                    No suppliers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* FOOTER */}
          <div className={s.footer}>
            <div className={s.showDataText}>
              Showing <span className={s.countBadge}>{paginated.length}</span> of {sorted.length}
            </div>

            {totalPages > 1 && (
              <div className={s.pagination}>
                {/* PREVIOUS */}
                <button
                  className={s.nextBtn}
                  onClick={() => changePage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <LuChevronLeft />
                </button>

                {renderPageNumbers()}

                {/* NEXT */}
                <button
                  className={s.nextBtn}
                  onClick={() => changePage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <LuChevronRight />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
