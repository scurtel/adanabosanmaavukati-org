/**
 * Shared article payload schema checks for auto-article generation.
 */

export function publicContentBySlugPath(resource, slug) {
  return `/wp-json/wp/v2/${resource}?slug=${encodeURIComponent(slug)}&status=publish&per_page=10`;
}

export function isSafeArticleSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 90;
}

export function sanitizeArticleTitle(title) {
  return String(title || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateArticlePayload(article) {
  const errors = [];
  if (!article || typeof article !== 'object') return ['payload is not an object'];
  if (!sanitizeArticleTitle(article.title)) {
    errors.push('title missing/empty');
  }
  if (!article.bodyHtml || typeof article.bodyHtml !== 'string' || !article.bodyHtml.trim()) {
    errors.push('bodyHtml missing/empty');
  }
  if (article.slug != null && article.slug !== '' && !isSafeArticleSlug(article.slug)) {
    errors.push('slug unsafe');
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
