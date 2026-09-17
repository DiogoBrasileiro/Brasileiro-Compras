import React, { useMemo, useState, forwardRef } from 'react';
import { 
  Building, ShoppingBag, DollarSign, Clock, AlertTriangle, 
  CheckCircle2, AlertCircle, FileText, Check, HelpCircle, ArrowDownCircle, ShieldAlert 
} from 'lucide-react';

export const CondoDetailReport = forwardRef<HTMLDivElement, { data: any[], sortBy: 'value' | 'volume' }>(({ data, sortBy }, ref) => {
  // We allow selecting a specific condo from the list of computed stats
  const [selectedCondoId, setSelectedCondoId] = useState<string>('');

  const condosAvailable = useMemo(() => {
    return data || [];
  }, [data]);

  // Default to first condo if none selected
  const activeCondo = useMemo(() => {
    if (condosAvailable.length === 0) return null;
    if (!selectedCondoId) {
      return condosAvailable[0];
    }
    return condosAvailable.find(c => c.id === selectedCondoId) || condosAvailable[0];
  }, [condosAvailable, selectedCondoId]);

  // Sort completed requests of active condo
  const requestsAnalysis = useMemo(() => {
    if (!activeCondo || !activeCondo.requestsList) return { slow: [], fast: [], completed: [], all: [] };
    const list = [...activeCondo.requestsList];
    const completed = list.filter(r => r.status === 'CONCLUIDO');
    
    const slow = [...list].sort((a,b) => b.totalMs - a.totalMs).slice(0, 5);
    const fast = [...completed].sort((a,b) => a.totalMs - b.totalMs).slice(0, 5);
    
    return { slow, fast, completed, all: list };
  }, [activeCondo]);

  // Executive analysis calculation
  const executiveSummary = useMemo(() => {
    if (!activeCondo) return null;
    const ac = activeCondo;

    const positivePoints = [];
    if (ac.avgClientDays < 2.5) {
      positivePoints.push('Excelente tempo de resposta para aprovação de orçamentos (menos de 2.5 dias em média).');
    }
    if (ac.avgQuotesPerRequest >= 3) {
      positivePoints.push('Nível de conformidade alto: média de 3 ou mais cotações por solicitação.');
    }
    if (ac.potentialSavings > 1500) {
      positivePoints.push('Aproveitamento expressivo de negociação comercial de fornecedores.');
    }
    if (positivePoints.length === 0) {
      positivePoints.push('Fluxo regular e contínuo de envio de demandas de compras.');
    }

    const gargalos = [];
    if (ac.avgClientDays > 5) {
      gargalos.push('Tempo excessivo de análise pelo condomínio (média maior que 5 dias).');
    }
    if (ac.lessThanThreeBudgetsCount > 0) {
      gargalos.push(`Presença de ${ac.lessThanThreeBudgetsCount} solicitações tratadas com menos de 3 orçamentos.`);
    }
    if (gargalos.length === 0) {
      gargalos.push('Nenhum gargalo processual crítico detectado no momento.');
    }

    let riskLevel = 'BAIXO';
    const emergencyRate = ac.total > 0 ? (ac.emergenciesCount / ac.total) : 0;
    if (emergencyRate > 0.4) {
      riskLevel = 'ALTO (Mais de 40% das solicitações são urgentes N1)';
    } else if (ac.slaExtrapolated > 0) {
      riskLevel = 'MÉDIO (Existem solicitações fora do SLA acordado)';
    }

    // Padrão de Consumo
    const topCats = Object.entries(ac.categoryVolumeMap || {})
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 2)
      .map(([cat]) => cat);
    const consumoPattern = topCats.length > 0 
      ? `Mais voltado para as categorias de: ${topCats.join(' e ')}.`
      : 'Uso diversificado de compras sem categoria dominante.';

    // Qualidade da resposta
    const responseQuality = ac.avgClientDays <= 2 
      ? 'Excelente e ágil' 
      : ac.avgClientDays <= 5 
        ? 'Dentro da média esperada' 
        : 'Lenta / Crítica (atrasa compras)';

    const improvements = [
      'Planejar demandas não emergenciais com maior antecedência para diminuir pedidos N1.',
      ac.lessThanThreeBudgetsCount > 0 ? 'Garantir que todas as propostas atinjam 3 orçamentos antes da decisão.' : 'Manter a rigorosa auditoria de propostas de fornecedores.'
    ];

    if (ac.potentialSavings > 0) {
      improvements.push(`Adicionar foco na escolha do menor preço quando aplicável para otimizar os R$ ${ac.potentialSavings.toLocaleString('pt-BR', {maximumFractionDigits: 0})} de diferença.`);
    }

    return {
      positivePoints,
      gargalos,
      riskLevel,
      consumoPattern,
      responseQuality,
      improvements
    };
  }, [activeCondo]);

  if (!activeCondo) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm text-center text-zinc-400 font-medium">
        Sem dados de condomínio disponíveis.
      </div>
    );
  }

  // Categories and supplier lists
  const renderedCategories = Object.entries(activeCondo.categoryVolumeMap || {})
    .map(([name, count]) => ({ name, count, value: activeCondo.categoryValueMap[name] || 0 }))
    .sort((a,b) => b.value - a.value);

  const renderedSuppliers = Object.entries(activeCondo.supplierVolumeMap || {})
    .map(([name, count]) => ({ name, count, value: activeCondo.supplierValueMap[name] || 0 }))
    .sort((a,b) => b.value - a.value);

  const kpis = [
    { title: 'Solicitações', value: activeCondo.total, sub: `${activeCondo.completed} concluídas / ${activeCondo.open} abertas`, icon: ShoppingBag, color: 'bg-indigo-50 text-indigo-600' },
    { title: 'Faturamento Aprovado', value: `R$ ${activeCondo.totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, sub: `Ticket: R$ ${activeCondo.avgTicket.toLocaleString('pt-BR', {minimumFractionDigits: 0})}`, icon: DollarSign, color: 'bg-emerald-50 text-emerald-600' },
    { title: 'Aprovação Cliente (Tempo)', value: `${activeCondo.avgClientDays.toFixed(1)} dias`, sub: `Tempo total médio: ${activeCondo.avgTotalDays.toFixed(1)}d`, icon: Clock, color: 'bg-violet-50 text-violet-600' },
    { title: 'SLA Extrapolado', value: `${activeCondo.slaExtrapolated} pedidos`, sub: `${activeCondo.emergenciesCount} urgências N1`, icon: AlertTriangle, color: 'bg-amber-50 text-amber-600' }
  ];

  return (
    <div ref={ref} className="space-y-8">
      {/* CONDO SELECTOR DROPDOWN */}
      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-lg font-bold text-zinc-950 flex items-center gap-2">
            <Building className="text-indigo-600" size={20} /> Análise Individual por Condomínio
          </h2>
          <p className="text-xs text-zinc-500 mt-1">Selecione o condomínio para visualizar indicadores, SLA e economia.</p>
        </div>
        <select 
          value={selectedCondoId || activeCondo.id} 
          onChange={(e) => setSelectedCondoId(e.target.value)}
          className="p-3 bg-zinc-50 border border-zinc-200 text-sm font-semibold rounded-xl text-zinc-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer"
        >
          {condosAvailable.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="text-2xl font-black text-zinc-950 tracking-tight flex items-center gap-2 border-b pb-2 hidden print:flex">
        <Building className="text-zinc-900" size={24} /> Relatório Individual: {activeCondo.name}
      </div>

      {/* KPIs FOR ACTIVE CONDO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-2">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`p-3.5 rounded-2xl ${kpi.color}`}>
              <kpi.icon size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">{kpi.title}</p>
              <p className="text-xl font-extrabold text-zinc-900 leading-none mb-1">{kpi.value}</p>
              <p className="text-[10px] text-zinc-500 font-medium">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ECONOMIA / ANÁLISE OPERACIONAL COMPANION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl flex items-center justify-between">
          <div>
            <h4 className="text-emerald-800 text-xs font-bold uppercase tracking-wider mb-1">Economia Possível</h4>
            <p className="text-sm text-emerald-700 max-w-sm leading-snug">Diferença em relação aos orçamentos de menor proposta já recebidos.</p>
            <p className="text-2xl font-black text-emerald-900 mt-2">R$ {activeCondo.potentialSavings.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
          </div>
          <ArrowDownCircle size={48} className="text-emerald-500/30" />
        </div>

        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl flex items-center justify-between">
          <div>
            <h4 className="text-indigo-800 text-xs font-bold uppercase tracking-wider mb-1">Conformidade e Cobertura</h4>
            <p className="text-sm text-indigo-700 max-w-sm leading-snug">Média de cotações obtidas e solicitações com baixa competitividade.</p>
            <p className="text-2xl font-black text-indigo-900 mt-2">
              {activeCondo.avgQuotesPerRequest.toFixed(1)} <span className="text-sm font-medium">cotações/pedido</span>
            </p>
          </div>
          <CheckCircle2 size={48} className="text-indigo-500/30" />
        </div>
      </div>

      {/* DETAILED DATA: CATEGORIES AND SUPPLIERS TABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:grid-cols-1">
        {/* Categories rank */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 border-b pb-2">Consumo por Categoria</h4>
          <div className="space-y-3 max-h-[220px] overflow-y-auto">
            {renderedCategories.map((c, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 font-bold">{idx + 1}º</span>
                  <span className="font-semibold text-zinc-800">{c.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-zinc-950 block">R$ {c.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                  <span className="text-[10px] text-zinc-400">{c.count} pedidos</span>
                </div>
              </div>
            ))}
            {renderedCategories.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-4">Sem dados por categoria.</p>
            )}
          </div>
        </div>

        {/* Suppliers rank */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 border-b pb-2">Fornecedores Credenciados Escolhidos</h4>
          <div className="space-y-3 max-h-[220px] overflow-y-auto">
            {renderedSuppliers.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 font-bold">{idx + 1}º</span>
                  <span className="font-semibold text-zinc-800">{s.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-zinc-950 block">R$ {s.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                  <span className="text-[10px] text-zinc-400">{s.count} vezes</span>
                </div>
              </div>
            ))}
            {renderedSuppliers.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-4">Nenhum fornecedor aprovado.</p>
            )}
          </div>
        </div>
      </div>

      {/* JUSTIFICATIONS OF SELECTED ORCAMENTOS */}
      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 border-b pb-2">
          Justificativas de Escolhas dos Orçamentos Aprovados pelo Cliente
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-medium text-zinc-800">
            <thead className="bg-zinc-50 text-[10px] uppercase font-black text-zinc-500">
              <tr>
                <th className="px-4 py-3 rounded-l-xl">Protocolo / Solicitação</th>
                <th className="px-4 py-3">Fornecedor Escolhido</th>
                <th className="px-4 py-3 text-right">Valor Aprovado</th>
                <th className="px-4 py-3 rounded-r-xl">Justificativa do Condomínio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {requestsAnalysis.all.filter(r => r.chosenValue > 0).slice(0, 6).map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <span className="text-[9px] font-mono text-zinc-400 block">ID: {r.id.slice(0,8)}</span>
                    <span className="font-bold whitespace-nowrap overflow-hidden text-zinc-900 block max-w-[200px] text-ellipsis">{r.titulo}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">{r.chosenBudget?.fornecedor || '-'}</td>
                  <td className="px-4 py-3 text-right font-black text-zinc-900 text-xs">
                    R$ {r.chosenValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </td>
                  <td className="px-4 py-3 italic text-zinc-600 max-w-[350px]">
                    {r.justificativa_condominio || <span className="text-rose-500 font-extrabold not-italic uppercase text-[10px]">Sem justificativa registrada!</span>}
                  </td>
                </tr>
              ))}
              {requestsAnalysis.all.filter(r => r.chosenValue > 0).length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-zinc-400">Nenhum pedido aprovado com valores registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SPEED LISTS: LONGEST vs FASTEST */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:grid-cols-1">
        {/* Slowest */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 border-b pb-2 flex items-center gap-1.5 text-rose-600">
            <ShieldAlert size={14} /> Solicitações Mais Lentas (SLA Vencendo/Crítico)
          </h4>
          <div className="space-y-3">
            {requestsAnalysis.slow.map((r, i) => (
              <div key={r.id} className="flex justify-between items-center bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                <div>
                  <span className="text-xs font-semibold text-zinc-950 block">{r.titulo}</span>
                  <span className="text-[10px] text-zinc-400 block font-mono">Status: {r.status}</span>
                </div>
                <span className="text-xs font-black text-rose-600">{(r.totalMs / (1000 * 60 * 60 * 24)).toFixed(1)} dias</span>
              </div>
            ))}
            {requestsAnalysis.slow.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-4">Sem solicitações lentas.</p>
            )}
          </div>
        </div>

        {/* Fastest */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 border-b pb-2 flex items-center gap-1.5 text-emerald-600">
            <CheckCircle2 size={14} /> Compras Concluídas Mais Rápidas
          </h4>
          <div className="space-y-3">
            {requestsAnalysis.fast.map((r, i) => (
              <div key={r.id} className="flex justify-between items-center bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                <div>
                  <span className="text-xs font-semibold text-zinc-950 block">{r.titulo}</span>
                  <span className="text-[10px] text-zinc-400 block font-mono">Atendido por: {r.chosenBudget?.fornecedor || '-'}</span>
                </div>
                <span className="text-xs font-black text-emerald-600">{(r.totalMs / (1000 * 60 * 60 * 24)).toFixed(1)} dias</span>
              </div>
            ))}
            {requestsAnalysis.fast.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-4">Nenhuma concluída listada.</p>
            )}
          </div>
        </div>
      </div>

      {/* EXECUTIVE ANALYSIS SUMMARY CARD */}
      {executiveSummary && (
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 text-white p-8 rounded-3xl border border-zinc-800 shadow-xl print:text-zinc-950 print:bg-none print:border-zinc-200">
          <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2 print:text-zinc-950">
            <FileText size={18} /> Resumo Executivo da Gestão do Condomínio ({activeCondo.name})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Pontos Positivos</h4>
                <ul className="list-disc pl-4 text-xs text-zinc-200 space-y-1 leading-relaxed print:text-zinc-800">
                  {executiveSummary.positivePoints.map((pt, i) => <li key={i}>{pt}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Gargalos Encontrados</h4>
                <ul className="list-disc pl-4 text-xs text-rose-300 space-y-1 leading-relaxed print:text-zinc-800">
                  {executiveSummary.gargalos.map((pt, i) => <li key={i}>{pt}</li>)}
                </ul>
              </div>
              <div className="pt-2 border-t border-zinc-800/60">
                <p className="text-xs text-zinc-300">
                  <span className="font-bold text-zinc-400 uppercase mr-1">Risco Operacional:</span> 
                  <span className="text-white font-black print:text-black">{executiveSummary.riskLevel}</span>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1 font-mono">Padrão de Consumo Praticado</h4>
                <p className="text-xs text-zinc-200 leading-relaxed print:text-zinc-800">{executiveSummary.consumoPattern}</p>
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Análise da Qualidade de Resposta</h4>
                <p className="text-xs text-indigo-300 font-extrabold print:text-zinc-800">{executiveSummary.responseQuality}</p>
              </div>
              <div className="pt-3 border-t border-zinc-800/60">
                <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest mb-2 print:text-zinc-950">Oportunidades de Melhoria Operacional</h4>
                <ul className="list-decimal pl-4 text-xs text-zinc-200 space-y-1 leading-relaxed print:text-zinc-800">
                  {executiveSummary.improvements.map((pt, i) => <li key={i}>{pt}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

CondoDetailReport.displayName = 'CondoDetailReport';
