import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ERROR_COPY } from '../../../server/errors';
import type { BookingDto } from '../../../shared/schemas';
import { get, messageOf, post } from '../api';
import { BookingFacts, useCatalog } from '../booking';
import { hhmm, lei } from '../format';
import { ErrorText, Field, useLoad, useTitle } from '../ui';

export function Deposit() {
  useTitle('Avans');
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const booking = useLoad(() => get<BookingDto>(`/api/bookings/${encodeURIComponent(id)}`), id);
  const config = useLoad(() => get<{ stripeEnabled: boolean }>('/api/config'), 'config');
  const catalog = useCatalog();
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const b = booking.data;

  const pay = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post(`/api/payments/${encodeURIComponent(id)}/simulated`, { cardNumber, expiry, cvc });
      navigate(`/confirmare/${id}`);
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };

  const stripe = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ url?: string; status?: string }>(`/api/payments/${encodeURIComponent(id)}/stripe`);
      if (r.url) window.location.assign(r.url);
      else navigate(`/confirmare/${id}`);
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-bold text-green-950">Plătește avansul</h1>
      <ErrorText>{booking.error}</ErrorText>
      {b?.status === 'expired' && (
        <p className="mt-4">
          {ERROR_COPY.HOLD_EXPIRED} <Link className="link" to="/programare">Alege din nou o oră</Link>.
        </p>
      )}
      {b && b.status !== 'pending_payment' && b.status !== 'expired' && (
        <p className="mt-4">
          Această programare nu mai așteaptă avansul. <Link className="link" to={`/confirmare/${b.id}`}>Vezi programarea</Link>.
        </p>
      )}
      {b && (
        <>
          <BookingFacts booking={b} serviceName={catalog.serviceOf(b.serviceId)?.name ?? ''} stylistName={catalog.stylistName(b.stylistId)} />
          {b.status === 'pending_payment' && b.holdUntil && (
            <p className="mt-3 text-stone-700">Ora este ținută pentru tine până la {hhmm(b.holdUntil)} (ora României). După aceea trebuie să alegi din nou.</p>
          )}
        </>
      )}

      {b?.status === 'pending_payment' && (
        <>
          <section className="card mt-6" aria-labelledby="plata">
            <h2 id="plata" className="text-xl font-bold text-green-950">
              Plată de test
            </h2>
            <p className="mt-1 text-sm text-stone-700">
              Nu introduce un card real. Folosește 4242 4242 4242 4242 pentru o plată reușită sau 4000 0000 0000 0002 pentru un card refuzat. Data de expirare să fie în viitor, iar CVC are 3 cifre.
            </p>
            <form onSubmit={(e) => void pay(e)}>
              <Field id="card" label="Număr card de test" inputMode="numeric" autoComplete="off" required value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <Field id="expira" label="Expiră (LL/AA)" placeholder="12/30" autoComplete="off" required value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                <Field id="cvc" label="CVC" inputMode="numeric" autoComplete="off" required value={cvc} onChange={(e) => setCvc(e.target.value)} />
              </div>
              <ErrorText>{error}</ErrorText>
              <button type="submit" className="btn mt-6" disabled={busy}>
                Plătește avansul de {lei(b.depositLei)}
              </button>
            </form>
          </section>

          {config.data?.stripeEnabled && (
            <section className="mt-6" aria-labelledby="stripe">
              <h2 id="stripe" className="text-xl font-bold text-green-950">
                Sau cu Stripe
              </h2>
              <p className="mt-1 text-sm text-stone-700">Te trimitem la pagina Stripe în mod test. Folosește tot un card de test.</p>
              <button type="button" className="btn-secondary mt-3" disabled={busy} onClick={() => void stripe()}>
                Plătește cu Stripe (mod test)
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
