// src/types/index.ts
export type Role = 'CUSTOMER' | 'SHOP_OWNER' | 'ADMIN' | 'SERVICE_PROVIDER';
export type TokenStatus = 'WAITING' | 'CALLED' | 'SERVING' | 'SERVED' | 'SKIPPED' | 'CANCELLED' | 'EXPIRED';
export type TokenPriority = 'NORMAL' | 'SENIOR' | 'PREGNANT' | 'VIP' | 'EMERGENCY';
export type ShopCategory = 'CLINIC' | 'SALON' | 'BANK' | 'GOVERNMENT' | 'RESTAURANT' | 'OTHER';
export type Weekday = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface User {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  category: ShopCategory;
  description?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  active: boolean;
  queuePaused: boolean;
  openTime: string;
  closeTime: string;
  breakStartTime?: string;
  breakEndTime?: string;
  closedDays?: Weekday[];
  avgServiceMins: number;
  maxQueueSize: number;
  currentQueueSize?: number;
  estimatedWaitMins?: number;
  distanceKm?: number;
  latitude?: number;
  longitude?: number;
  primaryColor?: string;
  logoUrl?: string;
  businessAccountId?: string;
  businessAccountName?: string;
  branchCode?: string;
  noShowGraceMins?: number;
  rejoinWindowMins?: number;
  maxRejoins?: number;
}

export interface Service {
  id: string;
  shopId: string;
  name: string;
  description?: string;
  durationMins: number;
  price: number;
  active: boolean;
}

export interface Token {
  id: string;
  shopId: string;
  shopName: string;
  userId?: string;
  userName?: string;
  userPhone?: string;
  serviceId?: string;
  serviceName?: string;
  providerId?: string;
  providerName?: string;
  tokenNumber: number;
  displayNumber: string;
  status: TokenStatus;
  priority?: TokenPriority;
  queuePosition?: number;
  tokensAhead?: number;
  estimatedWaitMins?: number;
  issuedAt: string;
  calledAt?: string;
  servedAt?: string;
  dateIssued: string;
  rejoinCount?: number;
  skippedAt?: string;
}

export interface LiveQueue {
  shopId: string;
  shopName: string;
  queuePaused: boolean;
  totalWaiting: number;
  totalServedToday: number;
  avgServiceMins: number;
  currentTokenDisplay: string;
  waitingTokens: Token[];
  lastUpdated: string;
}

export interface QueueUpdateEvent {
  shopId: string;
  eventType: string;
  currentToken: string;
  waitingCount: number;
  waitingTokens: Token[];
  timestamp: string;
}

export interface Appointment {
  id: string;
  shopId: string;
  shopName: string;
  serviceId: string;
  serviceName: string;
  providerId?: string;
  providerName?: string;
  scheduledAt: string;
  durationMins: number;
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  amount: number;
  razorpayOrderId?: string;
  notes?: string;
  createdAt: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ServiceProvider {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  title: string;
  serviceIds?: string[];
  serviceNames?: string[];
  active: boolean;
  available: boolean;
}
