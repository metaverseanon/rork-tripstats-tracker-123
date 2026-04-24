export type DbConfig = {
  url?: string;
  anonKey?: string;
  serviceRoleKey?: string;
};

const HARDCODED_URL = 'https://emxpaaqzpqlagbzawgvf.supabase.co';
const HARDCODED_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVteHBhYXF6cHFsYWdiemF3Z3ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTk3OTEsImV4cCI6MjA5MjYzNTc5MX0.i9-s936bDmigl_i0hDxBBFjF81ceI1ctOjls9bJaQJw';

export function getDbConfig(): DbConfig {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || HARDCODED_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || HARDCODED_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey;

  const cfg: DbConfig = {
    url,
    anonKey,
    serviceRoleKey,
  };

  console.log("[DB] getDbConfig v1.1 (Supabase)", {
    hasUrl: !!url,
    urlLength: url?.length,
    hasAnonKey: !!anonKey,
    anonKeyLength: anonKey?.length,
    hasServiceRoleKey: !!serviceRoleKey,
    serviceRoleKeyLength: serviceRoleKey?.length,
  });

  return cfg;
}

export function isDbConfigured(): boolean {
  const { url, anonKey, serviceRoleKey } = getDbConfig();
  return !!(url && anonKey && serviceRoleKey);
}

export function getSupabaseHeaders(): Record<string, string> {
  const { anonKey, serviceRoleKey } = getDbConfig();
  return {
    "apikey": anonKey || "",
    "Authorization": `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
  };
}

export function getSupabaseRestUrl(table: string): string {
  const { url } = getDbConfig();
  return `${url}/rest/v1/${table}`;
}
