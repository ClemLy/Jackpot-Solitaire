import { useEffect, useState, type CSSProperties } from 'react';
import { Check, Gift, Target } from 'lucide-react';
import { Modal } from './Modal';
import { Balance, Chip } from './ui';
import { ConsumableIcon } from './icons';
import { currentPeriod, useMetaStore } from '../state/meta';
import {
  activeMissions,
  isClaimable,
  missionReward,
  nextReset,
  type MissionScope,
} from '../state/missions';
import {
  VIP_TIERS,
  findConsumable,
  missionBonusFor,
  vipTierFor,
  weeklyGiftFor,
} from '../state/catalog';
import { playSound } from '../audio/sfx';
import { formatNumber } from '../utils/format';

/** "dans 5 h 12", "dans 3 j": temps restant avant le renouvellement. */
function untilReset(scope: MissionScope, now: Date): string {
  const ms = nextReset(scope, now).getTime() - now.getTime();
  const minutes = Math.max(1, Math.round(ms / 60000));
  const days = Math.floor(minutes / 1440);
  if (days >= 1) return `dans ${days} j ${Math.floor((minutes % 1440) / 60)} h`;
  const hours = Math.floor(minutes / 60);
  return hours > 0
    ? `dans ${hours} h ${String(minutes % 60).padStart(2, '0')}`
    : `dans ${minutes} min`;
}

function MissionList({ scope, now }: { scope: MissionScope; now: Date }) {
  const missions = useMetaStore((s) => s.missions);
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);
  const claim = useMetaStore((s) => s.claimMission);
  const [flash, setFlash] = useState<string | null>(null);

  const period = currentPeriod(missions[scope], scope, now);
  const bonus = missionBonusFor(lifetime);

  return (
    <ul className="missions">
      {activeMissions(scope, period.key).map((def) => {
        const value = Math.min(def.target, period.progress[def.id] ?? 0);
        const claimed = period.claimed.includes(def.id);
        const ready = isClaimable(period, def);
        const reward = missionReward(def, bonus);
        return (
          <li
            key={def.id}
            className="mission"
            data-state={claimed ? 'claimed' : ready ? 'ready' : 'open'}
            data-flash={flash === def.id}
          >
            <span className="mission__icon" aria-hidden="true">
              {claimed || ready ? <Check size={18} /> : <Target size={18} />}
            </span>
            <span className="mission__body">
              <span className="mission__label">{def.label}</span>
              <span
                className="meter meter--thin mission__meter"
                style={{ '--p': value / def.target } as CSSProperties}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={def.target}
                aria-valuenow={value}
                aria-label={def.label}
              >
                <span />
              </span>
              <span className="mission__count">
                {formatNumber(value)} / {formatNumber(def.target)}
              </span>
            </span>
            {claimed ? (
              <span className="mission__done">Récupérée</span>
            ) : ready ? (
              <button
                className="btn btn--gold mission__claim"
                onClick={() => {
                  if (claim(scope, def.id) > 0) {
                    playSound('coins');
                    setFlash(def.id);
                    setTimeout(() => setFlash(null), 900);
                  }
                }}
              >
                <Chip size={15} /> +{formatNumber(reward)}
              </button>
            ) : (
              <span className="mission__reward">
                <Chip size={14} /> {formatNumber(reward)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function RankChest() {
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);
  const canClaim = useMetaStore((s) => s.canClaimWeeklyGift());
  const claim = useMetaStore((s) => s.claimWeeklyGift);
  const [opened, setOpened] = useState(false);

  const tier = vipTierFor(lifetime);
  const gift = weeklyGiftFor(lifetime);
  const silver = VIP_TIERS.find((t) => t.id === 'silver')!;

  if (gift.length === 0) {
    return (
      <section className="chest" data-state="locked">
        <span className="chest__icon" aria-hidden="true">
          <Gift size={22} />
        </span>
        <div className="chest__body">
          <strong>Coffret de rang</strong>
          <span>
            Atteins le rang {silver.label} ({formatNumber(silver.threshold)}{' '}
            jetons gagnés) pour recevoir des bonus chaque semaine.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section
      className="chest"
      data-state={canClaim ? 'ready' : 'done'}
      data-opened={opened}
    >
      <span className="chest__icon" aria-hidden="true">
        <Gift size={22} />
      </span>
      <div className="chest__body">
        <strong>Coffret de la semaine · rang {tier.label}</strong>
        <span className="chest__items">
          {gift.map((id, i) => (
            <span key={`${id}-${i}`} className="chest__item">
              <ConsumableIcon id={id} size={14} /> {findConsumable(id).label}
            </span>
          ))}
        </span>
      </div>
      {canClaim ? (
        <button
          className="btn btn--gold"
          onClick={() => {
            if (claim().length > 0) {
              playSound('purchase');
              setOpened(true);
            }
          }}
        >
          Ouvrir
        </button>
      ) : (
        <span className="chest__done">
          <Check size={15} /> Récupéré
        </span>
      )}
    </section>
  );
}

export function MissionsModal({ onClose }: { onClose: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Modal
      title="Missions"
      onClose={onClose}
      size="lg"
      aside={<Balance className="balance--lg" />}
    >
      <RankChest />
      <div className="missions-head">
        <h3>Du jour</h3>
        <span>Nouvelles missions {untilReset('daily', now)}</span>
      </div>
      <MissionList scope="daily" now={now} />
      <div className="missions-head">
        <h3>De la semaine</h3>
        <span>Nouvelles missions {untilReset('weekly', now)}</span>
      </div>
      <MissionList scope="weekly" now={now} />
    </Modal>
  );
}
