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

export interface Treatment {
  id?: string;
  date: any;
  treatmentName: string;
  productUsage: string;
  ownerId: string;
  followUpDate: any;
  notes?: string;
  createdAt: any;
}
