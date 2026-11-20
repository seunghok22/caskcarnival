export type BoothZone = "I" | "A" | "B" | "C" | "D" | "E" | "F" | "G";

export interface TastingItem {
  id: string;
  name: string;
  distillery?: string;
  abv: string;
  note: string;
  priceLabel: string;
  cask?: string;
  vintage?: string;
  age?: string;
  whiskybaseUrl?: string;
  isUserContributed?: boolean;
  isMine?: boolean;
}

export interface BottleItem {
  id: string;
  name: string;
  distillery: string;
  abv: string;
  volume: string;
  price: number;
  note?: string;
  cask?: string;
  vintage?: string;
  age?: string;
  whiskybaseUrl?: string;
  isUserContributed?: boolean;
  isMine?: boolean;
}

export interface ItemPatch {
  distillery?: string;
  abv?: string;
  cask?: string;
  age?: string;
  vintage?: string;
  whiskybaseUrl?: string;
  note?: string;
}

export interface CustomBoothItem {
  id: string;
  boothCode: string;
  kind: "tasting" | "bottle";
  name: string;
  distillery?: string;
  abv: string;
  volume?: string;
  price?: number;
  priceLabel?: string;
  note?: string;
  cask?: string;
  vintage?: string;
  age?: string;
  whiskybaseUrl?: string;
  createdAt: string;
  isUserContributed: true;
  isMine?: boolean;
}

export interface Booth {
  id: string;
  code: string;
  zone: BoothZone;
  name: string;
  nameEn: string;
  category: string;
  description: string;
  rect: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  tastings: TastingItem[];
  bottles: BottleItem[];
}

export interface ReviewItem {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  isMine?: boolean;
}

export interface BottleDynamicStatus {
  bottleId: string;
  soldOutCount: number;
  isSoldOut: boolean;
  ratingAvg: number;
  ratingCount: number;
  reviews: ReviewItem[];
  hasVotedSoldOut: boolean;
  hasReviewed: boolean;
}
