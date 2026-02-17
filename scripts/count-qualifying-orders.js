const fs = require('fs');
const path = require('path');

const csvPath = process.argv[2] || path.join(process.env.USERPROFILE || '', 'Downloads', 'orders-2026-02-17_Latest.csv');
const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.split(/\r?\n/).filter(Boolean);

// CSV: Order ID, 653, "Name", email, phone, Order Date, Order Status (quoted or unquoted)
const rowRe = /,653,"[^"]*",[^,]+,[^,]+,(\d{1,2}\/\d{1,2}\/\d{4}),(?:"([^"]+)"|([^,]+))/;
const qualStatuses = ['Shipped', 'Partially refunded', 'Partially Refunded', 'Partially Shipped', 'Completed', 'Awaiting fulfillment'];

function parseDate(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
}

const end = new Date(2026, 1, 17);
const start = new Date(2026, 1, 10);
const start7 = new Date(2026, 1, 11);

let total653 = 0;
let inWindow = 0;
let inWindowQual = 0;
let inWindow7Qual = 0;
const byStatus = {};
const byDate = {};
const rows = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.includes('653')) continue;
  const m = line.match(rowRe);
  if (!m) continue;
  total653++;
  const dateStr = m[1];
  const statusStr = (m[2] || m[3] || '').trim();
  const orderDate = parseDate(dateStr);
  if (!orderDate) continue;

  if (orderDate >= start && orderDate <= end) {
    inWindow++;
    byDate[dateStr] = (byDate[dateStr] || 0) + 1;
    if (qualStatuses.some(q => statusStr.includes(q))) {
      inWindowQual++;
      byStatus[statusStr] = (byStatus[statusStr] || 0) + 1;
      rows.push({ date: dateStr, status: statusStr });
    }
  }
  if (orderDate >= start7 && orderDate <= end && qualStatuses.some(q => statusStr.includes(q))) {
    inWindow7Qual++;
  }
}

console.log('--- Customer 653 (Che Ouyang / ouyche@gmail.com) ---');
console.log('Total orders in export:', total653);
console.log('Orders with Order Date in window Feb 10–17, 2026:', inWindow);
console.log('Qualifying in window Feb 10–17:', inWindowQual);
console.log('By status:', JSON.stringify(byStatus, null, 2));
console.log('By date:', JSON.stringify(byDate, null, 2));
console.log('Qualifying in strict 7 days Feb 11–17:', inWindow7Qual);
if (rows.length <= 25) console.log('Qualifying rows (date, status):', rows);
