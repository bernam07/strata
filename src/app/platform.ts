import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

export const isNative = Capacitor.isNativePlatform();
export const isAndroid = Capacitor.getPlatform() === 'android';
export const isIos =
  Capacitor.getPlatform() === 'ios' ||
  (typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)));
export const isWeb = !isNative;

/**
 * Initializes platform detection classes and native device listeners (Android status bar, back button).
 * Safe to call on web PWA, iOS, and Android.
 */
export const initPlatform = () => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  if (isAndroid) {
    root.classList.add('platform-android');
  } else if (isIos) {
    root.classList.add('platform-ios');
  }

  if (isWeb) {
    root.classList.add('platform-web');
  }

  if (isNative) {
    root.classList.add('platform-native');

    // On Android native app, style status bar and register hardware back button
    if (isAndroid) {
      StatusBar.setBackgroundColor({ color: '#0a0908' }).catch(() => undefined);
      StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);

      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          void App.exitApp();
        }
      });
    }
  }
};
