/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import React, { useEffect, useState } from 'react';
import { LuX, LuPencil, LuCheck } from 'react-icons/lu';

interface UomEntry {
  id: number;
  name: string;
}

interface UomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUomAdded?: (uom: UomEntry) => void;
}

const FIELD: React.CSSProperties = {
  height: '40px', padding: '8px 12px', borderRadius: '8px',
  border: '1px solid #d1d5db', backgroundColor: '#fff',
  color: '#1f2937', fontSize: '0.9rem', outline: 'none', width: '100%',
};

const UomModal: React.FC<UomModalProps> = ({ isOpen, onClose, onUomAdded }) => {
  const [uoms, setUoms] = useState<UomEntry[]>([]);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const fetchUoms = async () => {
    try {
      const res = await fetch('/api/uom');
      if (res.ok) setUoms(await res.json());
    } catch (e) {
      console.error('Failed to fetch UOMs', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUoms();
      setNewName('');
      setAddError('');
      setEditingId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAdd = async () => {
    setAddError('');
    const name = newName.trim();
    if (!name) { setAddError('UOM name is required'); return; }
    setAdding(true);
    try {
      const res = await fetch('/api/uom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uom_name: name }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error || 'Failed to add UOM'); return; }
      setUoms(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      onUomAdded?.(data);
    } catch {
      setAddError('Network error');
    } finally {
      setAdding(false);
    }
  };

  const handleEditSave = async (uom: UomEntry) => {
    const name = editName.trim();
    if (!name) return;
    try {
      const res = await fetch(`/api/uom/${uom.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uom_name: name }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUoms(prev => prev.map(u => u.id === uom.id ? updated : u).sort((a, b) => a.name.localeCompare(b.name)));
        setEditingId(null);
      }
    } catch (e) {
      console.error('Edit save error', e);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: '16px', width: '480px',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '24px 28px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#0f172a' }}>Unit of Measurements</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>Manage measurement units</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LuX size={18} color="#64748b" />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px' }}>

          {/* Add New Unit */}
          <div style={{ marginBottom: '28px' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', marginBottom: '12px' }}>Add New Unit</p>
            <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>UOM Name</label>
                  <input
                    style={{ ...FIELD }}
                    placeholder="e.g. Kilograms"
                    value={newName}
                    onChange={e => { setNewName(e.target.value); setAddError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  />
                </div>
                <button
                  onClick={handleAdd}
                  disabled={adding}
                  style={{ height: '40px', padding: '0 20px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', cursor: adding ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  + Add
                </button>
              </div>
              {addError && <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: '#ef4444' }}>{addError}</p>}
            </div>
          </div>

          {/* UOM list */}
          <div>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', marginBottom: '12px' }}>Unit of Measurement Details</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px', gap: '8px', padding: '0 4px 8px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8' }}>Unit Name</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', textAlign: 'center' }}>Action</span>
            </div>

            {uoms.length === 0 && (
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', padding: '24px 0' }}>No units found.</p>
            )}

            {uoms.map(uom => (
              <div key={uom.id} style={{ display: 'grid', gridTemplateColumns: '1fr 56px', gap: '8px', alignItems: 'center', padding: '14px 4px', borderBottom: '1px solid #f8fafc' }}>

                <div>
                  {editingId === uom.id ? (
                    <input
                      autoFocus
                      style={{ ...FIELD, height: '32px', fontSize: '0.88rem' }}
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEditSave(uom); if (e.key === 'Escape') setEditingId(null); }}
                    />
                  ) : (
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{uom.name}</p>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {editingId === uom.id ? (
                    <button
                      onClick={() => handleEditSave(uom)}
                      style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LuCheck size={14} color="#16a34a" />
                    </button>
                  ) : (
                    <button
                      onClick={() => { setEditingId(uom.id); setEditName(uom.name); }}
                      style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LuPencil size={14} color="#64748b" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UomModal;
