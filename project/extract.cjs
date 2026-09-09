const fs = require('fs');

if (!globalThis.DOMMatrix) {
  const DOMMatrix = class DOMMatrix {
    constructor(init) {
      if (Array.isArray(init)) {
        this.m = init.slice();
      } else {
        this.m = [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1];
      }
    }
    get a() { return this.m[0]; } set a(v) { this.m[0]=v; }
    get b() { return this.m[1]; } set b(v) { this.m[1]=v; }
    get c() { return this.m[2]; } set c(v) { this.m[2]=v; }
    get d() { return this.m[3]; } set d(v) { this.m[3]=v; }
    get e() { return this.m[4]; } set e(v) { this.m[4]=v; }
    get f() { return this.m[5]; } set f(v) { this.m[5]=v; }
    multiplySelf() { return this; }
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
    transformPoint(p) { return { x: this.m[0]*p.x + this.m[2]*p.y + this.m[4], y: this.m[1]*p.x + this.m[3]*p.y + this.m[5] }; }
  };
  globalThis.DOMMatrix = DOMMatrix;
  globalThis.DOMPoint = class DOMPoint { constructor(x=0,y=0,z=0,w=1){this.x=x;this.y=y;this.z=z;this.w=w;} };
}

const { PDFParse } = require('pdf-parse');
const buf = fs.readFileSync('Documentação do PALA.pdf');
const parser = new PDFParse({ data: buf });
parser.getText().then(d => {
  let out = '';
  for (const p of d.pages) {
    out += `\n===== PAGE ${p.num} =====\n` + p.text + '\n';
  }
  fs.writeFileSync('C:/Users/VICTUS~1/AppData/Local/Temp/opencode/pala.txt', out);
  console.log('OK pages:', d.pages.length);
}).catch(e => console.error('ERR', e.message));
