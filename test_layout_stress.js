const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'bedroom-space-chess-V3.html'), 'utf8');
const scriptSource = (() => {
  const external = html.match(/<script[^>]+src=["']([^"']*space-chess\.js)["'][^>]*><\/script>/i);
  if (external) return fs.readFileSync(path.resolve(__dirname, external[1]), 'utf8');
  const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)][0];
  if (inline) return inline[1];
  throw new Error('主页面脚本不存在');
})();
new Function(scriptSource)();

const fail = message => { throw new Error(message); };
const countTypes = solution => {
  if(!solution)return {};
  const byId = new Map((solution.inventoryItems || []).map(item => [item.id, item.typeId]));
  const counts = {};
  for (const id of Object.keys(solution.poses || {})) {
    const typeId = byId.get(id); if (typeId) counts[typeId] = (counts[typeId] || 0) + 1;
  }
  return counts;
};

setTimeout(() => {
  const engine = globalThis.RoomChessEngine;
  const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'server_config', 'furniture-config-default.json'), 'utf8'));
  if (!engine.applyFurnitureCatalog(baseline.furnitureRules)) fail('默认配置加载失败');
  engine.setLayoutDensityMode('rich');
  engine.setCustomCabinetEnabled(true);

  const cases = [
    ['bedroom','rect',2.9,3.5], ['bedroom','rect',3.2,3.6], ['bedroom','rect',3.6,3.8],
    ['bedroom','rect',4.0,4.2], ['bedroom','rect',4.6,5.0], ['bedroom','lshape',4.2,4.6],
    ['bedroom','cut',4.2,4.5], ['bedroom','notch',4.6,5.0],
    ['living','rect',3.8,3.6], ['living','rect',4.2,3.8], ['living','rect',5.0,4.2],
    ['living','rect',5.8,4.8], ['living','rect',6.5,5.0], ['living','rect',7.2,5.5],
    ['living','lshape',5.8,4.8], ['living','cut',6.2,5.0], ['living','notch',6.4,5.2]
  ];
  const rows = [];
  for (const [programId,shape,width,depth] of cases) {
    const label = `${programId}/${shape}/${width}×${depth}`;
    const result = engine.autoSelectInventory({programId,shape,width,depth});
    const solution = result.probe?.solutions?.[0];
    if (!result.feasible || !solution) fail(`${label}: 无方案`);
    if (!solution.evaluation?.qualityPass) fail(`${label}: 质量验收失败 ${JSON.stringify({counts:countTypes(solution),scores:solution.evaluation?.scores,diagnostics:solution.evaluation?.diagnostics&&{richMinimum:solution.evaluation.diagnostics.richMinimum,densityCoherent:solution.evaluation.diagnostics.densityCoherent,ground:solution.evaluation.diagnostics.ground,wall:solution.evaluation.diagnostics.wallDetails,modules:solution.evaluation.diagnostics.modules},trials:result.trials})}`);
    const counts = countTypes(solution), placed = Object.values(counts).reduce((a,b)=>a+b,0);
    const core = programId === 'bedroom' ? ['bed','wardrobe'] : ['sofa','tv','coffee'];
    for (const typeId of core) if (!(counts[typeId] > 0)) fail(`${label}: 缺少核心家具 ${typeId}`);
    if (counts.night) {
      const nightIds = solution.inventoryItems.filter(item => item.typeId === 'night').map(item => item.id).filter(id => solution.poses[id]);
      if (nightIds.some(id => solution.poses[id].relation !== 'bed-side')) fail(`${label}: 床头柜没有使用 bed-side 关系`);
    }
    if (counts.bench) {
      const bench = solution.inventoryItems.find(item => item.typeId === 'bench' && solution.poses[item.id]);
      if (solution.poses[bench.id].relation !== 'bed-foot') fail(`${label}: 床尾凳没有使用 bed-foot 关系`);
    }
    if (counts.chair && counts.desk) {
      const chair = solution.inventoryItems.find(item => item.typeId === 'chair' && solution.poses[item.id]);
      if (solution.poses[chair.id].relation !== 'desk-front') fail(`${label}: 工作椅没有朝向书桌`);
      const gap=solution.poses[chair.id].relationGap;
      if(gap<.029||gap>.071)fail(`${label}: 工作椅没有紧靠桌面 (${gap} m)`);
    }
    if (counts.diningTable && (counts.diningChair || 0) < 2) fail(`${label}: 餐桌没有成组餐椅`);
    if (programId === 'bedroom') {
      if (solution.decorItems?.some(item => item.kind === 'rug')) fail(`${label}: 卧室出现地毯`);
      if (width * depth >= 12 && !solution.decorItems?.some(item => item.kind === 'activityZone')) fail(`${label}: 未解释剩余活动空间`);
    }
    if (result.totalTimeMs > 10000) fail(`${label}: 搜索超过 10 秒 (${result.totalTimeMs.toFixed(0)} ms)`);
    rows.push({label,ms:+result.totalTimeMs.toFixed(1),nodes:result.totalNodes,attempts:result.attempts,placed,score:solution.evaluation.total,activity:solution.decorItems?.some(item=>item.kind==='activityZone')?'yes':'-'});
  }
  const micro=engine.autoSelectInventory({programId:'bedroom',shape:'rect',width:2.55,depth:2.68}),microSolution=micro.probe?.solutions?.[0],microCounts=countTypes(microSolution);
  if(!micro.feasible||!microSolution?.evaluation?.qualityPass)fail('bedroom/2.55×2.68 micro: 没有通过质量门槛的微型卧室方案');
  for(const typeId of ['bed','wardrobe','night','desk','chair'])if(!(microCounts[typeId]>0))fail(`bedroom/2.55×2.68 micro: 缺少 ${typeId}`);
  const microItems=new Map(microSolution.inventoryItems.map(item=>[item.typeId,item]));
  if(microSolution.poses[microItems.get('night').id]?.relation!=='bed-side')fail('bedroom/2.55×2.68 micro: 床头柜没有依附床侧');
  if(microSolution.poses[microItems.get('chair').id]?.relation!=='desk-front')fail('bedroom/2.55×2.68 micro: 工作椅没有依附书桌');
  if(microSolution.poses[microItems.get('chair').id].relationGap>.071)fail('bedroom/2.55×2.68 micro: 工作椅离桌面过远');
  rows.push({label:'bedroom/rect/2.55×2.68 micro',ms:+micro.totalTimeMs.toFixed(1),nodes:micro.totalNodes,attempts:micro.attempts,placed:Object.keys(microSolution.poses).length,score:microSolution.evaluation.total,activity:'-'});
  const scaled=engine.autoSelectInventory({programId:'living',shape:'rect',width:5.8,depth:4.8,areaMultiplier:3}),scaledSolution=scaled.probe?.solutions?.[0];
  if(!scaled.feasible||!scaledSolution)fail('living/rect/5.8×4.8@3x: 无方案');
  if(scaled.attempts>6)fail(`living/rect/5.8×4.8@3x: 搜索尝试数失控 (${scaled.attempts})`);
  if(scaled.totalTimeMs>6000)fail(`living/rect/5.8×4.8@3x: 质量优先搜索超过 6 秒 (${scaled.totalTimeMs.toFixed(0)} ms)`);
  if(scaledSolution.inventoryItems?.some(item=>item.typeId==='infillCabinet'))fail('living/rect/5.8×4.8@3x: 填缝柜仍进入 Beam 库存');
  if(!scaledSolution.decorItems?.some(item=>item.kind==='postDisplayCabinet'))fail('living/rect/5.8×4.8@3x: 最终阶段没有补墙面收口');
  if(!scaledSolution.decorItems?.some(item=>item.kind==='activityZone'))fail('living/rect/5.8×4.8@3x: 最终阶段没有补活动区');
  rows.push({label:'living/rect/5.8×4.8@3x',ms:+scaled.totalTimeMs.toFixed(1),nodes:scaled.totalNodes,attempts:scaled.attempts,placed:Object.keys(scaledSolution.poses).length,score:scaledSolution.evaluation.total,activity:'yes'});

  // 面积模数回归：超大卧室应成为一套完整的大单间会客模块，而不是靠后处理
  // 重复生成多张沙发；客厅进入客餐厅档后，综合方案优先挑战完整餐桌组。
  const studio=engine.autoSelectInventory({programId:'bedroom',shape:'rect',width:6.2,depth:6.6}),studioSolution=studio.probe?.solutions?.[0],studioCounts=countTypes(studioSolution);
  if(engine.roomAreaTier('bedroom',6.2*6.6).id!=='studio')fail('bedroom/6.2×6.6: 面积档位不是超大单间');
  for(const typeId of ['bedroomLoveseat','bedroomTeaTable','tvbench'])if(!(studioCounts[typeId]>0))fail(`bedroom/6.2×6.6: 大单间会客模块缺少 ${typeId}`);
  if(studio.attempts>6||studio.totalTimeMs>2000)fail(`bedroom/6.2×6.6: 搜索预算失控 (${studio.attempts} 次 / ${studio.totalTimeMs.toFixed(0)} ms)`);
  if(studio.totalNodes>18000)fail(`bedroom/6.2×6.6: 采样节点重新膨胀到 ${studio.totalNodes}`);
  if(studioSolution.decorItems?.some(item=>['activityLoveseat','activityChair','activityTable'].includes(item.kind)))fail('bedroom/6.2×6.6: 已有正式会客组后仍重复补活动区沙发/茶几');
  rows.push({label:'bedroom/rect/6.2×6.6 studio',ms:+studio.totalTimeMs.toFixed(1),nodes:studio.totalNodes,attempts:studio.attempts,placed:Object.keys(studioSolution.poses).length,score:studioSolution.evaluation.total,activity:'yes'});

  const mediumDining=engine.autoSelectInventory({programId:'living',shape:'rect',width:5,depth:5}),mediumDiningSolution=mediumDining.probe?.solutions?.[0],mediumDiningCounts=countTypes(mediumDiningSolution);
  if(!(mediumDiningCounts.diningTable>0)||(mediumDiningCounts.diningChair||0)<2)fail(`living/5×5: 客餐厅模块仍未形成完整餐组 ${JSON.stringify({counts:mediumDiningCounts,trials:mediumDining.trials})}`);
  rows.push({label:'living/rect/5×5 living-dining',ms:+mediumDining.totalTimeMs.toFixed(1),nodes:mediumDining.totalNodes,attempts:mediumDining.attempts,placed:Object.keys(mediumDiningSolution.poses).length,score:mediumDiningSolution.evaluation.total,activity:mediumDiningSolution.decorItems?.some(item=>item.kind==='activityZone')?'yes':'-'});

  const livingDining=engine.autoSelectInventory({programId:'living',shape:'rect',width:7.2,depth:5.5}),livingDiningSolution=livingDining.probe?.solutions?.[0],livingDiningCounts=countTypes(livingDiningSolution);
  if(engine.roomAreaTier('living',7.2*5.5).id!=='grand-living-dining')fail('living/7.2×5.5: 面积档位不是大客餐厅');
  if(!(livingDiningCounts.diningTable>0)||(livingDiningCounts.diningChair||0)<2||(livingDiningCounts.diningChair%2)!==0)fail(`living/7.2×5.5: 综合方案没有生成对称的二椅/四椅餐桌组 ${JSON.stringify({counts:livingDiningCounts,trials:livingDining.trials})}`);
  rows.push({label:'living/rect/7.2×5.5 grand dining',ms:+livingDining.totalTimeMs.toFixed(1),nodes:livingDining.totalNodes,attempts:livingDining.attempts,placed:Object.keys(livingDiningSolution.poses).length,score:livingDiningSolution.evaluation.total,activity:livingDiningSolution.decorItems?.some(item=>item.kind==='activityZone')?'yes':'-'});
  console.table(rows);
  console.log(`PASS: ${rows.length} 个尺寸/轮廓压力场景全部通过，总耗时 ${rows.reduce((sum,row)=>sum+row.ms,0).toFixed(1)} ms`);
}, 0);
