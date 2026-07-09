// CSV pensado para o Excel pt-BR: separador ";", BOM UTF-8 e quebras CRLF.
export const downloadCsv = (
  filename: string,
  rows: (string | number | null | undefined)[][]
): void => {
  const escapeCell = (value: string | number | null | undefined) => {
    const text = String(value ?? "");
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
