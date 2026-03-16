import fs from 'fs';

const html = fs.readFileSync('doc.html', 'utf-8');
const matches = html.match(/.{0,50}ark\.cn-beijing\.volces\.com.{0,50}/g);
if (matches) {
  const uniqueMatches = [...new Set(matches)];
  console.log(uniqueMatches.join('\n'));
} else {
  console.log("No matches found");
}
