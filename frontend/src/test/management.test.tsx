import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ManagementPage } from '../pages/ManagementPage';
import { AuthProvider } from '../auth/AuthContext';
import { tokenStorage } from '../auth/tokenStorage';
import { mockAdapter } from '../services/mock/mockAdapter';

function renderManagementPage() {
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
          <ManagementPage />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('HU-08 - Panel de Gestión de Proyectos (Rol GESTOR)', () => {
  beforeEach(() => {
    mockAdapter.reset();
    tokenStorage.setAuth(
      {
        accessToken: 'gestor-token-67890',
        expiresAt: Date.now() + 900000,
      },
      {
        sub: 'gestor-sub-67890',
        email: 'gestor@aqp-solidaria.org',
        roles: ['GESTOR'],
        currentRole: 'GESTOR',
      }
    );
  });

  it('CA-08.1: el gestor puede registrar un proyecto con título, descripción y meta, creándose en BORRADOR', async () => {
    renderManagementPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Título de la causa/i)).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText(/Título de la causa/i);
    const descInput = screen.getByLabelText(/Descripción y objetivo social/i);
    const goalInput = screen.getByLabelText(/Meta en Soles/i);

    fireEvent.change(titleInput, { target: { value: 'Comedor Santa Rosa de Lima' } });
    fireEvent.change(descInput, { target: { value: 'Equipamiento de cocina para 80 familias' } });
    fireEvent.change(goalInput, { target: { value: '7500.00' } });

    const submitBtn = screen.getByRole('button', { name: /Crear Proyecto \(BORRADOR\)/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/creado en estado BORRADOR con éxito/i)).toBeInTheDocument();
    });
  });

  it('CA-08.2: el gestor puede publicar un proyecto en borrador para pasarlo a PUBLICADO', async () => {
    renderManagementPage();

    await waitFor(() => {
      expect(screen.getByText(/Abrigo para las Alturas de Caylloma/i)).toBeInTheDocument();
    });

    // Localizar botón de publicar proyecto
    const publishBtn = screen.getByRole('button', { name: /Publicar Proyecto/i });
    expect(publishBtn).toBeInTheDocument();

    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(screen.getByText(/publicado. Ahora es visible en el catálogo público/i)).toBeInTheDocument();
    });
  });
});
