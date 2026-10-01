# Jackpot Solitaire

Un Solitaire (Klondike) habillé façon salon de jeu privé: feutrine sous un
spot, or en filets fins, cartes ivoire illustrées. Avec un vrai grain de
folie: une banque de jetons, des tables à mise, une boutique et un mode
quitte ou double où l&rsquo;on mise son sang-froid.

L&rsquo;idée de départ est simple: c&rsquo;est un Solitaire. Mais le soin
apporté au ressenti de jeu, aux animations, aux sons faits maison et à
l&rsquo;économie de jetons en fait tout autre chose qu&rsquo;un énième jeu de
cartes générique.

![Écran d'accueil](screenshots/accueil.png)

## Sommaire

- [Ce qui rend le jeu attachant](#ce-qui-rend-le-jeu-attachant)
- [Aperçu](#aperçu)
- [Les modes de jeu](#les-modes-de-jeu)
- [Le système de score et de gambling](#le-système-de-score-et-de-gambling)
- [La banque, la boutique et les rangs VIP](#la-banque-la-boutique-et-les-rangs-vip)
- [Direction artistique](#direction-artistique)
- [Démarrage rapide](#démarrage-rapide)
- [Scripts disponibles](#scripts-disponibles)
- [Architecture du code](#architecture-du-code)
- [Tests](#tests)
- [Intégration et déploiement continus](#intégration-et-déploiement-continus)
- [Régénérer les captures et les icônes](#régénérer-les-captures-et-les-icônes)
- [Vie privée](#vie-privée)
- [Licence](#licence)

## Ce qui rend le jeu attachant

Ergonomie et ressenti:

- Chaque carte vole réellement d&rsquo;une pile à l&rsquo;autre (animation
  FLIP), y compris quand on la lâche: elle repart de là où on l&rsquo;a posée.
- Distribution animée: les 28 cartes partent de la pioche une à une et les
  cartes visibles se retournent en 3D à l&rsquo;arrivée.
- Glisser-déposer au pointeur (souris et tactile): la pile soulevée penche
  dans le sens du geste, la destination valide s&rsquo;illumine.
- Clic ou tape pour un déplacement automatique vers la meilleure destination
  (priorité aux fondations, sinon la colonne qui dévoile une carte cachée).
- Un coup impossible fait trembler la carte, qui revient en vol à sa place.
- Éclat doré sur chaque fondation qui reçoit une carte, bouquet quand une
  enseigne est complète.
- Colonnes qui se resserrent toutes seules quand elles deviennent trop
  longues: tout reste visible, sans barre de défilement.
- Décompte de fin de manche façon machine à sous, tampons de multiplicateur,
  magot qui roule jusqu&rsquo;à sa nouvelle valeur.
- Quatre effets de victoire: cascade de cartes à l&rsquo;ancienne,
  confettis dorés, pluie de jetons, feu d&rsquo;artifice.
- Sons entièrement synthétisés à la volée (aucun fichier audio), donc
  uniques: jetons qui s&rsquo;entrechoquent, cliquet de roue, tampon...

Confort de jeu:

- Indice quand on bloque, avec mise en avant de la pioche si c&rsquo;est
  elle qu&rsquo;il faut solliciter.
- Annuler illimité.
- Autocomplétion dès qu&rsquo;il n&rsquo;y a plus de suspense (vérifiée par
  simulation, donc jamais proposée à tort).
- Détection de blocage: si la donne devient mathématiquement impossible à
  terminer, le jeu le signale au lieu de laisser chercher dans le vide.
- Pioche 1 (facile) ou Pioche 3 (classique).
- Graine de partie: rejoue une donne précise ou partage-la par un lien
  `?seed=...`.

Progression, gardée en local:

- Tableau de statistiques: taux de victoire, séries, meilleur temps, temps
  moyen, coups moyens, meilleur score.
- Hauts faits à débloquer.
- Records de gambling: plus gros magot sécurisé, plus longue série.

## Aperçu

| Partie en cours | Fin de partie façon casino |
| --- | --- |
| ![Partie en cours](screenshots/partie.png) | ![Écran de gain](screenshots/jackpot.png) |

| Boutique | Tables à mise |
| --- | --- |
| ![Boutique](screenshots/boutique.png) | ![Tables à mise](screenshots/tables.png) |

| Roue du jour | Statistiques |
| --- | --- |
| ![Roue du jour](screenshots/roue.png) | ![Statistiques](screenshots/stats.png) |

| Règles interactives | Version mobile |
| --- | --- |
| ![Règles](screenshots/regles.png) | ![Mobile](screenshots/mobile.png) |

## Les modes de jeu

Toutes les règles sont expliquées dans le jeu, via un panneau interactif à
onglets accessible depuis l&rsquo;accueil (bouton Règles du jeu).

- Classique: le Klondike tranquille. Score, indices et annuler illimité.
- Jackpot: le mode phare. On accumule un magot et on choisit à chaque
  victoire d&rsquo;encaisser ou de tout remettre en jeu.
- Défi du jour: une donne unique, identique pour tout le monde le même
  jour, à ajouter à sa collection mensuelle.
- Chrono: mêmes règles, mais le bonus de vitesse fond à chaque seconde.
- Zen: ni score, ni chrono, ni pénalité. Juste le plaisir de ranger.

## Le système de score et de gambling

Le score récompense la prise de risque et la réflexion:

| Événement | Effet |
| --- | --- |
| Carte posée sur une fondation | +10 |
| Carte cachée révélée | +5 |
| Annuler un coup | -15 |
| Coup impossible | -5 |
| Indice | -25 |
| Recharger la pioche en Pioche 3 | -20 |
| Bonus de vitesse (fin de partie) | max(0, 1000 - secondes x 2) |
| Bonus de précision (0 coup invalide, 0 annuler) | +100 |

En mode Jackpot, chaque manche gagnée grossit le magot. Un multiplicateur de
série récompense les victoires enchaînées (x1, x1.5, x2, x3, puis x5). À
chaque victoire, deux choix:

- Encaisser: le magot rejoint définitivement la banque.
- Quitte ou double: on rejoue aussitôt en risquant tout. Une manche perdue
  ou abandonnée, et le magot retombe à zéro.

Trois victoires de suite en quitte ou double débloquent le coffre-fort
mystère: un multiplicateur surprise appliqué à tout le magot, souvent un
joli gain, parfois un piège. C&rsquo;est ça, le frisson.

Avant chaque série, on choisit sa table. La mise quitte la banque et entre
dans le magot: on la récupère en encaissant, on la perd avec la série.

| Table | Mise | Gains |
| --- | --- | --- |
| Libre | aucune | x1 |
| Argent | 500 | x1,5 |
| Or | 2 500 | x2 |
| Diamant (rang VIP Or) | 10 000 | x3 |

## La banque, la boutique et les rangs VIP

Les jetons encaissés ne dorment plus: ils se dépensent.

D&rsquo;où ils viennent:

- Encaisser un magot du mode Jackpot (la source principale).
- Un pourboire de 10 % du score sur toute autre victoire.
- Une prime de 500 jetons pour la première victoire du défi du jour.
- La roue du jour: un tour gratuit quotidien, pour des jetons ou un bonus.
- Un cadeau de bienvenue de 1 000 jetons (les anciennes sauvegardes gardent
  leur banque, convertie en solde).

À quoi ils servent:

- La boutique: huit dos de cartes (dont un holographique animé), neuf
  tapis (velours, Monte-Carlo, marbre noir, salon doré...) et quatre effets
  de victoire, avec aperçu avant achat.
- Les tables à mise, pour faire fructifier sa banque.
- Trois bonus consommables:
  - Œil du croupier: un indice offert, sans pénalité de score.
  - Assurance: activée avant un quitte ou double, elle rend la moitié du
    magot si la manche est perdue ou abandonnée.
  - Seconde chance: sur une donne bloquée en Jackpot, redistribue une
    manche neuve sans perdre le magot.

Les rangs VIP (Bronze, Argent, Or, Platine, Diamant) dépendent du total de
jetons gagnés depuis le début, que les achats ne font jamais baisser. Chaque
rang accorde jusqu&rsquo;à 20 % de remise et ouvre des objets et des tables
réservés.

## Direction artistique

Casino chic, mais joueur.

- Feutrine profonde éclairée par un spot central, grain discret, bords qui
  s&rsquo;assombrissent.
- Or métallique utilisé en filets fins: liserés, jetons, tampons, titres.
- Cartes ivoire avec index serif lisibles même en éventail serré, et
  enseignes vectorielles (fini les glyphes Unicode qui deviennent des emojis
  sur certains téléphones).
- Figures (Valet, Dame, Roi) en illustrations plates aux couleurs de leur
  enseigne, qui gardent leur caractère: grognons sur un coup interdit, clin
  d&rsquo;œil quand un indice les montre.
- Typographie: Fraunces (serif variable, axes « soft » et « wonk » pour le
  côté ludique) pour les titres et les chiffres, Manrope pour
  l&rsquo;interface. Polices embarquées, donc disponibles hors ligne.
- Icônes Lucide, cohérentes dans tout le jeu.

## Démarrage rapide

Pré-requis: Node 20 ou plus récent.

```bash
npm install        # installe les dépendances
npm run dev        # serveur de développement (http://localhost:5173)
npm run build      # build de production dans dist/
npm run preview    # sert le build de production en local
```

L&rsquo;application est une PWA: elle s&rsquo;installe sur mobile comme sur
ordinateur et fonctionne à 100 % hors ligne après la première visite.

## Scripts disponibles

| Script | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement avec rechargement à chaud. |
| `npm run build` | Vérifie les types puis produit le build de production. |
| `npm run preview` | Sert le build de production en local. |
| `npm test` | Lance les tests unitaires du moteur (Vitest). |
| `npm run test:watch` | Tests en mode surveillance. |
| `npm run typecheck` | Vérification stricte des types TypeScript. |
| `npm run lint` | Analyse statique ESLint. |
| `npm run format` | Reformate le code avec Prettier. |
| `npm run format:check` | Vérifie le formatage sans modifier. |
| `npm run screenshots` | Régénère icônes et captures (voir plus bas). |

## Architecture du code

Le code est séparé en trois couches nettes, pour que la logique de jeu reste
testable indépendamment de l&rsquo;interface.

```
src/
  engine/      Moteur pur, sans dépendance UI (déterministe, testé)
    types.ts     Modèle de données immuable (Board, Card, Move)
    rng.ts       Générateur pseudo-aléatoire déterministe (seeds)
    deck.ts      Création et distribution du jeu
    rules.ts     Validation des placements et des séquences
    moves.ts     Application des coups, auto-move, indices, autocomplétion,
                 détection de blocage
    scoring.ts   Calcul du score et des bonus de fin de partie
  state/       État applicatif (Zustand)
    game.ts      Partie en cours: coups, annuler, timer, gambling, mises,
                 assurance, navigation
    meta.ts      Données persistantes: réglages, stats, portefeuille,
                 inventaire, roue, hauts faits, migration des sauvegardes
    catalog.ts   Économie pure: boutique, bonus, rangs VIP, tables à mise,
                 roue du jour
    gambling.ts  Règles chiffrées du mode Jackpot
    achievements.ts
  audio/
    sfx.ts       Sons synthétisés à la volée via la Web Audio API
  components/  Interface React (plateau, bandeau, dock, boutique, roue...)
  styles/      Feuilles de style: tokens, tapis, cartes, plateau, interface
  utils/       Formatage, graines, tracés vectoriels des enseignes
```

Choix techniques notables:

- Moteur immuable: chaque coup renvoie un nouveau plateau, jamais muté. Cela
  rend l&rsquo;historique d&rsquo;annulation trivial (on empile les états
  précédents) et les tests limpides.
- Graines déterministes: un hash de chaîne alimente un générateur
  mulberry32. Deux graines identiques donnent exactement la même partie, ce
  qui permet le défi du jour et le partage par lien.
- Autocomplétion sûre: proposée uniquement si la partie peut vraiment se
  terminer en n&rsquo;envoyant que des cartes vers les fondations, vérifié
  par une simulation bornée.
- Détection de blocage: la partie est déclarée perdue seulement quand
  aucun coup ne peut plus jamais faire progresser la donne, y compris en
  simulant tous les tirages accessibles via la pioche.

- Animations de cartes en FLIP via la Web Animations API, mesurées sur la
  position de mise en page (et non la position affichée) pour ne jamais se
  fausser quand plusieurs cartes sont en vol.

Pile technique: React 18, TypeScript, Vite, Zustand, vite-plugin-pwa, Vitest,
Lucide, Fontsource (Fraunces, Manrope).

## Tests

Le cœur du jeu (le moteur) est couvert par des tests unitaires: mélange
déterministe, distribution correcte, règles de placement, application et
non-mutation des coups, détection de victoire et de blocage,
autocomplétion, indices et calcul du score.

L&rsquo;économie l&rsquo;est aussi: rangs VIP et remises, pourboires, tirage
pondéré de la roue, migration des anciennes sauvegardes, achats refusés ou
acceptés, prélèvement des mises, remboursement de l&rsquo;assurance et
encaissement.

```bash
npm test
```

## Intégration et déploiement continus

Le workflow GitHub Actions (`.github/workflows/ci.yml`) est déclenché à
chaque push et pull request sur `main`:

1. Vérification du formatage (Prettier).
2. Analyse statique (ESLint).
3. Vérification des types (TypeScript).
4. Tests unitaires (Vitest).
5. Build de production (Vite).

Sur un push vers `main`, et seulement si la passe qualité est verte, le jeu
est build avec la base adaptée au sous-chemin puis déployé automatiquement
sur GitHub Pages.

Pour activer le déploiement: dans les réglages du dépôt, section Pages,
choisir la source GitHub Actions.

## Régénérer les captures et les icônes

Les captures d&rsquo;écran (dossier `screenshots/`) et les icônes PWA
(dossier `public/`) sont générées à partir du vrai rendu du jeu, piloté par
un navigateur headless.

```bash
npm install --no-save playwright
npx playwright install chromium
npm run screenshots
```

Le script lance un serveur de développement, pilote l&rsquo;application
avec Playwright, enregistre les captures et rastérise l&rsquo;icône SVG aux
tailles attendues.

## Vie privée

Aucun compte, aucun serveur, aucun pistage. Statistiques, réglages, banque,
achats et hauts faits sont stockés uniquement dans le navigateur
(localStorage). Les jetons n&rsquo;ont aucune valeur réelle et ne
s&rsquo;achètent pas: ils se gagnent en jouant.
Rien ne quitte l&rsquo;appareil.

## Licence

Distribué sous licence MIT. Voir le fichier [LICENSE](LICENSE).
