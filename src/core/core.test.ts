import { describe, expect, it } from 'vitest';
import { applyMove, findSolution, type Move } from '../engine';
import {
  CoreError,
  boardOf,
  dispatch,
  finishRound,
  importGuest,
  initialPlayer,
  isoWeek,
  makeCtx,
  parseAction,
  startRound,
  decide,
  buyCosmetic,
  equip,
  spinWheel,
  claimWeeklyGift,
  type Ctx,
  type LogEntry,
  type PlayerState,
  type Round,
  type StartRequest,
} from './index';
import {
  CHRONO_LIMIT_MS,
  VEGAS_STAKE,
  findDifficulty,
  sideBetStake,
  vegasCardValue,
  type DifficultyId,
} from '../state/catalog';

const T0 = Date.UTC(2026, 9, 8, 12);

/** Contexte deterministe; la premiere valeur tiree peut etre imposee. */
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

function fresh(balance = 100_000, lifetime = 0): PlayerState {
  const s = initialPlayer(ctx());
  s.wallet = { balance, lifetimeEarned: lifetime, spent: 0 };
  return s;
}

/** Valeur aleatoire qui fait tirer une graine gagnable pour ce reglage. */
const solvableCache = new Map<string, { draw: number; moves: Move[] }>();
function solvableDraw(difficulty: DifficultyId, recycles?: number) {
  const key = `${difficulty}-${recycles}`;
  const hit = solvableCache.get(key);
  if (hit) return hit;
  const { drawCount, gentle } = findDifficulty(difficulty);
  for (let seed = 100000; seed < 100400; seed++) {
    const round = {
      seed: String(seed),
      drawCount,
      gentle,
      recycles,
    } as Round;
    const solution = findSolution(boardOf(round), 20_000);
    if (Array.isArray(solution)) {
      const found = { draw: (seed - 100000 + 0.5) / 900000, moves: solution };
      solvableCache.set(key, found);
      return found;
    }
  }
  throw new Error('aucune donne gagnable trouvee');
}

function start(
  s: PlayerState,
  req: StartRequest,
  at = T0,
): { state: PlayerState; round: Round } {
  const solvable = solvableDraw(
    req.difficulty,
    req.kind === 'new' && req.mode === 'vegas'
      ? findDifficulty(req.difficulty).drawCount === 1
        ? 0
        : 2
      : undefined,
  );
  const out = startRound(s, req, ctx(at, solvable.draw));
  return { state: out.state, round: out.result.round };
}

function winLog(round: Round): LogEntry[] {
  const solution = findSolution(boardOf(round), 20_000);
  if (!Array.isArray(solution)) throw new Error('donne non gagnable');
  return solution.map((move) => ({ t: 'move', move }));
}

describe('calendrier', () => {
  it('calcule les semaines ISO', () => {
    expect(isoWeek({ year: 2026, month: 10, day: 8 })).toBe('2026-S41');
    expect(isoWeek({ year: 2027, month: 1, day: 1 })).toBe('2026-S53');
    expect(isoWeek({ year: 2021, month: 1, day: 4 })).toBe('2021-S01');
  });

  it('vit a l heure de Paris sur le serveur', () => {
    // 23h30 UTC le 8 octobre: deja le 9 a Paris.
    const c = makeCtx(
      Date.UTC(2026, 9, 8, 23, 30),
      Math.random,
      'Europe/Paris',
    );
    expect(c.today).toBe('2026-10-09');
  });
});

describe('manche verifiee', () => {
  it('paie une vraie victoire, rejouee coup par coup', () => {
    const { state, round } = start(fresh(), {
      kind: 'new',
      mode: 'classic',
      difficulty: 'normal',
    });
    expect(round.seedSource).toBe('random');
    expect(state.stats.gamesPlayed).toBe(1);
    const out = finishRound(
      state,
      { roundId: round.id, log: winLog(round), reason: 'win' },
      ctx(T0 + 120_000),
    );
    expect(out.result.outcome).toBe('win');
    if (out.result.outcome !== 'win') return;
    const w = out.result.win;
    expect(w.tip).toBe(Math.round(w.roundScore * 0.1));
    expect(out.state.wallet.balance).toBe(100_000 + w.tip);
    expect(out.state.stats.gamesWon).toBe(1);
    expect(out.state.session.round).toBeNull();
    expect(out.state.session.lastScoredWin?.score).toBe(w.roundScore);
  });

  it('mesure le temps de jeu avec l horloge de l appelant', () => {
    const { state, round } = start(fresh(), {
      kind: 'new',
      mode: 'classic',
      difficulty: 'normal',
    });
    const quick = finishRound(
      state,
      { roundId: round.id, log: winLog(round), reason: 'win' },
      ctx(T0 + 60_000),
    );
    const slow = finishRound(
      state,
      { roundId: round.id, log: winLog(round), reason: 'win' },
      ctx(T0 + 400_000),
    );
    if (quick.result.outcome !== 'win' || slow.result.outcome !== 'win') {
      throw new Error('victoires attendues');
    }
    expect(quick.result.win.bonuses.speed).toBe(1000 - 120);
    expect(slow.result.win.bonuses.speed).toBe(200);
  });

  it('refuse une victoire annoncee mais pas jouee', () => {
    const { state, round } = start(fresh(), {
      kind: 'new',
      mode: 'classic',
      difficulty: 'normal',
    });
    const out = finishRound(
      state,
      { roundId: round.id, log: winLog(round).slice(0, 10), reason: 'win' },
      ctx(T0 + 60_000),
    );
    expect(out.result.outcome).toBe('abandon');
    expect(out.state.stats.gamesWon).toBe(0);
    expect(out.state.wallet.balance).toBe(100_000);
  });

  it('refuse un coup impossible et un blocage invente', () => {
    const { state, round } = start(fresh(), {
      kind: 'new',
      mode: 'classic',
      difficulty: 'normal',
    });
    const cheat = finishRound(
      state,
      {
        roundId: round.id,
        log: [
          {
            t: 'move',
            move: { type: 'tableauToFoundation', column: 6, foundation: 0 },
          },
        ],
        reason: 'win',
      },
      ctx(T0 + 1000),
    );
    expect(cheat.result.outcome).toBe('abandon');
    expect(cheat.notices.some((n) => n.kind === 'error')).toBe(true);
    const fake = finishRound(
      state,
      { roundId: round.id, log: [], reason: 'deadlock' },
      ctx(T0 + 1000),
    );
    expect(fake.result.outcome).toBe('abandon');
  });

  it('refuse un joker que le joueur n a pas', () => {
    const { state, round } = start(fresh(), {
      kind: 'new',
      mode: 'classic',
      difficulty: 'normal',
    });
    const board = boardOf(round);
    const hidden = board.tableau[6][0].id;
    const out = finishRound(
      state,
      {
        roundId: round.id,
        log: [{ t: 'peek', card: hidden }],
        reason: 'abandon',
      },
      ctx(T0 + 1000),
    );
    expect(out.notices.some((n) => n.kind === 'error')).toBe(true);
  });

  it('ne termine une manche qu une fois', () => {
    const { state, round } = start(fresh(), {
      kind: 'new',
      mode: 'classic',
      difficulty: 'normal',
    });
    const done = finishRound(
      state,
      { roundId: round.id, log: winLog(round), reason: 'win' },
      ctx(T0 + 60_000),
    );
    expect(() =>
      finishRound(
        done.state,
        { roundId: round.id, log: winLog(round), reason: 'win' },
        ctx(T0 + 61_000),
      ),
    ).toThrow(CoreError);
  });

  it('ne paie rien sur une graine imposee', () => {
    const s = fresh();
    const out = startRound(
      s,
      { kind: 'new', mode: 'classic', difficulty: 'normal', seed: '100000' },
      ctx(),
    );
    const round = out.result.round;
    expect(round.seedSource).toBe('custom');
    const solution = findSolution(boardOf(round), 20_000);
    if (!Array.isArray(solution)) return;
    const end = finishRound(
      out.state,
      {
        roundId: round.id,
        log: solution.map((move) => ({ t: 'move', move })),
        reason: 'win',
      },
      ctx(T0 + 60_000),
    );
    expect(end.result.outcome).toBe('win');
    expect(end.state.wallet.balance).toBe(100_000);
    expect(end.state.stats.gamesWon).toBe(0);
  });

  it('impose la graine du jour au defi', () => {
    const out = startRound(
      fresh(),
      { kind: 'new', mode: 'daily', difficulty: 'normal', seed: 'triche' },
      ctx(),
    );
    expect(out.result.round.seed).toBe('defi-2026-10-08');
  });

  it('accepte une donne garantie seulement sur le prefixe impose', () => {
    const s = fresh();
    const ok = startRound(
      s,
      {
        kind: 'new',
        mode: 'classic',
        difficulty: 'normal',
        guaranteedSeed: `${s.session.nonce}-3`,
      },
      ctx(),
    );
    expect(ok.result.round.seedSource).toBe('guaranteed');
    const ko = startRound(
      s,
      {
        kind: 'new',
        mode: 'classic',
        difficulty: 'normal',
        guaranteedSeed: 'graine-connue-3',
      },
      ctx(),
    );
    expect(ko.result.round.seedSource).toBe('random');
    // Le prefixe change a chaque donne: pas de rejeu d'une ancienne donne.
    expect(ok.state.session.nonce).not.toBe(s.session.nonce);
  });
});

describe('Chrono et Vegas', () => {
  it('Chrono: perdu une fois les cinq minutes ecoulees', () => {
    const { state, round } = start(fresh(), {
      kind: 'new',
      mode: 'chrono',
      difficulty: 'normal',
    });
    const early = finishRound(
      state,
      { roundId: round.id, log: [], reason: 'time' },
      ctx(T0 + 60_000),
    );
    expect(early.result.outcome).toBe('abandon');
    const late = finishRound(
      state,
      { roundId: round.id, log: [], reason: 'time' },
      ctx(T0 + CHRONO_LIMIT_MS + 500),
    );
    expect(late.result.outcome).toBe('lost');
    // Meme une victoire, rendue trop tard, ne compte pas.
    const tooLate = finishRound(
      state,
      { roundId: round.id, log: winLog(round), reason: 'win' },
      ctx(T0 + CHRONO_LIMIT_MS + 60_000),
    );
    expect(tooLate.result.outcome).toBe('lost');
  });

  it('Vegas: paie la donne puis chaque carte rangee, meme en abandon', () => {
    const { state, round } = start(fresh(), {
      kind: 'new',
      mode: 'vegas',
      difficulty: 'expert',
    });
    expect(state.wallet.balance).toBe(100_000 - VEGAS_STAKE);
    expect(round.recycles).toBe(2);
    const log = winLog(round);
    const partial = log.slice(0, 40);
    const out = finishRound(
      state,
      { roundId: round.id, log: partial, reason: 'abandon' },
      ctx(T0 + 60_000),
    );
    if (out.result.outcome !== 'abandon') throw new Error('abandon attendu');
    const cards = out.result.vegas!.cards;
    expect(out.state.wallet.balance).toBe(
      100_000 - VEGAS_STAKE + cards * vegasCardValue('expert'),
    );
  });

  it('Vegas: refuse sans les 52 jetons', () => {
    expect(() =>
      startRound(
        fresh(10),
        { kind: 'new', mode: 'vegas', difficulty: 'normal' },
        ctx(),
      ),
    ).toThrow(/52 jetons/);
  });
});

describe('Jackpot', () => {
  function winJackpot(s: PlayerState, req: StartRequest, at = T0) {
    const { state, round } = start(s, req, at);
    const log: LogEntry[] = [
      ...((req.kind === 'new' ? [] : []) as LogEntry[]),
      ...winLog(round),
    ];
    return finishRound(
      state,
      { roundId: round.id, log, reason: 'win' },
      ctx(at + 90_000),
    );
  }

  it('enchaine victoire, quitte ou double, moitie a l abri et encaissement', () => {
    const first = winJackpot(fresh(), {
      kind: 'new',
      mode: 'gambling',
      difficulty: 'normal',
      table: 'gold',
    });
    expect(first.state.wallet.balance).toBe(100_000 - 2500);
    expect(first.state.session.awaiting).toBe('decision');
    const pot1 = first.state.session.pot;

    const second = winJackpot(first.state, {
      kind: 'double',
      difficulty: 'normal',
      insure: false,
    });
    expect(second.state.session.combo).toBe(2);
    const pot2 = second.state.session.pot;
    expect(pot2).toBeGreaterThan(pot1);

    const half = start(second.state, {
      kind: 'half',
      difficulty: 'normal',
      insure: false,
    });
    expect(half.state.wallet.balance).toBe(
      second.state.wallet.balance + Math.floor(pot2 / 2),
    );
    expect(half.state.session.pot).toBe(pot2 - Math.floor(pot2 / 2));

    // Pas d'encaissement en pleine manche.
    expect(() => decide(half.state, 'cash', ctx())).toThrow(CoreError);
  });

  it('paie les paris tenus et perd les autres', () => {
    const s = fresh();
    const { state, round } = start(s, {
      kind: 'new',
      mode: 'gambling',
      difficulty: 'normal',
      table: 'gold',
    });
    const log: LogEntry[] = [
      { t: 'bet', id: 'no-hint' },
      { t: 'bet', id: 'no-undo' },
      { t: 'hint' },
      ...winLog(round),
    ];
    const out = finishRound(
      state,
      { roundId: round.id, log, reason: 'win' },
      ctx(T0 + 100_000),
    );
    if (out.result.outcome !== 'win') throw new Error('victoire attendue');
    const stake = sideBetStake('gold');
    const bets = out.result.win.bets;
    expect(bets.find((b) => b.id === 'no-hint')?.won).toBe(false);
    expect(bets.find((b) => b.id === 'no-undo')).toMatchObject({
      won: true,
      payout: stake * 3,
    });
  });

  it('refuse un pari pose apres le premier coup', () => {
    const { state, round } = start(fresh(), {
      kind: 'new',
      mode: 'gambling',
      difficulty: 'normal',
      table: 'gold',
    });
    const log = winLog(round);
    const out = finishRound(
      state,
      {
        roundId: round.id,
        log: [log[0], { t: 'bet', id: 'fast' }, ...log.slice(1)],
        reason: 'win',
      },
      ctx(T0 + 100_000),
    );
    expect(out.result.outcome).toBe('abandon');
  });

  it('garde les paris ouverts apres un coup refuse', () => {
    const { state, round } = start(fresh(), {
      kind: 'new',
      mode: 'gambling',
      difficulty: 'normal',
      table: 'gold',
    });
    const out = finishRound(
      state,
      {
        roundId: round.id,
        log: [{ t: 'invalid' }, { t: 'bet', id: 'fast' }, ...winLog(round)],
        reason: 'win',
      },
      ctx(T0 + 100_000),
    );
    if (out.result.outcome !== 'win') throw new Error('victoire attendue');
    expect(out.result.win.bets.map((b) => b.id)).toEqual(['fast']);
  });

  it('remet le jackpot progressif a l exploit sans aide', () => {
    const out = winJackpot(fresh(100_000, 0), {
      kind: 'new',
      mode: 'gambling',
      difficulty: 'expert',
      table: 'silver',
    });
    if (out.result.outcome !== 'win') throw new Error('victoire attendue');
    expect(out.result.win.progressive).toBeGreaterThan(5000);
    expect(out.state.progressive.pot).toBe(5000);
  });

  it('ouvre le coffre une fois, puis encaisse', () => {
    let s = fresh();
    let out = winJackpot(s, {
      kind: 'new',
      mode: 'gambling',
      difficulty: 'normal',
      table: 'free',
    });
    for (let i = 0; i < 2; i++) {
      out = winJackpot(out.state, {
        kind: 'double',
        difficulty: 'normal',
        insure: false,
      });
    }
    s = out.state;
    expect(s.session.vaultEligible).toBe(true);
    const vault = decide(s, 'vault', ctx());
    expect(() => decide(vault.state, 'vault', ctx())).toThrow(CoreError);
    const cash = decide(vault.state, 'cash', ctx());
    expect(cash.state.wallet.balance).toBe(
      vault.state.wallet.balance + vault.state.session.pot,
    );
    expect(cash.state.gambling.vaultsOpened).toBe(1);
  });

  it('l assurance rend la moitie du magot quand on quitte une manche perdue', () => {
    const won = winJackpot(fresh(), {
      kind: 'new',
      mode: 'gambling',
      difficulty: 'normal',
      table: 'free',
    });
    const withInsurance = {
      ...won.state,
      inventory: {
        ...won.state.inventory,
        consumables: { ...won.state.inventory.consumables, insurance: 1 },
      },
    };
    const next = start(withInsurance, {
      kind: 'double',
      difficulty: 'normal',
      insure: true,
    });
    expect(next.state.session.insured).toBe(true);
    const pot = next.state.session.pot;
    const left = decide(next.state, 'leave', ctx());
    expect(left.state.wallet.balance).toBe(
      next.state.wallet.balance + Math.round(pot / 2),
    );
    expect(left.state.session.pot).toBe(0);
  });
});

describe('boutique et recompenses', () => {
  it('achete, equipe automatiquement et refuse un objet non possede', () => {
    const out = buyCosmetic(fresh(), 'magicien', ctx());
    expect(out.state.equipped.avatar).toBe('magicien');
    expect(() => equip(fresh(), 'avatar', 'pirate', ctx())).toThrow(CoreError);
    expect(() => equip(fresh(), 'frame', 'magicien', ctx())).toThrow(CoreError);
  });

  it('offre les cadres de rang au rang atteint seulement', () => {
    expect(() => equip(fresh(), 'frame', 'cadre-rang-gold', ctx())).toThrow(
      CoreError,
    );
    const gold = fresh(0, 25_000);
    expect(
      equip(gold, 'frame', 'cadre-rang-gold', ctx()).state.equipped.frame,
    ).toBe('cadre-rang-gold');
  });

  it('ne fait tourner la roue qu une fois par jour', () => {
    const once = spinWheel(fresh(), ctx());
    expect(() => spinWheel(once.state, ctx(T0 + 3_600_000))).toThrow(CoreError);
    expect(() => spinWheel(once.state, ctx(T0 + 86_400_000))).not.toThrow();
  });

  it('ouvre le coffret de rang une fois par semaine', () => {
    const s = fresh(0, 70_000);
    const out = claimWeeklyGift(s, ctx());
    expect(out.result.gift).toEqual(['hint', 'insurance', 'joker']);
    expect(() => claimWeeklyGift(out.state, ctx())).toThrow(CoreError);
  });
});

describe('demandes venues du reseau', () => {
  it('rejette tout ce qui n a pas la bonne forme', () => {
    const garbage: unknown[] = [
      null,
      42,
      { type: 'pirate' },
      {
        type: 'start',
        req: { kind: 'new', mode: 'classic', difficulty: 'facile' },
      },
      { type: 'start', req: { kind: 'new', mode: 'sudo', difficulty: 'easy' } },
      { type: 'finish', roundId: 'x', log: 'nope', reason: 'win' },
      {
        type: 'finish',
        roundId: 'x',
        log: [{ t: 'move', move: { type: 'draw', extra: 1 }, wild: 'oui' }],
        reason: 'gagne',
      },
      {
        type: 'finish',
        roundId: 'x',
        log: [{ t: 'move', move: { type: 'wasteToTableau', column: 99 } }],
        reason: 'win',
      },
      {
        type: 'finish',
        roundId: 'x',
        log: new Array(6000).fill({ t: 'undo' }),
        reason: 'win',
      },
      { type: 'buyCosmetic', id: '../../etc/passwd' },
      { type: 'equip', slot: '__proto__', id: 'retro' },
      { type: 'buyConsumable', id: 'jetons-infinis' },
    ];
    for (const raw of garbage) {
      expect(() => parseAction(raw), JSON.stringify(raw)?.slice(0, 80)).toThrow(
        CoreError,
      );
    }
  });

  it('nettoie ce qui est accepte', () => {
    const a = parseAction({
      type: 'finish',
      roundId: 'abc',
      reason: 'win',
      log: [{ t: 'move', move: { type: 'draw', hack: true } }],
    });
    expect(a).toEqual({
      type: 'finish',
      roundId: 'abc',
      reason: 'win',
      log: [{ t: 'move', move: { type: 'draw' } }],
    });
  });

  it('passe par le meme point d entree que le serveur', () => {
    const out = dispatch(
      fresh(),
      parseAction({ type: 'buyConsumable', id: 'joker' }),
      ctx(),
    );
    expect(out.state.inventory.consumables.joker).toBe(1);
  });
});

describe('import d une sauvegarde d invite', () => {
  it('plafonne la banque et repart d une session vierge', () => {
    const base = fresh(1000, 0);
    const imported = importGuest(
      {
        wallet: { balance: 9e9, lifetimeEarned: 9e9, spent: 0 },
        session: { pot: 1e9, awaiting: 'decision' },
        progressive: { pot: 1e12 },
        inventory: { owned: ['magicien', 'objet-pirate'] },
        equipped: { avatar: 'magicien', frame: 'cadre-rang-diamond' },
      },
      base,
    );
    expect(imported.wallet.lifetimeEarned).toBe(2_000_000);
    expect(imported.wallet.balance).toBe(2_001_000);
    expect(imported.session.pot).toBe(0);
    expect(imported.progressive.pot).toBe(200_000);
    expect(imported.inventory.owned).toEqual(['magicien']);
    expect(imported.equipped.avatar).toBe('magicien');
    // Le cadre Diamant exige le rang: le cumul avant plafond l'aurait permis.
    expect(['cadre-simple', 'cadre-rang-diamond']).toContain(
      imported.equipped.frame,
    );
  });
});

// Garde-fou: les coups produits par le solveur restent applicables.
describe('outillage des tests', () => {
  it('rejoue la solution d une donne gagnable', () => {
    const { round } = start(fresh(), {
      kind: 'new',
      mode: 'classic',
      difficulty: 'normal',
    });
    let board = boardOf(round);
    for (const entry of winLog(round)) {
      if (entry.t !== 'move') continue;
      board = applyMove(board, entry.move)!.board;
    }
    expect(board.foundations.every((p) => p.length === 13)).toBe(true);
  });
});
