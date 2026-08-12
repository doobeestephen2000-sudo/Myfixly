export function normalizeNigerianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return "234" + digits.slice(1);
  if (digits.length === 10) return "234" + digits;
  return digits;
}

export function whatsappLink(phone: string, message?: string): string {
  const n = normalizeNigerianPhone(phone);
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${n}${text}`;
}

export function telLink(phone: string): string {
  return `tel:+${normalizeNigerianPhone(phone)}`;
}

export function googleMapsLink(lat: number | null, lng: number | null, fallbackAddress?: string): string {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  if (fallbackAddress) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackAddress)}`;
  }
  return "https://maps.google.com";
}
