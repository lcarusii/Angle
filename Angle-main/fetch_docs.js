import axios from 'axios';
import * as cheerio from 'cheerio';

async function fetchDocs() {
  try {
    const res = await axios.get('https://www.volcengine.com/docs/82379/1541523?lang=zh');
    const html = res.data;
    const match = html.match(/window\._ROUTER_DATA\s*=\s*(.*?);<\/script>/);
    if (match) {
      const jsonStr = match[1];
      const state = JSON.parse(jsonStr);
      const doc = state.loaderData['docs/(libid)/(docid$)/page'].curDoc.Content;
      const $ = cheerio.load(doc);
      console.log($.text().substring(0, 5000));
    }
  } catch (e) {
    console.error(e.message);
  }
}

fetchDocs();
