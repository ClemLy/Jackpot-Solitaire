import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Contenu place a droite du titre (solde, filtres...). */
  aside?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  aside,
  size = 'md',
}: ModalProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Le focus entre dans la fenetre a l'ouverture et revient ensuite a
  // l'element qui l'a ouverte (navigation clavier et lecteurs d'ecran).
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, []);

  return (
    <div
      className="modal"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sheet"
        data-size={size}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={sheetRef}
      >
        <div className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          {aside && <div className="sheet__aside">{aside}</div>}
          <button className="closebtn" onClick={onClose} aria-label="Fermer">
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>
        <div className="sheet__body scroll">{children}</div>
        {footer && <div className="sheet__foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Panneau de fin de manche (victoire, coffre, defaite), sans fermeture libre. */
export function Stage({
  tone = 'gold',
  children,
  label,
  onPointerDown,
  onEscape,
}: {
  tone?: 'gold' | 'red';
  children: ReactNode;
  label: string;
  onPointerDown?: () => void;
  /** Action declenchee par la touche Echap, si la fenetre en accepte une. */
  onEscape?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!onEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEscape]);
  return (
    <div className="modal modal--stage">
      <div
        className="stage"
        data-tone={tone}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        ref={ref}
        onPointerDown={onPointerDown}
      >
        {children}
      </div>
    </div>
  );
}
