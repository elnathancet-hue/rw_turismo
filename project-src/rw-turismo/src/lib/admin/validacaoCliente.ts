import { digitosDoTelefone, telefoneValido } from "../quiz/contato";

// As regras do cadastro de cliente, num lugar só.
//
// POR QUE UM MÓDULO, e não validação na tela: a tela e a rota precisam dizer a
// MESMA coisa. Antes a tela só exigia nome não-vazio e a rota só conferia o
// e-mail — então "A" com CPF "123" e telefone "abc" entrava na base pelos dois
// caminhos. E a importação já era mais rigorosa que os dois, o que fazia a
// mesma pessoa ser aceita pelo balcão e recusada pela planilha.
//
// A tela usa isto para marcar o campo antes de enviar; a rota usa o mesmo para
// recusar quem chega por fora. Nenhuma das duas é a "de verdade" — é a mesma.
//
// Telefone e nome reaproveitam lib/quiz/contato.ts. As regras não têm nada de
// específico do quiz: DDD + 8 ou 9 dígitos vale em qualquer lugar do sistema, e
// duplicar isso seria criar duas verdades sobre o que é um telefone.

export { digitosDoTelefone, mascararTelefone } from "../quiz/contato";

/** Só os dígitos, para CPF e afins. */
export const soDigitos = (valor: string): string =>
  String(valor || "").replace(/\D/g, "");

/**
 * 000.000.000-00 enquanto se digita. Corta no 11º dígito, então não dá para
 * digitar um CPF grande demais sem perceber.
 */
export const mascararCpf = (valor: string): string => {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

/**
 * CPF com dígito verificador conferido.
 *
 * Não é frescura: CPF errado é quase sempre erro de digitação, e um CPF trocado
 * numa ficha vira problema no embarque, onde a pessoa está com a mala na mão.
 * O dígito verificador pega a maioria dos erros de digitação de graça.
 */
export const cpfValido = (valor: string): boolean => {
  const d = soDigitos(valor);
  if (d.length !== 11) return false;
  // 111.111.111-11 e afins passam na conta do dígito, mas não são CPF de
  // ninguém — são o que sai quando alguém segura a tecla.
  if (/^(\d)\1{10}$/.test(d)) return false;

  const digito = (ate: number): number => {
    let soma = 0;
    for (let i = 0; i < ate; i += 1) {
      soma += Number(d[i]) * (ate + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
};

export const emailValido = (valor: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || "").trim());

/** Nome de gente: pelo menos duas letras, e não só pontuação ou número. */
export const nomeValido = (valor: string): boolean => {
  const limpo = String(valor || "").trim();
  // Sem \p{L}: ele exige target ES2018, e o tsconfig do projeto mira mais
  // baixo. A faixa cobre as acentuadas do portugues.
  return limpo.length >= 2 && /[a-zA-ZÀ-ÿ]/.test(limpo);
};

/**
 * Data no formato do <input type="date">, real e no passado.
 *
 * `new Date("2026-02-30")` não estoura — ele rola para março. Por isso a
 * conferência é campo a campo, e não "deu para converter".
 */
export const nascimentoValido = (valor: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split("-").map(Number);
  const data = new Date(ano!, mes! - 1, dia!);
  const real =
    data.getFullYear() === ano &&
    data.getMonth() === mes! - 1 &&
    data.getDate() === dia;
  if (!real) return false;
  if (data > new Date()) return false;
  // Ninguém vivo nasceu antes disso, e ano de 2 dígitos digitado errado
  // ("0019") cai aqui em vez de virar uma ficha de 2000 anos.
  return ano! >= 1900;
};

export type DadosDoCliente = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  birth_date?: string | null;
};

export type ErrosDoCliente = Partial<
  Record<keyof DadosDoCliente, string>
>;

/**
 * Erros por campo. Vazio quer dizer que dá para gravar.
 *
 * Campo em branco não é erro, com uma exceção: o nome. Cliente sem telefone,
 * sem CPF e sem e-mail continua sendo um contato válido — a agência guarda o
 * que tem. O que não pode é guardar um telefone que não é telefone.
 */
export const validarCliente = (dados: DadosDoCliente): ErrosDoCliente => {
  const erros: ErrosDoCliente = {};
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  if (!nomeValido(texto(dados.name))) {
    erros.name = "Informe o nome completo da pessoa.";
  }

  const email = texto(dados.email);
  if (email && !emailValido(email)) {
    erros.email = "E-mail inválido.";
  }

  const telefone = texto(dados.phone);
  if (telefone && !telefoneValido(telefone)) {
    erros.phone = `Telefone com DDD e 8 ou 9 dígitos. Você digitou ${digitosDoTelefone(telefone).length}.`;
  }

  const documento = texto(dados.document);
  if (documento && !cpfValido(documento)) {
    erros.document =
      soDigitos(documento).length === 11
        ? "Este CPF não existe — confira os números."
        : "CPF precisa de 11 dígitos.";
  }

  const nascimento = texto(dados.birth_date);
  if (nascimento && !nascimentoValido(nascimento)) {
    erros.birth_date = "Data de nascimento inválida.";
  }

  return erros;
};
