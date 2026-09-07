'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async (sessionUser) => {
      if (!sessionUser) {
        setProfile(null);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, display_name, role')
          .eq('id', sessionUser.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
        } else {
          setProfile(data);
        }
      } catch (err) {
        console.error('Unexpected error fetching profile:', err);
      }
    };

    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        await fetchProfile(currentSession?.user);
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          await fetchProfile(newSession?.user);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = profile?.role === 'admin';
  const isAuthenticated = !!user;

  const value = {
    user,
    session,
    profile,
    loading,
    signOut,
    isAdmin,
    isAuthenticated,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export const DEFAULT_EMAIL_DOMAIN = 'taller.local';

/**
 * Normaliza un nombre de usuario o email.
 * Si el usuario introduce solo "pepe", devuelve "pepe@taller.local".
 * Si ya incluye "@" (ej. "admin@gmail.com"), lo respeta.
 */
export function formatAuthEmail(input) {
  if (!input) return '';
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes('@')) {
    return trimmed;
  }
  const cleanUsername = trimmed.replace(/[^a-z0-9._-]/g, '');
  return `${cleanUsername}@${DEFAULT_EMAIL_DOMAIN}`;
}

/**
 * Obtiene el nombre de usuario limpio para mostrar en la interfaz.
 * Si el email termina en "@taller.local" o "@taller.com", muestra solo "pepe".
 */
export function getDisplayUsername(email) {
  if (!email) return '';
  const lower = email.toLowerCase();
  if (lower.endsWith('@taller.local')) {
    return email.slice(0, -'@taller.local'.length);
  }
  if (lower.endsWith('@taller.com')) {
    return email.slice(0, -'@taller.com'.length);
  }
  return email;
}
