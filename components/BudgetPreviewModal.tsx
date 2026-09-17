import React from 'react';
import { Orcamento } from '../types';
import { Button } from './UI';
import { X, Calendar, Truck, CreditCard, CheckCircle, FileText, Paperclip, AlertCircle, ShoppingCart, Trophy, Award, Star } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

interface BudgetPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  budget: Orcamento;
  canApprove: boolean;
  onApprove: (budget: Orcamento) => void;
}

const CRITERIA_LABELS: Record<string, string> = {
    'MENOR_PRECO': 'Menor Preço Global',
    'PRAZO': 'Melhor Prazo de Entrega',
    'QUALIDADE': 'Qualidade Técnica Superior',
    'CONFIANCA': 'Fornecedor de Confiança/Homologado',
    'OUTRO': 'Outros Fatores'
};

export const BudgetPreviewModal: React.FC<BudgetPreviewModalProps> = ({ 
  isOpen, onClose, budget, canApprove, onApprove 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Special Banner for Recommended Budget */}
        {budget.is_melhor_proposta && (
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-center py-2 text-xs font-bold uppercase tracking-widest shadow-md z-10 flex items-center justify-center gap-2">
                <Trophy size={14} className="text-yellow-100" fill="currentColor"/> Recomendação Oficial Brasileiro
            </div>
        )}

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <div>
             <div className="flex items-center gap-2">
                <span className="bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded font-bold font-mono">#{budget.numero}</span>
                {budget.is_melhor_proposta && (
                    <span className="bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded-full font-bold border border-yellow-200 flex items-center gap-1">
                        <Award size={10}/> Melhor Opção
                    </span>
                )}
             </div>
             <h2 className="text-xl font-bold text-gray-900 mt-1">{budget.fornecedor}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500"><X size={20}/></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* --- TECHNICAL OPINION BLOCK (HIGHLIGHT) --- */}
            {budget.is_melhor_proposta && (
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-l-4 border-yellow-500 rounded-r-xl p-5 shadow-sm ring-1 ring-yellow-100">
                    <div className="flex items-start gap-3">
                        <div className="bg-yellow-100 p-2 rounded-full text-yellow-700 mt-1 shadow-sm">
                            <Star size={20} fill="currentColor" />
                        </div>
                        <div>
                            <h3 className="font-bold text-yellow-900 text-lg mb-1">Parecer Técnico Brasileiro</h3>
                            <p className="text-sm text-yellow-800 font-medium mb-3">
                                Analisamos as opções e recomendamos este fornecedor baseado no critério: <br/>
                                <span className="bg-yellow-200 text-yellow-900 px-2 py-0.5 rounded text-xs font-bold uppercase mt-1 inline-block">
                                    {CRITERIA_LABELS[budget.criterio_escolha || 'OUTRO'] || budget.criterio_escolha}
                                </span>
                            </p>
                            
                            {budget.justificativa_melhor_proposta && (
                                <div className="bg-white/60 p-3 rounded-lg border border-yellow-200/50">
                                    <p className="text-sm text-gray-800 italic leading-relaxed">
                                        "{budget.justificativa_melhor_proposta}"
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Value */}
            <div className="text-center py-5 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-sm text-slate-500 font-bold uppercase mb-1 tracking-wide">Valor Total da Proposta</p>
                <p className="text-4xl font-extrabold text-slate-900 tracking-tight">{formatCurrency(budget.valor)}</p>
            </div>

            {/* Conditions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 p-3 rounded-lg flex flex-col items-center text-center">
                    <Truck className="text-gray-400 mb-2" size={20}/>
                    <span className="text-xs font-bold text-gray-500 uppercase">Prazo Entrega</span>
                    <span className="text-sm font-bold text-gray-900">{budget.prazo_entrega || 'N/A'}</span>
                </div>
                <div className="bg-white border border-gray-200 p-3 rounded-lg flex flex-col items-center text-center">
                    <CreditCard className="text-gray-400 mb-2" size={20}/>
                    <span className="text-xs font-bold text-gray-500 uppercase">Pagamento</span>
                    <span className="text-sm font-bold text-gray-900">{budget.condicoes_pagamento || 'N/A'}</span>
                </div>
                <div className="bg-white border border-gray-200 p-3 rounded-lg flex flex-col items-center text-center">
                    <Calendar className="text-gray-400 mb-2" size={20}/>
                    <span className="text-xs font-bold text-gray-500 uppercase">Validade</span>
                    <span className="text-sm font-bold text-gray-900">{budget.validade ? new Date(budget.validade).toLocaleDateString() : 'N/A'}</span>
                </div>
            </div>

            {/* Items Table */}
            <div>
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><ShoppingCart size={18}/> Itens Cotados</h3>
                {budget.items && budget.items.length > 0 ? (
                    <div className="border border-gray-200 rounded-lg overflow-x-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap min-w-[500px]">
                            <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                                <tr>
                                    <th className="p-3">Item</th>
                                    <th className="p-3 text-center">Qtd</th>
                                    <th className="p-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {budget.items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="p-3">
                                            <div className="font-medium text-gray-900">{item.description}</div>
                                            <div className="text-xs text-gray-500">Unid: {item.unit} | Unit: {formatCurrency(item.unitPrice)}</div>
                                        </td>
                                        <td className="p-3 text-center text-gray-600">{item.quantity}</td>
                                        <td className="p-3 text-right font-bold text-gray-900">{formatCurrency(item.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded-lg">Itens não detalhados individualmente.</p>
                )}
            </div>

            {/* Observations */}
            {budget.observacoes && (
                <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-lg">
                    <h3 className="font-bold text-yellow-800 mb-1 text-sm flex items-center gap-2"><FileText size={16}/> Observações</h3>
                    <p className="text-sm text-yellow-900">{budget.observacoes}</p>
                </div>
            )}

            {/* Attachments */}
            {budget.attachments && budget.attachments.length > 0 && (
                <div>
                     <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Paperclip size={18}/> Anexos Originais</h3>
                     <div className="flex flex-wrap gap-2">
                        {budget.attachments.map(att => (
                            <a 
                                key={att.id} 
                                href={att.publicUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-brand-600 hover:bg-brand-50 transition-colors"
                            >
                                <Paperclip size={14}/> {att.fileName}
                            </a>
                        ))}
                     </div>
                </div>
            )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-gray-200 flex flex-col md:flex-row justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>Fechar</Button>
            {canApprove && (
                <Button 
                    onClick={() => onApprove(budget)} 
                    className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/30 w-full md:w-auto"
                >
                    <CheckCircle size={18} className="mr-2" /> Aprovar e Fazer Pedido
                </Button>
            )}
        </div>
      </div>
    </div>
  );
};