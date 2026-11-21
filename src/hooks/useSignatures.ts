import { useEffect, useState } from 'react';
import { signatureFromDataUrl, signatureToDataUrl, type Signature } from '../lib/signature';
import { useStored } from './useStored';

const MINE_KEY = 'ot.signature';

/**
 * The requestor's and the supervisor's signatures.
 *
 * Yours is kept on this device only when "Remember my signature" is ticked;
 * unticking deletes it. The supervisor's lives only as long as the tab — see
 * lib/signature.ts for why.
 */
export function useSignatures() {
  const [prefs, setPrefs] = useStored('ot.signaturePrefs', { remember: false });
  const [mine, setMineState] = useState<Signature | null>(() => {
    if (!prefs.remember) return null;
    try {
      const stored = localStorage.getItem(MINE_KEY);
      return stored ? signatureFromDataUrl(stored) : null;
    } catch {
      return null;
    }
  });
  const [supervisor, setSupervisorState] = useState<Signature | null>(null);

  useEffect(() => {
    try {
      if (prefs.remember && mine) localStorage.setItem(MINE_KEY, signatureToDataUrl(mine));
      else localStorage.removeItem(MINE_KEY);
    } catch {
      // Not remembered; it still works for this visit.
    }
  }, [prefs.remember, mine]);

  // A replaced signature's thumbnail URL would otherwise hold its image in memory.
  const replacing = (current: Signature | null, set: (s: Signature | null) => void) => (next: Signature | null) => {
    if (current && current !== next) URL.revokeObjectURL(current.url);
    set(next);
  };

  return {
    mine,
    setMine: replacing(mine, setMineState),
    supervisor,
    setSupervisor: replacing(supervisor, setSupervisorState),
    remember: prefs.remember,
    setRemember: (remember: boolean) => setPrefs({ remember }),
  };
}
