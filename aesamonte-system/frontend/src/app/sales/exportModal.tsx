'use client';

import React, { useState } from 'react';
import styles from "@/css/sales.module.css";

interface SalesExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Updated to accept an optional type for handling errors
  onSuccess: (message: string, type?: 'success' | 'error') => void; 
}

const SalesExportModal: React.FC<SalesExportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const s = styles as Record<string, string>;
  
  const [format, setFormat] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (!isOpen) return null;

  const handleExportClick = () => {
    // 1. Updated Error handling: No more browser alert
    if (!format) {
      onSuccess("Please select a format before exporting.", "error"); 
      return;
    }
    
    // 2. Logic execution
    console.log(`Exporting Sales Report as ${format}...`);
    
    // 3. Trigger the success message with default 'success' type
    onSuccess(`Sales Report Exported as ${format}!`, "success"); 
    
    // 4. Cleanup and close
    setFormat(""); 
    onClose(); 
  };

  return (
    <div className={s.modalOverlay}>
      <div className={s.exportModalContainer}>
        <button onClick={onClose} className={s.closeButton}>✕</button>

        <h2 className={s.modalTitleLarge}>Export</h2>

        <div className={s.exportFormGroup}>
          <label className={s.labelMedium}>Export as:</label>
          <div className={s.selectWrapper}>
            <select 
              value={format}
              onChange={(e) => {
                setFormat(e.target.value);
                setIsDropdownOpen(false); 
              }}
              className={s.exportSelect}
              onFocus={() => setIsDropdownOpen(true)}
              onBlur={() => setIsDropdownOpen(false)}
            >
              <option value="" disabled>Select</option>
              <option value="PDF">PDF</option>
              <option value="Excel">Excel</option>
              <option value="CSV">CSV</option>
            </select>
            
            <div className={`${s.selectArrow} ${isDropdownOpen ? s.arrowUp : ''}`}>
              <span>{isDropdownOpen ? '▲' : '▼'}</span>
            </div>
          </div>
        </div>

        <div className={s.modalFooterRight}>
          <button onClick={handleExportClick} className={s.exportConfirmBtn}>
            EXPORT
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesExportModal;