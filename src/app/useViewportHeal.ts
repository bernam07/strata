import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { isAndroid } from './platform';

const NON_TEXT_INPUTS = new Set([
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'range',
  'file',
  'color',
  'image',
  'hidden',
]);

const isEditableElement = (el: Element | null): boolean => {
  if (!(el instanceof HTMLElement) || !el.isConnected) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
    return !NON_TEXT_INPUTS.has(type);
  }
  return false;
};

/**
 * Fixes the iOS standalone PWA WebKit bug where opening and closing the software
 * keyboard shrinks the layout/visual viewport (~59px on iPhone 15 Pro) and leaves
 * a dead black bar underneath the bottom navigation bar.
 *
 * Layer 1: Toggles `display: none -> ''` with a synchronous reflow on `#app-shell`
 * (the sole `100dvh` container while `html, body, #root` have `height: auto`),
 * forcing WebKit's `LocalFrameView` to re-query the full `UIWindow` bounds.
 * Layer 2: If WebKit still reports a shrunk `window.innerHeight` after reflow,
 * sets `--app-height` and `--bottom-bar-offset` on `:root` to compensate the exact
 * pixel deficit.
 */
export const useViewportHeal = (
  shellRef: RefObject<HTMLElement | null>,
  scrollerRef: RefObject<HTMLElement | null>,
) => {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const maxVHRef = useRef<number>(
    typeof window !== 'undefined' ? window.innerHeight : 0,
  );
  const wasKbOpenRef = useRef(false);
  const isHealingRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const healViewport = useCallback(() => {
    if (typeof window === 'undefined' || isHealingRef.current) return;

    // Never interrupt while user is actively focused in an editable field
    if (isEditableElement(document.activeElement)) return;

    const vv = window.visualViewport;
    const currentHeight = Math.min(
      window.innerHeight,
      vv ? vv.height : window.innerHeight,
    );

    // Wait if keyboard is still physically open on screen
    if (maxVHRef.current > 0 && currentHeight < maxVHRef.current - 120) {
      return;
    }

    isHealingRef.current = true;
    try {
      // 1. Clamp any root/body/window scroll offset caused by iOS input focus panning
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      // Native Android (Xiaomi 15T) does not suffer from the WebKit standalone
      // viewport shrink bug; skip the DOM display toggle on Android.
      if (isAndroid) return;

      const rootStyle = document.documentElement.style;
      rootStyle.removeProperty('--app-height');
      rootStyle.removeProperty('--bottom-bar-offset');

      const shell = shellRef.current || document.getElementById('app-shell');
      const scroller = scrollerRef.current;
      const st = scroller ? scroller.scrollTop : 0;

      // 2. Collapse #app-shell (the 100dvh container) so document height drops to 0,
      // force synchronous layout reflow, and restore display so WebKit re-measures
      // the full UIWindow bounds.
      if (shell) {
        shell.style.display = 'none';
        void shell.offsetHeight;
        shell.style.display = '';
        void shell.offsetHeight;
      }

      // 3. Restore <main> scroll position and ensure window scroll is 0
      if (scroller && scroller.scrollTop !== st) {
        scroller.scrollTop = st;
      }
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }

      // 4. Fallback pixel compensation if WebKit still reports a shrunk innerHeight
      const shrink = Math.round(maxVHRef.current - window.innerHeight);
      if (shrink > 2 && shrink <= 120) {
        rootStyle.setProperty('--app-height', `${maxVHRef.current}px`);
        rootStyle.setProperty('--bottom-bar-offset', `${-shrink}px`);
      } else if (window.innerHeight > maxVHRef.current) {
        maxVHRef.current = window.innerHeight;
      }
    } finally {
      isHealingRef.current = false;
    }
  }, [shellRef, scrollerRef]);

  const scheduleHeal = useCallback(() => {
    if (typeof window === 'undefined' || isAndroid) return;
    clearTimers();
    // 140ms matches cederhook's post-blur timing; 320ms and 520ms cover full iOS spring dismissal
    const delays = [140, 320, 520];
    timersRef.current = delays.map((ms) => window.setTimeout(healViewport, ms));
  }, [clearTimers, healViewport]);

  // Track baseline max viewport height and keyboard open/close state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncViewportState = () => {
      if (isHealingRef.current) return;

      const vv = window.visualViewport;
      const h = Math.min(window.innerHeight, vv ? vv.height : window.innerHeight);

      if (maxVHRef.current === 0) {
        maxVHRef.current = window.innerHeight;
      }

      const isKb = maxVHRef.current > 0 && h < maxVHRef.current - 120;
      if (!isKb && !isEditableElement(document.activeElement)) {
        if (window.innerHeight > maxVHRef.current) {
          maxVHRef.current = window.innerHeight;
        }
      }

      setKeyboardOpen(isKb);

      // Trigger heal when keyboard transitions from open -> closed
      if (wasKbOpenRef.current && !isKb) {
        scheduleHeal();
      }
      wasKbOpenRef.current = isKb;
    };

    syncViewportState();
    window.addEventListener('resize', syncViewportState);
    window.visualViewport?.addEventListener('resize', syncViewportState);
    return () => {
      clearTimers();
      window.removeEventListener('resize', syncViewportState);
      window.visualViewport?.removeEventListener('resize', syncViewportState);
    };
  }, [clearTimers, scheduleHeal]);

  // Trigger on focusout globally whenever an input/textarea/select blurs
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

      scheduleHeal();
    };

    window.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('focusout', onFocusOut);
    };
  }, [scheduleHeal]);

  return { keyboardOpen, healViewport, scheduleHeal };
};
