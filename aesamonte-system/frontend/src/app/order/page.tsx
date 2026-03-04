/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useMemo } from 'react';
import styles from '@/css/order.module.css';
import TopHeader from '@/components/layout/TopHeader';
import OrderEditModal from './editOrderModal';
import AddOrderModal from './addOrderModal';
import ArchiveTable from './archiveOrderModal';
import { 
  LuSearch, 
  LuChevronUp, 
  LuChevronDown, 
  LuEllipsisVertical, 
  LuArchive, 
  LuChevronRight, 
  LuPencil 
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

export type Order = {
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
  is_archived?: boolean; 
};

type Summary = {
  shippedToday: { current: number; total: number; yesterday: number };
  cancelled: { current: number; yesterday: number };
  totalOrders: { count: number; growth: number };
};

type SortKey = 'id' | 'customer' | 'address' | 'qty'| 'total' | 'payment' | 'date' | 'status' | null;

/* ===================== COMPONENT ===================== */
export default function OrderPage({ role, onLogout }: { role: string; onLogout: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]); // ALL orders — active + archived
  const [summary, setSummary] = useState<Summary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: Exclude<SortKey, null> | null; direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [statusCycleIndex, setStatusCycleIndex] = useState(0);
  const [isArchiveView, setIsArchiveView] = useState(false); // <--- same as inventory

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<any>(null);

  // Dropdown States
  const [orderStatuses, setOrderStatuses] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  // ALERT/TOAST STATES
  const [showToast, setShowToast] = useState(false);
  const [toastTitle, setToastTitle] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>(null);

  const s = styles;

  /* ===================== FETCH DATA ===================== */
  // Fetches ALL orders including archived — same as inventory fetching all products
  const fetchOrders = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/orders/list');
      const data: Order[] = await res.json();
      const mappedOrders = data.map(order => ({
        ...order,
        items: order.items?.map(item => ({
          ...item,
          item_status: (item.item_status || ITEM_STATUS_MAP[item.item_status_id] || 'NOT_AVAILABLE').toUpperCase()
        }))
      }));
      setOrders(mappedOrders);
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetch('http://127.0.0.1:5000/api/orders/summary').then(res => res.json()).then(setSummary);

    const fetchDropdowns = async () => {
      try {
        const [statusRes, paymentRes, invRes] = await Promise.all([
          fetch("http://127.0.0.1:5000/api/orders/status?scope=ORDER_STATUS"),
          fetch("http://127.0.0.1:5000/api/orders/status?scope=PAYMENT_METHOD"),
          fetch("http://127.0.0.1:5000/api/inventory")
        ]);
        if (statusRes.ok) setOrderStatuses(await statusRes.json());
        if (paymentRes.ok) setPaymentMethods(await paymentRes.json());
        if (invRes.ok) setInventoryItems(await invRes.json());
      } catch (err) {
        console.error("Dropdown fetch error", err);
      }
    };
    fetchDropdowns();
  }, []);

  /* ===================== HANDLERS ===================== */
  const handleSave = async (newOrderData: any) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/orders/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrderData),
      });

      if (response.ok) {
        setSubmittedData({
          customer: newOrderData.customer,
          total: newOrderData.items?.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0) || 0,
          method: newOrderData.payment_method || newOrderData.paymentMethod || newOrderData.items[0]?.paymentMethod || '—',
          dateTime: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        setToastTitle("Order Submitted!");
        setToastMessage("Your new order has been successfully added.");
        setIsError(false);
        setShowToast(true);
        setShowAddModal(false);
        fetchOrders();
      } else {
        const errData = await response.json();
        setToastTitle("Oops!");
        setToastMessage(errData.error || "Failed to save order.");
        setIsError(true);
        setShowToast(true);
      }
    } catch (err) {
      setToastTitle("Network Error");
      setToastMessage("Could not connect to the server.");
      setIsError(true);
      setShowToast(true);
    }
  };

  const handleUpdateSave = async (updatedOrder: any) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/orders/update/${updatedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrder),
      });

      if (response.ok) {
        setToastTitle("Updated!");
        setToastMessage("The order record has been successfully updated.");
        setIsError(false);
        setSubmittedData(null);
        setShowToast(true);
        setShowEditModal(false);
        fetchOrders();
      } else {
        setToastTitle("Update Failed");
        setToastMessage("Failed to update order.");
        setIsError(true);
        setShowToast(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle archive — exact same pattern as inventory's handleToggleArchive
  const handleToggleArchive = async (id: number) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/orders/archive/${id}`, {
        method: 'PUT',
      });

      if (response.ok) {
        const apiData = await response.json();
        setOrders(prev =>
          prev.map(o =>
            o.id === id ? { ...o, is_archived: apiData.is_archived } : o
          )
        );
        setSubmittedData(null); 
        setToastTitle(apiData.is_archived ? "Archived!" : "Restored!");
        setToastMessage(apiData.is_archived ? "Order moved to Archive" : "Order restored from Archive");
        setIsError(false);
        setShowToast(true);
        setOpenMenuId(null);
        fetchOrders();
      } else {
        const errorData = await response.json();
        setSubmittedData(null);
        setToastTitle("Failed");
        setToastMessage(`Failed: ${errorData.error}`);
        setIsError(true);
        setShowToast(true);
      }
    } catch (err) {
      setSubmittedData(null);
      setToastTitle("Network Error");
      setToastMessage("Could not connect to the server.");
      setIsError(true);
      setShowToast(true);
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
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
  return orders.filter(o => {
    const matchesArchiveView = isArchiveView ? Boolean(o.is_archived) : !o.is_archived;
    const matchesSearch =
      o.id.toString().includes(term) ||
      o.customer.toLowerCase().includes(term) ||
      o.date.toLowerCase().includes(term) ||
      o.status.toLowerCase().includes(term);
    return matchesArchiveView && matchesSearch;
  });
}, [orders, searchTerm, isArchiveView]);

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

  const getStatusStyle = (status: string | undefined) => {
    const baseClass = s.statusBadge;
    if (!status) return baseClass;
    switch (status.toUpperCase()) {
      case 'PREPARING': return `${baseClass} ${s.pillBlue}`;
      case 'TO SHIP':   return `${baseClass} ${s.pillYellow}`;
      case 'RECEIVED':  return `${baseClass} ${s.pillGreen}`;
      case 'CANCELLED': return `${baseClass} ${s.pillRed}`;
      default: return baseClass;
    }
  };

  /* ===================== RENDER ===================== */
  return (
    <div className={s.container}>
      <TopHeader role={role} onLogout={onLogout} />

      {/* TOAST / ALERT */}
{/* TOAST / ALERT */}
{showToast && (
  <div className={s.toastOverlay}>

    {/* ADD ORDER style — wide, white, dark blue button */}
    {!isError && submittedData ? (
      <div className={s.alertBoxAdd}>
        <div className={s.alertHeaderAdd}>
          <div className={s.checkCircleAdd}>✓</div>
        </div>
        <div className={s.alertBodyAdd}>
          <h2 className={s.alertTitleAdd}>{toastTitle}</h2>
          <p className={s.alertMessageAdd}>{toastMessage}</p>
          <div className={s.alertDataTable}>
            <div className={s.alertDataRow}><span>Customer:</span><strong>{submittedData.customer}</strong></div>
            <div className={s.alertDataRow}><span>Total:</span><strong>₱{submittedData.total.toLocaleString()}</strong></div>
            <div className={s.alertDataRow}><span>Method:</span><strong>{submittedData.method}</strong></div>
            <div className={s.alertDataRow}><span>Time:</span><strong>{submittedData.dateTime}</strong></div>
          </div>
          <button className={s.okButtonAdd} onClick={() => { setShowToast(false); setSubmittedData(null); }}>OK</button>
        </div>
      </div>

    ) : (
      /* ARCHIVE / ERROR style — green band, smaller */
      <div className={s.alertBox}>
        <div className={`${s.alertHeader} ${isError ? s.alertHeaderError : ''}`}>
          <div className={`${s.checkCircle} ${isError ? s.checkCircleError : ''}`}>
            {isError ? '!' : '✓'}
          </div>
        </div>
        <div className={s.alertBody}>
          <h2 className={s.alertTitle}>{toastTitle}</h2>
          <p className={s.alertMessage}>{toastMessage}</p>
          <button className={`${s.okButton} ${isError ? s.okButtonError : ''}`} onClick={() => setShowToast(false)}>OK</button>
        </div>
      </div>
    )}

  </div>
)}

      <div className={s.mainContent}>
        {/* STAT CARDS */}
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

        {/* ================= CONDITIONAL RENDERING — same as inventory ================= */}
        {isArchiveView ? (
          <ArchiveTable
            orders={orders}                         // pass ALL orders, let ArchiveTable filter
            onRestore={handleToggleArchive}          // same toggle function used for archive + restore
            onBack={() => setIsArchiveView(false)}
          />
        ) : (
          <div className={s.tableContainer}>
            <div className={s.header}>
              <h2 className={s.title}>Orders</h2>
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
                  <input className={s.searchInput} placeholder="Search..." value={searchTerm} onChange={handleSearchChange} />
                  <LuSearch size={18} />
                </div>
                <button className={s.addButton} onClick={() => setShowAddModal(true)}>ADD</button>
              </div>
            </div>

            <table className={s.table}>
              <thead>
  <tr>
    {[
    { label: 'ID',       key: 'id',            sortable: true  },
    { label: 'CUSTOMER', key: 'customer',      sortable: true  },
    { label: 'ADDRESS',  key: 'address',       sortable: true  },
    { label: 'QTY',      key: 'totalQty',      sortable: true  },
    { label: 'TOTAL',    key: 'totalAmount',   sortable: true  },
    { label: 'PAYMENT',  key: 'paymentMethod', sortable: true  },
    { label: 'DATE',     key: 'date',          sortable: true  },
    { label: 'STATUS',   key: 'status',        sortable: true  },
    { label: 'ACTION',   key: null,            sortable: false },
    ].map(col => (
      <th
        key={col.label}
        onClick={() => col.sortable && col.key && handleSort(col.key as Exclude<SortKey, null>)}
        style={{ cursor: col.sortable ? 'pointer' : 'default' }}
      >
        <div className={s.sortableHeader}>
          <span>{col.label}</span>
          {col.sortable && col.key && (
            <div className={s.sortIconsStack}>
              <LuChevronUp size={12}
                style={{ color: sortConfig.key === col.key && sortConfig.direction === 'asc' ? '#1a4263' : '#cbd5e1' }}
              />
              <LuChevronDown size={12}
                style={{ color: sortConfig.key === col.key && sortConfig.direction === 'desc' ? '#1a4263' : '#cbd5e1' }}
              />
            </div>
          )}
        </div>
      </th>
    ))}
  </tr>
</thead>
              <tbody>
                {paginated.map((o, i) => (
                  <tr key={o.id} className={i % 2 ? s.altRow : ''}>
                    <td style={{ textAlign: 'center' }}>{o.id}</td>
                    <td style={{ textAlign: 'left', paddingLeft: '1rem' }}><strong>{o.customer}</strong></td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.address}</td>
                    <td style={{ textAlign: 'center' }}>{o.totalQty}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₱{o.totalAmount?.toLocaleString()}</td>
                    <td style={{ textAlign: 'center' }}>{o.paymentMethod}</td>
                    <td style={{ textAlign: 'center' }}>{o.date}</td>
                    <td style={{ textAlign: 'center' }}><span className={getStatusStyle(o.status)}>{o.status}</span></td>
                    <td className={s.actionCell}>
                      <LuEllipsisVertical
                        className={s.moreIcon}
                        onClick={() => setOpenMenuId(openMenuId === o.id ? null : o.id)}
                      />
                      {openMenuId === o.id && (
                        <div className={s.popupMenu}>
                          <button className={s.popBtnEdit} onClick={() => handleOpenEdit(o)}>
                            <LuPencil size={14} /> Edit
                          </button>
                          <button className={s.popBtnArchive} onClick={() => handleToggleArchive(o.id)}>
                            <LuArchive size={14} /> Archive
                          </button>
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
                {Array.from({ length: totalPages }, (_, i) => (
                  <div
                    key={i + 1}
                    className={`${s.pageCircle} ${currentPage === i + 1 ? s.pageCircleActive : ''}`}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </div>
                ))}
                <button
                  className={s.nextBtn}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                >
                  <LuChevronRight />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      <AddOrderModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
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