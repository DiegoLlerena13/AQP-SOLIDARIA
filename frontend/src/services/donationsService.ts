import { Donation, CreateDonationDto, SimulateDonationDto } from '../types/donation';
import { apiFetch, isUsingMock } from './apiClient';
import { mockAdapter } from './mock/mockAdapter';

export const donationsService = {
  async createDonation(dto: CreateDonationDto, idempotencyKey: string): Promise<Donation> {
    if (isUsingMock()) {
      return mockAdapter.createDonation(dto, idempotencyKey);
    }
    return apiFetch<Donation>('/v1/donations', {
      method: 'POST',
      body: JSON.stringify(dto),
      idempotencyKey,
    });
  },

  async simulateDonation(donationId: string, action: 'CONFIRMAR' | 'RECHAZAR'): Promise<Donation> {
    const dto: SimulateDonationDto = { action };
    if (isUsingMock()) {
      return mockAdapter.simulateDonation(donationId, dto);
    }
    // El backend Lambda espera action: "CONFIRM" o "REJECT"
    const backendAction = action === 'CONFIRMAR' ? 'CONFIRM' : 'REJECT';
    return apiFetch<Donation>(`/v1/donations/${donationId}/simulate`, {
      method: 'POST',
      body: JSON.stringify({ action: backendAction }),
    });
  },

  async getMyDonations(): Promise<Donation[]> {
    if (isUsingMock()) {
      return mockAdapter.getMyDonations();
    }
    return apiFetch<Donation[]>('/v1/donations/me');
  },
};

