import { useEffect, useState } from 'react';

export function getBreakpoint(width = typeof window !== 'undefined' ? window.innerWidth : 960) {
  if (width >= 960) return 'desktop';
  if (width >= 600) return 'tablet';
  return 'mobile';
}

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState(() => getBreakpoint());

  useEffect(() => {
    const update = () => setBreakpoint(getBreakpoint());
    const mqTablet = window.matchMedia('(min-width: 600px)');
    const mqDesktop = window.matchMedia('(min-width: 960px)');
    mqTablet.addEventListener('change', update);
    mqDesktop.addEventListener('change', update);
    update();
    return () => {
      mqTablet.removeEventListener('change', update);
      mqDesktop.removeEventListener('change', update);
    };
  }, []);

  return breakpoint;
}

export function useChartHeight(desktopHeight) {
  const breakpoint = useBreakpoint();
  if (breakpoint === 'mobile') return 220;
  if (breakpoint === 'tablet') return 260;
  return desktopHeight;
}
