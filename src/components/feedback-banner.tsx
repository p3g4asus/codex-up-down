"use client";

import { useEffect, useState } from "react";

import { subscribeClientFeedback, type ClientFeedbackKind } from "@/lib/client-feedback";

type FeedbackBannerProps = {
  kind?: string;
  message?: string;
};

const styles = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
} as const;

const FEEDBACK_AUTO_HIDE_MS = 4500;
const FEEDBACK_FADE_OUT_MS = 250;

export function FeedbackBanner({ kind, message }: FeedbackBannerProps) {
  const [feedback, setFeedback] = useState<{ kind: ClientFeedbackKind; message: string } | null>(
    kind && message
      ? { kind: kind === "success" ? "success" : "error", message }
      : null,
  );
  const [isVisible, setIsVisible] = useState(Boolean(kind && message));

  useEffect(() => {
    if (kind && message) {
      setFeedback({ kind: kind === "success" ? "success" : "error", message });
      setIsVisible(true);
    }
  }, [kind, message]);

  useEffect(() => {
    return subscribeClientFeedback((nextFeedback) => {
      setFeedback(nextFeedback);
      setIsVisible(true);
    });
  }, []);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const hideTimer = window.setTimeout(() => {
      setIsVisible(false);
    }, FEEDBACK_AUTO_HIDE_MS);

    return () => window.clearTimeout(hideTimer);
  }, [feedback]);

  useEffect(() => {
    if (!feedback || isVisible) {
      return;
    }

    const clearTimer = window.setTimeout(() => {
      setFeedback(null);
    }, FEEDBACK_FADE_OUT_MS);

    return () => window.clearTimeout(clearTimer);
  }, [feedback, isVisible]);

  if (!feedback) {
    return null;
  }

  const tone = feedback.kind === "success" ? styles.success : styles.error;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm transition-all duration-300 ${tone} ${
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
      }`}
    >
      <p>{feedback.message}</p>
      <button
        type="button"
        aria-label="Chiudi messaggio"
        onClick={() => setIsVisible(false)}
        className="rounded-full border border-current/25 px-2 py-0.5 text-xs font-semibold opacity-80 transition hover:opacity-100"
      >
        Chiudi
      </button>
    </div>
  );
}
