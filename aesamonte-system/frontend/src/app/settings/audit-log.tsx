'use client';

import React from 'react';
import styles from "@/css/settings.module.css";
import BackSettingsHeader from "@/components/layout/BackSettingsHeader";
import { LuClipboardList } from "react-icons/lu";

export default function AuditLog({ onBack }: { onBack: () => void }) {
  return (
    <div className={styles.settingsCard}>
    <BackSettingsHeader
        title="Audit Log"
        icon={<LuClipboardList />}
        onBack={onBack}
    />

      <div className={styles.backupContainer}>
    </div>
    </div>
  );
}