/**
 * Shared article payload schema checks for auto-article generation.
 */

export function validateArticlePayload(article) {
  const errors = [];
  if (!article || typeof article !== 'object') return ['payload is not an object'];
  if (!article.title || typeof article.title !== 'string' || !article.title.trim()) {
    errors.push('title missing/empty');
  }
  if (!article.bodyHtml || typeof article.bodyHtml !== 'string' || !article.bodyHtml.trim()) {
    errors.push('bodyHtml missing/empty');
  }
  if (!Array.isArray(article.faq)) {
    errors.push('faq must be an array');
  } else {
    for (const [i, item] of article.faq.entries()) {
      if (!item || typeof item.question !== 'string' || !item.question.trim()) {
        errors.push(`faq[${i}].question invalid`);
      }
      if (!item || typeof item.answer !== 'string' || !item.answer.trim()) {
        errors.push(`faq[${i}].answer invalid`);
      }
    }
  }
  // metaTitle / metaDescription / excerpt are preferred but not hard-required
  return errors;
}
