/**
 * useAuth Hook
 * Manages authentication state and provides auth methods
 * Uses Supabase Auth for all operations
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import supabase from '../utils/supabaseClient';
import { isValidUMassEmail } from '../utils/constants';

// Create Auth Context
const AuthContext = createContext(null);

/**
 * Auth Provider Component
 * Wraps the app and provides auth state to all children
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user profile from users table using direct API call
  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return null;
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=*`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error('Profile fetch failed:', response.status);
        return null;
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        setProfile(data[0]);
        return data[0];
      }
      
      // Profile doesn't exist yet - this is expected for new users
      return null;
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth timeout')), 5000)
        );
        
        // Get current session with timeout
        const sessionPromise = supabase.auth.getSession();
        const { data: { session }, error: sessionError } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]);
        
        if (sessionError) {
          throw sessionError;
        }

        if (session?.user && mounted) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch (err) {
        if (mounted) {
          console.log('Auth init error (continuing anyway):', err.message);
          // Don't set error - just continue without auth
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
        } else if (event === 'USER_UPDATED' && session?.user) {
          setUser(session.user);
        } else if (event === 'TOKEN_REFRESHED') {
          // Token was refreshed, session is still valid
        }
        
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  /**
   * Sign up with email and password
   * Creates auth user and profile in users table
   */
  const signUp = useCallback(async (email, password, name) => {
    setError(null);
    setLoading(true);

    try {
      // Validate UMass email
      if (!isValidUMassEmail(email)) {
        throw new Error('Please use a valid UMass email address (@umass.edu or @students.umass.edu)');
      }

      // Validate password strength
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Sign up failed. Please try again.');
      }

      // Create user profile
      const { error: profileError } = await supabase.from('users').insert([
        {
          id: authData.user.id,
          name: name || email.split('@')[0],
          karma: 0,
          level: 'Finder',
          rating: 5.0,
          items_returned: 0,
        },
      ]);

      if (profileError) {
        // If profile creation fails, we should still return success
        // as the user can update their profile later
        // Log the error but don't throw
      }

      return {
        success: true,
        message: 'Please check your email to verify your account.',
        user: authData.user,
      };
    } catch (err) {
      setError(err.message);
      return {
        success: false,
        message: err.message,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(async (email, password) => {
    setError(null);
    setLoading(true);

    try {
      // Validate UMass email
      if (!isValidUMassEmail(email)) {
        throw new Error('Please use a valid UMass email address (@umass.edu or @students.umass.edu)');
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      if (data.user) {
        setUser(data.user);
        await fetchProfile(data.user.id);
      }

      return {
        success: true,
        user: data.user,
      };
    } catch (err) {
      setError(err.message);
      return {
        success: false,
        message: err.message,
      };
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  /**
   * Sign out
   */
  const signOut = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        throw signOutError;
      }

      setUser(null);
      setProfile(null);

      return { success: true };
    } catch (err) {
      setError(err.message);
      return {
        success: false,
        message: err.message,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Reset password
   */
  const resetPassword = useCallback(async (email) => {
    setError(null);
    setLoading(true);

    try {
      if (!isValidUMassEmail(email)) {
        throw new Error('Please use a valid UMass email address');
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) {
        throw resetError;
      }

      return {
        success: true,
        message: 'Password reset email sent. Please check your inbox.',
      };
    } catch (err) {
      setError(err.message);
      return {
        success: false,
        message: err.message,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update password
   */
  const updatePassword = useCallback(async (newPassword) => {
    setError(null);
    setLoading(true);

    try {
      if (newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      return {
        success: true,
        message: 'Password updated successfully.',
      };
    } catch (err) {
      setError(err.message);
      return {
        success: false,
        message: err.message,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (updates) => {
    setError(null);

    try {
      if (!user) {
        throw new Error('You must be logged in to update your profile');
      }

      const { data, error: updateError } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setProfile(data);

      return {
        success: true,
        profile: data,
      };
    } catch (err) {
      setError(err.message);
      return {
        success: false,
        message: err.message,
      };
    }
  }, [user]);

  /**
   * Upload profile photo
   */
  const uploadProfilePhoto = useCallback(async (file) => {
    setError(null);

    try {
      if (!user) {
        throw new Error('You must be logged in to upload a photo');
      }

      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Please upload a JPEG, PNG, or WebP image');
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image must be smaller than 5MB');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/profile.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('item-photos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('item-photos')
        .getPublicUrl(fileName);

      // Update profile with new photo URL
      await updateProfile({ profile_photo_url: publicUrl });

      return {
        success: true,
        url: publicUrl,
      };
    } catch (err) {
      setError(err.message);
      return {
        success: false,
        message: err.message,
      };
    }
  }, [user, updateProfile]);

  /**
   * Refresh profile data
   */
  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = {
    user,
    profile,
    loading,
    error,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    uploadProfilePhoto,
    refreshProfile,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * useAuth Hook
 * Access auth state and methods from any component
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default useAuth;
