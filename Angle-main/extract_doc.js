import fs from 'fs';

const html = fs.readFileSync('doc.html', 'utf-8');
const match = html.match(/"MDContent":"(.*?)"/);
if (match) {
  let content = match[1];
  content = content.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  console.log(content.substring(0, 2000));
}
