import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Helper function to handle Supabase errors
const handleSupabaseError = (error) => {
  console.error('Supabase error:', error);
  throw error;
};

// Export commonly used Supabase tables for easier access
export const tables = {
  tournois: 'tournois',
  tournoi_rackets: 'tournoi_rackets',
};

// Export storage bucket names
export const storageBuckets = {
  tournoi_docs: 'tournoi_documents',
  racket_images: 'racket_images',
};

// Helper functions for common operations
export const supabaseHelpers = {
  // Upload a file to storage
  uploadFile: async (bucket, path, file) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file);

    if (error) handleSupabaseError(error);
    return data;
  },

  // Get a public URL for a stored file
  getPublicUrl: (bucket, path) => {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);
    return data.publicUrl;
  },

  // Subscribe to realtime changes
  subscribe: (table, event, callback) => {
    return supabase
      .channel('any')
      .on('postgres_changes', { event, schema: 'public', table }, (payload) => {
        callback(payload);
      })
      .subscribe();
  },
};

export default supabase;
