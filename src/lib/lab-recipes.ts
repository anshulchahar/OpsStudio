export const recipeIds = ["health", "authorization"] as const;
export type RecipeId = (typeof recipeIds)[number];

export function labRecipe(recipe: RecipeId) {
  return `import http from 'node:http';
import assert from 'node:assert/strict';
const recipe = ${JSON.stringify(recipe)};
const claim = { id: 'claim-training-001', ownerId: 'customer-a', description: 'Synthetic training claim' };
let ownershipRequired = false;
const results = [];
const server = http.createServer((req,res) => {
  res.setHeader('content-type','application/json');
  if (req.url === '/health') { res.end(JSON.stringify({healthy:true})); return; }
  if (req.url === '/claims/claim-training-001') {
    const identity = req.headers['x-training-customer'];
    // This fixed identity header is a TEST FIXTURE, not production authentication.
    if (!identity) { res.writeHead(401); res.end('{}'); return; }
    if (ownershipRequired && identity !== claim.ownerId) { res.writeHead(403); res.end('{}'); return; }
    res.end(JSON.stringify(claim)); return;
  }
  res.writeHead(404); res.end('{}');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
try {
  const health = await fetch(base+'/health');
  assert.equal(health.status,200);
  assert.equal((await health.json()).healthy,true);
  results.push({label:'Health endpoint returns HTTP 200',status:'pass',detail:'A real HTTP request reached the running Node.js service.'});
  const missing=await fetch(base+'/missing');
  assert.equal(missing.status,404);
  results.push({label:'Unknown route returns HTTP 404',status:'pass',detail:'The service does not treat a missing resource as a successful request.'});
  if(recipe==='authorization') {
    const before=await fetch(base+'/claims/claim-training-001',{headers:{'x-training-customer':'customer-b'}});
    assert.equal(before.status,200);
    results.push({label:'Before: cross-customer access reproduced',status:'warn',detail:'Customer B could read the synthetic claim owned by customer A before the ownership rule.'});
    ownershipRequired=true;
    const stranger=await fetch(base+'/claims/claim-training-001',{headers:{'x-training-customer':'customer-b'}});
    assert.equal(stranger.status,403);
    assert.equal((await stranger.json()).ownerId,undefined);
    results.push({label:'After: cross-customer access denied',status:'pass',detail:'HTTP 403 with no claim data after enforcing ownership.'});
    const owner=await fetch(base+'/claims/claim-training-001',{headers:{'x-training-customer':'customer-a'}});
    assert.equal(owner.status,200);
    assert.equal((await owner.json()).ownerId,'customer-a');
    results.push({label:'Legitimate owner access preserved',status:'pass',detail:'Customer A can still read the expected synthetic claim.'});
    const anonymous=await fetch(base+'/claims/claim-training-001');
    assert.equal(anonymous.status,401);
    results.push({label:'Missing identity rejected',status:'pass',detail:'The test fixture rejects a request without its training identity.'});
  }
  console.log(JSON.stringify({passed:true,recipe,results,limitations:'A bounded Node.js verification recipe with synthetic identity fixtures. This does not provision production infrastructure or test a real identity provider.'}));
} finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
`;
}
