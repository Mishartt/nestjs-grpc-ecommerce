import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../auth/store';

export function Layout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          Shop
        </NavLink>
        <nav className="nav">
          <NavLink to="/" end>
            Catalog
          </NavLink>
          <NavLink to="/orders">Orders</NavLink>
          {isAdmin ? <NavLink to="/admin">Admin</NavLink> : null}
        </nav>
        <div className="session">
          <span className="muted">{user?.email}</span>
          {isAdmin ? <span className="badge">admin</span> : null}
          <button type="button" className="ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
