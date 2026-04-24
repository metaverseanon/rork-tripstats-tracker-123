export type DbConfig = {
  url?: string;
  anonKey?: string;
  serviceRoleKey?: string;
};

const HARDCODED_URL = 'https://zlyqrrmiegtxlpifwxxv.supabase.co';
const HARDCODED_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpseXFycm1pZWd0eGxwaWZ3eHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDkzODcsImV4cCI6MjA4NTc4NTM4N30.mbtqib3AQzhRnUT2Db9X9d5Btw7-hpNhRW7cF9Ev_QE';

export function getDbConfig(): DbConfig {
  const envPublicUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const envServerUrl = process.env.SUPABASE_URL;
  const url = envPublicUrl || envServerUrl || HARDCODED_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || HARDCODED_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey;
  const usingServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY && serviceRoleKey !== anonKey;

  const cfg: DbConfig = {
    url,
    anonKey,
    serviceRoleKey,
  };

  console.log("[DB] getDbConfig v1.2 (Supabase)", {
    hasUrl: !!url,
    urlLength: url?.length,
    hasAnonKey: !!anonKey,
    anonKeyLength: anonKey?.length,
    hasServiceRoleKey: !!serviceRoleKey,
    serviceRoleKeyLength: serviceRoleKey?.length,
    usingServiceRole,
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
