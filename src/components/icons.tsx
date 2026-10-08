// Icones des bonus et jokers, partagees par la boutique, le plateau des
// jokers et le coffret de rang.

import type { ReactNode } from 'react';
import {
  Eye,
  LifeBuoy,
  ScanEye,
  Shield,
  Shuffle,
  WandSparkles,
} from 'lucide-react';
import type { ConsumableId } from '../state/catalog';

export function ConsumableIcon({
  id,
  size = 20,
}: {
  id: ConsumableId;
  size?: number;
}): ReactNode {
  switch (id) {
    case 'hint':
      return <Eye size={size} />;
    case 'insurance':
      return <Shield size={size} />;
    case 'redeal':
      return <LifeBuoy size={size} />;
    case 'peek':
      return <ScanEye size={size} />;
    case 'reshuffle':
      return <Shuffle size={size} />;
    case 'joker':
      return <WandSparkles size={size} />;
  }
}
