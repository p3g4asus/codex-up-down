export type ClientFeedbackKind = "success" | "error";

export type ClientFeedbackMessage = {
  kind: ClientFeedbackKind;
  message: string;
};

const FEEDBACK_EVENT_NAME = "inventory:feedback";

export function emitClientFeedback(feedback: ClientFeedbackMessage) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<ClientFeedbackMessage>(FEEDBACK_EVENT_NAME, { detail: feedback }));
}

export function subscribeClientFeedback(listener: (feedback: ClientFeedbackMessage) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<ClientFeedbackMessage>;
    if (!customEvent.detail?.message) {
      return;
    }

    listener(customEvent.detail);
  };

  window.addEventListener(FEEDBACK_EVENT_NAME, handler);
  return () => window.removeEventListener(FEEDBACK_EVENT_NAME, handler);
}
