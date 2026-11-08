import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';

import { CatalogPage } from './pages/CatalogPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { MyDonationsPage } from './pages/MyDonationsPage';
import { ManagementPage } from './pages/ManagementPage';
import { AuditPage } from './pages/AuditPage';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { NotFoundPage } from './pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 selection:bg-rose-500 selection:text-white">
            {/* Barra de navegación accesible (Responsive a 375px) */}
            <Navbar />

            {/* Contenido Principal con skip-link para accesibilidad */}
            <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <Routes>
                {/* EP-01: Descubrimiento de proyectos (Público) */}
                <Route path="/" element={<CatalogPage />} />
                <Route path="/proyectos/:projectId" element={<ProjectDetailPage />} />

                {/* EP-02: Identidad y Acceso */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/callback" element={<AuthCallbackPage />} />

                {/* EP-03: Donaciones simuladas (Solo DONANTE) */}
                <Route
                  path="/mis-donaciones"
                  element={
                    <ProtectedRoute allowedRoles={['DONANTE']}>
                      <MyDonationsPage />
                    </ProtectedRoute>
                  }
                />

                {/* EP-04: Gestión de proyectos (Solo GESTOR) */}
                <Route
                  path="/gestion"
                  element={
                    <ProtectedRoute allowedRoles={['GESTOR']}>
                      <ManagementPage />
                    </ProtectedRoute>
                  }
                />

                {/* Extensión HU-10: Auditoría (Solo AUDITOR) */}
                <Route
                  path="/auditoria"
                  element={
                    <ProtectedRoute allowedRoles={['AUDITOR']}>
                      <AuditPage />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback 404 */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>

            {/* Pie de página con información del proyecto y descargo legal */}
            <footer className="bg-white border-t border-slate-200 mt-auto py-8">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
                <div>
                  <p className="font-bold text-slate-700">
                    Fundación AQP-SOLIDARIA — Laboratorio 4 TAIS (EPIS - UNSA)
                  </p>
                  <p className="mt-0.5">
                    Prototipo de evaluación académica con arquitectura Zero Trust (NIST SP 800-207).
                  </p>
                </div>
                <div className="text-center sm:text-right">
                  <p className="font-semibold text-rose-600">
                    Simulación Académica: Sin Transacciones Reales
                  </p>
                  <p className="mt-0.5 text-slate-400">
                    Prohibido registrar información de tarjetas de crédito o credenciales bancarias.
                  </p>
                </div>
              </div>
            </footer>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};
