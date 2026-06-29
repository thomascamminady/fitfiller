import { useEffect, useRef } from 'react';

/**
 * Wires up modal dismissal: closes on Escape and moves focus into the dialog so
 * keyboard users land in the right place. Returns a ref to put on the dialog.
 */
export function useDismissable<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return ref;
}
