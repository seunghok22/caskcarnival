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
