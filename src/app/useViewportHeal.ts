import { useEffect, useRef, type RefObject } from 'react';

/**
 * Fixes a notorious iOS standalone PWA bug (WebKit) where opening the virtual keyboard
 * permanently shrinks the visual/layout viewport and leaves a dead black strip (~59px)
 * at the bottom of the screen that doesn't disappear when the keyboard closes.
 *
 * Forcing a synchronous layout re-measure (toggling display on a 100dvh root element)
 * forces WebKit to query the UIWindow bounds and restore the true viewport height.
 */
export const useViewportHeal = (
  shellRef: RefObject<HTMLElement | null>,
  scrollerRef: RefObject<HTMLElement | null>,
  keyboardOpen: boolean,
) => {
  const maxVHRef = useRef<number>(
    typeof window !== 'undefined' ? window.innerHeight : 0,
  );

  // Track the maximum height seen when keyboard is not open
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onResize = () => {
      const vv = window.visualViewport;
      const isKb = vv ? vv.height < maxVHRef.current - 120 : false;
      if (!isKb) {
        maxVHRef.current = Math.max(maxVHRef.current, window.innerHeight);
      }
    };

    onResize();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, []);

  const healViewport = () => {
    if (typeof window === 'undefined') return;

    // Don't heal if an editable input is currently focused (user is still typing)
    const active = document.activeElement as HTMLElement | null;
    const isTyping =
      active &&
      (active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.tagName === 'SELECT' ||
        active.isContentEditable);
    if (isTyping) return;

    // Don't heal if keyboard is still physically open on screen
    const vv = window.visualViewport;
    if (vv && maxVHRef.current > 0 && vv.height < maxVHRef.current - 150) {
      return;
    }

    // Only heal if the viewport is actually stuck/shrunk
    if (maxVHRef.current - window.innerHeight <= 4) {
      return;
    }

    const shell = shellRef.current || document.getElementById('app-shell');
    const scroller = scrollerRef.current;
    const st = scroller ? scroller.scrollTop : 0;

    if (shell) {
      shell.style.display = 'none';
      void shell.offsetHeight;
      shell.style.display = '';
    }

    if (scroller) {
      scroller.scrollTop = st;
    }

    if (window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }
  };

  // 1. Trigger when keyboard closes (keyboardOpen goes from true to false)
  const prevKeyboardOpen = useRef(false);
  useEffect(() => {
    if (prevKeyboardOpen.current && !keyboardOpen) {
      const t1 = setTimeout(healViewport, 140);
      const t2 = setTimeout(healViewport, 320);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    prevKeyboardOpen.current = keyboardOpen;
  }, [keyboardOpen]);

  // 2. Trigger on focusout globally (whenever an input/textarea blurs)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;
      if (!isInput) return;

      setTimeout(healViewport, 140);
      setTimeout(healViewport, 320);
    };

    window.addEventListener('focusout', onFocusOut);
    return () => window.removeEventListener('focusout', onFocusOut);
  }, []);

  return { healViewport };
};
