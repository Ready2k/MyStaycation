
import fs from 'fs';

const html = fs.readFileSync('scripts/hoseasons_debug.html', 'utf8');
console.log(html.substring(0, 5000));
