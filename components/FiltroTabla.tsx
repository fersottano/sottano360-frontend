'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Filter, ChevronDown, Search } from 'lucide-react';

export type Filtros = Record<number, Set<string>>;

// Umbral: a partir de esta cantidad de valores únicos, muestra un buscador dentro del dropdown
const UMBRAL_BUSQUEDA = 8;

interface ColumnDropdownProps {
  colIdx: number;
  header: string;
  valoresUnicos: string[];
  seleccionados: Set<string>;
  onChange: (colIdx: number, valores: Set<string>) => void;
}

function ColumnDropdown({ colIdx, header, valoresUnicos, seleccionados, onChange }: ColumnDropdownProps) {
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setBusqueda('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Foco automático en el buscador al abrir
  useEffect(() => {
    if (open && valoresUnicos.length >= UMBRAL_BUSQUEDA) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open, valoresUnicos.length]);

  const activo = seleccionados.size > 0;
  const mostrarBusqueda = valoresUnicos.length >= UMBRAL_BUSQUEDA;

  const valoresFiltrados = useMemo(() => {
    if (!busqueda.trim()) return valoresUnicos;
    const q = busqueda.trim().toLowerCase();
    return valoresUnicos.filter(v => v.toLowerCase().includes(q));
  }, [valoresUnicos, busqueda]);

  function toggle(val: string) {
    const next = new Set(seleccionados);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onChange(colIdx, next);
  }

  function handleOpenToggle() {
    setOpen(o => {
      if (o) setBusqueda(''); // limpiar búsqueda al cerrar
      return !o;
    });
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={handleOpenToggle}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
          activo
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <span className="max-w-[110px] truncate">{header}</span>
        {activo && (
          <span className="inline-flex items-center justify-center bg-blue-600 text-white rounded-full w-4 h-4 text-[10px] flex-shrink-0">
            {seleccionados.size}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px] max-w-[280px] py-1">
          {/* Buscador — solo si hay muchos valores */}
          {mostrarBusqueda && (
            <div className="px-2 pt-1 pb-1 border-b border-gray-100">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-md border border-gray-200">
                <Search className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar..."
                  className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder-gray-400 min-w-0"
                />
                {busqueda && (
                  <button onClick={() => setBusqueda('')} className="text-gray-400 hover:text-gray-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="max-h-52 overflow-y-auto">
            {valoresFiltrados.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">Sin coincidencias</p>
            ) : (
              valoresFiltrados.map(val => (
                <label
                  key={val}
                  className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={seleccionados.has(val)}
                    onChange={() => toggle(val)}
                    className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0 cursor-pointer"
                  />
                  <span className="text-xs text-gray-700 break-words leading-tight">
                    {val === '' ? '(vacío)' : val}
                  </span>
                </label>
              ))
            )}
          </div>

          {/* Footer: limpiar selección + conteo */}
          <div className="border-t border-gray-100 px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-gray-400">
              {valoresFiltrados.length} de {valoresUnicos.length}
            </span>
            {activo && (
              <button
                onClick={e => { e.stopPropagation(); onChange(colIdx, new Set()); }}
                className="text-xs text-red-500 hover:text-red-600"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface FiltroTablaProps {
  headers: string[];
  filas: string[][];
  filtros: Filtros;
  onChange: (colIdx: number, valores: Set<string>) => void;
  onLimpiar: () => void;
}

export function FiltroTabla({ headers, filas, filtros, onChange, onLimpiar }: FiltroTablaProps) {
  // Valores únicos de cada columna, calculados sobre los datos originales
  const valoresUnicos = useMemo(() => {
    return headers.map((_, colIdx) => {
      const seen = new Set<string>();
      for (const fila of filas) seen.add(fila[colIdx] ?? '');
      return Array.from(seen).sort((a, b) => {
        // Vacíos siempre al final
        if (a === '' && b === '') return 0;
        if (a === '') return 1;
        if (b === '') return -1;
        // Números ordenados numéricamente
        const na = Number(a), nb = Number(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        // Texto: orden alfabético con soporte de tildes (sin sensitivity:base que equipara á=a y hace el sort inconsistente)
        return a.localeCompare(b, 'es-AR');
      });
    });
  }, [headers, filas]);

  // Solo mostrar columnas que tienen más de un valor único (las de un solo valor no tiene sentido filtrar)
  const columnasFiltables = useMemo(
    () => headers.map((h, i) => ({ header: h, colIdx: i, valores: valoresUnicos[i] }))
              .filter(({ valores }) => valores.length > 1),
    [headers, valoresUnicos]
  );

  const totalActivos = Object.values(filtros).filter(s => s.size > 0).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0">
        <Filter className="w-3.5 h-3.5" />
        <span className="font-medium">Filtrar:</span>
      </div>
      {columnasFiltables.map(({ header, colIdx, valores }) => (
        <ColumnDropdown
          key={colIdx}
          colIdx={colIdx}
          header={header}
          valoresUnicos={valores}
          seleccionados={filtros[colIdx] ?? new Set()}
          onChange={onChange}
        />
      ))}
      {totalActivos > 0 && (
        <button
          onClick={onLimpiar}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <X className="w-3 h-3" />
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
