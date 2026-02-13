export type Place = {
  id: string;
  name: string;
  category: string;
  distanceMeters?: number;
  latitude: number;
  longitude: number;
  stars?: string;
  // Enhanced details
  phone?: string;
  website?: string;
  openingHours?: string;
  photos?: string[];
  reviews?: Review[];
  address?: string;
  description?: string;
};

export type Review = {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
};