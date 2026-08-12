import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../constants';

axios.defaults.withCredentials = true;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshUser = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/me`);
      setUser(response.data.user);
      setError('');
      return response.data.user;
    } catch (requestError) {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async ({ email, password }) => {
    setError('');
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, { email, password });
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const register = useCallback(async (payload) => {
    setError('');
    const response = await axios.post(`${API_BASE_URL}/api/auth/register`, payload);
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const logout = useCallback(async () => {
    await axios.post(`${API_BASE_URL}/api/auth/logout`);
    setUser(null);
  }, []);

  const completeGoogleSetup = useCallback(async (payload) => {
    setError('');
    const response = await axios.post(`${API_BASE_URL}/api/auth/google/setup`, payload);
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const value = useMemo(() => ({
    completeGoogleSetup,
    error,
    isAuthenticated: Boolean(user),
    loading,
    login,
    logout,
    refreshUser,
    register,
    setError,
    user
  }), [completeGoogleSetup, error, loading, login, logout, refreshUser, register, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
