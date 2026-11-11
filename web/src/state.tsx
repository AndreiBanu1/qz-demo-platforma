import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, get, post, setUnauthorizedHandler } from './api';

export type User = { id: string; email: string; name: string; role: 'client' | 'admin' };

type Auth = {
  user: User | null;
  ready: boolean;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
};
const AuthContext = createContext<Auth | null>(null);

export function useAuth(): Auth {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    get<{ user: User }>('/api/me', { quiet401: true })
      .then((r) => alive && setUser(r.user))
      .catch((e) => {
        // 401 is the normal "not signed in" (also a session whose user was wiped); anything else just leaves us signed out.
        if (!(e instanceof ApiError)) console.error(e);
      })
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      navigate('/autentificare', { state: { from: window.location.pathname + window.location.search } });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  const logout = useCallback(async () => {
    try {
      await post('/api/auth/logout', undefined, { quiet401: true });
    } finally {
      setUser(null);
      navigate('/');
    }
  }, [navigate]);

  const value = useMemo(() => ({ user, ready, setUser, logout }), [user, ready, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

type Bugs = { ready: boolean; active: string[]; labels: Record<string, string>; has: (id: string) => boolean };
const BugsContext = createContext<Bugs | null>(null);

export function useBugs(): Bugs {
  const v = useContext(BugsContext);
  if (!v) throw new Error('useBugs outside BugsProvider');
  return v;
}

/** Applies `?bugs=` on load (a fetch, not a page load), drops it from the address bar, then reads the active bugs. */
export function BugsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<Bugs, 'has'>>({ ready: false, active: [], labels: {} });

  useEffect(() => {
    let alive = true;
    (async () => {
      const url = new URL(window.location.href);
      const ids = url.searchParams.get('bugs');
      if (ids !== null) {
        try {
          await post('/__demo/bugs', { ids }, { quiet401: true });
        } catch (e) {
          console.error(e);
        }
        url.searchParams.delete('bugs');
        // Keep history.state so React Router's bookkeeping stays valid.
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      }
      try {
        const r = await get<{ active: string[]; labels: Record<string, string> }>('/__demo/bugs', { quiet401: true });
        if (alive) setState({ ready: true, active: r.active, labels: r.labels });
      } catch {
        if (alive) setState({ ready: true, active: [], labels: {} });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(() => ({ ...state, has: (id: string) => state.active.includes(id) }), [state]);
  return <BugsContext.Provider value={value}>{children}</BugsContext.Provider>;
}
