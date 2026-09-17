import React, { useMemo, forwardRef } from 'react';
import { 
  ShieldCheck, AlertTriangle, ShieldAlert, FileWarning, 
  HelpCircle, Archive, Clock, FileCheck, DollarSign, ListCollapse 
} from 'lucide-react';

export const GovernanceReport = forwardRef<HTMLDivElement, { data: any }>(({ data }, ref) => {
  const processedRequests = useMemo(() => {
    return data.processed || [];
  }, [data]);

  // Auditoria Lists
  const auditResults = useMemo(() => {
    const list = processedRequests;

    // 1. Less than 3 budgets (for requests in progress or approved)
    const lessThanThree = list.filter((r: any) => (r.orcamentos?.length || 0) < 3);

    // 2. Missing choice justification (approved and chosen, but no justification text)
    const missingJustification = list.filter((r: any) => r.chosenValue > 0 && !r.justificativa_condominio?.trim());

    // 3. Symbolic or zero value (approved budget is <= R$ 1.5)
    const symbolicValue = list.filter((r: any) => r.chosenValue > 0 && r.chosenValue <= 1.51);

    // 4. Missing supplier attachments
    const missingAttachments = list.filter((r: any) => {
      if (!r.orcamentos || r.orcamentos.length === 0) return false;
      return r.orcamentos.some((o: any) => !o.attachments || o.attachments.length === 0);
    });

    // 5. Open items age distribution
    const openItems = list.filter((r: any) => r.isOpen);
    const age15 = openItems.filter((r: any) => r.totalMs > (15 * 24 * 60 * 60 * 1000) && r.totalMs <= (30 * 24 * 60 * 60 * 1000)).length;
    const age30 = openItems.filter((r: any) => r.totalMs > (30 * 24 * 60 * 60 * 1000) && r.totalMs <= (45 * 24 * 60 * 60 * 1000)).length;
    const age45 = openItems.filter((r: any) => r.totalMs > (45 * 24 * 60 * 60 * 1000) && r.totalMs <= (60 * 24 * 60 * 60 * 1000)).length;
    const age60 = openItems.filter((r: any) => r.totalMs > (60 * 24 * 60 * 60 * 1000)).length;

    // 6. With Active Assembly
    const assemblyItems = list.filter((r: any) => r.assembly_data?.required);

    // 7. Missing basic metadata
    const missingMetadata = list.filter((r: any) => !r.categoria || !r.nivel || !r.tipo);

    return {
      lessThanThree,
      missingJustification,
      symbolicValue,
      missingAttachments,
      assemblyItems,
      missingMetadata,
      ageDist: { age15, age30, age45, age60 }
    };
  }, [processedRequests]);

  const stats = [
    { title: 'Menos de 3 Orçamentos', value: auditResults.lessThanThree.length, desc: 'Risco de complacência de preços', icon: ShieldAlert, color: 'text-amber-600 bg-amber-50' },
    { title: 'Sem Justificativa Sindical', value: auditResults.missingJustification.length, desc: 'Decisão sem registro formal', icon: FileWarning, color: 'text-rose-600 bg-rose-50' },
    { title: 'Valores Simbólicos (Fictícios)', value: auditResults.symbolicValue.length, desc: 'Erros ou valores de teste', icon: DollarSign, color: 'text-purple-600 bg-purple-50' },
    { title: 'Cotação Sem PDF do Anexo', value: auditResults.missingAttachments.length, desc: 'Falta comprovante fiscal', icon: FileCheck, color: 'text-indigo-600 bg-indigo-50' }
  ];

  return (
    <div ref={ref} className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm animate-fadeIn space-y-8">
      {/* Title block */}
      <div className="border-b pb-4">
        <h2 className="text-xl font-bold text-zinc-950 flex items-center gap-2">
          <ShieldCheck size={22} className="text-emerald-600" /> Governança, Compliance e Auditoria de Compras
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Rastreia desvios operacionais, inconsistências de faturamento, falta de orçamentos competitivos e vácuos de justificativa.
        </p>
      </div>

      {/* CORE STAT GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, idx) => (
          <div key={idx} className="p-5 rounded-2xl border border-zinc-100 bg-zinc-50 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${s.color}`}>
              <s.icon size={22} />
            </div>
            <div>
              <p className="text-2xl font-black text-zinc-900 leading-none mb-1">{s.value}</p>
              <h4 className="text-xs font-bold text-zinc-800 leading-tight">{s.title}</h4>
              <p className="text-[10px] text-zinc-400 mt-0.5 leading-none">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* HORIZONTAL TIMELINE AGE DISTRIBUTION */}
      <div className="bg-zinc-950 text-white p-6 rounded-3xl border border-zinc-900 shadow-lg print:bg-none print:border-zinc-200 print:text-zinc-950">
        <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-4 print:text-zinc-950">
          Envelhecimento de Solicitações em Aberto (Idade da Demanda)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-zinc-800/40 p-4 rounded-xl border border-zinc-800 print:border-zinc-200 print:bg-zinc-50">
            <span className="text-2xl font-extrabold text-indigo-300 print:text-black">{auditResults.ageDist.age15}</span>
            <span className="text-[10px] block text-zinc-400 uppercase font-black mt-1">Entre 15 e 30 dias</span>
          </div>
          <div className="bg-zinc-800/40 p-4 rounded-xl border border-zinc-800 print:border-zinc-200 print:bg-zinc-50">
            <span className="text-2xl font-extrabold text-amber-400 print:text-black">{auditResults.ageDist.age30}</span>
            <span className="text-[10px] block text-zinc-400 uppercase font-black mt-1">Entre 30 e 45 dias</span>
          </div>
          <div className="bg-zinc-800/40 p-4 rounded-xl border border-zinc-800 print:border-zinc-200 print:bg-zinc-50">
            <span className="text-2xl font-extrabold text-amber-500 print:text-black">{auditResults.ageDist.age45}</span>
            <span className="text-[10px] block text-zinc-400 uppercase font-black mt-1">Entre 45 e 60 dias</span>
          </div>
          <div className="bg-zinc-800/40 p-4 rounded-xl border border-zinc-800 print:border-zinc-200 print:bg-zinc-50">
            <span className="text-2xl font-extrabold text-rose-500 print:text-rose-700">{auditResults.ageDist.age60}</span>
            <span className="text-[10px] block text-zinc-400 uppercase font-black mt-1">Mais de 60 dias</span>
          </div>
        </div>
      </div>

      {/* COMPLEX COMPLIANCE LISTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:grid-cols-1">
        {/* 1. Less Than 3 quotes */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-rose-500 uppercase tracking-widest border-b pb-2 flex items-center gap-1.5 font-mono">
            <AlertTriangle size={14} /> Solicitados com Insuficiência de Orçamentos (&lt; 3 cotações)
          </h4>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {auditResults.lessThanThree.map((r: any) => (
              <div key={r.id} className="p-3 bg-zinc-50 rounded-xl border border-zinc-150 flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-zinc-900 block leading-tight">{r.titulo}</span>
                  <span className="text-[10px] text-zinc-500 font-medium block mt-1">Destino: {r.condominio_nome}</span>
                </div>
                <span className="bg-amber-100 text-amber-800 font-extrabold uppercase px-2 py-0.5 rounded text-[9px] whitespace-nowrap">
                  {r.orcamentos?.length || 0} proposta(s)
                </span>
              </div>
            ))}
            {auditResults.lessThanThree.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-6 font-medium">Sua operação está 100% em conformidade técnica de cotar &gt;= 3 orçamentos.</p>
            )}
          </div>
        </div>

        {/* 2. Approved without justification */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-amber-600 uppercase tracking-widest border-b pb-2 flex items-center gap-1.5 font-mono">
            <FileWarning size={14} /> Pedidos Aprovados e Comprados Sem Justificativa Registrada
          </h4>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {auditResults.missingJustification.map((r: any) => (
              <div key={r.id} className="p-3 bg-zinc-50 rounded-xl border border-zinc-150 flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-zinc-900 block leading-tight">{r.titulo}</span>
                  <p className="text-[9px] text-zinc-500 font-medium mt-1">Escolhido: <span className="font-bold text-zinc-700">{r.chosenBudget?.fornecedor}</span> por R$ {r.chosenValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                </div>
                <span className="bg-rose-50 text-rose-700 font-black px-2 py-1 rounded text-[9px] whitespace-nowrap">
                  Falta justificativa
                </span>
              </div>
            ))}
            {auditResults.missingJustification.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-6 font-medium">Todas as escolhas contêm justificativa formal registrada pelos síndicos / fiscais.</p>
            )}
          </div>
        </div>

        {/* 3. Symbolic values */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest border-b pb-2 flex items-center gap-1.5 font-mono">
            <DollarSign size={14} /> Adiantamentos ou Valores Fictícios / Simbólicos Mapeados
          </h4>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {auditResults.symbolicValue.map((r: any) => (
              <div key={r.id} className="p-3 bg-zinc-50 rounded-xl border border-zinc-150 flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-zinc-900 block leading-tight">{r.titulo}</span>
                  <span className="text-[10px] text-zinc-500 block font-medium mt-1">Condomínio: {r.condominio_nome}</span>
                </div>
                <span className="text-rose-600 font-extrabold font-mono">
                  R$ {r.chosenValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </span>
              </div>
            ))}
            {auditResults.symbolicValue.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-6 font-medium">Nenhuma compra com valores simbólicos ou fictícios lançada.</p>
            )}
          </div>
        </div>

        {/* 4. Active Assembleia requisites */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest border-b pb-2 flex items-center gap-1.5 font-mono">
            <Archive size={14} /> Demandas Marcadas para Deliberação de Assembleia
          </h4>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {auditResults.assemblyItems.map((r: any) => (
              <div key={r.id} className="p-3 bg-zinc-50 rounded-xl border border-zinc-150 flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-zinc-900 block leading-tight">{r.titulo}</span>
                  <span className="text-[10px] text-zinc-500 block font-medium">Status da assembleia: {r.assembly_data?.status || 'Aguardando'}</span>
                </div>
                <span className="text-indigo-600 font-extrabold font-mono text-[10px] bg-indigo-50 px-2 py-0.5 rounded">
                  Status: {r.status}
                </span>
              </div>
            ))}
            {auditResults.assemblyItems.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-6 font-medium">Nenhum pedido marcado como pendente de assembleia no momento.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

GovernanceReport.displayName = 'GovernanceReport';
