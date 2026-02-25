/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useMemo } from 'react';
import styles from '@/css/order.module.css';
import TopHeader from '@/components/layout/TopHeader';
import OrderEditModal from './editOrderModal';
import AddOrderModal from './addOrderModal';
import {
  LuSearch,
  LuEllipsisVertical,
  LuArchive,
  LuChevronUp,
  LuChevronDown,
  LuChevronRight,
  LuPencil,
  LuX,
  LuPlus
} from 'react-icons/lu';

/* ===================== CONSTANTS ===================== */
const STATUS_PRIORITY: Record<string, number> = {
  'TO SHIP': 1,
  'RECEIVED': 2,
  'CANCELLED': 3
};

const STATUS_ORDER: string[] = ['TO SHIP', 'RECEIVED', 'CANCELLED'];

const ITEM_STATUS_MAP: Record<number, string> = {
  1: 'AVAILABLE',
  2: 'PARTIALLY_AVAILABLE',
  3: 'OUT_OF_STOCK'
};

const ROWS_PER_PAGE = 10;

/* ===================== TYPES ===================== */
type OrderItemBackend = {
  inventory_id: number;
  order_quantity: number;
  available_quantity: number;
  item_status_id: number;
  item_status?: string;
  item_name?: string;
};

type Order = {
  id: number;
  customer: string;
  contact?: string;
  address: string;
  date: string;
  status: string;
  paymentMethod: string;
  totalQty: number;
  totalAmount: number;
  items?: OrderItemBackend[];
};

type Summary = {
  shippedToday: { current: number; total: number; yesterday: number };
  cancelled: { current: number; yesterday: number };
  totalOrders: { count: number; growth: number };
};

interface OrderFormItem {
  item: string;
  itemDescription: string;
  quantity: string;
  amount: string;
  orderStatus: string;
  paymentMethod: string;
}

interface OrderFormData {
  name?: string;
  contact?: string;
  address?: string;
  items: OrderFormItem[];
}

type SortKey = 'id' | 'customer' | 'date' | 'status' | null;

/* ===================== COMPONENT ===================== */
export default function OrderPage({ role, onLogout }: { role: string; onLogout: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: Exclude<SortKey, null> | null; direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [statusCycleIndex, setStatusCycleIndex] = useState(0);
  const [showAddModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<any>(null);
  const [orderStatuses, setOrderStatuses] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  const [showToast, setShowToast] = useState(false);
  const [toastTitle, setToastTitle] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>(null);

  const s = styles;

  /* ===================== FETCH DATA ===================== */
  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/orders/list')
      .then(res => res.json())
      .then((data: Order[]) => {
        const mappedOrders = data.map(order => {
          const items = order.items?.map(item => ({
            ...item,
            item_status: (item.item_status || ITEM_STATUS_MAP[item.item_status_id] || 'NOT_AVAILABLE').toUpperCase()
          }));
          return { ...order, items };
        });
        setOrders(mappedOrders);
      })
      .catch(err => console.error('Error fetching orders:', err));

    fetch('http://127.0.0.1:5000/api/orders/summary')
      .then(res => res.json())
      .then(setSummary)
      .catch(err => console.error('Error fetching summary:', err));
  }, []);

  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const statusRes = await fetch("http://127.0.0.1:5000/api/orders/status?scope=ORDER_STATUS");
        if (statusRes.ok) setOrderStatuses(await statusRes.json());
        const paymentRes = await fetch("http://127.0.0.1:5000/api/orders/status?scope=PAYMENT_METHOD");
        if (paymentRes.ok) setPaymentMethods(await paymentRes.json());
        const invRes = await fetch("http://127.0.0.1:5000/api/inventory");
        if (invRes.ok) setInventoryItems(await invRes.json());
      } catch (err) {
        console.error("Failed to fetch dropdowns", err);
      }
    };
    fetchDropdowns();
  }, []);

  /* ===================== HANDLERS ===================== */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); 
  };

  const handleSave = async (newOrderData: any) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/orders/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrderData),
      });

      if (response.ok) {
        const listRes = await fetch('http://127.0.0.1:5000/api/orders/list');
        const data: Order[] = await listRes.json();
        const mappedOrders = data.map(order => {
          const items = order.items?.map(item => ({
            ...item,
            item_status: (item.item_status || ITEM_STATUS_MAP[item.item_status_id] || 'NOT_AVAILABLE').toUpperCase()
          }));
          return { ...order, items };
        });
        setOrders(mappedOrders);
        
        const total = newOrderData.items?.reduce((sum: number, itm: any) => sum + Number(itm.amount || 0), 0) || 0;
        const now = new Date();
        const dateTimeStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        setSubmittedData({
          customer: newOrderData.name || newOrderData.customer || '', 
          total: total,
          method: newOrderData.paymentMethod || (newOrderData.items && newOrderData.items[0]?.paymentMethod) || 'Cash',
          dateTime: dateTimeStr
        });
        /* --- FIX END --- */

        setToastTitle("Order Submitted!");
        setToastMessage("Your new order has been successfully added.");
        setIsError(false);
        setShowToast(true);
        setShowModal(false);
      }
    } catch (err) {
      console.error("Error adding order:", err);
    }
  };

  const handleOpenEdit = (order: Order) => {
    setSelectedOrderForEdit({
      id: order.id,
      name: order.customer,
      contact: order.contact || '',
      address: order.address, 
      status: order.status,
      paymentMethod: order.paymentMethod,
      items: order.items 
    });
    setOpenMenuId(null);
    setShowEditModal(true);
  };
  
  const handleUpdateSave = async (updatedOrder: any) => {
    const hasChanged = 
      updatedOrder.name !== selectedOrderForEdit.name ||
      updatedOrder.address !== selectedOrderForEdit.address ||
      updatedOrder.status !== selectedOrderForEdit.status ||
      updatedOrder.paymentMethod !== selectedOrderForEdit.paymentMethod ||
      JSON.stringify(updatedOrder.items) !== JSON.stringify(selectedOrderForEdit.items);

    if (!hasChanged) {
      setToastTitle("Oops!");
      setToastMessage("No changes were detected to save.");
      setIsError(true);
      setSubmittedData(null);
      setShowToast(true);
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:5000/api/orders/update/${updatedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrder),
      });

      if (response.ok) {
        fetch('http://127.0.0.1:5000/api/orders/list').then(res => res.json()).then(data => {
            const mapped = data.map((order: any) => ({
                ...order,
                items: order.items?.map((item: any) => ({
                    ...item,
                    item_status: (item.item_status || ITEM_STATUS_MAP[item.item_status_id] || 'NOT_AVAILABLE').toUpperCase()
                }))
            }));
            setOrders(mapped);
        });
          
        setToastTitle("Updated!");
        setToastMessage("The order record has been updated.");
        setIsError(false);
        setSubmittedData(null);
        setShowToast(true);
        setShowEditModal(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSort = (key: Exclude<SortKey, null>) => {
    if (key === 'status') {
      setStatusCycleIndex(prev => (prev + 1) % STATUS_ORDER.length);
      setSortConfig({ key: 'status', direction: 'asc' });
    } else {
      setSortConfig(prev => {
        if (prev.key === key) return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
        return { key, direction: 'asc' };
      });
    }
  };

  /* ===================== FILTER & SORT ===================== */
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return orders.filter(o =>
      o.id.toString().includes(term) ||
      o.customer.toLowerCase().includes(term) ||
      o.date.toLowerCase().includes(term) ||
      o.status.toLowerCase().includes(term)
    );
  }, [orders, searchTerm]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortConfig.key === 'status') {
      const activeStatus = STATUS_ORDER[statusCycleIndex];
      return arr.sort((a, b) => {
        if (a.status === activeStatus && b.status !== activeStatus) return -1;
        if (b.status === activeStatus && a.status !== activeStatus) return 1;
        return (STATUS_PRIORITY[a.status.toUpperCase()] || 0) - (STATUS_PRIORITY[b.status.toUpperCase()] || 0) || a.id - b.id;
      });
    }
    if (!sortConfig.key) {
      return arr.sort((a, b) => (STATUS_PRIORITY[a.status.toUpperCase()] || 0) - (STATUS_PRIORITY[b.status.toUpperCase()] || 0) || a.id - b.id);
    }
    const { key, direction } = sortConfig;
    return arr.sort((a, b) => {
      const A = a[key as keyof Order];
      const B = b[key as keyof Order];
      if (key === 'id') return direction === 'asc' ? (A as number) - (B as number) : (B as number) - (A as number);
      if (key === 'date') return direction === 'asc' ? new Date(A as string).getTime() - new Date(B as string).getTime() : new Date(B as string).getTime() - new Date(A as string).getTime();
      const strA = (A as string).toLowerCase();
      const strB = (B as string).toLowerCase();
      if (strA < strB) return direction === 'asc' ? -1 : 1;
      if (strA > strB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortConfig, statusCycleIndex]);

  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE) || 1;
  const paginated = sorted.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
  const changePage = (page: number) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };

  const getStatusStyle = (status: string | undefined) => {
    const baseClass = s.statusBadge;
    if (!status || status.trim() === '' || status.toLowerCase() === 'select') return baseClass;
    switch (status.toUpperCase()) {
      case 'PREPARING': return `${baseClass} ${s.pillBlue}`;
      case 'TO SHIP': return `${baseClass} ${s.pillYellow}`;
      case 'RECEIVED': return `${baseClass} ${s.pillGreen}`;
      case 'CANCELLED': return `${baseClass} ${s.pillRed}`;
      default: return baseClass;
    }
  };

  const renderPageNumbers = () => Array.from({ length: totalPages }, (_, i) => (
    <div
      key={i + 1}
      className={`${s.pageCircle} ${currentPage === i + 1 ? s.pageCircleActive : ''}`}
      onClick={() => changePage(i + 1)}
    >{i + 1}</div>
  ));

  /* ===================== RENDER ===================== */
  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      {showToast && (
        <div className={s.toastOverlay}>
          <div className={s.alertBox}>
            <div className={`${s.alertHeader} ${isError ? s.alertHeaderError : ''}`}>
               <div className={`${s.checkCircle} ${isError ? s.checkCircleError : ''}`}>
                {isError ? '!' : '✓'}
              </div>
            </div>
            <div className={s.alertBody}>
              <h2 className={s.alertTitle}>{toastTitle}</h2>
              <p className={s.alertMessage}>{toastMessage}</p>

              {!isError && submittedData && (
                <div className={s.alertDataTable}>
                  <div className={s.alertDataRow}><span>Customer:</span><strong>{submittedData.customer}</strong></div>
                  <div className={s.alertDataRow}><span>Total Amount:</span><strong>₱{submittedData.total.toLocaleString()}</strong></div>
                  <div className={s.alertDataRow}><span>Payment Method:</span><strong>{submittedData.method}</strong></div>
                  <div className={s.alertDataRow}><span>Date & Time:</span><strong>{submittedData.dateTime}</strong></div>
                </div>
              )}

              <button className={`${s.okButton} ${isError ? s.okButtonError : ''}`} onClick={() => setShowToast(false)}>OK</button>
            </div>
          </div>
        </div>
      )}

      <div className={s.mainContent}>
        <div className={s.topGrid}>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Shipped Today</p>
            <h2 className={s.bigNumber}>{summary ? `${summary.shippedToday.current}/${summary.shippedToday.total}` : '—'}</h2>
          </section>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Orders Cancelled</p>
            <h2 className={s.bigNumber}>{summary ? summary.cancelled.current : '—'}</h2>
          </section>
          <section className={s.statCard}>
            <p className={s.cardTitle}>Total Orders</p>
            <h2 className={s.bigNumber}>{summary ? summary.totalOrders.count.toLocaleString() : '—'}</h2>
          </section>
        </div>

        <div className={s.tableContainer}>
          <div className={s.header}>
            <h2 className={s.title}>Orders</h2>
            <div className={s.controls}>
              <button className={s.archiveIconBtn}><LuArchive size={20} /></button>
              <div className={s.searchWrapper}>
                <input
                  className={s.searchInput}
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
                <LuSearch size={18} />
              </div>
              <button className={s.addButton} onClick={() => setShowModal(true)}>ADD</button>
            </div>
          </div>

          <table className={s.table}>
            <thead>
              <tr>
                <th onClick={() => handleSort('id')} className={s.sortableHeader} style={{ textAlign: 'center' }}>
                  <div className={s.sortHeaderInner} style={{ justifyContent: 'center' }}>
                    <span>ID</span>
                    <div className={s.sortIconsStack}>
                      <LuChevronUp className={sortConfig.key === 'id' && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                      <LuChevronDown className={sortConfig.key === 'id' && sortConfig.direction === 'desc' ? s.activeSort : ''} />
                    </div>
                  </div>
                </th>
                <th onClick={() => handleSort('customer')} className={s.sortableHeader} style={{ textAlign: 'left', paddingLeft: '1rem' }}>
                  <div className={s.sortHeaderInner} style={{ justifyContent: 'flex-start' }}>
                    <span>CUSTOMER</span>
                    <div className={s.sortIconsStack}>
                       <LuChevronUp className={sortConfig.key === 'customer' && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                       <LuChevronDown className={sortConfig.key === 'customer' && sortConfig.direction === 'desc' ? s.activeSort : ''} />
                    </div>
                  </div>
                </th>
                <th style={{ textAlign: 'left' }}>ADDRESS</th>
                <th style={{ textAlign: 'center' }}>QTY</th>
                <th style={{ textAlign: 'right' }}>TOTAL</th>
                <th style={{ textAlign: 'center' }}>PAYMENT</th>
                <th onClick={() => handleSort('date')} className={s.sortableHeader} style={{ textAlign: 'center' }}>
                    <div className={s.sortHeaderInner} style={{ justifyContent: 'center' }}>
                    <span>DATE</span>
                    <div className={s.sortIconsStack}>
                       <LuChevronUp className={sortConfig.key === 'date' && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                       <LuChevronDown className={sortConfig.key === 'date' && sortConfig.direction === 'desc' ? s.activeSort : ''} />
                    </div>
                  </div>
                </th>
                <th onClick={() => handleSort('status')} className={s.sortableHeader} style={{ textAlign: 'center' }}>
                  <div className={s.sortHeaderInner} style={{ justifyContent: 'center' }}>
                    <span>STATUS</span>
                    <div className={s.sortIconsStack}>
                       <LuChevronUp className={sortConfig.key === 'status' && sortConfig.direction === 'asc' ? s.activeSort : ''} />
                       <LuChevronDown className={sortConfig.key === 'status' && sortConfig.direction === 'desc' ? s.activeSort : ''} />
                    </div>
                  </div>
                </th>
                <th className={`${s.actionHeader} text-center`}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((o, i) => (
                <tr key={o.id} className={i % 2 ? s.altRow : ''}>
                  <td style={{ textAlign: 'center' }}>{o.id}</td>
                  <td style={{ textAlign: 'left', paddingLeft: '1rem' }}>
                    <div className="font-bold">{o.customer}</div>
                  </td>
                  <td style={{ textAlign: 'left', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.address}</td>
                  <td style={{ textAlign: 'center' }}>{o.totalQty}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₱{o.totalAmount?.toLocaleString()}</td>
                  <td style={{ textAlign: 'center' }}>{o.paymentMethod}</td>
                  <td style={{ textAlign: 'center' }}>{o.date}</td>
                  <td style={{ textAlign: 'center' }}><span className={getStatusStyle(o.status)}>{o.status}</span></td>
                  <td className={`${s.actionCell} text-center`}>
                    <LuEllipsisVertical
                      className={s.moreIcon}
                      onClick={() => setOpenMenuId(openMenuId === o.id ? null : o.id)}
                    />
                    {openMenuId === o.id && (
                      <div className={s.popupMenu}>
                        <button className={s.popBtnEdit} onClick={() => handleOpenEdit(o)}>
                          <LuPencil size={14} /> Edit
                        </button>
                        <button className={s.popBtnArchive}><LuArchive size={14} /> Archive</button>
                        <button className={s.closeX} onClick={() => setOpenMenuId(null)}>×</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={s.footer}>
            <div className={s.showDataText}>
              Showing <span className={s.countBadge}>{paginated.length}</span> of {sorted.length}
            </div>
            <div className={s.pagination}>
              {renderPageNumbers()}
              <button className={s.nextBtn} onClick={() => changePage(currentPage + 1)} disabled={currentPage >= totalPages}>
                <LuChevronRight />
              </button>
            </div>
          </div>
        </div>
      </div>

      <AddOrderModal 
        isOpen={showAddModal} 
        onClose={() => setShowModal(false)} 
        onSave={handleSave}
        statuses={orderStatuses} 
        paymentMethods={paymentMethods} 
        inventoryItems={inventoryItems}
      />

      <OrderEditModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        orderData={selectedOrderForEdit}
        onSave={handleUpdateSave}
        statuses={orderStatuses} 
        paymentMethods={paymentMethods} 
        inventoryItems={inventoryItems}
      />
    </div>
  );
}