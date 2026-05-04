import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import reportMarkdown from '@/../docs/informe-login-rendimiento.md?raw';

function renderInline(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(
        <code key={key++} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function renderMarkdown(md: string): JSX.Element[] {
  const lines = md.split('\n');
  const nodes: JSX.Element[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      nodes.push(
        <pre
          key={key++}
          className="my-3 overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed"
        >
          <code>{buf.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      nodes.push(<hr key={key++} className="my-6 border-border" />);
      i++;
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const content = renderInline(h[2]);
      const sizes = ['text-3xl', 'text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm'];
      const cls = `mt-5 mb-2 font-semibold tracking-tight ${sizes[level - 1]}`;
      const tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      nodes.push(
        tag === 'h1'
          ? <h1 key={key++} className={cls}>{content}</h1>
          : tag === 'h2'
          ? <h2 key={key++} className={cls}>{content}</h2>
          : tag === 'h3'
          ? <h3 key={key++} className={cls}>{content}</h3>
          : tag === 'h4'
          ? <h4 key={key++} className={cls}>{content}</h4>
          : tag === 'h5'
          ? <h5 key={key++} className={cls}>{content}</h5>
          : <h6 key={key++} className={cls}>{content}</h6>,
      );
      i++;
      continue;
    }

    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|[-:\s|]+\|\s*$/.test(lines[i + 1])) {
      const headerCells = line.trim().slice(1, -1).split('|').map((c) => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].trim().slice(1, -1).split('|').map((c) => c.trim()));
        i++;
      }
      nodes.push(
        <div key={key++} className="my-3 overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {headerCells.map((h, idx) => (
                  <th key={idx} className="px-3 py-2 text-left font-medium">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ridx) => (
                <tr key={ridx} className="border-t">
                  {row.map((cell, cidx) => (
                    <td key={cidx} className="px-3 py-2 align-top">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      const itemRegex = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*]\s+(.*)$/;
      while (i < lines.length && itemRegex.test(lines[i])) {
        items.push(lines[i].replace(itemRegex, '$1'));
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) {
          items[items.length - 1] += ' ' + lines[i].trim();
          i++;
        }
      }
      const listCls = 'my-2 ml-6 space-y-1 text-sm';
      nodes.push(
        ordered ? (
          <ol key={key++} className={`list-decimal ${listCls}`}>
            {items.map((it, idx) => <li key={idx}>{renderInline(it)}</li>)}
          </ol>
        ) : (
          <ul key={key++} className={`list-disc ${listCls}`}>
            {items.map((it, idx) => <li key={idx}>{renderInline(it)}</li>)}
          </ul>
        ),
      );
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    const paraBuf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !lines[i].startsWith('```') &&
      !/^---+\s*$/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith('|')
    ) {
      paraBuf.push(lines[i]);
      i++;
    }
    nodes.push(
      <p key={key++} className="my-2 text-sm leading-relaxed">
        {renderInline(paraBuf.join(' '))}
      </p>,
    );
  }

  return nodes;
}

export default function LoginReportPage() {
  const nodes = renderMarkdown(reportMarkdown);
  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Informe técnico</p>
          <h1 className="text-2xl font-semibold tracking-tight">Rendimiento del inicio de sesión</h1>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir / PDF
        </Button>
      </div>
      <article className="rounded-lg border bg-card p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
        {nodes}
      </article>
    </div>
  );
}
