import { useState, type ReactNode } from 'react';
import {
  Check,
  CircleUserRound,
  Layers,
  LayoutGrid,
  Lock,
  Play,
  RotateCcw,
  Sparkles,
  SquareUserRound,
  Type,
  Spade,
  Frame,
} from 'lucide-react';
import { Preview } from './ShopModal';
import { VictoryLayer } from './VictoryLayer';
import { RankEmblem } from './Rank';
import { useMetaStore } from '../state/meta';
import { economy, reportFailure } from '../state/economy';
import { playSound } from '../audio/sfx';
import { SLOT_OF, findCosmetic, type Cosmetic } from '../state/catalog';
import {
  ATELIER_LEVEL,
  ATELIER_SLOTS,
  atelierConfig,
  atelierSlot,
  atelierSources,
  type AtelierConfig,
  type AtelierSlot,
  type AtelierState,
} from '../state/atelier';
import { legendLabel } from '../state/legend';
import { useOwnAtelier } from './atelierView';

const SLOT_ICON: Record<AtelierSlot, ReactNode> = {
  back: <Layers size={16} />,
  face: <Spade size={16} />,
  table: <LayoutGrid size={16} />,
  fx: <Sparkles size={16} />,
  title: <Type size={16} />,
  avatar: <CircleUserRound size={16} />,
  frame: <Frame size={16} />,
  card: <SquareUserRound size={16} />,
};

/** Exemples de compositions, montres avant le niveau L. */
const SHOWCASE: {
  slot: AtelierSlot;
  config: AtelierConfig;
  caption: string;
}[] = [
  {
    slot: 'back',
    config: {
      bg: 'retro',
      pattern: 'constellation',
      medal: 'eclipse',
      border: 'onyx',
    },
    caption:
      'Le fond Bordeaux, les étoiles de Constellation, le soleil noir d’Éclipse.',
  },
  {
    slot: 'avatar',
    config: { scene: 'phenix', figure: 'oracle', fx: 'ombre' },
    caption: 'L’Oracle devant le soleil du Phénix, les yeux de l’Ombre.',
  },
  {
    slot: 'title',
    config: { plate: 'dernier-boss', text: 'roi' },
    caption: 'La plaque du Dernier Boss, la devise du Roi du Jackpot.',
  },
];

const same = (a: AtelierConfig, b: AtelierConfig) =>
  Object.keys(a).every((k) => a[k] === b[k]);

/** Avant le niveau L: ce que l'Atelier permettra, en exemples. */
function Teaser() {
  const level = useMetaStore((s) => s.legend.level);
  const equipped = useMetaStore((s) => s.equipped);
  const left = ATELIER_LEVEL - level;
  return (
    <section className="atl-teaser">
      <header className="atl-teaser__head">
        <RankEmblem tier="legend" level={ATELIER_LEVEL} size={72} />
        <div>
          <span className="lg-eyebrow">{legendLabel(ATELIER_LEVEL)}</span>
          <h3>L&rsquo;Atelier</h3>
          <p>
            Au bout de la voie, tu ne choisis plus tes objets: tu les composes.
            Le fond d&rsquo;un dos, le motif d&rsquo;un autre, le médaillon
            d&rsquo;un troisième. Le décor d&rsquo;un avatar avec le personnage
            d&rsquo;un autre. Pour les dos, rectos, tapis, célébrations, titres,
            avatars, cadres et cartes de profil, avec toutes les pièces de ta
            collection.
          </p>
          <span className="atl-teaser__left">
            <Lock size={13} /> Encore {left} niveau{left > 1 ? 'x' : ''}
          </span>
        </div>
      </header>
      <ul className="atl-teaser__examples">
        {SHOWCASE.map((ex) => (
          <li key={ex.slot}>
            <Preview
              item={findCosmetic(atelierSlot(ex.slot).itemId)!}
              avatar={equipped.avatar}
              frame={equipped.frame}
              draft={ex.config}
            />
            <span>{ex.caption}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Une piece a choisir: la vignette de l'objet qui la fournit. */
function Option({
  item,
  on,
  onPick,
}: {
  item: Cosmetic;
  on: boolean;
  onPick: () => void;
}) {
  const equipped = useMetaStore((s) => s.equipped);
  return (
    <button
      className="atl-opt"
      role="radio"
      aria-checked={on}
      aria-label={item.label}
      title={item.label}
      onClick={onPick}
    >
      <Preview item={item} avatar={equipped.avatar} frame={equipped.frame} />
      <span className="atl-opt__name">{item.label}</span>
      {on && (
        <span className="atl-opt__check" aria-hidden="true">
          <Check size={12} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/** L'Atelier: composer, voir le resultat en direct, enregistrer. */
export function AtelierPanel() {
  const level = useMetaStore((s) => s.legend.level);
  const owned = useMetaStore((s) => s.inventory.owned);
  const lifetime = useMetaStore((s) => s.wallet.lifetimeEarned);
  const equipped = useMetaStore((s) => s.equipped);
  const own = useOwnAtelier();
  const [slot, setSlot] = useState<AtelierSlot>('back');
  const [drafts, setDrafts] = useState<AtelierState>({});
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);

  if (level < ATELIER_LEVEL) return <Teaser />;

  const def = atelierSlot(slot);
  const saved = atelierConfig(own, slot);
  const draft = drafts[slot] ?? saved;
  const item = findCosmetic(def.itemId)!;
  const sources = atelierSources(slot, owned, lifetime, level);
  const worn = equipped[SLOT_OF[def.category]] === def.itemId;
  const dirty = !same(draft, saved);

  const pick = (key: string, id: string) =>
    setDrafts((d) => ({ ...d, [slot]: { ...draft, [key]: id } }));

  const save = async () => {
    setBusy(true);
    try {
      await economy.atelier(slot, draft);
      playSound('purchase');
      setDrafts((d) => {
        const next = { ...d };
        delete next[slot];
        return next;
      });
    } catch (err) {
      reportFailure(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="atl">
      <p className="lg-lead">
        Compose tes objets avec les pièces de ta collection. Le résultat
        s&rsquo;affiche en direct; il s&rsquo;équipe quand tu
        l&rsquo;enregistres, et tes amis le voient sur ta carte.
      </p>
      <div className="atl__slots" role="tablist" aria-label="Que composer">
        {ATELIER_SLOTS.map((d) => {
          const isWorn = equipped[SLOT_OF[d.category]] === d.itemId;
          return (
            <button
              key={d.slot}
              role="tab"
              aria-selected={slot === d.slot}
              onClick={() => {
                setSlot(d.slot);
                setPlaying(false);
              }}
            >
              {SLOT_ICON[d.slot]}
              <span>{d.label}</span>
              {isWorn && <span className="atl__worn" aria-label="équipé" />}
            </button>
          );
        })}
      </div>

      <div className="atl__bench" role="tabpanel">
        <section className="atl__stage" aria-label="Aperçu">
          <div className="atl__preview" data-slot={slot}>
            <Preview
              item={item}
              avatar={equipped.avatar}
              frame={equipped.frame}
              draft={draft}
            />
            {slot === 'fx' && (
              <button
                className="item__peek atl__play"
                onClick={() => setPlaying(true)}
              >
                <Play size={14} /> Voir la célébration
              </button>
            )}
          </div>
          <ul className="atl__recipe">
            {def.parts.map((p) => (
              <li key={p.key}>
                <span>{p.label}</span>
                <strong>{findCosmetic(draft[p.key])?.label}</strong>
              </li>
            ))}
          </ul>
          <div className="atl__actions">
            <button
              className="btn btn--gold"
              onClick={save}
              disabled={busy || (!dirty && worn)}
            >
              {!dirty && worn ? (
                <>
                  <Check size={16} /> Équipé
                </>
              ) : dirty ? (
                'Enregistrer et équiper'
              ) : (
                'Équiper'
              )}
            </button>
            {dirty && (
              <button
                className="btn btn--quiet"
                onClick={() =>
                  setDrafts((d) => {
                    const next = { ...d };
                    delete next[slot];
                    return next;
                  })
                }
              >
                <RotateCcw size={15} /> Annuler
              </button>
            )}
          </div>
        </section>

        <div className="atl__parts">
          {def.parts.map((p) => (
            <section key={p.key} className="atl-part">
              <header>
                <strong>{p.label}</strong>
                <span>{p.hint}</span>
              </header>
              <div
                className="atl-part__row"
                role="radiogroup"
                aria-label={p.label}
              >
                {sources.map((src) => (
                  <Option
                    key={src.id}
                    item={src}
                    on={draft[p.key] === src.id}
                    onPick={() => pick(p.key, src.id)}
                  />
                ))}
              </div>
            </section>
          ))}
          <p className="atl__more">
            Chaque objet acheté en boutique ajoute ses pièces à l&rsquo;Atelier.
          </p>
        </div>
      </div>

      {playing && (
        <VictoryLayer
          fx={def.itemId}
          draft={draft}
          preview
          onDone={() => setPlaying(false)}
        />
      )}
    </div>
  );
}
