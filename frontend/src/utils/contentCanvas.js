export const DEFAULT_CONTENT = {
  template: 'cover', accent: '#63b0ff', fontSize: 82, caption: '', background: 'organic', profileHandle: '@youngcontabil',
  slides: [{ eyebrow: 'GESTÃO DO SEU NEGÓCIO', headline: 'Clareza para cuidar melhor da sua empresa', highlight: 'empresa', body: 'Organize as informações do seu negócio e conte com uma contabilidade próxima.', footer: 'SALVE PARA CONSULTAR' }],
};
export const emptySlide = () => ({ eyebrow: '', headline: 'Novo slide', highlight: '', body: '', footer: '' });

export function wrapLines(ctx, text, width) {
  const lines = [];
  for (const paragraph of String(text || '').split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && ctx.measureText(`${line} ${word}`).width > width) { lines.push(line); line = ''; }
      for (const char of Array.from((line ? ' ' : '') + word)) {
        if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = ''; }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

function textBlock(ctx, text, x, y, width, height, size, color, weight = 400, centered = false, family = 'Montserrat', highlight = '', accent = color, underline = false, verticallyCentered = false) {
  let lines;
  do {
    ctx.font = `${weight} ${size}px "${family}"`;
    lines = wrapLines(ctx, text, width);
    if (lines.length * size * 1.2 <= height || size <= 16) break;
    size -= 2;
  } while (size > 0);
  // Reflow excessive manual line breaks before shrinking beyond the normal minimum.
  if (lines.length * size * 1.2 > height) {
    const compact = String(text || '').replace(/\s+/g, ' ').trim();
    do {
      ctx.font = `${weight} ${size}px "${family}"`;
      lines = wrapLines(ctx, compact, width);
      if (lines.length * size * 1.2 <= height) break;
      size = Math.max(1, size - 1);
    } while (size > 1);
  }
  if (verticallyCentered) y += Math.max(0, (height - lines.length * size * 1.2) / 2);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  const normalize = (word) => word.toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]/gu, '');
  const highlighted = new Set(highlight.split(/\s+/).map(normalize).filter(Boolean));
  lines.forEach((line, index) => {
    let at = centered ? x + (width - ctx.measureText(line).width) / 2 : x;
    for (const token of line.match(/\s+|\S+/g) || []) {
      ctx.fillStyle = highlighted.has(normalize(token)) ? accent : color;
      ctx.fillText(token, at, y + index * size * 1.2);
      if (underline) ctx.fillRect(at, y + index * size * 1.2 + size * 1.08, ctx.measureText(token).width, 2);
      at += ctx.measureText(token).width;
    }
  });
  ctx.textAlign = 'left';
  return lines.length * size * 1.2;
}

const logoBoundsCache = new WeakMap();
const editorialPalette = mode => mode === 'blue'
  ? { background: '#051d40', ink: '#ffffff', body: '#e4effb', muted: '#c2d4ea', accent: '#63b0ff' }
  : { background: '#ffffff', ink: '#17191c', body: '#202327', muted: '#72777c', accent: '#0965ba' };

function editorialCopy(ctx, settings, slide, palette, { x, y, width, titleHeight, bodyTop, bodyEnd, titleMax, bodySize, quoteHeight, narrow = false }) {
  if (settings.template === 'quote') {
    const message = [slide.headline, slide.body].filter(value => value?.trim()).join('\n\n');
    textBlock(ctx, message, x, y, width, quoteHeight, Math.min(settings.fontSize, narrow ? 52 : 62), palette.ink, 400, true, 'Montserrat', slide.highlight || '', palette.accent, false, true);
    return;
  }
  const informative = settings.template === 'tip';
  const title = informative ? slide.headline.toUpperCase() : slide.headline;
  let size = Math.min(settings.fontSize, titleMax);
  while (size > 16) {
    ctx.font = `800 ${size}px "Montserrat"`;
    if (title.split(/\s+/).every(word => ctx.measureText(word).width <= width)) break;
    size -= 2;
  }
  const hasBody = !!slide.body?.trim();
  const height = textBlock(ctx, title, x, y, width, narrow && !hasBody && !informative ? 650 : titleHeight, size, palette.ink, 800, false, 'Montserrat', slide.highlight || '', palette.accent, false, narrow && !hasBody && !informative);
  let bodyY = Math.max(bodyTop, y + height + 45);
  if (informative) {
    const ruleY = y + height + 32;
    ctx.fillStyle = palette.accent; ctx.fillRect(x, ruleY, width, 5);
    bodyY = Math.max(bodyTop, ruleY + 45);
  }
  if (hasBody) textBlock(ctx, slide.body, x, bodyY, width, Math.max(80, bodyEnd - bodyY), bodySize, palette.body);
}
function logoBounds(image) {
  if (logoBoundsCache.has(image)) return logoBoundsCache.get(image);
  const scratch = document.createElement('canvas'); scratch.width = image.naturalWidth; scratch.height = image.naturalHeight;
  const ctx = scratch.getContext('2d'); ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, scratch.width, scratch.height);
  let left = scratch.width, top = scratch.height, right = 0, bottom = 0;
  let transparent = false;
  for (let at = 3; at < data.length; at += 64 * 4) if (data[at] < 200) { transparent = true; break; }
  for (let y = 0; y < scratch.height; y += 2) for (let x = 0; x < scratch.width; x += 2) {
    const at = (y * scratch.width + x) * 4;
    if (data[at + 3] > 50 && (transparent || Math.min(data[at], data[at + 1], data[at + 2]) < 215)) {
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  const padding = 12;
  const bounds = right > left && bottom > top ? [Math.max(0, left - padding), Math.max(0, top - padding), Math.min(scratch.width - Math.max(0, left - padding), right - left + padding * 2), Math.min(scratch.height - Math.max(0, top - padding), bottom - top + padding * 2)] : [0, 0, scratch.width, scratch.height];
  bounds.transparent = transparent;
  logoBoundsCache.set(image, bounds);
  return bounds;
}

export function drawContent(canvas, settings, index, firmName, logo, background, lightLogo, coverPhoto) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(canvas.width / 1080, 0, 0, canvas.height / 1350, 0, 0);
  ctx.clearRect(0, 0, 1080, 1350);
  ctx.textBaseline = 'top';
  const slide = settings.slides[index] || emptySlide();
  if (settings.background === 'photo' && index === 0) {
    const palette = editorialPalette(settings.photoPanel);
    ctx.fillStyle = palette.background; ctx.fillRect(0, 0, 1080, 1350);
    if (coverPhoto?.naturalWidth) {
      const scale = Math.max(540 / coverPhoto.naturalWidth, 1350 / coverPhoto.naturalHeight);
      const width = coverPhoto.naturalWidth * scale, height = coverPhoto.naturalHeight * scale;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 540, 1350); ctx.clip();
      ctx.filter = (settings.photoMono ?? true) ? 'grayscale(1)' : 'none';
      ctx.drawImage(coverPhoto, (540 - width) * (settings.photoX ?? 50) / 100, (1350 - height) * (settings.photoY ?? 50) / 100, width, height); ctx.restore();
    } else { ctx.fillStyle = '#dce4e6'; ctx.fillRect(0, 0, 540, 1350); }
    textBlock(ctx, settings.profileHandle ?? '@youngcontabil', 605, 88, 400, 70, 23, palette.muted);
    textBlock(ctx, slide.eyebrow, 605, 265, 400, 80, 21, palette.muted, 600);
    editorialCopy(ctx, settings, slide, palette, { x: 605, y: 385, width: 400, titleHeight: settings.template === 'tip' ? 460 : 530, bodyTop: 950, bodyEnd: 1160, titleMax: 56, bodySize: 28, quoteHeight: 740, narrow: true });
    textBlock(ctx, slide.footer || '', 605, 1220, 400, 70, 18, palette.ink, 400);
    const photo = settings.coverPhoto;
    if (photo?.creator) {
      ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(0, 1190, 540, 160);
      const source = photo.sourceUrl?.replace(/^https:\/\//, '') || '';
      textBlock(ctx, [`Foto: ${photo.creator}`, photo.license, source, photo.licenseUrl?.replace(/^https:\/\//, '')].filter(Boolean).join('\n'), 24, 1206, 492, 132, 16, '#ffffff');
    }
    return;
  }
  if (settings.background === 'plain') {
    ctx.fillStyle = '#051d40'; ctx.fillRect(0, 0, 1080, 1350);
    if (settings.template === 'quote') {
      const message = [slide.headline, slide.body].filter((text) => text?.trim()).join('\n\n');
      textBlock(ctx, message, 108, 335, 864, 680, Math.min(settings.fontSize, 62), '#ffffff', 400, true, 'Libre Baskerville', '', '#ffffff', false, true);
    } else {
      const informative = settings.template === 'tip';
      textBlock(ctx, slide.eyebrow.toUpperCase(), 72, 258, 936, 72, 23, settings.accent, 600);
      const height = textBlock(ctx, informative ? slide.headline.toUpperCase() : slide.headline, 72, 355, 936, informative ? 320 : 430, settings.fontSize, '#ffffff', informative ? 800 : 700, false, informative ? 'Montserrat' : 'Libre Baskerville', slide.highlight || '', settings.accent);
      const ruleY = informative ? 720 : 405 + height;
      ctx.fillStyle = settings.accent; ctx.fillRect(72, ruleY, informative ? 936 : 110, informative ? 8 : 5);
      const bodyY = Math.max(790, 455 + height);
      textBlock(ctx, slide.body, 72, bodyY, 936, 1140 - bodyY, 38, '#ffffff');
    }
    textBlock(ctx, '@youngcontabil', 72, 1250, 936, 50, 28, '#ffffff', 400, true);
    return;
  }
  if (settings.background === 'white' || settings.background === 'photo') {
    const photoPage = settings.background === 'photo';
    const palette = editorialPalette(photoPage ? settings.photoPages : 'white');
    ctx.fillStyle = palette.background; ctx.fillRect(0, 0, 1080, 1350);
    if (!photoPage && lightLogo?.naturalWidth) {
      const [sx, sy, sw, sh] = logoBounds(lightLogo);
      ctx.drawImage(lightLogo, sx, sy, sw * 0.22, sh, 100, 180, 100, 100);
    }
    if (!photoPage) {
      textBlock(ctx, firmName || 'Young Contábil', 225, 190, 735, 50, 34, palette.ink, 800);
      textBlock(ctx, settings.profileHandle ?? '@youngcontabil', 225, 240, 735, 45, 29, palette.muted, 400);
    }
    const accent = photoPage ? palette.accent : settings.accent === '#63b0ff' ? '#0965ba' : settings.accent;
    const titleY = photoPage ? 245 : 410;
    if (slide.eyebrow) textBlock(ctx, slide.eyebrow.toUpperCase(), 100, photoPage ? 160 : 335, 880, 45, 22, photoPage ? palette.muted : '#66717b', 600);
    editorialCopy(ctx, settings, slide, { ...palette, accent }, { x: 100, y: titleY, width: 880, titleHeight: photoPage ? 360 : 300, bodyTop: photoPage ? 525 : 620, bodyEnd: 1100, titleMax: 68, bodySize: 43, quoteHeight: photoPage ? 850 : 690 });
    textBlock(ctx, slide.footer, 100, 1160, 790, 90, 30, palette.ink, 600, false, 'Montserrat', '', palette.ink, true);
    if (settings.slides.length > 1) textBlock(ctx, `${index + 1} / ${settings.slides.length}`, 910, 1245, 100, 40, 20, palette.muted);
    return;
  }
  const ink = '#ffffff';
  const muted = '#e4effb';
  ctx.fillStyle = '#051d40'; ctx.fillRect(0, 0, 1080, 1350);
  if (background) {
    const scale = Math.max(1080 / background.naturalWidth, 1350 / background.naturalHeight);
    const width = background.naturalWidth * scale, height = background.naturalHeight * scale;
    ctx.drawImage(background, (1080 - width) / 2, (1350 - height) / 2, width, height);
    // A continuous veil keeps the organic detail away from the reading area.
    const veil = ctx.createLinearGradient(0, 0, 0, 1350);
    veil.addColorStop(0, 'rgba(3, 20, 43, 0.15)');
    veil.addColorStop(0.22, 'rgba(3, 20, 43, 0.72)');
    veil.addColorStop(0.58, 'rgba(3, 20, 43, 0.94)');
    veil.addColorStop(0.84, 'rgba(3, 20, 43, 0.94)');
    veil.addColorStop(1, 'rgba(3, 20, 43, 0.4)');
    ctx.fillStyle = veil; ctx.fillRect(0, 0, 1080, 1350);
  }
  if (logo?.naturalWidth) {
    const bounds = logoBounds(logo);
    const [sx, sy, sw, sh] = bounds;
    const scale = Math.min(500 / sw, 112 / sh);
    if (!bounds.transparent) { ctx.fillStyle = '#ffffff'; ctx.fillRect(60, 70, sw * scale + 24, sh * scale + 24); }
    ctx.drawImage(logo, sx, sy, sw, sh, 72, 82, sw * scale, sh * scale);
  } else textBlock(ctx, firmName || 'Seu escritório', 72, 82, 690, 110, 38, ink, 700, false, 'Libre Baskerville');
  textBlock(ctx, slide.eyebrow.toUpperCase(), 72, 258, 936, 72, 23, settings.accent, 600);
  const headline = (x, y, width, height, centered = false) => textBlock(ctx, settings.template === 'tip' ? slide.headline.toUpperCase() : slide.headline, x, y, width, height, settings.fontSize, ink, settings.template === 'tip' ? 800 : settings.template === 'quote' ? 400 : 700, centered, settings.template === 'tip' ? 'Montserrat' : 'Libre Baskerville', slide.highlight || '', settings.accent);
  if (settings.template === 'quote') {
    headline(100, 415, 880, 430, true);
    textBlock(ctx, slide.body, 100, 910, 880, 245, 38, ink, 400, true);
  } else if (settings.template === 'tip') {
    headline(72, 345, 936, 320);
    ctx.fillStyle = settings.accent; ctx.fillRect(72, 720, 936, 8);
    textBlock(ctx, slide.body, 72, 790, 936, 350, 38, ink);
  } else {
    const titleHeight = headline(72, 355, 936, 430);
    ctx.fillStyle = settings.accent; ctx.fillRect(72, 405 + titleHeight, 110, 5);
    textBlock(ctx, slide.body, 72, Math.max(790, 455 + titleHeight), 936, 320, 38, ink);
  }
  textBlock(ctx, slide.footer, 72, 1220, 805, 75, 21, ink, 600);
  textBlock(ctx, `${index + 1} / ${settings.slides.length}`, 925, 1220, 100, 40, 21, muted);
}

export function guidedDraft(topic, audience, count) {
  const subject = topic.trim().slice(0, 200);
  const reader = audience.trim() || 'quem empreende';
  return Array.from({ length: count }, (_, index) => ({
    eyebrow: count === 1 || index === 0 ? 'PARA SUA ROTINA' : index === count - 1 ? 'PRÓXIMO PASSO' : `PASSO ${index}`,
    headline: index === 0 ? subject : index === count - 1 ? 'Vamos conversar sobre o seu negócio?' : ['O que vale revisar', 'Organize as informações', 'Defina uma rotina', 'Acompanhe os resultados'][(index - 1) % 4],
    body: index === 0 ? `Uma conversa sobre ${subject.toLowerCase()} para ${reader}.` : index === count - 1 ? 'Fale com nossa equipe para avaliar as necessidades da sua empresa.' : `Inclua aqui uma orientação sobre ${subject.toLowerCase()} que ajude ${reader} na prática.`,
    footer: index === count - 1 ? 'FALE COM NOSSA EQUIPE' : 'SALVE E COMPARTILHE',
  }));
}
