import { Link } from 'react-router-dom';
import { useTitle } from '../ui';

export function NotFound() {
  useTitle('Pagina nu există');
  return (
    <div>
      <h1 className="text-3xl font-bold text-green-950">Pagina nu a fost găsită</h1>
      <p className="mt-2">Adresa pe care ai deschis-o nu există în Bucla Verde.</p>
      <Link className="btn mt-4" to="/">
        Înapoi la prima pagină
      </Link>
    </div>
  );
}
