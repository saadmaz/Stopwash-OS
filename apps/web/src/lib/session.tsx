import { can as canRole, type Permission, type Role } from '@stopwash/shared';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { setAuthToken } from './api';

const KEY = 'sw:session';

/** Session survives a refresh but not closing the tab (same as the old app's passcode). */
function loadStored(): { user: SessionUser | null; token: string | null } {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return { user: null, token: null };
    const v = JSON.parse(raw) as { user: SessionUser; token: string };
    setAuthToken(v.token);
    return v;
  } catch {
    return { user: null, token: null };
  }
}

function store(v: { user: SessionUser; token: string } | null) {
  setAuthToken(v?.token ?? null);
  try {
    if (v) window.sessionStorage.setItem(KEY, JSON.stringify(v));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // storage blocked: session lasts until refresh
  }
}

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  brandId: string;
  locationIds: string[];
  employeeId?: string | null;
}

interface SessionCtx {
  user: SessionUser | null;
  token: string | null;
  signIn: (user: SessionUser, token: string) => void;
  signOut: () => void;
  can: (p: Permission) => boolean;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: SessionUser | null;
}) {
  const [state, setState] = useState<{ user: SessionUser | null; token: string | null }>(() =>
    initialUser ? { user: initialUser, token: null } : loadStored(),
  );
  const value = useMemo<SessionCtx>(
    () => ({
      ...state,
      signIn: (user, token) => {
        store({ user, token });
        setState({ user, token });
      },
      signOut: () => {
        store(null);
        setState({ user: null, token: null });
      },
      can: (p) => canRole(state.user?.role, p),
    }),
    [state],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}
