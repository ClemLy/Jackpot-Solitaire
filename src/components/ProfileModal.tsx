import { useState, type FormEvent } from 'react';
import { Check, Lock, LogOut, ShieldAlert, Sparkles } from 'lucide-react';
import { Modal } from './Modal';
import { ProfileCard } from './ProfileCard';
import { Portrait } from './Portrait';
import { CardDecor } from './CardDecor';
import { useMetaStore, pickPlayer } from '../state/meta';
import {
  AccountError,
  accountsEnabled,
  changePassword,
  deleteAccount,
  passwordProblem,
  signOut,
  useAccountStore,
} from '../state/account';
import { useGameStore } from '../state/game';
import { economy, reportFailure } from '../state/economy';
import {
  AVATARS,
  FRAMES,
  PROFILE_CARDS,
  VIP_TIERS,
  discountedPrice,
  ownsCosmetic,
  type Cosmetic,
} from '../state/catalog';
import { publicCard, type EquipSlot } from '../core';
import { playSound } from '../audio/sfx';
import { formatNumber } from '../utils/format';
import { Chip } from './ui';

type Tab = 'avatar' | 'frame' | 'profileCard';

const TABS: { id: Tab; label: string; items: readonly Cosmetic[] }[] = [
  { id: 'avatar', label: 'Avatar', items: AVATARS },
  { id: 'frame', label: 'Cadre', items: FRAMES },
  { id: 'profileCard', label: 'Carte', items: PROFILE_CARDS },
];

function Choice({ item, slot }: { item: Cosmetic; slot: EquipSlot }) {
  const equipped = useMetaStore((s) => s.equipped);
  const owned = useMetaStore((s) => s.inventory.owned);
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);
  const openModal = useGameStore((s) => s.openModal);
  const has = ownsCosmetic(item, owned, lifetime);
  const on = equipped[slot] === item.id;
  const tier = VIP_TIERS.find((t) => t.id === item.minTier);

  const choose = async () => {
    if (!has) {
      openModal('shop');
      return;
    }
    try {
      await economy.equip(slot, item.id);
      playSound('chip');
    } catch (err) {
      reportFailure(err);
    }
  };

  return (
    <button
      className="choice"
      data-on={on}
      data-locked={!has}
      onClick={choose}
      aria-pressed={on}
      aria-label={
        has
          ? `${on ? 'Équipé' : 'Équiper'}: ${item.label}`
          : `${item.label}, à débloquer`
      }
      title={item.hint}
    >
      <span className="choice__art">
        {slot === 'avatar' && (
          <Portrait avatar={item.id} frame="cadre-simple" size="100%" />
        )}
        {slot === 'frame' && (
          <Portrait avatar={equipped.avatar} frame={item.id} size="100%" />
        )}
        {slot === 'profileCard' && (
          <span className="pcard-swatch" data-style={item.id}>
            <CardDecor style={item.id} />
            <Portrait
              avatar={equipped.avatar}
              frame={equipped.frame}
              size="52%"
            />
          </span>
        )}
        {on && (
          <span className="choice__check" aria-hidden="true">
            <Check size={13} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="choice__label">{item.label}</span>
      {!has && (
        <span className="choice__lock">
          <Lock size={11} />
          {item.price > 0 ? (
            <>
              <Chip size={11} />{' '}
              {formatNumber(discountedPrice(item.price, lifetime))}
            </>
          ) : (
            `Rang ${tier?.label}`
          )}
        </span>
      )}
    </button>
  );
}

function AccountSection() {
  const pseudo = useAccountStore((s) => s.pseudo);
  const [mode, setMode] = useState<'none' | 'password' | 'delete'>('none');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const goHome = useGameStore((s) => s.goHome);
  const closeModal = useGameStore((s) => s.closeModal);

  const run = async (task: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await task();
      setMessage({ ok: true, text: ok });
      setMode('none');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setMessage({
        ok: false,
        text:
          err instanceof AccountError
            ? err.message
            : 'Le croupier a eu un souci, réessaie.',
      });
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(next);
    if (problem) {
      setMessage({ ok: false, text: problem });
      return;
    }
    void run(() => changePassword(current, next), 'Mot de passe changé.');
  };

  const submitDelete = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await deleteAccount(confirm);
      closeModal();
      await goHome();
    }, 'Compte supprimé.');
  };

  return (
    <section className="account-box" aria-label="Compte">
      <div className="account-box__head">
        <span>
          Connecté en tant que <strong>{pseudo}</strong>
        </span>
        <button
          className="btn btn--ghost"
          onClick={async () => {
            await goHome();
            await signOut();
            closeModal();
          }}
          disabled={busy}
        >
          <LogOut size={16} /> Se déconnecter
        </button>
      </div>

      {mode === 'password' ? (
        <form className="account-form" onSubmit={submitPassword}>
          <input
            type="password"
            placeholder="Mot de passe actuel"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            aria-label="Mot de passe actuel"
          />
          <input
            type="password"
            placeholder="Nouveau mot de passe"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            aria-label="Nouveau mot de passe"
          />
          <div className="account-form__actions">
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => setMode('none')}
            >
              Annuler
            </button>
            <button className="btn btn--gold" disabled={busy}>
              Changer
            </button>
          </div>
        </form>
      ) : mode === 'delete' ? (
        <form
          className="account-form account-form--danger"
          onSubmit={submitDelete}
        >
          <p>
            <ShieldAlert size={16} /> La suppression efface ta banque, ta
            collection et tes amis, définitivement. Recopie{' '}
            <strong>{pseudo}</strong> pour confirmer.
          </p>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-label="Recopie ton pseudo"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="account-form__actions">
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => setMode('none')}
            >
              Annuler
            </button>
            <button
              className="btn btn--red"
              disabled={busy || confirm !== pseudo}
            >
              Supprimer mon compte
            </button>
          </div>
        </form>
      ) : (
        <div className="account-box__links">
          <button
            className="btn btn--quiet"
            onClick={() => setMode('password')}
          >
            Changer de mot de passe
          </button>
          <button
            className="btn btn--quiet account-box__danger"
            onClick={() => setMode('delete')}
          >
            Supprimer mon compte
          </button>
        </div>
      )}
      {message && (
        <p className="account-box__msg" data-ok={message.ok} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}

/** Mon profil: la carte, sa personnalisation et le compte. */
export function ProfileModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('avatar');
  const store = useMetaStore();
  const status = useAccountStore((s) => s.status);
  const pseudo = useAccountStore((s) => s.pseudo);
  const createdAt = useAccountStore((s) => s.createdAt);
  const openModal = useGameStore((s) => s.openModal);
  const online = status === 'online';
  const card = publicCard(pseudo ?? 'Invité', pickPlayer(store), createdAt);
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <Modal title="Mon profil" onClose={onClose} size="xl">
      <div className="profile">
        <div className="profile__card">
          <ProfileCard card={card} />
        </div>
        <div className="profile__side">
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="choices" role="tabpanel">
            {current.items.map((item) => (
              <Choice key={item.id} item={item} slot={current.id} />
            ))}
          </div>

          {online ? (
            <AccountSection />
          ) : accountsEnabled ? (
            <section className="account-cta">
              <Sparkles size={20} />
              <div>
                <strong>Garde ta progression partout</strong>
                <span>
                  Crée un compte: ta banque, ta collection et ta carte te
                  suivent sur tous tes appareils, et tes amis voient ta
                  progression.
                </span>
              </div>
              <button
                className="btn btn--gold"
                onClick={() => openModal('account')}
              >
                Créer un compte
              </button>
            </section>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
