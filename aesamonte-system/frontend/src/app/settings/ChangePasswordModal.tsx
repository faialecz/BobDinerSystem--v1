'use client';
import React, { useState } from "react";
import styles from "@/css/addEmployeeModal.module.css";
import { LuX, LuSave } from "react-icons/lu";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";

interface ChangePasswordModalProps {
  employeeId: number;
  onClose: () => void;
  showToast: (message: string, type: "error" | "success" | "info") => void;
}

export default function ChangePasswordModal({ employeeId, onClose, showToast }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword)
      return showToast("All fields are required.", "error");
    if (newPassword !== confirmPassword)
      return showToast("New passwords do not match.", "error");
    if (newPassword.length < 6)
      return showToast("New password must be at least 6 characters.", "error");

    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, currentPassword, newPassword }),
      });
      const data = await response.json();
      if (response.ok) {
        showToast("Password changed successfully.", "success");
        onClose();
      } else {
        showToast(data.message || "Failed to change password.", "error");
      }
    } catch {
      showToast("Connection failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.title}>Change Password</h2>
            <p className={styles.subText}>Update your account password</p>
          </div>
          <LuX className={styles.closeIcon} onClick={onClose} />
        </div>

        <div className={styles.modalFormBody}>
          <div className={styles.formSection}>
            <div className={styles.formGroupFull}>
              <label>Current Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  style={{ paddingRight: "36px", width: "100%", boxSizing: "border-box" }}
                />
                <span
                  onClick={() => setShowCurrent((p) => !p)}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#888" }}
                >
                  {showCurrent ? <AiFillEyeInvisible /> : <AiFillEye />}
                </span>
              </div>
            </div>

            <div className={styles.formGroupFull} style={{ marginTop: "14px" }}>
              <label>New Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  style={{ paddingRight: "36px", width: "100%", boxSizing: "border-box" }}
                />
                <span
                  onClick={() => setShowNew((p) => !p)}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#888" }}
                >
                  {showNew ? <AiFillEyeInvisible /> : <AiFillEye />}
                </span>
              </div>
            </div>

            <div className={styles.formGroupFull} style={{ marginTop: "14px" }}>
              <label>Confirm New Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  style={{ paddingRight: "36px", width: "100%", boxSizing: "border-box" }}
                />
                <span
                  onClick={() => setShowConfirm((p) => !p)}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#888" }}
                >
                  {showConfirm ? <AiFillEyeInvisible /> : <AiFillEye />}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={styles.saveBtn} onClick={handleSubmit} disabled={loading}>
              <LuSave /> {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
