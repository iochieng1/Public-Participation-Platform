import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokenStore, type Lang, type User } from './api';

interface Session {
  user: User | null;
  lang: Lang;
  setLang: (l: Lang) => void;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<Session>(null!);
export const useSession = () => useContext(Ctx);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [lang, setLangState] = useState<Lang>('EN');

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) return setUser(null);
    try {
      const me = await api<User>('/me');
      setUser(me);
      setLangState(me.language);
    } catch {
      tokenStore.set(null);
      setUser(null);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (user) api('/me', { method: 'PATCH', body: { language: l } }).catch(() => {});
  };

  return (
    <Ctx.Provider
      value={{
        user,
        lang,
        setLang,
        refresh,
        signIn: (token, u) => { tokenStore.set(token); setUser(u); setLangState(u.language); },
        signOut: () => { tokenStore.set(null); setUser(null); },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

// UI strings. Consultation content itself comes bilingual from the API.
const ui = {
  consultations: { EN: 'Consultations', SW: 'Maoni ya umma' },
  issues: { EN: 'Ward issues', SW: 'Matatizo ya wadi' },
  track: { EN: 'Track a reference', SW: 'Fuatilia kumbukumbu' },
  signIn: { EN: 'Sign in', SW: 'Ingia' },
  signOut: { EN: 'Sign out', SW: 'Toka' },
  profile: { EN: 'My ward', SW: 'Wadi yangu' },
  noPhone: {
    EN: 'No smartphone? Dial the USSD code or SMS the consultation code to the county shortcode.',
    SW: 'Huna simu janja? Piga msimbo wa USSD au tuma SMS yenye nambari ya mjadala kwa nambari fupi ya kaunti.',
  },
  readDoc: { EN: 'Read the full document', SW: 'Soma hati kamili' },
  closes: { EN: 'Closes', SW: 'Inafungwa' },
  opens: { EN: 'Opens', SW: 'Inafunguliwa' },
  haveYourSay: { EN: 'Have your say', SW: 'Toa maoni yako' },
  submit: { EN: 'Submit', SW: 'Tuma' },
  viewReport: { EN: 'Read the feedback report', SW: 'Soma ripoti ya maoni' },
} as const;

export const useT = () => {
  const { lang } = useSession();
  return (k: keyof typeof ui) => ui[k][lang];
};
