/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef, useState } from "react";
import styles from "@/css/settings.module.css";
import { AiOutlineUser } from "react-icons/ai";
import { FiEdit3 } from "react-icons/fi";
import { LuArchiveRestore, LuUserPlus, LuChevronLeft, LuArchive } from "react-icons/lu";
import AddEmployeeModal from "./addEmployeeModal";
import ConfirmModal from "./confirmModal";

interface User {
  id: number;
  name: string;
  role: string;
  role_id: number;
  email: string;
  contact: string;
  status: 'Active' | 'Inactive';
  status_id: number;
  status_code: string;
  is_archived: boolean;
  inactivated_at?: string | null;
}

export default function UserManagement({ onBack, currentRoleId, currentEmployeeId }: {
  onBack: () => void;
  currentRoleId?: number;
  currentEmployeeId?: number;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [archivedUsers, setArchivedUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [userToArchive, setUserToArchive] = useState<number | null>(null);
  const [orderedRoleIds, setOrderedRoleIds] = useState<number[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [expiredQueue, setExpiredQueue] = useState<User[]>([]);
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Inline permission check — uses current prop values directly at render time ──
  const canEdit = (user: User): boolean => {
    const myId      = Number(currentEmployeeId);
    const theirId   = Number(user.id);
    const theirRole = Number(user.role_id);

    if (myId && myId === theirId) return true;   // self-edit: always first, no other checks needed
    if (theirRole === 1) return false;            // Super Admin: untouchable
    const myRole = Number(currentRoleId);
    if (!myRole || orderedRoleIds.length === 0) return false;
    const myIdx    = orderedRoleIds.indexOf(myRole);
    const theirIdx = orderedRoleIds.indexOf(theirRole);
    if (myIdx === -1) return false;
    if (myIdx >= orderedRoleIds.length - 2) return false; // Staff/Cashier: no others
    return myIdx < theirIdx;
  };

  const canArchive = (user: User): boolean => {
    const myId    = Number(currentEmployeeId);
    const theirId = Number(user.id);
    if (myId === theirId) return false;
    if (user.status_code === 'ACTIVE') return false; 
    return canEdit(user);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let map: Record<number, string> = { 1: 'Super Admin' };
      let ordered: number[] = [1];
      try {
        const rolesRes = await fetch('/api/roles?include_inactive=true');
        const rolesData = await rolesRes.json();
        if (Array.isArray(rolesData)) {
          rolesData.forEach((r: any) => {
            map[r.role_id] = r.role_name;
            ordered.push(r.role_id);
          });
        }
      } catch { /* keep seeds */ }
      setOrderedRoleIds(ordered);

      const response = await fetch(`/api/employees`);
      const data = await response.json();

      const active = data
        .filter((emp: any) => !emp.is_archived)
        .map((emp: any) => ({
          ...emp,
          role:   map[emp.role_id] ?? `Role ${emp.role_id}`,
          status: emp.status_code === 'ACTIVE' ? "Active" : "Inactive",
        }));

      const archived = data
        .filter((emp: any) => emp.is_archived)
        .map((emp: any) => ({
          ...emp,
          role:   map[emp.role_id] ?? `Role ${emp.role_id}`,
          status: "Inactive",
        }));

      setUsers(active);
      setArchivedUsers(archived);

      const now = Date.now();
      const expired = active.filter((u: User) => {
        if (!u.inactivated_at || u.status_code === 'ACTIVE') return false;
        const days = (now - new Date(u.inactivated_at).getTime()) / (1000 * 60 * 60 * 24);
        return days >= 30;
      });

setExpiredQueue(expired);
setShowExpiredModal(expired.length > 0);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initiateArchive = (id: number) => {
    setUserToArchive(id);
    setIsConfirmOpen(true);
  };

  const confirmArchive = async () => {
    if (!userToArchive) return;
    try {
      const url = `/api/employees/${userToArchive}?requester_role_id=${currentRoleId ?? 0}`;
      const response = await fetch(url, { method: "DELETE" });
      const data = await response.json();
      if (response.ok) {
        await fetchUsers();
        showToast('Employee archived successfully.', 'success');
      } else {
        showToast(data.error || 'Failed to archive employee.', 'error');
      }
    } catch (error) {
      console.error("Archive error:", error);
      showToast('Failed to archive employee.', 'error');
    } finally {
      setIsConfirmOpen(false);
      setUserToArchive(null);
    }
  };

  const removeFromExpiredQueue = (handledId: number) => {
    setExpiredQueue(prev => {
      const remaining = prev.filter(u => u.id !== handledId);
      if (remaining.length === 0) setShowExpiredModal(false);
      return remaining;
    });
  };

  const handleExpiredDelete = async (user: User) => {
    try {
      const url = `/api/employees/${user.id}/permanent?requester_role_id=${currentRoleId ?? 0}`;
      const response = await fetch(url, { method: "DELETE" });
      const data = await response.json();
      if (response.ok) {
        removeFromExpiredQueue(user.id);
        await fetchUsers();
        showToast(`${user.name}'s account has been permanently deleted.`, 'success');
      } else {
        showToast(data.error || 'Failed to delete employee.', 'error');
      }
    } catch {
      showToast('Failed to delete employee.', 'error');
    }
  };

  const handleExpiredRestore = async (user: User) => {
    try {
      const response = await fetch(`/api/employees/${user.id}/reactivate`, { method: "PUT" });
      if (response.ok) {
        removeFromExpiredQueue(user.id);
        await fetchUsers();
        showToast(`${user.name}'s account has been reactivated.`, 'success');
      } else {
        showToast('Failed to reactivate employee.', 'error');
      }
    } catch {
      showToast('Failed to reactivate employee.', 'error');
    }
  };

  const restoreUser = async (id: number) => {
    try {
      const response = await fetch(`/api/employees/${id}/restore`, { method: "PUT" });
      if (response.ok) {
        await fetchUsers();
        showToast('Employee restored successfully.', 'success');
      } else {
        showToast('Failed to restore employee.', 'error');
      }
    } catch (error) {
      console.error("Restore error:", error);
      showToast('Failed to restore employee.', 'error');
    }
  };

  return (
    <div className={styles.settingsCard}>
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem',
          background: toast.type === 'success' ? '#28a745' : '#dc3545',
          color: 'white', padding: '12px 20px', borderRadius: '8px',
          fontWeight: 600, fontSize: '0.9rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 9999,
        }}>
          {toast.message}
        </div>
      )}

      <div className={styles.settingsHeaderWrapper}>
        <button className={styles.backButton} onClick={onBack}>
          <LuChevronLeft /> Back
        </button>
        <div className={styles.titleGroup}>
          <div className={styles.iconWrapper}><AiOutlineUser /></div>
          <h2 className={styles.sectionLabel}>User Management</h2>
        </div>
      </div>

      <div className={styles.tabToggle}>
        <button className={`${styles.tabBtn} ${activeTab === "active" ? styles.tabActive : ""}`} onClick={() => setActiveTab("active")}>
          Users
        </button>
        <button className={`${styles.tabBtn} ${activeTab === "archived" ? styles.tabActive : ""}`} onClick={() => setActiveTab("archived")}>
          Archived Users
        </button>
      </div>

      <div className={styles.placeholderContainer}>
        <div className={styles.listHeader}>
          <span>Employee ID</span><span>Name</span><span>Role</span><span>Email</span><span>Status</span>
          <span style={{ textAlign: 'center' }}>Actions</span>
        </div>

        {loading ? (
          <div className={styles.loadingState}>Loading users...</div>
        ) : activeTab === "active" ? (
          users.length === 0 ? (
            <div className={styles.loadingState}>No active users found.</div>
          ) : (
            users.map((user) => {
              const editable  = canEdit(user);
              const archivable = canArchive(user);
              return (
                <div key={user.id} className={styles.userPlaceholderRow}>
                  <span className={styles.userId}>{user.id}</span>
                  <span className={styles.userName}>{user.name}</span>
                  <span>{user.role}</span>
                  <span>{user.email}</span>
                  <span className={user.status === 'Active' ? styles.statusActive : styles.statusInactive}>
                    {user.status}
                  </span>
                  <div className={styles.actionGroup}>
                    <button
                      className={styles.iconBtn}
                      onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                      disabled={!editable}
                      title={!editable ? (user.role_id === 1 ? 'Super Admin cannot be modified' : 'Insufficient permissions') : 'Edit employee'}
                      style={!editable ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                    >
                      <FiEdit3 />
                    </button>
                    <button
                      className={styles.archBtn}
                      onClick={() => initiateArchive(user.id)}
                      disabled={!archivable}
                     title={
                            user.status_code === 'ACTIVE'
                              ? 'Set employee to Inactive before archiving'
                              : !archivable
                              ? 'Insufficient permissions'
                              : 'Archive employee'
                          }
                      style={!archivable ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                    >
                      <LuArchive />
                    </button>
                  </div>
                </div>
              );
            })
          )
        ) : (
          archivedUsers.length === 0 ? (
            <div className={styles.loadingState}>No archived users found.</div>
          ) : (
            archivedUsers.map((user) => (
              <div key={user.id} className={styles.userPlaceholderRow}>
                <span className={styles.userId}>{user.id}</span>
                <span className={styles.userName}>{user.name}</span>
                <span>{user.role}</span>
                <span>{user.email}</span>
                <span className={styles.statusInactive}>{user.status}</span>
                <div className={styles.actionGroup}>
                  <button className={styles.iconBtn} onClick={() => restoreUser(user.id)} title="Restore employee">
                    <LuArchiveRestore />
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {activeTab === "active" && (
        <button className={styles.createBtn} onClick={() => { setSelectedUser(null); setIsModalOpen(true); }}>
          <LuUserPlus /> Create New Account
        </button>
      )}

      {isModalOpen && (
        <AddEmployeeModal
          onClose={() => setIsModalOpen(false)}
          onAdd={fetchUsers}
          employee={selectedUser}
          requesterRoleId={currentRoleId}
          requesterEmployeeId={currentEmployeeId}
          isSelf={Number(selectedUser?.id) === Number(currentEmployeeId)}
        />
      )}

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmArchive}
        title="Archive Employee?"
        message="Are you sure you want to archive this employee? This action cannot be undone."
        icon={<LuArchive style={{ fontSize: '2rem', color: '#ffffff' }} />}
        headerColor="#475569"
        confirmBtnColor="#475569"
      />

      {showExpiredModal && expiredQueue.length > 0 && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998,
        }}>
          <div style={{
            background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '520px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden',
          }}>
            <div style={{ background: '#b91c1c', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '50%', width: '2.5rem', height: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LuArchive style={{ color: '#fff', fontSize: '1.25rem' }} />
              </div>
              <div>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', display: 'block' }}>Accounts Pending Deletion</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>
                  {expiredQueue.length} account{expiredQueue.length > 1 ? 's have' : ' has'} been inactive for 30+ days
                </span>
              </div>
            </div>

            <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '0.5rem 0' }}>
              {expiredQueue.map((user, idx) => (
                <div key={user.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.85rem 1.5rem',
                  borderBottom: idx < expiredQueue.length - 1 ? '1px solid #f1f5f9' : 'none',
                }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{user.name}</p>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>{user.role} · ID {user.id}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button
                      onClick={() => handleExpiredRestore(user)}
                      style={{
                        padding: '0.4rem 0.9rem', borderRadius: '6px', border: '1.5px solid #16a34a',
                        background: '#fff', color: '#16a34a', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                      }}>
                      Restore
                    </button>
                    <button
                      onClick={() => handleExpiredDelete(user)}
                      style={{
                        padding: '0.4rem 0.9rem', borderRadius: '6px', border: 'none',
                        background: '#b91c1c', color: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                      }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowExpiredModal(false)}
                style={{
                  padding: '0.45rem 1.1rem', borderRadius: '6px', border: '1.5px solid #cbd5e1',
                  background: '#fff', color: '#64748b', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                }}>
                Remind me later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
