/**
 * Pre-renders the icon set used by generate.js into PNG files, so pptxgenjs
 * can embed them as native images. Feather icons (react-icons/fi), rasterized
 * with sharp at 256px on a transparent background, in one of a few fixed tint
 * colors so generate.js can just reference a filename.
 */
const fs = require("fs");
const path = require("path");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const Fi = require("react-icons/fi");

const OUT_DIR = path.join(__dirname, "assets", "icons");
fs.mkdirSync(OUT_DIR, { recursive: true });

const COLORS = {
  ink: "1F2937", // gray-800, default icon color
  blue: "2563EB", // accent
  white: "FFFFFF",
  grey: "6B7280", // gray-500
};

// name -> Feather component
const ICONS = {
  file: Fi.FiFile,
  filetext: Fi.FiFileText,
  folder: Fi.FiFolder,
  image: Fi.FiImage,
  search: Fi.FiSearch,
  database: Fi.FiDatabase,
  cpu: Fi.FiCpu,
  shield: Fi.FiShield,
  lock: Fi.FiLock,
  clock: Fi.FiClock,
  filter: Fi.FiFilter,
  type: Fi.FiType,
  zap: Fi.FiZap,
  gitmerge: Fi.FiGitMerge,
  user: Fi.FiUser,
  monitor: Fi.FiMonitor,
  server: Fi.FiServer,
  layers: Fi.FiLayers,
  hash: Fi.FiHash,
  grid: Fi.FiGrid,
  target: Fi.FiTarget,
  checkcircle: Fi.FiCheckCircle,
};

async function renderOne(name, Comp, colorName, colorHex, px) {
  // The component's own rendered <svg> already carries the correct
  // stroke="currentColor" fill="none" + color style — use it as-is.
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Comp, { color: `#${colorHex}`, size: px, strokeWidth: 1.6 })
  );
  const outPath = path.join(OUT_DIR, `${name}-${colorName}.png`);
  await sharp(Buffer.from(svg)).resize(px, px).png().toFile(outPath);
  return outPath;
}

(async () => {
  const px = 256;
  let count = 0;
  for (const [name, Comp] of Object.entries(ICONS)) {
    if (!Comp) {
      console.error("Missing icon component for", name);
      continue;
    }
    for (const [colorName, colorHex] of Object.entries(COLORS)) {
      await renderOne(name, Comp, colorName, colorHex, px);
      count++;
    }
  }
  console.log(`Rendered ${count} icon PNGs to ${OUT_DIR}`);
})();
