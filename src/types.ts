export interface Client {
  id?: string;
  name: string;
  phone: string;
  address: string;
  source?: string;
  concern?: string;
  searchName: string;
  ownerId: string;
  createdAt: any;
  updatedAt: any;
}

export interface Lead {
  id?: string;
  name: string;
  phone: string;
  source?: string;
  concern?: string;
  appointmentDate: any;
  status: 'enquiry' | 'appointment_set' | 'visited' | 'no_show' | 'cancelled';
  notes?: string;
  ownerId: string;
  createdAt: any;
  updatedAt: any;
}

export interface ProductEntry {
  name: string;
  qty: number;
  mrp: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
}

export interface ServiceEntry {
  name: string;
  mrp: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  productUsage?: string;
}

export interface Treatment {
  id?: string;
  date: any;
  treatmentName: string;
  productUsage: string;
  doctorName?: string;
  ownerId: string;
  followUpDate: any;
  notes?: string;
  products?: ProductEntry[];
  services?: ServiceEntry[];
  serviceMRP?: number;
  serviceDiscount?: number;
  serviceDiscountType?: 'percentage' | 'fixed';
  totalAmount?: number;
  paidAmount?: number;
  balanceAmount?: number;
  paymentMethod?: 'Cash' | 'PhonePe' | 'POS' | 'POS QR Code';
  createdAt: any;
  updatedAt?: any;
}
