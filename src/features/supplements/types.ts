export type ContentUnit = 'เม็ด' | 'ช้อน' | 'ซอง';
export type DiscountType = 'none' | 'percent_10' | 'percent_15' | 'fixed_100' | 'fixed_500' | 'custom';

export interface Supplement {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  contentQuantity: number;
  contentUnit: ContentUnit;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseDraftLine {
  lineId: string;
  supplementId: string;
  supplement: Supplement;
  packageQuantity: number;
  discountType: DiscountType;
  discountValue: number;
}

export interface PricedCourseLine {
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
}

export interface SavedCourseItem {
  id: string;
  supplementId: string;
  supplementName: string;
  imageUrl: string;
  contentQuantity: number;
  contentUnit: ContentUnit;
  unitPrice: number;
  packageQuantity: number;
  discountType: DiscountType;
  discountValue: number;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  sortOrder: number;
}

export interface SavedSupplementCourse {
  id: string;
  trainerId: string;
  trainerName: string;
  traineeId: string;
  traineeName: string;
  subtotal: number;
  discountTotal: number;
  total: number;
  createdAt: string;
  items: SavedCourseItem[];
}

export interface CourseTrainee {
  userId: string;
  nickname: string;
  pictureUrl?: string;
}
