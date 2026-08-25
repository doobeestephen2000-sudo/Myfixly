/** A deterministic, always-available avatar for profiles without an upload. */
export function defaultAvatar(gender?: string | null) {
  const male = gender?.toLowerCase() === "male";
  const female = gender?.toLowerCase() === "female";
  const background = male ? "#dbeafe" : female ? "#fce7f3" : "#e5e7eb";
  const foreground = male ? "#1d4ed8" : female ? "#be185d" : "#4b5563";
  const label = male ? "M" : female ? "F" : "?";
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="${background}"/><circle cx="48" cy="36" r="17" fill="${foreground}" opacity=".9"/><path d="M18 88c3-20 15-30 30-30s27 10 30 30" fill="${foreground}" opacity=".9"/><text x="48" y="91" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="13" fill="white">${label}</text></svg>`)}`;
}

export function profileAvatar(profile?: { avatar_url?: string | null; gender?: string | null }) {
  return profile?.avatar_url || defaultAvatar(profile?.gender);
}
