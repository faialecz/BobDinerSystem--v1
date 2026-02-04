'use client';

import React, { useEffect, useState } from 'react';
import styles from "@/css/inventory.module.css";
import TopHeader from '@/components/layout/TopHeader';
import ExportButton from '@/components/features/ExportButton';
import {
  LuSearch, LuEllipsisVertical, LuChevronUp, LuChevronDown,
  LuArchive, LuChevronRight
} from "react-icons/lu";

/* ================= TYPES ================= */

interface InventoryProps {
  role: string;
  onLogout: () => void;
}

interface Product {
  id: string;
  item: string;
  brand: string;
  qty: number;
  uom: string;
  unitPrice: number;
  price: number;
}

interface InventorySummary {
  totalProducts: number;
  totalProductsChange: number;
  weeklyInventory: number;
  monthlyInventory: number;
  yearlyInventory: number;
  outOfStockCount: number;
}

const Inventory: React.FC<InventoryProps> = ({ role, onLogout }) => {
  const s = styles as Record<string, string>;

  const [products, setProducts] = useState<Product[]>([]);
  const [data, setData] = useState<InventorySummary>({
    totalProducts: 0,
    totalProductsChange: 0,
    weeklyInventory: 0,
    monthlyInventory: 0,
    yearlyInventory: 0,
    outOfStockCount: 0,
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Product | '';
    direction: 'asc' | 'desc' | null;
  }>({ key: '', direction: null });

  /* ================= FETCH INVENTORY ================= */

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const res = await fetch("http://127.0.0.1:5000/api/inventory");
        if (!res.ok) throw new Error("Failed to fetch");
        const productData: Product[] = await res.json();
        setProducts(productData);

        const visible = productData.filter(p => p.qty > 0);
        const outOfStock = productData.filter(p => p.qty === 0);

        setData({
          totalProducts: productData.length,
          totalProductsChange: 2.8,
          weeklyInventory: visible.length,
          monthlyInventory: visible.length * 10,
          yearlyInventory: visible.length * 100,
          outOfStockCount: outOfStock.length,
        });
      } catch (err) {
        console.error("Inventory fetch error:", err);
      }
    };
    fetchInventory();
  }, []);

  /* ================= HANDLERS ================= */

  const requestSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  /* ================= DATA PROCESSING ================= */

  const filteredProducts = products.filter(p =>
    p.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toString().includes(searchTerm)
  );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      <div className={s.mainContent}>
        <div className={s.headerActions}><ExportButton /></div>

        <div className={s.topGrid}>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Total Products</p>
            <h2 className={s.bigNumber}>{data.totalProducts}</h2>
            <div className={s.cardFooter}>
              <span className={s.subText}>vs last month</span>
              <span className={s.pillRed}>↘ {data.totalProductsChange}%</span>
            </div>
          </section>

          <section className={s.statCard}>
            <p className={s.cardTitle}>Inventory Report</p>
            <div className={s.list}>
              <div className={`${s.listRow} ${s.altRow}`}>Weekly Inventory <span>{data.weeklyInventory}</span></div>
              <div className={s.listRow}>Monthly Inventory <span>{data.monthlyInventory}</span></div>
              <div className={`${s.listRow} ${s.altRow}`}>Yearly Inventory <span>{data.yearlyInventory}</span></div>
            </div>
          </section>

          <section className={s.statCard}>
            <p className={s.cardTitle}>Out of Stock</p>
            <div className={s.outOfStockList}>
              {products.filter(p => p.qty === 0).length > 0 ? (
                products.filter(p => p.qty === 0).map(p => <div key={p.id} className={s.outOfStockBadge}>{p.item}</div>)
              ) : ( <p className={s.subText}>All items in stock</p> )}
            </div>
          </section>
        </div>

        <div className={s.tableContainer}>
          <div className={s.header}>
            <h1 className={s.title}>Product List</h1>
            <div className={s.controls}>
              <LuArchive size={20} />
              <div className={s.searchWrapper}>
                <input className={s.searchInput} placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                <LuSearch size={18} />
              </div>
              <button className={s.addButton} onClick={() => console.log("Add clicked")}>ADD</button>
            </div>
          </div>

          <table className={s.table}>
            <thead>
              <tr>
                {[
                  { label: 'ID', key: 'id' },
                  { label: 'ITEM', key: 'item' },
                  { label: 'BRAND', key: 'brand' },
                  { label: 'QTY', key: 'qty' },
                  { label: 'UOM', key: 'uom' },
                  { label: 'UNIT PRICE', key: 'unitPrice' },
                  { label: 'PRICE', key: 'price' }
                ].map((col) => (
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
                <th className={s.actionHeader}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map(p => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.item}</td>
                  <td>{p.brand}</td>
                  <td>{p.qty}</td>
                  <td>{p.uom}</td>
                  <td>₱ {p.unitPrice?.toLocaleString()}</td>
                  <td>₱ {p.price?.toLocaleString()}</td>
                  <td className={s.actionCell}>
                    <LuEllipsisVertical className={s.moreIcon} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={s.footer}>
            <div className={s.showDataText}>
              Showing <span className={s.countBadge}>{sortedProducts.length}</span> of {products.length}
            </div>
            <LuChevronRight />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inventory;