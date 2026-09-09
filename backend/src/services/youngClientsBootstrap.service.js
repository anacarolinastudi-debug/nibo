const prisma = require('../lib/prisma');
const { seedCatalogForFirm } = require('./obligationCatalog.service');

const YOUNG_FIRM_ID = 'b1fcab83-23fd-4b1d-bbcd-404bd5653ac3';

const clients = [
  { code: '33', name: '46.886.694 JOILSON XAVIER DA SILVA', cnpj: '46.886.694/0001-07', taxRegime: 'SIMPLES_NACIONAL' },
  { code: '6', name: 'BOARDEN MARKETING DIGITAL LTDA', cnpj: '52.598.394/0001-25', taxRegime: 'SIMPLES_NACIONAL' },
  { code: '10', name: 'MACIEL COMERCIO DE CONFECCOES LTDA', cnpj: '09.180.915/0001-09', taxRegime: 'SIMPLES_NACIONAL' },
  { code: '28', name: 'CALDEIRA ASSISTENCIA TECNICA LTDA', cnpj: '64.201.928/0001-17', taxRegime: 'SIMPLES_NACIONAL' },
  { code: '9', name: 'GRAFICA COPY E MAIS LTDA', cnpj: '52.323.008/0001-92', taxRegime: 'SIMPLES_NACIONAL' },
  { code: '3', name: 'TALISON NERI FOTOGRAFIA LTDA', cnpj: '15.437.324/0001-69', taxRegime: 'SIMPLES_NACIONAL' },
  { code: '21', name: '28.313.581 IVANI SEVERINA SOARES DE ALMEIDA', cnpj: '28.313.581/0001-30', taxRegime: 'SIMPLES_NACIONAL' },
  { code: '18', name: 'XZ COMERCIO DE BIJUTERIAS LTDA', cnpj: '61.018.220/0001-37', taxRegime: 'SIMPLES_NACIONAL' },
  { code: '25', name: 'NOSSA AGENCIA DIGITAL MARKETING LTDA', cnpj: '62.799.560/0001-05', taxRegime: 'SIMPLES_NACIONAL' },
  { code: '29', name: 'PAULA JUAREZ ASSESSORIA FINANCEIRA LTDA', cnpj: '64.419.410/0001-54', taxRegime: 'SIMPLES_NACIONAL' },
  { code: '30', name: 'SILVANIMAN AGROMAQUINAS E SERVICOS LTDA', cnpj: '64.348.511/0001-81', taxRegime: 'SIMPLES_NACIONAL' },
  { code: '31', name: 'SOUZA LEAO CARROS CLASSICOS LTDA', cnpj: '64.882.182/0001-54', taxRegime: 'SIMPLES_NACIONAL' },
  { code: '26', name: 'THEODORA SEMIJOIAS LTDA', cnpj: '63.243.845/0001-28', taxRegime: 'SIMPLES_NACIONAL' },
  { code: '27', name: 'TONELLO & RUFINO GALVANICA LTDA', cnpj: '63.363.475/0001-62', taxRegime: 'SIMPLES_NACIONAL' },
  { code: '32', name: 'PATRICK SALGADOS E CONGELADOS LTDA', cnpj: '65.943.198/0001-92', taxRegime: 'SIMPLES_NACIONAL' },
  { code: '1', name: 'ANA CAROLINA CARPINE AGUIAR', cnpj: '52.107.544/0001-50', taxRegime: 'MEI' },
  { code: '15', name: 'SILVIA FERNANDA AGUIAR COSTA', cnpj: '33.860.309/0001-00', taxRegime: 'MEI' },
];

async function seedYoungClients() {
  const firm = await prisma.accountingFirm.findFirst({
    where: {
      OR: [
        { id: YOUNG_FIRM_ID },
        { name: { contains: 'Young', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!firm) return;

  await seedCatalogForFirm(firm.id);

  let changed = 0;
  for (const client of clients) {
    const result = await prisma.client.upsert({
      where: { cnpj: client.cnpj },
      create: {
        ...client,
        personType: 'JURIDICA',
        active: true,
        accountingFirmId: firm.id,
      },
      update: {
        ...client,
        personType: 'JURIDICA',
        active: true,
        accountingFirmId: firm.id,
      },
    });
    if (result.accountingFirmId === firm.id) changed += 1;
  }

  const linked = await linkDefaultObligations(firm.id);

  console.log(`Clientes Young sincronizados: ${changed} registro(s) e ${linked} obrigacao(oes) vinculada(s) em ${firm.name}.`);
}

async function linkDefaultObligations(accountingFirmId) {
  const [firmClients, groups, admin] = await Promise.all([
    prisma.client.findMany({
      where: { accountingFirmId, active: true },
      select: { id: true, taxRegime: true },
    }),
    prisma.obligationGroup.findMany({
      where: { accountingFirmId, nickname: { in: ['MEI', 'SN-SERV'] } },
      include: { items: { select: { obligationId: true } } },
    }),
    prisma.user.findFirst({
      where: { accountingFirmId, role: 'ADMIN', active: true },
      select: { id: true },
    }),
  ]);

  const groupByNickname = new Map(groups.map((group) => [group.nickname, group]));
  const operations = [];

  for (const client of firmClients) {
    const group = client.taxRegime === 'MEI' ? groupByNickname.get('MEI') : groupByNickname.get('SN-SERV');
    if (!group) continue;

    for (const item of group.items) {
      operations.push(prisma.clientObligation.upsert({
        where: { clientId_obligationId: { clientId: client.id, obligationId: item.obligationId } },
        update: { active: true, responsibleId: admin?.id || undefined },
        create: {
          clientId: client.id,
          obligationId: item.obligationId,
          responsibleId: admin?.id || undefined,
        },
      }));
    }
  }

  if (operations.length === 0) return 0;
  await prisma.$transaction(operations);
  return operations.length;
}

module.exports = { seedYoungClients };
