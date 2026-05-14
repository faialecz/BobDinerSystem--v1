/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import React, { useState, useEffect } from "react";
import { Eye, EyeOff, User, Lock, ChefHat } from "lucide-react";

import type { UserInfo } from "@/types/user";
import ForgotPassword from "./ForgotPassword";

interface LoginProps {
  onLogin: (user: UserInfo, mustChangePassword?: boolean) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [view, setView] = useState<"login" | "forgot">("login");

  const [username,      setUsername]      = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [password,      setPassword]      = useState("");
  const [showPassword,  setShowPassword]  = useState(false);
  const [rememberMe,    setRememberMe]    = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);
  const toastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: "error" | "success" | "info" = "error") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const saved = localStorage.getItem("rememberedUsername");
    const remembered = localStorage.getItem("rememberMe") === "true";
    if (saved) {
      setUsername(saved);
      setRememberMe(true);
    } else {
      setRememberMe(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password, remember_me: rememberMe }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.message || "Invalid credentials. Please check your username and password.", "error");
        return;
      }

      if (rememberMe) {
        localStorage.setItem("rememberedUsername", username);
        localStorage.setItem("rememberMe", "true"); 
      } else {
        localStorage.removeItem("rememberedUsername");
        localStorage.removeItem("rememberMe");  
      }

      if (!data.must_change_password) {
        localStorage.setItem("token", data.token);
      }
      onLogin(
        {
          employeeId:       data.employee_id,
          employeeName:     data.employee_name,
          employeeUsername: data.employee_username,
          roleName:         data.role,
          roleId:           data.role_id,
          isSystem:         data.is_system,
          permissions:      data.permissions,
          token:            data.token,
        },
        data.must_change_password === true,
      );
    } catch {
      showToast("Connection failed. The backend server is unreachable. Please try again later.", "error");
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/\s/.test(val)) return;
    if (val.length > 25) {
      setUsernameError("Username must be 25 characters or fewer.");
      return;
    }
    if (val === "" || /^[a-zA-Z0-9._@]+$/.test(val)) {
      setUsername(val);
      setUsernameError(val.length > 0 && val.length < 8 ? "Username must be at least 8 characters." : "");
    } else {
      setUsernameError("Username may only contain letters, numbers, and ( _ . @ )");
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/\s/.test(val)) return;
    if (val.length > 25) {
      setPasswordError("Password must be 25 characters or fewer.");
      return;
    }
    setPassword(val);
    setPasswordError(val.length > 0 && val.length < 8 ? "Password must be at least 8 characters." : "");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center overflow-hidden">
      {/* Full-screen background with image, blur, and dark overlay */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/bg.jpg')",
          filter: "blur(12px)",
          zIndex: -1
        }}
      />
      <div className="fixed inset-0 bg-black/60" style={{ zIndex: -1 }} />

      {/* Main login card container */}
      {view === "login" ? (
        <div className="w-full max-w-md px-4">
          {/* White login card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-10">
            
            {/* Header: Logo + Text */}
            <div className="flex items-start gap-4 mb-8">
              {/* Circular logo with chef hat icon */}
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center">
                  <ChefHat className="w-8 h-8 text-white" strokeWidth={1.5} />
                </div>
              </div>

              {/* Logo text block */}
              <div className="flex flex-col justify-center">
                <h1 className="text-xs font-bold uppercase tracking-widest text-slate-800">
                  Bob's Diner
                </h1>
                <p className="text-xs text-gray-500 leading-tight">
                  Inventory Monitoring System
                </p>
              </div>
            </div>

            {/* Welcome heading */}
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Welcome back
            </h2>

            {/* Subtitle */}
            <p className="text-sm text-gray-600 mb-6">
              Sign in to continue to your dashboard.
            </p>

            {/* Login form */}
            <form onSubmit={handleLogin} className="space-y-6">
              
              {/* Username field */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
                  <input
                    type="text"
                    value={username}
                    onChange={handleUsernameChange}
                    placeholder="Enter your username"
                    autoComplete="username"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-slate-900 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                  />
                </div>
                {usernameError && (
                  <p className="mt-1 text-xs text-red-600 font-medium">{usernameError}</p>
                )}
              </div>

              {/* Password field */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-slate-900 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" strokeWidth={2} />
                    ) : (
                      <Eye className="w-4 h-4" strokeWidth={2} />
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p className="mt-1 text-xs text-red-600 font-medium">{passwordError}</p>
                )}
              </div>

              {/* Sign in button */}
              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg transition duration-200"
              >
                Sign In
              </button>
            </form>

            {/* Footer */}
            <div className="mt-8 text-center border-t border-gray-200 pt-6">
              <p className="text-xs text-gray-500">
                © 2026 Bob's Diner — Inventory Monitoring System
              </p>
            </div>
          </div>
        </div>
      ) : (
        <ForgotPassword
          employeeId={username}
          employeeIdError={usernameError}
          handleEmployeeIdChange={handleUsernameChange}
          showToast={showToast}
          onBack={() => setView("login")}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full overflow-hidden">
            {/* Color band based on type */}
            <div className={`h-1 ${
              toast.type === "error" ? "bg-red-500" :
              toast.type === "success" ? "bg-green-500" :
              "bg-blue-500"
            }`} />
            
            <div className="p-6">
              <div className="flex items-start gap-4">
                {/* Icon circle */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                  toast.type === "error" ? "bg-red-500" :
                  toast.type === "success" ? "bg-green-500" :
                  "bg-blue-500"
                }`}>
                  {toast.type === "error" ? "✕" : toast.type === "success" ? "✓" : "ℹ"}
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">
                    {toast.type === "error" ? "Error" : toast.type === "success" ? "Success" : "Notice"}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{toast.message}</p>
                </div>
              </div>

              <button
                onClick={() => setToast(null)}
                className={`mt-4 w-full py-2 rounded font-medium text-sm transition ${
                  toast.type === "error" ? "bg-red-100 text-red-700 hover:bg-red-200" :
                  toast.type === "success" ? "bg-green-100 text-green-700 hover:bg-green-200" :
                  "bg-blue-100 text-blue-700 hover:bg-blue-200"
                }`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
