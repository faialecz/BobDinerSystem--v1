'use client';

import { useEffect, useState } from "react";
import styles from "@/css/settings.module.css";
import { AiOutlineUser } from "react-icons/ai";
import { FiEdit3 } from "react-icons/fi";
import { LuArrowLeft, LuTrash2, LuUserPlus } from "react-icons/lu";
import SettingsHeader from "@/components/layout/BackSettingsHeader";

interface User {
  id?: number;
  name: string;
  role: string;
  contact?: string;
  email: string;
  status: 'Active' | 'Inactive';
}

export default function UserManagement({ onBack }: { onBack: () => void }) {

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // FETCH USERS FROM BACKEND
  const fetchUsers = async () => {
  try {
    const response = await fetch("http://localhost:5000/api/employees");
    const data = await response.json();

    // 🔥 map backend structure to frontend structure
    const formattedUsers = data.map((emp: any) => ({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      contact: emp.contact,
      role: emp.role_id === 1 ? "Admin"
           : emp.role_id === 2 ? "Manager"
           : emp.role_id === 3 ? "Head"
           : emp.role_id === 4 ? "Staff"
           : "Unknown",
      status: emp.status_id === 8 ? "Active" : "Inactive"
    }));

    setUsers(formattedUsers);

  } catch (error) {
    console.error("Error fetching users:", error);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchUsers();
  }, []);

  // CREATE USER (POST TO BACKEND)
  const handleCreateUser = async () => {
  // Prompt for Name
  const name = prompt("Enter Full Name:");
  if (!name || name.trim() === "") {
    return alert("Full Name is required!");
  }

  // Prompt for Email
  const email = prompt("Enter Email:");
  if (!email || email.trim() === "") {
    return alert("Email is required!");
  }

  // Prompt for Contact (must not be empty)
  const contact = prompt("Enter Contact Number:");
  if (!contact || contact.trim() === "") {
    return alert("Contact Number is required!");
  }

  // Prompt for Role
  const roleStr = prompt(
    "Enter Role:\n1 = Admin\n2 = Manager\n3 = Head\n4 = Staff"
  );
  if (!roleStr || !["1", "2", "3", "4"].includes(roleStr)) {
    return alert("Invalid role! Use 1, 2, 3 or 4.");
  }
  const role_id = parseInt(roleStr, 10);

  // Prompt for Password
  const password = prompt("Enter Password:");
  if (!password || password.trim() === "") {
    return alert("Password is required!");
  }

  // Choose Active/Inactive
  const statusStr = prompt("Enter Status ID (e.g., 8 = Active):");
  const status_id = parseInt(statusStr || "8", 10); // default Active

  // Send to backend
  try {
    const response = await fetch("http://localhost:5000/api/employees", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        contact: contact.trim(),
        role_id,
        password,
        status_id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return alert(data.error || "Failed to create user");
    }

    alert("Employee account created successfully!");
    fetchUsers(); // Refresh table after creation

  } catch (error) {
    console.error("Error creating user:", error);
    alert("Server error. Check console.");
  }
};

  return (
    <div className={styles.settingsCard}>
      <SettingsHeader 
        title="User Management" 
        icon={<AiOutlineUser />} 
        onBack={onBack} 
      />

      <div className={styles.placeholderContainer}>
        <div className={styles.listHeader}>
          <span>Name</span>
          <span>Role</span>
          <span>Email</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {loading ? (
          <p>Loading users...</p>
        ) : (
          users.map((user) => (
            <div key={user.id} className={styles.userPlaceholderRow}>
              <span className={styles.userName}>{user.name}</span>
              <span>{user.role}</span>
              <span className={styles.userEmail}>{user.email}</span>
              <span className={user.status === 'Active' ? styles.statusActive : styles.statusInactive}>
                {user.status}
              </span>
              <div className={styles.actionGroup}>
                <button className={styles.iconBtn}><FiEdit3 /></button>
                <button className={`${styles.iconBtn} ${styles.delete}`}><LuTrash2 /></button>
              </div>
            </div>
          ))
        )}
      </div>

      <button 
        className={styles.createBtn}
        onClick={handleCreateUser}
      >
        <LuUserPlus /> <span>Create New Account</span>
      </button>
    </div>
  );
}