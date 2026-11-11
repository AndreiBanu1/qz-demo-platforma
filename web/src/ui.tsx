import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { messageOf } from './api';

export function useTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · Bucla Verde`;
  }, [title]);
}

/** Runs a loader on mount (and when `key` changes) and tracks loading and error state. */
export function useLoad<T>(load: () => Promise<T>, key: string): { data: T | null; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(null);
    load().then(
      (d) => alive && setData(d),
      (e) => alive && setError(messageOf(e)),
    );
    return () => {
      alive = false;
    };
  }, [key, n]);
  return { data, error, reload: () => setN((x) => x + 1) };
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-900">
      {children}
    </p>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; id: string };

/** A labelled input. The hint is tied to the input with aria-describedby. */
export function Field({ label, hint, id, ...rest }: FieldProps) {
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-stone-700">
          {hint}
        </p>
      )}
      <input id={id} aria-describedby={hint ? `${id}-hint` : undefined} className="input" {...rest} />
    </div>
  );
}
