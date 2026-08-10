(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.RoomChessConfigContract=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const PROGRAM_IDS=['bedroom','living'];
  const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const finite=value=>Number.isFinite(Number(value));
  const at=(value,path)=>path.split('.').reduce((current,key)=>current?.[key],value);

  function validateGlobalConfig(config){
    const errors=[];
    const requireObject=(path)=>{const value=at(config,path);if(!isObject(value))errors.push(`${path} 必须是对象`);return value};
    const requireArray=(path,{nonEmpty=false}={})=>{const value=at(config,path);if(!Array.isArray(value)||(nonEmpty&&!value.length))errors.push(`${path} 必须是${nonEmpty?'非空':''}数组`);return Array.isArray(value)?value:[]};
    const requireFinite=(path,{min=-Infinity,max=Infinity}={})=>{const value=at(config,path);if(!finite(value)||Number(value)<min||Number(value)>max)errors.push(`${path} 必须是 ${min===-Infinity?'':`>= ${min} `}${max===Infinity?'':`且 <= ${max}`}的有限数字`);return Number(value)};
    const requireBoolean=path=>{if(typeof at(config,path)!=='boolean')errors.push(`${path} 必须是布尔值`)};

    if(!isObject(config))return ['配置根节点必须是对象'];
    if(!Number.isInteger(Number(config.schemaVersion))||Number(config.schemaVersion)<1)errors.push('schemaVersion 必须是正整数');
    requireObject('designQualityRules');
    const weights=requireObject('designQualityRules.weights')||{};
    ['function','ground','wall','relation','circulation','composition','activation'].forEach(key=>requireFinite(`designQualityRules.weights.${key}`,{min:0,max:1}));
    if(Object.values(weights).filter(finite).reduce((sum,value)=>sum+Number(value),0)<=0)errors.push('designQualityRules.weights 总和必须大于 0');
    requireObject('designQualityRules.floor');
    requireObject('designQualityRules.wall');
    requireObject('designQualityRules.gates');

    requireObject('layoutConstraints');
    const circulation=requireObject('layoutConstraints.circulation')||{};
    requireBoolean('layoutConstraints.circulation.requireZeroIslands');
    if(circulation.requireZeroIslands!==true)errors.push('layoutConstraints.circulation.requireZeroIslands 是产品安全不变量，必须为 true');
    const levels=requireArray('layoutConstraints.circulation.levels',{nonEmpty:true});
    const levelIds=new Set();
    for(const [index,row] of levels.entries()){
      if(!isObject(row)||!String(row.id||'').trim())errors.push(`layoutConstraints.circulation.levels[${index}] 缺少 id`);
      else if(levelIds.has(row.id))errors.push(`通行级别 id 重复：${row.id}`);else levelIds.add(row.id);
      if(!finite(row?.radius)||Number(row.radius)<=0)errors.push(`layoutConstraints.circulation.levels[${index}].radius 必须大于 0`);
    }
    if(!levelIds.has(circulation.hardLevelId))errors.push('layoutConstraints.circulation.hardLevelId 未引用有效通行级别');
    const hardLevel=levels.find(row=>row?.id===circulation.hardLevelId);
    if(hardLevel&&Number(hardLevel.radius)*2<.5)errors.push('硬通行级别直径不得低于 0.50m');
    const searchChecks=requireObject('layoutConstraints.circulation.searchChecks')||{};
    for(const key of ['guideTypes','hardPruneTypes','hardPruneLastSlotTypes']){
      if(!isObject(searchChecks[key]))errors.push(`layoutConstraints.circulation.searchChecks.${key} 必须是对象`);
      for(const programId of PROGRAM_IDS)if(!Array.isArray(searchChecks[key]?.[programId]))errors.push(`layoutConstraints.circulation.searchChecks.${key}.${programId} 必须是数组`);
    }

    requireObject('layoutConstraints.densityModes');
    const rich=requireObject('layoutConstraints.densityModes.rich')||{};
    if(rich.enabled!==true)errors.push('当前产品只开放丰富模式，layoutConstraints.densityModes.rich.enabled 必须为 true');
    requireObject('layoutConstraints.inventory');
    requireObject('layoutConstraints.inventory.roomAreaModules');
    requireObject('layoutConstraints.inventory.richMinimum');
    requireObject('layoutConstraints.qualityPass');
    requireArray('layoutConstraints.relationPolicies');
    requireObject('layoutConstraints.designGrammar');
    requireObject('layoutConstraints.layoutIntelligence');
    const stepScore=requireObject('layoutConstraints.layoutIntelligence.stepScore')||{};
    requireObject('layoutConstraints.layoutIntelligence.stepScore.functionalGroup');
    requireObject('layoutConstraints.layoutIntelligence.stepScore.partialField');
    const globalScore=requireObject('layoutConstraints.layoutIntelligence.globalScore')||{};
    for(const key of ['functionWeights','compositionWeights','groundWeights','groupSpread'])requireObject(`layoutConstraints.layoutIntelligence.globalScore.${key}`);
    const functionalGroups=requireObject('layoutConstraints.layoutIntelligence.functionalGroups')||{};
    const activityZones=requireObject('layoutConstraints.layoutIntelligence.activityZones')||{};
    requireObject('layoutConstraints.search');
    requireObject('layoutConstraints.search.auto');
    requireFinite('layoutConstraints.search.auto.largeDiningBeamWidth',{min:24,max:240});
    requireObject('layoutConstraints.postLayout');
    const longBedroomWall=requireObject('layoutConstraints.qualityPass.longBedroomWall')||{};
    if(!Array.isArray(longBedroomWall.satisfyWithTypes)||!longBedroomWall.satisfyWithTypes.length)errors.push('layoutConstraints.qualityPass.longBedroomWall.satisfyWithTypes 必须是非空数组');
    for(const programId of PROGRAM_IDS){
      requireArray(`layoutConstraints.inventory.roomAreaModules.${programId}`,{nonEmpty:true});
      requireArray(`layoutConstraints.inventory.richMinimum.${programId}`,{nonEmpty:true});
      requireObject(`layoutConstraints.designGrammar.${programId}`);
      const groups=requireArray(`layoutConstraints.layoutIntelligence.functionalGroups.${programId}`,{nonEmpty:true});
      const activity=activityZones[programId];
      if(!isObject(activity))errors.push(`layoutConstraints.layoutIntelligence.activityZones.${programId} 必须是对象`);
      else {
        if(typeof activity.enabled!=='boolean')errors.push(`layoutConstraints.layoutIntelligence.activityZones.${programId}.enabled 必须是布尔值`);
        if(!finite(activity.minRoomArea)||Number(activity.minRoomArea)<0)errors.push(`layoutConstraints.layoutIntelligence.activityZones.${programId}.minRoomArea 必须是非负数`);
        if(!Array.isArray(activity.targetByArea)||!activity.targetByArea.length)errors.push(`layoutConstraints.layoutIntelligence.activityZones.${programId}.targetByArea 必须是非空数组`);
        if(!Array.isArray(activity.sizeTiers)||!activity.sizeTiers.length)errors.push(`layoutConstraints.layoutIntelligence.activityZones.${programId}.sizeTiers 必须是非空数组`);
      }
      const groupIds=new Set();
      for(const [index,group] of groups.entries()){
        const prefix=`layoutConstraints.layoutIntelligence.functionalGroups.${programId}[${index}]`;
        if(!String(group?.id||'').trim())errors.push(`${prefix} 缺少 id`);
        else if(groupIds.has(group.id))errors.push(`${programId} 功能组 id 重复：${group.id}`);else groupIds.add(group.id);
        if(!String(group?.anchor||'').trim())errors.push(`${prefix} 缺少 anchor`);
        if(!finite(group?.weight)||Number(group.weight)<=0)errors.push(`${prefix}.weight 必须大于 0`);
        if(!Array.isArray(group?.activeModules)||!group.activeModules.length)errors.push(`${prefix}.activeModules 必须是非空数组`);
        const members=Array.isArray(group?.members)?group.members:[];if(!members.length)errors.push(`${prefix}.members 必须是非空数组`);
        for(const [memberIndex,member] of members.entries()){
          const memberPrefix=`${prefix}.members[${memberIndex}]`;
          if(!String(member?.typeId||'').trim())errors.push(`${memberPrefix} 缺少 typeId`);
          if(!finite(member?.target)||Number(member.target)<=0)errors.push(`${memberPrefix}.target 必须大于 0`);
          if(!finite(member?.weight)||Number(member.weight)<=0)errors.push(`${memberPrefix}.weight 必须大于 0`);
          if(typeof member?.required!=='boolean')errors.push(`${memberPrefix}.required 必须是布尔值`);
          if(member?.targetByArea!=null){
            if(!Array.isArray(member.targetByArea)||!member.targetByArea.length)errors.push(`${memberPrefix}.targetByArea 必须是非空数组`);
            else for(const [targetIndex,row] of member.targetByArea.entries())if(!finite(row?.minArea)||Number(row.minArea)<0||!finite(row?.value)||Number(row.value)<0)errors.push(`${memberPrefix}.targetByArea[${targetIndex}] 必须包含非负 minArea/value`);
          }
        }
        const challenges=Array.isArray(group?.inventoryChallenges)?group.inventoryChallenges:[];
        for(const [challengeIndex,challenge] of challenges.entries()){
          const challengePrefix=`${prefix}.inventoryChallenges[${challengeIndex}]`;
          if(!String(challenge?.id||'').trim())errors.push(`${challengePrefix} 缺少 id`);
          if(!finite(challenge?.richPriority)||Number(challenge.richPriority)<0)errors.push(`${challengePrefix}.richPriority 必须是非负数`);
          const minArea=Number(challenge?.minArea??0),maxArea=Number(challenge?.maxArea??Infinity),minAspect=Number(challenge?.minAspect??0),maxAspect=Number(challenge?.maxAspect??Infinity);
          if(minArea<0||maxArea<minArea)errors.push(`${challengePrefix} 面积范围无效`);
          if(minAspect<0||maxAspect<minAspect)errors.push(`${challengePrefix} 长宽比范围无效`);
          if(!isObject(challenge?.counts))errors.push(`${challengePrefix}.counts 必须是对象`);
          else for(const [typeId,count] of Object.entries(challenge.counts))if(!String(typeId).trim()||!Number.isInteger(Number(count))||Number(count)<0)errors.push(`${challengePrefix}.counts.${typeId} 必须是非负整数`);
        }
      }
    }

    const roomTypes=requireArray('roomTypes',{nonEmpty:true});
    const enabledPrograms=new Set(roomTypes.filter(row=>row?.engineEnabled!==false).map(row=>row?.id));
    for(const programId of PROGRAM_IDS)if(!enabledPrograms.has(programId))errors.push(`roomTypes 缺少已启用的 ${programId}`);
    const library=requireArray('furnitureLibrary',{nonEmpty:true});
    const libraryIds=new Set();
    for(const [index,row] of library.entries()){
      const id=String(row?.id||'').trim();
      if(!id)errors.push(`furnitureLibrary[${index}] 缺少 id`);
      else if(libraryIds.has(id))errors.push(`furnitureLibrary id 重复：${id}`);else libraryIds.add(id);
    }

    const rules=requireArray('furnitureRules',{nonEmpty:true});
    const ruleIdsByProgram=Object.fromEntries(PROGRAM_IDS.map(id=>[id,new Set()]));
    for(const [index,rule] of rules.entries()){
      const prefix=`furnitureRules[${index}]`,id=String(rule?.id||'').trim(),program=String(rule?.program||'');
      if(!PROGRAM_IDS.includes(program))errors.push(`${prefix}.program 必须是 bedroom 或 living`);
      if(!id)errors.push(`${prefix} 缺少 id`);
      else if(ruleIdsByProgram[program]?.has(id))errors.push(`${program} 家具规则 id 重复：${id}`);else ruleIdsByProgram[program]?.add(id);
      if(id&&!libraryIds.has(id))errors.push(`${prefix}.id=${id} 未在 furnitureLibrary 中定义`);
      if(!isObject(rule?.geometry)||!finite(rule.geometry.width)||Number(rule.geometry.width)<=0||!finite(rule.geometry.depth)||Number(rule.geometry.depth)<=0)errors.push(`${prefix}.geometry 必须包含正数 width/depth`);
      for(const [variantIndex,variant] of (Array.isArray(rule?.geometry?.variants)?rule.geometry.variants:[]).entries())if(!finite(variant?.width??variant?.w)||Number(variant.width??variant.w)<=0||!finite(variant?.depth??variant?.d)||Number(variant.depth??variant.d)<=0)errors.push(`${prefix}.geometry.variants[${variantIndex}] 尺寸必须为正数`);
      const min=Number(rule?.quantity?.min),max=Number(rule?.quantity?.max),defaultCount=Number(rule?.preferences?.defaultCount);
      if(!Number.isInteger(min)||min<0||!Number.isInteger(max)||max<min)errors.push(`${prefix}.quantity 必须满足 0 <= min <= max，且均为整数`);
      if(!Number.isInteger(defaultCount)||defaultCount<min||defaultCount>max)errors.push(`${prefix}.preferences.defaultCount 必须位于 min/max 之间`);
      if(!finite(rule?.preferences?.priority)||Number(rule.preferences.priority)<1)errors.push(`${prefix}.preferences.priority 必须 >= 1`);
      if(!finite(rule?.preferences?.weight)||Number(rule.preferences.weight)<0||Number(rule.preferences.weight)>3)errors.push(`${prefix}.preferences.weight 必须在 0–3 之间`);
      if(!isObject(rule?.candidate))errors.push(`${prefix}.candidate 必须是对象`);
      const candidateRows=Array.isArray(rule?.candidate?.rules)?rule.candidate.rules:[rule?.candidate].filter(Boolean);
      if(!candidateRows.length)errors.push(`${prefix}.candidate.rules 至少需要一个候选规则`);
      for(const [candidateIndex,candidate] of candidateRows.entries()){
        const relativeTo=String(candidate?.relativeTo||'').trim();
        if(relativeTo&&!rules.some(other=>(other.program===program||other.program==='shared')&&other.id===relativeTo))errors.push(`${prefix}.candidate.rules[${candidateIndex}].relativeTo=${relativeTo} 未引用同房间家具`);
        const distance=candidate?.distance;
        if(distance&&(!finite(distance.min)||!finite(distance.max)||Number(distance.min)<0||Number(distance.max)<Number(distance.min)))errors.push(`${prefix}.candidate.rules[${candidateIndex}].distance 必须满足 0 <= min <= max`);
        const minArea=Number(candidate?.minArea??0),maxArea=Number(candidate?.maxArea??Infinity);
        if(minArea<0||maxArea<minArea)errors.push(`${prefix}.candidate.rules[${candidateIndex}] 面积范围无效`);
      }
      if(!isObject(rule?.placement))errors.push(`${prefix}.placement 必须是对象`);
      if(!isObject(rule?.service)||!finite(rule.service.depth)||Number(rule.service.depth)<0)errors.push(`${prefix}.service.depth 必须是非负数`);
      if(typeof rule?.service?.hard!=='boolean')errors.push(`${prefix}.service.hard 必须是布尔值`);
      if(typeof rule?.service?.sharedCirculation!=='boolean')errors.push(`${prefix}.service.sharedCirculation 必须是布尔值`);
      if(rule?.service?.blocksFurniture!=null&&typeof rule.service.blocksFurniture!=='boolean')errors.push(`${prefix}.service.blocksFurniture 必须是布尔值`);
    }
    for(const programId of PROGRAM_IDS)if(!rules.some(rule=>rule.program===programId&&Number(rule.quantity?.min)>0))errors.push(`${programId} 至少需要一件 quantity.min > 0 的核心家具`);

    const assignments=requireObject('roomAssignments')||{};
    const settings=requireObject('roomSettings')||{};
    for(const programId of PROGRAM_IDS){
      const assigned=Array.isArray(assignments[programId])?assignments[programId]:[];
      if(!assigned.length)errors.push(`roomAssignments.${programId} 必须是非空数组`);
      if(new Set(assigned).size!==assigned.length)errors.push(`roomAssignments.${programId} 存在重复家具`);
      for(const id of assigned)if(!libraryIds.has(id))errors.push(`roomAssignments.${programId} 引用了未定义家具 ${id}`);
      if(!isObject(settings[programId]))errors.push(`roomSettings.${programId} 必须是对象`);
      for(const id of Object.keys(settings[programId]||{}))if(!assigned.includes(id))errors.push(`roomSettings.${programId}.${id} 未出现在房间落子清单`);
      for(const key of ['guideTypes','hardPruneTypes','hardPruneLastSlotTypes'])for(const id of searchChecks[key]?.[programId]||[])if(!ruleIdsByProgram[programId].has(id))errors.push(`searchChecks.${key}.${programId} 引用了未编译家具 ${id}`);
    }
    return [...new Set(errors)];
  }

  function assertGlobalConfig(config){
    const errors=validateGlobalConfig(config);
    if(errors.length)throw new Error(`全局配置契约失败：\n- ${errors.join('\n- ')}`);
    return true;
  }

  return {PROGRAM_IDS:[...PROGRAM_IDS],validateGlobalConfig,assertGlobalConfig};
});
