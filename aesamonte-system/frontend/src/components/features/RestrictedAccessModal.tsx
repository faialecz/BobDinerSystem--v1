'use client';

import { MdOutlineLock } from 'react-icons/md';
import styles from '@/css/restrictedModal.module.css';

interface Props {
  onClose: () => void;
  message?: string;
}

export default function RestrictedAccessModal({ onClose, message }: Props) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.box} onClick={e => e.stopPropagation()}>
        <div className={styles.iconWrap}>
          <MdOutlineLock size={30} />
        </div>
        <h2 className={styles.title}>Restricted Access</h2>
        <p className={styles.message}>
          {message ?? "You don't have permission to perform this action. Please contact your administrator."}
        </p>
        <button className={styles.okBtn} onClick={onClose}>Okay</button>
      </div>
    </div>
  );
}
