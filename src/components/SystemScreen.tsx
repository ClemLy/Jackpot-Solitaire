// Ecrans hors partie: page introuvable (404) et plantage de l'interface.
// Ils doivent tenir debout meme si le reste du jeu est casse: aucun store,
// juste le tapis, quelques cartes et des boutons.

import {
  Component,
  useState,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { Check, Copy, Home as HomeIcon, RotateCw } from 'lucide-react';
import type { Card } from '../engine';
import { CardView } from './CardView';
import { SuitSprite } from './Suits';
import { Chip } from './ui';
import { describeError, errorReport } from '../utils/errors';

const SAVE_KEY = 'jackpot-solitaire-meta-v1';

function card(
  id: string,
  suit: Card['suit'],
  rank: Card['rank'],
  faceUp = true,
): Card {
  return { id, suit, rank, faceUp };
}

/** Fond commun: le tapis par defaut, independant des reglages du joueur. */
function SystemShell({
  label,
  art,
  children,
}: {
  label: string;
  art: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="app felt"
      data-table="felt"
      data-back="retro"
      data-face="ivory"
      data-motion="full"
    >
      <SuitSprite />
      <main className="sys" aria-labelledby="sys-title">
        <div className="sys__art" aria-hidden="true">
          {art}
        </div>
        <section className="sys__panel" aria-label={label}>
          {children}
        </section>
      </main>
    </div>
  );
}

/** 404: un 4, un jeton en guise de 0, un autre 4. */
export function NotFoundScreen({
  path,
  homeHref,
}: {
  path: string;
  homeHref: string;
}) {
  return (
    <SystemShell
      label="Page introuvable"
      art={
        <div className="sys-fan sys-fan--404">
          <span
            className="sys-fan__slot"
            style={{ '--i': -1 } as CSSProperties}
          >
            <CardView card={card('sys-4s', 'spades', 4)} />
          </span>
          <span className="sys-fan__chip">
            <Chip size="100%" tone="red" />
          </span>
          <span className="sys-fan__slot" style={{ '--i': 1 } as CSSProperties}>
            <CardView card={card('sys-4h', 'hearts', 4)} />
          </span>
        </div>
      }
    >
      <p className="sys__eyebrow">Erreur 404</p>
      <h1 className="sys__title" id="sys-title">
        Cette table n&rsquo;existe pas
      </h1>
      <p className="sys__text">
        Le croupier a cherché partout, mais aucune partie ne se joue à
        l&rsquo;adresse <code className="sys__code">{path}</code>. Le lien est
        peut-être incomplet ou a changé.
      </p>
      <div className="sys__actions">
        <a className="btn btn--gold btn--lg" href={homeHref}>
          <HomeIcon size={18} /> Retour au casino
        </a>
      </div>
    </SystemShell>
  );
}

/** Ecran affiche quand l'interface plante pendant l'affichage. */
export function CrashScreen({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const { message } = describeError(error);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(errorReport(error));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const resetSave = () => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // Stockage inaccessible: un rechargement repartira de zero de toute facon.
    }
    location.reload();
  };

  return (
    <SystemShell
      label="Erreur de l'application"
      art={
        <div className="sys-fan sys-fan--crash">
          <span
            className="sys-fan__slot"
            style={{ '--i': -1 } as CSSProperties}
          >
            <CardView card={card('sys-back-1', 'spades', 1, false)} />
          </span>
          <span className="sys-fan__slot" style={{ '--i': 0 } as CSSProperties}>
            <CardView card={card('sys-back-2', 'hearts', 1, false)} />
          </span>
          <span className="sys-fan__slot" style={{ '--i': 1 } as CSSProperties}>
            <CardView card={card('sys-back-3', 'clubs', 1, false)} />
          </span>
          <span className="stamp sys-fan__stamp">Fausse donne</span>
        </div>
      }
    >
      <p className="sys__eyebrow sys__eyebrow--red">Oups</p>
      <h1 className="sys__title" id="sys-title">
        Le croupier a renversé le paquet
      </h1>
      <p className="sys__text">
        Une erreur inattendue a interrompu l&rsquo;affichage. Ta banque, tes
        achats et tes statistiques sont en sécurité dans ce navigateur.
      </p>
      <div className="sys__actions">
        <button className="btn btn--gold btn--lg" onClick={onRetry}>
          <HomeIcon size={18} /> Revenir à l&rsquo;accueil
        </button>
        <button
          className="btn btn--ghost btn--lg"
          onClick={() => location.reload()}
        >
          <RotateCw size={18} /> Recharger la page
        </button>
      </div>

      <details className="sys__details">
        <summary>Détails techniques</summary>
        <pre className="sys__pre">{message}</pre>
        <button className="btn btn--ghost" onClick={copy}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Rapport copié' : 'Copier le rapport'}
        </button>
        <div className="sys__danger">
          <p>
            Le problème revient à chaque chargement ? En dernier recours, tu
            peux repartir d&rsquo;une sauvegarde neuve.
          </p>
          {confirmReset ? (
            <div className="sys__actions">
              <button className="btn btn--red" onClick={resetSave}>
                Tout effacer, vraiment
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => setConfirmReset(false)}
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              className="btn btn--quiet"
              onClick={() => setConfirmReset(true)}
            >
              Effacer ma sauvegarde
            </button>
          )}
        </div>
      </details>
    </SystemShell>
  );
}

interface BoundaryProps {
  children: ReactNode;
  /** Remet l'application dans un etat sain avant de reafficher. */
  onReset?: () => void;
  onError?: (error: unknown, info: ErrorInfo) => void;
}

interface BoundaryState {
  error: unknown;
  hasError: boolean;
}

/** Rattrape toute erreur d'affichage et montre l'ecran de plantage. */
export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null, hasError: false };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error, hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  private retry = () => {
    this.props.onReset?.();
    this.setState({ error: null, hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return <CrashScreen error={this.state.error} onRetry={this.retry} />;
    }
    return this.props.children;
  }
}
