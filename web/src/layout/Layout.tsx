import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useBugs } from '../state';
import { Banner } from './Banner';
import { BugStrip } from './BugStrip';
import { Footer } from './Footer';

const navLink = ({ isActive }: { isActive: boolean }) =>
  `rounded px-2 py-2 font-medium underline-offset-4 hover:underline ${isActive ? 'text-green-950 underline' : 'text-green-900'}`;

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div>
        <h1 className="text-2xl font-bold text-green-950">A apărut o eroare</h1>
        <p className="mt-2">Ceva nu a mers. Reîncarcă pagina sau întoarce-te la prima pagină.</p>
        <a className="link mt-4 inline-block" href="/">
          Prima pagină
        </a>
      </div>
    );
  }
}

export function Layout() {
  const { user, ready, logout } = useAuth();
  const bugs = useBugs();
  const location = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 shadow">
        <Banner />
        <BugStrip />
        <div className="border-b border-green-200 bg-white">
          <nav aria-label="Navigare principală" className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-2 px-4 py-1">
            <Link to="/" className="mr-4 py-2 text-xl font-bold text-green-900">
              Bucla Verde
            </Link>
            <NavLink to="/" end className={navLink}>
              Acasă
            </NavLink>
            <NavLink to="/programare" className={navLink}>
              Programare
            </NavLink>
            {user ? (
              <>
                <NavLink to="/contul-meu" className={navLink}>
                  Contul meu
                </NavLink>
                {user.role === 'admin' && (
                  <NavLink to="/admin" className={navLink}>
                    Admin
                  </NavLink>
                )}
                <button type="button" onClick={() => void logout()} className="rounded px-2 py-2 font-medium text-green-900 underline-offset-4 hover:underline">
                  Ieși din cont
                </button>
              </>
            ) : (
              <>
                <NavLink to="/autentificare" className={navLink}>
                  Autentificare
                </NavLink>
                <NavLink to="/cont-nou" className={navLink}>
                  Cont nou
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {ready && bugs.ready ? (
          // Keyed by path, so page state never leaks from one route to the next.
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        ) : (
          <p>Se încarcă…</p>
        )}
      </main>
      <Footer />
    </div>
  );
}

/** Sends visitors who are not signed in to the login page, and brings them back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/autentificare" replace state={{ from: location.pathname + location.search }} />;
  return children;
}
