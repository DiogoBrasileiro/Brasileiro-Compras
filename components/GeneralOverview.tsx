import React, { useMemo, forwardRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { 
  ShoppingBag, DollarSign, TrendingUp, Clock, AlertTriangle, 
  Building, CheckCircle2, User, HelpCircle, Package, ArrowRight, Activity 
} from 'lucide-react';

const COLORS = ['#4f46e5', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

export const GeneralOverview = forwardRef<HTMLDivElement, { data: any, sortBy: 'value' | 'volume' }>(({ data, sortBy }, ref) => {
  const kpis = useMemo(() => {
    return [
      { 
        title: 'Volume Operacional', 
        firstLabel: 'Total Pedidos', 
        firstVal: data.kpis.totalOrders,
        secLabel: 'Concluídos', 
        secVal: `${data.kpis.completedCount} (${data.kpis.totalOrders > 0 ? Math.round((data.kpis.completedCount/data.kpis.totalOrders)*100) : 0}%)`,
        thirdLabel: 'Em Aberto/Aguardando',
        thirdVal: data.kpis.openCount,
        icon: ShoppingBag, 
        color: 'bg-indigo-50 text-indigo-600 border-indigo-100' 
      },
      { 
        title: 'Desempenho Financeiro', 
        firstLabel: 'Valor Aprovado', 
        firstVal: `R$ ${data.kpis.approvedValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
        secLabel: 'Ticket Médio', 
        secVal: `R$ ${data.kpis.ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
        thirdLabel: 'Economia Obtida',
        thirdVal: `R$ ${(data.condoStats || []).reduce((sum: number, c: any) => sum + (c.potentialSavings || 0), 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
        icon: DollarSign, 
        color: 'bg-emerald-50 text-emerald-600 border-emerald-100' 
      },
      { 
        title: 'Prazos & Eficiência (Média)', 
        firstLabel: 'Tempo de Conclusão', 
        firstVal: `${data.kpis.avgTotalTimeDays.toFixed(1)} dias`,
        secLabel: 'Tempo Brasileiro', 
        secVal: `${data.kpis.avgInternalDays.toFixed(1)} dias`,
        thirdLabel: 'Tempo Cliente/Cond.',
        thirdVal: `${data.kpis.avgClientDays.toFixed(1)} dias`,
        icon: Clock, 
        color: 'bg-violet-50 text-violet-600 border-violet-100' 
      },
      { 
        title: 'Governança & SLA', 
        firstLabel: 'Fora do SLA', 
        firstVal: `${data.kpis.slaExtrapolatedCount} pedidos`,
        secLabel: '< 3 cotações', 
        secVal: `${data.kpis.lessThanThreeBudgetsCount} pedidos`,
        thirdLabel: 'Sem justificativa',
        thirdVal: `${data.kpis.missingChoiceJustificationCount} pedidos`,
        icon: AlertTriangle, 
        color: 'bg-amber-50 text-amber-600 border-amber-100' 
      },
    ];
  }, [data]);

  const sortedCondos = useMemo(() => {
    const list = [...(data.condoStats || [])];
    return list.sort((a, b) => sortBy === 'value' ? b.totalValue - a.totalValue : b.total - a.total);
  }, [data.condoStats, sortBy]);

  const sortedSuppliers = useMemo(() => {
    const list = [...(data.supplierStats || [])];
    return list.sort((a, b) => sortBy === 'value' ? b.totalValueWon - a.totalValueWon : b.totalRequestsWon - a.totalRequestsWon);
  }, [data.supplierStats, sortBy]);

  return (
    <div ref={ref} className="space-y-8 print:space-y-6">
      {/* 1. KEY KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-2">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{kpi.title}</h3>
              <div className={`p-2.5 rounded-xl border ${kpi.color}`}>
                <kpi.icon size={18} />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-zinc-400 font-medium uppercase">{kpi.firstLabel}</p>
                <p className="text-xl font-extrabold text-zinc-900 tracking-tight">{kpi.firstVal}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 text-[11px]">
                <div>
                  <span className="text-zinc-400 block font-medium uppercase text-[9px]">{kpi.secLabel}</span>
                  <span className="font-bold text-zinc-800">{kpi.secVal}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium uppercase text-[9px]">{kpi.thirdLabel}</span>
                  <span className="font-bold text-zinc-800">{kpi.thirdVal}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 2. EXECUTIVE HIGHLIGHTS PANEL (Rules-Based) */}
      <div className="bg-zinc-950 text-white p-8 rounded-3xl border border-zinc-800 shadow-xl print:text-zinc-950 print:bg-none print:border-zinc-200">
        <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2 print:text-zinc-900">
          <Activity size={16} /> Diagnóstico e Destaques Executivos de Performance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2">
          {/* Main operational bottleneck */}
          <div className="bg-black p-5 rounded-2xl border border-zinc-800 print:bg-zinc-50 print:border-zinc-200 hover:border-zinc-700 transition-colors">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block mb-1">Maior Gargalo Operacional</span>
            {data.bottlenecksList && data.bottlenecksList.length > 0 ? (
              <div>
                <p className="text-base font-bold text-white mb-2 print:text-black">
                  {data.bottlenecksList[0].label}
                </p>
                <p className="text-xs text-zinc-300 leading-snug">
                  Concentra <span className="text-indigo-300 font-bold">{data.bottlenecksList[0].openRequestsCount} pedidos</span> parados com um tempo acumulado de <span className="text-indigo-300 font-bold">{data.bottlenecksList[0].totalDays.toFixed(1)} dias</span>.
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-400">Sem gargalos acumulados no momento.</p>
            )}
          </div>

          {/* Slowest Phase */}
          <div className="bg-black p-5 rounded-2xl border border-zinc-800 print:bg-zinc-50 print:border-zinc-200 hover:border-zinc-700 transition-colors">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block mb-1">Etapa Mais Lenta Historicamente</span>
            {data.overallAvgStatusList && data.overallAvgStatusList.length > 0 ? (
              <div>
                <p className="text-base font-bold text-white mb-2 print:text-black">
                  {data.overallAvgStatusList[0].label}
                </p>
                <p className="text-xs text-zinc-300 leading-snug">
                  Média de <span className="text-indigo-300 font-bold">{data.overallAvgStatusList[0].avgDays.toFixed(1)} dias</span> por pedido nesta etapa (Responsável: <span className="font-semibold">{data.overallAvgStatusList[0].isInternal ? 'Brasileiro' : 'Cliente'}</span>).
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-400">Sem histórico calculado.</p>
            )}
          </div>

          {/* Slower Condo */}
          <div className="bg-black p-5 rounded-2xl border border-zinc-800 print:bg-zinc-50 print:border-zinc-200 hover:border-zinc-700 transition-colors">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block mb-1">Condomínio Mais Lento p/ Aprovar</span>
            {data.slowestCondoToApprove ? (
              <div>
                <p className="text-base font-bold text-white mb-2 print:text-black">
                  {data.slowestCondoToApprove.name}
                </p>
                <p className="text-xs text-zinc-300 leading-snug">
                  Leva em média <span className="text-indigo-300 font-bold">{data.slowestCondoToApprove.avgClientDays.toFixed(1)} dias</span> para analisar e autorizar orçamentos.
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-400">Sem condomínio calculado.</p>
            )}
          </div>

          {/* Most Active Supplier */}
          <div className="bg-black p-5 rounded-2xl border border-zinc-800 print:bg-zinc-50 print:border-zinc-200 hover:border-zinc-700 transition-colors">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block mb-1">Fornecedor Mais Ativo (Cotações)</span>
            {data.mostActiveSupplier ? (
              <div>
                <p className="text-base font-bold text-white mb-2 print:text-black">
                  {data.mostActiveSupplier.name}
                </p>
                <p className="text-xs text-zinc-300 leading-snug">
                  Participou de <span className="text-indigo-300 font-bold">{data.mostActiveSupplier.totalParticipations} propostas</span> de preços, vencendo <span className="text-indigo-300 font-bold">{data.mostActiveSupplier.totalRequestsWon} vezes</span> ({Math.round(data.mostActiveSupplier.winRatePercent)}% eficiência).
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-400">Sem fornecedor calculado.</p>
            )}
          </div>

          {/* Top Category Volume */}
          <div className="bg-black p-5 rounded-2xl border border-zinc-800 print:bg-zinc-50 print:border-zinc-200 hover:border-zinc-700 transition-colors">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block mb-1">Maior Categoria (Volume)</span>
            {data.categoryVolumeSorted && data.categoryVolumeSorted.length > 0 ? (
              <div>
                <p className="text-base font-bold text-white mb-2 print:text-black">
                  {data.categoryVolumeSorted[0].name}
                </p>
                <p className="text-xs text-zinc-300 leading-snug">
                  Concentra <span className="text-indigo-300 font-bold">{data.categoryVolumeSorted[0].count} solicitações</span>, acumulando um valor aprovado de <span className="text-indigo-300 font-bold">R$ {data.categoryVolumeSorted[0].value.toLocaleString('pt-BR', {maximumFractionDigits: 0})}</span>.
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-400">Sem categoria calculada.</p>
            )}
          </div>

          {/* Top Category Value */}
          <div className="bg-black p-5 rounded-2xl border border-zinc-800 print:bg-zinc-50 print:border-zinc-200 hover:border-zinc-700 transition-colors">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block mb-1">Maior Categoria (Valor Aprovado)</span>
            {data.categoryValueSorted && data.categoryValueSorted.length > 0 ? (
              <div>
                <p className="text-base font-bold text-white mb-2 print:text-black">
                  {data.categoryValueSorted[0].name}
                </p>
                <p className="text-xs text-zinc-300 leading-snug">
                  Acumula <span className="text-indigo-300 font-bold">R$ {data.categoryValueSorted[0].value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span> distribuídos em <span className="text-indigo-300 font-bold">{data.categoryValueSorted[0].count} pedidos</span>.
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-400">Sem categoria calculada.</p>
            )}
          </div>
        </div>
      </div>

      {/* 3. CHARTS AND RANKINGS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:grid-cols-1">
        {/* Recharts Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm print:hidden">
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-600" /> Comparativo de Condomínios ({sortBy === 'value' ? 'Faturamento Aprovado' : 'Volume de Pedidos'})
            </h3>
            <div className="h-[320px] w-full">
              {sortedCondos.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sortedCondos.slice(0, 10)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#71717a'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#71717a'}} />
                      <RechartsTooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                          cursor={{fill: '#f4f4f5'}}
                      />
                      <Bar dataKey={sortBy === 'value' ? 'totalValue' : 'total'} radius={[6, 6, 0, 0]}>
                          {sortedCondos.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                      </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-400 text-sm font-medium">Sem dados suficientes</div>
              )}
            </div>
        </div>
        
        {/* Rich table ranking: Condos */}
        <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-widest mb-6 block border-b pb-3">Ranking de Condomínios</h3>
            <div className="space-y-4 max-h-[350px] overflow-y-auto">
                {sortedCondos.map((item: any, index: number) => (
                    <div key={item.id} className="flex items-center justify-between p-3.5 bg-zinc-50 hover:bg-zinc-100 transition-all rounded-2xl border border-zinc-100">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-zinc-400 w-5">{index + 1}º</span>
                            <div>
                              <span className="text-sm font-semibold text-zinc-900 block leading-tight">{item.name}</span>
                              <span className="text-[10px] text-zinc-500 font-medium font-mono">
                                SLA: {item.slaExtrapolated} exp / {item.completed} conc
                              </span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-extrabold text-zinc-900">
                                {sortBy === 'value' ? `R$ ${item.totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : `${item.total} p.`}
                            </p>
                            <p className="text-[9px] text-zinc-500 font-bold uppercase">Média: {item.avgTotalDays.toFixed(1)}d</p>
                        </div>
                    </div>
                ))}
                {sortedCondos.length === 0 && (
                  <p className="text-xs text-zinc-400 text-center py-6">Nenhum dado de condomínio.</p>
                )}
            </div>
        </div>
      </div>

      {/* 4. SUPPLIER RANKING ROW */}
      <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-widest mb-6 block border-b pb-3">
          Desempenho Geral de Fornecedores Comissionados / Aprovados
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans">
            <thead className="bg-zinc-50 text-[10px] uppercase font-black text-zinc-500 tracking-wider">
              <tr>
                <th className="px-5 py-3 rounded-l-xl">Classificação</th>
                <th className="px-5 py-3">Fornecedor</th>
                <th className="px-5 py-3 text-center">Partic. (Orçamentos)</th>
                <th className="px-5 py-3 text-center">Vencedor (Aprovado)</th>
                <th className="px-5 py-3 text-center">Eficiência (%)</th>
                <th className="px-5 py-3 text-right">Faturamento Ganho</th>
                <th className="px-5 py-3 text-right rounded-r-xl">Ticket Médio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm font-medium text-zinc-800">
              {sortedSuppliers.slice(0, 8).map((supplier, idx) => (
                <tr key={supplier.name} className="hover:bg-zinc-50/80 transition-colors">
                  <td className="px-5 py-3 font-bold text-zinc-400">{idx + 1}º</td>
                  <td className="px-5 py-3 font-semibold text-zinc-900">{supplier.name}</td>
                  <td className="px-5 py-3 text-center font-semibold text-zinc-500">{supplier.totalParticipations}</td>
                  <td className="px-5 py-3 text-center font-extrabold text-indigo-600">{supplier.totalRequestsWon}</td>
                  <td className="px-5 py-3 text-center font-bold text-emerald-600">
                    {Math.round(supplier.winRatePercent)}%
                  </td>
                  <td className="px-5 py-3 text-right font-black text-zinc-900">
                    R$ {supplier.totalValueWon.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-zinc-500">
                    R$ {supplier.avgTicket.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </td>
                </tr>
              ))}
              {sortedSuppliers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-zinc-400 text-xs font-semibold">Sem dados de fornecedores.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. OLDEST OPENED REQUESTS & TIME IN CURRENT STAGES */}
      <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-widest mb-6 block border-b pb-3 flex items-center gap-2">
          <Clock size={16} className="text-red-500" /> Os 5 Pedidos em Aberto Mais Demorados (Gargalos Críticos)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-[10px] uppercase font-black text-zinc-500 tracking-wider">
              <tr>
                <th className="px-5 py-3 rounded-l-xl">ID / Título</th>
                <th className="px-5 py-3">Condomínio</th>
                <th className="px-5 py-3">Status Atual</th>
                <th className="px-5 py-3 text-center">Prioridade</th>
                <th className="px-5 py-3 text-right">Tempo Parado na Etapa</th>
                <th className="px-5 py-3 text-right rounded-r-xl">Tempo Total Aberto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm text-zinc-800 font-medium">
              {data.slowestOpenList.slice(0, 5).map((r: any) => {
                const stepLog = r.timeline[r.timeline.length - 2] || r.timeline[0];
                const daysInStep = Math.max(0, (Date.now() - stepLog.time) / (1000 * 60 * 60 * 24));
                const totalDaysOpen = Math.max(0, r.totalMs / (1000 * 60 * 60 * 24));
                return (
                  <tr key={r.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-mono text-zinc-400 mr-2 block leading-none mb-1">ID: {r.id.slice(0, 8)}</span>
                      <span className="font-semibold text-zinc-900">{r.titulo}</span>
                    </td>
                    <td className="px-5 py-3 text-zinc-600 font-bold">{r.condominio_nome}</td>
                    <td className="px-5 py-3">
                      <span className="inline-block bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-block text-[10px] font-black px-2.5 py-1 rounded ${
                        r.nivel === 'N1' ? 'bg-red-50 text-red-700' : r.nivel === 'N2' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {r.nivel}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-500 font-extrabold">
                      {daysInStep.toFixed(1)} dias
                    </td>
                    <td className="px-5 py-3 text-right text-red-600 font-black">
                      {totalDaysOpen.toFixed(1)} dias
                    </td>
                  </tr>
                );
              })}
              {data.slowestOpenList.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-zinc-400 text-xs font-semibold">Sem pedidos em aberto.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

GeneralOverview.displayName = 'GeneralOverview';
