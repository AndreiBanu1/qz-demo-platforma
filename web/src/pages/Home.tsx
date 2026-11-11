import { Link } from 'react-router-dom';
import type { ServiceDto, StylistDto } from '../../../shared/schemas';
import { get } from '../api';
import { lei } from '../format';
import { ErrorText, useLoad, useTitle } from '../ui';

export function Home() {
  useTitle('Acasă');
  const services = useLoad(() => get<{ services: ServiceDto[] }>('/api/services'), 'services');
  const stylists = useLoad(() => get<{ stylists: StylistDto[] }>('/api/stylists'), 'stylists');

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold text-green-950">Bucla Verde</h1>
        <p className="mt-2 max-w-prose text-lg">Coafură, vopsit și manichiură. Alege serviciul, alege ora și plătește un avans mic. Salonul este fictiv, iar plata se face doar cu carduri de test.</p>
        <Link to="/programare" className="btn mt-4">
          Programează-te
        </Link>
      </section>

      <section aria-labelledby="servicii">
        <h2 id="servicii" className="text-2xl font-bold text-green-950">
          Servicii
        </h2>
        <ErrorText>{services.error}</ErrorText>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {services.data?.services.map((s) => (
            <li key={s.id} className="card flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{s.name}</p>
                <p className="text-sm text-stone-700">{s.durationMin} min</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-semibold">{lei(s.priceLei)}</p>
                <Link to={`/programare?s=${s.id}`} className="btn-secondary">
                  Alege<span className="sr-only">: {s.name}</span>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="echipa">
        <h2 id="echipa" className="text-2xl font-bold text-green-950">
          Echipa
        </h2>
        <ErrorText>{stylists.error}</ErrorText>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {stylists.data?.stylists.map((s) => (
            <li key={s.id} className="card flex flex-col items-center text-center">
              <img src={s.avatar} alt="" width={96} height={96} className="h-24 w-24 rounded-full" />
              <p className="mt-2 font-semibold">{s.name}</p>
              <p className="text-sm text-stone-700">Stilist</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="program">
        <h2 id="program" className="text-2xl font-bold text-green-950">
          Program
        </h2>
        <p className="mt-2">Luni–sâmbătă, 09:00–19:00. Duminica este închis.</p>
        <p className="mt-2 text-stone-700">Salonul este inventat pentru acest site demonstrativ: nu există o locație reală și nu se poate face nicio programare reală.</p>
      </section>
    </div>
  );
}
