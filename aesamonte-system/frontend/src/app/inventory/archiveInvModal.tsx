'use client'

import React, { useState } from 'react'
import styles from '@/css/inventory.module.css'
import {
  LuSearch,
  LuChevronUp,
  LuChevronDown,
  LuArrowLeft,
  LuArchiveRestore
} from 'react-icons/lu'

export interface Product {
  id: string;
  item_name: string;
  item_description: string;
  qty: number;
  uom: string;
  status: string;
  is_archived?: boolean;
  brands?: { brand_name: string; sku: string; qty: number; unit_price: number; selling_price: number }[];
  suppliers?: { supplier_name: string }[];
}

interface ArchiveTableProps {
  products: Product[]
  onRestore: (id: string) => void
  onBack: () => void
}

export default function ArchiveTable({ products, onRestore, onBack }: ArchiveTableProps) {
  const s = styles as Record<string, string>
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Product | ''
    direction: 'asc' | 'desc' | null
  }>({ key: '', direction: null })

  const filteredProducts = products.filter(p => {
    if (!p.is_archived) return false;
    const supplierNames = (p.suppliers || []).map(s => s.supplier_name).join(' ');
    const brandNames = (p.brands || []).map(b => b.brand_name).join(' ');
    const searchStr = `${p.id} ${p.item_name} ${brandNames} ${supplierNames}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  })

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0
    const aVal = a[sortConfig.key] ?? ''
    const bVal = b[sortConfig.key] ?? ''
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  const requestSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  }

  return (
    <div className={s.tableContainer} style={{ border: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
      <div className={s.header}>
        <h1 className={s.title} style={{ color: '#64748b' }}>Archived Inventory</h1>
        <div className={s.controls}>
          <button
            className={s.archiveIconBtn}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: '#64748b', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            onClick={onBack}
          >
            <LuArrowLeft size={18} /> Back to Active
          </button>
          <div className={s.searchWrapper}>
            <input className={s.searchInput} placeholder="Search archives..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <LuSearch size={18} />
          </div>
        </div>
      </div>

      <div className={s.tableResponsive}>
        <table className={s.table}>
          <thead>
            <tr>
              {[
                { label: 'ID', key: 'id' },
                { label: 'ITEM', key: 'item_name' },
                { label: 'DESCRIPTION', key: 'item_description' },
                { label: 'TOTAL QTY', key: 'qty' },
                { label: 'UOM', key: 'uom' },
              ].map(col => (
                <th key={col.key} onClick={() => requestSort(col.key as keyof Product)}>
                  <div className={s.sortableHeader}>
                    <span>{col.label}</span>
                    <div className={s.sortIconsStack}>
                      <LuChevronUp className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                      <LuChevronDown className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? s.activeSort : ''} />
                    </div>
                  </div>
                </th>
              ))}
              <th>BRANDS</th>
              <th>STATUS</th>
              <th className={s.actionHeader}>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedProducts.length ? (
              sortedProducts.map(p => (
                <tr key={p.id}>
                  <td style={{ color: '#94a3b8' }}>{p.id}</td>
                  <td style={{ fontWeight: 600, color: '#64748b' }}>{p.item_name}</td>
                  <td style={{ color: '#94a3b8' }}>{p.item_description}</td>
                  <td style={{ color: '#94a3b8' }}>{p.qty}</td>
                  <td style={{ color: '#94a3b8' }}>{p.uom || '—'}</td>
                  <td style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                    {(p.brands || []).map(b => b.brand_name === 'No Brand' ? '—' : b.brand_name).join(', ') || '—'}
                  </td>
                  <td>
                    <span style={{ backgroundColor: '#e2e8f0', color: '#64748b', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>ARCHIVED</span>
                  </td>
                  <td className={s.actionCell}>
                    <div className={s.actionWrapper}>
                      <button className={s.archiveBtn} onClick={() => onRestore(p.id)}>
                        <LuArchiveRestore size={16} />
                        <span>Restore</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  No archived inventory found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={s.footer} style={{ color: '#94a3b8' }}>
        Showing {sortedProducts.length} archived items
      </div>
    </div>
  )
}
