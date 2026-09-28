import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { isAndroid, isIos, isNative } from './platform';

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
 * keyboard shrinks the layout/visual viewport (~59px on iPhone 15 Pro) and shifts
 * `position: fixed; bottom: 0` bars upward with a dead black bar underneath.
 *
 * Also provides accurate `keyboardOpen` state across iOS standalone PWA (where
 * `window.innerHeight` shrinks alongside `visualViewport.height`) and Android.
 */
export const useViewportHeal = (
  shellRef: RefObject<HTMLElement | null>,
  scrollerRef: RefObject<HTMLElement | null>,
) => {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const maxVHRef = useRef<number>(
    typeof window !== 'undefined'
      ? Math.max(window.innerHeight, window.visualViewport?.height ?? 0)
      : 0,
  );
  const hadInputSessionRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const healViewport = useCallback(() => {
    if (typeof window === 'undefined') return;

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

    // Always clamp root scroll offsets caused by iOS input focus panning
    if (window.scrollY !== 0 || window.scrollX !== 0) {
      window.scrollTo(0, 0);
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Native Android (e.g. Xiaomi 15T) does not suffer from the WebKit standalone
    // viewport shrink bug; skip the DOM display toggle on Android.
    if (isAndroid) return;

    const shell = shellRef.current || document.getElementById('app-shell');
    const root = document.getElementById('root');
    const bottomBar = document.getElementById('app-bottom-bar');
    const scroller = scrollerRef.current;
    const st = scroller ? scroller.scrollTop : 0;

    // 1. Touch viewport meta to nudge WebKit's UIProcess/WebProcess viewport sync
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      const content = viewportMeta.getAttribute('content');
      if (content) {
        viewportMeta.setAttribute('content', content);
      }
    }

    // 2. Collapse document height to 0 (html/body/#root have no min-height: 100dvh)
    // and force synchronous layout so WebKit's LocalFrameView::adjustViewSize()
    // queries UIWindow bounds and rebuilds the fixed bottom bar layer.
    if (bottomBar) bottomBar.style.display = 'none';
    if (shell) shell.style.display = 'none';
    if (root) root.style.display = 'none';

    void document.documentElement.offsetHeight;
    void document.body.offsetHeight;

    if (root) root.style.display = '';
    if (shell) {
      shell.style.display = '';
      void shell.offsetHeight;
    }
    if (bottomBar) {
      bottomBar.style.display = '';
      void bottomBar.offsetHeight;
    }
    void document.documentElement.offsetHeight;

    // 3. Restore <main> scroll position and ensure window scroll is 0
    if (scroller && scroller.scrollTop !== st) {
      scroller.scrollTop = st;
    }
    if (window.scrollY !== 0 || window.scrollX !== 0) {
      window.scrollTo(0, 0);
    }

    hadInputSessionRef.current = false;
  }, [shellRef, scrollerRef]);

  const scheduleHeal = useCallback(() => {
    if (typeof window === 'undefined' || isAndroid) return;
    clearTimers();
    // Cover the full iOS keyboard spring dismissal animation (~350-550ms)
    const delays = [60, 160, 300, 450, 650];
    timersRef.current = delays.map((ms) => window.setTimeout(healViewport, ms));
  }, [clearTimers, healViewport]);

  // Track baseline max viewport height and keyboard open/close state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncViewportState = () => {
      const vv = window.visualViewport;
      const h = Math.min(window.innerHeight, vv ? vv.height : window.innerHeight);
      const maxH = Math.max(
        window.innerHeight,
        vv ? vv.height : 0,
        isIos && !isNative && window.innerWidth < window.innerHeight
          ? window.screen?.height ?? 0
          : 0,
      );

      if (maxVHRef.current === 0) {
        maxVHRef.current = maxH;
      }

      const isKb = maxVHRef.current > 0 && h < maxVHRef.current - 120;
      if (!isKb && !isEditableElement(document.activeElement)) {
        maxVHRef.current = Math.max(maxVHRef.current, window.innerHeight, vv ? vv.height : 0);
      }

      if (isKb) {
        hadInputSessionRef.current = true;
      }

      setKeyboardOpen(isKb);

      // If keyboard just finished closing or viewport is still shrunk/offset, heal
      if (
        !isKb &&
        (hadInputSessionRef.current ||
          maxVHRef.current - window.innerHeight > 2 ||
          (vv && vv.offsetTop !== 0) ||
          window.scrollY !== 0)
      ) {
        scheduleHeal();
      }
    };

    syncViewportState();
    window.addEventListener('resize', syncViewportState);
    window.visualViewport?.addEventListener('resize', syncViewportState);
    window.visualViewport?.addEventListener('scroll', syncViewportState);
    return () => {
      clearTimers();
      window.removeEventListener('resize', syncViewportState);
      window.visualViewport?.removeEventListener('resize', syncViewportState);
      window.visualViewport?.removeEventListener('scroll', syncViewportState);
    };
  }, [clearTimers, scheduleHeal]);

  // Trigger on focusin / focusout globally for all inputs
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onFocusIn = (e: FocusEvent) => {
      if (isEditableElement(e.target as Element | null)) {
        hadInputSessionRef.current = true;
      }
    };

    const onFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;
      if (!isInput) return;

      hadInputSessionRef.current = true;
      scheduleHeal();
    };

    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
    };
  }, [scheduleHeal]);

  return { keyboardOpen, healViewport, scheduleHeal };
};
