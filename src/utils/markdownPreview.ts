const highlightMap: Record<string, string> = {
  yellow: 'bg-yellow-200 text-yellow-900',
  pink: 'bg-pink-200 text-pink-900',
  blue: 'bg-blue-200 text-blue-900',
  green: 'bg-green-200 text-green-900',
  purple: 'bg-purple-200 text-purple-900',
  orange: 'bg-orange-200 text-orange-900',
  red: 'bg-red-200 text-red-900',
};

function processHighlights(content: string): string {
  return content.replace(/\{(yellow|pink|blue|green|purple|orange|red):([^}]+)\}/g, (_, color, text) => {
    const classes = highlightMap[color] || highlightMap['yellow'];
    return `<mark class="px-1.5 py-0.5 rounded ${classes}">${text}</mark>`;
  });
}

function isBlockHtml(html: string): boolean {
  return /^<(h[1-3]|hr|details|div|ul|li|pre)[\s>]/.test(html.trim());
}

function processInline(text: string): string {
  let result = text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
  result = processHighlights(result);
  result = result.replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>');
  return result;
}

function parseTableRow(row: string): string[] {
  const parts = row.split('|');
  return parts.slice(1, parts.length - 1).map(c => c.trim());
}

function isSeparatorRow(row: string): boolean {
  const cells = parseTableRow(row);
  return cells.length > 0 && cells.every(c => /^:?-+:?$/.test(c));
}

function isTableRow(line: string): boolean {
  return /^\s*\|.+\|/.test(line);
}

function buildTableHtml(tableLines: string[]): string {
  const sepIndex = tableLines.findIndex(isSeparatorRow);
  let html = '<table class="w-full border-collapse my-2 text-sm">';

  if (sepIndex === 1 && tableLines.length > 1) {
    const headers = parseTableRow(tableLines[0]);
    html += '<thead><tr>';
    headers.forEach(h => {
      html += `<th class="border border-border px-3 py-2 bg-muted font-semibold text-left">${processInline(h)}</th>`;
    });
    html += '</tr></thead>';

    const bodyRows = tableLines.slice(sepIndex + 1);
    if (bodyRows.length > 0) {
      html += '<tbody>';
      bodyRows.forEach(row => {
        const cells = parseTableRow(row);
        html += '<tr class="even:bg-muted/30">';
        cells.forEach(c => {
          html += `<td class="border border-border px-3 py-2">${processInline(c)}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody>';
    }
  } else {
    html += '<tbody>';
    tableLines.forEach(row => {
      if (isSeparatorRow(row)) return;
      const cells = parseTableRow(row);
      html += '<tr class="even:bg-muted/30">';
      cells.forEach(c => {
        html += `<td class="border border-border px-3 py-2">${processInline(c)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';
  }

  html += '</table>';
  return html;
}

function processLine(line: string): string {
  let processed = line;
  const leadingSpacesMatch = processed.match(/^(\s*)/);
  const leadingSpaces = leadingSpacesMatch ? leadingSpacesMatch[1].length : 0;
  const indentLevel = Math.floor(leadingSpaces / 2);
  const indentStyle = indentLevel > 0 ? ` style="margin-left:${indentLevel}rem"` : '';
  const itemIndentClass = indentLevel > 0 ? '' : ' pl-0.5';

  if (processed.trim() === '---' || processed.trim() === '***' || processed.trim() === '___') {
    return '<hr class="my-2 border-t border-border" />';
  } else if (processed.startsWith('### ')) {
    return `<h3 class="text-lg font-semibold mb-2 mt-4">${processHighlights(processed.slice(4))}</h3>`;
  } else if (processed.startsWith('## ')) {
    return `<h2 class="text-xl font-semibold mb-2 mt-4">${processHighlights(processed.slice(3))}</h2>`;
  } else if (processed.startsWith('# ')) {
    return `<h1 class="text-2xl font-bold mb-3 mt-4">${processHighlights(processed.slice(2))}</h1>`;
  } else if (processed.match(/^\s*\-\s*\[x\]\s*(.*)$/i)) {
    const match = processed.match(/^\s*\-\s*\[x\]\s*(.*)$/i);
    if (match) {
      let formatted = (match[1] || '').replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>').replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
      formatted = processHighlights(formatted);
      return `<div class="flex items-start gap-2 mb-1${itemIndentClass}"${indentStyle}><input type="checkbox" checked disabled class="mt-0.5 shrink-0 rounded border-gray-400 w-4 h-4" /><span class="min-w-0 line-through text-muted-foreground">${formatted || '&nbsp;'}</span></div>`;
    }
  } else if (processed.match(/^\s*\-\s*\[\s*\]\s*(.*)$/)) {
    const match = processed.match(/^\s*\-\s*\[\s*\]\s*(.*)$/);
    if (match) {
      let formatted = (match[1] || '').replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>').replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
      formatted = processHighlights(formatted);
      return `<div class="flex items-start gap-2 mb-1${itemIndentClass}"${indentStyle}><input type="checkbox" disabled class="mt-0.5 shrink-0 rounded border-gray-400 w-4 h-4" /><span class="min-w-0">${formatted || '&nbsp;'}</span></div>`;
    }
  } else if (processed.match(/^\s*\-\s+(.*)$/)) {
    const match = processed.match(/^\s*\-\s+(.*)$/);
    let content = match ? match[1] : processed;
    content = content.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>').replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
    content = processHighlights(content);
    return `<li class="ml-4 my-1"${indentStyle}>${content}</li>`;
  } else {
    processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>').replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
    processed = processHighlights(processed);
    processed = processed.replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>');
    return processed;
  }
  return processed;
}

export function renderMarkdownPreview(text: string): string {
  const lines = text.split('\n');
  const segments: { html: string; block: boolean }[] = [];

  let inToggle = false;
  let toggleTitle = '';
  let toggleLines: string[] = [];
  let inTable = false;
  let tableLines: string[] = [];

  const flushToggle = () => {
    if (!inToggle) return;
    const body = toggleLines.join('<br />');
    const bodyContent = body || '<span class="text-muted-foreground text-xs italic">Sin contenido</span>';
    segments.push({
      block: true,
      html:
        `<details class="group rounded-lg border border-border/60 overflow-hidden">` +
        `<summary class="cursor-pointer list-none flex items-start gap-2 py-2 pr-3 pl-0.5 text-sm font-medium text-foreground hover:bg-accent/50 select-none [&>span:first-child]:mt-0.5 [&>span:first-child]:inline-flex [&>span:first-child]:h-4 [&>span:first-child]:w-4 [&>span:first-child]:shrink-0 [&>span:first-child]:items-center [&>span:first-child]:justify-center">` +
        `<span class="inline-block transition-transform duration-150 group-open:rotate-90 text-muted-foreground" style="font-size:0.6rem">▶</span>` +
        `<span class="min-w-0">${processHighlights(toggleTitle)}</span>` +
        `</summary>` +
        `<div class="px-6 py-2 text-sm border-t border-border/40 bg-muted/20">${bodyContent}</div>` +
        `</details>`,
    });
    inToggle = false;
    toggleLines = [];
    toggleTitle = '';
  };

  const flushTable = () => {
    if (!inTable || tableLines.length === 0) return;
    segments.push({ html: buildTableHtml(tableLines), block: true });
    inTable = false;
    tableLines = [];
  };

  for (const line of lines) {
    // Detect table rows
    if (isTableRow(line)) {
      flushToggle();
      inTable = true;
      tableLines.push(line);
      continue;
    }

    if (inTable) {
      flushTable();
    }

    const toggleMatch = line.match(/^>\s+(.+)$/);
    if (toggleMatch) {
      flushToggle();
      inToggle = true;
      toggleTitle = toggleMatch[1];
      continue;
    }

    if (inToggle) {
      if (line.trim() === '') {
        flushToggle();
      } else {
        toggleLines.push(processLine(line));
      }
      continue;
    }

    const html = processLine(line);
    segments.push({ html, block: isBlockHtml(html) });
  }

  flushToggle();
  flushTable();

  // Join: <br /> between inline elements, small spacer between/around block elements
  let html = '';
  for (let i = 0; i < segments.length; i++) {
    const prev = segments[i - 1];
    const curr = segments[i];
    if (i > 0) {
      if (!prev.block && !curr.block) {
        html += '<br />';
      } else {
        html += '<div style="height:4px"></div>';
      }
    }
    html += curr.html;
  }

  html = html.replace(/```([^`]+)```/g, '<pre class="bg-muted p-3 rounded-lg my-2 overflow-x-auto"><code>$1</code></pre>');
  html = html.replace(/(<li class="ml-4 my-1">.+?<\/li>(<br \/>)?)+/g, '<ul class="list-disc my-2 ml-2">$&</ul>');
  return html;
}
