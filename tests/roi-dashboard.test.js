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
assert(page.includes('ROI after expenses</span>') && page.includes('Sold-card periods</span>'), 'ROI chart should explain the line and dots without cluttered copy.');
assert(page.includes('roiTrendPoints.length > 1') && page.includes('Only one sold-card period in this range'), 'ROI chart should avoid rendering an ugly one-dot graph for single-period data.');
assert(!page.includes('<text x="2" y="14"') && !page.includes('<text x="2" y="92"'), 'ROI chart should not render stretched SVG text labels.');
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
assert(page.includes('<Stat label="Total Unsold Cards" value={String(activeInventoryQuantity)} />'), 'Account hero should show remaining unsold card quantity.');
assert(page.includes('<Stat label="Inventory on Hand" value={money(totals.totalInventoryValue)} infoText="This reflects the $ that was spent on current inventory" />'), 'Account hero should show inventory on hand with an explanatory info tooltip.');
assert(page.includes('<Stat label="Inventory at Grading" value={money(openGradingPurchaseValue)}'), 'Account hero should show purchase value currently away at grading.');
assert(page.includes('function Stat({ label, value, tone, onClick, active = false, infoText }') && page.includes('className="statInfoDot"'), 'Stat cards should support an info dot tooltip.');
assert(!page.includes('<Stat label="Sold Cards"') && !page.includes('<Stat label="Sold Revenue"'), 'Account hero should not duplicate sold performance stats.');
assert(page.includes('<small>Sold Cards</small><strong>{totals.soldCount}</strong>'), 'Secondary stat strip should include sold card quantity.');
assert(page.includes('<small>Sold Revenue</small><strong className={totals.revenue > 0 ? "positive" : ""}>{money(totals.revenue)}</strong>'), 'Secondary stat strip should include sold revenue.');
assert(page.includes('<small>Net Profit After Costs/Fees</small><strong className={totals.periodNetProfit >= 0 ? "positive" : "negative"}>{money(totals.periodNetProfit)}</strong>'), 'Secondary stat strip should include net profit after costs and fees.');
assert(page.includes('<small>Cash on hand</small><strong className={totals.cash >= 0 ? "positive" : "negative"}>{money(totals.cash)}</strong>'), 'Secondary stat strip should include cash on hand.');
assert(css.includes('.compactHeroStats { grid-template-columns: repeat(3'), 'Account hero stat boxes should fit remaining inventory plus grading value.');
assert(css.includes('.secondaryStatStrip { display: grid; grid-template-columns: repeat(5'), 'Secondary stat strip should fit the five performance boxes on one desktop line.');
assert(css.includes('.statInfoDot') && css.includes('.statTooltip') && css.includes('.statInfoDot:hover .statTooltip'), 'Inventory on hand info dot should reveal a themed tooltip on hover.');
assert(css.includes('.secondaryStatStrip small') && css.includes('font-size: .61rem'), 'Secondary stat strip labels should be compact enough for one-line layout.');
assert(css.includes('.roiChartCard'), 'ROI% chart card styles should exist.');
assert(css.includes('.roiChartSvg'), 'ROI% chart SVG styles should exist.');
assert(css.includes('.roiChartSvg { width: 100%; height: 160px; min-height: 0;'), 'ROI% chart should be compact instead of taking most of the screen.');
assert(css.includes('.roiChartLegend') && css.includes('.singleRoiNote'), 'ROI% chart should style legend indicators and the single-period summary note.');
assert(css.includes('.soldRoiBadge'), 'Sold card ROI% badge styles should exist.');
assert(css.includes('.soldRoiBadge strong.negative'), 'Negative sold ROI values should stay red inside ROI badges.');
assert(css.includes('@media (max-width: 720px)') && css.includes('.roiSummaryGrid'), 'ROI% layout should have mobile responsive styles.');

console.log('ROI dashboard checks passed.');
