import { useEffect } from 'react';
import { AlertTriangle, Crown, ShieldCheck, Trophy } from 'lucide-react';
import { useMetaStore, type NoticeKind } from '../state/meta';
import { playSound } from '../audio/sfx';
import { LegendCeremony } from './LegendCeremony';
import { BlackChip } from './ui';

const ICON: Record<NoticeKind, JSX.Element> = {
  achievement: <Trophy size={20} />,
  vip: <Crown size={20} />,
  reward: <ShieldCheck size={20} />,
  error: <AlertTriangle size={20} />,
  legend: <Crown size={20} />,
  level: <BlackChip size={30} />,
};

const KICKER: Record<NoticeKind, string> = {
  achievement: 'Haut fait débloqué',
  vip: 'Promotion',
  reward: 'Bonne nouvelle',
  error: 'Attention',
  legend: 'Rang Légendaire',
  level: 'Niveau Légendaire',
};

/** Les erreurs restent plus longtemps: il faut le temps de les lire. */
const DURATION: Record<NoticeKind, number> = {
  achievement: 3400,
  vip: 3400,
  reward: 3400,
  error: 7000,
  legend: 0,
  level: 4200,
};

/** File de notifications: une a la fois, chacune pendant quelques secondes. */
export function Toaster() {
  const notices = useMetaStore((s) => s.notices);
  const consume = useMetaStore((s) => s.consumeNotice);
  const current = notices[0];

  useEffect(() => {
    // La ceremonie d'accession reste affichee jusqu'a ce qu'on la ferme.
    if (!current || current.kind === 'legend') return;
    if (current.kind !== 'error') {
      playSound(
        current.kind === 'vip' || current.kind === 'level'
          ? 'jackpot'
          : 'complete',
      );
    }
    const id = setTimeout(consume, DURATION[current.kind]);
    return () => clearTimeout(id);
  }, [current, consume]);

  if (current?.kind === 'legend') {
    return <LegendCeremony key={current.id} onClose={consume} />;
  }

  return (
    <div className="toaster" aria-live="polite">
      {current && (
        <div
          className="toast"
          key={current.id}
          data-kind={current.kind}
          role={current.kind === 'error' ? 'alert' : undefined}
          onClick={current.kind === 'error' ? consume : undefined}
          title={current.kind === 'error' ? 'Toucher pour fermer' : undefined}
        >
          <span className="toast__medal">{ICON[current.kind]}</span>
          <span className="toast__body">
            <span className="toast__kicker">{KICKER[current.kind]}</span>
            <span className="toast__title">{current.title}</span>
            <span className="toast__text">{current.text}</span>
          </span>
        </div>
      )}
    </div>
  );
}
