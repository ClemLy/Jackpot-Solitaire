import { describe, expect, it } from 'vitest';
import { findSolution } from '../engine';
import {
  boardOf,
  buyCosmetic,
  claimWeeklyGift,
  decide,
  dispatch,
  equip,
  finishRound,
  importGuest,
  initialPlayer,
  makeCtx,
  parseAction,
  publicCard,
  sanitizePlayer,
  startRound,
  CoreError,
  Tx,
  type Ctx,
  type LogEntry,
  type PlayerState,
  type Round,
} from './index';
import { COSMETICS, LEGEND_COSMETICS, findDifficulty } from '../state/catalog';
import { progressAchievements } from '../state/achievements';
import {
  ASCENSION_GIFT,
  BLACK_PER_TABLE,
  BLACK_PER_WIN,
  EXCHANGE_RATE,
  LEGEND_THRESHOLD,
  blackFor,
  blackRate,
  legendFloor,
  legendLevelFor,
  legendProgress,
  levelReward,
  roman,
  weeklyBlack,
} from '../state/legend';

const T0 = Date.UTC(2026, 9, 26, 12);

function ctx(now = T0, first?: number): Ctx {
  let n = 0;
  const base = makeCtx(now, () => 0.5, 'Europe/Paris');
  return {
    ...base,
    random: () => {
      n += 1;
      if (n === 1 && first !== undefined) return first;
      return ((n * 9301 + 49297) % 233280) / 233280;
    },
  };
}

function player(balance: number, lifetime: number): PlayerState {
  const s = initialPlayer(ctx());
  s.wallet = { balance, lifetimeEarned: lifetime, spent: 0 };
  return s;
}

/** Un joueur deja Legendaire, au niveau voulu. */
function legendary(level = 1, black = 0): PlayerState {
  const lifetime = LEGEND_THRESHOLD + legendFloor(level);
  const s = player(5_000_000, lifetime);
  s.legend = {
    ...s.legend,
    tableWins: 1,
    level,
    base: LEGEND_THRESHOLD,
    ascendedAt: T0,
    black,
    blackEarned: black,
  };
  // Paliers deja obtenus: leurs primes ne brouillent pas les soldes testes.
  for (const id of progressAchievements(s)) {
    s.achievements[id] = T0;
    s.perks.paidAchievements.push(id);
  }
  return s;
}

/** Graine gagnable pour la difficulte Normale. */
let solvable: number | null = null;
function solvableDraw(): number {
  if (solvable !== null) return solvable;
  const { drawCount, gentle } = findDifficulty('normal');
  for (let seed = 100000; seed < 100400; seed++) {
    const round = { seed: String(seed), drawCount, gentle } as Round;
    if (Array.isArray(findSolution(boardOf(round), 20_000))) {
      solvable = (seed - 100000 + 0.5) / 900000;
      return solvable;
    }
  }
  throw new Error('aucune donne gagnable trouvee');
}

function winAt(s: PlayerState, table: Round['table']) {
  const started = startRound(
    s,
    { kind: 'new', mode: 'gambling', difficulty: 'normal', table },
    ctx(T0, solvableDraw()),
  );
  const round = started.result.round;
  const solution = findSolution(boardOf(round), 20_000);
  if (!Array.isArray(solution)) throw new Error('donne non gagnable');
  const log: LogEntry[] = solution.map((move) => ({ t: 'move', move }));
  return {
    round,
    out: finishRound(
      started.state,
      { roundId: round.id, log, reason: 'win' },
      ctx(T0 + 90_000),
    ),
  };
}

describe('rang Legendaire: calculs', () => {
  it('fait correspondre renom et niveaux, sans fin', () => {
    expect(legendFloor(1)).toBe(0);
    expect(legendFloor(2)).toBe(200_000);
    expect(legendFloor(3)).toBe(500_000);
    for (const level of [1, 2, 3, 7, 25, 120]) {
      expect(legendLevelFor(legendFloor(level))).toBe(level);
      expect(legendLevelFor(legendFloor(level + 1) - 1)).toBe(level);
    }
    expect(legendLevelFor(-5)).toBe(1);
    const p = legendProgress(LEGEND_THRESHOLD + 300_000, {
      level: 2,
      base: LEGEND_THRESHOLD,
    });
    expect(p.into).toBe(100_000);
    expect(p.step).toBe(300_000);
  });

  it('ecrit les niveaux en chiffres romains', () => {
    expect(roman(1)).toBe('I');
    expect(roman(4)).toBe('IV');
    expect(roman(9)).toBe('IX');
    expect(roman(14)).toBe('XIV');
    expect(roman(2026)).toBe('MMXXVI');
  });

  it('verse plus de jetons noirs a mesure que le niveau monte', () => {
    expect(blackFor(4, 0)).toBe(0);
    expect(blackFor(4, 1)).toBe(4);
    expect(blackRate(11)).toBeCloseTo(2);
    expect(blackFor(4, 11)).toBe(8);
    expect(weeklyBlack(1)).toBe(0);
    expect(weeklyBlack(3)).toBeGreaterThan(weeklyBlack(2));
  });
});

describe('rang Legendaire: accession', () => {
  it('demande une victoire a la Table Legende en plus du million', () => {
    // Le million sans la table: rien.
    const rich = player(500_000, LEGEND_THRESHOLD - 1);
    const tx = new Tx(rich, ctx());
    tx.credit(10);
    const out = tx.done(null);
    expect(out.state.legend.level).toBe(0);
    expect(out.notices.some((n) => n.kind === 'legend')).toBe(false);

    // La table sans le million: la victoire est notee, sans accession.
    const early = winAt(player(500_000, 500_000), 'legend').out;
    expect(early.state.legend.tableWins).toBe(1);
    expect(early.state.legend.level).toBe(0);
    expect(early.result.outcome).toBe('win');
  });

  it('fait accéder au rang en gagnant a la Table Legende', () => {
    const s = player(500_000, LEGEND_THRESHOLD);
    const { out } = winAt(s, 'legend');
    const legend = out.state.legend;
    expect(legend.level).toBe(1);
    expect(legend.ascendedAt).toBe(T0 + 90_000);
    const ceremony = out.notices.find((n) => n.kind === 'legend');
    expect(ceremony?.title).toBe('Légendaire I');
    // Prime d'accession, puis les jetons noirs de la victoire elle-meme.
    if (out.result.outcome !== 'win') throw new Error('victoire attendue');
    const winBlack = BLACK_PER_WIN.normal + (BLACK_PER_TABLE.legend ?? 0);
    expect(out.result.win.black).toBe(winBlack);
    expect(legend.black).toBe(ASCENSION_GIFT + winBlack);
    expect(out.state.achievements['legend-1']).toBeGreaterThan(0);
  });

  it('accede aussi en franchissant le million apres avoir vaincu la table', () => {
    const s = player(500_000, LEGEND_THRESHOLD - 100);
    s.legend.tableWins = 2;
    const tx = new Tx(s, ctx());
    tx.credit(100);
    const out = tx.done(null);
    expect(out.state.legend.level).toBe(1);
    expect(out.state.legend.base).toBe(LEGEND_THRESHOLD);
  });
});

describe('rang Legendaire: niveaux et jetons noirs', () => {
  it('monte de niveau avec le renom et verse la prime', () => {
    const s = legendary(1);
    const tx = new Tx(s, ctx());
    tx.credit(legendFloor(3));
    const out = tx.done(null);
    expect(out.state.legend.level).toBe(3);
    expect(out.state.legend.black).toBe(levelReward(2) + levelReward(3));
    const notice = out.notices.find((n) => n.kind === 'level');
    expect(notice?.title).toBe('Légendaire III');
  });

  it('paie des jetons noirs en encaissant un gros magot', () => {
    const s = legendary(1);
    s.session.awaiting = 'decision';
    s.session.pot = 160_000;
    s.session.combo = 3;
    const out = decide(s, 'cash', ctx());
    expect(out.result.black).toBe(3);
    expect(out.state.legend.black).toBe(3);
  });

  it('ne donne rien en jetons noirs avant le rang Legendaire', () => {
    const s = player(100_000, 10_000);
    s.session.awaiting = 'decision';
    s.session.pot = 160_000;
    const out = decide(s, 'cash', ctx());
    expect(out.result.black).toBe(0);
    expect(out.state.legend.black).toBe(0);
  });

  it('ajoute un coffret noir chaque semaine a partir du niveau II', () => {
    const out = claimWeeklyGift(legendary(2), ctx());
    expect(out.result.black).toBe(weeklyBlack(2));
    expect(out.state.legend.black).toBe(weeklyBlack(2));
  });
});

describe('Boutique Legendaire et bureau de change', () => {
  it('offre le sceau et le titre a l accession', () => {
    const s = legendary(1);
    const out = equip(s, 'frame', 'cadre-legende', ctx());
    expect(out.state.equipped.frame).toBe('cadre-legende');
    expect(() => equip(player(0, 0), 'frame', 'cadre-legende', ctx())).toThrow(
      CoreError,
    );
  });

  it('vend en jetons noirs, au niveau requis seulement', () => {
    // Onyx: niveau I, 30 jetons noirs.
    expect(() => buyCosmetic(legendary(1, 10), 'onyx', ctx())).toThrow(
      /jetons noirs/,
    );
    const bought = buyCosmetic(legendary(1, 50), 'onyx', ctx());
    expect(bought.state.legend.black).toBe(20);
    expect(bought.state.wallet.balance).toBe(5_000_000);
    expect(bought.state.equipped.cardBack).toBe('onyx');
    // L'Ombre: niveau III.
    expect(() => buyCosmetic(legendary(2, 500), 'ombre', ctx())).toThrow(
      /niveau Légendaire/,
    );
    expect(() =>
      buyCosmetic(player(5_000_000, 900_000), 'onyx', ctx()),
    ).toThrow(CoreError);
  });

  it('change des jetons de la banque contre des jetons noirs', () => {
    const out = dispatch(legendary(1), { type: 'exchange', amount: 5 }, ctx());
    expect(out.state.legend.black).toBe(5);
    expect(out.state.wallet.balance).toBe(5_000_000 - 5 * EXCHANGE_RATE);
    expect(() =>
      dispatch(legendary(1), { type: 'exchange', amount: 3 }, ctx()),
    ).toThrow(CoreError);
    expect(() =>
      dispatch(player(5_000_000, 0), { type: 'exchange', amount: 1 }, ctx()),
    ).toThrow(/Légendaires/);
    const poor = legendary(1);
    poor.wallet.balance = EXCHANGE_RATE - 1;
    expect(() =>
      dispatch(poor, { type: 'exchange', amount: 1 }, ctx()),
    ).toThrow(/Pas assez/);
  });

  it('valide une demande de change venue du reseau', () => {
    expect(parseAction({ type: 'exchange', amount: 20 })).toEqual({
      type: 'exchange',
      amount: 20,
    });
    expect(() => parseAction({ type: 'exchange', amount: -1 })).toThrow();
    expect(() => parseAction({ type: 'exchange', amount: '5' })).toThrow();
  });

  it('reserve la Table Noire au niveau III', () => {
    const low = startRound(
      legendary(2),
      { kind: 'new', mode: 'gambling', difficulty: 'normal', table: 'noire' },
      ctx(),
    );
    expect(low.result.round.table).toBe('free');
    const high = startRound(
      legendary(3),
      { kind: 'new', mode: 'gambling', difficulty: 'normal', table: 'noire' },
      ctx(),
    );
    expect(high.result.round.table).toBe('noire');
    expect(high.state.session.pot).toBe(200_000);
  });
});

describe('rang Legendaire: sauvegardes', () => {
  it('ramene un niveau trafique a ce que le renom permet', () => {
    const raw = structuredClone(legendary(1, 40)) as unknown as Record<
      string,
      unknown
    >;
    (raw.legend as Record<string, unknown>).level = 99;
    const clean = sanitizePlayer(raw, initialPlayer(ctx()));
    expect(clean.legend.level).toBe(1);
    expect(clean.legend.black).toBe(40);

    const faked = player(0, 10_000) as unknown as Record<string, unknown>;
    faked.legend = { level: 8, tableWins: 0, black: 900 };
    expect(sanitizePlayer(faked, initialPlayer(ctx())).legend.level).toBe(0);
  });

  it('reprend une ancienne sauvegarde sans etat Legendaire', () => {
    const raw = structuredClone(player(0, 0)) as unknown as Record<
      string,
      unknown
    >;
    delete raw.legend;
    expect(sanitizePlayer(raw, initialPlayer(ctx())).legend.level).toBe(0);
  });

  it('plafonne les jetons noirs d une sauvegarde d invite importee', () => {
    const guest = legendary(1, 5000);
    const imported = importGuest(guest, initialPlayer(ctx()));
    expect(imported.legend.black).toBe(500);
    expect(imported.legend.level).toBe(1);
  });

  it('montre le niveau Legendaire sur la carte publique', () => {
    expect(publicCard('Ace', legendary(4)).legend).toBe(4);
    expect(publicCard('Ace', player(0, 0)).legend).toBe(0);
  });
});

describe('Boutique Legendaire: catalogue', () => {
  it('va jusqu au niveau XXX, en rayons complets de quatre', () => {
    const levels = LEGEND_COSMETICS.filter(
      (c) => !c.id.startsWith('atelier-'),
    ).map((c) => c.minLevel ?? 1);
    expect(Math.max(...levels)).toBe(30);
    // Rayons I-X, XI-XX, XXI-XXX: des rangees pleines a 2 et 4 colonnes.
    for (const [from, to] of [
      [1, 10],
      [11, 20],
      [21, 30],
    ]) {
      const n = levels.filter((l) => l >= from && l <= to).length;
      expect(n % 4).toBe(0);
    }
    const ids = new Set(COSMETICS.map((c) => c.id));
    expect(ids.size).toBe(COSMETICS.length);
  });
});

describe('Atelier (niveau L)', () => {
  const backConfig = {
    bg: 'retro',
    pattern: 'modern',
    medal: 'onyx',
    border: 'minimal',
  };

  it('reste ferme avant le niveau L', () => {
    const s = legendary(49);
    s.inventory.owned.push('onyx');
    expect(() =>
      dispatch(s, { type: 'atelier', slot: 'back', config: backConfig }, ctx()),
    ).toThrow(/niveau Légendaire L/);
  });

  it('compose avec des pieces possedees et equipe le resultat', () => {
    const s = legendary(50);
    s.inventory.owned.push('onyx');
    const out = dispatch(
      s,
      { type: 'atelier', slot: 'back', config: backConfig },
      ctx(),
    );
    expect(out.state.legend.atelier.back).toEqual(backConfig);
    expect(out.state.equipped.cardBack).toBe('atelier-back');
    // Une piece qu'on ne possede pas est refusee.
    expect(() =>
      dispatch(
        out.state,
        {
          type: 'atelier',
          slot: 'back',
          config: { ...backConfig, medal: 'triple7' },
        },
        ctx(),
      ),
    ).toThrow(/collection/);
    // Une piece d'une autre categorie aussi.
    expect(() =>
      dispatch(
        out.state,
        {
          type: 'atelier',
          slot: 'back',
          config: { ...backConfig, medal: 'felt' },
        },
        ctx(),
      ),
    ).toThrow(CoreError);
  });

  it('montre la composition aux amis sur la carte publique', () => {
    const s = legendary(50);
    s.inventory.owned.push('phenix', 'oracle');
    const out = dispatch(
      s,
      {
        type: 'atelier',
        slot: 'avatar',
        config: { scene: 'phenix', figure: 'oracle', fx: 'croupier' },
      },
      ctx(),
    );
    expect(publicCard('Ace', out.state).avatar).toBe(
      'atelier-avatar|phenix|oracle|croupier',
    );
  });

  it('valide une demande venue du reseau et une sauvegarde trafiquee', () => {
    expect(
      parseAction({
        type: 'atelier',
        slot: 'title',
        config: { plate: 'roi', text: 'rookie' },
      }),
    ).toEqual({
      type: 'atelier',
      slot: 'title',
      config: { plate: 'roi', text: 'rookie' },
    });
    expect(() =>
      parseAction({ type: 'atelier', slot: 'title', config: { plate: 'roi' } }),
    ).toThrow();
    const raw = structuredClone(legendary(50)) as unknown as Record<
      string,
      unknown
    >;
    (raw.legend as Record<string, unknown>).atelier = {
      title: { plate: 'roi', text: 'rookie' },
      back: backConfig,
    };
    const clean = sanitizePlayer(raw, initialPlayer(ctx()));
    // Le titre "roi" n'est pas possede: la composition est ecartee.
    expect(clean.legend.atelier.title).toBeUndefined();
    expect(clean.legend.atelier.back).toBeUndefined();
  });
});
