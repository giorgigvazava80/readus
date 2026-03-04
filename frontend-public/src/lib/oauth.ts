const GOOGLE_OAUTH_STATE_KEY = "readus_google_oauth_state";
export const GOOGLE_OAUTH_SCOPE = "openid email profile https://www.googleapis.com/auth/user.birthday.read";

function randomState(bytes = 16): string {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const buffer = new Uint8Array(bytes);
    window.crypto.getRandomValues(buffer);
    return Array.from(buffer, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function createGoogleOAuthState(): string {
  const state = randomState();
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(GOOGLE_OAUTH_STATE_KEY, state);
  }
  return state;
}

export function consumeGoogleOAuthState(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const state = window.sessionStorage.getItem(GOOGLE_OAUTH_STATE_KEY) || "";
  window.sessionStorage.removeItem(GOOGLE_OAUTH_STATE_KEY);
  return state;
}
