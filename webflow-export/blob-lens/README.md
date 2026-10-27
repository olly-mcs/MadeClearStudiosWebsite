# Liquid lens hero (trial B) for Webflow

A water drop that sits over the hero copy and magnifies it. It flows on its own, follows the cursor,
pulls out a droplet, and ripples where you click. The copy underneath stays real Webflow content: editable,
readable by screen readers and search engines, and its button stays clickable.

Built from `blob-lens.js`. After changing that file, run `node webflow-export/blob-lens/build.mjs` to rebuild
the two paste-in files.

## Option 1: one Embed element (quickest)

1. In the Webflow Designer, add an **Embed** element where the hero should go.
2. Paste in the whole of `embed.html` and save.
3. Publish to staging and check it there. Webflow doesn't run custom code inside the Designer, so you'll see
   only the plain copy while editing.

The copy and button text are in the embed's HTML. Edit them there.

## Option 2: your own Webflow elements (easier to edit later)

1. Build the hero copy and button with normal Webflow elements, inside one wrapper div. Give the wrapper a
   size (for example width 38.875rem, max width 100%, aspect ratio 622/564) and centre the copy inside it.
   Keep the copy narrow (about 18rem) so it fits inside the drop when magnified.
2. Select the wrapper. In **Element settings > Custom attributes**, add `data-blob-lens` (leave the value empty).
   Optionally add `data-blob-magnify` with a value such as `1.2` (higher is a stronger lens).
3. In **Page settings > Custom code > Before `</body>` tag**, paste the whole of `footer-code.html`.
4. Publish to staging and check it.

## Notes

- The drop is drawn on a canvas 2.6× wider and 1.6× taller than the wrapper, so a parent with **overflow:
  hidden** close around the wrapper will cut it off. Give the section room, or let it overflow.
- The colour behind the copy is detected from the nearest parent with a background. If the copy sits on an
  image or gradient, set `data-blob-background` on the wrapper to the colour you want inside the drop.
- If a visitor's browser has no WebGL, nothing happens and the copy shows normally. Visitors who have
  "reduce motion" switched on get a slower drop that doesn't follow the cursor.
- Each file is about 20,000 characters, which fits in a Webflow Embed element or page custom code. If Webflow
  ever refuses it, host `blob-lens.js` somewhere (for example on the Netlify site) and load it with
  `<script src="…/blob-lens.js"></script>` instead.
