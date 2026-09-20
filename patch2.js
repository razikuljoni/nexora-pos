const fs = require('fs');
const filepath = 'app/api/products/generate-image/route.ts';
let content = fs.readFileSync(filepath, 'utf8');

const search = `export const runtime = 'edge';`;
const replace = `// Edge runtime removed to allow Next.js build caching\n// export const runtime = 'edge';`;

content = content.replace(search, replace);
fs.writeFileSync(filepath, content);
console.log("Patched correctly");
