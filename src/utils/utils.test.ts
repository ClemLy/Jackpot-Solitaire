import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEED_MAX_LENGTH, readSeedFromUrl, sanitizeSeed } from './seed';
import { isAppPath } from './routes';
import {
  createErrorReporter,
  describeError,
  errorReport,
  installGlobalErrorHandlers,
} from './errors';

describe('graines', () => {
  afterEach(() => window.history.replaceState({}, '', '/'));

  it('garde une graine normale telle quelle', () => {
    expect(sanitizeSeed('482913')).toBe('482913');
    expect(sanitizeSeed('défi-2026-10-08')).toBe('défi-2026-10-08');
  });

  it('refuse le vide et les types inattendus', () => {
    expect(sanitizeSeed('')).toBeNull();
    expect(sanitizeSeed('   \n\t ')).toBeNull();
    expect(sanitizeSeed(null)).toBeNull();
    expect(sanitizeSeed(42)).toBeNull();
    expect(sanitizeSeed({ toString: () => 'x' })).toBeNull();
  });

  it('retire les caracteres de controle et resserre les espaces', () => {
    expect(sanitizeSeed('ab\u0000c\u001b[31m')).toBe('abc[31m');
    expect(sanitizeSeed('  une   graine\n\tici ')).toBe('une graine ici');
    expect(sanitizeSeed('a\u0085b')).toBe('ab');
  });

  it('borne la longueur, emojis compris', () => {
    expect(sanitizeSeed('x'.repeat(10_000))).toHaveLength(SEED_MAX_LENGTH);
    const emojis = sanitizeSeed('🂡'.repeat(100))!;
    expect(Array.from(emojis)).toHaveLength(SEED_MAX_LENGTH);
  });

  it('lit et nettoie la graine de l URL', () => {
    window.history.replaceState({}, '', '/?seed=%20abc%00def%20');
    expect(readSeedFromUrl()).toBe('abcdef');
    window.history.replaceState({}, '', '/?seed=');
    expect(readSeedFromUrl()).toBeNull();
    window.history.replaceState({}, '', `/?seed=${'9'.repeat(500)}`);
    expect(readSeedFromUrl()).toHaveLength(SEED_MAX_LENGTH);
  });

  it('ne laisse jamais passer de balisage interprete', () => {
    // React echappe le texte affiche; on verifie juste que la graine reste
    // une chaine opaque, sans transformation dangereuse.
    expect(sanitizeSeed('<img src=x onerror=alert(1)>')).toBe(
      '<img src=x onerror=alert(1)>',
    );
  });
});

describe('adresses du jeu', () => {
  it('reconnait la page du jeu a la racine', () => {
    expect(isAppPath('/', '/')).toBe(true);
    expect(isAppPath('/index.html', '/')).toBe(true);
    expect(isAppPath('/tables', '/')).toBe(false);
    expect(isAppPath('/index.htm', '/')).toBe(false);
  });

  it('reconnait la page du jeu sous un sous-chemin GitHub Pages', () => {
    const base = '/Jackpot-Solitaire/';
    expect(isAppPath('/Jackpot-Solitaire/', base)).toBe(true);
    expect(isAppPath('/Jackpot-Solitaire', base)).toBe(true);
    expect(isAppPath('/Jackpot-Solitaire/index.html', base)).toBe(true);
    expect(isAppPath('/Jackpot-Solitaire/boutique', base)).toBe(false);
    expect(isAppPath('/', base)).toBe(false);
    expect(isAppPath('/autre-depot/', base)).toBe(false);
  });

  it('tolere une base sans barre finale', () => {
    expect(isAppPath('/jeu/', '/jeu')).toBe(true);
    expect(isAppPath('/jeu/x', '/jeu')).toBe(false);
  });
});

describe('erreurs', () => {
  it('decrit toute valeur levee', () => {
    expect(describeError(new Error('boum')).message).toBe('boum');
    expect(describeError('texte').message).toBe('texte');
    expect(describeError({ code: 42 }).message).toBe('{"code":42}');
    expect(describeError(undefined).message).toBe('Erreur inconnue');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(describeError(circular).message).toBe('Erreur inconnue');
  });

  it('produit un rapport complet a copier', () => {
    const report = errorReport(new Error('boum'));
    expect(report).toContain('Jackpot Solitaire');
    expect(report).toContain('Erreur: boum');
    expect(report).toContain('Navigateur:');
  });

  it('previent le joueur sans l inonder', () => {
    const notify = vi.fn();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const report = createErrorReporter(notify);
    report(new Error('a'));
    report(new Error('a'));
    expect(notify).toHaveBeenCalledTimes(1);
    report(new Error('b'));
    report(new Error('c'));
    report(new Error('d'));
    expect(notify).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenCalledTimes(5);
    spy.mockRestore();
  });

  it('capte les erreurs et promesses rejetees globales', () => {
    const report = vi.fn();
    const uninstall = installGlobalErrorHandlers(report);
    window.dispatchEvent(
      new ErrorEvent('error', { error: new Error('x'), message: 'x' }),
    );
    const rejection = new Event('unhandledrejection') as Event & {
      reason: unknown;
    };
    rejection.reason = 'rejet';
    window.dispatchEvent(rejection);
    // Erreur de chargement de ressource: ni objet ni message, ignoree.
    window.dispatchEvent(new ErrorEvent('error'));
    expect(report).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenLastCalledWith('rejet');
    uninstall();
    window.dispatchEvent(new ErrorEvent('error', { message: 'apres' }));
    expect(report).toHaveBeenCalledTimes(2);
  });
});
