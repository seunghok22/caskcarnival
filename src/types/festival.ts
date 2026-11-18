export interface TastingItem {
  id: string;
  name: string;
  abv: string;
  note: string;
  priceLabel: string; // 예: "무료 시음" 또는 "5,000원 (15ml)"
}

export interface BottleItem {
  id: string;
  name: string;
  distillery: string;
  abv: string;
  volume: string;
  price: number;
  note?: string;
}

export interface Booth {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  mapPosition: {
    x: number; // 0 ~ 100 (%)
    y: number; // 0 ~ 100 (%)
  };
  tastings: TastingItem[];
  bottles: BottleItem[];
}

export interface ReviewItem {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
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
