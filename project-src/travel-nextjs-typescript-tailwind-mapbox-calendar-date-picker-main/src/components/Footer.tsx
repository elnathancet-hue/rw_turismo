type Props = {};

const Footer = (props: Props) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-y-10 px-32 py-14 bg-gray-100 text-gray-600">
      <div className="space-y-4 text-xs text-gray-800">
        <h5 className="font-bold">RW TURISMO</h5>
        <p>Como funciona</p>
        <p>Quem somos</p>
      </div>
      <div className="space-y-4 text-xs text-gray-800">
        <h5 className="font-bold">INSTITUCIONAL</h5>
        <p>Imprensa e mídia</p>
        <p>Parcerias</p>
        <p>Relacionamento</p>
        <p>Contato</p>
      </div>
      <div className="space-y-4 text-xs text-gray-800">
        <h5 className="font-bold">SUA VIAGEM</h5>
        <p>Dicas para viajantes</p>
        <p>Alterar uma reserva</p>
      </div>
      <div className="space-y-4 text-xs text-gray-800">
        <h5 className="font-bold">SUPORTE</h5>
        <p>Termos e condições</p>
        <p>Informações legais</p>
        <p>Política de privacidade</p>
        <p>Atendimento</p>
        <p>Segurança digital</p>
      </div>
    </div>
  );
};

export default Footer;
