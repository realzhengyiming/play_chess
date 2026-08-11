'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const engine=require('../assets/bedroom-module-engine.js');
const recognizedAdapter=require('../assets/recognized-room-adapter.js');

const CASES=[
  {id:'compact',width:2.9,depth:3.4,pattern:'standard-perimeter',maxNodes:120},
  {id:'standard',width:3.6,depth:3.8,pattern:'standard-perimeter',maxNodes:160},
  {id:'long',width:3.1,depth:5.6,pattern:'hotel-long-axis',maxNodes:220,expectAnyModules:['work','lounge']},
  {id:'suite',width:5.2,depth:4.8,pattern:'suite-zoned',maxNodes:400}
];

const rows=[];
for(const testCase of CASES){
  const result=engine.search(engine.makeRoom(testCase.width,testCase.depth),{beamWidth:16});
  assert.equal(result.pattern.id,testCase.pattern,`${testCase.id}: 局型棋谱识别错误`);
  assert(result.solutions.length>=1,`${testCase.id}: 没有模块方案`);
  const best=result.solutions[0];
  assert(best.evaluation.qualityPass,`${testCase.id}: 首选方案未通过模块首轮验收`);
  assert(best.modules.some(module=>module.type==='sleep'),`${testCase.id}: 缺少睡眠组`);
  assert(best.modules.some(module=>module.type==='storage'),`${testCase.id}: 缺少收纳组`);
  for(const type of testCase.expectModules||[])assert(best.modules.some(module=>module.type===type),`${testCase.id}: 可用空间充足却缺少 ${type} 模块`);
  if(testCase.expectAnyModules)assert(testCase.expectAnyModules.some(type=>best.modules.some(module=>module.type===type)),`${testCase.id}: 可用空间充足却没有工作/休闲扩展模块`);
  assert(best.evaluation.flow.connectedRatio>=.82,`${testCase.id}: 通行连通率不足`);
  assert.equal(best.evaluation.flow.accessRatio,1,`${testCase.id}: 存在不可达模块使用区`);
  assert(result.stats.beamWidth<=16,`${testCase.id}: Beam 超过 16`);
  assert(result.stats.nodes<=testCase.maxNodes,`${testCase.id}: 节点 ${result.stats.nodes} 超过预算 ${testCase.maxNodes}`);
  assert(result.stats.timeMs<100,`${testCase.id}: 搜索 ${result.stats.timeMs.toFixed(1)}ms 超过 100ms`);
  assert(result.stats.totalTimeUs>0,`${testCase.id}: 没有记录总微秒耗时`);
  assert(result.stats.rounds.every(round=>round.timeUs>0),`${testCase.id}: 存在未记录耗时的搜索步骤`);
  rows.push({case:testCase.id,room:`${testCase.width}×${testCase.depth}`,pattern:result.pattern.label,nodes:result.stats.nodes,rawActions:result.stats.rawActions,timeMs:+result.stats.timeMs.toFixed(2),modules:best.modules.map(module=>`${module.type}:${module.size}`).join(',')});
}

const relationRoom=engine.makeRoom(4,5),relationPattern={relations:[{id:'media-view-target',type:'facing-any',subject:'media',targets:['sleep','lounge'],alignmentTolerance:1.2,minDistance:1.4,maxDistance:5.8}]};
const relationModule=(id,type,wallIndex,x,y,itemType)=>({id,type,wallIndex,items:[{moduleId:id,type:itemType,x,y,w:.4,d:.4}],zones:[]});
const media=relationModule('media','media',0,2,.2,'tvbench'),alignedBed=relationModule('bed','sleep',2,2,4,'bed'),offsetBed=relationModule('bed-offset','sleep',2,2.65,4,'bed');
const alignedRelation=engine.evaluateRelations({modules:[media,alignedBed],items:[...media.items,...alignedBed.items]},relationRoom,relationPattern).details[0];
const offsetRelation=engine.evaluateRelations({modules:[media,offsetBed],items:[...media.items,...offsetBed.items]},relationRoom,relationPattern).details[0];
assert(alignedRelation.score>offsetRelation.score,'完全正对没有获得更高关系分');
assert(offsetRelation.score>.7,'轻微偏移被错误地当成不可接受关系');
const perpendicularMedia=relationModule('media-side','media',0,.2,.2,'tvbench'),perpendicularBed=relationModule('bed-side','sleep',3,.2,2.5,'bed'),perpendicularRelation=engine.evaluateRelations({modules:[perpendicularMedia,perpendicularBed],items:[...perpendicularMedia.items,...perpendicularBed.items]},relationRoom,relationPattern).details[0];
assert(perpendicularRelation.score<.05,'床尾与电视方向垂直却仍获得正对分');
assert(!perpendicularRelation.active,'垂直的床—电视关系不应显示为正对');
const farBed=relationModule('bed-far','sleep',2,.45,4,'bed'),alignedLounge=relationModule('lounge','lounge',2,2,4,'loveseat'),alternativeRelation=engine.evaluateRelations({modules:[media,farBed,alignedLounge],items:[...media.items,...farBed.items,...alignedLounge.items]},relationRoom,relationPattern).details[0];
assert.equal(alternativeRelation.targetType,'lounge','媒体组没有在床与休闲组之间选择关系更好的目标');
assert(alternativeRelation.score>.9,'替代关系目标没有形成高质量正对关系');

const privacyPattern={relations:[{id:'sleep-door-privacy',type:'avoid-facing-opening',subject:'sleep',openingKind:'door',alignmentTolerance:.8,maxDistance:6}]},doorEntry=relationRoom.doors[0].entry,directSleep=relationModule('direct-sleep','sleep',0,doorEntry.x,1,'bed'),offsetSleep=relationModule('offset-sleep','sleep',0,3.35,1,'bed');
const directPrivacy=engine.evaluateRelations({modules:[directSleep],items:directSleep.items},relationRoom,privacyPattern).details[0],offsetPrivacy=engine.evaluateRelations({modules:[offsetSleep],items:offsetSleep.items},relationRoom,privacyPattern).details[0];
assert(directPrivacy.score<offsetPrivacy.score,'床尾直对门没有获得更低隐私分');
assert(directPrivacy.score>0,'床正对门被错误处理成硬性非法');

const hotelSearch=engine.search(engine.makeRoom(3.1,5.6),{beamWidth:16}),hotelRelation=hotelSearch.solutions[0].evaluation.relations.details[0];
assert(hotelSearch.solutions.some(solution=>solution.evaluation.relations.details.some(relation=>relation.id==='media-view-target'&&relation.active)),'狭长卧室候选集没有任何成立的媒体观看关系');
assert(['sleep','lounge'].includes(hotelRelation.targetType),'媒体观看关系指向了无效模块');

const opportunityRoom=engine.makeRoom(3.6,3.8),opportunityResult=engine.search(opportunityRoom,{beamWidth:16}),opportunityPattern=opportunityResult.pattern,opportunityModules=opportunityResult.solutions[0].modules.filter(module=>module.type!=='work'),opportunityState={modules:opportunityModules,items:opportunityModules.flatMap(module=>module.items),zones:opportunityModules.flatMap(module=>module.zones)},opportunityAudit=engine.opportunityMetrics(opportunityState,opportunityRoom,opportunityPattern);
assert(opportunityAudit.items.some(item=>item.type==='work'),'机会裁判没有发现被人为移除后仍可合法落下的工作组');
assert(opportunityAudit.penalty>0,'可合法追加的正式模块没有产生机会损失');

const portfolio=engine.searchPortfolio(engine.makeRoom(3.6,3.8),{beamWidth:16,maxPatterns:2,timeBudgetMs:240});
assert.equal(portfolio.stats.portfolioRuns.length,2,'标准卧室没有让适配度接近的两条棋谱参赛');
assert(portfolio.solutions.every(solution=>solution.pattern&&solution.searchStats),'组合决赛方案缺少来源棋谱或本棋谱搜索统计');
assert(portfolio.solutions[0].portfolioScore>=portfolio.solutions.at(-1).portfolioScore,'多棋谱决赛没有按组合分排序');
assert(portfolio.stats.timeMs<240,'多棋谱竞赛超过总时间预算');
const bedInterface=engine.moduleInterface(alignedBed,relationRoom),workInterface=engine.moduleInterface(relationModule('desk','work',0,2,.2,'desk'),relationRoom);
assert(bedInterface.facing.x===relationRoom.walls[alignedBed.wallIndex].normal.x&&bedInterface.facing.y===relationRoom.walls[alignedBed.wallIndex].normal.y,'床尾方向没有指向离开靠墙面的室内方向');
assert(workInterface.facing.x===relationRoom.walls[0].normal.x&&workInterface.facing.y===relationRoom.walls[0].normal.y,'书桌使用面没有朝向房间内部');
assert(workInterface.relationFacing.x===-relationRoom.walls[0].normal.x&&workInterface.relationFacing.y===-relationRoom.walls[0].normal.y,'工作位关系评分的坐姿视线没有指向桌面/靠墙方向');
const lockRoom=engine.makeRoom(3.6,3.8),lockInitial=engine.search(lockRoom,{beamWidth:16}),lockedSleep=lockInitial.solutions[0].modules.find(module=>module.type==='sleep'),lockReplan=engine.search(lockRoom,{beamWidth:16,patternId:lockInitial.pattern.id,lockedModules:[lockedSleep]}),lockSleepAfter=lockReplan.solutions[0].modules.find(module=>module.type==='sleep');
assert(lockSleepAfter.locked,'局部重排没有保留模块锁定标记');
assert.equal(moduleKeyForTest(lockSleepAfter),moduleKeyForTest(lockedSleep),'局部重排改变了已锁定睡眠组的位置或规格');
assert(lockReplan.solutions[0].trace.some(move=>move.locked),'局部重排棋谱没有记录锁定落子');

function moduleKeyForTest(module){return `${module.type}|${module.wallIndex}|${Number(module.t||0).toFixed(3)}|${module.size}`;}

const html=fs.readFileSync(path.join(__dirname,'..','bedroom-space-chess-V3_upgrade.html'),'utf8');
for(const asset of ['data/bedroom-patterns.js','assets/recognized-room-adapter.js','assets/bedroom-room-topology.js','assets/bedroom-module-engine.js','assets/bedroom-upgrade-ui.js','assets/bedroom-upgrade.css']){
  assert(html.includes(asset),`升级页面缺少资源引用：${asset}`);
  assert(fs.existsSync(path.join(__dirname,'..',asset)),`升级资源不存在：${asset}`);
}
assert(html.includes('id="chessTree"'),'升级页面缺少压缩棋谱树容器');
assert(html.includes('id="showDirections"')&&html.includes('id="showRelations"'),'升级页面缺少方向或关系检查开关');

const sample=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','samples','case_1_145.json'),'utf8'));
const recognized=recognizedAdapter.prepareBedrooms(sample,145);
assert(recognized.length>=3,'旧版识别 JSON 未解析出预期卧室');
assert(recognized.some(room=>room.supported),'旧版识别 JSON 中没有可进入当前模块棋的卧室');
assert(recognized.some(room=>room.supported&&room.rectangularity<.9),'旧版识别 JSON 中的明显异形卧室未开放');
for(const room of recognized.filter(row=>row.supported)){
  const compiled=engine.makePolygonRoom(room),result=engine.search(compiled,{beamWidth:16});
  assert.equal(compiled.polygon.length,room.polygon.length,`${room.label}: 编译时丢失异形角点`);
  assert.equal(compiled.openings.length,room.openings.length,`${room.label}: 编译时丢失真实门窗`);
  assert(result.solutions.length,`${room.label}: 识别房间没有模块方案`);
  for(const item of result.solutions[0].items)assert(require('../assets/bedroom-room-topology.js').rectInsidePolygon(item,compiled.polygon),`${room.label}: 家具落在多边形外`);
}

const semanticSample=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','samples','demo-family-100.json'),'utf8')),semanticRoom=recognizedAdapter.prepareBedrooms(semanticSample,100).find(room=>room.label==='卧室 1'),semanticBest=engine.search(engine.makePolygonRoom(semanticRoom),{beamWidth:16}).solutions[0],semanticSleep=semanticBest.modules.find(module=>module.type==='sleep');
assert.equal(semanticSleep.size,'S2','17.8㎡ 异形卧室空间允许时没有补全第二个床头柜');
assert.equal(semanticSleep.items.filter(item=>item.type==='night').length,2,'睡眠组 S2 未展开为双床头柜');
assert(semanticBest.evaluation.cabinetWallShadow<.2,'首选方案的高柜使用区仍大量封堵相邻空墙');
const semanticInfill=semanticBest.modules.find(module=>module.type==='infill'),semanticInfillWall=engine.makePolygonRoom(semanticRoom).walls[semanticInfill.wallIndex];
assert(semanticInfillWall.normal.x>.9,'L 形凹角定制柜没有改为依附竖墙、向右开启');
assert(semanticBest.evaluation.wallShadowPenalty<1,'L 形凹角柜仍产生过大封墙罚分');
const workMediaAvoid=semanticBest.evaluation.relations.details.find(relation=>relation.id==='work-media-axis');
assert(workMediaAvoid.score>.8,'工作组与媒体观看轴冲突过强');

const oversized=engine.search(engine.makeRoom(8,8),{beamWidth:16}),oversizedBest=oversized.solutions[0];
assert(oversizedBest.evaluation.capacityTarget>=9,'超大卧室没有提高预期模块容量');
assert(oversizedBest.modules.filter(module=>module.type==='infill').length>=3,'超大卧室没有执行定制柜残局填充');
assert(oversizedBest.evaluation.wallSpace.largestBay?.length>=3,'超大卧室填缝后仍应识别出待分区的大块余量');
assert(!oversizedBest.evaluation.qualityPass,'低利用率超大卧室不应通过首轮验收');
assert(oversizedBest.evaluation.total<90,'只有填缝柜、尚未功能分区的超大卧室全局分仍然虚高');
for(const [type,diagnostic] of Object.entries(oversized.stats.moduleDiagnostics)){
  assert(diagnostic.raw>0,`${type}: 缺少原始候选统计`);
  assert(diagnostic.legal>=diagnostic.sent,`${type}: 候选诊断数据异常`);
}

const globalConfig=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','server_config','furniture-config-current.json'),'utf8')),capability=engine.configureFurniture(globalConfig),configuredBed=engine.template('sleep','L'),configuredStorage=engine.template('storage','L'),configuredMedia=engine.template('media','L');
assert(capability.count>=10,'旧版全局家具配置没有编译出足够的卧室家具能力');
assert.equal(configuredBed.items.find(item=>item.type==='bed').w,1.8,'睡眠组没有采用全局配置的大床模数');
assert.equal(configuredStorage.items.find(item=>item.type==='wardrobe').w,2.2,'收纳组没有采用全局配置中最接近 L 的衣柜变例');
assert.equal(configuredMedia.items.find(item=>item.type==='tvbench').w,1.5,'媒体组没有采用全局配置中最接近 L 的电视柜变例');

console.table(rows);
console.log('BEDROOM_MODULE_UPGRADE_OK');
