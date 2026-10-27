export const DEFAULT_CONTENT = {
  template: 'cover', accent: '#54c7df', fontSize: 82, caption: '',
  slides: [{ eyebrow: 'GESTÃO DO SEU NEGÓCIO', headline: 'Clareza para cuidar melhor da sua empresa', body: 'Organize as informações do seu negócio e conte com uma contabilidade próxima.', footer: 'SALVE PARA CONSULTAR' }],
};
export const emptySlide = () => ({ eyebrow: '', headline: 'Novo slide', body: '', footer: '' });

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

function textBlock(ctx, text, x, y, width, height, size, color, weight = 400, centered = false) {
  let lines;
  do {
    ctx.font = `${weight} ${size}px Arial`;
    lines = wrapLines(ctx, text, width);
    if (lines.length * size * 1.2 <= height || size <= 16) break;
    size -= 2;
  } while (size > 0);
  ctx.fillStyle = color;
  ctx.textAlign = centered ? 'center' : 'left';
  lines.forEach((line, index) => ctx.fillText(line, centered ? x + width / 2 : x, y + index * size * 1.2));
  ctx.textAlign = 'left';
  return lines.length * size * 1.2;
}

export function drawContent(canvas, settings, index, firmName, logo) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(canvas.width / 1080, 0, 0, canvas.height / 1350, 0, 0);
  ctx.clearRect(0, 0, 1080, 1350);
  ctx.textBaseline = 'top';
  const slide = settings.slides[index] || emptySlide();
  const light = settings.template === 'tip';
  const ink = light ? '#102c46' : '#ffffff';
  const muted = light ? '#435668' : '#d9edf5';
  ctx.fillStyle = light ? '#ffffff' : '#102c46'; ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = settings.accent; ctx.fillRect(0, 0, 1080, 14);
  if (logo?.naturalWidth) {
    const scale = Math.min(360 / logo.naturalWidth, 118 / logo.naturalHeight);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(66, 64, 380, 138);
    ctx.drawImage(logo, 76, 74, logo.naturalWidth * scale, logo.naturalHeight * scale);
  } else textBlock(ctx, firmName || 'Seu escritório', 72, 82, 690, 110, 38, ink, 700);
  textBlock(ctx, slide.eyebrow.toUpperCase(), 72, 260, 936, 82, 24, light ? '#164c78' : settings.accent, 700);
  if (settings.template === 'quote') {
    ctx.fillStyle = settings.accent; ctx.font = '160px Georgia'; ctx.fillText('\u201c', 72, 340);
    textBlock(ctx, slide.headline, 100, 440, 880, 400, settings.fontSize, ink, 700, true);
    textBlock(ctx, slide.body, 100, 910, 880, 245, 34, muted, 400, true);
  } else if (light) {
    textBlock(ctx, slide.headline, 72, 360, 936, 310, settings.fontSize, ink, 700);
    ctx.fillStyle = settings.accent; ctx.fillRect(72, 720, 936, 8);
    textBlock(ctx, slide.body, 72, 790, 936, 350, 38, muted);
  } else {
    const titleHeight = textBlock(ctx, slide.headline, 100, 365, 908, 440, settings.fontSize, ink, 700);
    ctx.fillStyle = settings.accent; ctx.fillRect(72, 365, 8, Math.max(130, titleHeight));
    textBlock(ctx, slide.body, 100, Math.max(820, 415 + titleHeight), 880, 300, 34, muted);
  }
  ctx.fillStyle = light ? '#dfe8ef' : '#527086'; ctx.fillRect(72, 1180, 936, 1);
  textBlock(ctx, slide.footer.toUpperCase(), 72, 1220, 805, 75, 21, ink, 700);
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
