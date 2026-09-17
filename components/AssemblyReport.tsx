import React, { useState, useMemo, useRef } from 'react';
import { 
  FileText, CheckCircle, XCircle, AlertCircle, TrendingUp, DollarSign, 
  ChevronDown, ChevronUp, Download, Eye, Shield, Users, Building, 
  Calendar, Award, Scale, HelpCircle, FileCheck, Layers, Sparkles
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { RequestStatus, RequestLevel, RequestType, Solicitacao, Orcamento, LogEvento } from '../types';

interface AssemblyReportProps {
  data: {
    processed: Solicitacao[];
    filtered: Solicitacao[];
    condoStats: any[];
    supplierStats: any[];
  };
  categories: any[];
}

export const AssemblyReport: React.FC<AssemblyReportProps> = ({ data, categories }) => {
  // Local filter states unique to the Assembly presentation view
  const [subStatusFilter, setSubStatusFilter] = useState<'all' | 'approved' | 'completed'>('all');
  const [subTypeFilter, setSubTypeFilter] = useState<'all' | 'recorrente' | 'avulsa'>('all');
  const [onlyAssemblyMarked, setOnlyAssemblyMarked] = useState(false);
  const [onlyWithQuotes, setOnlyWithQuotes] = useState(false);
  const [selectedCondoId, setSelectedCondoId] = useState<string>('all');
  
  // Exponent state for expandable rows
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  
  // Single request PDF printing state
  const [printingRequest, setPrintingRequest] = useState<any | null>(null);
  const singlePrintRef = useRef<HTMLDivElement>(null);
  const mainReportRef = useRef<HTMLDivElement>(null);
  const [isExportingSinglePdf, setIsExportingSinglePdf] = useState(false);

  // Formatting helpers
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  // Extract unique condos from active dataset
  const uniqueCondos = useMemo(() => {
    const condos = new Map<string, string>();
    data.filtered.forEach(r => {
      if (r.condominio_id && r.condominio_nome) {
        condos.set(r.condominio_id, r.condominio_nome);
      }
    });
    return Array.from(condos.entries()).map(([id, name]) => ({ id, name }));
  }, [data.filtered]);

  // Apply local sub-filters to already active parent-filtered dataset
  const refinedRequests = useMemo(() => {
    return data.processed.filter(req => {
      // 1. Local Condo selection
      if (selectedCondoId !== 'all' && req.condominio_id !== selectedCondoId) return false;
      
      // 2. Local Status filter
      if (subStatusFilter === 'approved') {
        const isApproved = [
          RequestStatus.APROVADO, RequestStatus.EM_PEDIDO, 
          RequestStatus.AGUARDANDO_ENTREGA, RequestStatus.CONCLUIDO
        ].includes(req.status);
        if (!isApproved) return false;
      } else if (subStatusFilter === 'completed') {
        if (req.status !== RequestStatus.CONCLUIDO) return false;
      }

      // 3. Local Request Type
      if (subTypeFilter === 'recorrente' && req.tipo !== RequestType.RECORRENTE) return false;
      if (subTypeFilter === 'avulsa' && req.tipo !== RequestType.AVULSA_MELHORIA) return false;

      // 4. Assembly marked only
      if (onlyAssemblyMarked && !req.assembly_data?.required) return false;

      // 5. Only those with quotes received
      if (onlyWithQuotes && (!req.orcamentos || req.orcamentos.length === 0)) return false;

      return true;
    });
  }, [data.processed, selectedCondoId, subStatusFilter, subTypeFilter, onlyAssemblyMarked, onlyWithQuotes]);

  // Compute stats based on the filtered assembly dataset
  const assemblyStats = useMemo(() => {
    const list = refinedRequests;
    const totalSolicitacoes = list.length;
    
    // Processed quotes are ones with budgets or in advanced status
    const cotados = list.filter(r => r.orcamentos && r.orcamentos.length > 0);
    const totalCotados = cotados.length;
    
    const aprovadosList = list.filter(r => [
      RequestStatus.APROVADO, RequestStatus.EM_PEDIDO, 
      RequestStatus.AGUARDANDO_ENTREGA, RequestStatus.CONCLUIDO
    ].includes(r.status));
    const totalAprovados = aprovadosList.length;

    const totalReprovados = list.filter(r => [
      RequestStatus.REPROVADO_BRASILEIRO, RequestStatus.REPROVADO_SEM_RESPOSTA,
      RequestStatus.CANCELADO, RequestStatus.RECUSADO
    ].includes(r.status)).length;

    const totalConcluidos = list.filter(r => r.status === RequestStatus.CONCLUIDO).length;
    
    // Total approved financial value
    const valorAprovadoTotal = aprovadosList.reduce((sum, r) => {
      const chosen = r.orcamentos?.find(o => o.numero === r.orcamento_escolhido);
      return sum + (chosen?.valor || 0);
    }, 0);

    const ticketMedioAprovado = totalAprovados > 0 ? (valorAprovadoTotal / totalAprovados) : 0;

    // Calculate actual/effective savings
    // Difference between highest proposal and selected proposal for approved orders
    let totalEconomia = 0;
    aprovadosList.forEach(r => {
      if (r.orcamentos && r.orcamentos.length > 1) {
        const chosen = r.orcamentos.find(o => o.numero === r.orcamento_escolhido);
        if (chosen) {
          const maxVal = Math.max(...r.orcamentos.map(o => o.valor));
          if (maxVal > chosen.valor) {
            totalEconomia += (maxVal - chosen.valor);
          }
        }
      }
    });

    const pedidosParaAssembleia = list.filter(r => r.assembly_data?.required).length;
    const pedidosEmAberto = list.filter(r => ![
      RequestStatus.CONCLUIDO, RequestStatus.CANCELADO, RequestStatus.RECUSADO,
      RequestStatus.REPROVADO_BRASILEIRO, RequestStatus.REPROVADO_SEM_RESPOSTA
    ].includes(r.status)).length;

    // Categorias mais demandadas
    const categoryCounts: Record<string, { count: number; value: number }> = {};
    list.forEach(r => {
      const cat = r.categoria || 'Outros';
      if (!categoryCounts[cat]) categoryCounts[cat] = { count: 0, value: 0 };
      categoryCounts[cat].count += 1;
      const chosen = r.orcamentos?.find(o => o.numero === r.orcamento_escolhido);
      categoryCounts[cat].value += (chosen?.valor || 0);
    });
    const topCategories = Object.entries(categoryCounts)
      .map(([name, stat]) => ({ name, ...stat }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Fornecedores mais escolhidos
    const supplierWins: Record<string, { wins: number; value: number }> = {};
    aprovadosList.forEach(r => {
      const chosen = r.orcamentos?.find(o => o.numero === r.orcamento_escolhido);
      if (chosen?.fornecedor) {
        const sup = chosen.fornecedor;
        if (!supplierWins[sup]) supplierWins[sup] = { wins: 0, value: 0 };
        supplierWins[sup].wins += 1;
        supplierWins[sup].value += chosen.valor;
      }
    });
    const topSuppliers = Object.entries(supplierWins)
      .map(([name, stat]) => ({ name, ...stat }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 5);

    return {
      totalSolicitacoes,
      totalCotados,
      totalAprovados,
      totalReprovados,
      totalConcluidos,
      valorAprovadoTotal,
      ticketMedioAprovado,
      totalEconomia,
      pedidosParaAssembleia,
      pedidosEmAberto,
      topCategories,
      topSuppliers
    };
  }, [refinedRequests]);

  const toggleRow = (id: string) => {
    if (expandedRequestId === id) {
      setExpandedRequestId(null);
    } else {
      setExpandedRequestId(id);
    }
  };

  // Download filtered list as CSV
  const handleExportCSV = () => {
    const headers = [
      'Protocolo', 'Data Solicitacao', 'Condominio', 'Titulo', 'Categoria', 
      'Prioridade', 'Tipo', 'Status', 'Orcamentos Recebidos', 
      'Fornecedor Escolhido', 'Valor Aprovado', 'Data Aprovacao', 'Autorizado Por'
    ];
    
    const rows = refinedRequests.map(req => {
      const chosenBudget = req.orcamentos?.find(o => o.numero === req.orcamento_escolhido);
      return [
        req.id || '-',
        formatDate(req.data_solicitacao),
        req.condominio_nome || '-',
        `"${(req.titulo || '').replace(/"/g, '""')}"`,
        req.categoria || '-',
        req.nivel || '-',
        req.tipo || '-',
        req.status || '-',
        req.orcamentos?.length || 0,
        `"${(chosenBudget?.fornecedor || '-').replace(/"/g, '""')}"`,
        chosenBudget?.valor || 0,
        formatDate(req.data_decisao_condominio || ''),
        req.autorizado_por_nome || '-'
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `prestacao_contas_assembleia_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Single Item PDF direct compilation
  const handleExportSinglePDF = async (req: Solicitacao) => {
    setPrintingRequest(req);
    setIsExportingSinglePdf(true);
    
    // Short defer to let React template paint offscreen
    setTimeout(async () => {
      if (!singlePrintRef.current) {
        setIsExportingSinglePdf(false);
        setPrintingRequest(null);
        return;
      }
      
      try {
        const canvas = await html2canvas(singlePrintRef.current, {
          scale: 2,
          useCORS: true,
          logging: false
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
        pdf.save(`prestacao_contas_pedido_${req.id || 'detalhado'}.pdf`);
      } catch (err) {
        console.error('Error generating single PDF:', err);
      } finally {
        setIsExportingSinglePdf(false);
        setPrintingRequest(null);
      }
    }, 400);
  };

  const selectedCondoName = useMemo(() => {
    if (selectedCondoId === 'all') return '';
    return uniqueCondos.find(c => c.id === selectedCondoId)?.name || 'Condomínio Selecionado';
  }, [selectedCondoId, uniqueCondos]);
  return (
    <div ref={mainReportRef} className="bg-white p-8 rounded-3xl border-2 border-zinc-200 shadow-lg animate-fadeIn space-y-8">
      
      {/* 1. HEADER SECTION & EXPORT ACTIONS */}
      <div className="border-b-2 border-zinc-200 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1.5">
          <span className="inline-flex bg-slate-900 text-white text-[9px] font-black uppercase px-2.5 py-1 rounded tracking-wider shadow-sm">
            Painel Executivo Oficial
          </span>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-2.5">
            <Scale size={32} className="text-indigo-700 shrink-0" /> Relatório para Assembleia e Prestação de Contas
          </h2>
          <p className="text-xs font-semibold text-zinc-655 max-w-3xl leading-relaxed">
            Painel de governança documental idealizado para apresentação em assembleias de condomínio. 
            Demonstra de forma transparente a concorrência de propostas, rastreabilidade de decisões e auditoria de compras.
          </p>
        </div>
        <div className="flex gap-3 shrink-0 w-full md:w-auto mt-2 md:mt-0">
          <button 
            type="button"
            onClick={handleExportCSV}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-950 text-white px-5 py-3 rounded-xl text-xs font-black hover:bg-zinc-850 transition shadow-md cursor-pointer font-sans"
          >
            <Download size={15} /> Exportar Planilha (CSV)
          </button>
        </div>
      </div>

      {/* 2. SUB-FILTERS BOX */}
      <div className="bg-zinc-50 p-6 rounded-2xl border-2 border-zinc-205 shadow-xs space-y-4">
        <h3 className="text-xs font-black text-zinc-800 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-zinc-200">
          <Layers size={14} className="text-indigo-700" /> Filtros Refinados de Rastreamento
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Condominio local filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">
              Selecione o Condomínio
            </label>
            <select 
              value={selectedCondoId} 
              onChange={e => setSelectedCondoId(e.target.value)}
              className="w-full p-2.5 rounded-lg border-2 border-zinc-250 bg-white text-xs font-bold text-zinc-900 focus:ring-2 focus:ring-indigo-500 shadow-sm"
            >
              <option value="all">Todos ({uniqueCondos.length})</option>
              {uniqueCondos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Status filtering */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">
              Filtrar por Status de Decisão
            </label>
            <div className="flex bg-white p-1 rounded-lg border-2 border-zinc-200 shadow-xs">
              <button 
                type="button"
                onClick={() => setSubStatusFilter('all')}
                className={`flex-1 py-2 text-[10px] font-black rounded uppercase transition-all duration-150 ${subStatusFilter === 'all' ? 'bg-indigo-900 text-white shadow-sm' : 'text-zinc-650 hover:text-zinc-900'}`}
              >
                Todos
              </button>
              <button 
                type="button"
                onClick={() => setSubStatusFilter('approved')}
                className={`flex-1 py-2 text-[10px] font-black rounded uppercase transition-all duration-150 ${subStatusFilter === 'approved' ? 'bg-indigo-900 text-white shadow-sm' : 'text-zinc-655 hover:text-zinc-900'}`}
                title="Apenas aprovados, em pedido, aguardando entrega e concluídos"
              >
                Só Aprovados
              </button>
              <button 
                type="button"
                onClick={() => setSubStatusFilter('completed')}
                className={`flex-1 py-2 text-[10px] font-black rounded uppercase transition-all duration-150 ${subStatusFilter === 'completed' ? 'bg-indigo-900 text-white shadow-sm' : 'text-zinc-655 hover:text-zinc-900'}`}
              >
                Concluídos
              </button>
            </div>
          </div>

          {/* Type filtering */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">
              Tipo de Cotação
            </label>
            <div className="flex bg-white p-1 rounded-lg border-2 border-zinc-200 shadow-xs">
              <button 
                type="button"
                onClick={() => setSubTypeFilter('all')}
                className={`flex-1 py-2 text-[10px] font-black rounded uppercase transition-all duration-150 ${subTypeFilter === 'all' ? 'bg-indigo-900 text-white shadow-sm' : 'text-zinc-655 hover:text-zinc-900'}`}
              >
                Todos
              </button>
              <button 
                type="button"
                onClick={() => setSubTypeFilter('recorrente')}
                className={`flex-1 py-2 text-[10px] font-black rounded uppercase transition-all duration-150 ${subTypeFilter === 'recorrente' ? 'bg-indigo-900 text-white shadow-sm' : 'text-zinc-655 hover:text-zinc-900'}`}
              >
                Contratos
              </button>
              <button 
                type="button"
                onClick={() => setSubTypeFilter('avulsa')}
                className={`flex-1 py-2 text-[10px] font-black rounded uppercase transition-all duration-150 ${subTypeFilter === 'avulsa' ? 'bg-indigo-900 text-white shadow-sm' : 'text-zinc-655 hover:text-zinc-900'}`}
              >
                Avulsos
              </button>
            </div>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-x-8 gap-y-3 pt-3 border-t border-zinc-200">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-zinc-800 hover:text-indigo-900 transition-colors">
            <input 
              type="checkbox" 
              checked={onlyAssemblyMarked} 
              onChange={e => setOnlyAssemblyMarked(e.target.checked)}
              className="rounded text-indigo-700 border-zinc-300 focus:ring-indigo-500 h-4 w-4"
            />
            <span className="flex items-center gap-1.5"><Sparkles size={14} className="text-amber-500 fill-amber-500 shrink-0"/> Somente pedidos para Assembleia (`assembleia_requerida`)</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-zinc-808 hover:text-indigo-900 transition-colors">
            <input 
              type="checkbox" 
              checked={onlyWithQuotes} 
              onChange={e => setOnlyWithQuotes(e.target.checked)}
              className="rounded text-indigo-700 border-zinc-300 focus:ring-indigo-500 h-4 w-4"
            />
            <span>Somente com orçamento de fornecedor anexado</span>
          </label>
        </div>
      </div>

      {/* 3. CONDOS DEDICATED VISUAL DECK (If single Condo filtered) */}
      {selectedCondoId !== 'all' && (
        <div className="bg-zinc-100 border-2 border-zinc-300 p-6 rounded-2xl space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-zinc-250 pb-4">
            <div>
              <span className="inline-block bg-indigo-900 text-white text-[10px] font-black uppercase px-3 py-1 rounded-md tracking-wider shadow-sm">
                Relatório Setorial de Assembleia
              </span>
              <h3 className="text-xl font-black text-zinc-900 mt-2 flex items-center gap-2.5">
                <Building size={22} className="text-indigo-800" /> CADERNO DE PRESTAÇÃO DE CONTAS: {selectedCondoName}
              </h3>
            </div>
            <div className="text-right bg-white p-3 rounded-xl border-2 border-zinc-250 shadow-sm max-w-[280px]">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black leading-none">Aprovado no Período</p>
              <p className="text-2xl font-black text-indigo-950 leading-none mt-1.5">{formatCurrency(assemblyStats.valorAprovadoTotal)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Top Categories */}
            <div className="bg-white p-5 rounded-xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-900 mb-3 block pb-1.5 border-b border-zinc-100">
                  Demandas por Categoria
                </h4>
                {assemblyStats.topCategories.length > 0 ? (
                  <div className="space-y-2.5">
                    {assemblyStats.topCategories.map((c, i) => (
                      <div key={i} className="flex justify-between text-xs pb-1.5 border-b border-dotted border-zinc-150 last:border-b-0 last:pb-0">
                        <span className="text-zinc-800 font-extrabold truncate max-w-[150px]">{c.name}</span>
                        <span className="text-zinc-950 font-black shrink-0">{c.count} ped. ({formatCurrency(c.value)})</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 font-bold font-mono">Sem dados</p>
                )}
              </div>
            </div>

            {/* Top Suppliers Chosen */}
            <div className="bg-white p-5 rounded-xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-900 mb-3 block pb-1.5 border-b border-zinc-100">
                  Parceiros Homologados Atendidos
                </h4>
                {assemblyStats.topSuppliers.length > 0 ? (
                  <div className="space-y-2.5">
                    {assemblyStats.topSuppliers.map((s, i) => (
                      <div key={i} className="flex justify-between text-xs pb-1.5 border-b border-dotted border-zinc-150 last:border-b-0 last:pb-0">
                        <span className="text-zinc-800 font-extrabold truncate max-w-[155px]">{s.name}</span>
                        <span className="text-zinc-950 font-black shrink-0">{s.wins} compras ({formatCurrency(s.value)})</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 font-bold font-mono">Sem decisões aprovadas</p>
                )}
              </div>
            </div>

            {/* Assembly Details Summary */}
            <div className="bg-white p-5 rounded-xl border-2 border-indigo-200 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-900 mb-3 block pb-1.5 border-b border-zinc-100">
                  Status de Compliance e Assembleia
                </h4>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between pb-1.5 border-b border-dotted border-zinc-150">
                    <span className="text-zinc-700 font-bold">Pedidos Emergenciais (N1):</span>
                    <span className="text-zinc-950 font-black shrink-0">
                      {refinedRequests.filter(r => r.nivel === RequestLevel.N1).length}
                    </span>
                  </div>
                  <div className="flex justify-between pb-1.5 border-b border-dotted border-zinc-150">
                    <span className="text-zinc-700 font-bold">Sinalizados para Assembleia:</span>
                    <span className="text-indigo-900 font-black shrink-0">{assemblyStats.pedidosParaAssembleia}</span>
                  </div>
                  <div className="flex justify-between pb-1.5 last:pb-0">
                    <span className="text-zinc-705 font-bold">Economia no Período:</span>
                    <span className="text-emerald-850 font-black shrink-0">{formatCurrency(assemblyStats.totalEconomia)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. METRIC CARDS (EXECUTIVE OVERVIEW OF FILTERED RESULTS) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
        {/* Total Solicitações */}
        <div className="p-5 bg-white border-2 border-zinc-200 rounded-xl shadow-sm hover:border-zinc-300 transition-all flex flex-col justify-between">
          <div>
            <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest block mb-1">Processos Totais</span>
            <p className="text-3xl font-black text-zinc-900 leading-none">{assemblyStats.totalSolicitacoes}</p>
          </div>
          <p className="text-[10px] text-zinc-650 font-bold mt-2 pt-2 border-t border-zinc-100">Quantidade no período filtrado</p>
        </div>

        {/* Total Cotados */}
        <div className="p-5 bg-white border-2 border-amber-200 rounded-xl shadow-sm hover:border-amber-300 transition-all flex flex-col justify-between">
          <div>
            <span className="text-[9px] font-extrabold text-amber-800 uppercase tracking-widest block mb-1">Cotados Ativos</span>
            <p className="text-3xl font-black text-amber-700 leading-none">{assemblyStats.totalCotados}</p>
          </div>
          <p className="text-[10px] text-amber-900 font-bold mt-2 pt-2 border-t border-amber-100">com proposta recebida</p>
        </div>

        {/* Total Aprovados */}
        <div className="p-5 bg-white border-2 border-emerald-200 rounded-xl shadow-sm hover:border-emerald-300 transition-all flex flex-col justify-between">
          <div>
            <span className="text-[9px] font-extrabold text-emerald-800 uppercase tracking-widest block mb-1 font-sans">Aprovados Conselho</span>
            <p className="text-3xl font-black text-emerald-700 leading-none">{assemblyStats.totalAprovados}</p>
          </div>
          <p className="text-[10px] text-emerald-990 font-bold mt-2 pt-2 border-t border-emerald-100">
            {assemblyStats.totalConcluidos} concluídos
          </p>
        </div>

        {/* Approved Financial Amount */}
        <div className="p-5 bg-white border-2 border-indigo-200 rounded-xl shadow-sm hover:border-indigo-300 transition-all flex flex-col justify-between ring-1 ring-indigo-50">
          <div>
            <span className="text-[9px] font-extrabold text-indigo-900 uppercase tracking-widest block mb-1">Valor Total Aprovado</span>
            <p className="text-2xl font-black text-indigo-950 leading-none tracking-tight">
              {formatCurrency(assemblyStats.valorAprovadoTotal)}
            </p>
          </div>
          <div className="text-[10px] text-indigo-950 font-bold mt-2 pt-2 border-t border-indigo-100 flex justify-between">
            <span>Ticket Médio:</span>
            <span>{formatCurrency(assemblyStats.ticketMedioAprovado)}</span>
          </div>
        </div>

        {/* Economies Obtained */}
        <div className="p-5 bg-white border-2 border-emerald-205 rounded-xl shadow-sm hover:border-emerald-300 transition-all flex flex-col justify-between ring-1 ring-emerald-50">
          <div>
            <span className="text-[9px] font-extrabold text-emerald-800 uppercase tracking-widest block mb-1">Economia s/ Máximo</span>
            <p className="text-2xl font-black text-emerald-850 leading-none">
              {formatCurrency(assemblyStats.totalEconomia)}
            </p>
          </div>
          <p className="text-[10px] text-emerald-900 font-bold mt-2 pt-2 border-t border-emerald-150">comprovação de concorrência</p>
        </div>
      </div>

      {/* 5. GENERAL COMPLIANCE ACCOUNTABILITY TABLE */}
      <div className="bg-white rounded-2xl border-2 border-zinc-250 overflow-hidden shadow-sm">
        <div className="p-6 border-b-2 border-zinc-200 bg-zinc-50 flex justify-between items-center bg-zinc-50/50 flex-wrap gap-4">
          <div>
            <h4 className="text-base font-black text-zinc-900 flex items-center gap-1.5 animate-fadeIn">
              <FileCheck size={18} className="text-indigo-700" /> Registro Factual de Pedidos de Orçamentos
            </h4>
            <p className="text-xs text-zinc-650 font-bold mt-1">
              Clique em qualquer linha da tabela para expandir e auditar todos os orçamentos, justificativa e histórico de governança.
            </p>
          </div>
          <span className="bg-zinc-900 text-white text-xs font-black px-4 py-2 rounded-full uppercase tracking-wider shadow-sm">
            {refinedRequests.length} Registro(s) Encontrado(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-800 uppercase text-[10px] font-black text-white tracking-widest border-b border-zinc-900 shadow-sm">
                <th className="px-5 py-4">Código</th>
                <th className="px-5 py-4">Data Solicitação</th>
                <th className="px-5 py-4">Condomínio / Pedido</th>
                <th className="px-5 py-4">Categoria / Tipo</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-center">Orçamentos</th>
                <th className="px-5 py-4">Fornecedor Escolhido</th>
                <th className="px-5 py-4 text-right">Valor Aprovado</th>
                <th className="px-5 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {refinedRequests.map(req => {
                const isExpanded = expandedRequestId === req.id;
                const chosenBudget = req.orcamentos?.find(o => o.numero === req.orcamento_escolhido);
                const hasAttachment = req.orcamentos?.some(o => o.attachments && o.attachments.length > 0);
                const hasJustification = !!req.justificativa_condominio?.trim();
                const isDocSecure = hasAttachment && hasJustification;

                return (
                  <React.Fragment key={req.id}>
                    {/* Primary list row */}
                    <tr 
                      onClick={() => toggleRow(req.id)}
                      className={`hover:bg-indigo-50/40 cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-55/35' : 'bg-white'}`}
                    >
                      {/* Sub-ID code */}
                      <td className="px-5 py-4 font-mono font-black text-zinc-800">
                        {req.id ? `#${req.id.slice(0, 5).toUpperCase()}` : '-'}
                      </td>
                      
                      {/* Date */}
                      <td className="px-5 py-4 text-zinc-800 font-extrabold">
                        {formatDate(req.data_solicitacao)}
                      </td>

                      {/* Condo and Title info */}
                      <td className="px-5 py-4 max-w-[280px]">
                        <div className="font-extrabold text-zinc-900 truncate" title={req.titulo}>{req.titulo}</div>
                        <div className="text-[10px] text-zinc-600 font-black truncate flex items-center gap-1 mt-0.5" title={req.condominio_nome}>
                          <Building size={11} className="text-zinc-550 shrink-0"/> {req.condominio_nome}
                        </div>
                      </td>

                      {/* Category and Contract type */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-zinc-800">{req.categoria || 'Sem Categoria'}</div>
                        <div className={`mt-1 text-[9px] px-2 py-0.5 rounded font-black border ${req.tipo === RequestType.RECORRENTE ? 'bg-indigo-100 text-indigo-900 border-indigo-250' : 'bg-zinc-100 text-zinc-800 border-zinc-300'}`}>
                          {req.tipo === RequestType.RECORRENTE ? 'Contrato' : 'Investimento/Avulso'}
                        </div>
                      </td>

                      {/* Status select placeholder badge */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-[9px] font-black border uppercase tracking-wider
                          ${req.status === RequestStatus.CONCLUIDO ? 'bg-emerald-100 text-emerald-950 border-emerald-300' :
                            [RequestStatus.APROVADO, RequestStatus.EM_PEDIDO, RequestStatus.AGUARDANDO_ENTREGA].includes(req.status) ? 'bg-indigo-900 text-white border-indigo-950 shadow-sm' :
                            [RequestStatus.REPROVADO_BRASILEIRO, RequestStatus.REPROVADO_SEM_RESPOSTA, RequestStatus.CANCELADO, RequestStatus.RECUSADO].includes(req.status) ? 'bg-rose-100 text-rose-950 border-rose-300' :
                            'bg-amber-100 text-amber-950 border-amber-300'
                          }
                        `}>
                          {req.status === RequestStatus.CONCLUIDO && <CheckCircle size={10} />}
                          {req.status}
                        </span>
                        
                        {req.assembly_data?.required && (
                          <div className="mt-1.5 text-[9px] text-amber-900 font-extrabold uppercase flex items-center gap-1 font-mono bg-amber-100 border border-amber-300 px-2 py-0.5 rounded shadow-xs">
                            <Sparkles size={11} className="text-amber-600 fill-amber-500 shrink-0"/> Em Assembleia
                          </div>
                        )}
                      </td>

                      {/* Quotes Count */}
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center justify-center font-black px-2.5 py-1 rounded text-xs border ${req.orcamentos?.length >= 3 ? 'bg-slate-100 text-slate-900 border-slate-350' : 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold'}`}>
                          {req.orcamentos?.length || 0}
                        </span>
                      </td>

                      {/* Supplier chosen */}
                      <td className="px-5 py-4 font-black text-zinc-900 truncate max-w-[150px]">
                        {chosenBudget?.fornecedor || <span className="text-zinc-400 font-mono font-bold">-</span>}
                      </td>

                      {/* Net Appoved Val */}
                      <td className="px-5 py-4 text-right font-black text-zinc-950 font-mono">
                        {chosenBudget?.valor ? formatCurrency(chosenBudget.valor) : '-'}
                      </td>

                      {/* Action trigger button */}
                      <td className="px-5 py-4 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            type="button"
                            onClick={() => toggleRow(req.id)}
                            className="px-3 py-1.5 border-2 border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 text-zinc-800 rounded-lg transition-all flex items-center gap-1 font-black text-[10px]"
                            title="Expandir detalhes"
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Detalhar
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* EXPANDED CONTAINER DETAILS */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} className="px-8 py-6 bg-slate-50 border-t-2 border-b-2 border-slate-205">
                          <div className="space-y-6">
                            
                            {/* Expand header buttons */}
                            <div className="flex justify-between items-center pb-4 border-b-2 border-slate-200">
                              <span className="font-sans text-xs font-black uppercase text-indigo-950 flex items-center gap-1.5">
                                <Sparkles size={14} className="text-indigo-800 shrink-0"/> DETALHAMENTO TÉCNICO GERENCIAL
                              </span>
                              <button 
                                type="button"
                                onClick={() => handleExportSinglePDF(req)}
                                className="flex items-center gap-1.5 bg-indigo-900 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md hover:bg-indigo-950 transition cursor-pointer border border-indigo-950"
                              >
                                <Download size={14} /> Baixar PDF de Prestação de Contas
                              </button>
                            </div>

                            {/* Section: Description & items */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="bg-white p-5 rounded-xl border-2 border-slate-200 shadow-sm space-y-2">
                                <h5 className="font-extrabold text-xs text-zinc-900 uppercase block tracking-wider pb-1.5 border-b border-zinc-100">Descrição Completa da Demanda</h5>
                                <p className="text-xs text-zinc-850 font-medium whitespace-pre-line leading-relaxed">{req.descricao || 'Nenhuma descrição fornecida.'}</p>
                              </div>

                              <div className="bg-white p-5 rounded-xl border-2 border-slate-200 shadow-sm space-y-2">
                                <h5 className="font-extrabold text-xs text-zinc-900 uppercase block tracking-wider pb-1.5 border-b border-zinc-100">Detalhes dos Itens Solicitados</h5>
                                {req.orcamentos && req.orcamentos[0]?.items ? (
                                  <div className="space-y-1.5 text-xs">
                                    {req.orcamentos[0].items.map((it, idx) => (
                                      <div key={idx} className="flex justify-between border-b border-slate-100 py-1.5 font-bold last:border-0 last:pb-0">
                                        <span className="text-zinc-700 font-semibold">{it.descricao}</span>
                                        <span className="text-zinc-900 font-mono">Qtd: {it.quantidade} {it.unidade || 'un'}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-zinc-500 font-bold font-mono">Estrutura de itens não anexada de forma individualizada.</p>
                                )}
                              </div>
                            </div>

                            {/* Section: Budgets list received */}
                            <div className="space-y-3">
                              <h5 className="font-black text-xs text-zinc-900 uppercase block tracking-wider">Comparativo Analítico de Todos os Orçamentos Recebidos</h5>
                              <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-slate-100 uppercase text-[10px] font-black text-slate-800 border-b-2 border-slate-200 pb-1.5">
                                      <th className="px-4 py-3">Nº</th>
                                      <th className="px-4 py-3">Fornecedor</th>
                                      <th className="px-4 py-3">Valor Total</th>
                                      <th className="px-4 py-3">Prazo de Entrega</th>
                                      <th className="px-4 py-3">Condição de Trabalho</th>
                                      <th className="px-4 py-3 text-center">Anexo PDF</th>
                                      <th className="px-4 py-3 text-center">Status Interno</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-150">
                                    {(req.orcamentos || []).map((o, idx) => {
                                      const isChosenB = req.orcamento_escolhido === o.numero;
                                      return (
                                        <tr key={idx} className={`hover:bg-slate-50 font-bold transition-colors ${isChosenB ? 'bg-indigo-50/50 font-black' : ''}`}>
                                          <td className="px-4 py-3 font-mono text-zinc-700">{o.numero}</td>
                                          <td className="px-4 py-3 flex flex-wrap items-center gap-1.5 font-black text-slate-900">
                                            {o.fornecedor} 
                                            {o.recomendado && (
                                              <span className="bg-amber-100 text-amber-900 text-[9px] px-2 py-0.5 rounded font-black border-2 border-amber-250 shadow-sm leading-none">
                                                Recomendado Brasileiro
                                              </span>
                                            )}
                                            {isChosenB && (
                                              <span className="bg-green-100 text-green-900 text-[9px] px-2 py-0.5 rounded font-black border-2 border-green-250 shadow-sm leading-none uppercase">
                                                ESCOLHIDO PELO CONDOMÍNIO
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 font-black text-zinc-950 font-mono">{formatCurrency(o.valor)}</td>
                                          <td className="px-4 py-3 text-zinc-900">{o.prazo_entrega || '-'}</td>
                                          <td className="px-4 py-3 text-zinc-900 truncate max-w-[200px]">{o.condicoes_pagamento || '-'}</td>
                                          <td className="px-4 py-3 text-center">
                                            {o.attachments && o.attachments.length > 0 ? (
                                              <span className="text-emerald-800 font-extrabold flex items-center justify-center gap-1 text-[11px]" title={o.attachments[0].name}>
                                                <FileCheck size={14} className="text-emerald-700" /> Sim
                                              </span>
                                            ) : (
                                              <span className="text-rose-700 font-extrabold flex items-center justify-center gap-1 text-[11px]">
                                                <XCircle size={14} className="text-rose-600" /> Não Possui
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            {isChosenB ? (
                                              <span className="bg-green-100 text-green-905 text-[10px] uppercase font-black px-2.5 py-1 rounded border border-green-300">Vencedor</span>
                                            ) : (
                                              <span className="text-zinc-500 font-semibold font-mono text-[10px]">Sinalizado</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Section: Comparison Bloc */}
                            {req.orcamentos && req.orcamentos.length > 0 && (
                              <div className="bg-white p-5 rounded-xl border-2 border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="text-center md:border-r border-slate-200 py-2">
                                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Faixa de Contratação</p>
                                  <p className="text-[15px] font-black text-zinc-900 mt-1.5">
                                    {formatCurrency(Math.min(...req.orcamentos.map(o => o.valor)))} a {formatCurrency(Math.max(...req.orcamentos.map(o => o.valor)))}
                                  </p>
                                </div>
                                <div className="text-center md:border-r border-slate-200 py-2">
                                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Valor Escolhido / Status</p>
                                  <p className="text-[15px] font-black text-indigo-900 mt-1.5">
                                    {chosenBudget ? formatCurrency(chosenBudget.valor) : 'Não escolhido'}
                                  </p>
                                </div>
                                <div className="text-center md:border-r border-slate-200 py-2">
                                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Diferença vs Menor Cotação</p>
                                  <p className="text-[15px] font-black text-zinc-900 mt-1.5">
                                    {chosenBudget ? (() => {
                                      const minVal = Math.min(...req.orcamentos.map(o => o.valor));
                                      const diff = chosenBudget.valor - minVal;
                                      return diff > 0 ? (
                                        <span className="text-rose-700">+{formatCurrency(diff)}</span>
                                      ) : (
                                        <span className="text-emerald-700 font-black">Mais competitivo (0,00)</span>
                                      );
                                    })() : '-'}
                                  </p>
                                </div>
                                <div className="text-center py-2">
                                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Economia s/ Máximo</p>
                                  <p className="text-[15px] font-black text-emerald-700 mt-1.5 font-mono">
                                    {chosenBudget ? (() => {
                                      const maxVal = Math.max(...req.orcamentos.map(o => o.valor));
                                      const diff = maxVal - chosenBudget.valor;
                                      return diff > 0 ? formatCurrency(diff) : 'R$ 0,00';
                                    })() : '-'}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Section: Recommendation & Choices Justifications */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="bg-amber-50 p-5 border-2 border-amber-250 rounded-xl space-y-2">
                                <h6 className="text-[10px] font-black text-amber-905 uppercase tracking-widest flex items-center gap-1 pb-1.5 border-b border-amber-200/60 font-sans">
                                  <Sparkles size={13} className="text-amber-700 fill-amber-500"/> Recomendação Brasileira Administradora
                                </h6>
                                <p className="text-xs font-black text-zinc-900">
                                  {req.orcamentos?.find(o => o.recomendado)?.fornecedor || 'Nenhum fornecedor formalmente priorizado.'}
                                </p>
                                <p className="text-xs text-zinc-805 leading-relaxed italic font-medium">
                                  &ldquo;{req.orcamentos?.find(o => o.recomendado)?.justificativa_melhor_proposta || 'Análise de pré-seleção baseada em custos e prazos homologados.'}&rdquo;
                                </p>
                              </div>

                              <div className="bg-emerald-50 p-5 border-2 border-emerald-250 rounded-xl space-y-2">
                                <h6 className="text-[10px] font-black text-emerald-905 uppercase tracking-widest flex items-center gap-1 pb-1.5 border-b border-emerald-200/60 font-sans">
                                  <FileCheck size={13} className="text-emerald-700"/> Decisão e Justificativa Final do Condomínio
                                </h6>
                                <div className="text-xs font-black text-zinc-950 flex justify-between flex-wrap gap-2">
                                  <span>Prevalência: {chosenBudget?.fornecedor || 'Aguardando Aprovação Formal'}</span>
                                  {req.autorizado_por_nome && (
                                    <span className="text-[10px] text-zinc-650 font-bold">Aprovador: {req.autorizado_por_nome} ({req.autorizado_por_cargo || 'Síndico'})</span>
                                  )}
                                </div>
                                <p className="text-xs text-zinc-805 leading-relaxed font-semibold font-medium">
                                  {req.justificativa_condominio ? (
                                    <span>&ldquo;{req.justificativa_condominio}&rdquo;</span>
                                  ) : (
                                    <span className="text-zinc-550 italic font-medium">Justificativa de aprovação fiscal não cadastrada pelo condomínio.</span>
                                  )}
                                </p>
                              </div>
                            </div>

                            {/* Governance Compliance Checklist */}
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                              {/* Item 1: Orçamento Anexado */}
                              <div className="bg-white p-4 border-2 border-zinc-200 rounded-xl flex items-center gap-3 shadow-xs">
                                <div className={`p-2 rounded-lg shrink-0 ${hasAttachment ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                                  {hasAttachment ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                </div>
                                <div>
                                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest leading-none font-black animate-pulse">Cotação</p>
                                  <p className="text-xs font-extrabold text-zinc-900 mt-1">{hasAttachment ? 'Sim (Auditada)' : 'Ausente'}</p>
                                </div>
                              </div>

                              {/* Item 2: Justificativa Formal */}
                              <div className="bg-white p-4 border-2 border-zinc-200 rounded-xl flex items-center gap-3 shadow-xs">
                                <div className={`p-2 rounded-lg shrink-0 ${hasJustification ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                                  {hasJustification ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                </div>
                                <div>
                                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest leading-none font-black">Justificativa</p>
                                  <p className="text-xs font-extrabold text-zinc-900 mt-1">{hasJustification ? 'Documentada' : 'Pendente'}</p>
                                </div>
                              </div>

                              {/* Item 3: Auditoria Competitiva (3+ orcamentos) */}
                              <div className="bg-white p-4 border-2 border-zinc-200 rounded-xl flex items-center gap-3 shadow-xs">
                                <div className={`p-2 rounded-lg shrink-0 ${(req.orcamentos?.length || 0) >= 3 ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'}`}>
                                  {(req.orcamentos?.length || 0) >= 3 ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                </div>
                                <div>
                                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest leading-none font-black">Mínimo de 3</p>
                                  <p className="text-xs font-extrabold text-zinc-900 mt-1">{(req.orcamentos?.length || 0) >= 3 ? 'Atendido' : 'Insuficiente'}</p>
                                </div>
                              </div>

                              {/* Item 4: Maratona para Assembleia */}
                              <div className="bg-white p-4 border-2 border-zinc-200 rounded-xl flex items-center gap-3 shadow-xs">
                                <div className={`p-2 rounded-lg shrink-0 ${req.assembly_data?.required ? 'bg-amber-100 text-amber-900 border border-amber-305' : 'bg-zinc-100 text-zinc-700 border border-zinc-300'}`}>
                                  {req.assembly_data?.required ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                </div>
                                <div>
                                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest leading-none font-black">Assembleia</p>
                                  <p className="text-xs font-extrabold text-zinc-900 mt-1">{req.assembly_data?.required ? 'Requerida' : 'Aprovação Direta'}</p>
                                </div>
                              </div>

                              {/* Item 5: Status de Compliance */}
                              <div className="bg-white p-4 border-2 border-zinc-200 rounded-xl flex items-center gap-3 shadow-xs">
                                <div className={`p-2 rounded-lg shrink-0 ${isDocSecure ? 'bg-emerald-100 text-emerald-950 border-2 border-emerald-300' : 'bg-rose-100 text-rose-950 border-2 border-rose-300'}`}>
                                  {isDocSecure ? <Shield size={16} className="text-emerald-800" /> : <AlertCircle size={16} className="text-rose-800" />}
                                </div>
                                <div>
                                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest leading-none font-black">Compliance</p>
                                  <p className={`text-xs font-black mt-1 ${isDocSecure ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {isDocSecure ? 'COMPLETO' : 'PENDENTE'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Process stage historic timeline */}
                            <div className="space-y-3">
                              <h6 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block font-mono">Linha do Tempo e Histórico do Processo por Etapa</h6>
                              <div className="bg-white p-5 rounded-xl border-2 border-slate-200 space-y-3 shadow-sm">
                                {req.historico && req.historico.length > 0 ? (
                                  <div className="relative border-l-2 border-slate-200 ml-2 pl-4 py-1 space-y-4">
                                    {[...req.historico]
                                      .sort((a,b) => new Date(a.data).getTime() - new Date(b.data).getTime())
                                      .map((log, idx) => (
                                        <div key={idx} className="relative text-xs">
                                          {/* Circle icon */}
                                          <div className="absolute -left-[22px] top-1 bg-indigo-900 w-3 h-3 rounded-full border-2 border-white" />
                                          <div className="flex justify-between flex-wrap gap-1">
                                            <span className="font-bold text-slate-800">{log.descricao}</span>
                                            <span className="text-[10px] text-zinc-550 font-bold font-mono">
                                              {formatDate(log.data)} por <span className="font-black text-slate-900">{log.usuario_nome}</span>
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-zinc-550 italic font-bold">Nenhum evento registrado no histórico.</p>
                                )}
                              </div>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {refinedRequests.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-20 text-zinc-400 bg-zinc-50">
                    <AlertCircle size={40} className="mx-auto mb-3 opacity-20 text-zinc-400" />
                    <p className="font-bold text-sm text-zinc-700">Nenhum pedido compatível com a prestação de contas.</p>
                    <p className="text-xs text-zinc-450 mt-1">Experimente alterar os filtros avançados ou expandir o período inicial.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. TECHNICAL FOOTNOTE / AUDITOR */}
      <div className="bg-white p-6 rounded-xl border-2 border-zinc-250 shadow-sm">
        <h4 className="text-[10px] font-black text-indigo-950 uppercase tracking-widest mb-2 flex items-center gap-1">
          <Shield size={14} className="text-indigo-800" /> Termo de Responsabilidade e Controle Documental Administrativo
        </h4>
        <p className="text-xs text-zinc-700 font-bold leading-relaxed">
          Toda solicitação apresentada neste caderno gerencial obedece aos ritos regulatórios previstos na convenção de condomínios homologada. Os orçamentos contêm integridade eletrônica e os processos de escolha guardam correspondência direta com as decisões das reuniões de conselho e assembleias formais de aprovação.
        </p>
      </div>

      {/* 7. HIDDEN ZONE FOR RENDERING COMPACT A4 SINGLE GRAPHIC REQUEST (For single PDF printing) */}
      {isExportingSinglePdf && printingRequest && (
        <div style={{ position: 'fixed', top: 0, left: '-9999px', width: '210mm', minHeight: '297mm', backgroundColor: '#FFFFFF', padding: '15mm', boxSizing: 'border-box', zIndex: -1 }}>
          <div ref={singlePrintRef} className="space-y-6 text-zinc-900 bg-white" style={{ fontFamily: 'Inter, sans-serif' }}>
            
            {/* Header Document format */}
            <div className="border-b-2 border-zinc-800 pb-3 flex justify-between items-end">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 leading-none">DEMONSTRATIVO INDIVIDUAL DE AUDITORIA DE COMPRA</p>
                <h2 className="text-xl font-black text-zinc-900 mt-1">Brasileiro Administradora de Condomínios</h2>
              </div>
              <div className="text-right">
                <span className="p-1 px-2.5 bg-zinc-900 text-white rounded text-[9px] font-black uppercase font-mono">
                  SOLICITAÇÃO #{printingRequest.id ? printingRequest.id.slice(0, 8).toUpperCase() : 'ORÇAMENTO'}
                </span>
                <p className="text-[9px] text-zinc-400 mt-1 font-mono">Gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
              </div>
            </div>

            {/* General request specifications */}
            <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-4 border border-zinc-200 rounded-xl text-xs">
              <div>
                <span className="text-[9px] uppercase font-bold text-zinc-400 block">Condomínio Destinatário</span>
                <span className="font-bold text-zinc-800 text-sm leading-tight block mt-0.5">{printingRequest.condominio_nome || '-'}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-zinc-400 block">Título do Projeto</span>
                <span className="font-bold text-zinc-800 text-sm leading-tight block mt-0.5">{printingRequest.titulo || '-'}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-zinc-400 block">Data de Entrada</span>
                <span className="font-medium text-zinc-700 block mt-0.5">{formatDate(printingRequest.data_solicitacao)}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-zinc-400 block">Categoria / Nível SLA</span>
                <span className="font-bold text-zinc-700 block mt-0.5">{printingRequest.categoria || 'Sem categoria'} • {printingRequest.nivel || 'N3'}</span>
              </div>
            </div>

            {/* Scope Details */}
            <div className="space-y-1.5">
              <h4 className="text-[10px] uppercase font-bold tracking-wider text-zinc-650 border-b pb-1 font-mono">Escopo Técnico da Demanda</h4>
              <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-line">{printingRequest.descricao || 'Nenhuma descrição detalhada.'}</p>
            </div>

            {/* Budgets comparison table */}
            <div className="space-y-2">
              <h4 className="text-[10px] uppercase font-bold tracking-wider text-zinc-650 border-b pb-1 font-mono">Orçamentos Recebidos e Homologados</h4>
              <table className="w-full text-left text-[11px] border-collapse border border-zinc-350">
                <thead>
                  <tr className="bg-zinc-100 uppercase text-[8px] font-black text-zinc-500 border-b border-zinc-350">
                    <th className="px-3 py-1.5 border-r border-zinc-350">Nº</th>
                    <th className="px-3 py-1.5 border-r border-zinc-350">Fornecedor Participante</th>
                    <th className="px-3 py-1.5 border-r border-zinc-350 text-right">Valor Total</th>
                    <th className="px-3 py-1.5 border-r border-zinc-350">Prazo de Entrega</th>
                    <th className="px-3 py-1.5 text-center">PDF Anexo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {(printingRequest.orcamentos || []).map((o: any, idx: number) => {
                    const isChosenB = printingRequest.orcamento_escolhido === o.numero;
                    return (
                      <tr key={idx} className={`font-medium ${isChosenB ? 'bg-zinc-100 font-extrabold' : ''}`}>
                        <td className="px-3 py-1.5 border-r border-zinc-350 font-mono">{o.numero}</td>
                        <td className="px-3 py-1.5 border-r border-zinc-350 truncate max-w-[250px]">
                          {o.fornecedor} {o.recomendado && '(Recomendado Brasileiro)'} {isChosenB && '[ESCOLHIDO SÍNDICO]'}
                        </td>
                        <td className="px-3 py-1.5 border-r border-zinc-350 text-right font-mono">{formatCurrency(o.valor)}</td>
                        <td className="px-3 py-1.5 border-r border-zinc-350">{o.prazo_entrega || '-'}</td>
                        <td className="px-3 py-1.5 text-center">{o.attachments && o.attachments.length > 0 ? 'Anexo Ok' : 'Sem PDF'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Decision Analysis Box */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-50 p-3 border border-zinc-250 rounded-xl">
                <h5 className="text-[9px] uppercase font-bold text-zinc-500 font-mono">Parecer da Brasileira</h5>
                <p className="text-xs text-zinc-700 italic mt-1 leading-relaxed">
                  &ldquo;{printingRequest.orcamentos?.find((o: any) => o.recomendado)?.justificativa_melhor_proposta || 'Análise técnica competitiva atestada pela plataforma.'}&rdquo;
                </p>
              </div>

              <div className="bg-zinc-50 p-3 border border-zinc-250 rounded-xl">
                <h5 className="text-[9px] uppercase font-bold text-zinc-500 font-mono">Justificativa de Escolha do Síndico</h5>
                <p className="text-xs text-zinc-700 mt-1 font-bold">
                  Escolhido: {printingRequest.orcamentos?.find((o: any) => o.numero === printingRequest.orcamento_escolhido)?.fornecedor || 'Pendente de aprovação.'}
                </p>
                <p className="text-xs text-zinc-650 italic mt-0.5 leading-relaxed">
                  {printingRequest.justificativa_condominio ? (
                    <span>&ldquo;{printingRequest.justificativa_condominio}&rdquo;</span>
                  ) : (
                    <span className="text-zinc-400">Justificativa não documentada formalmente.</span>
                  )}
                </p>
              </div>
            </div>

            {/* Financial tracking */}
            {printingRequest.orcamentos && printingRequest.orcamentos.length > 0 && (
              <div className="bg-zinc-100 p-3.5 border border-zinc-300 rounded-xl text-xs grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[9px] uppercase font-bold text-zinc-400 block font-mono">Menor Proposta recebida</span>
                  <span className="font-bold text-zinc-800 text-sm mt-0.5 block">
                    {formatCurrency(Math.min(...printingRequest.orcamentos.map((o: any) => o.valor)))}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-zinc-400 block font-mono">Maior Proposta recebida</span>
                  <span className="font-bold text-zinc-805 text-sm mt-0.5 block">
                    {formatCurrency(Math.max(...printingRequest.orcamentos.map((o: any) => o.valor)))}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-zinc-400 block font-mono">Economia Efetiva Confirmada</span>
                  <span className="font-black text-emerald-700 text-sm mt-0.5 block">
                    {(() => {
                      const maxVal = Math.max(...printingRequest.orcamentos.map((o: any) => o.valor));
                      const chosenVal = printingRequest.orcamentos?.find((o: any) => o.numero === printingRequest.orcamento_escolhido)?.valor || 0;
                      return chosenVal > 0 && maxVal > chosenVal ? formatCurrency(maxVal - chosenVal) : 'R$ 0,00';
                    })()}
                  </span>
                </div>
              </div>
            )}

            {/* Compliance security markers */}
            <div className="border border-zinc-200 p-3 rounded-lg text-xs space-y-2">
              <h5 className="text-[9px] uppercase font-bold text-zinc-500 font-mono tracking-wider border-b pb-1">Marcadores de Governança Documental</h5>
              <div className="grid grid-cols-3 gap-2">
                <div>• Possui PDFs do Proponente: <span className="font-bold">{printingRequest.orcamentos?.some((o: any) => o.attachments && o.attachments.length > 0) ? 'CONFIRMADO' : 'PENDENTE'}</span></div>
                <div>• Justificativa de Voto: <span className="font-bold">{printingRequest.justificativa_condominio ? 'CONFIRMADO' : 'PENDENTE'}</span></div>
                <div>• Assembleia Requerida: <span className="font-bold">{printingRequest.assembly_data?.required ? 'SIM' : 'NÃO'}</span></div>
              </div>
            </div>

            {/* Signature Area */}
            <div className="pt-8 border-t border-dashed border-zinc-400 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="space-y-1">
                <div className="border-b border-zinc-400 w-48 mx-auto. mt-4 pb-1" />
                <p className="font-bold text-zinc-800">Brasileiro Administradora</p>
                <p className="text-[10px] text-zinc-400">Auditoria Técnica de Compras</p>
              </div>
              <div className="space-y-1">
                <div className="border-b border-zinc-400 w-48 mx-auto pb-1" />
                {printingRequest.autorizado_por_nome ? (
                  <>
                    <p className="font-bold text-zinc-800">{printingRequest.autorizado_por_nome}</p>
                    <p className="text-[10px] text-zinc-400">Aprovador Autorizado ({printingRequest.autorizado_por_cargo || 'Síndico'})</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-zinc-400">Assinatura do Conselho / Síndico</p>
                    <p className="text-[10px] text-zinc-400">Pendente de aprovação formal</p>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
