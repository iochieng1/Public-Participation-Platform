export type Lang = 'EN' | 'SW';
export type Role = 'CITIZEN' | 'OFFICER' | 'ADMIN';
export type Phase = 'DRAFT' | 'UPCOMING' | 'OPEN' | 'CLOSED' | 'REPORTED';

export interface User {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  language: Lang;
  wardId: string | null;
  countyId: number | null;
}

export interface Ward { id: string; name: string }
export interface SubCounty { id: string; name: string; wards: Ward[] }
export interface County { id: number; name: string; live?: boolean; subCounties?: SubCounty[] }

export interface Consultation {
  id: string;
  code: string;
  type: string;
  countyId: number | null;
  county: County | null;
  title: string;
  titleSw: string | null;
  summary: string;
  summarySw: string | null;
  documentUrl: string | null;
  opensAt: string;
  closesAt: string;
  status: string;
  phase: Phase;
  reportSummary: string | null;
  canManage?: boolean;
  _count?: { submissions: number };
}

export type Decision = 'PENDING' | 'ADOPTED' | 'PARTIALLY_ADOPTED' | 'NOT_ADOPTED';

export interface Submission {
  id: string;
  reference: string;
  channel: string;
  stance: string;
  clause: string | null;
  body: string;
  decision: Decision;
  decisionReason: string | null;
  ward: { name: string; subCounty: { name: string } } | null;
}

export interface Issue {
  id: string;
  reference: string;
  category: string;
  title: string;
  description: string;
  status: string;
  channel: string;
  upvoteCount: number;
  createdAt: string;
  ward: { id: string; name: string; subCounty: { name: string; county: County } };
  updates?: { id: string; status: string; note: string; createdAt: string; author: { name: string | null } }[];
  upvoted?: boolean;
}

const TOKEN_KEY = 'ppp.token';

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (t: string | null) => {
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  },
};

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const details = data?.details ? ` (${Object.entries(data.details).map(([k, v]) => `${k}: ${v}`).join('; ')})` : '';
    throw new Error((data?.error ?? `Request failed (${res.status})`) + details);
  }
  return data as T;
}

export const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
