export default function (eleventyConfig) {
  // Static assets exported from Webflow, copied as-is
  for (const dir of ["css", "js", "images", "fonts"]) {
    eleventyConfig.addPassthroughCopy(`src/${dir}`);
  }

  // CMS helpers. The collections live in src/_data/*.json (exported from the Webflow CMS).
  // Items with "draft": true or "archived": true are left off the site, like in Webflow.
  const published = (items = []) => items.filter((i) => !i.draft && !i.archived);
  eleventyConfig.addFilter("published", published);
  eleventyConfig.addFilter("where", (items = [], key, value) => items.filter((i) => i[key] === value));
  eleventyConfig.addFilter("whereIn", (items = [], key, values = []) => items.filter((i) => values.includes(i[key])));
  eleventyConfig.addFilter("findBy", (items = [], key, value) => items.find((i) => i[key] === value));
  eleventyConfig.addFilter("except", (items = [], item) => items.filter((i) => i !== item));
  eleventyConfig.addFilter("sortBy", (items = [], key) =>
    [...items].sort((a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? ""), "en", { sensitivity: "base" }))
  );
  eleventyConfig.addFilter("sortByOrder", (items = []) => [...items].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)));

  // Webflow lightbox data for a Vimeo link, e.g. https://vimeo.com/882463366/148615107a?share=copy
  eleventyConfig.addFilter("lightboxJson", (url) => {
    const m = String(url).match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([0-9a-f]+))?/);
    const player = m ? `https://player.vimeo.com/video/${m[1]}${m[2] ? `?h=${m[2]}` : ""}` : url;
    const html = `<iframe class="embedly-embed" src="${player}" width="940" height="529" scrolling="no" title="Vimeo embed" frameborder="0" allow="autoplay; fullscreen; encrypted-media; picture-in-picture;" allowfullscreen="true"></iframe>`;
    // Escape "<" so the JSON can sit inside a <script> tag
    return JSON.stringify({ items: [{ url, originalUrl: url, width: 940, height: 529, html, type: "video" }], group: "" }, null, 2).replace(/</g, "\\u003c");
  });

  return {
    dir: { input: "src", output: "_site" },
    htmlTemplateEngine: "njk",
  };
}
