import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BookingDto } from '../../../shared/schemas';
import { get, messageOf, post } from '../api';
import { STATUS_LABEL, useCatalog } from '../booking';
import { hhmm, longDay } from '../format';
import { useAuth } from '../state';
import { ErrorText, useLoad, useTitle } from '../ui';

export function Account() {
  useTitle('Contul meu');
  const { user } = useAuth();
  const list = useLoad(() => get<{ bookings: BookingDto[] }>('/api/bookings'), 'bookings');
  const catalog = useCatalog();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const cancel = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await post(`/api/bookings/${encodeURIComponent(id)}/cancel`);
      list.reload();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusyId(null);
    }
  };

  const all = [...(list.data?.bookings ?? [])].sort((a, b) => (a.start < b.start ? -1 : 1));
  const nowIso = new Date().toISOString();
  const upcoming = all.filter((b) => b.status !== 'cancelled' && b.status !== 'expired' && b.end >= nowIso);
  const past = all.filter((b) => b.status === 'cancelled' || b.status === 'expired' || b.end < nowIso).reverse();

  const card = (b: BookingDto, canAct: boolean) => (
    <li key={b.id} className="card">
      <h3 className="font-semibold">
        {catalog.serviceOf(b.serviceId)?.name ?? 'Programare'} · {longDay(b.start)}, {hhmm(b.start)}
      </h3>
      <p className="text-stone-700">
        {catalog.stylistName(b.stylistId)} · {STATUS_LABEL[b.status]}
        {b.refunded ? ' · avans rambursat' : ''}
      </p>
      {canAct && (
        <div className="mt-3 flex flex-wrap gap-3">
          {b.status === 'pending_payment' && (
            <Link className="btn" to={`/avans/${b.id}`}>
              Plătește avansul<span className="sr-only">: {longDay(b.start)}, {hhmm(b.start)}</span>
            </Link>
          )}
          <button type="button" className="btn-secondary" disabled={busyId === b.id} onClick={() => void cancel(b.id)}>
            Anulează<span className="sr-only"> programarea din {longDay(b.start)}, {hhmm(b.start)}</span>
          </button>
        </div>
      )}
    </li>
  );

  return (
    <div>
      <h1 className="text-3xl font-bold text-green-950">Contul meu</h1>
      {user && (
        <p className="mt-2 text-stone-700">
          {user.name} · {user.email}
        </p>
      )}
      <ErrorText>{list.error ?? error}</ErrorText>

      <section className="mt-6" aria-labelledby="viitoare">
        <h2 id="viitoare" className="text-2xl font-bold text-green-950">
          Programări viitoare
        </h2>
        {list.data && upcoming.length === 0 && (
          <p className="mt-2">
            Nu ai programări viitoare. <Link className="link" to="/programare">Programează-te</Link>.
          </p>
        )}
        <ul className="mt-3 space-y-3">{upcoming.map((b) => card(b, true))}</ul>
      </section>

      <section className="mt-8" aria-labelledby="trecute">
        <h2 id="trecute" className="text-2xl font-bold text-green-950">
          Programări trecute, anulate sau expirate
        </h2>
        {list.data && past.length === 0 && <p className="mt-2">Nimic aici încă.</p>}
        <ul className="mt-3 space-y-3">{past.map((b) => card(b, false))}</ul>
      </section>
    </div>
  );
}
