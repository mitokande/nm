export type GemType = "ruby" | "emerald" | "sapphire" | "topaz" | "amethyst";

export const GEM_EMOJI: Record<GemType, string> = {
  ruby: "❤️",
  emerald: "💚",
  sapphire: "💙",
  topaz: "💛",
  amethyst: "💜",
};

export const GEM_NAME: Record<GemType, string> = {
  ruby: "Ruby",
  emerald: "Emerald",
  sapphire: "Sapphire",
  topaz: "Topaz",
  amethyst: "Amethyst",
};

export interface GoldenStage {
  id: number;
  name: string;
  values: number[];
  gems: Record<number, GemType>;
  targets: Partial<Record<GemType, number>>;
}
