/** Make a compact preview without cutting Russian (or Latin) words in half.
 * The full source text is never modified; consumers decide where to display it.
 */
function preview(text, maxChars = 170) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  // If the boundary falls between words, keep the last complete word.
  let end = clean[maxChars] === ' ' ? maxChars : clean.slice(0, maxChars).lastIndexOf(' ');
  if (end <= 0) {
    // A long first word has no safe earlier boundary; do not split it.
    const nextSpace = clean.indexOf(' ', maxChars);
    if (nextSpace < 0) return clean;
    end = nextSpace;
  }
  const clipped = clean.slice(0, end).replace(/[\s.,;:!?—–-]+$/u, '').replace(/\s+(?:и|а|с|в|к|у|о|из|на|не|по|от|за|до|во|со|под)$/iu, '');
  return `${clipped}…`;
}

function displaySectionParagraphs(section) {
  const paragraphs = section?.paragraphs || [];
  if (!['Концептуальные примеры', 'Реальные примеры'].includes(section.title)) return paragraphs;
  return paragraphs.map((paragraph, i) => /^\s*\d+[.)]\s/.test(paragraph) ? paragraph : `${i + 1}. ${paragraph}`);
}
module.exports = {preview, displaySectionParagraphs};
