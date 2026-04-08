'use client';

import { useState, useMemo, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Activity, FileText, TrendingUp, Users, DollarSign, LogOut, Loader2, Download,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { FiltroTabla, Filtros } from '@/components/FiltroTabla';

const MODULOS = [
  { value: 'internaciones',          label: 'Internaciones',         icon: Activity },
  { value: 'altas',                  label: 'Altas',                 icon: FileText },
  { value: 'ingresos',               label: 'Ingresos',              icon: TrendingUp },
  { value: 'facturacion-periodo',    label: 'Facturación período',   icon: DollarSign },
  { value: 'facturacion-costos',     label: 'Facturación costos',    icon: DollarSign },
  { value: 'consulta-por-convenio',  label: 'Consulta por convenio', icon: Users },
];

function toBackendDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function buildChartData(headers: string[], filas: string[][]) {
  if (!headers.length || !filas.length) return [];

  const preferred = ['Convenio', 'Servicio', 'Tipo Alta', 'Tipo Admisión', 'Sexo', 'Provincia', 'Localidad'];
  let colIdx = -1;
  for (const pref of preferred) {
    const idx = headers.findIndex(h => h === pref);
    if (idx !== -1) { colIdx = idx; break; }
  }
  if (colIdx === -1) {
    for (let i = 0; i < headers.length; i++) {
      const vals = filas.slice(0, 20).map(f => f[i] || '');
      const allNumeric = vals.every(v => v === '' || !isNaN(Number(v)));
      if (!allNumeric) { colIdx = i; break; }
    }
  }
  if (colIdx === -1) colIdx = 0;

  const counts: Record<string, number> = {};
  for (const fila of filas) {
    const val = fila[colIdx] || '(vacío)';
    counts[val] = (counts[val] || 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));
}

interface DatosResult {
  headers: string[];
  filas: string[][];
  total: number;
}

export default function DashboardPage() {
  const [moduloActivo, setModuloActivo] = useState('internaciones');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [datos, setDatos] = useState<DatosResult | null>(null);
  const [moduloConsultado, setModuloConsultado] = useState('');
  const [fechaConsulta, setFechaConsulta] = useState('');
  const [truncado, setTruncado] = useState(false);
  const [totalReal, setTotalReal] = useState(0);
  const [filtros, setFiltros] = useState<Filtros>({});
  const [pagina, setPagina] = useState(0);
  const FILAS_POR_PAGINA = 200;

  // Filas después de aplicar filtros (AND entre columnas, OR dentro de la misma columna)
  const filasFiltradas = useMemo(() => {
    if (!datos) return [];
    const activos = Object.entries(filtros).filter(([, s]) => s.size > 0);
    if (activos.length === 0) return datos.filas;
    return datos.filas.filter(fila =>
      activos.every(([idxStr, vals]) => vals.has(fila[Number(idxStr)] ?? ''))
    );
  }, [datos, filtros]);

  // Filas de la página actual (sobre los datos ya filtrados)
  const filasPagina = useMemo(() => {
    const inicio = pagina * FILAS_POR_PAGINA;
    return filasFiltradas.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [filasFiltradas, pagina, FILAS_POR_PAGINA]);

  const totalPaginas = Math.max(1, Math.ceil(filasFiltradas.length / FILAS_POR_PAGINA));

  const handleFiltroChange = useCallback((colIdx: number, valores: Set<string>) => {
    setPagina(0); // volver a página 1 al cambiar filtros
    setFiltros(prev => {
      const next = { ...prev };
      if (valores.size === 0) delete next[colIdx];
      else next[colIdx] = valores;
      return next;
    });
  }, []);

  const handleLimpiarFiltros = useCallback(() => { setFiltros({}); setPagina(0); }, []);

  async function handleConsultar(e: React.FormEvent) {
    e.preventDefault();
    if (!desde || !hasta) {
      setError('Seleccioná las fechas');
      return;
    }
    setLoading(true);
    setError('');
    setDatos(null);
    setFiltros({});
    setPagina(0);
    setTruncado(false);
    try {
      const res = await fetch('/api/datos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modulo: moduloActivo,
          desde: toBackendDate(desde),
          hasta: toBackendDate(hasta),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || 'Error al consultar');
      } else {
        setDatos(json.datos);
        setModuloConsultado(moduloActivo);
        setFechaConsulta(new Date().toLocaleDateString('es-AR'));
        if (json.truncado) {
          setTruncado(true);
          setTotalReal(json.totalReal);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error de red');
    } finally {
      setLoading(false);
    }
  }

  function handleExportar() {
    if (!datos) return;
    // Exporta solo las filas visibles (con filtros aplicados)
    const ws = XLSX.utils.aoa_to_sheet([datos.headers, ...filasFiltradas]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, moduloConsultado);
    XLSX.writeFile(wb, `${moduloConsultado}_${desde}_${hasta}.xlsx`);
  }

  const moduloLabel = MODULOS.find(m => m.value === moduloConsultado)?.label ?? moduloConsultado;
  const chartData = datos ? buildChartData(datos.headers, filasFiltradas) : [];
  const filtrosActivosCount = Object.values(filtros).filter(s => s.size > 0).length;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="px-6 py-5 border-b border-gray-100">
          <h1 className="text-lg font-bold text-blue-700 tracking-tight">Sottano360</h1>
          <p className="text-xs text-gray-400 mt-0.5">Analytics Hospitalario</p>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {MODULOS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => { setModuloActivo(value); setDatos(null); setError(''); setFiltros({}); setPagina(0); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                moduloActivo === value
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-100">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-800">
            {MODULOS.find(m => m.value === moduloActivo)?.label ?? 'Dashboard'}
          </h2>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Formulario */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">Parámetros de consulta</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleConsultar} className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">Fecha desde</Label>
                  <Input
                    type="date"
                    value={desde}
                    onChange={e => setDesde(e.target.value)}
                    className="w-40 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">Fecha hasta</Label>
                  <Input
                    type="date"
                    value={hasta}
                    onChange={e => setHasta(e.target.value)}
                    className="w-40 text-sm"
                  />
                </div>
                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {loading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cargando...</>
                    : 'Consultar'
                  }
                </Button>
              </form>
              {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
              {truncado && datos && (
                <p className="mt-3 text-sm text-amber-600">
                  Se muestran {datos.total.toLocaleString('es-AR')} de {totalReal.toLocaleString('es-AR')} registros totales.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Resultados */}
          {datos && (
            <>
              {chartData.length > 0 && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-gray-700">Distribución</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          angle={-35}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Cantidad" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <Card className="shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-sm font-semibold text-gray-700">{moduloLabel}</CardTitle>
                    <Badge variant="secondary">
                      {filtrosActivosCount > 0
                        ? `${filasFiltradas.length.toLocaleString('es-AR')} de ${datos.total.toLocaleString('es-AR')} registros`
                        : `${datos.total.toLocaleString('es-AR')} registros`
                      }
                    </Badge>
                    <span className="text-xs text-gray-400">{fechaConsulta}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExportar} className="text-xs">
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Exportar Excel
                  </Button>
                </CardHeader>

                {/* Filtros */}
                {datos.filas.length > 0 && (
                  <div className="px-6 py-3 border-t border-gray-100">
                    <FiltroTabla
                      headers={datos.headers}
                      filas={datos.filas}
                      filtros={filtros}
                      onChange={handleFiltroChange}
                      onLimpiar={handleLimpiarFiltros}
                    />
                  </div>
                )}

                <CardContent className="p-0">
                  {filasFiltradas.length === 0 ? (
                    <p className="px-6 py-4 text-sm text-gray-400">
                      {filtrosActivosCount > 0
                        ? 'Ningún registro coincide con los filtros seleccionados.'
                        : 'Sin resultados para el período seleccionado.'
                      }
                    </p>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              {datos.headers.map((h, i) => (
                                <TableHead key={i} className="text-xs font-semibold text-gray-600 whitespace-nowrap px-3 py-2">
                                  {h}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filasPagina.map((fila, i) => (
                              <TableRow key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                {fila.map((celda, j) => (
                                  <TableCell key={j} className="text-xs text-gray-700 whitespace-nowrap px-3 py-1.5">
                                    {celda}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Paginación */}
                      {totalPaginas > 1 && (
                        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
                          <span className="text-xs text-gray-500">
                            Mostrando {pagina * FILAS_POR_PAGINA + 1}–{Math.min((pagina + 1) * FILAS_POR_PAGINA, filasFiltradas.length)} de {filasFiltradas.length.toLocaleString('es-AR')}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setPagina(p => Math.max(0, p - 1))}
                              disabled={pagina === 0}
                              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronLeft className="w-4 h-4 text-gray-600" />
                            </button>
                            <span className="text-xs text-gray-600 px-2">
                              {pagina + 1} / {totalPaginas}
                            </span>
                            <button
                              onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))}
                              disabled={pagina >= totalPaginas - 1}
                              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronRight className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
