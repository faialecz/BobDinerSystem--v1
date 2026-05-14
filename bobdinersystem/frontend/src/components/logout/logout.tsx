'use client';

import { useRef, useEffect } from "react";
import styles from "@/css/logout.module.css";

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function LogoutModal({ isOpen, onClose, onConfirm }: LogoutModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className={styles.overlay} 
      >
      <div 
        className={styles.modalBox} 
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the cream box
      >
        <h2 className={styles.title}>Confirm Logout</h2>
        <p className={styles.text}>
          Confirming will securely sign you out of your account.
        </p>
        
        <div className={styles.buttonGroup}>
          <button className={styles.cancelBtn} onClick={onClose}>
            CANCEL
          </button>
          <button className={styles.confirmBtn} onClick={onConfirm}>
            LOG OUT
          </button>
        </div>
      </div>
    </div>
  );
}