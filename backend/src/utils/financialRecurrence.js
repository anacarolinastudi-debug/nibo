const { createHash } = require('crypto');

function occurrenceId(sourceId, year, month) {
  const hash = createHash('sha256').update(`financial:${sourceId}:${year}-${month}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function occurrenceDate(sourceDate, year, month) {
  const source = new Date(sourceDate);
  const day = Math.min(source.getUTCDate(), new Date(Date.UTC(year, month, 0)).getUTCDate());
  return new Date(Date.UTC(year, month - 1, day));
}

module.exports = { occurrenceId, occurrenceDate };
