import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  Brain,
  CalendarHeart,
  Check,
  Coins,
  Crown,
  Diamond,
  Dices,
  Flame,
  Gem,
  Layers,
  Lock,
  PartyPopper,
  ShoppingBag,
  Snowflake,
  Sparkles,
  Star,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Vault,
  Zap,
} from 'lucide-react';
import { Modal } from './Modal';
import { RankEmblem } from './Rank';
import { useMetaStore, pickPlayer } from '../state/meta';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_FAMILIES,
  EXPLOITS,
  reaches,
  type AchievementCategory,
  type AchievementFamily,
  type AchievementIcon,
  type Exploit,
  type Medal,
} from '../state/achievements';
import { formatDuration, formatNumber } from '../utils/format';

const ICONS: Record<AchievementIcon, (size: number) => ReactNode> = {
  trophy: (s) => <Trophy size={s} />,
  cards: (s) => <Layers size={s} />,
  flame: (s) => <Flame size={s} />,
  zap: (s) => <Zap size={s} />,
  star: (s) => <Star size={s} />,
  gem: (s) => <Gem size={s} />,
  dices: (s) => <Dices size={s} />,
  vault: (s) => <Vault size={s} />,
  coins: (s) => <Coins size={s} />,
  calendar: (s) => <CalendarHeart size={s} />,
  crown: (s) => <Crown size={s} />,
  bag: (s) => <ShoppingBag size={s} />,
  brain: (s) => <Brain size={s} />,
  snowflake: (s) => <Snowflake size={s} />,
  target: (s) => <Target size={s} />,
  timer: (s) => <Timer size={s} />,
  chart: (s) => <TrendingUp size={s} />,
  hat: (s) => <PartyPopper size={s} />,
  diamond: (s) => <Diamond size={s} />,
  sparkles: (s) => <Sparkles size={s} />,
};

const MEDAL_LABEL: Record<Medal, string> = {
  bronze: 'Bronze',
  silver: 'Argent',
  gold: 'Or',
  diamond: 'Diamant',
};

const RANKS = ['Bronze', 'Argent', 'Or', 'Platine', 'Diamant'];

function formatValue(family: AchievementFamily, value: number): string {
  if (family.format === 'time') return formatDuration(value);
  if (family.format === 'rank') return RANKS[value] ?? '—';
  return formatNumber(value);
}

function unlockedOn(at: number | undefined): string | null {
  if (!at) return null;
  return new Date(at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Une famille de paliers: medaille atteinte, paliers et jauge. */
function FamilyRow({
  family,
  value,
  unlocked,
}: {
  family: AchievementFamily;
  value: number | null;
  unlocked: Record<string, number>;
}) {
  const reached = family.tiers.filter((t) => unlocked[t.id]);
  const top = reached[reached.length - 1];
  const next = family.tiers.find((t) => !unlocked[t.id]);

  // Progression vers le prochain palier, de 0 a 1.
  let progress = 1;
  let caption: string;
  if (next) {
    if (family.lowerIsBetter) {
      progress = value ? Math.min(1, next.goal / value) : 0;
      caption = value
        ? `Record ${formatValue(family, value)} · objectif ${formatValue(family, next.goal)}`
        : `Objectif ${formatValue(family, next.goal)}`;
    } else {
      const v = value ?? 0;
      progress = Math.min(1, v / next.goal);
      caption =
        family.format === 'rank'
          ? `Rang ${formatValue(family, v)} · objectif ${formatValue(family, next.goal)}`
          : `${formatNumber(v)} / ${formatNumber(next.goal)}`;
    }
  } else {
    caption = 'Tous les paliers atteints';
  }

  return (
    <li className="achv" data-medal={top?.medal ?? 'none'}>
      <span className="achv__icon">{ICONS[family.icon](20)}</span>
      <div className="achv__body">
        <div className="achv__head">
          <strong>{family.label}</strong>
          <span className="achv__title">{top ? top.title : 'À débloquer'}</span>
        </div>
        <p className="achv__desc">
          {next ? family.describe(next.goal) : family.describe(top!.goal)}
        </p>
        <div className="achv__meter">
          <span
            className="achv__bar"
            style={{ '--p': progress } as CSSProperties}
            data-medal={next?.medal ?? top?.medal}
          >
            <span />
          </span>
          <span className="achv__caption">{caption}</span>
        </div>
      </div>
      <ol className="achv__tiers" aria-label="Paliers">
        {family.tiers.map((t) => {
          const on = Boolean(unlocked[t.id]) || reaches(family, value, t.goal);
          return (
            <li
              key={t.id}
              data-on={on}
              title={`${t.title} (${MEDAL_LABEL[t.medal]}): ${family.describe(t.goal)}`}
            >
              <RankEmblem tier={t.medal} size={22} compact />
              <span className="sr-only">
                {t.title}, {on ? 'obtenu' : 'à débloquer'}
              </span>
            </li>
          );
        })}
      </ol>
    </li>
  );
}

function ExploitCard({ exploit, at }: { exploit: Exploit; at?: number }) {
  const on = Boolean(at);
  return (
    <li className="exploit" data-on={on} data-medal={exploit.medal}>
      <span className="exploit__icon">
        {ICONS[exploit.icon](20)}
        <RankEmblem
          tier={exploit.medal}
          size={18}
          compact
          className="exploit__medal"
        />
      </span>
      <div className="exploit__body">
        <strong>{exploit.title}</strong>
        <span className="exploit__desc">{exploit.description}</span>
        <span className="exploit__state">
          {on ? (
            <>
              <Check size={13} /> Obtenu le {unlockedOn(at)}
            </>
          ) : (
            <>
              <Lock size={12} /> À débloquer
            </>
          )}
        </span>
      </div>
    </li>
  );
}

/** Hauts faits: resume, paliers par famille et exploits. */
export function AchievementsModal({ onClose }: { onClose: () => void }) {
  const store = useMetaStore();
  const player = pickPlayer(store);
  const unlocked = player.achievements;
  const [tab, setTab] = useState<'all' | AchievementCategory>('all');

  const total = ACHIEVEMENTS.length;
  const done = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  const medals = (['bronze', 'silver', 'gold', 'diamond'] as Medal[]).map(
    (m) => ({
      medal: m,
      count: ACHIEVEMENTS.filter((a) => a.medal === m && unlocked[a.id]).length,
      total: ACHIEVEMENTS.filter((a) => a.medal === m).length,
    }),
  );
  const ratio = done / total;
  const R = 34;
  const C = 2 * Math.PI * R;

  const countFor = (cat: AchievementCategory) => {
    const list = ACHIEVEMENTS.filter((a) => a.category === cat);
    return `${list.filter((a) => unlocked[a.id]).length}/${list.length}`;
  };

  const families = ACHIEVEMENT_FAMILIES.filter(
    (f) => tab === 'all' || f.category === tab,
  );
  const showExploits = tab === 'all' || tab === 'exploits';

  return (
    <Modal title="Hauts faits" onClose={onClose} size="lg">
      <div className="achs">
        <section className="achs__summary" aria-label="Résumé">
          <div
            className="achs__ring"
            role="img"
            aria-label={`${done} hauts faits sur ${total}`}
          >
            <svg viewBox="0 0 80 80" width="84" height="84">
              <circle className="achs__ring-track" cx="40" cy="40" r={R} />
              <circle
                className="achs__ring-fill"
                cx="40"
                cy="40"
                r={R}
                strokeDasharray={`${C * ratio} ${C}`}
                transform="rotate(-90 40 40)"
              />
            </svg>
            <span className="achs__ring-text">
              <strong>{done}</strong>
              <small>/ {total}</small>
            </span>
          </div>
          <div className="achs__overview">
            <strong>
              {Math.round(ratio * 100)} % des hauts faits débloqués
            </strong>
            <span>
              Les paliers se débloquent tout seuls avec ta progression ; les
              exploits, sur une partie réussie.
            </span>
            <ul className="achs__medals">
              {medals.map((m) => (
                <li key={m.medal} data-medal={m.medal}>
                  <RankEmblem tier={m.medal} size={22} compact />
                  <span>
                    <strong>{m.count}</strong> / {m.total}
                  </span>
                  <span className="sr-only">{MEDAL_LABEL[m.medal]}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="tabs achs__tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'all'}
            onClick={() => setTab('all')}
          >
            Tout
          </button>
          {ACHIEVEMENT_CATEGORIES.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={tab === c.id}
              onClick={() => setTab(c.id)}
            >
              {c.label} <span className="achs__count">{countFor(c.id)}</span>
            </button>
          ))}
        </div>

        <div role="tabpanel" className="achs__panel">
          {families.length > 0 && (
            <ul className="achv-list">
              {families.map((f) => (
                <FamilyRow
                  key={f.id}
                  family={f}
                  value={f.value(player)}
                  unlocked={unlocked}
                />
              ))}
            </ul>
          )}
          {showExploits && (
            <>
              {tab === 'all' && <h3 className="achs__title">Exploits</h3>}
              <ul className="exploit-grid">
                {EXPLOITS.map((e) => (
                  <ExploitCard key={e.id} exploit={e} at={unlocked[e.id]} />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
