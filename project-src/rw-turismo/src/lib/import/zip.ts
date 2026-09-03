// Descompactação de bloco deflate cru, compartilhada por quem lê .docx e .xlsx.
//
// Os dois formatos são ZIP com XML dentro, e os dois precisam exatamente disto.
// Estava duplicado: a leitura de .docx trouxe a primeira cópia, e a de .xlsx
// nasceu com a segunda, igual. Duas cópias de código de bytes é onde uma
// correção entra numa e não na outra.

/**
 * `deflate-raw` é o formato que o ZIP usa. `deflate` puro tem cabeçalho zlib e
 * falharia aqui — é o erro clássico de quem escreve leitor de ZIP.
 */
export const inflar = async (comprimido: Uint8Array): Promise<Uint8Array> => {
  const entrada = new ReadableStream({
    start(controller: ReadableStreamDefaultController) {
      controller.enqueue(comprimido);
      controller.close();
    },
  });

  const saida = entrada.pipeThrough(
    new DecompressionStream("deflate-raw")
  ) as ReadableStream<Uint8Array>;
  const leitor = saida.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    if (value) {
      pedacos.push(value);
      total += value.length;
    }
  }

  const resultado = new Uint8Array(total);
  let posicao = 0;
  for (const pedaco of pedacos) {
    resultado.set(pedaco, posicao);
    posicao += pedaco.length;
  }
  return resultado;
};

/**
 * DecompressionStream não existe em navegador antigo. Melhor dizer isso na
 * tela do que deixar o arquivo falhar sem explicação.
 */
export const navegadorLeZip = (): boolean =>
  typeof DecompressionStream !== "undefined";
