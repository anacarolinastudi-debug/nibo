const { z } = require('zod');
const service = require('../services/contentImages.service');
async function search(req, res) {
  const { q, automatic } = z.object({ q: z.string().trim().min(2).max(200), automatic: z.enum(['true', 'false']).default('false') }).parse(req.query);
  res.set('Cache-Control', 'private, no-store').json(await service.searchImages(q, req.user.accountingFirmId, { automatic: automatic === 'true' }));
}
async function select(req, res) {
  const { token } = z.object({ token: z.string().min(20).max(8000) }).parse(req.body);
  res.set('Cache-Control', 'private, no-store').json(await service.selectImage(token, req.user.accountingFirmId));
}
module.exports = { search, select };
