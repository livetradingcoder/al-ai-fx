const fs = require('fs');

async function translateText(text, targetLang) {
    if (typeof text !== 'string') return text;
    // Skip empty strings
    if (!text.trim()) return text;
    
    // We can't easily translate strings that contain HTML or JSX securely with the free Google API without escaping,
    // but for simple strings it works perfectly.
    try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
        const json = await res.json();
        return json[0].map(item => item[0]).join('');
    } catch (e) {
        console.error("Translation fail for:", text);
        return text;
    }
}

async function translateObject(obj, targetLang) {
    const translated = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            translated[key] = await translateText(value, targetLang);
            // wait a little to avoid rate limiting
            await new Promise(r => setTimeout(r, 100));
        } else if (typeof value === 'object' && value !== null) {
            translated[key] = await translateObject(value, targetLang);
        } else {
            translated[key] = value;
        }
    }
    return translated;
}

const langs = ['es', 'de', 'ar', 'hi', 'bn', 'ur'];

async function run() {
    console.log("Starting automatic translation via Google...");
    const enText = fs.readFileSync('src/messages/en.json', 'utf8');
    const enJson = JSON.parse(enText);
    
    for (const lang of langs) {
        console.log(`Translating to ${lang}...`);
        const result = await translateObject(enJson, lang);
        fs.writeFileSync(`src/messages/${lang}.json`, JSON.stringify(result, null, 2));
    }
    console.log("All languages translated successfully!");
}

run();
