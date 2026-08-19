import { useEffect, type ReactNode } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useAuthStore } from '../shared/auth/store';
import { router } from './routes';

function SessionGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (status !== 'ready') {
    return (
      <div className="auth-screen">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <SessionGate>
      <RouterProvider router={router} />
    </SessionGate>
  );
}
