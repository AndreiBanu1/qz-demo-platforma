import { useState, type FormEvent } from 'react';
import type { AdminBookingDto, CalendarResponse } from '../../../shared/schemas';
import { fromLocal, localParts } from '../../../server/domain/time';
import { CLOSE_MIN, OPEN_MIN, STEP_MIN } from '../../../server/domain/slots';
import { api, get, messageOf, post } from '../api';
import { STATUS_LABEL, useCatalog } from '../booking';
import { hhmm, minutesLabel, todayLocal } from '../format';
import { ErrorText, useLoad, useTitle } from '../ui';

const TIMES: number[] = [];
for (let m = OPEN_MIN; m <= CLOSE_MIN; m += STEP_MIN) TIMES.push(m);
const range = (a: string, b: string) => `${hhmm(a)}–${hhmm(b)}`;

export function Admin() {
  useTitle('Admin');
  const [date, setDate] = useState(todayLocal);
  const calendar = useLoad(() => get<CalendarResponse>(`/api/admin/calendar?date=${encodeURIComponent(date)}`), date);
  const all = useLoad(() => get<{ bookings: AdminBookingDto[] }>('/api/admin/bookings'), 'all');
  const catalog = useCatalog();
  const [stylistId, setStylistId] = useState('');
  const [from, setFrom] = useState(String(OPEN_MIN));
  const [to, setTo] = useState(String(OPEN_MIN + 60));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const cal = calendar.data;
  const chosenStylist = stylistId || cal?.stylists[0]?.id || '';

  const refresh = () => {
    calendar.reload();
    all.reload();
  };

  const block = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(null);
    try {
      await post('/api/admin/blocks', {
        stylistId: chosenStylist,
        start: fromLocal(date, Number(from)).toISOString(),
        end: fromLocal(date, Number(to)).toISOString(),
      });
      setDone(`Interval blocat: ${minutesLabel(Number(from))}–${minutesLabel(Number(to))}.`);
      refresh();
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const unblock = async (id: string) => {
    setError(null);
    setDone(null);
    try {
      await api('DELETE', `/api/admin/blocks/${encodeURIComponent(id)}`);
      setDone('Intervalul a fost deblocat.');
      refresh();
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const dayLabel = date && localParts(fromLocal(date, 0)).date === date ? date : '';

  return (
    <div>
      <h1 className="text-3xl font-bold text-green-950">Administrare</h1>
      <ErrorText>{calendar.error ?? all.error ?? error}</ErrorText>
      {done && (
        <p role="status" className="mt-3 rounded-md border border-green-300 bg-green-100 px-3 py-2 text-green-950">
          {done}
        </p>
      )}

      <section className="mt-6" aria-labelledby="calendar">
        <h2 id="calendar" className="text-2xl font-bold text-green-950">
          Calendar salon
        </h2>
        <label className="mt-2 block max-w-xs">
          <span className="block font-medium">Ziua</span>
          <input type="date" className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {cal?.stylists.map((s) => (
            <section key={s.id} className="card" aria-labelledby={`cal-${s.id}`}>
              <h3 id={`cal-${s.id}`} className="font-semibold">
                {s.name}
              </h3>
              <ul className="mt-2 space-y-2">
                {cal.bookings
                  .filter((b) => b.stylistId === s.id)
                  .map((b) => (
                    <li key={b.id}>
                      <span className="font-medium">{range(b.start, b.end)}</span> · {catalog.serviceOf(b.serviceId)?.name ?? ''}
                      <br />
                      <span className="text-sm text-stone-700">
                        {b.client.name} · {STATUS_LABEL[b.status]}
                      </span>
                    </li>
                  ))}
                {cal.blocks
                  .filter((b) => b.stylistId === s.id)
                  .map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-2 rounded bg-stone-100 px-2 py-1">
                      <span>
                        <span className="font-medium">{range(b.start, b.end)}</span> · blocat
                      </span>
                      <button type="button" className="btn-secondary !min-h-[36px] !px-2 !py-1 text-sm" onClick={() => void unblock(b.id)}>
                        Deblochează<span className="sr-only"> {s.name}, {range(b.start, b.end)}</span>
                      </button>
                    </li>
                  ))}
                {cal.bookings.every((b) => b.stylistId !== s.id) && cal.blocks.every((b) => b.stylistId !== s.id) && <li className="text-stone-700">Nimic în această zi.</li>}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <section className="card mt-8" aria-labelledby="bloc">
        <h2 id="bloc" className="text-2xl font-bold text-green-950">
          Blochează un interval
        </h2>
        <p className="text-sm text-stone-700">Pentru ziua {dayLabel || 'aleasă mai sus'}, ora României. Un interval blocat nu mai poate fi rezervat.</p>
        <form onSubmit={(e) => void block(e)} className="mt-2 grid gap-4 sm:grid-cols-3">
          <label>
            <span className="block font-medium">Stilist</span>
            <select className="input" value={chosenStylist} onChange={(e) => setStylistId(e.target.value)}>
              {cal?.stylists.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="block font-medium">De la</span>
            <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
              {TIMES.slice(0, -1).map((m) => (
                <option key={m} value={m}>
                  {minutesLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="block font-medium">Până la</span>
            <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
              {TIMES.slice(1).map((m) => (
                <option key={m} value={m}>
                  {minutesLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-3">
            <button type="submit" className="btn">
              Blochează intervalul
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8" aria-labelledby="toate">
        <h2 id="toate" className="text-2xl font-bold text-green-950">
          Toate programările
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <caption className="sr-only">Toate programările salonului</caption>
            <thead>
              <tr className="border-b border-stone-400">
                <th scope="col" className="py-2 pr-3">Data</th>
                <th scope="col" className="py-2 pr-3">Ora</th>
                <th scope="col" className="py-2 pr-3">Serviciu</th>
                <th scope="col" className="py-2 pr-3">Stilist</th>
                <th scope="col" className="py-2 pr-3">Client</th>
                <th scope="col" className="py-2">Stare</th>
              </tr>
            </thead>
            <tbody>
              {all.data?.bookings.map((b) => (
                <tr key={b.id} className="border-b border-stone-200">
                  <td className="py-2 pr-3">{localParts(new Date(b.start)).date}</td>
                  <td className="py-2 pr-3">{range(b.start, b.end)}</td>
                  <td className="py-2 pr-3">{catalog.serviceOf(b.serviceId)?.name ?? ''}</td>
                  <td className="py-2 pr-3">{catalog.stylistName(b.stylistId)}</td>
                  <td className="py-2 pr-3">{b.client.name}</td>
                  <td className="py-2">{STATUS_LABEL[b.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
