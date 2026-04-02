'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Filter, ChevronDown } from 'lucide-react';

export type Filtros = Record<number, Set<string>>;

interface ColumnDropdownProps {
  colIdx: number;
  header: string;
  valoresUnicos: string[];
  seleccionados: Set<string>;
  onChange: (colIdx: number, valores: Set<string>) => void;
}

function ColumnDropdown({ colIdx, header, valoresUnicos, seleccionados, onChange }: ColumnDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const activo = seleccionados.size > 0;

  function toggle(val: string) {
    const next = new Set(seleccionados);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onChange(colIdx, next);
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
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
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[180px] max-w-[260px] py-1">
          <div className="max-h-52 overflow-y-auto">
            {valoresUnicos.map(val => (
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
            ))}
          </div>
          {activo && (
            <div className="border-t border-gray-100 px-3 py-1.5">
              <button
                onClick={e => { e.stopPropagation(); onChange(colIdx, new Set()); }}
                className="text-xs text-red-500 hover:text-red-600"
              >
                Limpiar
              </button>
            </div>
          )}
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
        if (a === '') return 1;
        if (b === '') return -1;
        const na = Number(a), nb = Number(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b, 'es-AR', { sensitivity: 'base' });
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
