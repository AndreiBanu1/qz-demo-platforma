import { useBugs } from '../state';

export function BugStrip() {
  const { active, labels } = useBugs();
  if (active.length === 0) return null;
  const names = active.map((id) => labels[id] ?? id).join(' · ');
  return (
    <p role="status" className="bg-red-800 px-4 py-2 text-center text-sm font-semibold text-white">
      {`Mod cu buguri activ: ${names}`}
    </p>
  );
}
