import { BUGS_DOC_URL } from '../config';
import { useBugs } from '../state';

export function BugStrip() {
  const { active, labels } = useBugs();
  if (active.length === 0) return null;
  const names = active.map((id) => labels[id] ?? id).join(' · ');
  return (
    <div role="status" className="bg-red-800 px-4 py-2 text-center text-sm font-semibold text-white">
      <p>{`Mod cu buguri activ: ${names}`}</p>
      <a href={BUGS_DOC_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-red-100 focus-visible:outline-white">
        Vezi lista bugurilor<span className="sr-only"> (se deschide într-o filă nouă)</span>
      </a>
    </div>
  );
}
