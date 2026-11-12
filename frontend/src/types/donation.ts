export type DonationStatus =
  | 'PENDIENTE_SIMULACION'
  | 'CONFIRMADA_SIMULADA'
  | 'RECHAZADA_SIMULADA';

export interface Donation {
  donationId: string;
  projectId: string;
  projectTitle?: string;
  donorSub: string;
  amountCents: number;
  currency: 'PEN';
  status: DonationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDonationDto {
  projectId: string;
  amountCents: number;
}

export interface SimulateDonationDto {
  action: 'CONFIRMAR' | 'RECHAZAR';
}

