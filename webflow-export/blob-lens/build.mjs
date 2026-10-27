// Builds the paste-in files for Webflow from blob-lens.js:
//   embed.html        everything for one Webflow Embed element (styles, hero copy and button, script)
//   footer-code.html  just the script, for Page settings > Custom code > Before </body> tag
// Run: node webflow-export/blob-lens/build.mjs
import fs from "node:fs";
import path from "node:path";
const dir = path.dirname(new URL(import.meta.url).pathname);
const js = fs.readFileSync(path.join(dir, "blob-lens.js"), "utf8").trim();

const style = `<style>
  /* Made Clear liquid lens hero. Fonts and colours match the site; Borna is already loaded on the Webflow site. */
  .mc-lens-hero { display: flex; justify-content: center; align-items: center; min-height: 40rem; padding: 6rem 1rem; overflow: hidden; }
  .mc-lens-stage { position: relative; width: 38.875rem; max-width: 100%; aspect-ratio: 622 / 564; display: flex; justify-content: center; align-items: center; }
  .mc-lens-copy { max-width: min(18rem, 60vw); display: flex; flex-direction: column; align-items: center; gap: 1.25rem; text-align: center; }
  .mc-lens-text { margin: 0; font-family: Borna, Arial, sans-serif; font-size: 1.125rem; letter-spacing: 0.1rem; line-height: 1.6; color: #000; }
  .mc-lens-button { display: inline-flex; justify-content: center; align-items: center; padding: 0.625rem 1.75rem; border: 1px solid #373737; border-radius: 0.25rem; background: yellow; color: #000; font-family: Borna, Arial, sans-serif; font-size: 0.875rem; letter-spacing: 0.14rem; line-height: 1.2; text-decoration: none; }
  @media (max-width: 479px) {
    .mc-lens-copy { max-width: 52vw; gap: 1rem; }
    .mc-lens-text { font-size: 1rem; letter-spacing: 0.06rem; }
  }
</style>`;

const markup = `<div class="mc-lens-hero">
  <div class="mc-lens-stage" data-blob-lens data-blob-magnify="1.2">
    <div class="mc-lens-copy">
      <p class="mc-lens-text">When your science can change lives, your content should change behaviour.</p>
      <a href="/contact" class="mc-lens-button">Work With Us</a>
    </div>
  </div>
</div>`;

const script = `<script>\n${js}\n</script>`;
fs.writeFileSync(path.join(dir, "embed.html"), `<!-- Made Clear liquid lens hero: paste into one Webflow Embed element. -->\n${style}\n${markup}\n${script}\n`);
fs.writeFileSync(path.join(dir, "footer-code.html"), `<!-- Made Clear liquid lens: paste into Page settings > Custom code > Before </body> tag.\n     Then add the custom attribute data-blob-lens to the element that holds your hero copy. -->\n${script}\n`);
for (const f of ["embed.html", "footer-code.html"]) console.log(f, fs.statSync(path.join(dir, f)).size, "characters");
