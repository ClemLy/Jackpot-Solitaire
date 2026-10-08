import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, UserMinus, UserPlus, X } from 'lucide-react';
import { Modal } from './Modal';
import { PlayerRow, ProfileCard } from './ProfileCard';
import {
  AccountError,
  friendsApi,
  isFullCard,
  pseudoProblem,
  useAccountStore,
  type FriendCardResponse,
  type FriendLists,
} from '../state/account';
import { useGameStore } from '../state/game';
import { playSound } from '../audio/sfx';

function message(err: unknown): string {
  return err instanceof AccountError
    ? err.message
    : 'Le croupier a eu un souci, réessaie.';
}

/** Carte d'un ami (ou mini-carte d'un joueur qui n'est pas encore ami). */
function FriendView({
  pseudo,
  onBack,
  onChange,
}: {
  pseudo: string;
  onBack: () => void;
  onChange: (lists: FriendLists) => void;
}) {
  const [data, setData] = useState<FriendCardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    let alive = true;
    friendsApi
      .card(pseudo)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(message(err)));
    return () => {
      alive = false;
    };
  }, [pseudo]);

  return (
    <div className="friend-view">
      <button className="btn btn--quiet friend-view__back" onClick={onBack}>
        <ArrowLeft size={16} /> Mes amis
      </button>
      {error && (
        <p className="friends__error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && (
        <p className="friends__loading">Le croupier cherche la carte…</p>
      )}
      {data &&
        (isFullCard(data.card) ? (
          <ProfileCard card={data.card} className="friend-view__card" />
        ) : (
          <p className="friends__empty">
            Ce joueur n&rsquo;est pas encore ton ami: sa carte reste privée.
          </p>
        ))}
      {data?.friend &&
        (confirm ? (
          <div className="friend-view__confirm">
            <span>Retirer {pseudo} de tes amis ?</span>
            <button
              className="btn btn--quiet"
              onClick={() => setConfirm(false)}
            >
              Non
            </button>
            <button
              className="btn btn--red"
              onClick={async () => {
                try {
                  onChange(await friendsApi.remove(pseudo));
                  onBack();
                } catch (err) {
                  setError(message(err));
                }
              }}
            >
              Retirer
            </button>
          </div>
        ) : (
          <button
            className="btn btn--ghost friend-view__remove"
            onClick={() => setConfirm(true)}
          >
            <UserMinus size={16} /> Retirer des amis
          </button>
        ))}
    </div>
  );
}

/** Amis: ajout par pseudo, demandes et cartes des amis. */
export function FriendsModal({ onClose }: { onClose: () => void }) {
  const online = useAccountStore((s) => s.status === 'online');
  const openModal = useGameStore((s) => s.openModal);
  const [lists, setLists] = useState<FriendLists | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const apply = useCallback((next: FriendLists) => {
    setLists(next);
    useAccountStore.setState({ incoming: next.incoming.length });
  }, []);

  useEffect(() => {
    if (!online) return;
    friendsApi
      .list()
      .then(apply)
      .catch((err) => setError(message(err)));
  }, [online, apply]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const problem = pseudoProblem(pseudo);
    if (problem) {
      setError(`Pseudo invalide: ${problem}`);
      return;
    }
    setBusy(true);
    try {
      const out = await friendsApi.request(pseudo.trim());
      playSound('chip');
      setNotice(
        out.status === 'friends'
          ? `${pseudo.trim()} et toi êtes maintenant amis.`
          : `Demande envoyée à ${pseudo.trim()}.`,
      );
      setPseudo('');
      apply(await friendsApi.list());
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const respond = async (who: string, accept: boolean) => {
    try {
      apply(await friendsApi.respond(who, accept));
      if (accept) playSound('purchase');
    } catch (err) {
      setError(message(err));
    }
  };

  if (!online) {
    return (
      <Modal title="Amis" onClose={onClose} size="md">
        <div className="friends__guest">
          <p>
            Ajoute des amis pour suivre leur progression: rang, records,
            collection et carte de profil.
          </p>
          <button
            className="btn btn--gold btn--lg"
            onClick={() => openModal('account')}
          >
            Se connecter ou créer un compte
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Amis" onClose={onClose} size="lg">
      {viewing ? (
        <FriendView
          pseudo={viewing}
          onBack={() => setViewing(null)}
          onChange={apply}
        />
      ) : (
        <div className="friends">
          <form className="friends__add" onSubmit={add}>
            <label className="field">
              <input
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                placeholder="Pseudo d'un ami"
                aria-label="Pseudo d'un ami"
                maxLength={16}
                autoCapitalize="none"
                spellCheck={false}
              />
              <button
                className="btn btn--gold"
                disabled={busy || !pseudo.trim()}
              >
                <UserPlus size={17} /> Ajouter
              </button>
            </label>
          </form>
          {error && (
            <p className="friends__error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="friends__notice" role="status">
              {notice}
            </p>
          )}

          {!lists ? (
            <p className="friends__loading">Le croupier ouvre le carnet…</p>
          ) : (
            <>
              {lists.incoming.length > 0 && (
                <section>
                  <h3 className="friends__title">
                    Demandes reçues <span>{lists.incoming.length}</span>
                  </h3>
                  <ul className="player-list">
                    {lists.incoming.map((p) => (
                      <PlayerRow key={p.pseudo} card={p}>
                        <button
                          className="btn btn--gold btn--icon-sm"
                          onClick={() => respond(p.pseudo, true)}
                          aria-label={`Accepter ${p.pseudo}`}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          className="btn btn--ghost btn--icon-sm"
                          onClick={() => respond(p.pseudo, false)}
                          aria-label={`Refuser ${p.pseudo}`}
                        >
                          <X size={16} />
                        </button>
                      </PlayerRow>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="friends__title">
                  Mes amis <span>{lists.friends.length}</span>
                </h3>
                {lists.friends.length === 0 ? (
                  <p className="friends__empty">
                    Pas encore d&rsquo;amis à la table. Ajoute un pseudo
                    ci-dessus pour envoyer une demande.
                  </p>
                ) : (
                  <ul className="player-list">
                    {lists.friends.map((p) => (
                      <PlayerRow
                        key={p.pseudo}
                        card={p}
                        onOpen={() => setViewing(p.pseudo)}
                      />
                    ))}
                  </ul>
                )}
              </section>

              {lists.outgoing.length > 0 && (
                <section>
                  <h3 className="friends__title">
                    En attente <span>{lists.outgoing.length}</span>
                  </h3>
                  <ul className="player-list">
                    {lists.outgoing.map((p) => (
                      <PlayerRow key={p.pseudo} card={p}>
                        <button
                          className="btn btn--quiet"
                          onClick={async () => {
                            try {
                              apply(await friendsApi.remove(p.pseudo));
                            } catch (err) {
                              setError(message(err));
                            }
                          }}
                        >
                          Annuler
                        </button>
                      </PlayerRow>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
