'use client';

import React, { useState } from 'react';
import styles from "@/css/inventory.module.css"; 

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Updated interface to support both success and error types
  onSuccess: (message: string, type?: 'success' | 'error') => void; 
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [format, setFormat] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const s = styles as Record<string, string>;

  if (!isOpen) return null;

  const handleExportClick = () => {
    // 1. Professional Error Handling: Triggers the red 'Oops!' pop-up
    if (!format) {
      onSuccess("Please select a format before exporting.", "error");
      return;
    }
    
    // 2. Logic execution
    console.log(`Downloading ${format} file...`);
    
    // 3. Trigger the professional green Success pop-up
    onSuccess(`Inventory Report Exported as ${format}!`, "success"); 
    
    // 4. Reset and Cleanup
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
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
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

export default ExportModal;