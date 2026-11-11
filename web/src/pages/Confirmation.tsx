import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { BookingDto, CancelBookingResponse } from '../../../shared/schemas';
import { get, messageOf, post } from '../api';
import { BookingFacts, useCatalog } from '../booking';
import { ErrorText, useLoad, useTitle } from '../ui';

export function Confirmation() {
  useTitle('Confirmare');
  const { id = '' } = useParams();
  const booking = useLoad(() => get<BookingDto>(`/api/bookings/${encodeURIComponent(id)}`), id);
  const catalog = useCatalog();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const b = booking.data;

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await post<CancelBookingResponse>(`/api/bookings/${encodeURIComponent(id)}/cancel`);
      booking.reload();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const heading = !b
    ? 'Programarea ta'
    : b.status === 'confirmed'
      ? 'Programarea ta este confirmată'
      : b.status === 'cancelled'
        ? 'Programarea a fost anulată'
        : b.status === 'expired'
          ? 'Rezervare expirată'
          : 'Programarea așteaptă avansul';

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-bold text-green-950">{heading}</h1>
      <ErrorText>{booking.error}</ErrorText>
      {b && (
        <>
          <BookingFacts
            booking={b}
            serviceName={catalog.serviceOf(b.serviceId)?.name ?? ''}
            stylistName={catalog.stylistName(b.stylistId)}
            price={catalog.serviceOf(b.serviceId)?.priceLei}
          />
          {b.status === 'cancelled' && b.refunded && <p className="mt-4">Avansul a fost rambursat (mod test).</p>}
          {b.status === 'pending_payment' && (
            <p className="mt-4">
              Plata încă nu a ajuns la noi.{' '}
              <Link className="link" to={`/avans/${b.id}`}>
                Plătește avansul
              </Link>{' '}
              sau{' '}
              <button type="button" className="link" onClick={booking.reload}>
                verifică din nou starea
              </button>
              .
            </p>
          )}
          {b.status === 'expired' && (
            <p className="mt-4">
              Ora nu a mai fost ținută pentru tine.{' '}
              <Link className="link" to="/programare">
                Alege din nou o oră
              </Link>
              .
            </p>
          )}
          <ErrorText>{error}</ErrorText>
          <div className="mt-6 flex flex-wrap gap-3">
            {b.status !== 'cancelled' && b.status !== 'expired' && (
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => void cancel()}>
                Anulează programarea
              </button>
            )}
            <Link className="btn" to="/contul-meu">
              Contul meu
            </Link>
          </div>
          <p className="mt-4 text-sm text-stone-700">Anularea este posibilă cu cel puțin 24 de ore înainte de ora programării.</p>
        </>
      )}
    </div>
  );
}
