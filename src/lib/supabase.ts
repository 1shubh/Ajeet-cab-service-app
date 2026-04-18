// supabase.js
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

// Custom Supabase storage
const customStorage = {
  async getItem(key: string) {
    return await SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    return await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    return await SecureStore.deleteItemAsync(key);
  },
};

const SUPABASE_URL = "https://krnlqgkzbmbebdaebfvq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtybmxxZ2t6Ym1iZWJkYWViZnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Mzk2MzgsImV4cCI6MjA5MTExNTYzOH0.YrWiQy2QM4uv28awBLSr8kggTaJxxQOt3Z8K1PbRupA";


  export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);