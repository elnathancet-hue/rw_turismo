import estilos from "../../styles/quiz-feriado.module.css";

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
    "perto",
    "estrada",
  ]);

  return (
    <svg className={estilos.fotoArte} role="presentation" viewBox="0 0 800 400">
      <defs>
        <linearGradient id={id.ceu} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#2B4C7E" />
          <stop offset="38%" stopColor="#6E8FB8" />
          <stop offset="68%" stopColor="#DDA57C" />
          <stop offset="100%" stopColor="#F6D9A8" />
        </linearGradient>
        <radialGradient cx="50%" cy="50%" id={id.sol} r="50%">
          <stop offset="0%" stopColor="#FFF4D6" />
          <stop offset="45%" stopColor="#FFD9A0" stopOpacity=".55" />
          <stop offset="100%" stopColor="#FFD9A0" stopOpacity="0" />
        </radialGradient>
        {/* Perspectiva atmosférica: quanto mais longe, mais claro e mais azul.
            É isso que dá profundidade — sem o degradê as cristas viram
            recortes chapados, um colado no outro. */}
        <linearGradient id={id.longe} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#9FB3CC" />
          <stop offset="100%" stopColor="#BFCEDC" />
        </linearGradient>
        <linearGradient id={id.meio} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#5E7C74" />
          <stop offset="100%" stopColor="#87A092" />
        </linearGradient>
        <linearGradient id={id.perto} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3A5A3C" />
          <stop offset="100%" stopColor="#1E3524" />
        </linearGradient>
        <linearGradient id={id.estrada} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#B9AFA4" />
          <stop offset="100%" stopColor="#8A8078" />
        </linearGradient>
      </defs>

      <rect fill={`url(#${id.ceu})`} height="400" width="800" />
      <circle cx="560" cy="212" fill={`url(#${id.sol})`} r="180" />
      <circle cx="560" cy="214" fill="#FFF1CE" opacity=".95" r="26" />

      {/* Nuvens compridas e finas, na altura do sol nascendo. */}
      <rect fill="#E8B489" height="7" opacity=".5" rx="4" width="230" x="96" y="150" />
      <rect fill="#E8B489" height="5" opacity=".38" rx="3" width="160" x="430" y="128" />
      <rect fill="#F2CBA4" height="6" opacity=".45" rx="3" width="190" x="250" y="182" />

      {/* Crista distante. */}
      <path
        d="M0 250 L96 244 L124 206 L286 200 L312 238 L438 232 L470 196 L638 190 L664 232 L800 226 L800 400 L0 400 Z"
        fill={`url(#${id.longe})`}
      />

      {/* Névoa do vale: separa os planos melhor que qualquer linha. */}
      <rect fill="#EFE2D2" height="34" opacity=".55" width="800" y="244" />

      {/* Chapada do meio — o topo chato aparece aqui. */}
      <path
        d="M0 400 L0 292 L150 286 L182 254 L392 248 L420 284 L556 278 L588 246 L800 240 L800 400 Z"
        fill={`url(#${id.meio})`}
      />
      <path
        d="M0 292 L150 286 L182 254 L392 248 L420 284 L556 278 L588 246 L800 240"
        fill="none"
        opacity=".5"
        stroke="#F3D6B4"
        strokeWidth="2"
      />

      {/* Encosta em primeiro plano, já verde-escura. */}
      <path
        d="M0 400 L0 330 L128 322 L214 340 L352 326 L470 344 L620 328 L800 338 L800 400 Z"
        fill={`url(#${id.perto})`}
      />

      {/* A estrada subindo: é o que transforma paisagem em viagem. */}
      <path
        d="M330 400 C 352 372, 300 356, 336 340 C 372 326, 452 336, 486 326"
        fill="none"
        stroke={`url(#${id.estrada})`}
        strokeLinecap="round"
        strokeWidth="26"
      />
      <path
        d="M330 400 C 352 372, 300 356, 336 340 C 372 326, 452 336, 486 326"
        fill="none"
        opacity=".55"
        stroke="#F4EDE4"
        strokeDasharray="10 16"
        strokeLinecap="round"
        strokeWidth="2"
      />

      {/* Carnaúbas: a silhueta que diz "isto é o Piauí/Ceará", e não uma serra
          genérica de banco de imagem. */}
      <g fill="#16281B">
        <path d="M92 400 L92 332 M92 336 c -22 -12, -34 -4, -40 6 M92 336 c 22 -12, 34 -4, 40 6 M92 344 c -16 -16, -30 -14, -38 -4 M92 344 c 16 -16, 30 -14, 38 -4" opacity="0" />
        <rect height="70" rx="3" width="7" x="88" y="330" />
        <ellipse cx="91" cy="330" rx="34" ry="10" />
        <ellipse cx="76" cy="322" rx="22" ry="8" />
        <ellipse cx="108" cy="324" rx="20" ry="8" />
        <rect height="56" rx="3" width="6" x="142" y="344" />
        <ellipse cx="145" cy="344" rx="26" ry="8" />
        <ellipse cx="133" cy="338" rx="17" ry="6" />
        <rect height="48" rx="3" width="5" x="702" y="352" />
        <ellipse cx="704" cy="352" rx="23" ry="7" />
        <ellipse cx="716" cy="347" rx="15" ry="6" />
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
