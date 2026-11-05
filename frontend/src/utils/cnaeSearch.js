import catalogue from '../data/cnae-subclasses.json' with { type: 'json' };
import { ACTIVITIES } from './proLabore.js';

const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const officialNames = new Map(catalogue.entries.map(item => [item.id, item.label]));
const presets = ACTIVITIES.map(item => ({ ...item, key: item.id, activityId: item.id, officialName: officialNames.get(normalize(item.cnae || '')) || '' }));
const knownCodes = new Set(presets.map(item => normalize(item.cnae || '')).filter(Boolean));
const formatCnae = code => `${code.slice(0, 4)}-${code.slice(4, 5)}/${code.slice(5)}`;
const choices = [...presets, ...catalogue.entries.filter(item => !knownCodes.has(item.id)).map(item => ({ key: `cnae:${item.id}`, activityId: 'other', cnae: formatCnae(item.id), label: item.label }))];
const index = choices.map(item => ({ item, search: normalize(`${item.label} ${item.officialName || ''} ${item.cnae || ''} ${item.keywords || ''}`) }));
export const findActivityChoice = key => choices.find(item => item.key === key);
export function searchActivities(query) {
  const term = normalize(query);
  if (!term) return presets;
  return index.filter(entry => entry.search.includes(term)).sort((a, b) => Number(normalize(b.item.cnae || '') === term) - Number(normalize(a.item.cnae || '') === term)).slice(0, 60).map(entry => entry.item);
}
