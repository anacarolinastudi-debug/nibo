const prisma = require('../lib/prisma');
const obligationCatalog = require('../data/obligationCatalog');

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function catalogPayload(item, accountingFirmId) {
  return {
    name: item.name,
    type: item.type,
    department: item.department,
    nickname: item.nickname,
    frequency: item.frequency,
    status: 'ATIVO',
    defaultRobot: item.defaultRobot ?? false,
    physicalOnly: item.physicalOnly ?? false,
    dueControl: item.dueControl ?? true,
    internalGoalDays: item.internalGoalDays ?? null,
    ruleMonth: item.ruleMonth ?? null,
    dueDay: item.dueDay ?? null,
    dueDateRule: item.dueDateRule || 'ANTECIPA',
    saturdayBusinessDay: item.saturdayBusinessDay ?? false,
    accountingFirmId,
  };
}

async function seedCatalogForFirm(accountingFirmId) {
  const existing = await prisma.obligation.findMany({ where: { accountingFirmId } });
  const byName = new Map(existing.map((item) => [normalizeKey(item.name), item]));
  const byNickname = new Map(existing.filter((item) => item.nickname).map((item) => [normalizeKey(item.nickname), item]));
  const obligationByNickname = new Map();
  let created = 0;
  let updated = 0;

  for (const item of obligationCatalog.obligations) {
    const match = byNickname.get(normalizeKey(item.nickname)) || byName.get(normalizeKey(item.name));
    const payload = catalogPayload(item, accountingFirmId);

    if (match) {
      const obligation = await prisma.obligation.update({
        where: { id: match.id },
        data: { ...payload, accountingFirmId: undefined },
      });
      obligationByNickname.set(item.nickname, obligation);
      updated += 1;
    } else {
      const obligation = await prisma.obligation.create({ data: payload });
      obligationByNickname.set(item.nickname, obligation);
      created += 1;
    }
  }

  let groupsCreated = 0;
  let groupsUpdated = 0;

  for (const groupItem of obligationCatalog.groups) {
    const obligationIds = groupItem.obligations
      .map((nickname) => obligationByNickname.get(nickname)?.id)
      .filter(Boolean);
    const existingGroup = await prisma.obligationGroup.findUnique({
      where: { accountingFirmId_nickname: { accountingFirmId, nickname: groupItem.nickname } },
    });

    if (existingGroup) {
      await prisma.$transaction([
        prisma.obligationGroupItem.deleteMany({ where: { groupId: existingGroup.id } }),
        prisma.obligationGroup.update({
          where: { id: existingGroup.id },
          data: {
            name: groupItem.name,
            items: { create: obligationIds.map((obligationId) => ({ obligationId })) },
          },
        }),
      ]);
      groupsUpdated += 1;
    } else {
      await prisma.obligationGroup.create({
        data: {
          nickname: groupItem.nickname,
          name: groupItem.name,
          accountingFirmId,
          items: { create: obligationIds.map((obligationId) => ({ obligationId })) },
        },
      });
      groupsCreated += 1;
    }
  }

  return {
    obligations: { created, updated },
    groups: { created: groupsCreated, updated: groupsUpdated },
  };
}

module.exports = { seedCatalogForFirm };
