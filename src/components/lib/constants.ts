import nigeriaLgas from "./nigeria-lgas.json";

export const NIGERIA_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT - Abuja", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara",
];

// Complete Nigerian administrative divisions (36 states, FCT, 774 LGAs).
// Registration stores the selected LGA in the existing mechanics.city field.
export const NIGERIA_LGAS = nigeriaLgas as Record<string, string[]>;

export function isValidNigeriaLga(state: string, lga: string): boolean {
  return NIGERIA_LGAS[state]?.includes(lga) ?? false;
}

export const TRADES = [
  { key: "generator_mechanic", label: "Generator Mechanic", icon: "zap" },
  { key: "plumber", label: "Plumber", icon: "droplet" },
  { key: "electrician", label: "Electrician", icon: "plug" },
  { key: "carpenter", label: "Carpenter", icon: "hammer" },
  { key: "ac_technician", label: "AC Technician", icon: "snowflake" },
  { key: "welder", label: "Welder", icon: "flame" },
  { key: "painter", label: "Painter", icon: "paintbrush" },
  { key: "tiler", label: "Tiler", icon: "grid" },
  { key: "bricklayer", label: "Bricklayer / Mason", icon: "brick" },
  { key: "cleaner", label: "Cleaner", icon: "sparkles" },
  { key: "roofer", label: "Roofer", icon: "home" },
  { key: "satellite_installer", label: "Satellite / CCTV Installer", icon: "satellite" },
  { key: "fridge_repair", label: "Fridge & Freezer Repair", icon: "refrigerator" },
  { key: "other", label: "Other Skilled Artisan", icon: "wrench" },
] as const;

export type TradeKey = (typeof TRADES)[number]["key"];

export function tradeLabel(key: string): string {
  return TRADES.find((t) => t.key === key)?.label ?? "Skilled Artisan";
}

// `other_skill` is customer-facing only for the catch-all trade. Keeping the
// original key preserves the predefined trade filters and registration flow.
export function artisanTradeLabel(trade: string, otherSkill?: string | null): string {
  return trade === "other" && otherSkill?.trim() ? otherSkill.trim() : tradeLabel(trade);
}

export const GENERATOR_BRANDS = [
  "Honda", "Yamaha", "Elepaq", "Sumec Firman", "Tiger", "Lutian", "Perkins",
  "Cummins", "Caterpillar", "Mikano", "FG Wilson", "Kipor", "Senci", "Thermocool",
  "Haier", "Elemax", "Kohler", "Deutz", "Volvo", "Other",
];

export const SERVICES = [
  { key: "repair", label: "Repair", icon: "wrench" },
  { key: "installation", label: "Installation", icon: "plug" },
  { key: "maintenance", label: "Maintenance", icon: "cog" },
  { key: "servicing", label: "Servicing", icon: "sparkles" },
] as const;

export type ServiceKey = (typeof SERVICES)[number]["key"];

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

// Columns of public.mechanics that are safe to expose to anon/authenticated reads.
// The `email` and `id_document_url` columns are intentionally excluded and only
// available to owners/admins via the get_mechanic_id_document RPC or the
// authenticated dashboard views.
export const MECHANIC_PUBLIC_COLUMNS =
  "id,user_id,full_name,business_name,profile_picture_url,state,city,area,years_experience,brands,services,bio,status,availability,verified,paid,featured,rating_avg,rating_count,trade,other_skill,created_at,updated_at";
