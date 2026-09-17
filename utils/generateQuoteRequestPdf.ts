import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PDFDocument } from "pdf-lib";
import { Solicitacao } from "../types";
import { imageUrlToDataUrl } from "./generateBudgetPdf";

export interface QuoteRequestItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface AttachmentToInclude {
  id: string;
  fileName: string;
  publicUrl?: string;
  fileType?: string;
  file?: File;
}

export interface GenerateQuoteRequestPdfProps {
  request: Solicitacao;
  supplier: {
    name: string;
    contact_name?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
  };
  items?: QuoteRequestItem[];
  itemsMode?: 'ATTACHMENT' | 'TYPED';
  description?: string;
  observations?: string;
  deadlineDays?: number;
  logoDataUrl?: string;
  includeAttachments?: boolean;
  selectedAttachments?: AttachmentToInclude[];
}

/**
 * Converts an image (from File or URL) into PNG bytes for embedding in PDFDocument.
 */
async function getPngBytesFromImage(source: string | File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    let objectUrl: string | null = null;
    if (source instanceof File) {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    } else {
      img.src = source;
    }

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          reject(new Error("Canvas context not available"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error("Canvas toBlob returned null"));
            return;
          }
          blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))).catch(reject);
        }, "image/png");
      } catch (err) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = (e) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error("Erro ao carregar imagem para conversão: " + e));
    };
  });
}

/**
 * Downloads or extracts raw bytes from URL or File.
 */
async function getFileBytes(source: string | File): Promise<Uint8Array> {
  if (source instanceof File) {
    const buf = await source.arrayBuffer();
    return new Uint8Array(buf);
  }
  const res = await fetch(source);
  if (!res.ok) throw new Error(`Falha no download do anexo (${res.status}): ${res.statusText}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Helper to download Blob as file
 */
export function triggerFileDownload(blob: Blob, fileName: string) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}

/**
 * Generates the clean, single-page professional Cover PDF using jsPDF.
 */
export const generateQuoteCoverDoc = async ({
  request,
  supplier,
  items = [],
  itemsMode = 'TYPED',
  description,
  observations,
  deadlineDays = 3,
  logoDataUrl,
  selectedAttachments = [],
}: GenerateQuoteRequestPdfProps): Promise<jsPDF> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // 1. CABEÇALHO INSTITUCIONAL BRASILEIRO
  let y = 12;
  try {
    if (logoDataUrl) {
      const logoData = await imageUrlToDataUrl(logoDataUrl);
      doc.addImage(logoData, "PNG", margin, y, 46, 12);
    } else {
      throw new Error("No logo");
    }
  } catch (e) {
    doc.setFillColor(16, 42, 67); // Navy brand
    doc.roundedRect(margin, y, 46, 12, 2, 2, "F");
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("BRASILEIRO", margin + 6, y + 8);
  }

  // Título do Documento à Direita
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 42, 67);
  doc.text("SOLICITAÇÃO DE ORÇAMENTO", pageWidth - margin, y + 5.5, { align: "right" });

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  const formattedDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  doc.text(
    `Protocolo: ${request.id}   |   Emissão: ${formattedDate}`,
    pageWidth - margin,
    y + 11,
    { align: "right" }
  );

  y += 16;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);

  y += 5;

  // 2. QUADRO RESUMO: CONDOMÍNIO E FORNECEDOR (Lado a Lado, Compacto e Elegante)
  const colWidth = (contentWidth - 6) / 2;
  const cardHeight = 28;

  // Bloco Solicitante
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, colWidth, cardHeight, 1.5, 1.5, "FD");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138); // Blue
  doc.text("CONDOMÍNIO / SOLICITANTE", margin + 4, y + 5.5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("Condomínio:", margin + 4, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  const condoName = doc.splitTextToSize(request.condominio_nome || "-", colWidth - 28);
  doc.text(condoName, margin + 24, y + 12);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("Protocolo:", margin + 4, y + 18.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(request.id, margin + 24, y + 18.5);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("Gestão:", margin + 4, y + 24.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text("Brasileiro Gestão Condominial", margin + 24, y + 24.5);

  // Bloco Fornecedor
  const col2X = margin + colWidth + 6;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(col2X, y, colWidth, cardHeight, 1.5, 1.5, "FD");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(4, 120, 87); // Emerald
  doc.text("FORNECEDOR DESTINATÁRIO", col2X + 4, y + 5.5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("Empresa:", col2X + 4, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  const supplierName = doc.splitTextToSize(supplier.name || "-", colWidth - 24);
  doc.text(supplierName, col2X + 20, y + 12);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("Contato:", col2X + 4, y + 18.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(supplier.contact_name || "Responsável Comercial", col2X + 20, y + 18.5);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("WhatsApp:", col2X + 4, y + 24.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(supplier.whatsapp || supplier.phone || "-", col2X + 20, y + 24.5);

  y += cardHeight + 6;

  // 3. OBJETO / TÍTULO DA COTAÇÃO
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentWidth, 6, "FD");
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 42, 67);
  doc.text("OBJETO DA SOLICITAÇÃO", margin + 3, y + 4.2);

  y += 9;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(`Título: ${request.titulo}`, margin, y);
  y += 4.5;

  const descToUse = description || request.descricao;
  if (descToUse && descToUse.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const descLines = doc.splitTextToSize(descToUse.trim(), contentWidth);
    // Limitar para não estourar a página capa
    const linesToPrint = descLines.slice(0, 3);
    doc.text(linesToPrint, margin, y);
    y += linesToPrint.length * 4.2 + 2;
  }

  y += 2;

  // 4. RELAÇÃO DE MATERIAIS / SERVIÇOS
  // Conforme auditoria: Se estiver em anexo, NÃO gerar artificialmente tabela fictícia
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentWidth, 6, "FD");
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 42, 67);
  doc.text("RELAÇÃO DE MATERIAIS / SERVIÇOS", margin + 3, y + 4.2);
  y += 8;

  if (itemsMode === 'ATTACHMENT' || items.length === 0) {
    // Bloco Elegante e Claro indicando que os itens constam no documento anexo
    doc.setFillColor(240, 253, 250); // Mint / teal suave
    doc.setDrawColor(153, 246, 228);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, contentWidth, 18, 1.5, 1.5, "FD");

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 118, 110); // Teal 800
    doc.text("Relação de materiais: conforme documento anexo.", margin + 5, y + 6.5);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const attachmentsNames = selectedAttachments.length > 0
      ? selectedAttachments.map(a => a.fileName).join(", ")
      : "Documento(s) incorporado(s) a este arquivo";
    doc.text(`Consulte as páginas seguintes deste PDF para visualizar a lista completa: ${attachmentsNames}`, margin + 5, y + 12.5, { maxWidth: contentWidth - 10 });

    y += 23;
  } else {
    // Tabela limpa de itens digitados
    const tableBody = items.map((item, idx) => [
      (idx + 1).toString().padStart(2, "0"),
      item.description,
      item.quantity.toString(),
      item.unit || "un",
      item.notes || "-",
      "R$ ____________",
      "R$ ____________",
    ]);

    autoTable(doc, {
      startY: y,
      head: [
        [
          "Item",
          "Descrição do Produto / Serviço",
          "Qtd.",
          "Unid.",
          "Observação",
          "Valor Unit.",
          "Valor Total",
        ],
      ],
      body: tableBody,
      theme: "grid",
      headStyles: {
        fillColor: [16, 42, 67],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: "bold",
        halign: "center",
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 12, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 12, halign: "center" },
        4: { cellWidth: 30 },
        5: { cellWidth: 26, halign: "center", textColor: [100, 116, 139] },
        6: { cellWidth: 26, halign: "center", textColor: [100, 116, 139] },
      },
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // 5. INSTRUÇÕES E CONDIÇÕES COMERCIAIS SOLICITADAS (Sintético, Objetivo e Desburocratizado)
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentWidth, 6, "FD");
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 42, 67);
  doc.text("INFORMAÇÕES SOLICITADAS NA PROPOSTA DO FORNECEDOR", margin + 3, y + 4.2);
  y += 8;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 24, 1.5, 1.5, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Prezado fornecedor, solicitamos que sua proposta comercial informe expressamente:", margin + 4, y + 5);

  doc.setFontSize(7.8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text("•  Valor total da proposta e valores unitários;", margin + 4, y + 10);
  doc.text("•  Prazo de entrega estimado (imediato ou dias úteis);", margin + 4, y + 14);
  doc.text("•  Condições e forma de pagamento (boleto faturado, Pix ou cartão);", margin + 4, y + 18);
  doc.text("•  Prazo de validade da proposta (mínimo sugerido: 10 dias) e nome do responsável comercial.", margin + 4, y + 22);

  y += 28;

  // 6. OBSERVAÇÕES COMPLEMENTARES
  if (observations && observations.trim()) {
    doc.setFontSize(7.8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("Observações operacionais:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const obsText = doc.splitTextToSize(observations.trim(), contentWidth);
    doc.text(obsText.slice(0, 2), margin, y + 4);
    y += 10;
  }

  // 7. ASSINATURA E CARIMBO INSTITUCIONAL (RODAPÉ DA PÁGINA CAPA)
  const footerY = pageHeight - 22;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, footerY, margin + 70, footerY);
  doc.line(pageWidth - margin - 70, footerY, pageWidth - margin, footerY);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Setor de Compras e Suprimentos", margin, footerY + 3.5);
  doc.text("Brasileiro Gestão Condominial", margin, footerY + 7);

  doc.text("Responsável Comercial (Assinatura / Proposta)", pageWidth - margin - 70, footerY + 3.5);
  doc.text(
    supplier.contact_name
      ? `${supplier.contact_name} — ${supplier.name || "Fornecedor"}`
      : supplier.name || "Fornecedor",
    pageWidth - margin - 70,
    footerY + 7
  );

  return doc;
};

/**
 * Main function: Generates a SINGLE combined PDF.
 * - Page 1: Professional Cover Request from Brasileiro Condomínios
 * - Following Pages: Incorporated attached documents (PDF pages or full-page images).
 */
export const generateQuoteRequestPdf = async (
  props: GenerateQuoteRequestPdfProps
): Promise<{ blob: Blob; fileName: string }> => {
  const { request, supplier, includeAttachments = true, selectedAttachments = [] } = props;

  const safeSupplier = (supplier.name || "Fornecedor").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Solicitacao_Orcamento_${request.id}_${safeSupplier}.pdf`;

  // Step 1: Generate Cover Page (Page 1)
  const coverDoc = await generateQuoteCoverDoc(props);
  const coverArrayBuffer = coverDoc.output("arraybuffer");

  // If attachments are disabled or none selected, return single page cover PDF directly
  if (!includeAttachments || selectedAttachments.length === 0) {
    const blob = new Blob([coverArrayBuffer], { type: "application/pdf" });
    triggerFileDownload(blob, fileName);
    return { blob, fileName };
  }

  // Step 2: Merge Cover Page + Attachments using pdf-lib
  try {
    const mergedPdf = await PDFDocument.create();

    // Add Cover Page (Page 1)
    const coverPdf = await PDFDocument.load(coverArrayBuffer);
    const coverPages = await mergedPdf.copyPages(coverPdf, coverPdf.getPageIndices());
    coverPages.forEach((p) => mergedPdf.addPage(p));

    // Incorporate each selected attachment in chronological order
    for (const att of selectedAttachments) {
      const source = att.file || att.publicUrl;
      if (!source) continue;

      const lowerName = (att.fileName || "").toLowerCase();
      const isPdf =
        att.fileType?.includes("pdf") ||
        lowerName.endsWith(".pdf");

      const isImage =
        att.fileType?.includes("image") ||
        lowerName.endsWith(".jpg") ||
        lowerName.endsWith(".jpeg") ||
        lowerName.endsWith(".png") ||
        lowerName.endsWith(".webp");

      if (isPdf) {
        try {
          const pdfBytes = await getFileBytes(source);
          const donorPdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
          const donorPages = await mergedPdf.copyPages(donorPdf, donorPdf.getPageIndices());
          donorPages.forEach((page) => mergedPdf.addPage(page));
        } catch (pdfErr) {
          console.warn(`Não foi possível incorporar o PDF anexo (${att.fileName}):`, pdfErr);
        }
      } else if (isImage) {
        try {
          // Convert image to PNG bytes for 100% reliable embedding in pdf-lib
          const pngBytes = await getPngBytesFromImage(source);
          const embeddedImage = await mergedPdf.embedPng(pngBytes);
          const { width: imgW, height: imgH } = embeddedImage.scale(1);

          // Standard A4 dimensions in PDF points (72 DPI: 595.28 x 841.89)
          const pageW = 595.28;
          const pageH = 841.89;
          const pad = 36; // 0.5 inch margins

          const maxW = pageW - pad * 2;
          const maxH = pageH - pad * 2;
          const scale = Math.min(maxW / imgW, maxH / imgH, 1);

          const renderW = imgW * scale;
          const renderH = imgH * scale;
          const posX = (pageW - renderW) / 2;
          const posY = (pageH - renderH) / 2;

          const imagePage = mergedPdf.addPage([pageW, pageH]);
          imagePage.drawImage(embeddedImage, {
            x: posX,
            y: posY,
            width: renderW,
            height: renderH,
          });
        } catch (imgErr) {
          console.warn(`Não foi possível converter a imagem anexa (${att.fileName}):`, imgErr);
        }
      }
    }

    const mergedBytes = await mergedPdf.save();
    const finalBlob = new Blob([mergedBytes], { type: "application/pdf" });
    triggerFileDownload(finalBlob, fileName);
    return { blob: finalBlob, fileName };
  } catch (mergeErr) {
    console.error("Falha ao unificar PDF com anexos, gerando apenas capa:", mergeErr);
    // Fallback: download cover page
    const fallbackBlob = new Blob([coverArrayBuffer], { type: "application/pdf" });
    triggerFileDownload(fallbackBlob, fileName);
    return { blob: fallbackBlob, fileName };
  }
};
