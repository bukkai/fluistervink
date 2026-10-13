// Meet de huidige pagina voor de veldtest-review. Uitvoeren in de browser
// (javascript_tool); de laatste expressie is het resultaat.
//
// - doelen: alles wat je kunt aanraken, met grootte en of het in de duimzone
//   (onderste helft) zit. `teKlein` = kleiner dan 48 px; `handschoen` = kleiner
//   dan 56 px.
// - contrast: elke zichtbare tekst, met voorgrond, achtergrond en verhouding.
//   `onderAA` = onder 4,5:1 (of 3:1 voor grote tekst). Gesorteerd, slechtste
//   eerst. Achtergrondafbeeldingen en verlopen worden niet meegerekend; die
//   staan als `bgOnzeker`.
(() => {
  const vh = window.innerHeight;

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return (
      r.width > 0 &&
      r.height > 0 &&
      s.visibility !== 'hidden' &&
      s.display !== 'none' &&
      Number(s.opacity) > 0
    );
  };

  const label = (el) =>
    (
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      el.textContent ||
      el.value ||
      el.tagName
    )
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 50);

  const path = (el) => {
    const parts = [];
    for (let n = el; n && n !== document.body && parts.length < 3; n = n.parentElement) {
      parts.unshift(
        n.tagName.toLowerCase() +
          (n.className && typeof n.className === 'string'
            ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.')
            : ''),
      );
    }
    return parts.join(' > ');
  };

  const interactive = [
    ...document.querySelectorAll(
      'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [onclick], label[for]',
    ),
  ].filter(visible);

  const doelen = interactive
    .map((el) => {
      const r = el.getBoundingClientRect();
      const min = Math.min(r.width, r.height);
      return {
        label: label(el),
        waar: path(el),
        breedte: Math.round(r.width),
        hoogte: Math.round(r.height),
        duimzone: r.top + r.height / 2 > vh / 2,
        teKlein: min < 48,
        handschoen: min < 56,
      };
    })
    .sort((a, b) => Math.min(a.breedte, a.hoogte) - Math.min(b.breedte, b.hoogte));

  // Kleur naar [r, g, b, a]; werkt voor rgb()/rgba() zoals getComputedStyle die geeft
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1]
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number);
    return [r, g, b, a];
  };
  const blend = (top, under) => {
    const a = top[3];
    return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1);
  };
  const lum = ([r, g, b]) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };

  // Effectieve achtergrond: lagen van boven naar beneden samenvoegen
  const background = (el) => {
    const layers = [];
    let uncertain = false;
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage !== 'none') uncertain = true;
      const c = parse(s.backgroundColor);
      if (c && c[3] > 0) {
        layers.push(c);
        if (c[3] === 1) break;
      }
    }
    let bg = [255, 255, 255, 1];
    for (const layer of layers.reverse()) bg = blend(layer, bg);
    return { bg, uncertain };
  };

  const seen = new Set();
  const contrast = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || seen.has(el) || !node.textContent.trim() || !visible(el)) continue;
    seen.add(el);
    const s = getComputedStyle(el);
    const fg = parse(s.color);
    if (!fg) continue;
    const { bg, uncertain } = background(el);
    const size = parseFloat(s.fontSize);
    const bold = Number(s.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const r = ratio(blend(fg, bg), bg);
    contrast.push({
      tekst: node.textContent.trim().slice(0, 40),
      waar: path(el),
      grootte: Math.round(size),
      verhouding: Math.round(r * 100) / 100,
      onderAA: r < (large ? 3 : 4.5),
      onder7: r < 7,
      kleineTekst: size < 16,
      bgOnzeker: uncertain,
      voorgrond: s.color,
    });
  }
  contrast.sort((a, b) => a.verhouding - b.verhouding);

  return {
    venster: `${window.innerWidth} × ${vh}`,
    donker: matchMedia('(prefers-color-scheme: dark)').matches,
    doelen: {
      totaal: doelen.length,
      teKlein: doelen.filter((d) => d.teKlein).length,
      lijst: doelen,
    },
    contrast: {
      totaal: contrast.length,
      onderAA: contrast.filter((c) => c.onderAA).length,
      lijst: contrast.slice(0, 40),
    },
  };
})();
