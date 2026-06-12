import { createClient } from "@supabase/supabase-js";

export type PlayerRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type RecordRow = {
  id: string;
  player_id: string;
  amount: string | number;
  rate: string | number;
  return_amount: string | number;
  profit: string | number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
