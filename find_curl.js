import fs from 'fs';

const html = fs.readFileSync('doc.html', 'utf-8');
const matches = html.match(/curl.*?https:\\u002F\\u002Fark\.cn-beijing\.volces\.com\\u002Fapi\\u002Fv3\\u002Fimages\\u002Fgenerations.*?}/g);
if (matches) {
  for (const match of matches) {
    console.log("--- MATCH ---");
    console.log(match.replace(/\\u002F/g, '/').replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
  }
} else {
  console.log("No curl matches found");
}
