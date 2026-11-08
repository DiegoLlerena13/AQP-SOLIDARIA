import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DonationModal } from '../components/DonationModal';
import { AuthProvider } from '../auth/AuthContext';
import { tokenStorage } from '../auth/tokenStorage';
import { mockAdapter } from '../services/mock/mockAdapter';
import { Project } from '../types/project';

const sampleProject: Project = {
  projectId: 'proj-arequipa-001',
  title: 'Comedores Populares Cerro Colorado',
  description: 'Abastecimiento de víveres...',
  goalAmountCents: 1500000,
  confirmedAmountCents: 620000,
  currency: 'PEN',
  status: 'PUBLICADO',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-05T14:30:00.000Z',
};

function renderModal(project: Project = sampleProject) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <DonationModal
            project={project}
            isOpen={true}
            onClose={() => {}}
          />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('HU-05 - Formulario de Donación Simulada y Validaciones', () => {
  beforeEach(() => {
    mockAdapter.reset();
    tokenStorage.clear();
  });

  it('CA-05.5 y CA-06.4: debe mostrar de manera prominente el aviso de simulación académica y NO solicitar tarjeta ni CVV', () => {
    renderModal();

    // Verificación de la advertencia académica requerida
    expect(
      screen.getAllByText(/Simulación académica:/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/no se ha realizado ningún cobro/i)
    ).toBeInTheDocument();

    // Comprobación de que está PROHIBIDO solicitar tarjeta de crédito, CVV o cuentas
    expect(screen.queryByLabelText(/tarjeta/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cvv/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cuenta bancaria/i)).not.toBeInTheDocument();
  });

  it('CA-05.1 y T05: un donante autenticado puede registrar una intención válida en PEN', async () => {
    // Autenticar como donante en memoria
    tokenStorage.setAuth(
      {
        accessToken: 'mock-donor-token',
        expiresAt: Date.now() + 900000,
      },
      {
        sub: 'donor-sub-12345',
        email: 'donante@epis.unsa.edu.pe',
        roles: ['DONANTE'],
        currentRole: 'DONANTE',
      }
    );

    renderModal();

    // El formulario debe estar visible con el campo de importe
    const amountInput = screen.getByLabelText(/Importe simulado en Soles/i);
    expect(amountInput).toBeInTheDocument();

    // Ingresar S/ 50.00
    fireEvent.change(amountInput, { target: { value: '50.00' } });

    // Enviar formulario
    const submitBtn = screen.getByRole('button', { name: /Registrar Intención de Donación/i });
    fireEvent.click(submitBtn);

    // Debe mostrar la confirmación con estado PENDIENTE_SIMULACION (CA-05.1)
    await waitFor(() => {
      expect(screen.getByText(/¡Intención de Donación Registrada!/i)).toBeInTheDocument();
      expect(screen.getByText(/PENDIENTE_SIMULACION/i)).toBeInTheDocument();
    });
  });

  it('CA-05.2 y T04: debe rechazar importes fuera del rango permitido (menor a S/ 1.00 o mayor a S/ 1,000.00)', async () => {
    tokenStorage.setAuth(
      {
        accessToken: 'mock-donor-token',
        expiresAt: Date.now() + 900000,
      },
      {
        sub: 'donor-sub-12345',
        email: 'donante@epis.unsa.edu.pe',
        roles: ['DONANTE'],
        currentRole: 'DONANTE',
      }
    );

    renderModal();

    const amountInput = screen.getByLabelText(/Importe simulado en Soles/i);

    // Probar con S/ 0.00
    fireEvent.change(amountInput, { target: { value: '0' } });
    const submitBtn = screen.getByRole('button', { name: /Registrar Intención de Donación/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/El importe debe estar comprendido entre S\/ 1.00 y S\/ 1,000.00/i)).toBeInTheDocument();
    });

    // Probar con S/ 1500.00 (mayor a 1000)
    fireEvent.change(amountInput, { target: { value: '1500.00' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/El importe debe estar comprendido entre S\/ 1.00 y S\/ 1,000.00/i)).toBeInTheDocument();
    });
  });
});
