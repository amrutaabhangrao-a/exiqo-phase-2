import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { GetStartedScreen } from "./GetStartedScreen";
import { IntroAuth, type AuthMode } from "./IntroAuth";
import { IntroStory } from "./IntroStory";
import { SplashScreen } from "./SplashScreen";

const BRAND_EASE = [0.22, 1, 0.36, 1] as const;

/**
 * localStorage flag — set to "true" once a user has finished splash + intro.
 * Returning visitors skip directly to /auth/signin.
 *
 * Reset with:  window.localStorage.removeItem("smartspend.seenIntro");
 */
export const SEEN_INTRO_KEY = "smartspend.seenIntro";

export type IntroStep = "splash" | "intro" | "get-started" | "auth";

export type IntroFlowProps = {
  /**
   * Called when the entire intro flow is finished. The orchestrator
   * (App.jsx) is then expected to render the dashboard / authed app.
   *
   * In the current state-based App.jsx setup this is wired so that
   * authentication itself unmounts the flow. We still call onComplete
   * so the flag flip happens immediately.
   */
  onComplete: () => void;
};

const SHIELD_LAYOUT_ID = "ssShieldMark";

function safeReadFlag(): boolean {
  try {
    return window.localStorage.getItem(SEEN_INTRO_KEY) === "true";
  } catch {
    return false;
  }
}

function safeWriteFlag() {
  try {
    window.localStorage.setItem(SEEN_INTRO_KEY, "true");
  } catch {
    /* ignore */
  }
}

/**
 * Top-level orchestrator for the intro flow.
 *
 * - First-time visitor:     splash → intro → get-started → auth → /dashboard
 * - Returning visitor:      auth (signin) → /dashboard
 * - "smartspend.seenIntro=true" persists between sessions in localStorage.
 *
 * Implements a tiny state-based "router" that mirrors the prompt's
 * routes (/splash, /intro, /get-started, /auth/signin, /auth/signup)
 * without adding react-router-dom as a dependency.
 */
export function IntroFlow({ onComplete }: IntroFlowProps) {
  const [step, setStep] = useState<IntroStep>(() => (safeReadFlag() ? "auth" : "splash"));
  const [authMode, setAuthMode] = useState<AuthMode>("signin");

  // Mark splash+intro complete once we leave the get-started screen for the first time.
  const markSeen = useCallback(() => {
    safeWriteFlag();
  }, []);

  // Go from splash to intro, persist flag once intro+splash were actually shown.
  const fromSplash = useCallback(() => {
    setStep("intro");
  }, []);

  const fromIntro = useCallback(() => {
    setStep("get-started");
  }, []);

  // Skip entire intro: jump straight to auth (signin).
  const skipToAuth = useCallback(
    (mode: AuthMode = "signin") => {
      markSeen();
      setAuthMode(mode);
      setStep("auth");
    },
    [markSeen]
  );

  const fromGetStartedToCreate = useCallback(() => {
    markSeen();
    setAuthMode("signup");
    setStep("auth");
  }, [markSeen]);

  const fromGetStartedToSignin = useCallback(() => {
    markSeen();
    setAuthMode("signin");
    setStep("auth");
  }, [markSeen]);

  const onAuthBack = useCallback(() => {
    setStep("get-started");
  }, []);

  const onAuthenticated = useCallback(() => {
    markSeen();
    onComplete();
  }, [markSeen, onComplete]);

  // Defensive: if the URL hash includes #signup or #signin, deep-link.
  useEffect(() => {
    const hash = (window.location.hash || "").toLowerCase();
    if (hash.includes("signup")) {
      setAuthMode("signup");
      setStep("auth");
    } else if (hash.includes("signin") || hash.includes("login")) {
      setAuthMode("signin");
      setStep("auth");
    }
  }, []);

  // NOTE: We intentionally use the default ("sync") AnimatePresence mode here
  // — not "wait" — because the splash → intro shield morph relies on both
  // ShieldMark components (sharing layoutId="ssShieldMark") being present
  // simultaneously during the transition so Framer Motion can FLIP between them.
  return (
    <AnimatePresence>
      {step === "splash" ? (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4, ease: BRAND_EASE } }}
        >
          <SplashScreen
            onComplete={fromSplash}
            onSkip={() => skipToAuth("signin")}
            shieldLayoutId={SHIELD_LAYOUT_ID}
          />
        </motion.div>
      ) : null}

      {step === "intro" ? (
        <motion.div
          key="intro"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.55, ease: BRAND_EASE } }}
          exit={{ opacity: 0, transition: { duration: 0.35, ease: BRAND_EASE } }}
        >
          <IntroStory
            onFinish={fromIntro}
            onSkip={() => skipToAuth("signin")}
            shieldLayoutId={SHIELD_LAYOUT_ID}
          />
        </motion.div>
      ) : null}

      {step === "get-started" ? (
        <motion.div
          key="get-started"
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{
            opacity: 1,
            scale: 1,
            transition: { duration: 0.55, ease: BRAND_EASE },
          }}
          exit={{ opacity: 0, transition: { duration: 0.35, ease: BRAND_EASE } }}
        >
          <GetStartedScreen
            onCreate={fromGetStartedToCreate}
            onSignIn={fromGetStartedToSignin}
            shieldLayoutId={SHIELD_LAYOUT_ID}
          />
        </motion.div>
      ) : null}

      {step === "auth" ? (
        <motion.div
          key="auth"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.55, ease: BRAND_EASE } }}
          exit={{ opacity: 0, transition: { duration: 0.35, ease: BRAND_EASE } }}
        >
          <IntroAuth
            initialMode={authMode}
            onAuthenticated={onAuthenticated}
            onBack={onAuthBack}
            shieldLayoutId={SHIELD_LAYOUT_ID}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default IntroFlow;
