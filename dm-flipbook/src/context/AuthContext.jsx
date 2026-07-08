import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

const AuthContext = createContext(null);

function loadUser() {
  try { return JSON.parse(localStorage.getItem('admin_user') || 'null'); }
  catch { return null; }
}

export function AuthProvider({ children }) {
  const [mustChangePw, setMustChangePw] = useState(() => localStorage.getItem('admin_must_change_pw') === 'true');
  const [user, setUser]                 = useState(loadUser);

  // permissions 是 ["banner:read", "banner:write", ...] 字串陣列，做成 Set 方便 O(1) 查詢
  const permSet = useMemo(
    () => new Set(user?.permissions ?? []),
    [user]
  );

  const hasPermission = useCallback(
    (module, action) => permSet.has(`${module}:${action}`),
    [permSet]
  );

  const login = useCallback((mustChange = false, userInfo = null) => {
    localStorage.setItem('admin_must_change_pw', mustChange ? 'true' : 'false');
    localStorage.setItem('admin_user', JSON.stringify(userInfo));
    setMustChangePw(mustChange);
    setUser(userInfo);
  }, []);

  const clearMustChangePw = useCallback(() => {
    localStorage.setItem('admin_must_change_pw', 'false');
    setMustChangePw(false);
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('admin_must_change_pw');
    localStorage.removeItem('admin_user');
    setMustChangePw(false);
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/admin/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    localStorage.removeItem('admin_must_change_pw');
    localStorage.removeItem('admin_user');
    setMustChangePw(false);
    setUser(null);
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      localStorage.removeItem('admin_user');
      localStorage.removeItem('admin_must_change_pw');
      setUser(null);
      setMustChangePw(false);
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      clearAuth,
      clearMustChangePw,
      mustChangePw,
      isAuthenticated: !!user,
      isSuperAdmin: user?.role === 'super_admin',
      hasPermission,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
