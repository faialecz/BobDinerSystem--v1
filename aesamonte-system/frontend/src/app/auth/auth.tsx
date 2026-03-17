/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import styles from "@/css/auth.module.css";

import type { UserInfo } from "@/types/user";
import ForgotPassword from "./ForgotPassword";

interface LoginProps {
  onLogin: (user: UserInfo) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [view, setView] = useState<"login" | "forgot">("login");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeIdError, setEmployeeIdError] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);
  const toastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: "error" | "success" | "info" = "error") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (rememberMe) {
          localStorage.setItem("rememberedEmployeeId", employeeId);
        } else {
          localStorage.removeItem("rememberedEmployeeId");
        }
        localStorage.setItem("token", data.token);
        onLogin({
          employeeId:  data.employee_id,
          roleName:    data.role,
          department:  data.department ?? null,
          permissions: data.permissions,
          token:       data.token,
        });
      } else {
        showToast(data.message || "Invalid credentials. Please check your Employee ID and password.", "error");
      }
    } catch {
      showToast("Connection failed. The backend server is unreachable. Please try again later.", "error");
    }
  };

  useEffect(() => {
    const savedId = localStorage.getItem("rememberedEmployeeId");
    if (savedId) {
      setEmployeeId(savedId);
      setRememberMe(true);
    }
  }, []);

  const handleEmployeeIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d+$/.test(val)) {
      setEmployeeId(val);
      setEmployeeIdError("");
    } else {
      setEmployeeIdError("Employee ID must contain numbers only.");
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginLogo}>
        <Image
          src="/ae-logo.png"
          alt="AE Samonte Logo"
          width={100}
          height={100}
          className={styles.loginLogoImg}
          priority
        />
        {view === "login" && <h2 className={styles.loginTitle}>Welcome Back!</h2>}
      </div>

      <div className={styles.loginFormBox}>
        {view === "login" ? (
          /* --- LOGIN --- */
          <form onSubmit={handleLogin} className={styles.loginForm}>
            <div className={styles.loginField}>
              <label className={styles.loginLabel}>Employee ID <span style={{ color: "red" }}>*</span></label>
              <input
                type="text"
                value={employeeId}
                onChange={handleEmployeeIdChange}
                className={styles.loginInput}
                required
                suppressHydrationWarning={true}
              />
              {employeeIdError && <span className={styles.fieldError}>{employeeIdError}</span>}
            </div>

            <div className={styles.loginField}>
              <label className={styles.loginLabel}>Password <span style={{ color: "red" }}>*</span></label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.loginInput}
                  required
                  suppressHydrationWarning={true}
                />
                <span className={styles.eyeIcon} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <AiFillEyeInvisible /> : <AiFillEye />}
                </span>
              </div>
            </div>

            <div className={styles.formOptions}>
              <label className={styles.rememberLabel}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember Me</span>
              </label>
              <a href="#" className={styles.forgotLink} onClick={() => setView("forgot")}>
                Forgot Password?
              </a>
            </div>

            <button
              suppressHydrationWarning={true}
              type="submit"
              className={styles.loginSubmit}
            >
              LOGIN
            </button>
          </form>
        ) : (
          /* --- FORGOT PASSWORD --- */
          <ForgotPassword
            employeeId={employeeId}
            employeeIdError={employeeIdError}
            handleEmployeeIdChange={handleEmployeeIdChange}
            showToast={showToast}
            onBack={() => setView("login")}
          />
        )}
      </div>

      {/* ALERT MODAL */}
      {toast && (
        <div className={styles.modalOverlay}>
          <div className={styles.alertModal}>
            <div className={`${styles.alertModalBand} ${styles[`alertBand_${toast.type}`]}`} />
            <div className={`${styles.alertModalCircle} ${styles[`alertCircle_${toast.type}`]}`}>
              {toast.type === "error" ? "✕" : toast.type === "success" ? "✓" : "ℹ"}
            </div>
            <div className={styles.alertModalBody}>
              <h2 className={styles.alertModalTitle}>
                {toast.type === "error" ? "Login Failed" : toast.type === "success" ? "Success" : "Notice"}
              </h2>
              <p className={styles.alertModalMessage}>{toast.message}</p>
              <button className={`${styles.alertModalOkBtn} ${styles[`alertOkBtn_${toast.type}`]}`} onClick={() => setToast(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
