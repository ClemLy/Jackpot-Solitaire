# Jackpot Solitaire

Un Solitaire (Klondike) dessine a la main, plein de caractere, avec un vrai
grain de folie: une banque de points facon casino et un mode quitte ou double
ou l on mise son sang froid.

L idee de depart est simple: c est un Solitaire. Mais le soin apporte au
ressenti de jeu, aux animations, aux sons faits maison et au systeme de mise
en fait tout autre chose qu un enieme jeu de cartes generique.

![Ecran d accueil](screenshots/accueil.png)

## Sommaire

- [Ce qui rend le jeu attachant](#ce-qui-rend-le-jeu-attachant)
- [Apercu](#apercu)
- [Les modes de jeu](#les-modes-de-jeu)
- [Le systeme de score et de gambling](#le-systeme-de-score-et-de-gambling)
- [Direction artistique](#direction-artistique)
- [Demarrage rapide](#demarrage-rapide)
- [Scripts disponibles](#scripts-disponibles)
- [Architecture du code](#architecture-du-code)
- [Tests](#tests)
- [Integration et deploiement continus](#integration-et-deploiement-continus)
- [Regenerer les captures et les icones](#regenerer-les-captures-et-les-icones)
- [Vie privee](#vie-privee)
- [Licence](#licence)

## Ce qui rend le jeu attachant

Ergonomie et ressenti:

- Glisser deposer fluide au pointeur (souris et tactile), avec pile fantome
  qui suit le doigt.
- Clic ou tape pour un deplacement automatique vers la meilleure destination
  (priorite aux fondations, sinon la colonne qui devoile une carte cachee).
- Retour visuel de secousse et petit malus flottant sur un coup impossible.
- Animation d apparition des cartes facon livre pop-up a la distribution.
- Cartes qui rebondissent a la victoire, comme au bon vieux temps.
- Sons entierement synthetises a la volee (aucun fichier audio), donc uniques.
- Themes: quatre dos de cartes et quatre tapis de jeu.

Confort de jeu:

- Indice quand on bloque.
- Annuler illimite.
- Autocompletion des qu il n y a plus de suspense (verifiee par simulation,
  donc jamais proposee a tort).
- Pioche 1 (facile) ou Pioche 3 (classique).
- Graine de partie: rejoue une donne precise ou partage la par un lien
  `?seed=...`.

Progression, gardee en local:

- Tableau de statistiques: taux de victoire, series, meilleur temps, temps
  moyen, coups moyens, meilleur score.
- Hauts faits a debloquer.
- Records de gambling: plus gros magot securise, plus longue serie.

## Apercu

| Partie en cours | Fin de partie facon casino |
| --- | --- |
| ![Partie en cours](screenshots/partie.png) | ![Ecran de gain](screenshots/jackpot.png) |

| Regles interactives | Statistiques |
| --- | --- |
| ![Regles](screenshots/regles.png) | ![Statistiques](screenshots/stats.png) |

| Personnalisation | Version mobile |
| --- | --- |
| ![Themes](screenshots/themes.png) | ![Mobile](screenshots/mobile.png) |

## Les modes de jeu

Toutes les regles sont expliquees dans le jeu, via un panneau interactif a
onglets accessible depuis l accueil (bouton Regles du jeu).

- Classique: le Klondike tranquille. Score, indices et annuler illimite.
- Jackpot: le mode phare. On accumule un magot et on choisit a chaque victoire
  d encaisser ou de tout remettre en jeu.
- Defi du jour: une donne unique, identique pour tout le monde le meme jour,
  a ajouter a sa collection mensuelle.
- Chrono: memes regles, mais le bonus de vitesse fond a chaque seconde.
- Zen: ni score, ni chrono, ni penalite. Juste le plaisir de ranger.

## Le systeme de score et de gambling

Le score recompense la prise de risque et la reflexion:

| Evenement | Effet |
| --- | --- |
| Carte posee sur une fondation | +10 |
| Carte cachee revelee | +5 |
| Annuler un coup | -15 |
| Coup impossible | -5 |
| Indice | -25 |
| Recharger la pioche en Pioche 3 | -20 |
| Bonus de vitesse (fin de partie) | max(0, 1000 - secondes x 2) |
| Bonus de precision (0 coup invalide, 0 annuler) | +100 |

En mode Jackpot, chaque manche gagnee grossit le magot. Un multiplicateur de
serie recompense les victoires enchainees (x1, x1.5, x2, x3, puis x5). A chaque
victoire, deux choix:

- Encaisser: le magot rejoint definitivement la banque.
- Quitte ou double: on rejoue aussitot en risquant tout. Une manche perdue ou
  abandonnee, et le magot retombe a zero.

Trois victoires de suite en quitte ou double debloquent le coffre-fort
mystere: un multiplicateur surprise applique a tout le magot, souvent un joli
gain, parfois un piege. C est ca, le frisson.

## Direction artistique

Le parti pris est assume: du fait main, pas du tout lisse.

- Cartes en papier creme aux bords legerement irreguliers, avec un double
  liseret dessine.
- Pips places a la main pour les cartes 2 a 10.
- Figures (Valet, Dame, Roi) au trait, qui changent d expression: grognon sur
  un coup interdit, clin d oeil quand elles sont montrees par un indice.
- Tapis en feutrine avec grain et taches fantomes de cafe.
- Typographie manuscrite, couleurs de gouache.

## Demarrage rapide

Pre-requis: Node 20 ou plus recent.

```bash
npm install       # installe les dependances
npm run dev        # serveur de developpement (http://localhost:5173)
npm run build      # build de production dans dist/
npm run preview    # sert le build de production en local
```

L application est une PWA: elle s installe sur mobile comme sur ordinateur et
fonctionne a 100 % hors ligne apres la premiere visite.

## Scripts disponibles

| Script | Role |
| --- | --- |
| `npm run dev` | Serveur de developpement avec rechargement a chaud. |
| `npm run build` | Verifie les types puis produit le build de production. |
| `npm run preview` | Sert le build de production en local. |
| `npm test` | Lance les tests unitaires du moteur (Vitest). |
| `npm run test:watch` | Tests en mode surveillance. |
| `npm run typecheck` | Verification stricte des types TypeScript. |
| `npm run lint` | Analyse statique ESLint. |
| `npm run format` | Reformate le code avec Prettier. |
| `npm run format:check` | Verifie le formatage sans modifier. |
| `npm run screenshots` | Regenere icones et captures (voir plus bas). |

## Architecture du code

Le code est separe en trois couches nettes, pour que la logique de jeu reste
testable independamment de l interface.

```
src/
  engine/      Moteur pur, sans dependance UI (deterministe, teste)
    types.ts     Modele de donnees immuable (Board, Card, Move)
    rng.ts       Generateur pseudo-aleatoire deterministe (seeds)
    deck.ts      Creation et distribution du jeu
    rules.ts     Validation des placements et des sequences
    moves.ts     Application des coups, auto-move, indices, autocompletion
    scoring.ts   Calcul du score et des bonus de fin de partie
  state/       Etat applicatif (Zustand)
    game.ts      Partie en cours: coups, annuler, timer, gambling, navigation
    meta.ts      Donnees persistantes: reglages, stats, banque, hauts faits
    gambling.ts  Regles chiffrees du mode Jackpot
    achievements.ts, themes.ts
  audio/
    sfx.ts       Sons synthetises a la volee via la Web Audio API
  components/  Interface React
  styles/      Feuilles de style (design system fait main)
  utils/       Formatage du temps, gestion des graines
```

Choix techniques notables:

- Moteur immuable: chaque coup renvoie un nouveau plateau, jamais mute. Cela
  rend l historique d annulation trivial (on empile les etats precedents) et
  les tests limpides.
- Graines deterministes: un hash de chaine alimente un generateur mulberry32.
  Deux graines identiques donnent exactement la meme partie, ce qui permet le
  defi du jour et le partage par lien.
- Autocompletion sure: proposee uniquement si la partie peut vraiment se
  terminer en n envoyant que des cartes vers les fondations, verifie par une
  simulation bornee.

Pile technique: React 18, TypeScript, Vite, Zustand, vite-plugin-pwa, Vitest.

## Tests

Le coeur du jeu (le moteur) est couvert par des tests unitaires: melange
deterministe, distribution correcte, regles de placement, application et
non-mutation des coups, detection de victoire, autocompletion, indices et
calcul du score.

```bash
npm test
```

## Integration et deploiement continus

Le workflow GitHub Actions (`.github/workflows/ci.yml`) est declenche a chaque
push et pull request sur `main`:

1. Verification du formatage (Prettier).
2. Analyse statique (ESLint).
3. Verification des types (TypeScript).
4. Tests unitaires (Vitest).
5. Build de production (Vite).

Sur un push vers `main`, et seulement si la passe qualite est verte, le jeu est
build avec la base adaptee au sous-chemin puis deploye automatiquement sur
GitHub Pages.

Pour activer le deploiement: dans les reglages du depot, section Pages, choisir
la source GitHub Actions.

## Regenerer les captures et les icones

Les captures d ecran (dossier `screenshots/`) et les icones PWA (dossier
`public/`) sont generees a partir du vrai rendu du jeu, pilote par un
navigateur headless.

```bash
npm install --no-save playwright
npx playwright install chromium
npm run screenshots
```

Le script lance un serveur de developpement, pilote l application avec
Playwright, enregistre les captures et rasterise l icone SVG aux tailles
attendues.

## Vie privee

Aucun compte, aucun serveur, aucun pistage. Statistiques, reglages, banque et
hauts faits sont stockes uniquement dans le navigateur (localStorage). Rien ne
quitte l appareil.

## Licence

Distribue sous licence MIT. Voir le fichier [LICENSE](LICENSE).
