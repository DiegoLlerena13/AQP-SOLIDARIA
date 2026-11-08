import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CatalogPage } from '../pages/CatalogPage';
import { AuthProvider } from '../auth/AuthContext';
import { mockAdapter } from '../services/mock/mockAdapter';

function renderWithProviders(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <AuthProvider>
        <BrowserRouter>{ui}</BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('HU-01 y HU-09 - Catálogo de Proyectos e Indicadores Agregados', () => {
  beforeEach(() => {
    mockAdapter.reset();
  });

  it('T01 / CA-01.1: debe listar proyectos con estado PUBLICADO mostrando nombre, meta y monto confirmado', async () => {
    renderWithProviders(<CatalogPage />);

    // Esperar a que carguen los proyectos
    await waitFor(() => {
      expect(
        screen.getByText('Comedores Populares Cerro Colorado')
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText('Kits Escolares Rurales Yanahuara')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Salud Preventiva y Despistaje Paucarpata')
    ).toBeInTheDocument();

    // Verificación de formato PEN
    expect(screen.getAllByText(/Meta: S\//i).length).toBeGreaterThan(0);
  });

  it('T01 / CA-01.2: un proyecto en estado BORRADOR NO debe aparecer en el catálogo público', async () => {
    renderWithProviders(<CatalogPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Comedores Populares Cerro Colorado')
      ).toBeInTheDocument();
    });

    // El proyecto «Abrigo para las Alturas de Caylloma (Borrador)» tiene status BORRADOR
    expect(
      screen.queryByText(/Abrigo para las Alturas de Caylloma/i)
    ).not.toBeInTheDocument();
  });

  it('CA-09.1 y CA-09.2: los indicadores agregados muestran montos en PEN y no exponen datos personales de donantes', async () => {
    renderWithProviders(<CatalogPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Impacto Social Consolidado — Arequipa/i)
      ).toBeInTheDocument();
    });

    // Muestra indicadores agregados
    expect(screen.getByText(/Recaudación Confirmada/i)).toBeInTheDocument();
    expect(screen.getByText(/Meta Global Requerida/i)).toBeInTheDocument();
    expect(screen.getByText(/Campañas Activas/i)).toBeInTheDocument();

    // Comprobación de Privacidad: no debe figurar ningún sub de donante ni correo en el catálogo público
    expect(screen.queryByText(/donor-sub/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@epis.unsa.edu.pe/i)).not.toBeInTheDocument();
  });
});
