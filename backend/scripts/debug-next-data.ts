
import fs from 'fs';
import { parse } from 'node-html-parser';

try {
    const html = fs.readFileSync('hoseasons_real.html', 'utf8');

    // Simple manual extraction or use a parser
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

    const data = JSON.parse(jsonStr);

    console.log('Root keys:', Object.keys(data));
    if (data.props?.pageProps) {
        console.log('PageProps keys:', Object.keys(data.props.pageProps));

        // Check for properties in likely locations
        const locations = [
            data.props.pageProps.initialState?.properties,
            data.props.pageProps.initialState?.search?.properties,
            data.props.pageProps.properties,
            data.props.pageProps.data?.properties
        ];

        const found = locations.find(l => Array.isArray(l));
        if (found) {
            console.log(`✅ Found properties array! Length: ${found.length}`);
            console.log('Sample property:', JSON.stringify(found[0], null, 2).substring(0, 500));
        } else {
            console.log('❌ Could not find properties array in expected locations');
            console.log('InitialState keys:', Object.keys(data.props.pageProps.initialState || {}));
            // Recursive search?
            console.log(JSON.stringify(data.props.pageProps).substring(0, 1000));
        }
    }

} catch (e) {
    console.error(e);
}
