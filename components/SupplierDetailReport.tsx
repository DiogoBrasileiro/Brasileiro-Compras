import React, { useMemo, useState, forwardRef } from 'react';
import { 
  User, ShoppingBag, DollarSign, Clock, ShieldAlert, CheckCircle2, 
  Percent, FileText, ChevronRight, CheckSquare, Star, Award 
} from 'lucide-react';

export const SupplierDetailReport = forwardRef<HTMLDivElement, { data: any[], sortBy: 'value' | 'volume' }>(({ data, sortBy }, ref) => {
  const [selectedSupplierName, setSelectedSupplierName] = useState<string>('');

  const suppliersAvailable = useMemo(() => {
    return data || [];
  }, [data]);

  // Find active supplier
  const activeSupplier = useMemo(() => {
    if (suppliersAvailable.length === 0) return null;
    if (!selectedSupplierName) {
      return suppliersAvailable[0];
    }
    return suppliersAvailable.find(s => s.name === selectedSupplierName) || suppliersAvailable[0];
  }, [suppliersAvailable, selectedSupplierName]);

  // Overall Rankings positioning of this supplier
  const rankingPosition = useMemo(() => {
    if (!activeSupplier || suppliersAvailable.length === 0) return { valPos: 1, volPos: 1 };
    
    const valueSorted = [...suppliersAvailable].sort((a,b) => b.totalValueWon - a.totalValueWon);
    const volumeSorted = [...suppliersAvailable].sort((a,b) => b.totalRequestsWon - a.totalRequestsWon);
    
    const valPos = valueSorted.findIndex(s => s.name === activeSupplier.name) + 1;
    const volPos = volumeSorted.findIndex(s => s.name === activeSupplier.name) + 1;
    
    return { valPos, volPos };
  }, [suppliersAvailable, activeSupplier]);

  // Breakdown of top condos buying with this supplier
  const renderedCondos = useMemo(() => {
    if (!activeSupplier) return [];
    return Object.entries(activeSupplier.condosVolumeMap || {})
      .map(([name, count]) => ({ name, count, value: activeSupplier.condosValueMap[name] || 0 }))
      .sort((a,b) => b.value - a.value);
  }, [activeSupplier]);

  // Breakdown of top categories won
  const renderedCategories = useMemo(() => {
    if (!activeSupplier) return [];
    return Object.entries(activeSupplier.categoryVolumeMap || {})
      .map(([name, count]) => ({ name, count, value: activeSupplier.categoryValueMap[name] || 0 }))
      .sort((a,b) => b.value - a.value);
  }, [activeSupplier]);

  // Completed purchases lists
  const renderedPurchases = useMemo(() => {
    if (!activeSupplier || !activeSupplier.requestsList) return [];
    return activeSupplier.requestsList.filter((r: any) => r.orcamento_escolhido && r.status === 'CONCLUIDO');
  }, [activeSupplier]);

  // Rules-based executive summary
  const executiveSummary = useMemo(() => {
    if (!activeSupplier) return null;
    const s = activeSupplier;

    let commercialPerformance = 'Conversão regular (comercial dentro das médias normais de mercado).';
    if (s.winRatePercent > 35) {
      commercialPerformance = 'Excelente taxa de conversão comercial (acima de 35% das cotações vêm com vitória). Fornecedor altamente competitivo.';
    } else if (s.winRatePercent < 15) {
      commercialPerformance = 'Baixa conversão comercial (participa muito mas vence menos de 15%). Altamente recomendado auditar se o preço está fora do praticado.';
    }

    const strengthCategory = renderedCategories.length > 0 
      ? `Forte presença comercial principalmente em produtos e serviços de ${renderedCategories[0].name}.` 
      : 'Insumos gerais corporativos.';

    let consistencyDescription = 'Atende demandas de faturamento regular de ticket médio padrão.';
    if (s.avgTicket > 5000) {
      consistencyDescription = 'Parceiro estratégico de alto ticket médio faturado. Envolve pedidos complexos ou de alta valoração.';
    } else if (s.avgTicket < 800) {
      consistencyDescription = 'Adequado para transações frequentes de baixo valor e rapidez.';
    }

    let riskoOrOportunidade = '';
    if (s.avgDaysToDelivery > 10) {
      riskoOrOportunidade = 'Alerta de Prazo de Entrega: leva mais de 10 dias médios para entregar os pedidos. Altere a frequência contratual.';
    } else if (s.noAttachmentBudgetsCount > 0) {
      riskoOrOportunidade = `Inconsistência de Orçamento: identificamos ${s.noAttachmentBudgetsCount} cotações deste fornecedor enviadas sem arquivos PDFs de suporte de orçamento anexados.`;
    } else {
      riskoOrOportunidade = 'Excelente qualidade processual de compliance (todas as compras auditadas com comprovantes).';
    }

    return {
      commercialPerformance,
      strengthCategory,
      consistencyDescription,
      riskoOrOportunidade
    };
  }, [activeSupplier, renderedCategories]);

  if (!activeSupplier) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm text-center text-zinc-400 font-medium">
        Sem dados de fornecedores disponíveis.
      </div>
    );
  }

  const kpis = [
    { title: 'Cotações Participadas', value: activeSupplier.totalParticipations, sub: `${activeSupplier.totalRequestsWon} aprovados comerciais`, icon: ShoppingBag, color: 'bg-indigo-50 text-indigo-600' },
    { title: 'Faturamento Ganho', value: `R$ ${activeSupplier.totalValueWon.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, sub: `Ticket médio: R$ ${activeSupplier.avgTicket.toLocaleString('pt-BR', {minimumFractionDigits: 0})}`, icon: DollarSign, color: 'bg-emerald-50 text-emerald-600' },
    { title: 'Taxa de Aproveitamento', value: `${Math.round(activeSupplier.winRatePercent)}%`, sub: `Rejeitadas propostas: ${activeSupplier.totalOrdersRejected}`, icon: Percent, color: 'bg-violet-50 text-violet-600' },
    { title: 'Prazos de Entrega (SLA)', value: `${activeSupplier.avgDaysToDelivery.toFixed(1)} dias`, sub: `Prazo aprovação: ${activeSupplier.avgDaysToApproval.toFixed(1)}d`, icon: Clock, color: 'bg-amber-50 text-amber-600' }
  ];

  return (
    <div ref={ref} className="space-y-8">
      {/* SUPPLIER SELECTOR DROPDOWN */}
      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-lg font-bold text-zinc-950 flex items-center gap-2">
            <Award className="text-indigo-600" size={20} /> Análise Individual por Fornecedor
          </h2>
          <p className="text-xs text-zinc-500 mt-1">Selecione o fornecedor comercial para analisar propostas, faturamento e prazos de entrega.</p>
        </div>
        <select 
          value={activeSupplier.name} 
          onChange={(e) => setSelectedSupplierName(e.target.value)}
          className="p-3 bg-zinc-50 border border-zinc-200 text-sm font-semibold rounded-xl text-zinc-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer"
        >
          {suppliersAvailable.map(s => (
            <option key={s.name} value={s.name}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="text-2xl font-black text-zinc-950 tracking-tight flex items-center gap-2 border-b pb-2 hidden print:flex">
        <Award className="text-zinc-900" size={24} /> Relatório Individual: Fornecedor {activeSupplier.name}
      </div>

      {/* KPI CARDS */}
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

      {/* RANKINGS POSITIONING AND SUGGESTION RATIO IN GOVERNMENT */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-3xl">
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Posição no Ranking Geral</span>
          <div className="flex justify-between items-baseline mt-2">
            <div>
              <p className="text-lg font-extrabold text-zinc-900">{rankingPosition.valPos}º Colocado</p>
              <p className="text-[10px] text-zinc-500">Por faturamento ganho</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-extrabold text-zinc-900">{rankingPosition.volPos}º Colocado</p>
              <p className="text-[10px] text-zinc-500">Por volume aprovado</p>
            </div>
          </div>
        </div>

        <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-3xl">
          <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Alinhamento Técnico (Menor Preço)</span>
          <p className="text-lg font-extrabold text-zinc-900 mt-2">
            {activeSupplier.suggestedAsBestCount} vezes recomendado
          </p>
          <p className="text-[10px] text-zinc-500">Foi selecionado como melhor proposta pelas regras de menor custo.</p>
        </div>

        <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-3xl">
          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Conversão de Recomendações</span>
          <p className="text-lg font-extrabold text-zinc-900 mt-2">
            {activeSupplier.totalSuggestedAndApprovedCount} aprovados e recomendados
          </p>
          <p className="text-[10px] text-zinc-500">
            Aproveitamento de {activeSupplier.suggestedAsBestCount > 0 ? Math.round((activeSupplier.totalSuggestedAndApprovedCount/activeSupplier.suggestedAsBestCount)*100) : 0}% das recomendações.
          </p>
        </div>
      </div>

      {/* BR DOWN TABLES: CONDOS AND CATEGORIES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:grid-cols-1">
        {/* Condo Buyers */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 border-b pb-2">Condomínios que Mais Compram</h4>
          <div className="space-y-3 max-h-[220px] overflow-y-auto">
            {renderedCondos.map((c, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 font-bold">{idx + 1}º</span>
                  <span className="font-semibold text-zinc-800">{c.name}</span>
                </div>
                <div className="text-right font-medium">
                  <span className="font-bold text-zinc-950 block">R$ {c.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                  <span className="text-[10px] text-zinc-400 block">{c.count} pedidos</span>
                </div>
              </div>
            ))}
            {renderedCondos.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-4">Nenhum condomínio mapeado.</p>
            )}
          </div>
        </div>

        {/* Categories Won */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 border-b pb-2">Concentração por Categorias</h4>
          <div className="space-y-3 max-h-[220px] overflow-y-auto">
            {renderedCategories.map((c, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 font-bold">{idx + 1}º</span>
                  <span className="font-semibold text-zinc-800">{c.name}</span>
                </div>
                <div className="text-right font-medium">
                  <span className="font-bold text-zinc-950 block">R$ {c.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                  <span className="text-[10px] text-zinc-400 block">{c.count} pedidos</span>
                </div>
              </div>
            ))}
            {renderedCategories.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-4">Nenhuma categoria registrada.</p>
            )}
          </div>
        </div>
      </div>

      {/* PURCHASES TRANSACTION LOG */}
      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm text-sm">
        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 border-b pb-2">Histórico de Compras Concluídas</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-medium text-xs text-zinc-800">
            <thead className="bg-zinc-50 text-[10px] uppercase font-black text-zinc-400">
              <tr>
                <th className="px-4 py-3 rounded-l-xl">Protocolo / Pedido</th>
                <th className="px-4 py-3">Condomínio Destino</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3 text-right">Valor Bruto</th>
                <th className="px-4 py-3 text-right rounded-r-xl">Tempo de Entrega</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {renderedPurchases.slice(0, 8).map((p) => {
                const deliveryLog = p.timeline?.find((t: any) => t.status === 'CONCLUIDO');
                const approvalLog = p.timeline?.find((t: any) => t.status === 'APROVADO');
                const daysToDel = (deliveryLog && approvalLog) ? Math.max(0, (deliveryLog.time - approvalLog.time) / (1000 * 60 * 60 * 24)) : 0;
                return (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <span className="text-[9px] text-zinc-400 font-mono block">ID: {p.id.slice(0,8)}</span>
                      <span className="font-bold text-zinc-900 block max-w-[200px] text-ellipsis overflow-hidden whitespace-nowrap">{p.titulo}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-zinc-600">{p.condominio_nome}</td>
                    <td className="px-4 py-3 text-zinc-500 font-bold">{p.categoria}</td>
                    <td className="px-4 py-3 text-right font-black text-zinc-950">
                      R$ {p.chosenValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-600">
                      {daysToDel > 0 ? `${daysToDel.toFixed(1)} dias` : 'No mesmo dia'}
                    </td>
                  </tr>
                );
              })}
              {renderedPurchases.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-zinc-400">Nenhuma transação comercial concluída.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXECUTIVE SUMMARY OF SUPPLIER */}
      {executiveSummary && (
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 text-white p-8 rounded-3xl border border-zinc-800 shadow-xl print:text-zinc-950 print:bg-none print:border-zinc-200">
          <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2 print:text-zinc-950">
            <FileText size={18} /> Diagnóstico Executivo de Fornecedor ({activeSupplier.name})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Performance Comercial & Conversão</h4>
                <p className="text-xs text-zinc-200 leading-relaxed print:text-zinc-800">{executiveSummary.commercialPerformance}</p>
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Foco de Mercado & Segmento</h4>
                <p className="text-xs text-zinc-200 leading-relaxed print:text-zinc-800">{executiveSummary.strengthCategory}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Consistência Financeira & Ticket</h4>
                <p className="text-xs text-zinc-200 leading-relaxed print:text-zinc-800">{executiveSummary.consistencyDescription}</p>
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-rose-400 uppercase tracking-widest mb-1">Alertas Processuais, Risco ou Oportunidade</h4>
                <p className="text-xs text-rose-300 font-bold leading-relaxed print:text-zinc-800">{executiveSummary.riskoOrOportunidade}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

SupplierDetailReport.displayName = 'SupplierDetailReport';
