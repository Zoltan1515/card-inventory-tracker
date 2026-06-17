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
assert(page.includes('subtitle: percent(totals.roi)'), 'Quick Actions ROI subtitle should use net ROI after all expenses, not sold-only ROI.');
assert(page.includes('id="roi-panel"'), 'ROI% tab panel should render.');
assert(page.includes('aria-label="ROI% trend chart"'), 'ROI% tab should include an accessible trend chart.');
assert(page.includes('roiTrendPoints'), 'ROI% chart should be driven by calculated trend points.');
assert(page.includes('roiTrendPath'), 'ROI% chart should render a line path that moves up or down.');
assert(page.includes('current.expenses += expense.amount') && page.includes('const costBasis = bucket.cost + bucket.expenses'), 'ROI trend should subtract expenses and divide by cost plus expenses.');
assert(page.includes('.filter((point) => point.soldCount > 0)'), 'ROI trend should exclude expense-only periods with zero sold cards.');
assert(page.includes('Line = ROI after expenses') && page.includes('Dots = periods with sold cards'), 'ROI chart should explain what the line and dots mean.');
assert(page.includes('<text x="2" y="14"') && page.includes('<text x="2" y="92"'), 'ROI chart should include visible high/low axis labels.');
assert(page.includes('ROI% trend') && page.includes('DateFilterControls'), 'ROI% tab should reuse month/year/all-time date filters.');
assert(page.includes('soldViewRoiPercent'), 'Sold Inventory dashboard should calculate ROI% for shown sold cards.');
assert(page.includes('<Stat label="Total sold collected" value={money(totals.revenue)} />\n            <Stat label="Sold inventory cost" value={money(totals.soldInventoryCost)} />'), 'Business Numbers should not show a second sold-only ROI card after Total sold collected.');
assert(!page.includes('<Stat label="ROI%" value={percent(totals.soldRoi)}'), 'Overall dashboards should not show sold-only ROI as generic ROI%.');
assert(!page.includes('<li><span>Sold-card ROI</span>'), 'Business Numbers breakdown should not show the removed sold-card ROI value.');
assert(page.includes('<Stat label="ROI after expenses" value={percent(totals.roi)}'), 'ROI panel should show net ROI after all expenses.');
assert(page.includes('<Stat label="ROI% shown" value={percent(soldViewRoiPercent)}'), 'Sold Inventory dashboard should show ROI% for the currently shown sold cards.');
assert(page.includes('<small>ROI%</small>') && page.includes('percent(cardRoiAfterSaleExpenses(card))'), 'Sold listing cards should display their ROI%.');
assert(page.includes('cardRoiAfterSaleExpenses'), 'Sold listing ROI% should account for sale expenses tied to the card.');
assert(page.includes('soldRoiBadge ${cardRoiAfterSaleExpenses(card) >= 0 ? "positive" : "negative"}'), 'Sold listing ROI% badge should get a negative class when ROI is below zero.');
assert(css.includes('.compactHeroStats { grid-template-columns: repeat(5'), 'Account hero stat boxes should fit on one desktop line.');
assert(css.includes('.secondaryStatStrip { display: grid; grid-template-columns: repeat(5'), 'Secondary stat strip should fit all five boxes on one desktop line.');
assert(css.includes('.secondaryStatStrip small') && css.includes('font-size: .61rem'), 'Secondary stat strip labels should be compact enough for one-line layout.');
assert(css.includes('.roiChartCard'), 'ROI% chart card styles should exist.');
assert(css.includes('.roiChartSvg'), 'ROI% chart SVG styles should exist.');
assert(css.includes('.roiChartSvg { width: 100%; height: 160px; min-height: 0;'), 'ROI% chart should be compact instead of taking most of the screen.');
assert(css.includes('.roiChartLegend') && css.includes('.roiChartSvg text'), 'ROI% chart should style visible labels and legend indicators.');
assert(css.includes('.soldRoiBadge'), 'Sold card ROI% badge styles should exist.');
assert(css.includes('.soldRoiBadge strong.negative'), 'Negative sold ROI values should stay red inside ROI badges.');
assert(css.includes('@media (max-width: 720px)') && css.includes('.roiSummaryGrid'), 'ROI% layout should have mobile responsive styles.');

console.log('ROI dashboard checks passed.');
