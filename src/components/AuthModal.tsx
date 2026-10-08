import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, Check, Eye, EyeOff, Lock, User, X } from 'lucide-react';
import {
  AccountError,
  PASSWORD_MIN,
  passwordProblem,
  passwordStrength,
  pseudoProblem,
  signIn,
  signUp,
} from '../state/account';
import { useMetaStore, pickPlayer } from '../state/meta';
import { publicCard } from '../core';
import { formatNumber } from '../utils/format';
import { playSound } from '../audio/sfx';
import { ProfileCard } from './ProfileCard';
import { Chip } from './ui';

type Tab = 'login' | 'signup';

const STRENGTH = ['Trop court', 'Faible', 'Correct', 'Solide', 'Excellent'];

/**
 * Entree au salon: connexion ou creation de compte, avec juste un pseudo et
 * un mot de passe. La vitrine de gauche montre ce que le compte apporte.
 */
export function AuthModal({
  onClose,
  initialTab = 'login',
}: {
  onClose: () => void;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const ids = useId();

  // Le store entier garde la meme reference tant que rien ne change: on en
  // extrait l'etat du joueur sans provoquer de rendus en boucle.
  const store = useMetaStore();
  const player = pickPlayer(store);
  const notify = store.notify;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [tab]);

  const signup = tab === 'signup';
  const strength = passwordStrength(password);
  const pseudoError = touched ? pseudoProblem(pseudo) : null;
  const passwordError = touched && signup ? passwordProblem(password) : null;
  const confirmError =
    touched && signup && confirm !== password
      ? 'Les deux mots de passe diffèrent.'
      : null;
  const progress =
    player.wallet.lifetimeEarned > 0 || player.stats.gamesPlayed > 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (pseudoProblem(pseudo)) return;
    if (signup && (passwordProblem(password) || confirm !== password)) return;
    if (!signup && password.length === 0) return;
    setBusy(true);
    try {
      if (signup) await signUp(pseudo, password);
      else await signIn(pseudo, password);
      playSound('purchase');
      notify({
        kind: 'reward',
        title: signup
          ? `Bienvenue, ${pseudo.trim()} !`
          : `Bon retour, ${pseudo.trim()} !`,
        text: signup
          ? 'Ton compte est prêt: ta progression te suit partout.'
          : 'Ta progression est chargée depuis le serveur.',
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof AccountError
          ? err.message
          : 'La connexion a échoué. Réessaie dans un instant.',
      );
      playSound('invalid');
    } finally {
      setBusy(false);
    }
  };

  const preview = publicCard(pseudo.trim() || 'Toi', player, null);

  return (
    <div
      className="modal auth"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="auth__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        ref={panelRef}
      >
        <aside className="auth__art" aria-hidden="true">
          <div className="auth__glow" />
          <ProfileCard card={preview} className="auth__card" />
          <ul className="auth__perks">
            <li>
              <Check size={15} /> Ta banque et ta collection, sur tous tes
              appareils
            </li>
            <li>
              <Check size={15} /> Avatar, cadre et carte de profil à ton image
            </li>
            <li>
              <Check size={15} /> Des amis, pour suivre leur progression
            </li>
          </ul>
        </aside>

        <div className="auth__main">
          <button
            className="closebtn auth__close"
            onClick={onClose}
            aria-label="Fermer"
            disabled={busy}
          >
            <X size={18} strokeWidth={2.4} />
          </button>
          <p className="auth__eyebrow">Salon privé</p>
          <h2 className="auth__title" id={`${ids}-title`}>
            {signup ? 'Ouvre ton compte' : 'Entre au salon'}
          </h2>

          <div className="auth__tabs" role="tablist" data-active={tab}>
            <span className="auth__tab-ink" aria-hidden="true" />
            <button
              role="tab"
              aria-selected={!signup}
              onClick={() => {
                setTab('login');
                setError(null);
                setTouched(false);
              }}
            >
              Connexion
            </button>
            <button
              role="tab"
              aria-selected={signup}
              onClick={() => {
                setTab('signup');
                setError(null);
                setTouched(false);
              }}
            >
              Créer un compte
            </button>
          </div>

          <form className="auth__form" onSubmit={submit} noValidate>
            <div className="auth-field" data-invalid={Boolean(pseudoError)}>
              <label className="auth-field__label" htmlFor={`${ids}-pseudo-in`}>
                Pseudo
              </label>
              <span className="auth-field__box">
                <User size={18} aria-hidden="true" />
                <input
                  id={`${ids}-pseudo-in`}
                  value={pseudo}
                  onChange={(e) => setPseudo(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={16}
                  placeholder="ex. AsDePique"
                  aria-invalid={Boolean(pseudoError)}
                  aria-describedby={`${ids}-pseudo`}
                />
              </span>
              <span className="auth-field__hint" id={`${ids}-pseudo`}>
                {pseudoError ??
                  (signup
                    ? '3 à 16 caractères: lettres, chiffres, - et _.'
                    : ' ')}
              </span>
            </div>

            <div className="auth-field" data-invalid={Boolean(passwordError)}>
              <label className="auth-field__label" htmlFor={`${ids}-pw-in`}>
                Mot de passe
              </label>
              <span className="auth-field__box">
                <Lock size={18} aria-hidden="true" />
                <input
                  id={`${ids}-pw-in`}
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={signup ? 'new-password' : 'current-password'}
                  maxLength={72}
                  aria-invalid={Boolean(passwordError)}
                  aria-describedby={`${ids}-password`}
                />
                <button
                  type="button"
                  className="auth-field__eye"
                  onClick={() => setShow((v) => !v)}
                  aria-label={
                    show
                      ? 'Masquer le mot de passe'
                      : 'Afficher le mot de passe'
                  }
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
              {signup ? (
                <span className="auth-strength" id={`${ids}-password`}>
                  <span className="auth-strength__bars" data-level={strength}>
                    {[1, 2, 3, 4].map((n) => (
                      <i key={n} data-on={strength >= n} />
                    ))}
                  </span>
                  <span>
                    {passwordError ??
                      (password
                        ? STRENGTH[strength]
                        : `${PASSWORD_MIN} caractères minimum, lettres et chiffres.`)}
                  </span>
                </span>
              ) : (
                <span className="auth-field__hint" id={`${ids}-password`}>
                  {' '}
                </span>
              )}
            </div>

            {signup && (
              <div className="auth-field" data-invalid={Boolean(confirmError)}>
                <label
                  className="auth-field__label"
                  htmlFor={`${ids}-confirm-in`}
                >
                  Confirme le mot de passe
                </label>
                <span className="auth-field__box">
                  <Lock size={18} aria-hidden="true" />
                  <input
                    id={`${ids}-confirm-in`}
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    maxLength={72}
                    aria-invalid={Boolean(confirmError)}
                    aria-describedby={`${ids}-confirm`}
                  />
                </span>
                <span className="auth-field__hint" id={`${ids}-confirm`}>
                  {confirmError ?? ' '}
                </span>
              </div>
            )}

            {signup && progress && (
              <p className="auth__carry">
                <Chip size={15} /> Ta progression actuelle (
                {formatNumber(player.wallet.balance)} jetons,{' '}
                {player.stats.gamesWon} victoires) sera reprise dans ton compte.
              </p>
            )}

            {error && (
              <p className="auth__error" role="alert">
                <AlertTriangle size={16} /> {error}
              </p>
            )}

            <button
              className="btn btn--gold btn--lg btn--block auth__submit"
              disabled={busy}
            >
              {busy ? (
                <span className="auth__spinner" aria-hidden="true">
                  <Chip size="100%" />
                </span>
              ) : null}
              {busy
                ? signup
                  ? 'Ouverture du compte…'
                  : 'Connexion…'
                : signup
                  ? 'Créer mon compte'
                  : 'Se connecter'}
            </button>
          </form>

          <p className="auth__foot">
            Pas d&rsquo;adresse mail: juste un pseudo et un mot de passe. Garde
            ce dernier précieusement, personne ne pourra le réinitialiser.
          </p>
          <button
            className="btn btn--quiet auth__guest"
            onClick={onClose}
            disabled={busy}
          >
            Continuer sans compte
          </button>
        </div>
      </div>
    </div>
  );
}
