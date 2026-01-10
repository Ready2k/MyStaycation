
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('hoseasons_data.json', 'utf8'));

function findKey(obj: any, path: string = '') {
    if (!obj || typeof obj !== 'object') return;

    // Check current object keys
    Object.keys(obj).forEach(key => {
        const lowerKey = key.toLowerCase();
        const currentPath = path ? `${path}.${key}` : key;

        // Check if key matches interest
        if (lowerKey.includes('price') || lowerKey.includes('cost')) {
            console.log(`✅ Found Key: "${key}" at ${currentPath}`);
            // Print sample if object
            if (typeof obj[key] === 'object') {
                console.log('Sample Value:', JSON.stringify(obj[key]).substring(0, 100));
            } else {
                console.log('Value:', obj[key]);
            }
        }

        // Recurse
        findKey(obj[key], currentPath);
    });
}

console.log('Searching for "price" keys...');
findKey(data);
