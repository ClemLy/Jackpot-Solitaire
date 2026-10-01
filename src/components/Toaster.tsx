import { useEffect } from 'react';
import { Crown, ShieldCheck, Trophy } from 'lucide-react';
import { useMetaStore, type NoticeKind } from '../state/meta';
import { playSound } from '../audio/sfx';

const ICON: Record<NoticeKind, JSX.Element> = {
  achievement: <Trophy size={20} />,
  vip: <Crown size={20} />,
  reward: <ShieldCheck size={20} />,
};

const KICKER: Record<NoticeKind, string> = {
  achievement: 'Haut fait débloqué',
  vip: 'Promotion',
  reward: 'Bonne nouvelle',
};

/** File de notifications: une a la fois, chacune pendant quelques secondes. */
export function Toaster() {
  const notices = useMetaStore((s) => s.notices);
  const consume = useMetaStore((s) => s.consumeNotice);
  const current = notices[0];

  useEffect(() => {
    if (!current) return;
    playSound(current.kind === 'vip' ? 'jackpot' : 'complete');
    const id = setTimeout(consume, 3400);
    return () => clearTimeout(id);
  }, [current, consume]);

  return (
    <div className="toaster" aria-live="polite">
      {current && (
        <div className="toast" key={current.id} data-kind={current.kind}>
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
