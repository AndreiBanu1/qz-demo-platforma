import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DEMO_ACCOUNTS } from '../../../shared/demo-accounts';
import { messageOf, post } from '../api';
import { useAuth, type User } from '../state';
import { ErrorText, Field, useTitle } from '../ui';

export const fromOf = (state: unknown): string => {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';
};

export function Login() {
  useTitle('Autentificare');
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ user: User }>('/api/auth/login', { email, password }, { quiet401: true });
      setUser(r.user);
      navigate(fromOf(location.state), { replace: true });
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section aria-labelledby="intra">
        <h1 id="intra" className="text-3xl font-bold text-green-950">
          Autentificare
        </h1>
        <form onSubmit={(e) => void submit(e)} className="mt-2">
          <Field id="email" label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field id="parola" label="Parolă" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <ErrorText>{error}</ErrorText>
          <button type="submit" className="btn mt-6" disabled={busy}>
            Intră în cont
          </button>
        </form>
        <p className="mt-4">
          Nu ai cont?{' '}
          <Link className="link" to="/cont-nou" state={location.state}>
            Creează un cont nou
          </Link>
        </p>
      </section>

      <section aria-labelledby="conturi" className="card self-start">
        <h2 id="conturi" className="text-xl font-bold text-green-950">
          Conturi demo
        </h2>
        <p className="mt-1 text-sm text-stone-700">Conturi publice, inventate, cu parole publice. Le poți folosi oricând.</p>
        <ul className="mt-3 space-y-3">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.id}>
              <p className="font-semibold">{a.role === 'admin' ? 'Administrator' : 'Client'}: {a.name}</p>
              <p>
                Email: <code className="break-all rounded bg-stone-100 px-1">{a.email}</code>
              </p>
              <p>
                Parolă: <code className="rounded bg-stone-100 px-1">{a.password}</code>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
