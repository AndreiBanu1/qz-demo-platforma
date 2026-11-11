import type { BookingDto, ServiceDto, StylistDto } from '../../shared/schemas';
import { get } from './api';
import { hhmm, lei, longDay } from './format';
import { useLoad } from './ui';

export const STATUS_LABEL: Record<BookingDto['status'], string> = {
  pending_payment: 'Avans neplătit',
  confirmed: 'Confirmată',
  cancelled: 'Anulată',
};

/** Services and stylists, for turning ids into names. */
export function useCatalog() {
  const services = useLoad(() => get<{ services: ServiceDto[] }>('/api/services'), 'services');
  const stylists = useLoad(() => get<{ stylists: StylistDto[] }>('/api/stylists'), 'stylists');
  return {
    serviceOf: (id: string) => services.data?.services.find((s) => s.id === id),
    stylistName: (id: string) => stylists.data?.stylists.find((s) => s.id === id)?.name ?? '',
    error: services.error ?? stylists.error,
  };
}

export function BookingFacts({ booking, serviceName, stylistName, price }: { booking: BookingDto; serviceName: string; stylistName: string; price?: number }) {
  const rows: [string, string][] = [
    ['Serviciu', serviceName],
    ['Stilist', stylistName],
    ['Data', longDay(booking.start)],
    ['Ora', `${hhmm(booking.start)}–${hhmm(booking.end)}`],
    ...(price === undefined ? [] : ([['Preț', lei(price)]] as [string, string][])),
    ['Avans', lei(booking.depositLei)],
    ['Stare', STATUS_LABEL[booking.status]],
  ];
  return (
    <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-medium text-stone-700">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
