// Lê metadados públicos de um certificado .pfx (titular, CNPJ e validade) sem
// nunca extrair ou logar a chave privada. Usado só para exibir o status
// e conferir de quem é o certificado.
const forge = require('node-forge');

// OID ICP-Brasil do CNPJ da pessoa jurídica titular (subjectAltName / otherName).
const OID_CNPJ_DER = '\x06\x05\x60\x4c\x01\x03\x03';

// CNPJ do titular. No ICP-Brasil ele fica no fim do nome comum
// ("RAZAO SOCIAL:12345678000199") e no campo otherName 2.16.76.1.3.3.
// Outros CNPJs do certificado (OU da autoridade de registro, por exemplo)
// não são do titular e não devem ser usados.
function holderCnpj(cert) {
  const commonName = cert.subject.getField('CN')?.value || '';
  const fromName = commonName.match(/:(\d{14})\s*$/);
  if (fromName) return fromName[1];
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const at = der.indexOf(OID_CNPJ_DER);
  if (at >= 0) {
    const fromAltName = der.slice(at + OID_CNPJ_DER.length, at + OID_CNPJ_DER.length + 40).match(/(\d{14})/);
    if (fromAltName) return fromAltName[1];
  }
  return null;
}

function inspectPfx(buffer, passphrase) {
  let p12;
  try {
    const asn1 = forge.asn1.fromDer(buffer.toString('binary'));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, passphrase);
  } catch {
    throw new Error('Não foi possível ler o certificado. Confira se o arquivo é um .pfx/.p12 válido e se a senha está correta.');
  }

  const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certs = (bags[forge.pki.oids.certBag] || []).map((bag) => bag.cert).filter(Boolean);
  if (certs.length === 0) {
    throw new Error('O arquivo não contém um certificado válido.');
  }

  // O .pfx pode trazer a cadeia junto; o certificado do titular é o que não é de autoridade.
  const cert = certs.find((item) => {
    const basic = item.getExtension('basicConstraints');
    return !basic || !basic.cA;
  }) || certs[0];
  const subject = cert.subject.attributes.map((attr) => attr.value).join(' ') || 'Certificado digital';

  return {
    subject,
    commonName: cert.subject.getField('CN')?.value || null,
    cnpj: holderCnpj(cert),
    validUntil: cert.validity.notAfter,
  };
}

module.exports = { inspectPfx };
