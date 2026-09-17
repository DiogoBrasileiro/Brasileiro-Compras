
import { PurchaseRecord, StockItem } from "../types";

export const normalizeItemKey = (name: string): string => {
  return name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
    .trim()
    .replace(/\s+/g, ' '); // normalize spaces
};

const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 30; // Default fallback
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const calculatePredictiveStock = (
  items: StockItem[],
  history: PurchaseRecord[]
): StockItem[] => {
  return items.map(item => {
    // 1. Filter history for this specific item and condo
    const currentItemKey = normalizeItemKey(item.name);
    const itemHistory = history.filter(h => 
      h.condominio_id === item.condominio_id && 
      h.item_key === currentItemKey
    ).sort((a, b) => new Date(a.data_compra).getTime() - new Date(b.data_compra).getTime());

    // 2. Calculate intervals (days) between purchases
    const intervals: number[] = [];
    for (let i = 1; i < itemHistory.length; i++) {
        const d1 = new Date(itemHistory[i-1].data_compra);
        const d2 = new Date(itemHistory[i].data_compra);
        const diffTime = Math.abs(d2.getTime() - d1.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        intervals.push(diffDays);
    }

    // 3. Determine median duration
    // If no history, use existing manual duration or default to 30
    const medianDuration = intervals.length > 0 ? calculateMedian(intervals) : (item.media_duracao_dias || 30);
    
    // 4. Calculate next predicted date
    const lastPurchaseDate = itemHistory.length > 0 
        ? new Date(itemHistory[itemHistory.length - 1].data_compra)
        : (item.ultima_reposicao ? new Date(item.ultima_reposicao) : new Date());
        
    const nextDate = new Date(lastPurchaseDate);
    nextDate.setDate(lastPurchaseDate.getDate() + medianDuration);

    // 5. Determine Confidence Level based on sample size (N)
    let confidence: 'BAIXA' | 'MEDIA' | 'ALTA' = 'BAIXA';
    if (intervals.length >= 5) confidence = 'ALTA';
    else if (intervals.length >= 2) confidence = 'MEDIA';

    return {
        ...item,
        media_duracao_dias: Math.round(medianDuration),
        proxima_reposicao_prevista: nextDate.toISOString().split('T')[0],
        confianca_previsao: confidence
    };
  });
};
