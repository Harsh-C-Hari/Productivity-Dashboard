/**
 * A deliberately small markdown-lite renderer for Study Notes. Supports
 * just enough syntax to make notes skimmable (headers, bold/italic,
 * bullet/numbered lists, inline code, links) without pulling in a full
 * markdown dependency. Input is HTML-escaped first, so this is safe to
 * render with dangerouslySetInnerHTML.
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="rounded bg-white/10 px-1 py-0.5 text-[0.85em]">$1</code>')
    .replace(
      /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline underline-offset-2">$1</a>'
    );
}

export function renderMarkdownLite(source: string): string {
  const escaped = escapeHtml(source ?? "");
  const lines = escaped.split("\n");
  const html: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listType) {
      html.push(listType === "ul" ? "</ul>" : "</ol>");
      listType = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (/^###\s+/.test(line)) {
      closeList();
      html.push(`<h3 class="font-display text-sm font-semibold mt-3 mb-1">${renderInline(line.replace(/^###\s+/, ""))}</h3>`);
    } else if (/^##\s+/.test(line)) {
      closeList();
      html.push(`<h2 class="font-display text-base font-semibold mt-4 mb-1.5">${renderInline(line.replace(/^##\s+/, ""))}</h2>`);
    } else if (/^#\s+/.test(line)) {
      closeList();
      html.push(`<h1 class="font-display text-lg font-semibold mt-4 mb-2">${renderInline(line.replace(/^#\s+/, ""))}</h1>`);
    } else if (/^[-*]\s+/.test(line)) {
      if (listType !== "ul") {
        closeList();
        html.push('<ul class="list-disc list-outside pl-5 space-y-0.5 my-1.5">');
        listType = "ul";
      }
      html.push(`<li>${renderInline(line.replace(/^[-*]\s+/, ""))}</li>`);
    } else if (/^\d+\.\s+/.test(line)) {
      if (listType !== "ol") {
        closeList();
        html.push('<ol class="list-decimal list-outside pl-5 space-y-0.5 my-1.5">');
        listType = "ol";
      }
      html.push(`<li>${renderInline(line.replace(/^\d+\.\s+/, ""))}</li>`);
    } else if (line.trim() === "") {
      closeList();
      html.push("<div class='h-2'></div>");
    } else {
      closeList();
      html.push(`<p class="leading-relaxed">${renderInline(line)}</p>`);
    }
  }
  closeList();

  return html.join("\n");
}
