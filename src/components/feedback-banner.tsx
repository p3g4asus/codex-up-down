type FeedbackBannerProps = {
  kind?: string;
  message?: string;
};

const styles = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
} as const;

export function FeedbackBanner({ kind, message }: FeedbackBannerProps) {
  if (!kind || !message) {
    return null;
  }

  const tone = kind === "success" ? styles.success : styles.error;

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm ${tone}`}>
      {message}
    </div>
  );
}
