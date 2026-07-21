import { useEffect } from 'react';
import { useMetaStore } from '../state/meta';
import { ACHIEVEMENTS } from '../state/achievements';
import { playSound } from '../audio/sfx';

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function Toaster() {
  const recent = useMetaStore((s) => s.recentUnlocks);
  const consume = useMetaStore((s) => s.consumeUnlock);

  useEffect(() => {
    if (recent.length === 0) return;
    playSound('foundation');
    const id = setTimeout(consume, 2800);
    return () => clearTimeout(id);
  }, [recent, consume]);

  if (recent.length === 0) return null;

  return (
    <div className="toaster" aria-live="polite">
      {recent.map((id, i) => {
        const a = BY_ID.get(id);
        if (!a) return null;
        return (
          <div className="toast" key={`${id}-${i}`}>
            <span className="medal">OK</span>
            <span>
              <span className="t">Haut fait: {a.title}</span>
              <br />
              <span className="s">{a.description}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
