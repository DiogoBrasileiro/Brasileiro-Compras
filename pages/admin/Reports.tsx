import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { RequestStatus, RequestLevel, RequestType, Solicitacao } from '../../types';
import { Download, Calendar, Building, Filter, TrendingUp, Info, CheckCircle2, ShieldCheck, Award, HelpCircle, Clock } from 'lucide-react';
import { GeneralOverview } from '../../components/GeneralOverview';
import { CondoDetailReport } from '../../components/CondoDetailReport';
import { SupplierDetailReport } from '../../components/SupplierDetailReport';
import { PerformanceReport } from '../../components/PerformanceReport';
import { GovernanceReport } from '../../components/GovernanceReport';
import { AssemblyReport } from '../../components/AssemblyReport';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Timing analysis helpers
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

export const Reports: React.FC = () => {
  const { requests, categories } = useApp();
  const [activeTab, setActiveTab] = useState<'general' | 'condo' | 'supplier' | 'performance' | 'governance' | 'assembly'>('general');
  
  const printRef = useRef<HTMLDivElement>(null);
  const fullPrintRef = useRef<HTMLDivElement>(null);
  const [isExportingFull, setIsExportingFull] = useState(false);

  // --- EXPANDED FILTERS STATE ---
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [condoFilter, setCondoFilter] = useState('all');
  
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  
  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlySlaExtrapolated, setOnlySlaExtrapolated] = useState(false);

  const [sortBy, setSortBy] = useState<'value' | 'volume'>('value');

  // Load list of unique suppliers for filters dropdown
  const uniqueSuppliers = useMemo(() => {
    const sups = new Set<string>();
    requests.forEach(r => {
      r.orcamentos?.forEach(o => {
        if (o.fornecedor) sups.add(o.fornecedor);
      });
    });
    return Array.from(sups).sort();
  }, [requests]);

  const uniqueCondos = useMemo(() => {
      const condos = new Map<string, string>();
      requests.forEach(r => {
          if (r.condominio_id && r.condominio_nome) {
              condos.set(r.condominio_id, r.condominio_nome);
          }
      });
      return Array.from(condos.entries()).map(([id, name]) => ({ id, name }));
  }, [requests]);

  // Consolidate calculations for all screens
  const analytics = useMemo(() => {
    // Safely deduplicate raw requests list by ID to prevent duplicate items downstream
    const uniqueRequests = Array.from(new Map(requests.map(r => [r.id, r])).values()) as Solicitacao[];

    // Filter raw list based on chosen values
    const rawFiltered = uniqueRequests.filter(req => {
        const reqDate = new Date(req.data_solicitacao);
        if (dateStart && reqDate < new Date(dateStart)) return false;
        if (dateEnd) {
           const endDate = new Date(dateEnd);
           endDate.setHours(23, 59, 59);
           if (reqDate > endDate) return false;
        }
        if (categoryFilter !== 'all') {
            if (req.category_id !== categoryFilter && req.categoria !== categoryFilter) return false;
        }
        if (condoFilter !== 'all') {
            if (req.condominio_id !== condoFilter) return false;
        }
        if (supplierFilter !== 'all') {
            const hasSupplier = req.orcamentos?.some(o => o.fornecedor === supplierFilter);
            const chosenSupplier = req.orcamentos?.find(o => o.numero === req.orcamento_escolhido)?.fornecedor;
            if (chosenSupplier !== supplierFilter && !hasSupplier) return false;
        }
        if (priorityFilter !== 'all') {
            if (req.nivel !== priorityFilter) return false;
        }
        if (statusFilter !== 'all') {
            if (req.status !== statusFilter) return false;
        }
        if (typeFilter !== 'all') {
            if (req.tipo !== typeFilter) return false;
        }
        if (onlyCompleted) {
            if (req.status !== RequestStatus.CONCLUIDO) return false;
        }
        if (onlyOpen) {
            const isTerminal = [
              RequestStatus.CONCLUIDO, RequestStatus.CANCELADO, RequestStatus.RECUSADO, 
              RequestStatus.REPROVADO_BRASILEIRO, RequestStatus.REPROVADO_SEM_RESPOSTA
            ].includes(req.status);
            if (isTerminal) return false;
        }
        if (onlySlaExtrapolated) {
            if (!req.fora_do_prazo) return false;
        }
        return true;
    });

    // Parse timelines and enrich requests
    const processed = rawFiltered.map(req => {
        const creationTime = new Date(req.data_solicitacao).getTime();
        const history = req.historico || [];
        const timeline: { time: number, status: RequestStatus }[] = [];
        timeline.push({ time: creationTime, status: RequestStatus.NOVO });

        const sortedLogs = [...history].sort((a,b) => new Date(a.data).getTime() - new Date(b.data).getTime());
        for (const log of sortedLogs) {
            const inferred = inferStatusFromLog(log.descricao, log.status);
            if (inferred && inferred !== timeline[timeline.length - 1]?.status) {
                timeline.push({ time: new Date(log.data).getTime(), status: inferred });
            }
        }

        const lastStatus = timeline[timeline.length - 1]?.status || req.status;
        const isTerminal = [
            RequestStatus.CONCLUIDO, RequestStatus.CANCELADO, RequestStatus.RECUSADO, 
            RequestStatus.REPROVADO_BRASILEIRO, RequestStatus.REPROVADO_SEM_RESPOSTA
        ].includes(lastStatus);

        const timeEnd = isTerminal && sortedLogs.length > 0
            ? new Date(sortedLogs[sortedLogs.length - 1].data).getTime()
            : Date.now();

        const totalMs = timeEnd - creationTime;

        let totalInternalMs = 0;
        let totalClientMs = 0;
        const statusDurations: Record<string, number> = {};

        for (let i = 0; i < timeline.length; i++) {
            const current = timeline[i];
            const nextTime = (i < timeline.length - 1) ? timeline[i + 1].time : timeEnd;
            const diff = nextTime - current.time;

            if (diff > 0) {
                statusDurations[current.status] = (statusDurations[current.status] || 0) + diff;
                if (INTERNAL_STATUSES.includes(current.status)) {
                    totalInternalMs += diff;
                } else if (CLIENT_STATUSES.includes(current.status)) {
                    totalClientMs += diff;
                }
            }
        }

        const chosenBudget = req.orcamentos?.find(o => o.numero === req.orcamento_escolhido);
        const chosenValue = chosenBudget ? chosenBudget.valor : 0;

        // Potential savings comparison
        let minBudgetValue = chosenValue;
        let minBudgetSupplier = chosenBudget?.fornecedor || '';
        if (req.orcamentos && req.orcamentos.length > 0) {
            req.orcamentos.forEach(o => {
                if (o.valor < minBudgetValue || minBudgetValue === 0) {
                    minBudgetValue = o.valor;
                    minBudgetSupplier = o.fornecedor;
                }
            });
        }
        const potentialSavings = chosenValue > 0 && minBudgetValue > 0 ? Math.max(0, chosenValue - minBudgetValue) : 0;

        return {
            ...req,
            timeline,
            totalMs,
            totalInternalMs,
            totalClientMs,
            statusDurations,
            isCompleted: req.status === RequestStatus.CONCLUIDO,
            isTerminal,
            isOpen: !isTerminal,
            chosenBudget,
            chosenValue,
            potentialSavings,
            minBudgetValue,
            minBudgetSupplier
        };
    });

    const totalOrders = processed.length;
    const completedCount = processed.filter(r => r.status === RequestStatus.CONCLUIDO).length;
    const openCount = processed.filter(r => r.isOpen).length;
    const pendingClientCount = processed.filter(r => CLIENT_STATUSES.includes(r.status)).length;
    const slaExtrapolatedCount = processed.filter(r => r.fora_do_prazo || r.totalMs > (15 * 24 * 60 * 60 * 1000)).length;
    
    const approvedValue = processed.reduce((sum, r) => sum + r.chosenValue, 0);
    const ticketMedio = approvedValue > 0 ? (approvedValue / (processed.filter(r => r.chosenValue > 0).length || 1)) : 0;
    
    const completedRequests = processed.filter(r => r.isCompleted);
    const avgTotalTimeMs = completedRequests.length > 0 ? completedRequests.reduce((sum, r) => sum + r.totalMs, 0) / completedRequests.length : 0;
    const avgInternalMs = completedRequests.length > 0 ? completedRequests.reduce((sum, r) => sum + r.totalInternalMs, 0) / completedRequests.length : 0;
    const avgClientMs = completedRequests.length > 0 ? completedRequests.reduce((sum, r) => sum + r.totalClientMs, 0) / completedRequests.length : 0;

    const lessThanThreeBudgetsCount = processed.filter(r => r.orcamentos?.length < 3).length;
    const missingChoiceJustificationCount = processed.filter(r => r.chosenValue > 0 && !r.justificativa_condominio?.trim()).length;
    const inconsistentOrSymbolicValuesCount = processed.filter(r => r.chosenValue > 0 && r.chosenValue <= 1.5).length;

    // Status breakdown counts
    const statusBreakdown: Record<string, number> = {};
    processed.forEach(r => {
        statusBreakdown[r.status] = (statusBreakdown[r.status] || 0) + 1;
    });

    // Category breakdown counts
    const categoryBreakdown: Record<string, { count: number, value: number }> = {};
    processed.forEach(r => {
        const cat = r.categoria || 'Sem categoria';
        if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { count: 0, value: 0 };
        categoryBreakdown[cat].count += 1;
        categoryBreakdown[cat].value += r.chosenValue;
    });

    // Condo calculations
    const condoBreakdownMap: Record<string, any> = {};
    processed.forEach(r => {
        if (!r.condominio_id) return;
        if (!condoBreakdownMap[r.condominio_id]) {
            condoBreakdownMap[r.condominio_id] = {
                id: r.condominio_id,
                name: r.condominio_nome || 'Condomínio',
                total: 0,
                completed: 0,
                open: 0,
                pendingClient: 0,
                slaExtrapolated: 0,
                totalValue: 0,
                avgTicket: 0,
                totalMs: 0,
                totalClientMs: 0,
                totalInternalMs: 0,
                totalBudgetsCount: 0,
                emergenciesCount: 0,
                lessThanThreeBudgetsCount: 0,
                assemblyRequiredCount: 0,
                hasJustificationCount: 0,
                potentialSavings: 0,
                categoryVolumeMap: {},
                categoryValueMap: {},
                supplierVolumeMap: {},
                supplierValueMap: {},
                statusDurations: {},
                statusCounts: {},
                requestsList: []
            };
        }

        const entry = condoBreakdownMap[r.condominio_id];
        entry.total += 1;
        if (!entry.requestsList.some((x: any) => x.id === r.id)) {
            entry.requestsList.push(r);
        }
        if (r.status === RequestStatus.CONCLUIDO) {
            entry.completed += 1;
            entry.totalMs += r.totalMs;
            entry.totalClientMs += r.totalClientMs;
            entry.totalInternalMs += r.totalInternalMs;
        }
        if (r.isOpen) entry.open += 1;
        if (CLIENT_STATUSES.includes(r.status)) entry.pendingClient += 1;
        if (r.fora_do_prazo || r.totalMs > (15 * 24 * 60 * 60 * 1000)) entry.slaExtrapolated += 1;
        
        entry.totalValue += r.chosenValue;
        entry.totalBudgetsCount += r.orcamentos?.length || 0;
        if (r.nivel === RequestLevel.N1) entry.emergenciesCount += 1;
        if ((r.orcamentos?.length || 0) < 3) entry.lessThanThreeBudgetsCount += 1;
        if (r.assembly_data?.required) entry.assemblyRequiredCount += 1;
        if (r.justificativa_condominio?.trim()) entry.hasJustificationCount += 1;
        entry.potentialSavings += r.potentialSavings;

        const cat = r.categoria || 'Sem categoria';
        entry.categoryVolumeMap[cat] = (entry.categoryVolumeMap[cat] || 0) + 1;
        entry.categoryValueMap[cat] = (entry.categoryValueMap[cat] || 0) + r.chosenValue;

        const sup = r.chosenBudget?.fornecedor;
        if (sup) {
            entry.supplierVolumeMap[sup] = (entry.supplierVolumeMap[sup] || 0) + 1;
            entry.supplierValueMap[sup] = (entry.supplierValueMap[sup] || 0) + r.chosenValue;
        }

        entry.statusCounts[r.status] = (entry.statusCounts[r.status] || 0) + 1;
        Object.entries(r.statusDurations).forEach(([st, ms]) => {
            entry.statusDurations[st] = (entry.statusDurations[st] || 0) + ms;
        });
    });

    const condoStats = Object.values(condoBreakdownMap).map(c => ({
        ...c,
        avgTicket: c.totalValue > 0 ? c.totalValue / (c.requestsList.filter((x: any) => x.chosenValue > 0).length || 1) : 0,
        avgTotalDays: c.completed > 0 ? (c.totalMs / c.completed) / (1000 * 60 * 60 * 24) : 0,
        avgClientDays: c.completed > 0 ? (c.totalClientMs / c.completed) / (1000 * 60 * 60 * 24) : 0,
        avgInternalDays: c.completed > 0 ? (c.totalInternalMs / c.completed) / (1000 * 60 * 60 * 24) : 0,
        avgQuotesPerRequest: c.totalBudgetsCount / c.total
    }));

    // Supplier calculations
    const supplierBreakdownMap: Record<string, any> = {};
    processed.forEach(r => {
        if (r.orcamentos && r.orcamentos.length > 0) {
            r.orcamentos.forEach(o => {
                const sName = o.fornecedor;
                if (!sName) return;
                if (!supplierBreakdownMap[sName]) {
                    supplierBreakdownMap[sName] = {
                        name: sName,
                        totalParticipations: 0,
                        totalValueWon: 0,
                        totalRequestsWon: 0,
                        totalOrdersRejected: 0,
                        avgDaysToApproval: 0,
                        avgDaysToDelivery: 0,
                        condosVolumeMap: {},
                        condosValueMap: {},
                        categoryVolumeMap: {},
                        categoryValueMap: {},
                        requestsList: [],
                        chosenSuggestedCount: 0,
                        chosenNotSuggestedCount: 0,
                        suggestedAsBestCount: 0,
                        totalSuggestedAndApprovedCount: 0,
                        deliveryTimesMs: [],
                        approvalTimesMs: [],
                        noAttachmentBudgetsCount: 0
                    };
                }

                const sEntry = supplierBreakdownMap[sName];
                sEntry.totalParticipations += 1;
                if (!sEntry.requestsList.some((x: any) => x.id === r.id)) {
                    sEntry.requestsList.push(r);
                }

                if (!o.attachments || o.attachments.length === 0) {
                    sEntry.noAttachmentBudgetsCount += 1;
                }

                const isBestProposed = o.is_melhor_proposta || o.recomendado;
                if (isBestProposed) sEntry.suggestedAsBestCount += 1;

                const isChosen = r.orcamento_escolhido === o.numero;
                if (isChosen) {
                    sEntry.totalRequestsWon += 1;
                    sEntry.totalValueWon += o.valor;

                    if (isBestProposed) {
                        sEntry.totalSuggestedAndApprovedCount += 1;
                        sEntry.chosenSuggestedCount += 1;
                    } else {
                        sEntry.chosenNotSuggestedCount += 1;
                    }

                    const cName = r.condominio_nome || 'Desconhecido';
                    sEntry.condosVolumeMap[cName] = (sEntry.condosVolumeMap[cName] || 0) + 1;
                    sEntry.condosValueMap[cName] = (sEntry.condosValueMap[cName] || 0) + o.valor;

                    const cat = r.categoria || 'Sem categoria';
                    sEntry.categoryVolumeMap[cat] = (sEntry.categoryVolumeMap[cat] || 0) + 1;
                    sEntry.categoryValueMap[cat] = (sEntry.categoryValueMap[cat] || 0) + o.valor;

                    const dateApprovedLog = r.timeline?.find(t => t.status === RequestStatus.APROVADO);
                    if (dateApprovedLog) {
                        const creationTime = new Date(r.data_solicitacao).getTime();
                        sEntry.approvalTimesMs.push(dateApprovedLog.time - creationTime);

                        if (r.status === RequestStatus.CONCLUIDO) {
                            const deliveryLog = r.timeline?.find(t => t.status === RequestStatus.CONCLUIDO);
                            if (deliveryLog) sEntry.deliveryTimesMs.push(deliveryLog.time - dateApprovedLog.time);
                        }
                    }
                } else {
                    sEntry.totalOrdersRejected += 1;
                }
            });
        }
    });

    const supplierStats = Object.values(supplierBreakdownMap).map(s => {
        const avgApp = s.approvalTimesMs.length > 0 ? (s.approvalTimesMs.reduce((acc: number, v: number) => acc + v, 0) / s.approvalTimesMs.length) / (1000 * 60 * 60 * 24) : 0;
        const avgDel = s.deliveryTimesMs.length > 0 ? (s.deliveryTimesMs.reduce((acc: number, v: number) => acc + v, 0) / s.deliveryTimesMs.length) / (1000 * 60 * 60 * 24) : 0;
        return {
            ...s,
            avgDaysToApproval: avgApp,
            avgDaysToDelivery: avgDel,
            avgTicket: s.totalRequestsWon > 0 ? s.totalValueWon / s.totalRequestsWon : 0,
            winRatePercent: s.totalParticipations > 0 ? (s.totalRequestsWon / s.totalParticipations) * 100 : 0
        };
    });

    const overallStatusAggregates: Record<string, { totalMs: number, count: number }> = {};
    processed.forEach(r => {
        Object.entries(r.statusDurations).forEach(([st, msVal]) => {
            const ms = msVal as number;
            if (ms > 0) {
                if (!overallStatusAggregates[st]) overallStatusAggregates[st] = { totalMs: 0, count: 0 };
                overallStatusAggregates[st].totalMs += ms;
                overallStatusAggregates[st].count += 1;
            }
        });
    });

    const overallAvgStatusList = Object.entries(overallStatusAggregates).map(([st, agg]) => ({
        status: st,
        label: PRETTY_STATUS[st] || st,
        avgMs: agg.totalMs / agg.count,
        avgDays: (agg.totalMs / agg.count) / (1000 * 60 * 60 * 24),
        isInternal: INTERNAL_STATUSES.includes(st as RequestStatus)
    })).sort((a,b) => b.avgMs - a.avgMs);

    const stageAccumulatedTime: Record<string, any> = {};
    processed.forEach(r => {
        if (r.isOpen) {
            const currentStatus = r.status;
            const currentStatusLog = r.timeline[r.timeline.length - 2] || r.timeline[0];
            const diffMs = Date.now() - currentStatusLog.time;
            
            if (!stageAccumulatedTime[currentStatus]) {
                stageAccumulatedTime[currentStatus] = {
                    totalMs: 0,
                    label: PRETTY_STATUS[currentStatus] || currentStatus,
                    isInternal: INTERNAL_STATUSES.includes(currentStatus),
                    openRequestsCount: 0
                };
            }
            stageAccumulatedTime[currentStatus].totalMs += diffMs;
            stageAccumulatedTime[currentStatus].openRequestsCount += 1;
        }
    });

    const bottlenecksList = Object.entries(stageAccumulatedTime).map(([status, item]: any) => ({
        status,
        ...item,
        totalDays: item.totalMs / (1000 * 60 * 60 * 24)
    })).sort((a,b) => b.totalMs - a.totalMs);

    const slowestCondoToApprove = condoStats.length > 0 
        ? [...condoStats].sort((a,b) => b.avgClientDays - a.avgClientDays)[0]
        : null;

    const mostActiveSupplier = supplierStats.length > 0
        ? [...supplierStats].sort((a,b) => b.totalParticipations - a.totalParticipations)[0]
        : null;

    const categoryVolumeSorted = Object.entries(categoryBreakdown).map(([name, item]) => ({ name, ...item })).sort((a,b) => b.count - a.count);
    const categoryValueSorted = Object.entries(categoryBreakdown).map(([name, item]) => ({ name, ...item })).sort((a,b) => b.value - a.value);

    const slowestOpenList = processed.filter(r => r.isOpen).sort((a,b) => b.totalMs - a.totalMs).slice(0, 10);

    return {
        processed,
        filteredCount: processed.length,
        filtered: rawFiltered,
        kpis: {
            totalOrders,
            completedCount,
            openCount,
            pendingClientCount,
            slaExtrapolatedCount,
            approvedValue,
            ticketMedio,
            avgTotalTimeDays: avgTotalTimeMs / (1000 * 60 * 60 * 24),
            avgInternalDays: avgInternalMs / (1000 * 60 * 60 * 24),
            avgClientDays: avgClientMs / (1000 * 60 * 60 * 24),
            lessThanThreeBudgetsCount,
            missingChoiceJustificationCount,
            inconsistentOrSymbolicValuesCount,
        },
        statusBreakdown,
        categoryBreakdown,
        categoryVolumeSorted,
        categoryValueSorted,
        condoStats,
        supplierStats,
        overallAvgStatusList,
        bottlenecksList,
        slowestCondoToApprove,
        mostActiveSupplier,
        slowestOpenList
    };
  }, [requests, dateStart, dateEnd, categoryFilter, condoFilter, supplierFilter, priorityFilter, statusFilter, typeFilter, onlyCompleted, onlyOpen, onlySlaExtrapolated]);

  const exportToPDF = async () => {
    if (!printRef.current) return;
    
    const originalHeight = printRef.current.style.height;
    const originalOverflow = printRef.current.style.overflow;
    
    printRef.current.style.height = 'auto';
    printRef.current.style.overflow = 'visible';

    try {
      const canvas = await html2canvas(printRef.current, { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        windowWidth: printRef.current.scrollWidth,
        windowHeight: printRef.current.scrollHeight
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`relatorio_${activeTab}_${new Date().getTime()}.pdf`);
    } finally {
      printRef.current.style.height = originalHeight;
      printRef.current.style.overflow = originalOverflow;
    }
  };

  const exportFullPDF = async () => {
    setIsExportingFull(true);
    setTimeout(async () => {
        if (!fullPrintRef.current) {
            setIsExportingFull(false);
            return;
        }

        const originalHeight = fullPrintRef.current.style.height;
        const originalOverflow = fullPrintRef.current.style.overflow;
        
        fullPrintRef.current.style.height = 'auto';
        fullPrintRef.current.style.overflow = 'visible';

        try {
            const canvas = await html2canvas(fullPrintRef.current, { 
                scale: 1.8, 
                useCORS: true, 
                logging: false,
                windowWidth: 1200,
                windowHeight: fullPrintRef.current.scrollHeight
            });
            
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;
            
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position -= pageHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pageHeight;
            }
            
            pdf.save(`relatorio_completo_filtrado_${new Date().getTime()}.pdf`);
        } catch (e) {
            console.error(e);
            alert("Erro ao exportar PDF completo.");
        } finally {
            fullPrintRef.current.style.height = originalHeight;
            fullPrintRef.current.style.overflow = originalOverflow;
            setIsExportingFull(false);
        }
    }, 1000);
  };

  return (
    <div className="space-y-8 p-8 bg-zinc-50 min-h-screen">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-zinc-950 tracking-tight flex items-center gap-2">
            Relatórios Gerenciais <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-bold">Painel Executivo</span>
          </h1>
          <p className="text-zinc-500 mt-1">Visões analíticas de governança, auditoria de parceiros e eficácia financeira.</p>
        </div>
        <div className="flex gap-3">
            <button 
                onClick={exportFullPDF}
                disabled={isExportingFull}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50 cursor-pointer uppercase tracking-wider"
            >
              <Download size={16} /> {isExportingFull ? 'Compilando...' : 'Baixar Completo'}
            </button>
            <button onClick={exportToPDF} disabled={isExportingFull} className="flex items-center gap-2 bg-white text-zinc-900 px-5 py-3 rounded-xl text-xs font-bold hover:bg-zinc-100 transition-all border border-zinc-200 shadow-sm disabled:opacity-50 cursor-pointer uppercase tracking-wider">
              <Download size={16} /> Exportar Aba Atual
            </button>
        </div>
      </div>

      {/* FILTERS BAR - MODERN DOUBLE LAYER GRID */}
      <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6">
              <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 mb-2.5"><Calendar size={13} className="text-indigo-500"/> Data Início</label>
                  <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-full p-3 rounded-xl border border-zinc-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"/>
              </div>
              <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 mb-2.5"><Calendar size={13} className="text-indigo-500"/> Data Fim</label>
                  <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-full p-3 rounded-xl border border-zinc-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"/>
              </div>
              <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 mb-2.5"><Building size={13} className="text-indigo-500"/> Condomínio</label>
                  <select value={condoFilter} onChange={e => setCondoFilter(e.target.value)} className="w-full p-3 rounded-xl border border-zinc-200 text-xs font-semibold bg-zinc-50 cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all">
                      <option value="all">Todos os Condomínios</option>
                      {uniqueCondos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
              </div>
              <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 mb-2.5"><Filter size={13} className="text-indigo-500"/> Categoria</label>
                  <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full p-3 rounded-xl border border-zinc-200 text-xs font-semibold bg-zinc-50 cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all">
                      <option value="all">Todas as Categorias</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
              </div>
              <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 mb-2.5"><Award size={13} className="text-indigo-500"/> Fornecedor</label>
                  <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} className="w-full p-3 rounded-xl border border-zinc-200 text-xs font-semibold bg-zinc-50 cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all">
                      <option value="all">Todos os Fornecedores</option>
                      {uniqueSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
              </div>
              <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 mb-2.5"><TrendingUp size={13} className="text-indigo-500"/> Clas. por Ranking</label>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as 'value' | 'volume')} className="w-full p-3 rounded-xl border border-zinc-200 text-xs font-semibold bg-zinc-50 cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all">
                      <option value="value">Faturamento Ganho</option>
                      <option value="volume">Volume de Pedidos</option>
                  </select>
              </div>
          </div>

          {/* ADVANCED REFINED FILTERS (Second row) */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-4 border-t border-zinc-100">
              <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">Responsável / Prioridade</label>
                  <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="w-full p-3 rounded-xl border border-zinc-200 text-xs font-semibold bg-zinc-50 focus:ring-2 focus:ring-indigo-500 transition-all">
                      <option value="all">Qualquer Prioridade (N1/N2/N3)</option>
                      <option value="N1">Norteador N1 (Urgente)</option>
                      <option value="N2">Norteador N2 (Médio)</option>
                      <option value="N3">Norteador N3 (Planejado)</option>
                  </select>
              </div>
              <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">Status do Fluxo</label>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full p-3 rounded-xl border border-zinc-200 text-xs font-semibold bg-zinc-50 focus:ring-2 focus:ring-indigo-500 transition-all">
                      <option value="all">Qualquer Etapa/Status</option>
                      {Object.values(RequestStatus).map((st) => (
                        <option key={st} value={st}>{PRETTY_STATUS[st] || st}</option>
                      ))}
                  </select>
              </div>
              <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">Tipo de Solicitação</label>
                  <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full p-3 rounded-xl border border-zinc-200 text-xs font-semibold bg-zinc-50 focus:ring-2 focus:ring-indigo-500 transition-all">
                      <option value="all">Todas (Recorrentes & Avulsas)</option>
                      <option value={RequestType.RECORRENTE}>Contratos Recorrentes</option>
                      <option value={RequestType.AVULSA_MELHORIA}>Investimentos / Obras Avulsas</option>
                  </select>
              </div>

              {/* BOOLEAN AUDITING CHECKBOXES */}
              <div className="flex flex-wrap gap-4 items-center justify-start h-full pt-4 md:col-span-3 lg:col-span-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-600 hover:text-indigo-600 transition-colors">
                      <input type="checkbox" checked={onlyCompleted} onChange={e => setOnlyCompleted(e.target.checked)} className="rounded text-indigo-600 border-zinc-300 focus:ring-indigo-500 h-4 w-4"/>
                      <span>Só Concluídos</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-600 hover:text-indigo-600 transition-colors">
                      <input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} className="rounded text-indigo-600 border-zinc-300 focus:ring-indigo-500 h-4 w-4"/>
                      <span>Só Ativos / Aberto</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-600 hover:text-indigo-600 transition-colors">
                      <input type="checkbox" checked={onlySlaExtrapolated} onChange={e => setOnlySlaExtrapolated(e.target.checked)} className="rounded text-indigo-600 border-zinc-300 focus:ring-indigo-500 h-4 w-4"/>
                      <span className="text-rose-600">SLA Estrapolado</span>
                  </label>
              </div>
          </div>
      </div>

      {/* TABS NAVIGATION WITH STYLISH PILL */}
      <div className="flex gap-2 bg-zinc-100 p-1.5 rounded-2xl w-fit overflow-x-auto max-w-full">
          {[
            { id: 'general', label: 'Visão Geral' },
            { id: 'condo', label: 'Por Condomínio' },
            { id: 'supplier', label: 'Por Fornecedor' },
            { id: 'performance', label: 'Performance de Status' },
            { id: 'governance', label: 'Auditoria & Governança' },
            { id: 'assembly', label: 'Prestação de Contas / Assembleia' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)} 
              className={`px-6 py-2.5 text-xs font-bold rounded-xl transition-all uppercase tracking-wider whitespace-nowrap cursor-pointer ${activeTab === tab.id ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
            >
              {tab.label}
            </button>
          ))}
      </div>

      {/* PRINT REF ZONE FOR SCREEN CAPTURE */}
      <div ref={printRef} className="space-y-6 pt-2">
        {(dateStart || dateEnd || condoFilter !== 'all' || categoryFilter !== 'all' || supplierFilter !== 'all' || priorityFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all' || onlyCompleted || onlyOpen || onlySlaExtrapolated) && (
            <div className="bg-white border border-zinc-200 p-5 rounded-3xl flex flex-col gap-3 shadow-sm">
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Info size={14} className="text-zinc-400"/> Filtros Ativos no Download PDF / Visão
                </h4>
                <div className="flex flex-wrap gap-2">
                    {dateStart && <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">De: {dateStart.split('-').reverse().join('/')}</span>}
                    {dateEnd && <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Até: {dateEnd.split('-').reverse().join('/')}</span>}
                    {condoFilter !== 'all' && <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Condomínio: {uniqueCondos.find(c => c.id === condoFilter)?.name || condoFilter}</span>}
                    {categoryFilter !== 'all' && <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Categoria: {categories.find(c => c.id === categoryFilter)?.name || categoryFilter}</span>}
                    {supplierFilter !== 'all' && <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Fornecedor: {supplierFilter}</span>}
                    {priorityFilter !== 'all' && <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">SLA Prioridade: {priorityFilter}</span>}
                    {statusFilter !== 'all' && <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Fase: {statusFilter}</span>}
                    {typeFilter !== 'all' && <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Tipo: {typeFilter}</span>}
                    {onlyCompleted && <span className="bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full text-[10px] font-black uppercase">Só Concluídos</span>}
                    {onlyOpen && <span className="bg-amber-50 text-amber-800 px-3 py-1 rounded-full text-[10px] font-black uppercase">Só em Aberto</span>}
                    {onlySlaExtrapolated && <span className="bg-rose-50 text-rose-800 px-3 py-1 rounded-full text-[10px] font-black uppercase">Só Estrapolados</span>}
                </div>
            </div>
        )}
        
        {activeTab === 'general' && <GeneralOverview data={analytics} sortBy={sortBy} />}
        {activeTab === 'condo' && <CondoDetailReport data={analytics.condoStats} sortBy={sortBy} />}
        {activeTab === 'supplier' && <SupplierDetailReport data={analytics.supplierStats} sortBy={sortBy} />}
        {activeTab === 'performance' && <PerformanceReport requests={analytics.filtered} />}
        {activeTab === 'governance' && <GovernanceReport data={analytics} />}
        {activeTab === 'assembly' && <AssemblyReport data={analytics} categories={categories} />}
      </div>

      {/* HIDDEN CONTAINER FOR COMPRESSED AND COMPLETE MULTI-TAB PDF EXPORTS */}
      {isExportingFull && (
          <div style={{ position: 'absolute', top: 0, left: '-9999px', width: '1200px', backgroundColor: '#FAFAFA' }}>
            <div ref={fullPrintRef} className="space-y-12 bg-zinc-50 p-12">
                <div className="border-b-2 border-zinc-200 pb-6 mb-10">
                  <h1 className="text-4xl font-extrabold text-zinc-950 tracking-tight">RELATÓRIO GERENCIAL COMPLETO E AUDITADO</h1>
                  <p className="text-zinc-500 mt-2 text-sm font-medium">Extraído em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
                </div>

                {/* Applied filters summary */}
                {(dateStart || dateEnd || condoFilter !== 'all' || categoryFilter !== 'all') && (
                    <div className="bg-white border border-zinc-200 p-6 rounded-3xl shadow-sm mb-10">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Filtros Ativos Aplicados na Extração</h4>
                        <div className="flex flex-wrap gap-2">
                            {dateStart && <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold">Início: {dateStart.split('-').reverse().join('/')}</span>}
                            {dateEnd && <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold">Fim: {dateEnd.split('-').reverse().join('/')}</span>}
                            {condoFilter !== 'all' && <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold">Condomínio: {uniqueCondos.find(c => c.id === condoFilter)?.name || condoFilter}</span>}
                            {categoryFilter !== 'all' && <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold">Categoria: {categories.find(c => c.id === categoryFilter)?.name || categoryFilter}</span>}
                        </div>
                    </div>
                )}
                
                {/* Tab 1: Vision Geral */}
                <div className="space-y-4">
                  <div className="text-2xl font-black text-zinc-900 border-b pb-3 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 size={24} className="text-indigo-600"/> 1. VISÃO GERAL OPERACIONAL E FINANCEIRA
                  </div>
                  <GeneralOverview data={analytics} sortBy={sortBy} />
                </div>
                
                {/* Tab 2: Individual Condos */}
                <div className="space-y-4 pt-10 border-t border-zinc-200">
                  <div className="text-2xl font-black text-zinc-900 border-b pb-3 uppercase tracking-wider flex items-center gap-2">
                    <Building size={24} className="text-indigo-600"/> 2. ANÁLISE DE PERFORMANCE POR CONDOMÍNIO
                  </div>
                  <CondoDetailReport data={analytics.condoStats} sortBy={sortBy} />
                </div>
                
                {/* Tab 3: Suppliers analysis */}
                <div className="space-y-4 pt-10 border-t border-zinc-200">
                  <div className="text-2xl font-black text-zinc-900 border-b pb-3 uppercase tracking-wider flex items-center gap-2">
                    <Award size={24} className="text-indigo-600"/> 3. AUDITORIA DE COMPRAS POR FORNECEDOR
                  </div>
                  <SupplierDetailReport data={analytics.supplierStats} sortBy={sortBy} />
                </div>
                
                {/* Tab 4: Performance */}
                <div className="space-y-4 pt-10 border-t border-zinc-200">
                  <div className="text-2xl font-black text-zinc-900 border-b pb-3 uppercase tracking-wider flex items-center gap-2">
                    <Clock size={24} className="text-indigo-600"/> 4. PERFORMANCE DE STATUS E HISTÓRICO DE LOGS
                  </div>
                  <PerformanceReport requests={analytics.filtered} />
                </div>

                {/* Tab 5: Governance */}
                <div className="space-y-4 pt-10 border-t border-zinc-200">
                  <div className="text-2xl font-black text-zinc-900 border-b pb-3 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck size={24} className="text-indigo-600"/> 5. RELATÓRIO DE GOVERNANÇA, COMPLIANCE E AUDITORIA DE COMPRAS
                  </div>
                  <GovernanceReport data={analytics} />
                </div>
            </div>
          </div>
      )}
    </div>
  );
};
