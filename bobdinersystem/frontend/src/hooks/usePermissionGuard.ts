import { useState } from 'react';

/**
 * Provides a guard() wrapper and a RestrictedAccessModal trigger.
 *
 * Usage:
 *   const { guard, denied, dismiss } = usePermissionGuard();
 *   <button onClick={guard(perms?.can_create, () => setShowAddModal(true))}>ADD</button>
 *   {denied && <RestrictedAccessModal onClose={dismiss} />}
 */
export function usePermissionGuard() {
  const [denied, setDenied] = useState(false);

  /**
   * Returns a click handler.
   * - If hasPerm is true  → runs action()
   * - If hasPerm is false → opens the RestrictedAccessModal
   */
  function guard(hasPerm: boolean | undefined, action: () => void): () => void {
    return () => {
      if (hasPerm) action();
      else setDenied(true);
    };
  }

  function dismiss() {
    setDenied(false);
  }

  return { guard, denied, dismiss };
}
