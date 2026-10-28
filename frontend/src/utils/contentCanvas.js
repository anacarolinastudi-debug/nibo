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
  if (verticallyCentered) y += (height - lines.length * size * 1.2) / 2;
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

export function drawContent(canvas, settings, index, firmName, logo, background, lightLogo) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(canvas.width / 1080, 0, 0, canvas.height / 1350, 0, 0);
  ctx.clearRect(0, 0, 1080, 1350);
  ctx.textBaseline = 'top';
  const slide = settings.slides[index] || emptySlide();
  if (settings.background === 'plain') {
    ctx.fillStyle = '#051d40'; ctx.fillRect(0, 0, 1080, 1350);
    const message = [slide.headline, slide.body].filter((text) => text?.trim()).join('\n\n');
    textBlock(ctx, message, 108, 335, 864, 680, Math.min(settings.fontSize, 62), '#ffffff', 400, true, 'Libre Baskerville', '', '#ffffff', false, true);
    textBlock(ctx, '@youngcontabil', 72, 1250, 936, 50, 28, '#ffffff', 400, true);
    return;
  }
  if (settings.background === 'white') {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1080, 1350);
    if (lightLogo?.naturalWidth) {
      const [sx, sy, sw, sh] = logoBounds(lightLogo);
      ctx.drawImage(lightLogo, sx, sy, sw * 0.22, sh, 100, 180, 100, 100);
    }
    textBlock(ctx, firmName || 'Young Contábil', 225, 190, 735, 50, 34, '#17191c', 800);
    textBlock(ctx, settings.profileHandle ?? '@youngcontabil', 225, 240, 735, 45, 29, '#72777c', 400);
    const accent = settings.accent === '#63b0ff' ? '#0965ba' : settings.accent;
    if (slide.eyebrow) textBlock(ctx, slide.eyebrow.toUpperCase(), 100, 335, 880, 45, 22, '#66717b', 600);
    const titleHeight = textBlock(ctx, slide.headline, 100, 410, 880, 300, Math.min(settings.fontSize, 68), '#17191c', 800, false, 'Montserrat', slide.highlight || '', accent);
    const bodyY = Math.max(620, 455 + titleHeight);
    textBlock(ctx, slide.body, 100, bodyY, 880, 1100 - bodyY, 43, '#202327', 400);
    textBlock(ctx, slide.footer, 100, 1160, 790, 90, 30, '#17191c', 600, false, 'Montserrat', '', '#17191c', true);
    if (settings.slides.length > 1) textBlock(ctx, `${index + 1} / ${settings.slides.length}`, 910, 1245, 100, 40, 20, '#72777c');
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
