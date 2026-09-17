import React, { forwardRef, useMemo, useState } from 'react';
import { Solicitacao, RequestStatus } from '../types';
import { Clock, CheckCircle, AlertTriangle, AlertCircle, TrendingDown, TrendingUp, Building, ArrowRight, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

interface PerformanceReportProps {
    requests: Solicitacao[];
}

// Function to map description to RequestStatus if explicit status is missing.
const inferStatusFromLog = (descOrig: string, reqStatusIfAny?: RequestStatus): RequestStatus | null => {
    if (reqStatusIfAny) return reqStatusIfAny;
    const desc = descOrig.toLowerCase();
    if (desc.includes('solicitação criada')) return RequestStatus.NOVO;
    if (desc.includes('cotação com fornecedores')) return RequestStatus.EM_COTACAO;
    if (desc.includes('finalizadas internamente')) return RequestStatus.ORCAMENTOS_PRONTOS;
    if (desc.includes('orçamentos enviados')) return RequestStatus.AGUARDANDO_ACAO_CONDOMINIO;
    if (desc.includes('orçamentos recebidos')) return RequestStatus.EM_ANALISE_CONDOMINIO;
    if (desc.includes('aprovação formal por')) return RequestStatus.APROVADO;
    if (desc.includes('pedido de compra confirmado')) return RequestStatus.EM_PEDIDO;
    if (desc.includes('entrega agendada')) return RequestStatus.AGUARDANDO_ENTREGA;
    if (desc.includes('entrega confirmada') || desc.includes('concluido') || desc.includes('concluído')) return RequestStatus.CONCLUIDO;
    if (desc.includes('brasileiro') && desc.includes('reprovada')) return RequestStatus.REPROVADO_BRASILEIRO;
    if (desc.includes('falta de resposta')) return RequestStatus.REPROVADO_SEM_RESPOSTA;
    if (desc.includes('declinada') || desc.includes('reprovada') || desc.includes('cancelad')) return RequestStatus.CANCELADO;
    
    return null;
};

const CLIENT_STATUSES = [RequestStatus.AGUARDANDO_ACAO_CONDOMINIO, RequestStatus.EM_ANALISE_CONDOMINIO];
const INTERNAL_STATUSES = [
    RequestStatus.NOVO, 
    RequestStatus.EM_COTACAO, 
    RequestStatus.ORCAMENTOS_PRONTOS, 
    RequestStatus.EM_PEDIDO, 
    RequestStatus.AGUARDANDO_ENTREGA, 
    RequestStatus.APROVADO
];

const PRETTY_STATUS = {
    [RequestStatus.NOVO]: 'Novo',
    [RequestStatus.EM_COTACAO]: 'Em Cotação',
    [RequestStatus.ORCAMENTOS_PRONTOS]: 'Orçamentos Prontos',
    [RequestStatus.AGUARDANDO_ACAO_CONDOMINIO]: 'Aguardando Ação do Condomínio',
    [RequestStatus.EM_ANALISE_CONDOMINIO]: 'Em Análise pelo Condomínio',
    [RequestStatus.APROVADO]: 'Aprovado',
    [RequestStatus.EM_PEDIDO]: 'Em Pedido',
    [RequestStatus.AGUARDANDO_ENTREGA]: 'Aguardando Entrega',
    [RequestStatus.CONCLUIDO]: 'Concluído',
    [RequestStatus.CANCELADO]: 'Cancelado',
    [RequestStatus.RECUSADO]: 'Recusado',
    [RequestStatus.REPROVADO_BRASILEIRO]: 'Reprovado Brasileiro',
    [RequestStatus.REPROVADO_SEM_RESPOSTA]: 'Encerrado sem resposta'
} as Record<string, string>;

export const PerformanceReport = forwardRef<HTMLDivElement, PerformanceReportProps>(({ requests }, ref) => {
    const [selectedCondo, setSelectedCondo] = useState<string>('all');

    const performanceData = useMemo(() => {
        // Only use requests to analyze
        const filteredRequests = requests; 
        
        // 1. Process histories to extract EXACT status intervals
        const processedRequests = filteredRequests.map(req => {
            const history = req.historico || [];
            
            // We'll create a normalized timeline of (timestamp, status)
            const timeline: { time: number, status: RequestStatus }[] = [];
            
            // The creation timestamp is always status NOVO
            timeline.push({ time: new Date(req.data_solicitacao).getTime(), status: RequestStatus.NOVO });
            
            // Reconstruct status changes
            const sortedLogs = [...history].sort((a,b) => new Date(a.data).getTime() - new Date(b.data).getTime());
            
            for (const log of sortedLogs) {
                const inferred = inferStatusFromLog(log.descricao, log.status);
                if (inferred && inferred !== timeline[timeline.length - 1]?.status) {
                    timeline.push({ time: new Date(log.data).getTime(), status: inferred });
                }
            }
            
            const isTerminal = [RequestStatus.CONCLUIDO, RequestStatus.CANCELADO, RequestStatus.RECUSADO, RequestStatus.REPROVADO_BRASILEIRO, RequestStatus.REPROVADO_SEM_RESPOSTA].includes(timeline[timeline.length - 1]?.status);
            
            if (!isTerminal) {
                timeline.push({ time: Date.now(), status: timeline[timeline.length - 1]?.status }); // Dummy end for duration calculation
            }
            
            // Calculate durations
            let totalInternalMs = 0;
            let totalClientMs = 0;
            let totalMs = 0;
            
            const statusDurations: Record<string, number> = {};
            
            for (let i = 0; i < timeline.length - 1; i++) {
                const current = timeline[i];
                const next = timeline[i + 1];
                const diff = next.time - current.time;
                
                totalMs += diff;
                
                if (INTERNAL_STATUSES.includes(current.status)) {
                    totalInternalMs += diff;
                } else if (CLIENT_STATUSES.includes(current.status)) {
                    totalClientMs += diff;
                }
                
                statusDurations[current.status] = (statusDurations[current.status] || 0) + diff;
            }
            
            const completed = isTerminal && timeline[timeline.length - 1]?.status === RequestStatus.CONCLUIDO;
            
            return {
                ...req,
                timeline,
                totalMs,
                totalInternalMs,
                totalClientMs,
                statusDurations,
                isCompleted: completed,
                isTerminal,
                isOpen: !isTerminal
            };
        });
        
        let targetRequests = processedRequests;
        if (selectedCondo !== 'all') {
            targetRequests = targetRequests.filter(r => r.condominio_id === selectedCondo);
        }
        
        const openRequestsCount = targetRequests.filter(r => r.isOpen).length;
        const completedRequestsCount = targetRequests.filter(r => r.isCompleted).length;
        const totalRequests = targetRequests.length;
        
        const completedOnly = targetRequests.filter(r => r.isCompleted);
        const avgTotalTimeMs = completedOnly.length > 0 ? completedOnly.reduce((sum, r) => sum + r.totalMs, 0) / completedOnly.length : 0;
        const avgInternalMs = completedOnly.length > 0 ? completedOnly.reduce((sum, r) => sum + r.totalInternalMs, 0) / completedOnly.length : 0;
        const avgClientMs = completedOnly.length > 0 ? completedOnly.reduce((sum, r) => sum + r.totalClientMs, 0) / completedOnly.length : 0;
        
        // Average per status (across all target requests that ever HAD that status)
        const statusAggregates: Record<string, { totalMs: number, count: number }> = {};
        for (const req of targetRequests) {
            for (const [status, ms] of Object.entries(req.statusDurations)) {
                const numericMs = ms as number;
                if (numericMs > 0) {
                    if (!statusAggregates[status]) statusAggregates[status] = { totalMs: 0, count: 0 };
                    statusAggregates[status].totalMs += numericMs;
                    statusAggregates[status].count += 1;
                }
            }
        }
        
        const avgStatusList = Object.entries(statusAggregates).map(([status, agg]) => ({
            status,
            label: PRETTY_STATUS[status] || status,
            avgMs: agg.totalMs / agg.count,
            avgDays: (agg.totalMs / agg.count) / (1000 * 60 * 60 * 24),
            isInternal: INTERNAL_STATUSES.includes(status as RequestStatus)
        })).sort((a,b) => b.avgMs - a.avgMs);
        
        const outOfSlaCount = targetRequests.filter(r => r.fora_do_prazo || r.totalMs > (15 * 24 * 60 * 60 * 1000)).length;
        
        // Condo Ranking
        const condoStatsMap = new Map<string, { name: string, completed: number, open: number, totalTimeMs: number, clientTimeMs: number }>();
        for (const r of processedRequests.filter(x => x.isCompleted)) {
             if (!condoStatsMap.has(r.condominio_id)) {
                 condoStatsMap.set(r.condominio_id, { name: r.condominio_nome, completed: 0, open: 0, totalTimeMs: 0, clientTimeMs: 0 });
             }
             const st = condoStatsMap.get(r.condominio_id)!;
             st.completed += 1;
             st.totalTimeMs += r.totalMs;
             st.clientTimeMs += r.totalClientMs;
        }
        for (const r of processedRequests.filter(x => x.isOpen)) {
             if (!condoStatsMap.has(r.condominio_id)) {
                 condoStatsMap.set(r.condominio_id, { name: r.condominio_nome, completed: 0, open: 0, totalTimeMs: 0, clientTimeMs: 0 });
             }
             const st = condoStatsMap.get(r.condominio_id)!;
             st.open += 1;
        }
        
        const condoRanking = Array.from(condoStatsMap.values()).map(c => ({
             ...c,
             avgDays: c.completed > 0 ? (c.totalTimeMs / c.completed) / (1000 * 60 * 60 * 24) : 0,
             avgClientDays: c.completed > 0 ? (c.clientTimeMs / c.completed) / (1000 * 60 * 60 * 24) : 0,
        })).sort((a,b) => b.avgDays - a.avgDays);

        // Slowest Open Requests (bottlenecks)
        const openList = targetRequests.filter(r => r.isOpen).sort((a,b) => b.totalMs - a.totalMs).slice(0, 10);
        
        return {
            totalRequests,
            openRequestsCount,
            completedRequestsCount,
            avgTotalTimeDays: avgTotalTimeMs / (1000 * 60 * 60 * 24),
            avgInternalDays: avgInternalMs / (1000 * 60 * 60 * 24),
            avgClientDays: avgClientMs / (1000 * 60 * 60 * 24),
            avgStatusList,
            outOfSlaCount,
            condoRanking,
            openList,
            processedRequests
        };
    }, [requests, selectedCondo]);

    const uniqueCondos = useMemo(() => {
        const cMap = new Map<string, string>();
        requests.forEach(r => {
            if (r.condominio_id) cMap.set(r.condominio_id, r.condominio_nome);
        });
        return Array.from(cMap.entries()).map(([id, name]) => ({ id, name }));
    }, [requests]);

    return (
        <div ref={ref} className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm animate-fadeIn space-y-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b pb-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-950 flex items-center gap-2">
                    <Activity size={22} className="text-indigo-600" /> Desempenho Operacional e Gargalos de Tempo
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">Análise de tempo médio de processamento por condomínio, responsável e etapa.</p>
                </div>
                <div className="flex bg-zinc-100 p-1 rounded-xl w-72">
                    <select 
                        value={selectedCondo} 
                        onChange={(e) => setSelectedCondo(e.target.value)}
                        className="w-full bg-white text-sm py-2 px-3 rounded-lg text-zinc-800 font-semibold border-0 focus:ring-2 focus:ring-indigo-500 shadow-sm"
                    >
                        <option value="all">Filtro: Todos os Condomínios</option>
                        {uniqueCondos.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* TOP CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-3xl p-5 relative overflow-hidden group">
                    <h3 className="text-indigo-700 text-[10px] font-black uppercase tracking-wider mb-2">Pedidos Concluídos</h3>
                    <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-black text-indigo-950">{performanceData.completedRequestsCount}</p>
                        <span className="text-[10px] font-bold text-indigo-600">/ {performanceData.totalRequests} total</span>
                    </div>
                </div>

                <div className="bg-orange-50/60 border border-orange-100 rounded-3xl p-5 relative overflow-hidden group">
                    <h3 className="text-orange-700 text-[10px] font-black uppercase tracking-wider mb-2">Carga em Aberto</h3>
                    <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-black text-orange-950">{performanceData.openRequestsCount}</p>
                        <span className="text-[10px] font-bold text-orange-600">compras ativas</span>
                    </div>
                </div>

                <div className="bg-green-50/60 border border-green-100 rounded-3xl p-5 relative overflow-hidden group">
                    <h3 className="text-green-700 text-[10px] font-black uppercase tracking-wider mb-2">Tempo de Conclusão</h3>
                    <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-black text-green-950">{performanceData.avgTotalTimeDays.toFixed(1)}</p>
                        <span className="text-[10px] font-bold text-green-600">dias médios</span>
                    </div>
                </div>

                <div className="bg-red-50/60 border border-red-100 rounded-3xl p-5 relative overflow-hidden group">
                    <h3 className="text-rose-700 text-[10px] font-black uppercase tracking-wider mb-2">Extrapolou o SLA</h3>
                    <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-black text-rose-950">{performanceData.outOfSlaCount}</p>
                        <span className="text-[10px] font-bold text-rose-600">pedidos</span>
                    </div>
                </div>
            </div>

            {/* SPLIT TIMES: INTERNAL vs CLIENT */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-zinc-100 rounded-3xl p-6 bg-zinc-50/50 flex items-center justify-between hover:border-indigo-200 transition-colors">
                    <div>
                        <h3 className="text-xs font-black uppercase text-zinc-500 mb-1">Tempo Interno (Acordo Brasileiro)</h3>
                        <p className="text-xs text-zinc-500 max-w-[280px] mb-3 leading-snug">Tempo gasto pelo time interno em cotações, orçamentos e pedidos de compra.</p>
                        <p className="text-2xl font-black text-zinc-900">{performanceData.avgInternalDays.toFixed(1)} <span className="text-xs text-zinc-500 font-bold uppercase">dias médios</span></p>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 font-extrabold">
                        <Building size={20}/>
                    </div>
                </div>
                
                <div className="border border-zinc-100 rounded-3xl p-6 bg-zinc-50/50 flex items-center justify-between hover:border-purple-200 transition-colors">
                    <div>
                        <h3 className="text-xs font-black uppercase text-zinc-500 mb-1">Tempo do Cliente (Análise & Aprovação)</h3>
                        <p className="text-xs text-zinc-500 max-w-[280px] mb-3 leading-snug">Tempo que o condomínio demora para examinar relatórios e confirmar a compra.</p>
                        <p className="text-2xl font-black text-purple-900">{performanceData.avgClientDays.toFixed(1)} <span className="text-xs text-purple-500 font-bold uppercase">dias médios</span></p>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 font-extrabold">
                        <Clock size={20}/>
                    </div>
                </div>
            </div>

            {/* BAR CHART: TIMES BY STATUS */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-6">
                <h3 className="text-xs font-bold text-zinc-900 mb-6 uppercase tracking-widest text-center">Tempo Médio Gasto em Cadeia por Etapa (Dias corridos)</h3>
                <div className="h-[280px] w-full print:hidden">
                    {performanceData.avgStatusList.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={performanceData.avgStatusList} layout="vertical" margin={{ top: 0, right: 30, left: 140, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4B5563', fontSize: 11, fontWeight: 600 }} width={130}/>
                                <RechartsTooltip 
                                    cursor={{fill: 'transparent'}}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-zinc-950 text-white text-xs p-3 rounded-xl shadow-xl border border-zinc-800">
                                                    <p className="font-bold mb-1">{data.label}</p>
                                                    <p>Média: <span className="text-indigo-400 font-bold">{data.avgDays.toFixed(1)} dias</span></p>
                                                    <p className="text-zinc-400">Responsabilidade: {data.isInternal ? 'Brasileiro' : 'Condomínio (Cliente)'}</p>
                                                </div>
                                            )
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="avgDays" radius={[0, 6, 6, 0]} barSize={20}>
                                    {performanceData.avgStatusList.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.isInternal ? '#4f46e5' : '#8b5cf6'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-zinc-400 font-semibold text-xs">Aguardando dados estruturados.</div>
                    )}
                </div>
                <div className="flex gap-6 mt-4 justify-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-md bg-indigo-600"></span>
                      <span>Etapa Brasileiro</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-md bg-purple-500"></span>
                      <span>Etapa Cliente</span>
                    </div>
                </div>
            </div>

            {/* CONDO RANKING STATS TABLE */}
            {selectedCondo === 'all' && (
                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest border-b pb-2">Ranking de Eficiência e Lentidão por Condomínio</h3>
                    <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden">
                        <table className="w-full text-left text-xs font-medium text-zinc-800">
                            <thead className="bg-zinc-50 text-[10px] uppercase font-black text-zinc-500">
                                <tr>
                                    <th className="px-5 py-3.5">Condomínio</th>
                                    <th className="px-5 py-3.5 text-center">Concluídos</th>
                                    <th className="px-5 py-3.5 text-right font-black">Tempo Total de Conclusão</th>
                                    <th className="px-5 py-3.5 text-right text-purple-700 font-black rounded-r-xl">Demora p/ Responder Cliente</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {performanceData.condoRanking.map((c, i) => (
                                    <tr key={i} className="hover:bg-zinc-50 transition-colors">
                                        <td className="px-5 py-3 font-bold text-zinc-900">{c.name}</td>
                                        <td className="px-5 py-3 text-center text-zinc-500 font-semibold">{c.completed}</td>
                                        <td className="px-5 py-3 text-right font-black text-zinc-900">{c.avgDays.toFixed(1)} dias</td>
                                        <td className="px-5 py-3 text-right font-black text-purple-700">{c.avgClientDays.toFixed(1)} dias</td>
                                    </tr>
                                ))}
                                {performanceData.condoRanking.length === 0 && (
                                    <tr><td colSpan={4} className="px-5 py-6 text-center text-zinc-400 text-xs">Nenhum condomínio mapeado.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* LONGEST OPENED REQUESTS FOR PORT */}
            <div className="space-y-4">
                 <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-widest flex items-center gap-2 border-b pb-2"><AlertCircle size={15} className="text-rose-500"/> Pedidos em Aberto Atuais com Maior Tempo de Atraso</h3>
                 <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden">
                    <table className="w-full text-left text-xs text-zinc-800 font-medium">
                        <thead className="bg-zinc-50 text-[10px] uppercase font-black text-zinc-500">
                            <tr>
                                <th className="px-5 py-3.5">Protocolo / Título</th>
                                <th className="px-5 py-3.5">Condomínio</th>
                                <th className="px-5 py-3.5">Etapa de Parada</th>
                                <th className="px-5 py-3.5 text-right">Dias na Mesma Etapa</th>
                                <th className="px-5 py-3.5 text-right text-rose-600 rounded-r-xl font-black">Tempo de Atraso Acumulado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {performanceData.openList.map((r, i) => {
                                const currentStatusData = r.timeline[r.timeline.length - 2]; 
                                const timeInStep = Date.now() - (currentStatusData ? currentStatusData.time : r.timeline[0].time);
                                return (
                                <tr key={r.id} className="hover:bg-zinc-50 transition-colors">
                                    <td className="px-5 py-3.5">
                                        <span className="text-[10px] font-mono text-zinc-400 block leading-none mb-1">ID: {r.id.slice(0, 8)}</span>
                                        <span className="font-bold text-zinc-900">{r.titulo}</span>
                                    </td>
                                    <td className="px-5 py-3.5 font-bold text-zinc-600">{r.condominio_nome}</td>
                                    <td className="px-5 py-3.5">
                                      <span className="inline-block text-[9px] bg-zinc-100 text-zinc-700 px-2.5 py-1 rounded font-black uppercase tracking-wider">
                                        {PRETTY_STATUS[r.status] || r.status}
                                      </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-right font-extrabold text-zinc-500">{(timeInStep / (1000 * 60 * 60 * 24)).toFixed(1)} dias</td>
                                    <td className="px-5 py-3.5 text-right font-black text-rose-600">{(r.totalMs / (1000 * 60 * 60 * 24)).toFixed(1)} dias</td>
                                </tr>
                            )})}
                            {performanceData.openList.length === 0 && (
                                <tr><td colSpan={5} className="px-5 py-6 text-center text-zinc-400 text-xs">Nenhum gargalo em aberto identificado.</td></tr>
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>
            
        </div>
    );
});

PerformanceReport.displayName = 'PerformanceReport';
