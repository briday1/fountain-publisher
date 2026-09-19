/** A self-contained document: the notice text stays available without JS or a network. */
export function noticesPage(text: string): string {
  const escaped = text.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Third-party licenses — Fountain Publisher</title>
  <link rel="icon" href="/favicon.svg">
  <style>
    :root { color-scheme: light dark; font: 16px/1.6 system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; background: light-dark(#f0f0ef, #17191b); color: light-dark(#24272a, #e5e8eb); }
    main { max-width: 960px; margin: auto; }
    h1 { line-height: 1.2; font-size: clamp(28px, 5vw, 40px); }
    nav { display: flex; flex-wrap: wrap; gap: 12px 24px; }
    a { color: light-dark(#245a9d, #83afe8); text-underline-offset: 3px; }
    a:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: clamp(16px, 3vw, 32px); background: light-dark(#fafaf9, #202326); border: 1px solid light-dark(#ced1d3, #373c41); border-radius: 8px; font: 13px/1.65 ui-monospace, monospace; }
    @media print { body, pre { background: white; color: black; padding: 0; border: 0; } nav { display: none; } }
  </style>
</head>
<body>
  <main>
    <nav aria-label="Licenses navigation">
      <a href="/">Open the editor</a>
      <a href="/THIRD_PARTY_NOTICES.txt" download>Download license notices</a>
    </nav>
    <h1>Third-party licenses</h1>
    <p>Fountain Publisher includes the following software and fonts. Their copyright notices, permissions, and license terms are included here with the app.</p>
    <pre>${escaped}</pre>
  </main>
</body>
</html>`;
}
