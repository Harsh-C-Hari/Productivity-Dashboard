import { useEffect, useRef, useState } from "react";

// Minimal typing for the slice of the Google Identity Services API this
// component actually touches -- the full `google.accounts.id` surface is
// much larger, but there's no first-party @types package worth pulling in
// for four calls.
interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_black" | "filled_blue";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      width?: string;
    }
  ) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/** Renders Google's own "Continue with Google" button (via the Identity
 * Services script tag in index.html) and hands the resulting ID token
 * credential up to the caller -- which POSTs it to `/api/auth/google`
 * (see AuthContext.tsx's `loginWithGoogle`) rather than trusting anything
 * client-side.
 *
 * Renders nothing at all when `VITE_GOOGLE_CLIENT_ID` isn't set, so
 * deployments that haven't configured Google sign-in yet just don't show
 * the button (see frontend/.env.example). */
export function GoogleSignInButton({
  onCredential,
  disabled,
}: {
  onCredential: (idToken: string) => void;
  disabled?: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  // Google's rendered button is a fixed-pixel-width iframe -- it doesn't
  // stretch to fill its parent the way a normal button does. Previously
  // this was hardcoded to "336", which is narrower than the actual card
  // (~392-400px, see AuthShell's max-w-md + padding), so the button sat
  // flush left with a lopsided empty gap on the right instead of lining
  // up with the full-width "Sign in" button and inputs above it.
  // Measuring the wrapper and feeding that back in fixes both problems:
  // the button matches the form's actual width, and centering the
  // wrapper covers the (rare) case where Google renders slightly
  // narrower than requested.
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const clamp = (w: number) => Math.round(Math.min(400, Math.max(200, w)));
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(clamp(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The GIS script is loaded async/defer in index.html, so it may not be
  // on `window` yet by the time this component mounts -- poll briefly
  // rather than assuming it's already there.
  useEffect(() => {
    if (!CLIENT_ID) return;
    if (window.google?.accounts?.id) {
      setScriptReady(true);
      return;
    }
    const interval = window.setInterval(() => {
      if (window.google?.accounts?.id) {
        setScriptReady(true);
        window.clearInterval(interval);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!CLIENT_ID || !scriptReady || width === null || !containerRef.current || !window.google?.accounts?.id) {
      return;
    }

    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (response) => onCredential(response.credential),
    });
    // Clear before re-rendering: this effect re-runs if `width` changes
    // (e.g. window resize), and renderButton() appends a fresh iframe
    // each call rather than replacing the previous one.
    containerRef.current.replaceChildren();
    window.google.accounts.id.renderButton(containerRef.current, {
      theme: "filled_black",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: String(width),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, width]);

  if (!CLIENT_ID) return null;

  return (
    <div
      ref={wrapperRef}
      className={`flex w-full justify-center${disabled ? " pointer-events-none opacity-50" : ""}`}
      aria-disabled={disabled}
    >
      <div ref={containerRef} />
    </div>
  );
}
