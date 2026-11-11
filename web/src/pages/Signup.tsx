import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { messageOf, post } from '../api';
import { useAuth, type User } from '../state';
import { ErrorText, Field, useTitle } from '../ui';
import { fromOf } from './Login';

export function Signup() {
  useTitle('Cont nou');
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/api/auth/signup', { name, email, password }, { quiet401: true });
      // Sign-up does not start a session, so sign in with the same details.
      const r = await post<{ user: User }>('/api/auth/login', { email, password }, { quiet401: true });
      setUser(r.user);
      const from = fromOf(location.state);
      navigate(from === '/' ? '/programare' : from, { replace: true });
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md">
      <h1 className="text-3xl font-bold text-green-950">Cont nou</h1>
      <p className="mt-2">Nu folosi date reale: contul există doar în acest demo.</p>
      <form onSubmit={(e) => void submit(e)}>
        <Field id="nume" label="Nume" autoComplete="name" required maxLength={80} hint="Un nume inventat" value={name} onChange={(e) => setName(e.target.value)} />
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          hint="Folosește o adresă inventată, de exemplu ana@exemplu.test"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          id="parola"
          label="Parolă"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          hint="Cel puțin 10 caractere"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <ErrorText>{error}</ErrorText>
        <button type="submit" className="btn mt-6" disabled={busy}>
          Creează contul
        </button>
      </form>
      <p className="mt-4">
        Ai deja cont?{' '}
        <Link className="link" to="/autentificare" state={location.state}>
          Intră în cont
        </Link>
      </p>
    </div>
  );
}
