import fs from 'fs';

const html = fs.readFileSync('doc.html', 'utf-8');
const matches = html.match(/"data":\s*\[\s*{\s*"url":\s*".*?"\s*}\s*\]/g);
if (matches) {
  console.log(matches.join('\n'));
} else {
  console.log("No response matches found");
}
