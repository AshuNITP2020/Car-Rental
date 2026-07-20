import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'], defaultViewport: { width: 1440, height: 1000 },
})
const page = await browser.newPage()
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' })
// load checkout.js and open a standalone test checkout (no backend involved)
await page.evaluate(() => new Promise((res, rej) => {
  const s = document.createElement('script')
  s.src = 'https://checkout.razorpay.com/v1/checkout.js'
  s.onload = res; s.onerror = rej
  document.head.appendChild(s)
}))
await page.evaluate(() => {
  const rzp = new window.Razorpay({
    key: 'rzp_test_1DP5mmOlF5G5ag', amount: 10000, currency: 'INR',
    name: 'Probe', handler() {},
  })
  rzp.open()
})
await new Promise((r) => setTimeout(r, 4000))
const report = await page.evaluate(() => {
  const c = document.querySelector('.razorpay-container')
  if (!c) return { found: false }
  const cs = getComputedStyle(c)
  const rect = c.getBoundingClientRect()
  return {
    found: true,
    inlineStyle: c.getAttribute('style')?.slice(0, 300),
    computed: { position: cs.position, width: cs.width, height: cs.height, maxHeight: cs.maxHeight, display: cs.display, inset: `${cs.top} ${cs.right} ${cs.bottom} ${cs.left}` },
    rect: { w: rect.width, h: rect.height, top: rect.top },
  }
})
console.log(JSON.stringify(report, null, 2))
// now disable OUR stylesheets and remeasure
const after = await page.evaluate(() => {
  for (const sheet of document.styleSheets) {
    const href = sheet.href || ''
    if (!href.includes('razorpay')) { try { sheet.disabled = true } catch {} }
  }
  const c = document.querySelector('.razorpay-container')
  const rect = c.getBoundingClientRect()
  const cs = getComputedStyle(c)
  return { position: cs.position, height: cs.height, rectH: rect.height, maxHeight: cs.maxHeight }
})
console.log('after disabling our css:', JSON.stringify(after))
await browser.close()
