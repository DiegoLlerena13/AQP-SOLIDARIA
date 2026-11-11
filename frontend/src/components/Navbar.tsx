import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Heart,
  Menu,
  X,
  Shield,
  User,
  LogOut,
  LogIn,
  Sliders,
  FileText,
  FolderPlus,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { UserRole } from '../types/auth';

export const Navbar: React.FC = () => {
  const { user, role, isAuthenticated, logout, loginAsMockUser, isMockAuth } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleSelectorOpen, setRoleSelectorOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const handleRoleSelect = (selectedRole: UserRole) => {
    loginAsMockUser(selectedRole);
    setRoleSelectorOpen(false);
    setMobileMenuOpen(false);
  };

  const roleBadgeColors: Record<UserRole, string> = {
    VISITANTE: 'bg-slate-100 text-slate-700 border-slate-200',
    DONANTE: 'bg-rose-50 text-rose-700 border-rose-200',
    GESTOR: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    AUDITOR: 'bg-amber-50 text-amber-800 border-amber-200',
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-rose-500 rounded-lg p-1"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-500 flex items-center justify-center text-white shadow-sm">
              <Heart className="w-5 h-5 fill-white" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-slate-900 tracking-tight text-base sm:text-lg leading-none">
                AQP<span className="text-rose-600">-SOLIDARIA</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-wider uppercase mt-0.5">
                Lab4 TAIS • Zero Trust
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav aria-label="Navegación principal" className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${
                isActive('/')
                  ? 'bg-rose-50 text-rose-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Catálogo de Proyectos
            </Link>

            {/* Mis Donaciones (Solo para DONANTE o autenticado) */}
            {isAuthenticated && role === 'DONANTE' && (
              <Link
                to="/mis-donaciones"
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${
                  isActive('/mis-donaciones')
                    ? 'bg-rose-50 text-rose-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Heart className="w-4 h-4 text-rose-500" aria-hidden="true" />
                <span>Mis Donaciones</span>
              </Link>
            )}

            {/* Panel de Gestión (Solo GESTOR) */}
            {role === 'GESTOR' && (
              <Link
                to="/gestion"
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${
                  isActive('/gestion')
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <FolderPlus className="w-4 h-4 text-indigo-500" aria-hidden="true" />
                <span>Gestión de Proyectos</span>
              </Link>
            )}

            {/* Auditoría (Solo AUDITOR - HU-10) */}
            {role === 'AUDITOR' && (
              <Link
                to="/auditoria"
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${
                  isActive('/auditoria')
                    ? 'bg-amber-50 text-amber-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-4 h-4 text-amber-600" aria-hidden="true" />
                <span>Auditoría</span>
              </Link>
            )}
          </nav>

          {/* Desktop User / Role Controls */}
          <div className="hidden md:flex items-center gap-3">
            {/* Selector Rápido de Rol de Prueba para el Laboratorio */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setRoleSelectorOpen(!roleSelectorOpen)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${roleBadgeColors[role]} hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-rose-500`}
                title="Cambiar rol de prueba para evaluación docente"
                aria-haspopup="true"
                aria-expanded={roleSelectorOpen}
              >
                <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Rol: {role}</span>
                <Sliders className="w-3 h-3 ml-0.5 opacity-60" aria-hidden="true" />
              </button>

              {roleSelectorOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                  role="menu"
                >
                  <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Cambiar Rol de Prueba (Lab)
                  </div>
                  {(['VISITANTE', 'DONANTE', 'GESTOR', 'AUDITOR'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => handleRoleSelect(r)}
                      role="menuitem"
                      className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-slate-50 transition ${
                        role === r ? 'font-bold text-rose-600 bg-rose-50/50' : 'text-slate-700'
                      }`}
                    >
                      <span>{r}</span>
                      {role === r && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600" aria-hidden="true" />
                      )}
                    </button>
                  ))}
                  {isMockAuth && (
                    <div className="px-3 py-1.5 mt-1 border-t border-slate-100 text-[10px] text-slate-500 bg-slate-50">
                      Modo prueba académica activo
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Auth Actions */}
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-mono truncate max-w-[120px]">
                  {user?.email || user?.sub}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-rose-500"
                  title="Cerrar sesión y limpiar tokens de memoria"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Salir</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Iniciar Sesión</span>
              </Link>
            )}
          </div>

          {/* Mobile Menu Toggle Button (Accessible at 375px) */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => handleRoleSelect(role === 'DONANTE' ? 'GESTOR' : 'DONANTE')}
              className={`px-2 py-1 rounded-full text-[10px] font-bold border ${roleBadgeColors[role]}`}
            >
              {role}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              aria-expanded={mobileMenuOpen}
              aria-label="Abrir menú de navegación"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" aria-hidden="true" />
              ) : (
                <Menu className="w-6 h-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer (Responsive down to 375px) */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-3">
          <nav className="flex flex-col space-y-1">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3 py-2.5 rounded-xl text-sm font-semibold ${
                isActive('/') ? 'bg-rose-50 text-rose-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              Catálogo de Proyectos
            </Link>

            {isAuthenticated && role === 'DONANTE' && (
              <Link
                to="/mis-donaciones"
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                  isActive('/mis-donaciones')
                    ? 'bg-rose-50 text-rose-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Heart className="w-4 h-4 text-rose-500" aria-hidden="true" />
                <span>Mis Donaciones</span>
              </Link>
            )}

            {role === 'GESTOR' && (
              <Link
                to="/gestion"
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                  isActive('/gestion')
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FolderPlus className="w-4 h-4 text-indigo-500" aria-hidden="true" />
                <span>Gestión de Proyectos</span>
              </Link>
            )}

            {role === 'AUDITOR' && (
              <Link
                to="/auditoria"
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                  isActive('/auditoria')
                    ? 'bg-amber-50 text-amber-800'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-4 h-4 text-amber-600" aria-hidden="true" />
                <span>Auditoría</span>
              </Link>
            )}
          </nav>

          {/* Roles Selector for Mobile */}
          <div className="pt-2 border-t border-slate-100">
            <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Cambiar Rol de Prueba:
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(['VISITANTE', 'DONANTE', 'GESTOR', 'AUDITOR'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRoleSelect(r)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition ${
                    role === r
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* User info / Auth actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="p-1.5 bg-slate-100 rounded-full text-slate-600">
                    <User className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <span className="text-xs text-slate-600 font-mono truncate max-w-[180px]">
                    {user?.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-xl"
                >
                  Salir
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 bg-rose-600 text-white font-bold text-xs rounded-xl"
              >
                Iniciar Sesión
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

