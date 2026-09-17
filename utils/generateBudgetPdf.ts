
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Solicitacao, Orcamento, RequestStatus } from "../types";

// Helper to convert Image URL to Data URI for jsPDF
export const imageUrlToDataUrl = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.setAttribute("crossOrigin", "anonymous");
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject("Canvas context failed");
                return;
            }
            ctx.drawImage(img, 0, 0);
            const dataURL = canvas.toDataURL("image/png");
            resolve(dataURL);
        };
        img.onerror = (error) => {
            reject(error);
        };
        img.src = url;
    });
};

interface GeneratePdfProps {
    request: Solicitacao;
    logoDataUrl: string;
    mode?: 'SUMMARY' | 'DETAILED';
}

const CRITERIA_LABELS: Record<string, string> = {
    'MENOR_PRECO': 'Menor Preço Global',
    'PRAZO': 'Melhor Prazo de Entrega',
    'QUALIDADE': 'Qualidade Técnica Superior',
    'CONFIANCA': 'Fornecedor de Confiança',
    'OUTRO': 'Outros Fatores'
};

export const generateBudgetPdf = async ({ request, logoDataUrl, mode = 'DETAILED' }: GeneratePdfProps) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const isSummary = mode === 'SUMMARY';

    const approverName = request.autorizado_por_nome || 
      (request.justificativa_condominio?.match(/Autorizado por: (.*?) -/)?.[1]) ||
      (request.justificativa_condominio?.match(/Aprovação formal por (.*?)\./)?.[1]) || 
      'N/A';
    
    const approverRole = request.autorizado_por_cargo || 
      (request.justificativa_condominio?.match(/- Cargo: (.*?)]/)?.[1]) || 
      'N/A';

    // --- 1. Header & Logo ---
    try {
        const logoData = await imageUrlToDataUrl(logoDataUrl);
        doc.addImage(logoData, 'PNG', margin, 15, 50, 12);
    } catch (e) {
        doc.setFontSize(22);
        doc.setTextColor(16, 42, 67);
        doc.setFont("helvetica", "bold");
        doc.text("Brasileiro", margin, 25);
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(isSummary ? "Relatório de Aprovação" : "Relatório Detalhado de Compra", pageWidth - margin, 20, { align: "right" });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Protocolo: ${request.id} | Gerado em: ${new Date().toLocaleString()}`, pageWidth - margin, 26, { align: "right" });

    doc.setLineWidth(0.5);
    doc.line(margin, 35, pageWidth - margin, 35);

    let y = 45;
    const col1 = margin;
    const lineHeight = 6;

    // --- SECTION 1: REQUEST INFO ---
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 4, pageWidth - (margin * 2), 7, 'F');
    doc.text("1. IDENTIFICAÇÃO", col1 + 2, y + 1);
    y += 10;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Condomínio: ${request.condominio_nome}`, col1, y);
    doc.text(`Solicitante: ${request.responsavel_nome}`, col1, y + lineHeight);
    doc.text(`Status: ${request.status.replace(/_/g, " ")}`, col1, y + lineHeight * 2);
    
    // ASSEMBLEIA INFO IN HEADER
    if (request.assembly_data?.required) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(128, 0, 128); // Purple
        doc.text(`Pauta de Assembleia: SIM (Incluir Orçamentos)`, col1, y + lineHeight * 3);
        doc.setTextColor(0, 0, 0);
    }
    y += lineHeight * 5;

    // --- SECTION 2: DESCRIPTION ---
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 4, pageWidth - (margin * 2), 7, 'F');
    doc.text("2. DESCRIÇÃO DA SOLICITAÇÃO", col1 + 2, y + 1);
    y += 10;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const descLines = doc.splitTextToSize(request.descricao, pageWidth - (margin * 2));
    doc.text(descLines, col1, y);
    y += (descLines.length * 5) + 8;

    // --- SECTION 3: COMPARATIVE ---
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 4, pageWidth - (margin * 2), 7, 'F');
    doc.text("3. QUADRO COMPARATIVO", col1 + 2, y + 1);
    y += 8;

    const tableData = request.orcamentos.map((o) => [
        `#${o.numero}`,
        o.fornecedor,
        `R$ ${o.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
        o.prazo_entrega || '-',
        o.is_melhor_proposta ? "RECOMENDADO" : (request.orcamento_escolhido === o.numero ? "ESCOLHIDO" : "-")
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Nº', 'Fornecedor', 'Valor Total', 'Prazo', 'Observação']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [16, 42, 67] },
        styles: { fontSize: 8 },
        margin: { left: margin, right: margin }
    });

    y = (doc as any).lastAutoTable.finalY + 15;

    // --- SECTION 4: HISTORY (ONLY DETAILED MODE) ---
    let extraSectionNum = 4;
    if (!isSummary && request.historico && request.historico.length > 0) {
        if (y + 20 > pageHeight - margin) { doc.addPage(); y = 30; }

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y - 4, pageWidth - (margin * 2), 7, 'F');
        doc.text(`${extraSectionNum}. HISTÓRICO DO PEDIDO`, col1 + 2, y + 1);
        y += 8;

        const historyData = [
            [
                new Date(request.data_solicitacao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
                request.responsavel_nome,
                'Solicitação Criada'
            ],
            ...[...request.historico].sort((a,b) => new Date(a.data).getTime() - new Date(b.data).getTime()).map((log) => [
                new Date(log.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
                log.usuario_nome,
                log.descricao
            ])
        ];

        autoTable(doc, {
            startY: y,
            head: [['Data/Hora', 'Ator', 'Descrição (Ação/Status)']],
            body: historyData,
            theme: 'grid',
            headStyles: { fillColor: [100, 100, 100] },
            styles: { fontSize: 8 },
            margin: { left: margin, right: margin },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 30 },
                2: { cellWidth: 'auto' }
            }
        });

        y = (doc as any).lastAutoTable.finalY + 15;
        extraSectionNum++;
    }

    // --- SECTION 5: APPROVAL AUDIT ---
    if (request.status === RequestStatus.APROVADO || request.data_decisao_condominio) {
        if (y + 40 > pageHeight - margin) { doc.addPage(); y = 30; }

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setFillColor(235, 255, 240);
        doc.rect(margin, y - 4, pageWidth - (margin * 2), 7, 'F');
        doc.setTextColor(0, 100, 0);
        doc.text(`${extraSectionNum}. REGISTRO DE APROVAÇÃO FORMAL`, col1 + 2, y + 1);
        doc.setTextColor(0, 0, 0);
        y += 10;

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("Autorizado por:", col1, y);
        doc.setFont("helvetica", "normal");
        doc.text(`${approverName}`, col1 + 30, y);
        
        doc.setFont("helvetica", "bold");
        doc.text("Cargo/Função:", col1, y + lineHeight);
        doc.setFont("helvetica", "normal");
        doc.text(`${approverRole}`, col1 + 30, y + lineHeight);

        doc.setFont("helvetica", "bold");
        doc.text("Data da Decisão:", col1, y + lineHeight * 2);
        doc.setFont("helvetica", "normal");
        doc.text(request.data_decisao_condominio ? new Date(request.data_decisao_condominio).toLocaleString('pt-BR') : 'N/A', col1 + 30, y + lineHeight * 2);
        
        y += lineHeight * 4;
    }

    // --- FINAL SIGNATURES ---
    if (y + 30 > pageHeight - margin) { doc.addPage(); y = 40; } else { y += 20; }
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 70, y);
    doc.line(pageWidth - margin - 70, y, pageWidth - margin, y);
    doc.setFontSize(7);
    doc.text("Visto do Síndico / Autorizador", margin, y + 4);
    doc.text("Brasileiro Administração", pageWidth - margin - 70, y + 4);

    const fileName = `RELATORIO_${isSummary ? 'APROVACAO' : 'DETALHADO'}_${request.id}.pdf`;
    doc.save(fileName);
};
