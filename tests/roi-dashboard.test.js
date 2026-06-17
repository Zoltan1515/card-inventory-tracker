const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

const assert = (condition, message) => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

assert(page.includes('| "roi"'), 'ROI% should be a first-class dashboard tab.');
assert(page.includes('label: "ROI%"'), 'Quick Actions should include an ROI% tab.');
assert(page.includes('id="roi-panel"'), 'ROI% tab panel should render.');
assert(page.includes('aria-label="ROI% trend chart"'), 'ROI% tab should include an accessible trend chart.');
assert(page.includes('roiTrendPoints'), 'ROI% chart should be driven by calculated trend points.');
assert(page.includes('roiTrendPath'), 'ROI% chart should render a line path that moves up or down.');
assert(page.includes('ROI% trend') && page.includes('DateFilterControls'), 'ROI% tab should reuse month/year/all-time date filters.');
assert(page.includes('soldViewRoiPercent'), 'Sold Inventory dashboard should calculate ROI% for shown sold cards.');
assert(page.includes('<Stat label="Total sold collected" value={money(totals.revenue)} />\n            <Stat label="ROI%" value={percent(totals.soldRoi)}'), 'Business Numbers should show ROI% immediately after Total sold collected.');
assert(page.includes('<Stat label="ROI% shown" value={percent(soldViewRoiPercent)}'), 'Sold Inventory dashboard should show ROI% for the currently shown sold cards.');
assert(page.includes('<small>ROI%</small>') && page.includes('percent(cardRoiAfterSaleExpenses(card))'), 'Sold listing cards should display their ROI%.');
assert(page.includes('cardRoiAfterSaleExpenses'), 'Sold listing ROI% should account for sale expenses tied to the card.');
assert(css.includes('.roiChartCard'), 'ROI% chart card styles should exist.');
assert(css.includes('.roiChartSvg'), 'ROI% chart SVG styles should exist.');
assert(css.includes('.soldRoiBadge'), 'Sold card ROI% badge styles should exist.');
assert(css.includes('@media (max-width: 720px)') && css.includes('.roiSummaryGrid'), 'ROI% layout should have mobile responsive styles.');

console.log('ROI dashboard checks passed.');
