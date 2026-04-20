export interface Client {
  id?: string;
  name: string;
  phone: string;
  address: string;
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

export interface Treatment {
  id?: string;
  date: any;
  treatmentName: string;
  productUsage: string;
  doctorName?: string;
  ownerId: string;
  followUpDate: any;
  notes?: string;
  createdAt: any;
  updatedAt?: any;
}
