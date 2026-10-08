// Remontee des erreurs inattendues vers le joueur.
//
// Une erreur pendant l'affichage est rattrapee par ErrorBoundary (ecran
// "Fausse donne"). Les autres (dans un minuteur, une promesse, un gestionnaire
// d'evenement) n'interrompent pas le jeu: on les signale par une notification
// discrete, sans inonder l'ecran si la meme erreur se repete.

import { BUILD_TAG } from './build';

export interface ErrorDetails {
  message: string;
  stack?: string;
}

/** Transforme n'importe quelle valeur levee en message lisible. */
export function describeError(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    return {
      message: error.message || error.name || 'Erreur inconnue',
      stack: error.stack,
    };
  }
  if (typeof error === 'string' && error.trim()) return { message: error };
  try {
    const json = JSON.stringify(error);
    if (json && json !== '{}') return { message: json.slice(0, 300) };
  } catch {
    // Valeur non serialisable: on tombe sur le message generique.
  }
  return { message: 'Erreur inconnue' };
}

/** Rapport texte a copier pour signaler un bug. */
export function errorReport(error: unknown, extra?: string): string {
  const { message, stack } = describeError(error);
  const lines = [
    `Jackpot Solitaire, ${BUILD_TAG}`,
    `Date: ${new Date().toISOString()}`,
  ];
  if (typeof navigator !== 'undefined')
    lines.push(`Navigateur: ${navigator.userAgent}`);
  if (typeof location !== 'undefined')
    lines.push(`Adresse: ${location.pathname}`);
  lines.push('', `Erreur: ${message}`);
  if (extra) lines.push(extra);
  if (stack) lines.push('', stack);
  return lines.join('\n');
}

type Notifier = (title: string, text: string) => void;

/** Nombre maximal de notifications d'erreur par session. */
const MAX_NOTICES = 3;

/**
 * Cree un rapporteur qui previent le joueur au plus MAX_NOTICES fois par
 * session, et jamais deux fois pour le meme message.
 */
export function createErrorReporter(notify: Notifier) {
  const seen = new Set<string>();
  return (error: unknown): void => {
    const { message } = describeError(error);
    console.error('[Jackpot Solitaire]', error);
    if (seen.has(message) || seen.size >= MAX_NOTICES) return;
    seen.add(message);
    notify(
      'Un petit accroc',
      'Quelque chose s’est mal passé en coulisses, mais la partie continue. Si ça se répète, recharge la page.',
    );
  };
}

/**
 * Branche le rapporteur sur les erreurs globales du navigateur. Renvoie de
 * quoi se debrancher (utile aux tests).
 */
export function installGlobalErrorHandlers(
  report: (error: unknown) => void,
  target: Window = window,
): () => void {
  const onError = (event: ErrorEvent) => {
    // Les erreurs de chargement de ressources (image, police) n'ont pas
    // d'objet error et ne cassent rien: on les ignore.
    if (!event.error && !event.message) return;
    report(event.error ?? event.message);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    report(event.reason);
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
