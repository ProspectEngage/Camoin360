// Local visual-review server. Synthetic data only; never contacts Dynamics.
const http = require('http');
const fs = require('fs');
const path = require('path');
const build = path.resolve(__dirname, '../../frontend/build');
const months = Array.from({ length: 6 }, (_, i) => ({
  month_key: `2025-0${i + 1}`, monthKey: `2025-0${i + 1}`, year: '2025',
  projects: [8, 11, 6, 15, 12, 18][i], amount: 180000 + i * 35000,
  rfp_signed_amount: 95000 + i * 16000, rfp_contracts_won: i + 3,
  non_bid_signed_amount: 25000 + i * 8000, total_project_fee: 230000 + i * 44000,
  fee_for_camoin: 180000 + i * 35000, consulting: 110000 + i * 22000, research: 70000 + i * 13000,
}));
const annual = [{year:'2023', amount:1350000}, {year:'2024', amount:1625000}, {year:'2025', amount:2125000}];
const fixtures = {
  'sales-outlook': { annual_contracts: annual, monthly_projects: months, project_details: months.map((r, i) => ({ project_id: String(i), project_name: `Sample project ${i + 1}`, created_on: `${r.month_key}-15`, fee_for_camoin: r.fee_for_camoin })) },
  'sales-outlook-rfp': { annual_proposals: annual, monthly_contracts: months },
  'contract-backlog': { monthly_totals: months },
  'rfp-success-rate': { service_lines: ['Consulting'], series: [1,2,3,4].map((q) => ({ year:'2025', quarter:String(q), period:`2025 Q${q}`, service_line:'Consulting', won:q+2, lost:2, open:1, won_fee: (q+2)*50000, decided_fee:(q+4)*50000 })) },
  'service-line-financials': { months, service_lines: [{key:'consulting', label:'Consulting'}, {key:'research', label:'Research'}], record_counts:{included:42}, updated_at:'2025-07-01T12:00:00Z' },
  'pe-revenue': {
    as_of:'2026-11-22', mrr:4750, arr:57000, active_paying_clients:3, receipts:1750,
    clients:[
      {organization_id:1,organization_name:'City of Riverton',subscription:{plan_name:'Professional',amount_cents:175000,billing_frequency:'monthly',status:'active'},monthly_equivalent:1750,annual_equivalent:21000},
      {organization_id:2,organization_name:'County Development Corp.',subscription:{plan_name:'Enterprise',amount_cents:2400000,billing_frequency:'annual',status:'active'},monthly_equivalent:2000,annual_equivalent:24000},
      {organization_id:3,organization_name:'Metro Economic Alliance',subscription:{plan_name:'Professional',amount_cents:100000,billing_frequency:'monthly',status:'active'},monthly_equivalent:1000,annual_equivalent:12000},
    ],
    payments:[{id:1,organization_id:1,amount_cents:175000,received_on:'2026-11-15',period_start:'2026-11-01',period_end:'2026-11-30',reference:'Example check'}],
    monthly_breakdown:[{month:'2026-11',mrr:4750,arr:57000,active_paying_clients:3,receipts:1750}],
    subscription_history:[],
  },
};
http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/fixture/')) {
    const key = url.pathname.split('/').pop();
    if (url.searchParams.get('state') === 'loading') return;
    res.setHeader('Content-Type', 'application/json');
    if (url.searchParams.get('state') === 'error') { res.writeHead(503); res.end(JSON.stringify({detail:'Dynamics is temporarily unavailable.'})); return; }
    const data = structuredClone(fixtures[key] || {});
    if (url.searchParams.get('state') === 'empty') for (const key of Object.keys(data)) if (Array.isArray(data[key]) && key !== 'service_lines') data[key] = [];
    res.end(JSON.stringify(data)); return;
  }
  let filename = path.join(build, url.pathname);
  if (!fs.existsSync(filename) || fs.statSync(filename).isDirectory()) filename = path.join(build,'index.html');
  const ext = path.extname(filename);
  res.setHeader('Content-Type', {'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml'}[ext] || 'application/octet-stream');
  let content = fs.readFileSync(filename);
  if (ext === '.html') content = content.toString().replace('<head>', `<head><script>
    const user = {name:'Sample reviewer',role:'admin',modules:['management']};
    localStorage.setItem('sophie:authToken', btoa(JSON.stringify({exp:4102444800,sub:'sample@example.test',...user}))+'.sample');
    localStorage.setItem('sophie:authUser', JSON.stringify(user));
    localStorage.setItem('sophie:dashboardView','management');
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method,url,...args) {
      const u = new URL(url, location.href);
      if (u.port === '8000') url = '/fixture'+u.pathname+'?state='+(new URLSearchParams(location.search).get('state')||'ready');
      return originalOpen.call(this,method,url,...args);
    };
    window.addEventListener('load', () => {
      const banner = document.createElement('div');
      banner.textContent = 'VISUAL REVIEW • SYNTHETIC SAMPLE DATA';
      banner.style = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;text-align:center;background:#fff3cd;color:#594400;padding:6px;font:12px sans-serif';
      document.body.appendChild(banner);
    });
  </script>`);
  res.end(content);
}).listen(8765, '127.0.0.1', () => console.log('Sample preview: http://127.0.0.1:8765'));
