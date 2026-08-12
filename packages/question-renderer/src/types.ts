export type OptionLabel = "A" | "B" | "C" | "D" | "E";

export interface MediaAsset {
  id: string;
  type: "IMAGE" | "AUDIO";
  url: string;
  alt?: string;
  caption?: string;
}

export interface PublishedStimulus {
  id: string;
  title: string;
  instructionsHtml: string;
  contentHtml: string;
  media?: MediaAsset[];
}

export interface PublishedOption {
  id: string;
  label: OptionLabel;
  contentHtml: string;
  media?: MediaAsset[];
}

export interface PublishedQuestion {
  id: string;
  number: number;
  contentHtml: string;
  options: PublishedOption[];
  media?: MediaAsset[];
}
