import estilos from "../../styles/quiz.module.css";

// Cenas desenhadas no lugar das 4 fotos reais do quiz.
//
// POR QUE ISTO EXISTE: a página estava com retângulos cinza tracejados
// esperando as fotos da agência. Não dá para julgar layout, ritmo e peso visual
// olhando para buracos — então aqui vai uma simulação de cada foto, feita em
// SVG, para a tela poder ser avaliada inteira antes das fotos existirem.
//
// NÃO É FOTO E NÃO FINGE SER: é ilustração, sem rosto e sem lugar
// identificável, e cada uma carrega o selo "simulação" no canto. Quando as
// fotos reais chegarem, troque <CenaSimulada> por <img> — a legenda embaixo já
// diz qual foto entra em cada posição.

export type LetraFoto = "A" | "B" | "C" | "D";

// Um id por instância. Dois <svg> na mesma página com gradientes de mesmo id
// fariam o segundo herdar a pintura do primeiro.
const idsDe = (cena: string, sufixos: string[]) =>
  Object.fromEntries(
    sufixos.map((s) => [s, `cena-${cena}-${s}`])
  ) as Record<string, string>;

// A — Balanço/mirante com vista para a serra. Meio-dia alto, vale abrindo.
const CenaA = () => {
  const id = idsDe("A", ["ceu", "longe", "perto"]);
  return (
    <svg className={estilos.fotoArte} role="presentation" viewBox="0 0 400 300">
      <defs>
        <linearGradient id={id.ceu} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7DBBE6" />
          <stop offset="55%" stopColor="#BBDCEF" />
          <stop offset="100%" stopColor="#E8F1E4" />
        </linearGradient>
        <linearGradient id={id.longe} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#8FA8A5" />
          <stop offset="100%" stopColor="#B8C7BE" />
        </linearGradient>
        <linearGradient id={id.perto} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#4E6B4A" />
          <stop offset="100%" stopColor="#2E4530" />
        </linearGradient>
      </defs>

      <rect fill={`url(#${id.ceu})`} height="300" width="400" />
      <circle cx="316" cy="62" fill="#FDF6E3" opacity=".85" r="26" />

      {/* Chapada de topo chato: a forma real da Ibiapaba, não pico alpino. */}
      <path d="M0 186 L74 180 L96 148 L214 143 L236 172 L330 168 L352 140 L400 137 L400 300 L0 300 Z" fill={`url(#${id.longe})`} />
      <path d="M0 300 L0 214 L120 208 L150 186 L268 182 L296 206 L400 200 L400 300 Z" fill="#6E8A72" opacity=".92" />

      {/* Borda do mirante em primeiro plano. */}
      <path d="M0 300 L0 252 L92 244 L188 258 L296 246 L400 254 L400 300 Z" fill={`url(#${id.perto})`} />

      {/* Galho e balanço, contra a luz. */}
      <path d="M126 0 L126 96 M126 40 C 168 34, 214 40, 252 52" fill="none" stroke="#3B4A33" strokeLinecap="round" strokeWidth="9" />
      <path d="M196 46 L192 154 M228 50 L226 156" stroke="#6B5844" strokeLinecap="round" strokeWidth="3" />
      <rect fill="#8A6D4F" height="9" rx="3" width="66" x="176" y="152" />

      {/* Folhagem solta, para o galho não parecer um traço técnico. */}
      <ellipse cx="150" cy="34" fill="#3E5334" opacity=".9" rx="34" ry="19" />
      <ellipse cx="206" cy="30" fill="#47603A" opacity=".85" rx="30" ry="16" />
      <ellipse cx="258" cy="46" fill="#3E5334" opacity=".75" rx="24" ry="13" />
    </svg>
  );
};

// B — Restaurante/deck ao entardecer, vista panorâmica. É a cena quente.
const CenaB = () => {
  const id = idsDe("B", ["ceu", "sol", "serra", "deck"]);
  return (
    <svg className={estilos.fotoArte} role="presentation" viewBox="0 0 400 300">
      <defs>
        <linearGradient id={id.ceu} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3B4A78" />
          <stop offset="42%" stopColor="#C4685A" />
          <stop offset="72%" stopColor="#EE9A55" />
          <stop offset="100%" stopColor="#F7C978" />
        </linearGradient>
        <radialGradient cx="50%" cy="50%" id={id.sol} r="50%">
          <stop offset="0%" stopColor="#FFF3C4" />
          <stop offset="100%" stopColor="#FFC46B" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id.serra} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#5B4560" />
          <stop offset="100%" stopColor="#3A2C45" />
        </linearGradient>
        <linearGradient id={id.deck} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#8C6A46" />
          <stop offset="100%" stopColor="#5E452C" />
        </linearGradient>
      </defs>

      <rect fill={`url(#${id.ceu})`} height="300" width="400" />
      <circle cx="272" cy="150" fill={`url(#${id.sol})`} r="96" />
      <circle cx="272" cy="152" fill="#FFE9A8" r="21" />

      {/* Nuvens finas cortando o poente. */}
      <rect fill="#F3B27E" height="5" opacity=".55" rx="3" width="150" x="52" y="104" />
      <rect fill="#F3B27E" height="4" opacity=".4" rx="2" width="106" x="212" y="88" />

      <path d="M0 196 L88 190 L112 162 L232 158 L256 186 L340 182 L364 158 L400 156 L400 300 L0 300 Z" fill={`url(#${id.serra})`} />
      <path d="M0 300 L0 224 L110 218 L150 202 L272 198 L300 218 L400 212 L400 300 Z" fill="#2B2136" />

      {/* Deck: piso, guarda-corpo e uma mesa posta. */}
      <rect fill={`url(#${id.deck})`} height="52" width="400" y="248" />
      <path d="M0 252 H400 M0 268 H400 M0 284 H400" opacity=".35" stroke="#3F2E1D" strokeWidth="2" />
      <path d="M12 248 V214 M136 248 V214 M262 248 V214 M388 248 V214" stroke="#6B4F33" strokeLinecap="round" strokeWidth="5" />
      <rect fill="#6B4F33" height="5" rx="2" width="400" y="212" />
      <ellipse cx="196" cy="244" fill="#F6E7CE" rx="46" ry="11" />
      <rect fill="#EFD9B4" height="8" rx="3" width="14" x="189" y="228" />
    </svg>
  );
};

// C — Piscina natural de pedra com queda d'água. É a cena fria, do silêncio.
const CenaC = () => {
  const id = idsDe("C", ["mata", "pedra", "agua", "queda"]);
  return (
    <svg className={estilos.fotoArte} role="presentation" viewBox="0 0 400 300">
      <defs>
        <linearGradient id={id.mata} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#24422C" />
          <stop offset="100%" stopColor="#3C6440" />
        </linearGradient>
        <linearGradient id={id.pedra} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#9AA1A0" />
          <stop offset="100%" stopColor="#5E6667" />
        </linearGradient>
        <linearGradient id={id.agua} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#67C2C0" />
          <stop offset="55%" stopColor="#2E8C95" />
          <stop offset="100%" stopColor="#1B5F71" />
        </linearGradient>
        <linearGradient id={id.queda} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".95" />
          <stop offset="100%" stopColor="#D5F0F2" stopOpacity=".55" />
        </linearGradient>
      </defs>

      <rect fill={`url(#${id.mata})`} height="300" width="400" />

      {/* Copas fechando por cima: luz entrando só por frestas. */}
      <ellipse cx="44" cy="24" fill="#1B3423" rx="88" ry="46" />
      <ellipse cx="196" cy="8" fill="#203D27" rx="104" ry="40" />
      <ellipse cx="356" cy="26" fill="#1B3423" rx="82" ry="44" />

      {/* Paredão de pedra e a queda. */}
      <path d="M96 42 L286 42 L300 168 L84 168 Z" fill={`url(#${id.pedra})`} />
      <path d="M120 60 L150 60 M240 74 L268 74 M112 118 L146 118" opacity=".5" stroke="#464D4E" strokeWidth="3" />
      <path d="M174 46 L212 46 L220 172 L166 172 Z" fill={`url(#${id.queda})`} />
      <path d="M186 60 V160 M200 54 V164" opacity=".7" stroke="#FFFFFF" strokeLinecap="round" strokeWidth="3" />

      {/* Poço. A espuma do impacto fica onde a queda bate. */}
      <path d="M0 300 L0 196 C 92 176, 300 176, 400 200 L400 300 Z" fill={`url(#${id.agua})`} />
      <ellipse cx="193" cy="192" fill="#FFFFFF" opacity=".75" rx="46" ry="13" />
      <ellipse cx="193" cy="204" fill="#FFFFFF" opacity=".3" rx="72" ry="15" />
      <path d="M52 236 h74 M244 232 h92 M96 268 h120" opacity=".35" stroke="#CFF3F2" strokeLinecap="round" strokeWidth="4" />

      {/* Pedras da borda, quebrando a linha da água. */}
      <ellipse cx="36" cy="206" fill="#6E7677" rx="52" ry="24" />
      <ellipse cx="372" cy="212" fill="#6E7677" rx="46" ry="22" />
    </svg>
  );
};

// D — Teleférico sobre a mata. É a cena de movimento, vista de altura.
const CenaD = () => {
  const id = idsDe("D", ["ceu", "vale", "mata", "cabine"]);
  return (
    <svg className={estilos.fotoArte} role="presentation" viewBox="0 0 400 300">
      <defs>
        <linearGradient id={id.ceu} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#6FA9D8" />
          <stop offset="70%" stopColor="#C3DDEB" />
          <stop offset="100%" stopColor="#DCE9E0" />
        </linearGradient>
        <linearGradient id={id.vale} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#93AFA8" />
          <stop offset="100%" stopColor="#6E8C7E" />
        </linearGradient>
        <linearGradient id={id.mata} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3F6440" />
          <stop offset="100%" stopColor="#1F3A25" />
        </linearGradient>
        <linearGradient id={id.cabine} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#F07C2C" />
          <stop offset="100%" stopColor="#C2410C" />
        </linearGradient>
      </defs>

      <rect fill={`url(#${id.ceu})`} height="300" width="400" />

      {/* Serra ao fundo, e a névoa do vale entre ela e a mata. */}
      <path d="M0 152 L70 146 L96 118 L206 114 L230 142 L322 138 L346 114 L400 112 L400 220 L0 220 Z" fill={`url(#${id.vale})`} />
      <rect fill="#E7F0EC" height="26" opacity=".65" width="400" y="150" />

      {/* Dossel: elipses sobrepostas leem como copas vistas de cima. */}
      <path d="M0 300 L0 196 C 60 178, 128 200, 196 190 C 268 180, 330 202, 400 188 L400 300 Z" fill={`url(#${id.mata})`} />
      <ellipse cx="52" cy="212" fill="#4B7449" opacity=".9" rx="42" ry="20" />
      <ellipse cx="150" cy="228" fill="#41693F" opacity=".85" rx="48" ry="22" />
      <ellipse cx="262" cy="216" fill="#4B7449" opacity=".85" rx="44" ry="20" />
      <ellipse cx="358" cy="232" fill="#41693F" opacity=".8" rx="40" ry="19" />

      {/* Cabo e torre. */}
      <path d="M0 66 C 130 96, 270 96, 400 60" fill="none" stroke="#334155" strokeWidth="3" />
      <path d="M352 74 L352 190 M336 190 L368 190" stroke="#475569" strokeLinecap="round" strokeWidth="5" />

      {/* Cabine na cor da marca — é o ponto de atenção da imagem. */}
      <path d="M172 84 L172 104" stroke="#334155" strokeWidth="4" />
      <rect fill={`url(#${id.cabine})`} height="52" rx="10" width="66" x="139" y="102" />
      <rect fill="#DCEAF3" height="22" rx="5" width="46" x="149" y="112" />
      <rect fill="#9A3412" height="5" rx="2" width="66" x="139" y="146" />
    </svg>
  );
};

// Cena de abertura: a serra inteira, não uma das quatro fotos.
//
// As outras quatro são atrações específicas — balanço, deck, piscina,
// teleférico. A abertura precisa de outra coisa: mostrar PARA ONDE se vai,
// antes de a pessoa saber o que tem lá. Por isso é o amanhecer subindo a
// Ibiapaba, que é literalmente o que a copy do resultado descreve ("acorda já
// subindo a serra, o vidro embaçando, o verde tomando o lugar da cidade").
//
// A forma é de cuesta — topo chato, escarpa de um lado só. A Ibiapaba é uma
// chapada, não um pico alpino, e desenhar um triângulo pontudo aqui seria
// vender uma paisagem que não existe.
export const CenaAbertura = () => {
  const id = idsDe("abertura", [
    "ceu",
    "sol",
    "longe",
    "meio",
    "agua",
    "borda",
  ]);

  return (
    <svg className={estilos.fotoArte} role="presentation" viewBox="0 0 800 400">
      <defs>
        <linearGradient id={id.ceu} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3E5A8C" />
          <stop offset="34%" stopColor="#9A7FA6" />
          <stop offset="62%" stopColor="#E0906B" />
          <stop offset="100%" stopColor="#F7CE94" />
        </linearGradient>
        <radialGradient cx="50%" cy="50%" id={id.sol} r="50%">
          <stop offset="0%" stopColor="#FFF3D0" />
          <stop offset="45%" stopColor="#FFC98A" stopOpacity=".5" />
          <stop offset="100%" stopColor="#FFC98A" stopOpacity="0" />
        </radialGradient>
        {/* Perspectiva atmosférica: quanto mais longe, mais claro e mais
            azulado. Sem isso as cristas viram recortes chapados. */}
        <linearGradient id={id.longe} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7C7FA0" />
          <stop offset="100%" stopColor="#9FA3BC" />
        </linearGradient>
        <linearGradient id={id.meio} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#4A5F63" />
          <stop offset="100%" stopColor="#31474A" />
        </linearGradient>
        <linearGradient id={id.agua} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7FCBD4" />
          <stop offset="55%" stopColor="#3E96AC" />
          <stop offset="100%" stopColor="#276C86" />
        </linearGradient>
        <linearGradient id={id.borda} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#D9CBB4" />
          <stop offset="100%" stopColor="#B3A188" />
        </linearGradient>
      </defs>

      <rect fill={`url(#${id.ceu})`} height="400" width="800" />
      <circle cx="548" cy="196" fill={`url(#${id.sol})`} r="170" />
      <circle cx="548" cy="198" fill="#FFEFC2" r="30" />

      {/* Nuvens compridas cortando o poente. */}
      <rect fill="#E9A67F" height="6" opacity=".5" rx="3" width="216" x="80" y="140" />
      <rect fill="#F0BE95" height="5" opacity=".4" rx="3" width="150" x="430" y="120" />

      {/* Cristas de topo chato: a Ibiapaba é chapada, não pico alpino. */}
      <path
        d="M0 236 L104 230 L132 196 L292 190 L318 228 L446 222 L478 190 L648 184 L674 226 L800 220 L800 300 L0 300 Z"
        fill={`url(#${id.longe})`}
      />
      <rect fill="#F0DFC8" height="26" opacity=".45" width="800" y="230" />
      <path
        d="M0 300 L0 268 L156 262 L188 236 L400 230 L428 262 L566 256 L598 232 L800 226 L800 300 Z"
        fill={`url(#${id.meio})`}
      />

      {/* Borda da piscina e a água refletindo o pôr do sol. */}
      <rect fill={`url(#${id.borda})`} height="22" width="800" y="292" />
      <path d="M0 314 L800 314 L800 400 L0 400 Z" fill={`url(#${id.agua})`} />
      <ellipse cx="548" cy="352" fill="#FFE3A8" opacity=".45" rx="60" ry="12" />
      <path
        d="M60 336 h120 M300 330 h90 M640 344 h108 M180 372 h150"
        opacity=".38"
        stroke="#DFF6F7"
        strokeLinecap="round"
        strokeWidth="4"
      />

      {/* A pessoa boiando: cabeça, tronco e joelhos fora d'água, de costas
          para quem olha. Sem rosto de propósito — a cena tem que servir para
          qualquer pessoa que esteja lendo. */}
      <g>
        <ellipse cx="300" cy="346" fill="#1F5C70" opacity=".3" rx="96" ry="20" />
        {/* boia */}
        <ellipse cx="300" cy="340" fill="#F3F6F4" rx="74" ry="24" />
        <ellipse cx="300" cy="338" fill={`url(#${id.agua})`} rx="46" ry="13" />
        <path d="M226 340 a74 24 0 0 1 148 0" fill="none" stroke="#E15D4A" strokeWidth="7" />
        {/* cabeça e ombros */}
        <circle cx="300" cy="312" fill="#8A6141" r="17" />
        <path d="M283 306 a17 17 0 0 1 34 0 z" fill="#2E2119" />
        <path d="M272 330 h56" stroke="#8A6141" strokeLinecap="round" strokeWidth="9" />
        {/* joelhos, um de cada lado */}
        <ellipse cx="352" cy="330" fill="#8A6141" rx="13" ry="9" />
        <ellipse cx="374" cy="336" fill="#8A6141" rx="11" ry="8" />
      </g>

      {/* Vegetação de borda, para a piscina não flutuar no nada. */}
      <g fill="#20372C">
        <rect height="34" rx="3" width="6" x="86" y="262" />
        <ellipse cx="89" cy="262" rx="30" ry="9" />
        <ellipse cx="74" cy="255" rx="19" ry="7" />
        <rect height="28" rx="3" width="5" x="722" y="268" />
        <ellipse cx="724" cy="268" rx="25" ry="8" />
        <ellipse cx="736" cy="262" rx="16" ry="6" />
      </g>

      {/* Logo da RW dentro da imagem: é o que assina a cena quando ela circula
          fora do site — print, story, compartilhamento no WhatsApp. */}
      <g>
        <rect fill="#FFFFFF" height="38" opacity=".92" rx="19" width="128" x="24" y="338" />
        <image
          height="24"
          href="/rw-turismo-logo.png"
          preserveAspectRatio="xMidYMid meet"
          width="104"
          x="36"
          y="345"
        />
      </g>
    </svg>
  );
};

const CENAS: Record<LetraFoto, () => JSX.Element> = {
  A: CenaA,
  B: CenaB,
  C: CenaC,
  D: CenaD,
};

const CenaSimulada = ({ letra }: { letra: LetraFoto }) => {
  const Cena = CENAS[letra];
  return <Cena />;
};

export default CenaSimulada;
