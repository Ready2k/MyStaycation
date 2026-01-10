
import fs from 'fs';

try {
    const html = fs.readFileSync('hoseasons_real.html', 'utf8');
    const startMarker = '<script id="__NEXT_DATA__" type="application/json">';
    const endMarker = '</script>';

    const startIndex = html.indexOf(startMarker);
    if (startIndex === -1) {
        console.error('Could not find __NEXT_DATA__');
        process.exit(1);
    }

    const contentStart = startIndex + startMarker.length;
    const endIndex = html.indexOf(endMarker, contentStart);
    const jsonStr = html.substring(contentStart, endIndex);

    fs.writeFileSync('hoseasons_data.json', jsonStr);
    console.log(`Saved JSON to hoseasons_data.json (${jsonStr.length} bytes)`);

} catch (e) {
    console.error(e);
}
