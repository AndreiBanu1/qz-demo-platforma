import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { CreateBookingResponse, ServiceDto, SlotDto, SlotsResponse, StylistDto } from '../../../shared/schemas';
import { get, messageOf, post } from '../api';
import { hhmm, lei, longDay } from '../format';
import { useAuth, useBugs } from '../state';
import { ErrorText, useLoad, useTitle } from '../ui';

const ANY = 'any';

/** A radio with its label. With the a11y-gap bug on, it drops the label and leaves bare text next to the input. */
function Choice({ name, value, checked, onChange, broken, children }: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  broken: boolean;
  children: ReactNode;
}) {
  const input = <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="h-5 w-5 accent-green-800" />;
  if (broken) {
    return (
      <div className="flex items-center gap-3 py-2">
        {/* BUG:a11y-gap */}
        {input}
        <span>{children}</span>
      </div>
    );
  }
  return (
    <label className="flex min-h-[44px] items-center gap-3 py-1">
      {input}
      <span>{children}</span>
    </label>
  );
}

export function Booking() {
  useTitle('Programare');
  const { user } = useAuth();
  const broken = useBugs().has('a11y-gap');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const serviceId = params.get('s') ?? '';
  const stylistChoice = params.get('st') ?? '';
  const date = params.get('d') ?? '';
  const start = params.get('t') ?? '';

  const services = useLoad(() => get<{ services: ServiceDto[] }>('/api/services'), 'services');
  const stylists = useLoad(() => get<{ stylists: StylistDto[] }>('/api/stylists'), 'stylists');
  const [slots, setSlots] = useState<SlotDto[] | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const ready = !!serviceId && !!stylistChoice && /^\d{4}-\d{2}-\d{2}$/.test(date);
  useEffect(() => {
    if (!ready) {
      setSlots(null);
      return;
    }
    let alive = true;
    setSlots(null);
    setSlotError(null);
    const q = new URLSearchParams({ serviceId, date });
    if (stylistChoice !== ANY) q.set('stylistId', stylistChoice);
    get<SlotsResponse>(`/api/slots?${q}`).then(
      (r) => alive && setSlots(r.slots),
      (e) => {
        if (alive) {
          setSlots(null);
          setSlotError(messageOf(e));
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [ready, serviceId, stylistChoice, date]);

  // "Oricine" merges the stylists' slots: one entry per start time, booked with the first stylist free then.
  const times = useMemo(() => {
    const byStart = new Map<string, SlotDto>();
    for (const s of slots ?? []) if (!byStart.has(s.start)) byStart.set(s.start, s);
    return [...byStart.values()];
  }, [slots]);
  const chosen = times.find((s) => s.start === start) ?? null;

  const service = services.data?.services.find((s) => s.id === serviceId);
  const stylistName = (id: string) => stylists.data?.stylists.find((s) => s.id === id)?.name ?? '';

  const confirm = async () => {
    if (!chosen) return;
    if (!user) {
      navigate('/autentificare', { state: { from: `/programare?${params}` } });
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      const r = await post<CreateBookingResponse>('/api/bookings', { serviceId, stylistId: chosen.stylistId, start: chosen.start });
      navigate(`/avans/${r.id}`);
    } catch (e) {
      setSubmitError(messageOf(e));
      setBusy(false);
    }
  };

  return (
    <div className={broken ? 'focus-off' : undefined}>
      {/* The focus-off class removes every focus outline inside the booking page. */}
      {/* BUG:a11y-gap */}
      <h1 className="text-3xl font-bold text-green-950">Programare</h1>
      <ErrorText>{services.error ?? stylists.error}</ErrorText>

      <fieldset className="mt-6">
        <legend className="text-xl font-bold text-green-950">1. Serviciul</legend>
        {services.data?.services.map((s) => (
          <Choice key={s.id} name="service" value={s.id} broken={broken} checked={serviceId === s.id} onChange={() => update({ s: s.id, t: null })}>
            {s.name} · {s.durationMin} min · {lei(s.priceLei)}
          </Choice>
        ))}
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-xl font-bold text-green-950">2. Stilistul</legend>
        {stylists.data?.stylists.map((s) => (
          <Choice key={s.id} name="stylist" value={s.id} broken={broken} checked={stylistChoice === s.id} onChange={() => update({ st: s.id, t: null })}>
            {s.name}
          </Choice>
        ))}
        {stylists.data && (
          <Choice name="stylist" value={ANY} broken={broken} checked={stylistChoice === ANY} onChange={() => update({ st: ANY, t: null })}>
            Oricine
          </Choice>
        )}
      </fieldset>

      <section className="mt-6" aria-labelledby="ziua">
        <h2 id="ziua" className="text-xl font-bold text-green-950">
          3. Ziua
        </h2>
        {broken ? (
          <>
            {/* BUG:a11y-gap */}
            <input type="date" value={date} onChange={(e) => update({ d: e.target.value, t: null })} className="input max-w-xs" />
          </>
        ) : (
          <label className="block max-w-xs">
            <span className="block font-medium">Data programării</span>
            <input type="date" value={date} onChange={(e) => update({ d: e.target.value, t: null })} className="input" />
          </label>
        )}
        <p className="mt-1 text-sm text-stone-700">Luni–sâmbătă, 09:00–19:00. Orele sunt în ora României.</p>
      </section>

      <section className="mt-6" aria-labelledby="ora">
        <h2 id="ora" className="text-xl font-bold text-green-950">
          4. Ora
        </h2>
        {!ready && <p className="text-stone-700">Alege serviciul, stilistul și ziua ca să vezi orele libere.</p>}
        <ErrorText>{slotError}</ErrorText>
        {ready && slots && times.length === 0 && <p>Nu mai sunt ore libere în această zi. Alege altă zi.</p>}
        {times.length > 0 && (
          <div role="group" aria-label="Ore libere" className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {times.map((s) =>
              broken ? (
                <div
                  key={s.start}
                  onClick={() => update({ t: s.start })}
                  className={`cursor-pointer rounded-md border-2 border-green-800 px-3 py-2 text-center font-semibold ${start === s.start ? 'bg-green-800 text-white' : 'bg-white text-green-900'}`}
                >
                  {/* A clickable div with no role, no tabIndex, no keyboard support. */}
                  {/* BUG:a11y-gap */}
                  {hhmm(s.start)}
                </div>
              ) : (
                <button
                  key={s.start}
                  type="button"
                  aria-pressed={start === s.start}
                  onClick={() => update({ t: s.start })}
                  className={`min-h-[44px] rounded-md border-2 border-green-800 px-3 py-2 font-semibold ${start === s.start ? 'bg-green-800 text-white' : 'bg-white text-green-900 hover:bg-green-100'}`}
                >
                  {hhmm(s.start)}
                </button>
              ),
            )}
          </div>
        )}
      </section>

      {chosen && service && (
        <section className="card mt-8" aria-labelledby="rezumat">
          <h2 id="rezumat" className="text-xl font-bold text-green-950">
            Rezumat
          </h2>
          <p className="mt-2">
            {service.name} cu {stylistName(chosen.stylistId)}, {longDay(chosen.start)}, la {hhmm(chosen.start)} ({service.durationMin} min, {lei(service.priceLei)}).
          </p>
          {!user && (
            <p className="mt-2 text-stone-700">
              Ca să confirmi trebuie să ai cont. <Link className="link" to="/autentificare" state={{ from: `/programare?${params}` }}>Intră în cont</Link> sau{' '}
              <Link className="link" to="/cont-nou" state={{ from: `/programare?${params}` }}>creează un cont nou</Link>.
            </p>
          )}
          <ErrorText>{submitError}</ErrorText>
          <button type="button" className="btn mt-4" disabled={busy} onClick={() => void confirm()}>
            Confirmă și treci la avans
          </button>
        </section>
      )}
    </div>
  );
}
