const fs = require('node:fs');
const path = require('node:path');

function logoDataUrl(buffer) {
  let mime;
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) mime = 'image/png';
  else if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) mime = 'image/jpeg';
  else if (buffer.subarray(0, 2).toString() === 'BM') mime = 'image/bmp';
  else if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') mime = 'image/webp';
  if (!mime) throw Object.assign(new Error('Envie uma imagem PNG, JPG, BMP ou WebP valida.'), { status: 400 });
  if (buffer.length > 2 * 1024 * 1024) throw Object.assign(new Error('A logo deve ter no maximo 2 MB.'), { status: 400 });
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function resolveLogoSource(url) {
  if (!url) return '';
  if (/^data:image\/(?:png|jpeg|bmp|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(url)) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (!url.startsWith('/uploads/')) return '';
  try {
    return logoDataUrl(fs.readFileSync(path.join(__dirname, '../../uploads', path.basename(url))));
  } catch { return ''; }
}

async function preserveFirmLogo(firm, prisma) {
  if (!firm?.logoUrl?.startsWith('/uploads/')) return firm;
  const embedded = resolveLogoSource(firm.logoUrl);
  if (!embedded) return firm;
  const updated = await prisma.accountingFirm.updateMany({
    where: { id: firm.id, logoUrl: firm.logoUrl }, data: { logoUrl: embedded },
  });
  if (updated.count) return { ...firm, logoUrl: embedded };
  return prisma.accountingFirm.findUnique({ where: { id: firm.id } });
}

module.exports = { logoDataUrl, resolveLogoSource, preserveFirmLogo };
