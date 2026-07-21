import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { SCORE } from '../engine';

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
            {it.mark ?? '.'}
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
          Ranger les 52 cartes sur les quatre fondations, chaque enseigne de l
          As au Roi. Quand les quatre piles sont completes, la partie est gagnee
          et les cartes font la fete.
        </p>
        <h3>Le tableau</h3>
        <RuleList
          items={[
            {
              text: 'Sept colonnes. On empile en descendant, en alternant les couleurs (un rouge sur un noir, et inversement).',
            },
            {
              text: 'On deplace une carte seule ou toute une sequence deja bien rangee.',
            },
            {
              text: 'Une colonne vide accueille uniquement un Roi (ou une sequence menee par un Roi).',
            },
            {
              text: 'Retourner une carte cachee rapporte des points et ouvre le jeu.',
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
          Astuce ergonomie: fais glisser une carte, ou tape la simplement pour l
          envoyer toute seule vers la meilleure destination. Priorite aux
          fondations, sinon la colonne qui devoile une carte cachee.
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
          Le Klondike tranquille. Score, indices et annuler illimite pour tester
          tes idees.
        </p>
        <h3>Jackpot</h3>
        <p>
          Le mode phare. Tu accumules un magot et tu choisis a chaque victoire:
          encaisser en securite, ou tout remettre en jeu sur la manche suivante.
          Voir l onglet Jackpot pour les details.
        </p>
        <h3>Defi du jour</h3>
        <p>
          Une donne unique, identique pour tout le monde ce jour la. Termine la
          pour l ajouter a ta collection mensuelle.
        </p>
        <h3>Chrono</h3>
        <p>
          Memes regles que le classique, mais le temps est ton adversaire: le
          bonus de vitesse fond a chaque seconde.
        </p>
        <h3>Zen</h3>
        <p>
          Aucun score, aucun chrono, aucune penalite. Annuler et indices sont
          gratuits. Juste le plaisir de ranger des cartes.
        </p>
      </div>
    ),
  },
  {
    id: 'score',
    label: 'Score et penalites',
    content: (
      <div className="rule-panel">
        <h3>Ce qui fait grimper le score</h3>
        <RuleList
          items={[
            {
              tone: 'plus',
              mark: '+',
              text: <>Carte posee sur une fondation: +{SCORE.toFoundation}.</>,
            },
            {
              tone: 'plus',
              mark: '+',
              text: (
                <>Carte cachee revelee dans le tableau: +{SCORE.revealCard}.</>
              ),
            },
            {
              tone: 'gold',
              mark: '*',
              text: 'Bonus de vitesse en fin de partie: plus tu es rapide, plus il est genereux.',
            },
            {
              tone: 'gold',
              mark: '*',
              text: (
                <>
                  Bonus de precision: +{SCORE.precisionBonus} si aucun coup
                  invalide ni annuler.
                </>
              ),
            },
          ]}
        />
        <h3>Ce qui coute des points</h3>
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
          Le score ne descend jamais sous zero. En mode Zen, tout est gratuit:
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
          A chaque manche gagnee en mode Jackpot, ton score grossit le magot. Un
          multiplicateur de serie recompense les victoires enchainees.
        </p>
        <RuleList
          items={[
            {
              tone: 'gold',
              mark: '1',
              text: 'Premiere victoire: le score entre tel quel dans le magot.',
            },
            {
              tone: 'gold',
              mark: '2',
              text: 'Deuxieme d affilee: x1.5. Puis x2, x3, et jusqu a x5.',
            },
          ]}
        />
        <h3>Encaisser ou doubler</h3>
        <RuleList
          items={[
            {
              tone: 'plus',
              mark: 'V',
              text: 'Encaisser: le magot rejoint definitivement ta banque. Prudent et satisfaisant.',
            },
            {
              tone: 'minus',
              mark: 'R',
              text: 'Quitte ou double: tu rejoues aussitot en risquant tout. Une manche perdue ou abandonnee, et le magot retombe a zero.',
            },
          ]}
        />
        <h3>Le coffre-fort mystere</h3>
        <p>
          Trois victoires de suite en quitte ou double debloquent le coffre.
          Ouvre le pour appliquer un multiplicateur surprise a tout ton magot:
          souvent un joli gain, mais parfois le coffre est piege. C est ca, le
          frisson.
        </p>
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
              text: 'Annuler illimite: reviens autant de coups que tu veux en arriere.',
            },
            {
              text: 'Autocompletion: des qu il n y a plus de suspense, un bouton termine la partie tout seul.',
            },
            {
              text: 'Pioche 1 ou 3: choisis la difficulte dans les options de partie.',
            },
            {
              text: 'Graine partageable: rejoue une donne precise ou envoie la a un ami via un lien.',
            },
          ]}
        />
        <div className="callout">
          Tout reste sur ton appareil: statistiques, records et reglages ne
          quittent jamais ton navigateur. Le jeu s installe et fonctionne meme
          sans connexion.
        </div>
      </div>
    ),
  },
];

export function RulesModal({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState(SECTIONS[0].id);
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <Modal title="Regles du jeu" onClose={onClose}>
      <div className="rules-nav" role="tablist">
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
