import { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID } from '../../lib/auth';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: 'popup' | 'redirect';
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill';
      width?: number;
      locale?: string;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise: Promise<void> | null = null;

/** Google Identity Services skriptini faqat kerak bo'lganda, bir marta yuklaydi. */
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        script.remove();
        reject(new Error('Google skripti yuklanmadi'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/**
 * Rasmiy "Google orqali davom etish" tugmasi. ID token `onCredential`ga beriladi —
 * backend uni `/auth/google` da tekshiradi (mobil ilova bilan bir xil kontrakt).
 * Client ID sozlanmagan bo'lsa hech narsa ko'rsatilmaydi.
 */
export function GoogleButton({
  onCredential,
  disabled = false,
}: {
  onCredential: (idToken: string) => void;
  disabled?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let active = true;
    loadGoogleScript()
      .then(() => {
        const host = hostRef.current;
        const api = window.google?.accounts?.id;
        if (!active || !host || !api) return;
        api.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: 'popup',
          callback: (response) => {
            if (response.credential) callbackRef.current(response.credential);
          },
        });
        host.replaceChildren();
        api.renderButton(host, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          locale: 'uz',
          // Google tugma eni 200–400px oralig'ida bo'lishi shart.
          width: Math.max(200, Math.min(400, Math.floor(host.offsetWidth))),
        });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;
  if (failed) {
    return (
      <p className="text-center text-xs text-gray-500">
        Google orqali kirish hozircha yuklanmadi. Email orqali davom eting.
      </p>
    );
  }

  return (
    <div
      ref={hostRef}
      className={`flex min-h-11 w-full justify-center ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      aria-busy={disabled}
    />
  );
}
