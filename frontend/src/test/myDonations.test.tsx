import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MyDonationsPage } from '../pages/MyDonationsPage';
import { AuthProvider } from '../auth/AuthContext';
import { tokenStorage } from '../auth/tokenStorage';
import { mockAdapter } from '../services/mock/mockAdapter';

function renderMyDonations() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <MyDonationsPage />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('HU-06 y HU-07 - Historial Propio y Simulación de Confirmación', () => {
  beforeEach(() => {
    mockAdapter.reset();
    tokenStorage.setAuth(
      {
        accessToken: 'donor-token-12345',
        expiresAt: Date.now() + 900000,
      },
      {
        sub: 'donor-sub-12345',
        email: 'donante@epis.unsa.edu.pe',
        roles: ['DONANTE'],
        currentRole: 'DONANTE',
      }
    );
  });

  it('CA-07.1: debe listar el historial de donaciones propias con fecha, proyecto, importe y estado', async () => {
    renderMyDonations();

    await waitFor(() => {
      expect(screen.getByText('Comedores Populares Cerro Colorado')).toBeInTheDocument();
    });

    expect(screen.getByText('Kits Escolares Rurales Yanahuara')).toBeInTheDocument();
    expect(screen.getByText(/CONFIRMADA SIMULADA/i)).toBeInTheDocument();
    expect(screen.getByText(/PENDIENTE SIMULACIÓN/i)).toBeInTheDocument();
  });

  it('CA-06.1 y CA-06.2: permite simular la confirmación de una donación en estado PENDIENTE_SIMULACION', async () => {
    renderMyDonations();

    // Localizar botón de Confirmar para la donación pendiente
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirmar/i })).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /Confirmar/i });
    fireEvent.click(confirmButton);

    // Debe cambiar a CONFIRMADA SIMULADA
    await waitFor(() => {
      expect(screen.getAllByText(/CONFIRMADA SIMULADA/i).length).toBe(2);
    });
  });

  it('CA-06.4: muestra en la vista el aviso de que no se ha realizado ningún cobro real', () => {
    renderMyDonations();

    expect(
      screen.getAllByText(/Simulación académica:/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/no se ha realizado ningún cobro/i)
    ).toBeInTheDocument();
  });
});
