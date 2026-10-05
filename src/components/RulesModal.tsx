import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { SCORE } from '../engine';
import {
  CONSUMABLES,
  DAILY_BONUS,
  STAKE_TABLES,
  VIP_TIERS,
} from '../state/catalog';
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
          Mêmes règles que le classique, mais le temps est ton adversaire: le
          bonus de vitesse fond à chaque seconde.
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
        <h3>Les rangs VIP</h3>
        <p>
          Ton rang dépend du total de jetons gagnés depuis le début (les achats
          ne le font jamais baisser). Chaque rang offre une remise en boutique
          et ouvre de nouveaux objets.
        </p>
        <RuleList
          items={VIP_TIERS.map((t) => ({
            tone: 'gold' as const,
            mark: t.label[0],
            text: `${t.label}: dès ${formatNumber(t.threshold)} jetons gagnés${t.discount > 0 ? `, ${Math.round(t.discount * 100)} % de remise` : ''}.`,
          }))}
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
              text: "Autocomplétion: dès qu'il n'y a plus de suspense, un bouton termine la partie tout seul.",
            },
            {
              text: 'Pioche 1 ou 3: choisis la difficulté dans les options de partie.',
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
