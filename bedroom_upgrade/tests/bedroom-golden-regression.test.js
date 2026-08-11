'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const engine=require('../assets/bedroom-module-engine.js');
const adapter=require('../assets/recognized-room-adapter.js');
const topology=require('../assets/bedroom-room-topology.js');

const ROOT=path.join(__dirname,'..','..');
const SUITE_ROOT=path.join(__dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(SUITE_ROOT,'goldens','bedroom-golden-cases.json'),'utf8'));
engine.configureFurniture(JSON.parse(fs.readFileSync(path.join(ROOT,'server_config','furniture-config-current.json'),'utf8')));

function loadRoom(source){
  if(source.kind==='preset')return engine.makeRoom(source.width,source.depth);
  const payload=JSON.parse(fs.readFileSync(path.join(ROOT,'samples',source.file),'utf8'));
  const recognized=adapter.prepareBedrooms(payload,source.totalArea),room=recognized.find(row=>row.label===source.roomLabel);
  if(!room)throw new Error(`${source.file} 中找不到 ${source.roomLabel}`);
  if(!room.supported)throw new Error(`${source.roomLabel} 当前不受支持：${room.reason}`);
  return engine.makePolygonRoom(room);
}

function checkCase(testCase){
  const started=Date.now(),room=loadRoom(testCase.source),result=engine.searchPortfolio(room,{beamWidth:16,maxPatterns:2,timeBudgetMs:240}),solution=result.solutions[0],expected=testCase.expected,errors=[];
  if(!solution)errors.push('没有生成任何方案');
  if(solution){
    const types=new Set(solution.modules.map(module=>module.type)),sleep=solution.modules.find(module=>module.type==='sleep'),infill=solution.modules.find(module=>module.type==='infill');
    if(result.pattern.id!==expected.pattern)errors.push(`棋谱 ${result.pattern.id} ≠ ${expected.pattern}`);
    for(const type of expected.requiredTypes||[])if(!types.has(type))errors.push(`缺少模块 ${type}`);
    if(expected.sleepSize&&sleep?.size!==expected.sleepSize)errors.push(`睡眠变例 ${sleep?.size||'无'} ≠ ${expected.sleepSize}`);
    const nightstands=sleep?.items.filter(item=>item.type==='night').length||0;if(expected.minNightstands!=null&&nightstands<expected.minNightstands)errors.push(`床头柜 ${nightstands} < ${expected.minNightstands}`);
    if(expected.infillFacing){const cabinets=solution.modules.filter(module=>['storage','infill'].includes(module.type)),facingCabinet=cabinets.find(module=>{const normal=room.walls[module.wallIndex].normal;return normal.x*expected.infillFacing.x+normal.y*expected.infillFacing.y>=.9;});if(!facingCabinet)errors.push(`凹角柜类模块均未朝向期望方向 (${expected.infillFacing.x},${expected.infillFacing.y})`);}
    if(expected.maxCabinetWallShadow!=null&&solution.evaluation.cabinetWallShadow>expected.maxCabinetWallShadow)errors.push(`柜体封墙 ${solution.evaluation.cabinetWallShadow}m > ${expected.maxCabinetWallShadow}m`);
    if(expected.maxOpportunityCount!=null&&(solution.evaluation.opportunities?.count||0)>expected.maxOpportunityCount)errors.push(`漏摆机会 ${solution.evaluation.opportunities.count} > ${expected.maxOpportunityCount}`);
    if(expected.minScore!=null&&solution.evaluation.total<expected.minScore)errors.push(`全局分 ${solution.evaluation.total} < ${expected.minScore}`);
    if(expected.maxTimeMs!=null&&result.stats.timeMs>expected.maxTimeMs)errors.push(`搜索 ${result.stats.timeMs.toFixed(1)}ms > ${expected.maxTimeMs}ms`);
    if(!solution.evaluation.qualityPass)errors.push('未通过首轮硬验收');
    for(const item of solution.items)if(!topology.rectInsidePolygon(item,room.polygon))errors.push(`${item.label} 越出房间轮廓`);
  }
  return {id:testCase.id,label:testCase.label,passed:errors.length===0,errors,pattern:result.pattern.id,room:{area:+room.area.toFixed(2),shape:room.shape,walls:room.walls.length},result:solution?{score:solution.evaluation.total,baseScore:solution.evaluation.baseTotal,modules:solution.modules.map(module=>`${module.type}:${module.size}`),opportunities:solution.evaluation.opportunities?.count||0,cabinetWallShadow:solution.evaluation.cabinetWallShadow,flow:+solution.evaluation.flow.connectedRatio.toFixed(3)}:null,stats:{nodes:result.stats.nodes,rawActions:result.stats.rawActions,opportunityChecks:result.stats.opportunityChecks,timeMs:+result.stats.timeMs.toFixed(2),portfolioRuns:result.stats.portfolioRuns?.map(row=>row.patternId)||[]},wallMs:Date.now()-started};
}

const rows=catalog.cases.map(testCase=>{try{return checkCase(testCase);}catch(error){return {id:testCase.id,label:testCase.label,passed:false,errors:[error.message]};}}),passed=rows.filter(row=>row.passed).length,report={schemaVersion:1,generatedAt:new Date().toISOString(),summary:{total:rows.length,passed,failed:rows.length-passed},cases:rows};
const artifactDir=path.join(SUITE_ROOT,'artifacts');fs.mkdirSync(artifactDir,{recursive:true});fs.writeFileSync(path.join(artifactDir,'golden-regression-latest.json'),JSON.stringify(report,null,2));
console.table(rows.map(row=>({case:row.id,pass:row.passed,pattern:row.pattern||'—',score:row.result?.score??'—',modules:row.result?.modules.join(',')||'—',opportunities:row.result?.opportunities??'—',timeMs:row.stats?.timeMs??'—'})));
for(const row of rows)if(!row.passed)console.error(`FAIL ${row.id}: ${row.errors.join('；')}`);
assert.equal(passed,rows.length,`金牌回归失败 ${rows.length-passed}/${rows.length}`);
console.log('BEDROOM_GOLDEN_REGRESSION_OK');
