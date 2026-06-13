function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inlineFormat(text) {
  let s = escapeHtml(text);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

export function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();

    if (t === '```' || t === '```yaml') continue;

    if (/^#{1}\s/.test(t)) {
      closeLists();
      out.push(`<h1>${inlineFormat(t.replace(/^#\s+/, ''))}</h1>`);
      continue;
    }
    if (/^#{2}\s/.test(t)) {
      closeLists();
      out.push(`<h2>${inlineFormat(t.replace(/^##\s+/, ''))}</h2>`);
      continue;
    }
    if (/^#{3}\s/.test(t)) {
      closeLists();
      out.push(`<h3>${inlineFormat(t.replace(/^###\s+/, ''))}</h3>`);
      continue;
    }
    if (/^#{4}\s/.test(t)) {
      closeLists();
      out.push(`<h4>${inlineFormat(t.replace(/^####\s+/, ''))}</h4>`);
      continue;
    }

    const ulMatch = t.match(/^[-*]\s+(.+)/);
    if (ulMatch) {
      if (!inUl) {
        closeLists();
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = t.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      if (!inOl) {
        closeLists();
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${inlineFormat(olMatch[1])}</li>`);
      continue;
    }

    if (t === '') {
      closeLists();
      continue;
    }

    closeLists();
    out.push(`<p>${inlineFormat(t)}</p>`);
  }

  closeLists();
  return out.join('\n');
}

export function parseArticleFile(content) {
  let body = content;
  const meta = {};

  const fenced = content.match(/^```(?:yaml)?\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (fenced) {
    const yamlBlock = fenced[1];
    body = fenced[2].replace(/\n```\s*$/, '');
    for (const line of yamlBlock.split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if (val.startsWith('[')) {
        try {
          meta[key] = JSON.parse(val.replace(/'/g, '"'));
        } catch {
          meta[key] = val
            .replace(/^\[|\]$/g, '')
            .split(',')
            .map((s) => s.trim().replace(/^"|"$/g, ''))
            .filter(Boolean);
        }
      } else {
        meta[key] = val.replace(/^"|"$/g, '');
      }
    }
  }

  return { meta, body: body.trim() };
}
