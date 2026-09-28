import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

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
 * Tracks virtual keyboard visibility and resets any root window/document scroll
 * offset caused by iOS input focus panning when the keyboard closes.
 *
 * Paired with `100lvh` / `height: 100%` on `html, body, #root, #app-shell`
 * (instead of `100dvh`, which gets stuck at a shrunk height in iOS standalone PWAs).
 */
export const useViewportHeal = (
  _shellRef: RefObject<HTMLElement | null>,
  _scrollerRef: RefObject<HTMLElement | null>,
) => {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const maxVHRef = useRef<number>(
    typeof window !== 'undefined' ? window.innerHeight : 0,
  );
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const healViewport = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (isEditableElement(document.activeElement)) return;

    if (window.scrollY !== 0 || window.scrollX !== 0) {
      window.scrollTo(0, 0);
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const scheduleHeal = useCallback(() => {
    if (typeof window === 'undefined') return;
    clearTimers();
    const delays = [80, 220, 400];
    timersRef.current = delays.map((ms) => window.setTimeout(healViewport, ms));
  }, [clearTimers, healViewport]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncViewportState = () => {
      const vv = window.visualViewport;
      const h = Math.min(window.innerHeight, vv ? vv.height : window.innerHeight);

      if (window.innerHeight > maxVHRef.current) {
        maxVHRef.current = window.innerHeight;
      }

      const isKb = maxVHRef.current > 0 && h < maxVHRef.current - 120;
      setKeyboardOpen(isKb);

      if (!isKb) {
        healViewport();
      }
    };

    syncViewportState();
    window.addEventListener('resize', syncViewportState);
    window.visualViewport?.addEventListener('resize', syncViewportState);
    return () => {
      clearTimers();
      window.removeEventListener('resize', syncViewportState);
      window.visualViewport?.removeEventListener('resize', syncViewportState);
    };
  }, [clearTimers, healViewport]);

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

