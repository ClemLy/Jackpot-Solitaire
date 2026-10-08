import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { SCORE } from '../engine';
import {
  CHRONO_LIMIT_MS,
  CHRONO_POINTS_PER_SECOND,
  CONSUMABLES,
  DAILY_BONUS,
  GUARANTEED_PAYOUT,
  PROGRESSIVE_RULE,
  PROGRESSIVE_SEED,
  RANK_PERKS,
  SIDE_BETS,
  STAKE_TABLES,
  VEGAS_STAKE,
  VIP_TIERS,
  findConsumable,
  vegasCardValue,
} from '../state/catalog';
import { GraduationCap } from 'lucide-react';
import { useGameStore } from '../state/game';
import { formatMultiplier, formatNumber } from '../utils/format';

interface Item {
  tone?: 'plus' | 'minus' | 'gold' | 'neutral';
  mark?: string;
  text: ReactNode;
}

function RuleList({ items }: { items: Item[] }) {
  return (
    <ul className="rule-list">
      {items.map((it, i) => (
        <li key={i}>
          <span className="bullet" data-tone={it.tone ?? 'neutral'}>
            {it.mark}
          </span>
          <span>{it.text}</span>
        </li>
      ))}
    </ul>
  );
}

interface Section {
  id: string;
  label: string;
  content: ReactNode;
}

/** Relance la partie guidee depuis les regles. */
function TutorialButton() {
  const startTutorial = useGameStore((s) => s.startTutorial);
  const requestLeave = useGameStore((s) => s.requestLeave);
  return (
    <button
      className="btn btn--ghost rule-tuto"
      onClick={() => requestLeave(startTutorial)}
    >
      <GraduationCap size={18} /> Revoir le tutoriel
    </button>
  );
}

const SECTIONS: Section[] = [
  {
    id: 'base',
    label: 'Comment jouer',
    content: (
      <div className="rule-panel">
        <h3>Le but</h3>
        <p>
          Ranger les 52 cartes sur les quatre fondations, chaque enseigne de
          l&rsquo;As au Roi. Quand les quatre piles sont complètes, la partie
          est gagnée et les cartes font la fête.
        </p>
        <h3>Le tableau</h3>
        <RuleList
          items={[
            {
              text: 'Sept colonnes. On empile en descendant, en alternant les couleurs (un rouge sur un noir, et inversement).',
            },
            {
              text: 'On déplace une carte seule ou toute une séquence déjà bien rangée.',
            },
            {
              text: 'Une colonne vide accueille uniquement un Roi (ou une séquence menée par un Roi).',
            },
            {
              text: 'Retourner une carte cachée rapporte des points et ouvre le jeu.',
            },
          ]}
        />
        <h3>La pioche et le talon</h3>
        <RuleList
          items={[
            {
              text: 'Clique la pioche pour retourner des cartes vers le talon.',
            },
            {
              text: 'Quand la pioche est vide, un clic la recharge avec le talon.',
            },
            { text: 'Seule la carte du dessus du talon est jouable.' },
          ]}
        />
        <div className="callout">
          Astuce ergonomie: fais glisser une carte, ou tape la simplement pour
          l&rsquo;envoyer toute seule vers la meilleure destination. Priorité
          aux fondations, sinon la colonne qui dévoile une carte cachée.
        </div>
      </div>
    ),
  },
  {
    id: 'modes',
    label: 'Les modes',
    content: (
      <div className="rule-panel">
        <h3>Classique</h3>
        <p>
          Le Klondike tranquille. Score, indices et annuler illimité pour tester
          tes idées.
        </p>
        <h3>Jackpot</h3>
        <p>
          Le mode phare. Tu accumules un magot et tu choisis à chaque victoire:
          encaisser en sécurité, ou tout remettre en jeu sur la manche suivante.
          Voir l&rsquo;onglet Jackpot pour les détails.
        </p>
        <h3>Défi du jour</h3>
        <p>
          Une donne unique, identique pour tout le monde ce jour-là. Termine-la
          pour l&rsquo;ajouter à ta collection mensuelle.
        </p>
        <h3>Chrono</h3>
        <p>
          {CHRONO_LIMIT_MS / 60000} minutes pour tout ranger, à compter du
          premier coup. Chaque seconde restante à la victoire rapporte{' '}
          {CHRONO_POINTS_PER_SECOND} points. Si le compte à rebours tombe à
          zéro, la partie est perdue.
        </p>
        <h3>Vegas</h3>
        <p>
          Le score des casinos d&rsquo;antan: la donne coûte {VEGAS_STAKE}{' '}
          jetons, et chaque carte posée sur une fondation en rapporte selon la
          difficulté (de {vegasCardValue('easy')} en Facile à{' '}
          {vegasCardValue('expert')} en Expert). Un seul passage dans la pioche
          en pioche 1, trois en pioche 3, et pas d&rsquo;annulation. Quitter en
          cours de route paie les cartes déjà rangées.
        </p>
        <h3>Zen</h3>
        <p>
          Aucun score, aucun chrono, aucune pénalité. Annuler et indices sont
          gratuits. Juste le plaisir de ranger des cartes.
        </p>
      </div>
    ),
  },
  {
    id: 'score',
    label: 'Score et pénalités',
    content: (
      <div className="rule-panel">
        <h3>Ce qui fait grimper le score</h3>
        <RuleList
          items={[
            {
              tone: 'plus',
              mark: '+',
              text: <>Carte posée sur une fondation: +{SCORE.toFoundation}.</>,
            },
            {
              tone: 'plus',
              mark: '+',
              text: (
                <>Carte cachée révélée dans le tableau: +{SCORE.revealCard}.</>
              ),
            },
            {
              tone: 'gold',
              mark: '*',
              text: 'Bonus de vitesse en fin de partie: plus tu es rapide, plus il est généreux.',
            },
            {
              tone: 'gold',
              mark: '*',
              text: (
                <>
                  Bonus de précision: +{SCORE.precisionBonus} si aucun coup
                  invalide ni annuler.
                </>
              ),
            },
          ]}
        />
        <h3>Ce qui coûte des points</h3>
        <RuleList
          items={[
            {
              tone: 'minus',
              mark: '-',
              text: <>Annuler un coup: {SCORE.undoPenalty}.</>,
            },
            {
              tone: 'minus',
              mark: '-',
              text: (
                <>Coup impossible (la carte tremble): {SCORE.invalidPenalty}.</>
              ),
            },
            {
              tone: 'minus',
              mark: '-',
              text: <>Demander un indice: {SCORE.hintPenalty}.</>,
            },
            {
              tone: 'minus',
              mark: '-',
              text: (
                <>
                  Recharger la pioche en Pioche 3: {SCORE.recyclePenaltyDraw3}.
                </>
              ),
            },
          ]}
        />
        <div className="callout">
          Le score ne descend jamais sous zéro. En mode Zen, tout est gratuit:
          on ne compte pas les points.
        </div>
      </div>
    ),
  },
  {
    id: 'jackpot',
    label: 'Jackpot',
    content: (
      <div className="rule-panel">
        <h3>La banque de points</h3>
        <p>
          À chaque manche gagnée en mode Jackpot, ton score grossit le magot. Un
          multiplicateur de série récompense les victoires enchaînées.
        </p>
        <RuleList
          items={[
            {
              tone: 'gold',
              mark: '1',
              text: 'Première victoire: le score entre tel quel dans le magot.',
            },
            {
              tone: 'gold',
              mark: '2',
              text: "Deuxième d'affilée: ×1,5. Puis ×2, ×3, et jusqu'à ×5.",
            },
          ]}
        />
        <h3>Encaisser ou doubler</h3>
        <RuleList
          items={[
            {
              tone: 'plus',
              mark: 'V',
              text: 'Encaisser: le magot rejoint définitivement ta banque. Prudent et satisfaisant.',
            },
            {
              tone: 'minus',
              mark: 'R',
              text: 'Quitte ou double: tu rejoues aussitôt en risquant tout. Une manche perdue ou abandonnée, et le magot retombe à zéro.',
            },
          ]}
        />
        <h3>Les tables à mise</h3>
        <p>
          Avant chaque série, tu choisis ta table. La mise quitte ta banque et
          entre dans le magot: encaisse pour la récupérer avec tes gains, perds
          la série et elle s&rsquo;envole. En échange, chaque manche gagnée
          rapporte plus.
        </p>
        <RuleList
          items={STAKE_TABLES.map((t) => ({
            tone: 'gold' as const,
            mark: `×${formatMultiplier(t.multiplier)}`,
            text: (
              <>
                {t.label}:{' '}
                {t.stake > 0
                  ? `mise de ${formatNumber(t.stake)} jetons`
                  : 'sans mise'}
                , gains multipliés par {formatMultiplier(t.multiplier)}
                {t.minTier
                  ? ` (rang VIP ${VIP_TIERS.find((v) => v.id === t.minTier)?.label} requis).`
                  : '.'}
              </>
            ),
          }))}
        />
        <h3>Mettre la moitié à l&rsquo;abri</h3>
        <p>
          Entre encaisser et doubler, une troisième voie: la moitié du magot
          rejoint ta banque, l&rsquo;autre moitié reste en jeu et ta série
          continue.
        </p>
        <h3>Les paris annexes</h3>
        <p>
          Avant ton premier coup de chaque manche, tu peux poser des paris sur
          la façon dont tu vas gagner. Chaque pari coûte 10 % de la mise de la
          table (50 jetons au minimum) et paie à la victoire si la condition est
          tenue. Perdus avec la manche.
        </p>
        <RuleList
          items={SIDE_BETS.map((b) => ({
            tone: 'gold' as const,
            mark: `${b.odds}:1`,
            text: `${b.label}: ${b.rule.toLowerCase()}`,
          }))}
        />
        <h3>Le jackpot progressif</h3>
        <p>
          Une cagnotte commune qui grossit à chaque manche jouée et avec les
          paris perdus. {PROGRESSIVE_RULE} Elle repart ensuite de{' '}
          {formatNumber(PROGRESSIVE_SEED)} jetons.
        </p>
        <h3>Le coffre-fort mystère</h3>
        <p>
          Trois victoires de suite en quitte ou double débloquent le coffre.
          Ouvre-le pour appliquer un multiplicateur surprise à tout ton magot:
          souvent un joli gain, mais parfois le coffre est piégé. C&rsquo;est
          ça, le frisson.
        </p>
      </div>
    ),
  },
  {
    id: 'banque',
    label: 'Banque et boutique',
    content: (
      <div className="rule-panel">
        <h3>D&rsquo;où viennent les jetons</h3>
        <RuleList
          items={[
            {
              tone: 'gold',
              mark: 'J',
              text: 'Encaisser un magot du mode Jackpot: la source principale, et de loin.',
            },
            {
              tone: 'plus',
              mark: '+',
              text: 'Toute autre victoire verse un pourboire égal à 10 % du score de la manche.',
            },
            {
              tone: 'plus',
              mark: '+',
              text: `Première victoire du défi du jour: prime de ${formatNumber(DAILY_BONUS)} jetons.`,
            },
            {
              tone: 'plus',
              mark: '+',
              text: 'La roue du jour: un tour gratuit chaque jour, pour des jetons ou un bonus.',
            },
          ]}
        />
        <h3>À quoi ils servent</h3>
        <RuleList
          items={[
            {
              text: 'La boutique: dos et recto des cartes, tapis, effets de victoire et titres honorifiques. Les plus belles pièces sont réservées aux rangs Platine et Diamant.',
            },
            {
              text: 'Les tables à mise du Jackpot, pour faire fructifier ta banque.',
            },
            ...CONSUMABLES.map((c) => ({
              tone: 'gold' as const,
              mark: '*',
              text: (
                <>
                  {c.label} ({formatNumber(c.price)} jetons): {c.hint}
                </>
              ),
            })),
          ]}
        />
        <h3>Les missions</h3>
        <p>
          Trois missions par jour et trois par semaine, les mêmes pour tout le
          monde. Termine-les puis récupère ta récompense dans l&rsquo;écran
          Missions, avant qu&rsquo;elles ne se renouvellent.
        </p>
        <h3>Les rangs VIP</h3>
        <p>
          Ton rang dépend du total de jetons gagnés depuis le début (les achats
          ne le font jamais baisser). Chaque rang offre une remise en boutique,
          ouvre de nouveaux objets et, dès le rang Argent, un coffret de bonus
          chaque semaine.
        </p>
        <RuleList
          items={VIP_TIERS.map((t) => {
            const perk = RANK_PERKS.find((p) => p.tier === t.id);
            const extras = [
              t.discount > 0
                ? `${Math.round(t.discount * 100)} % de remise`
                : '',
              perk?.gift
                ? `+ ${findConsumable(perk.gift).label} chaque semaine`
                : '',
              perk?.missionBonus
                ? `missions +${Math.round(perk.missionBonus * 100)} %`
                : '',
            ].filter(Boolean);
            return {
              tone: 'gold' as const,
              mark: t.label[0],
              text: `${t.label}: dès ${formatNumber(t.threshold)} jetons gagnés${extras.length ? `, ${extras.join(', ')}` : ''}.`,
            };
          })}
        />
      </div>
    ),
  },
  {
    id: 'astuces',
    label: 'Confort de jeu',
    content: (
      <div className="rule-panel">
        <h3>Les petits plus</h3>
        <RuleList
          items={[
            { text: 'Indice: met en avant un coup jouable quand tu bloques.' },
            {
              text: 'Annuler illimité: reviens autant de coups que tu veux en arrière.',
            },
            {
              text: "Autocomplétion: une fois toutes les cartes de la table retournées, et s'il n'y a plus de suspense, les cartes se rangent toutes seules.",
            },
            {
              text: 'Difficulté: de Facile (×0,5) à Expert (×3), elle règle la pioche, la donne et les jetons gagnés. À choisir dans les réglages ou les options de partie.',
            },
            {
              text: 'Jokers: Coup d’œil pour regarder une carte cachée, Remélange pour rebattre la pioche, Joker pour poser une carte sur n’importe quelle colonne. Bouton Jokers en bas de l’écran.',
            },
            {
              text: `Donnes garanties gagnables: à activer dans les réglages. Le croupier ne sert que des donnes dont il a prouvé qu’elles se gagnent (gains ×${formatMultiplier(GUARANTEED_PAYOUT)}).`,
            },
            {
              text: 'Vibrations: sur les téléphones qui le permettent, un petit retour tactile aux moments clés.',
            },
            {
              text: 'Graine partageable: rejoue une donne précise ou envoie-la à un ami via un lien.',
            },
            {
              tone: 'minus',
              mark: '!',
              text: "Une donne peut parfois devenir mathématiquement bloquée: plus aucun coup ne peut jamais faire avancer la partie. Le jeu te le signale dès que c'est le cas, inutile de chercher plus loin.",
            },
          ]}
        />
        <div className="callout">
          Tout reste sur ton appareil: statistiques, records et réglages ne
          quittent jamais ton navigateur. Le jeu s&rsquo;installe et fonctionne
          même sans connexion.
        </div>
        <TutorialButton />
      </div>
    ),
  },
];

export function RulesModal({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState(SECTIONS[0].id);
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <Modal title="Règles du jeu" onClose={onClose} size="lg">
      <div className="tabs" role="tablist">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={s.id === active}
            onClick={() => setActive(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{section.content}</div>
    </Modal>
  );
}
