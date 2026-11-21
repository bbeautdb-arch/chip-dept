// ไอคอนแอป "โรงชิพ": หน้าตัดท่อนไม้ (วงปี) + ชิ้นชิพ + แท่งกราฟ บนพื้นน้ำเงินกรมท่า-เงิน
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'

function icon({ scale = 1, rounded = true }) {
  const S = 512, cx = 256, cy = 256
  const rings = [150, 122, 96, 70, 44].map((r, i) => `<circle cx="210" cy="232" r="${r}" fill="none" stroke="${i % 2 ? '#c7a878' : '#e2c99f'}" stroke-width="${i === 0 ? 0 : 7}" opacity=".9"/>`).join('')
  const chip = (x, y, a, c) => `<rect x="${x}" y="${y}" width="74" height="40" rx="9" fill="${c}" transform="rotate(${a} ${x + 37} ${y + 20})" stroke="#0e2a1f" stroke-opacity=".25" stroke-width="3"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a5296"/><stop offset=".6" stop-color="#1a376a"/><stop offset="1" stop-color="#0f2448"/></linearGradient>
<radialGradient id="gloss" cx=".25" cy=".05" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".30"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="wood" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#f6e6c4"/><stop offset="1" stop-color="#d9b98a"/></radialGradient>
<linearGradient id="bark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef1f5"/><stop offset="1" stop-color="#aeb8c8"/></linearGradient>
<linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fb487"/><stop offset="1" stop-color="#1d6a48"/></linearGradient>
</defs>
<rect width="${S}" height="${S}" ${rounded ? 'rx="112"' : ''} fill="url(#bg)"/>
<rect width="${S}" height="${S}" ${rounded ? 'rx="112"' : ''} fill="url(#gloss)"/>
<g transform="translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})">
<circle cx="210" cy="232" r="168" fill="url(#bark)"/>
<circle cx="210" cy="232" r="150" fill="url(#wood)"/>
${rings}
<circle cx="210" cy="232" r="16" fill="#b8925c"/>
${chip(300, 300, -18, 'url(#g1)')}
${chip(352, 354, 14, '#e2c99f')}
${chip(282, 372, 28, 'url(#g1)')}
<g>
<rect x="356" y="96" width="22" height="70" rx="6" fill="#ffffff" opacity=".95"/>
<rect x="390" y="70" width="22" height="96" rx="6" fill="#6fd0a2"/>
<rect x="424" y="112" width="22" height="54" rx="6" fill="#ffffff" opacity=".75"/>
</g>
</g>
</svg>`
}
const main = icon({ scale: 1 })
writeFileSync('public/favicon.svg', main)
const mask = icon({ scale: 0.78, rounded: false })
await sharp(Buffer.from(main)).resize(192, 192).png().toFile('public/pwa-192.png')
await sharp(Buffer.from(main)).resize(512, 512).png().toFile('public/pwa-512.png')
await sharp(Buffer.from(mask)).resize(512, 512).png().toFile('public/pwa-maskable-512.png')
await sharp(Buffer.from(icon({ scale: 0.9, rounded: false }))).resize(180, 180).png().toFile('public/apple-touch-icon.png')
console.log('icons ok')
