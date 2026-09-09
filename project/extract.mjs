import { readFileSync, writeFileSync } from 'fs';
import * as pdfjsLib from './node_modules/pdfjs-dist/legacy/build/pdf.mjs';

const data = new Uint8Array(readFileSync('Documentação do PALA.pdf'));
const doc = await pdfjsLib.getDocument({ data }).promise;
let out = '';
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const tc = await page.getTextContent();
  let pageText = '';
  for (const item of tc.items) {
    if ('str' in item) pageText += item.str + ' ';
  }
  out += `\n===== PAGE ${i} =====\n` + pageText + '\n';
}
writeFileSync('C:/Users/VICTUS~1/AppData/Local/Temp/opencode/pala.txt', out);
console.log('numPages', doc.numPages);
