import data from "@/data/terms.json";

export type Category = "pmbus" | "number" | "pwm" | "adc" | "control" | "converter" | "architecture";

export type ArchGroup = "topology" | "system" | "control";

export interface Bilingual<T> {
  en: T;
  zh: T;
}

export interface Term {
  id: string;
  term: string;
  zhTerm: string;
  category: Category;
  en: string;
  zh: string;
  formula?: string;
  archGroup?: ArchGroup;
  digital?: Bilingual<string>;
  pros?: Bilingual<string[]>;
  cons?: Bilingual<string[]>;
  related?: string[];
  calc?: string;
  sources?: { title: string; url: string }[];
}

export const terms = data as Term[];

export const categories: Record<Category, { en: string; zh: string }> = {
  pmbus: { en: "PMBus", zh: "PMBus" },
  number: { en: "Number formats", zh: "數值格式" },
  pwm: { en: "PWM", zh: "PWM" },
  adc: { en: "ADC", zh: "ADC" },
  control: { en: "Control loop", zh: "控制迴路" },
  converter: { en: "Converter basics", zh: "轉換器基礎" },
  architecture: { en: "Architecture", zh: "電源架構" },
};

export const architectures = (group: ArchGroup) =>
  terms.filter((t) => t.category === "architecture" && t.archGroup === group);

export const getTerm = (id: string) => terms.find((t) => t.id === id);

export function searchTerms(q = "", category?: string): Term[] {
  const s = q.trim().toLowerCase();
  return terms.filter(
    (t) =>
      (!category || t.category === category) &&
      (!s || [t.term, t.zhTerm, t.id, t.en, t.zh, t.formula ?? ""].some((f) => f.toLowerCase().includes(s))),
  );
}
