const images = new Map();
export function loadCoverPhoto(photo) {
  const url = photo?.dataUrl;
  if (!url || !/^data:image\/(jpeg|png|webp);base64,/.test(url)) return Promise.resolve(null);
  if (!images.has(url)) {
    const promise = new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => { images.delete(url); reject(new Error('Não foi possível carregar a foto da capa.')); }; image.src = url;
    });
    images.set(url, promise);
    if (images.size > 12) images.delete(images.keys().next().value);
  }
  return images.get(url);
}
export async function compressPhoto(dataUrl) {
  const image = await loadCoverPhoto({ dataUrl });
  if (!image || !image.naturalWidth || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('A imagem ultrapassa o tamanho permitido.');
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.86, 0.72, 0.56]) { const result = canvas.toDataURL('image/jpeg', quality); if (result.length <= 1250000) return result; }
  throw new Error('A imagem é muito grande. Escolha uma foto menor.');
}
export const photoCredit = photo => photo?.sourceUrl ? `Foto: ${photo.creator || 'Wikimedia Commons'} · ${photo.license}\n${photo.sourceUrl}${photo.licenseUrl ? '\n' + photo.licenseUrl : ''}` : photo?.creator ? `Foto: ${photo.creator}` : '';
