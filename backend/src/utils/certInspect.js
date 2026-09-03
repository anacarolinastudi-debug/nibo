// Lê metadados públicos de um certificado .pfx (titular e validade) sem
// nunca extrair ou logar a chave privada. Usado só para exibir o status
// na tela de Configurações.
const forge = require('node-forge');

function inspectPfx(buffer, passphrase) {
  let p12;
  try {
    const asn1 = forge.asn1.fromDer(buffer.toString('binary'));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, passphrase);
  } catch {
    throw new Error('Não foi possível ler o certificado. Confira se o arquivo é um .pfx/.p12 válido e se a senha está correta.');
  }

  const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = (bags[forge.pki.oids.certBag] || [])[0];
  if (!certBag?.cert) {
    throw new Error('O arquivo não contém um certificado válido.');
  }

  const cert = certBag.cert;
  const subject = cert.subject.attributes.map((attr) => attr.value).join(' ') || 'Certificado digital';

  return {
    subject,
    validUntil: cert.validity.notAfter,
  };
}

module.exports = { inspectPfx };
