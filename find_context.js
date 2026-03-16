import fs from 'fs';

const html = fs.readFileSync('doc.html', 'utf-8');
const searchStr = 'api\\u002Fv3\\u002Fimages\\u002Fgenerations';
let index = html.indexOf(searchStr);
while (index !== -1) {
  const start = Math.max(0, index - 2000);
  const end = Math.min(html.length, index + 2000);
  console.log("--- MATCH ---");
  console.log(html.substring(start, end).replace(/\\n/g, '\n').replace(/\\"/g, '"'));
  index = html.indexOf(searchStr, index + searchStr.length);
}
