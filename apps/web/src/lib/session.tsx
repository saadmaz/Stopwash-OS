import { can as canRole, type Permission, type Role } from '@stopwash/shared';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

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
  const [state, setState] = useState<{ user: SessionUser | null; token: string | null }>({
    user: initialUser,
    token: null,
  });
  const value = useMemo<SessionCtx>(
    () => ({
      ...state,
      signIn: (user, token) => setState({ user, token }),
      signOut: () => setState({ user: null, token: null }),
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
