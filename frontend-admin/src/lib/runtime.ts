function parseHosts(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminAppHost(): boolean {
  const mode = (import.meta.env.VITE_APP_MODE || "").toLowerCase();
  if (mode === "admin") {
    return true;
  }
  if (mode === "user") {
    return false;
  }

  const host = window.location.hostname.toLowerCase();
  if (host.startsWith("admin.")) {
    return true;
  }

  const adminHosts = parseHosts(import.meta.env.VITE_ADMIN_APP_HOSTS);
  if (adminHosts.includes(host)) {
    return true;
  }

  return false;
}

export function isUserAppHost(): boolean {
  return !isAdminAppHost();
}
