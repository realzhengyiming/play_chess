  /* ROOM_CHESS_ENGINE_START */
  (async() => {
    'use strict';

    const EPS = 1e-7;
    const SOFA_PRESETS = {
      loveseat:{label:'双人沙发',w:1.80,d:.85,shape:'box'},
      three:{label:'三人沙发',w:2.20,d:.90,shape:'box'},
      four:{label:'四人沙发',w:2.80,d:.95,shape:'box'},
      lleft:{label:'左贵妃 L 形沙发',w:2.80,d:1.65,shape:'l-left'},
      lright:{label:'右贵妃 L 形沙发',w:2.80,d:1.65,shape:'l-right'}
    };
    function configuredSofaVariants() {
      const type=PROGRAMS.living.types.find(item=>item.id==='sofa'),variants=type?.geometryVariants||[];
      return variants.length?variants:[{id:'box',label:type?.label||'沙发',w:CONFIGS.living.dimensions.sofa.w,d:CONFIGS.living.dimensions.sofa.d,shape:type?.shape||'box'}];
    }
    function configuredSofaVariant(selection) {
      const aliases={lleft:'l-left',lright:'l-right',loveseat:'box',three:'box',four:'box'},id=aliases[selection]||selection,variants=configuredSofaVariants();
      return variants.find(variant=>variant.id===id)||variants.find(variant=>variant.shape===id)||variants.find(variant=>variant.shape==='box')||variants[0];
    }

    const PROGRAMS = {
      bedroom: {
        id:'bedroom', title:'卧室空间棋 AI', defaultWidth:3.6, defaultDepth:3.8,
        primaryIds:['bed','desk'], primaryLabels:['床墙','桌墙'],
        // 卧室必须先确定睡眠核心，再围绕床生成床头、收纳和工作组。
        // 展示/休闲类只能排在核心功能组之后，填缝柜永远收尾。
        // 先落不可替代的睡眠/收纳/工作骨架，再扩展会客模块；否则超大卧室会
        // 先用沙发占满优质墙段，最后只剩“有衣柜但柜门不可达”的假完整方案。
        order:['bed','night','wardrobe','desk','chair','tvbench','bench','bedroomLoveseat','bedroomTeaTable','chest','shelf','bedroomDisplay','lounge','vanity','vanityStool','bedroomInfillCabinet'],
        types:[
          {id:'bed',label:'床',role:'睡眠核心 · 自动试规格',category:'核心家具',color:'#2f6da0',minCount:1,maxCount:2,accessTarget:true,stablePrimaryId:true},
          {id:'wardrobe',label:'衣柜',role:'衣物收纳',category:'核心家具',color:'#9b6a46',minCount:1,maxCount:1,accessTarget:true},
          {id:'desk',label:'书桌',role:'工作学习',category:'工作与梳妆',color:'#2f8a78',minCount:0,maxCount:1,accessTarget:true},
          {id:'vanity',label:'梳妆台',role:'梳妆',category:'工作与梳妆',color:'#a66f86',minCount:0,maxCount:1,accessTarget:true},
          {id:'chest',label:'斗柜',role:'叠放收纳',category:'收纳家具',color:'#a47b58',minCount:0,maxCount:2,accessTarget:true},
          {id:'shelf',label:'书柜',role:'书物收纳',category:'收纳家具',color:'#6d796f',minCount:0,maxCount:1,accessTarget:true},
          {id:'tvbench',label:'卧室电视柜',role:'视听收纳',category:'收纳家具',color:'#505f69',minCount:0,maxCount:1,accessTarget:true},
          {id:'bench',label:'床尾凳',role:'床尾辅助',category:'床组与座椅',color:'#6686a2',minCount:0,maxCount:1,accessTarget:false},
          {id:'night',label:'床头柜',role:'床组',category:'床组与座椅',color:'#6a8db2',minCount:0,maxCount:2,accessTarget:false},
          {id:'chair',label:'工作椅',role:'工作组',category:'床组与座椅',color:'#59a391',minCount:0,maxCount:1,accessTarget:false},
          {id:'vanityStool',label:'梳妆凳',role:'梳妆组',category:'床组与座椅',color:'#b78aa0',minCount:0,maxCount:1,accessTarget:false},
          {id:'lounge',label:'休闲椅',role:'阅读休憩',category:'床组与座椅',color:'#6b9888',minCount:0,maxCount:2,accessTarget:false},
          {id:'bedroomLoveseat',label:'卧室小沙发',role:'小型会客区',category:'休闲会客',color:'#c98272',minCount:0,maxCount:1,accessTarget:false},
          {id:'bedroomTeaTable',label:'卧室圆几',role:'茶歇中心',category:'休闲会客',color:'#b78b55',minCount:0,maxCount:1,accessTarget:false},
          {id:'bedroomDisplay',label:'卧室展示柜',role:'空墙陈列与浅收纳',category:'沿墙浅柜',color:'#738276',minCount:0,maxCount:2,accessTarget:true},
          {id:'bedroomInfillCabinet',label:'卧室定制填缝柜',role:'末轮空墙补齐',category:'拓展填缝定制柜',color:'#526f68',minCount:0,maxCount:4,accessTarget:true}
        ]
      },
      living: {
        id:'living', title:'客厅空间棋 AI', defaultWidth:4.8, defaultDepth:4.2,
        primaryIds:['sofa','tv'], primaryLabels:['沙发墙','电视墙'],
        order:['sofa','tv','coffee','diningTable','diningChair','arm','side','ottoman','sideboard','bookcase','display','console','floorLamp','plant','infillCabinet'],
        types:[
          {id:'sofa',label:'沙发',role:'会客核心',category:'会客核心',color:'#be633e',minCount:1,maxCount:1,accessTarget:true,geometryVariants:[{id:'box',label:'普通三人沙发',w:2.2,d:.9,shape:'box'},{id:'l-left',label:'左贵妃 L 形沙发',w:2.8,d:1.65,shape:'l-left'},{id:'l-right',label:'右贵妃 L 形沙发',w:2.8,d:1.65,shape:'l-right'}]},
          {id:'tv',label:'电视柜',role:'视听中心',category:'会客核心',color:'#34424d',minCount:1,maxCount:1,accessTarget:true},
          {id:'coffee',label:'茶几',role:'会客中心',category:'会客核心',color:'#bd9252',minCount:0,maxCount:1,accessTarget:false},
          {id:'diningTable',label:'餐桌',role:'客餐厅用餐',category:'客餐家具',color:'#8f704d',minCount:0,maxCount:1,accessTarget:true},
          {id:'diningChair',label:'餐椅',role:'餐桌组',category:'客餐家具',color:'#b08a64',minCount:0,maxCount:6,accessTarget:false},
          {id:'sideboard',label:'餐边柜',role:'餐储与台面',category:'沿墙柜体',color:'#8b6a4e',minCount:0,maxCount:2,accessTarget:true},
          {id:'bookcase',label:'书柜 / 矮柜',role:'沿墙收纳',category:'沿墙柜体',color:'#7b6657',minCount:0,maxCount:2,accessTarget:true},
          {id:'display',label:'展示柜',role:'陈列收纳',category:'沿墙柜体',color:'#65736b',minCount:0,maxCount:2,accessTarget:true},
          {id:'console',label:'玄关 / 沙发边柜',role:'窄型台面',category:'沿墙柜体',color:'#927a69',minCount:0,maxCount:1,accessTarget:true},
          {id:'arm',label:'单人沙发',role:'围合座位',category:'座椅与小件',color:'#d7895d',minCount:0,maxCount:4,accessTarget:false},
          {id:'ottoman',label:'脚凳',role:'弹性座位',category:'座椅与小件',color:'#aa7d67',minCount:0,maxCount:2,accessTarget:false},
          {id:'side',label:'边几',role:'沙发组',category:'座椅与小件',color:'#79927e',minCount:0,maxCount:2,accessTarget:false},
          {id:'floorLamp',label:'落地灯',role:'座位照明',category:'座椅与小件',color:'#c5a968',minCount:0,maxCount:2,accessTarget:false},
          {id:'plant',label:'绿植',role:'角落软装',category:'座椅与小件',color:'#5f8b68',minCount:0,maxCount:3,accessTarget:false},
          {id:'infillCabinet',label:'拓展填缝定制柜',role:'末轮墙面补齐',category:'拓展填缝定制柜',color:'#526f68',minCount:0,maxCount:5,accessTarget:true}
        ]
      }
    };

    // 这里只保存运行态容器；尺寸、数量和家具类型必须由服务端当前配置填入。
    const CONFIGS = {bedroom:{dimensions:{},counts:{}},living:{dimensions:{},counts:{}}};
    const DEFAULT_CONFIGS=JSON.parse(JSON.stringify(CONFIGS));
    // 浏览器不再持久化配置；家具规则统一从 FastAPI 的单例全局配置读取。
    const ENABLE_LOCAL_CONFIG_PERSISTENCE=false;
    const GLOBAL_CONFIG_API='/api/furniture-config';
    let serverConfigProfiles={current:null};
    const LOCAL_CONFIG_KEY='room-chess-user-config-v1';

    // 离散“可变棋”规格库。自动模式会把规格和坐标、方向放在同一次搜索中；
    // 手动模式关闭后仍严格使用右侧输入的固定尺寸。
    const VARIABLE_SIZE_PRESETS = {bedroom:{},living:{}};
    let variableSizeSearch=true;
    let DENSITY_MODES={},DESIGN_QUALITY_RULES=null,LAYOUT_CONSTRAINTS=null,FLOW_RADII=[],ROOM_AREA_MODULES={bedroom:[],living:[]};
    let FLOW_GUIDE_TYPES={bedroom:new Set(),living:new Set()},FLOW_HARD_PRUNE_TYPES={bedroom:new Set(),living:new Set()},FLOW_HARD_PRUNE_LAST_SLOT_TYPES={bedroom:new Set(),living:new Set()};
    function mergeQualityRules(base,patch){
      const output={...base};
      for(const [key,value] of Object.entries(patch||{}))output[key]=value&&typeof value==='object'&&!Array.isArray(value)
        ?mergeQualityRules(base?.[key]||{},value):value;
      return output;
    }
    function applyDesignQualityRules(value){if(!value||typeof value!=='object')return false;DESIGN_QUALITY_RULES=JSON.parse(JSON.stringify(value));return true;}
    function validateLayoutConstraints(value){
      const errors=[];
      if(!value||typeof value!=='object')errors.push('缺少 layoutConstraints');
      const levels=value?.circulation?.levels;
      if(!Array.isArray(levels)||!levels.length||levels.some(row=>!row?.id||!(Number(row.radius)>0)))errors.push('circulation.levels 必须包含正数 radius');
      if(value?.circulation?.requireZeroIslands!==true)errors.push('circulation.requireZeroIslands 必须为 true');
      if(!Array.isArray(value?.relationPolicies))errors.push('缺少 relationPolicies');
      if(!value?.designGrammar?.bedroom||!value?.designGrammar?.living)errors.push('缺少 designGrammar.bedroom / living');
      for(const key of ['guideTypes','hardPruneTypes','hardPruneLastSlotTypes'])for(const programId of ['bedroom','living']){
        if(!Array.isArray(value?.circulation?.searchChecks?.[key]?.[programId]))errors.push(`缺少 circulation.searchChecks.${key}.${programId}`);
      }
      if(!value?.densityModes?.rich)errors.push('缺少 densityModes.rich');
      if(!(Number(value?.search?.semanticSampling?.wall?.maxUniformPositions)>0))errors.push('search.semanticSampling.wall.maxUniformPositions 必须为正数');
      const longBedroomChallenge=value?.inventory?.longBedroomChallenge;
      if(longBedroomChallenge?.enabled!==true||!(Number(longBedroomChallenge.minArea)>0)||!(Number(longBedroomChallenge.minAspect)>1)||!longBedroomChallenge.counts)errors.push('缺少有效的 inventory.longBedroomChallenge');
      const deskSizePolicy=value?.search?.sizePolicies?.bedroom?.desk;
      if(!deskSizePolicy)errors.push('缺少 search.sizePolicies.bedroom.desk');
      else if(!Array.isArray(deskSizePolicy.targetByArea)||!deskSizePolicy.targetByArea.length||!Array.isArray(deskSizePolicy.searchMaxByArea)||!deskSizePolicy.searchMaxByArea.length||!(Number(deskSizePolicy.repairCandidateLimit)>0))errors.push('书桌模数策略不完整');
      for(const programId of ['bedroom','living']){
        if(!Array.isArray(value?.inventory?.roomAreaModules?.[programId])||!value.inventory.roomAreaModules[programId].length)errors.push(`缺少 inventory.roomAreaModules.${programId}`);
        if(!Array.isArray(value?.inventory?.richMinimum?.[programId])||!value.inventory.richMinimum[programId].length)errors.push(`缺少 inventory.richMinimum.${programId}`);
        if(!value?.postLayout?.wallComplements?.programs?.[programId])errors.push(`缺少 postLayout.wallComplements.programs.${programId}`);
      }
      return errors;
    }
    function applyLayoutConstraints(value){
      const errors=validateLayoutConstraints(value);if(errors.length)throw new Error(`布局约束配置无效：${errors.join('；')}`);
      LAYOUT_CONSTRAINTS=JSON.parse(JSON.stringify(value));
      FLOW_RADII=LAYOUT_CONSTRAINTS.circulation.levels.map(row=>({id:String(row.id),radius:Number(row.radius)}));
      DENSITY_MODES=JSON.parse(JSON.stringify(LAYOUT_CONSTRAINTS.densityModes));
      ROOM_AREA_MODULES=JSON.parse(JSON.stringify(LAYOUT_CONSTRAINTS.inventory.roomAreaModules));
      DESIGN_GRAMMAR=JSON.parse(JSON.stringify(LAYOUT_CONSTRAINTS.designGrammar));
      const checks=LAYOUT_CONSTRAINTS.circulation.searchChecks;
      FLOW_GUIDE_TYPES=Object.fromEntries(['bedroom','living'].map(programId=>[programId,new Set(checks.guideTypes[programId])]));
      FLOW_HARD_PRUNE_TYPES=Object.fromEntries(['bedroom','living'].map(programId=>[programId,new Set(checks.hardPruneTypes[programId])]));
      FLOW_HARD_PRUNE_LAST_SLOT_TYPES=Object.fromEntries(['bedroom','living'].map(programId=>[programId,new Set(checks.hardPruneLastSlotTypes[programId])]));
      return true;
    }
    function applyGlobalConfig(config){
      if(!config||typeof config!=='object')throw new Error('全局配置为空');
      if(!globalThis.RoomChessConfigContract)throw new Error('全局配置契约模块未加载');
      globalThis.RoomChessConfigContract.assertGlobalConfig(config);
      if(!applyDesignQualityRules(config.designQualityRules))throw new Error('缺少 designQualityRules');
      applyLayoutConstraints(config.layoutConstraints);
      const catalog=config.furnitureRules||config.furnitureLibrary;
      if(!applyFurnitureCatalog(catalog))throw new Error('家具配置为空');
      refreshFurniture();
      return true;
    }
    let layoutDensityMode='rich';
    let customCabinetEnabled=true;
    // 引擎只保留通用空默认；所有具体家具约束必须由唯一全局配置提供。
    const FURNITURE_RULES={default:{service:{label:'日常使用区',side:'front',depth:0,spanExtra:0,hard:false,allowBodyTypes:[]}}};

    // 独立“家具偏好配置中心”与本页共享这份浏览器目录。目录存在时，它会成为
    // 卧室/客厅的家具类型、数量范围、默认数量、搜索顺序和候选规则的数据源。
    const FURNITURE_CATALOG_KEY='room-chess-furniture-rule-catalog-v1';
    let FLOOR_SURFACE_RULES={bedroom:[],living:[]};
    function applyFurnitureCatalog(catalog) {
      if(!Array.isArray(catalog)||!catalog.length)return false;
      const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
      const bounded=(value,min,max)=>Math.min(max,Math.max(min,value));
      for(const programId of Object.keys(PROGRAMS)){
        const program=PROGRAMS[programId];
        const selected=new Map();
        for(const rule of catalog)if(rule?.program==='shared')selected.set(rule.id,rule);
        for(const rule of catalog)if(rule?.program===programId)selected.set(rule.id,rule);
        if(![...selected.values()].some(rule=>(Number(rule.quantity?.min)||0)>0))throw new Error(`${programId} 配置缺少 quantity.min > 0 的核心家具`);
        const configuredSurfaces=[...selected.values()].filter(rule=>rule?.surface?.layer==='floor'&&rule?.geometry);
        FLOOR_SURFACE_RULES[programId]=configuredSurfaces;
        const rows=[...selected.values()].filter(rule=>rule?.id&&rule?.geometry&&rule?.surface?.layer!=='floor').map((rule,index)=>{
          const min=Math.max(0,Math.round(finite(rule.quantity?.min,0)));
          const isInfill=!!rule.infill||/填缝|定制柜|infill/i.test(`${rule.id} ${rule.category||''} ${rule.role||''}`);
          const max=Math.max(min,Math.round(finite(rule.quantity?.max,1)));
          return {rule,index,min,max,priority:Math.max(1,Math.round(finite(rule.preferences?.priority,(index+1)*10)))};
        }).sort((a,b)=>a.priority-b.priority||a.index-b.index);
        // 落子顺序完全采用全局配置中的 preferences.priority。
        program.types=rows.map(({rule,min,max,priority})=>({
          id:rule.id,label:rule.label||rule.id,role:rule.role||'自定义家具',category:rule.category||'自定义家具',color:rule.color||'#376f9e',
          minCount:min,maxCount:max,accessTarget:!!rule.accessTarget,shape:rule.geometry.shape||'box',preferenceWeight:bounded(finite(rule.preferences?.weight,1),0,3),placementPriority:priority,
          geometryVariants:(Array.isArray(rule.geometry.variants)?rule.geometry.variants:[]).map((variant,index)=>({id:variant.id||`variant-${index+1}`,label:variant.label||variant.id||`变体 ${index+1}`,w:bounded(finite(variant.width??variant.w,rule.geometry.width),.1,8),d:bounded(finite(variant.depth??variant.d,rule.geometry.depth),.1,5),shape:variant.shape||rule.geometry.shape||'box'})),
          searchVariants:rule.geometry.searchVariants===true,
          stablePrimaryId:rule.id==='bed'
        }));
        program.order=program.types.map(type=>type.id);
        const dimensions={},counts={};
        for(const {rule,min,max} of rows){
          dimensions[rule.id]={w:bounded(finite(rule.geometry.width,1),.1,8),d:bounded(finite(rule.geometry.depth,.4),.1,5)};
          counts[rule.id]=bounded(Math.round(finite(rule.preferences?.defaultCount,min)),min,max);
          const placement=rule.placement||{},service=JSON.parse(JSON.stringify(rule.service||FURNITURE_RULES.default.service));
          const candidateConfig=JSON.parse(JSON.stringify(rule.candidate||{mode:'wall',rotations:[0,90]}));
          const isInfill=!!rule.infill,run=rule.run?JSON.parse(JSON.stringify(rule.run)):null;
          FURNITURE_RULES[rule.id]={
            requiredAnchor:placement.requiredAnchor||'none',avoidWindow:!!placement.avoidWindow,allowCorner:!!placement.allowCorner,
            candidate:candidateConfig,service:{...service,allowBodyTypes:service.allowBodyTypes||[]},run,infill:isInfill,
            preferenceWeight:bounded(finite(rule.preferences?.weight,1),0,3)
          };
        }
        CONFIGS[programId].dimensions=dimensions;CONFIGS[programId].counts=counts;
        DEFAULT_CONFIGS[programId].dimensions=JSON.parse(JSON.stringify(dimensions));DEFAULT_CONFIGS[programId].counts=JSON.parse(JSON.stringify(counts));
      }
      return true;
    }
    async function loadFurnitureCatalogFromServer(){
      try{
        const response=await fetch(GLOBAL_CONFIG_API,{cache:'no-store'});if(response.status===404)return false;
        const payload=await response.json();if(!response.ok)throw new Error(payload.detail||`HTTP ${response.status}`);
        serverConfigProfiles={current:payload.config};
        return applyServerConfigProfile('current');
      }catch(error){console.error('全局配置读取失败：',error);return false;}
    }
    function applyServerConfigProfile(profileId){
      const config=serverConfigProfiles.current;
      return config?applyGlobalConfig(config):false;
    }
    // 家具关系使用自己的接缝与碰撞净距，不被通用 25 mm 安全距推开。
    // 栅格仍只做 broad phase；是否允许贴合由毫米/浮点几何在 narrow phase 决定。
    // 设计语法只记录“相对关系”，不记某个户型里的绝对坐标。距离除以家具或
    // 房间特征尺度、位置写成 0–1 的归一化分区，因此同一条语法可投影到新轮廓。
    let DESIGN_GRAMMAR={};

    // 可变尺寸只来自每件家具 geometry.variants；没有配置变体时就使用基础尺寸。
    function buildFurniture(programId) {
      const program=PROGRAMS[programId];
      const config=CONFIGS[programId];
      const furniture=[];
      const orderedTypes=[...program.types].sort((a,b)=>program.order.indexOf(a.id)-program.order.indexOf(b.id));
      for (const type of orderedTypes) {
        // 填缝/定制收口不再作为 Beam 棋子。它与活动区一样，只读取最终硬家具
        // 留下的真实墙面余量做一次后处理，避免面积放大时把墙段候选乘进搜索树。
        if(FURNITURE_RULES[type.id]?.infill)continue;
        const count=Math.min(type.maxCount,Math.max(type.minCount??0,Math.round(config.counts[type.id]??1)));
        const dims=config.dimensions[type.id];
        for (let index=0;index<count;index++) {
          const repeated=type.maxCount>1;
          const id=repeated?(type.stablePrimaryId&&index===0?type.id:`${type.id}${index+1}`):type.id;
          let label=repeated?`${type.label} ${String.fromCharCode(65+index)}`:type.label;
          let shape=type.shape||'box';
          // 只有配置显式提供 geometry.variants 的家具才展开尺寸分支。
          const adaptiveSize=type.searchVariants&&type.geometryVariants?.length>0;
          // 可变棋保留至多 6 个离散模数。旧逻辑只取前三个，导致配置中已经存在
          // 的 1.6m 书桌从未真正进入搜索；书桌现在会同时试 0.9–2.0m，
          // 而每个父局面的 Top-K 仍负责限制总候选数，不会线性放大 Beam。
          const sizeVariants=variableSizeSearch&&adaptiveSize?(type.geometryVariants?.length?type.geometryVariants.slice(0,6):(VARIABLE_SIZE_PRESETS[programId]?.[type.id]||null)):null;
          // 配置数量代表上限；超过 minCount 的槽位是可跳过分支，而不是必须摆满。
          const optional=index>=(type.minCount||0);
          furniture.push({...type,id,label,w:dims.w,d:dims.d,shape,typeId:type.id,sizeVariants,optional,slotIndex:index});
        }
      }
      return furniture;
    }

    let currentProgram='bedroom';
    // 识别轮廓只是一种临时场景输入，不进入家具配置系统。
    let recognizedRoomOverride=null;
    let FURNITURE=[];
    let ITEM_BY_ID=Object.fromEntries(FURNITURE.map(item=>[item.id,item]));

    function refreshFurniture() {
      FURNITURE=buildFurniture(currentProgram);
      ITEM_BY_ID=Object.fromEntries(FURNITURE.map(item=>[item.id,item]));
      return FURNITURE;
    }

    function setVariableSizeSearch(enabled) {
      variableSizeSearch=Boolean(enabled);
      return refreshFurniture();
    }

    function setLayoutDensityMode(mode) {
      // 当前产品阶段只开放“丰富”：旧配置仍可读取，但不再把疏朗/标准带进算法分支。
      layoutDensityMode='rich';
      return layoutDensityMode;
    }
    function setCustomCabinetEnabled(enabled){customCabinetEnabled=Boolean(enabled);return refreshFurniture()}

    function setProgram(programId) {
      currentProgram=PROGRAMS[programId]?programId:'bedroom';
      refreshFurniture();
      return PROGRAMS[currentProgram];
    }
    const SCORE_KEYS = [
      ['feasible', '硬规则'],
      ['function', '功能模块 25%'],
      ['ground', '地面完成 25%'],
      ['storage', '墙面完成 20%'],
      ['relation', '对象关系 15%'],
      ['circulation', '通行 15%'],
      ['composition', '构图诊断'],
      ['comfort', '工学诊断'],
      ['daylight', '采光诊断'],
      ['preference', '偏好诊断'],
      ['activation', '空间激活诊断']
    ];

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const round = (v, n = 3) => Number(v.toFixed(n));
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const dot = (a, b) => a.x * b.x + a.y * b.y;
    const add = (a, b, scale = 1) => ({ x: a.x + b.x * scale, y: a.y + b.y * scale });

    function polygonSignedArea(points) {
      let sum = 0;
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        sum += a.x * b.y - b.x * a.y;
      }
      return sum / 2;
    }
    function polygonArea(points) { return Math.abs(polygonSignedArea(points)); }

    function makePolygon(shape, width, depth) {
      const w = width;
      const d = depth;
      if (shape === 'lshape') {
        return [
          {x:0,y:0}, {x:w,y:0}, {x:w,y:d*.62},
          {x:w*.72,y:d*.62}, {x:w*.72,y:d}, {x:0,y:d}
        ];
      }
      if (shape === 'cut') {
        return [
          {x:0,y:0}, {x:w,y:0}, {x:w,y:d*.72},
          {x:w*.80,y:d}, {x:0,y:d}
        ];
      }
      if (shape === 'notch') {
        return [
          {x:0,y:0}, {x:w,y:0}, {x:w,y:d*.32},
          {x:w*.82,y:d*.32}, {x:w*.82,y:d*.68},
          {x:w,y:d*.68}, {x:w,y:d}, {x:0,y:d}
        ];
      }
      return [{x:0,y:0},{x:w,y:0},{x:w,y:d},{x:0,y:d}];
    }

    function getWalls(polygon) {
      return polygon.map((a, index) => {
        const b = polygon[(index + 1) % polygon.length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy);
        const dir = { x: dx / length, y: dy / length };
        const normal = { x: -dir.y, y: dir.x };
        return { index, a, b, dx, dy, length, dir, normal, horizontal: Math.abs(dx) >= Math.abs(dy) };
      });
    }

    function pointOnSegment(p, a, b) {
      const cross = (p.y - a.y) * (b.x - a.x) - (p.x - a.x) * (b.y - a.y);
      if (Math.abs(cross) > 1e-6) return false;
      const d = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
      if (d < -EPS) return false;
      const lenSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      return d <= lenSq + EPS;
    }

    function pointSegmentDistance(p,a,b) {
      const dx=b.x-a.x,dy=b.y-a.y,lenSq=dx*dx+dy*dy;
      if(lenSq<EPS)return dist(p,a);
      const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/lenSq,0,1);
      return Math.hypot(p.x-(a.x+dx*t),p.y-(a.y+dy*t));
    }

    function pointInPolygon(point, polygon) {
      for (let i = 0; i < polygon.length; i++) {
        if (pointOnSegment(point, polygon[i], polygon[(i + 1) % polygon.length])) return true;
      }
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i];
        const b = polygon[j];
        const hit = ((a.y > point.y) !== (b.y > point.y)) &&
          (point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || EPS) + a.x);
        if (hit) inside = !inside;
      }
      return inside;
    }

    function itemLocalDims(item,pose=null) {
      return {w:pose?.overrideW||item.w,d:pose?.overrideD||item.d};
    }

    function rotatedDims(item, rotation, pose=null) {
      const local=itemLocalDims(item,pose);
      return rotation % 180 === 0 ? { w: local.w, d: local.d } : { w: local.d, d: local.w };
    }

    function poseRect(pose, item) {
      const dims = rotatedDims(item, pose.rotation,pose);
      return { x: pose.x, y: pose.y, w: dims.w, d: dims.d };
    }

    function footprintRects(item,pose) {
      const shape=pose.overrideShape||item.shape;if (!shape?.startsWith('l-')) return [poseRect(pose,item)];
      const local=itemLocalDims(item,pose);
      const lateral=pose.wallDir||(pose.rotation%180===0?{x:1,y:0}:{x:0,y:1});
      const normal=pose.normal||(pose.rotation%180===0?{x:0,y:1}:{x:1,y:0});
      const baseDepth=clamp(local.d*.54,.72,Math.min(.96,local.d));
      const extensionDepth=local.d-baseDepth;
      if (extensionDepth<.12) return [poseRect(pose,item)];
      const chaiseWidth=clamp(local.w*.34,.72,Math.min(1.02,local.w));
      const sign=shape==='l-left'?-1:1;
      const localRect=(u,v,w,d)=>{
        let center=add(pose,lateral,u);center=add(center,normal,v);
        return pose.rotation%180===0?{x:center.x,y:center.y,w,d}:{x:center.x,y:center.y,w:d,d:w};
      };
      return [
        localRect(0,-(local.d-baseDepth)/2,local.w,baseDepth),
        localRect(sign*(local.w-chaiseWidth)/2,baseDepth/2,chaiseWidth,extensionDepth)
      ];
    }

    function footprintsOverlap(itemA,poseA,itemB,poseB,padding=0) {
      return footprintRects(itemA,poseA).some(a=>footprintRects(itemB,poseB).some(b=>rectsOverlap(a,b,padding)));
    }

    function relationPairRule(itemA,poseA,itemB,poseB) {
      const fromChild=(child,childPose,parent)=>{const candidate=furnitureRule(child)?.candidate,entries=Array.isArray(candidate?.rules)&&candidate.rules.length?candidate.rules:[candidate].filter(Boolean),entry=entries.find(row=>(row.id||row.relation)===childPose?.candidateRuleId)||entries.find(row=>row.relation&&row.relation===childPose?.relation);return entry?.mode==='relation'&&entry.relativeTo===parent.typeId?entry:null};return fromChild(itemA,poseA,itemB)||fromChild(itemB,poseB,itemA)||null;
    }

    function pairCollisionClearance(itemA,poseA,itemB,poseB) {
      const relationClearance=relationPairRule(itemA,poseA,itemB,poseB)?.collisionClearance;
      if(relationClearance!==undefined)return relationClearance;
      // 同一面墙上的贴墙家具允许边缘精确相接；矩形碰撞仍会拒绝任何实际重叠。
      if(poseA?.anchor==='wall'&&poseB?.anchor==='wall'&&poseA.wallIndex>=0&&poseA.wallIndex===poseB.wallIndex)return 0;
      return .025;
    }

    function footprintInside(item,pose,polygon) {
      return footprintRects(item,pose).every(rect=>rectInsidePolygon(rect,polygon));
    }

    function rectSamples(rect) {
      const xs = [rect.x - rect.w/2 + 1e-5, rect.x, rect.x + rect.w/2 - 1e-5];
      const ys = [rect.y - rect.d/2 + 1e-5, rect.y, rect.y + rect.d/2 - 1e-5];
      const samples = [];
      for (const x of xs) for (const y of ys) samples.push({x,y});
      return samples;
    }

    function rectInsidePolygon(rect, polygon) {
      return rectSamples(rect).every(point => pointInPolygon(point, polygon));
    }

    function rectsOverlap(a, b, padding = 0) {
      return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + padding - EPS &&
        Math.abs(a.y - b.y) < (a.d + b.d) / 2 + padding - EPS;
    }

    function pointInRect(p, r, padding = 0) {
      return Math.abs(p.x-r.x) <= r.w/2 + padding && Math.abs(p.y-r.y) <= r.d/2 + padding;
    }

    function polygonCentroid(points) {
      let crossSum=0,xSum=0,ySum=0;
      for (let i=0;i<points.length;i++) {
        const a=points[i],b=points[(i+1)%points.length],cross=a.x*b.y-b.x*a.y;
        crossSum+=cross;xSum+=(a.x+b.x)*cross;ySum+=(a.y+b.y)*cross;
      }
      if (Math.abs(crossSum)<EPS) return {x:points.reduce((s,p)=>s+p.x,0)/points.length,y:points.reduce((s,p)=>s+p.y,0)/points.length};
      return {x:xSum/(3*crossSum),y:ySum/(3*crossSum)};
    }

    function compileDesignField(scene) {
      const orientation=scene.width>=scene.depth?'wide':'deep';
      const grammar=DESIGN_GRAMMAR[scene.programId];
      const zone=grammar.zones[orientation];
      const project=pair=>({x:scene.width*pair[0],y:scene.depth*pair[1]});
      const zones=Object.fromEntries(Object.entries(zone).map(([id,pair])=>[id,project(pair)]));
      return {orientation,scale:Math.sqrt(scene.area),centroid:polygonCentroid(scene.polygon),zones,grammar};
    }

    function recognizedDoorKind(type='') {
      const value=String(type).toLowerCase();
      if(/slide|slince|sliding/.test(value))return 'slide';
      if(/hole|opening|passage/.test(value))return 'opening';
      return 'swing';
    }

    function doorClearanceRect(center,inward,width,kind) {
      const depth=kind==='swing'?width:.50,offset=depth/2;
      const horizontal=Math.abs(inward.y)>=Math.abs(inward.x);
      return horizontal
        ?{x:center.x+inward.x*offset,y:center.y+inward.y*offset,w:width,d:depth}
        :{x:center.x+inward.x*offset,y:center.y+inward.y*offset,w:depth,d:width};
    }

    function sceneDoors(scene) {
      return scene.doors?.length?scene.doors:(scene.door?[scene.door]:[]);
    }

    function overlapsDoorClearance(rect,scene,padding=.01) {
      return sceneDoors(scene).some(door=>door.noGo&&rectsOverlap(rect,door.noGo,padding));
    }

    function makeScene(shape = 'rect', width = 3.6, depth = 3.8, areaMultiplier = 1) {
      const program=PROGRAMS[currentProgram];
      if (recognizedRoomOverride?.programId===currentProgram) {
        // 识别轮廓保存为原始基准几何；顶部宽/深与面积倍率只生成一份缩放后的测试副本，
        // 因而可以反复测试尺寸而不破坏接口返回的原始轮廓和门窗相对位置。
        const source=recognizedRoomOverride.polygon.map(point=>({...point})),sourceXs=source.map(point=>point.x),sourceYs=source.map(point=>point.y);
        const sourceMinX=Math.min(...sourceXs),sourceMinY=Math.min(...sourceYs),sourceW=Math.max(...sourceXs)-sourceMinX,sourceD=Math.max(...sourceYs)-sourceMinY;
        const baseW=clamp(Number(width)||sourceW,1,12),baseD=clamp(Number(depth)||sourceD,1,12),multiplier=clamp(Number(areaMultiplier)||1,.5,3),linearMultiplier=Math.sqrt(multiplier);
        const sx=baseW*linearMultiplier/Math.max(sourceW,EPS),sy=baseD*linearMultiplier/Math.max(sourceD,EPS);
        const scalePoint=point=>({x:round((point.x-sourceMinX)*sx,4),y:round((point.y-sourceMinY)*sy,4)});
        const polygon=source.map(scalePoint),w=baseW*linearMultiplier,d=baseD*linearMultiplier;
        const scaledOpenings=(recognizedRoomOverride.openings||[]).map(opening=>({...opening,points:(opening.points||[]).map(scalePoint)}));
        const walls=getWalls(polygon);
        const horizontal=polygon.map((a,index)=>({a,b:polygon[(index+1)%polygon.length]}))
          .filter(edge=>Math.abs(edge.a.y-edge.b.y)<Math.max(.06,d*.012)&&Math.abs(edge.a.x-edge.b.x)>.65);
        const bottom=horizontal.slice().sort((a,b)=>Math.max(b.a.y,b.b.y)-Math.max(a.a.y,a.b.y))[0];
        const top=horizontal.slice().sort((a,b)=>Math.min(a.a.y,a.b.y)-Math.min(b.a.y,b.b.y))[0];
        const doorEdge=bottom||{a:{x:0,y:d},b:{x:w,y:d}};
        const doorMin=Math.min(doorEdge.a.x,doorEdge.b.x),doorMax=Math.max(doorEdge.a.x,doorEdge.b.x);
        const syntheticDoorWidth=Math.min(.90,Math.max(.65,(doorMax-doorMin)*.28));
        const doorX0=clamp(doorMin+.18,doorMin,Math.max(doorMin,doorMax-syntheticDoorWidth));
        const doorY=(doorEdge.a.y+doorEdge.b.y)/2;
        const syntheticDoor={a:{x:doorX0,y:doorY},b:{x:doorX0+syntheticDoorWidth,y:doorY},inward:{x:0,y:-1},
          x0:doorX0,x1:doorX0+syntheticDoorWidth,y:doorY,width:syntheticDoorWidth,
          noGo:{x:doorX0+syntheticDoorWidth/2,y:doorY-syntheticDoorWidth/2,w:syntheticDoorWidth,d:syntheticDoorWidth},
          entry:{x:doorX0+syntheticDoorWidth/2,y:doorY-syntheticDoorWidth+.16},recognized:false};
        syntheticDoor.type='door_open';syntheticDoor.kind='swing';syntheticDoor.isEntrance=true;
        const doorOpenings=scaledOpenings.filter(opening=>String(opening.type).startsWith('door')&&opening.points?.length>=2);
        const doors=doorOpenings.map(doorOpening=>{
          const a={...doorOpening.points[0]},b={...doorOpening.points[1]},center={x:(a.x+b.x)/2,y:(a.y+b.y)/2},doorWidth=dist(a,b);
          const wall=walls.slice().sort((left,right)=>pointSegmentDistance(center,left.a,left.b)-pointSegmentDistance(center,right.a,right.b))[0];
          const inward=wall?.normal||{x:0,y:-1},kind=recognizedDoorKind(doorOpening.type);
          return {a,b,inward,x0:a.x,x1:b.x,y:a.y,width:doorWidth,type:doorOpening.type,kind,recognized:true,
            sourceIndex:doorOpening.sourceIndex,isEntrance:!!doorOpening.isEntrance,noGo:doorClearanceRect(center,inward,doorWidth,kind),
            entry:{x:center.x+inward.x*Math.min(.22,doorWidth*.28),y:center.y+inward.y*Math.min(.22,doorWidth*.28)}};
        });
        if(!doors.length)doors.push(syntheticDoor);
        // 入户门作为水漫起点；普通房间没有入户门时使用最宽的室内门。
        const door=doors.find(row=>row.isEntrance)||doors.slice().sort((a,b)=>b.width-a.width)[0];
        const windowEdge=top||{a:{x:0,y:0},b:{x:w,y:0}};
        const windowMin=Math.min(windowEdge.a.x,windowEdge.b.x),windowMax=Math.max(windowEdge.a.x,windowEdge.b.x);
        const windowWidth=Math.min(currentProgram==='living'?1.80:1.45,Math.max(.60,(windowMax-windowMin)*.40));
        const windowX0=clamp((windowMin+windowMax-windowWidth)/2,windowMin,Math.max(windowMin,windowMax-windowWidth));
        const window={x0:windowX0,x1:windowX0+windowWidth,y:(windowEdge.a.y+windowEdge.b.y)/2,mid:{x:windowX0+windowWidth/2,y:(windowEdge.a.y+windowEdge.b.y)/2}};
        const scene={shape:'recognized',programId:currentProgram,baseWidth:baseW,baseDepth:baseD,areaMultiplier:multiplier,linearMultiplier,
          width:w,depth:d,polygon,walls,door,doors,window,openings:scaledOpenings,area:polygonArea(polygon),compiledAnchors:[],designField:null,_flowContext:null};
        scene.designField=compileDesignField(scene);scene.compiledAnchors=compileAnchorPreview(scene);return scene;
      }
      const baseW=clamp(Number(width)||program.defaultWidth,2.4,7.0);
      const baseD=clamp(Number(depth)||program.defaultDepth,2.4,7.0);
      const multiplier=clamp(Number(areaMultiplier)||1,.5,3);
      // “面积倍率”不是边长倍率：面积乘 m 时，宽深分别乘 sqrt(m)。家具保持固定真实尺寸。
      const linearMultiplier=Math.sqrt(multiplier);
      const w=baseW*linearMultiplier;
      const d=baseD*linearMultiplier;
      const polygon = makePolygon(shape, w, d);
      const doorWidth = Math.min(.90, w * .30);
      const doorX0 = Math.min(.22,w*.06);
      const door = {
        x0: doorX0,
        x1: doorX0 + doorWidth,
        y: d,
        width: doorWidth,
        noGo: { x: doorX0 + doorWidth/2, y: d-doorWidth/2, w: doorWidth, d: doorWidth },
        entry: { x: doorX0 + doorWidth/2, y: d-doorWidth+.16 }
      };
      door.type='door_open';door.kind='swing';door.isEntrance=true;
      const windowWidth=Math.min(currentProgram==='living'?1.80:1.45,w*.40);
      const windowCenter=w*.70;
      const windowX0=clamp(windowCenter-windowWidth/2,.18,Math.max(.18,w-windowWidth-.18));
      const window = { x0:windowX0, x1:windowX0+windowWidth, y:0, mid:{x:windowX0+windowWidth/2,y:0} };
      const scene = {
        shape, programId:currentProgram, baseWidth:baseW, baseDepth:baseD,
        areaMultiplier:multiplier, linearMultiplier,
        width:w, depth:d, polygon, walls:getWalls(polygon), door, doors:[door], window,
        area:polygonArea(polygon), compiledAnchors:[],designField:null,_flowContext:null
      };
      scene.designField=compileDesignField(scene);
      scene.compiledAnchors = compileAnchorPreview(scene);
      return scene;
    }

    function subtractInterval(intervals,cut0,cut1) {
      const next=[];
      for (const [a,b] of intervals) {
        if (cut1<=a+EPS||cut0>=b-EPS) {next.push([a,b]);continue;}
        if (cut0>a+.04) next.push([a,Math.min(b,cut0)]);
        if (cut1<b-.04) next.push([Math.max(a,cut1),b]);
      }
      return next;
    }

    function freeWallIntervals(wall,state,scene,item,clearance=null) {
      // 柜体、书桌等沿墙棋子采用严丝合缝模式；普通家具仍保留很小的安装容差。
      const tightSeam=currentProgram==='bedroom'&&(item?.typeId==='desk'||!!furnitureRule(item)?.run||furnitureRule(item)?.infill);
      const resolvedClearance=clearance==null?(tightSeam?0:.025):clearance;
      let intervals=[[0,wall.length]];
      if (state) for (const [id,pose] of Object.entries(state.poses)) {
        if (pose.wallIndex!==wall.index) continue;
        const other=ITEM_BY_ID[id];if(!other)continue;
        const along=dot({x:pose.x-wall.a.x,y:pose.y-wall.a.y},wall.dir);
        const span=itemLocalDims(other,pose).w;
        intervals=subtractInterval(intervals,along-span/2-resolvedClearance,along+span/2+resolvedClearance);
      }
      const rule=furnitureRule(item);
      if (rule.avoidWindow&&Math.abs(wall.a.y)<EPS&&Math.abs(wall.b.y)<EPS) {
        const w0=dot({x:scene.window.x0-wall.a.x,y:-wall.a.y},wall.dir);
        const w1=dot({x:scene.window.x1-wall.a.x,y:-wall.a.y},wall.dir);
        intervals=subtractInterval(intervals,Math.min(w0,w1)-.05,Math.max(w0,w1)+.05);
      }
      return intervals.filter(([a,b])=>b-a>.12);
    }

    // “填缝柜”不是任意无限长的 Box。它在最后一轮读取该分支真正剩下的连续墙段，
    // 再从常用成品/定制模数中挑选能放下的最大几档，因此不同分支会得到不同但可生产的尺寸。
    function customInfillCandidates(item,scene,state) {
      const rule=furnitureRule(item),run=rule.run,candidates=[];
      // 默认每面墙只落一段填缝柜。这样增加库存数量时会主动寻找下一面空墙，
      // 而不是在同一面长墙上反复切成几段，既更像真实定制设计，也显著限制候选规模。
      const maxPerWall=Math.max(1,Math.round(Number(run.maxPerWall)||1)),usedByWall=new Map();
      for(const [placedId,pose] of Object.entries(state.poses||{})){
        if(ITEM_BY_ID[placedId]?.typeId!==item.typeId||!Number.isInteger(pose.wallIndex))continue;
        usedByWall.set(pose.wallIndex,(usedByWall.get(pose.wallIndex)||0)+1);
      }
      for (const wall of scene.walls) {
        if (Math.abs(wall.dx)>1e-5&&Math.abs(wall.dy)>1e-5) continue;
        if((usedByWall.get(wall.index)||0)>=maxPerWall)continue;
        let intervals=freeWallIntervals(wall,state,scene,item,0);
        for(const door of sceneDoors(scene)){
          const doorA=door.a||{x:door.x0,y:door.y},doorB=door.b||{x:door.x1,y:door.y};
          if (!pointOnSegment(doorA,wall.a,wall.b)||!pointOnSegment(doorB,wall.a,wall.b))continue;
          const d0=dot({x:doorA.x-wall.a.x,y:doorA.y-wall.a.y},wall.dir),d1=dot({x:doorB.x-wall.a.x,y:doorB.y-wall.a.y},wall.dir);
          const cut0=Math.min(d0,d1)-.08,cut1=Math.max(d0,d1)+.08;
          intervals=intervals.flatMap(([a,b])=>subtractInterval([[a,b]],cut0,cut1));
        }
        for (const [start,end] of intervals) {
          const available=end-start;if(available<run.min-EPS)continue;
          const snapStep=Math.max(.05,Number(run.step)||.05),customWidth=round(Math.floor((Math.min(run.max,available)+EPS)/snapStep)*snapStep,2);
          const modules=[customWidth,...(Array.isArray(run.modules)?run.modules:[])].map(Number).filter(width=>Number.isFinite(width)&&width>=run.min-EPS&&width<=run.max+EPS&&width<=available+EPS).sort((a,b)=>b-a).filter((width,index,list)=>index===0||Math.abs(width-list[index-1])>EPS).slice(0,2);
          for(const width of modules) {
            const half=width/2,slots=available>width+.24?[start+half,end-half]:[(start+end)/2];
            for(const t of [...new Set(slots.map(value=>round(value,3)))]) {
              const wallPoint=add(wall.a,wall.dir,t),local=itemLocalDims(item,{overrideW:width});
              const center=add(wallPoint,wall.normal,local.d/2);
              const wallEndGap=Math.max(0,Math.min(t-half-start,end-(t+half)));
              candidates.push({x:center.x,y:center.y,rotation:wall.horizontal?0:90,normal:{...wall.normal},wallDir:{...wall.dir},wallIndex:wall.index,wallPoint,anchor:'wall',relation:'custom-infill',overrideW:width,sizeLabel:`定制柜 ${width.toFixed(1)} m`,runFill:round(width/available,3),runInterval:[round(start,3),round(end,3)],installationGap:round(available-width,3),wallEndGap:round(wallEndGap,3),cornerClosure:wallEndGap<=.08});
            }
          }
        }
      }
      return candidates;
    }

    function parametricWallRunCandidates(item,scene,state) {
      const run=furnitureRule(item).run;if(!run)return [];
      const candidates=[];
      for (const wall of scene.walls) {
        if (Math.abs(wall.dx)>1e-5&&Math.abs(wall.dy)>1e-5) continue;
        for (const [start,end] of freeWallIntervals(wall,state,scene,item)) {
          const length=end-start;if(length<run.min-EPS)continue;
          const snap=value=>clamp(Math.floor(value/run.step+.001)*run.step,run.min,Math.min(run.max,length));
          const widths=[snap(length*run.fill[0]),snap(length*run.fill[1])]
            .map(width=>round(width,2)).filter(width=>width>=run.min-EPS&&width<=run.max+EPS&&width<=length+EPS);
          for (const width of [...new Set(widths)]) {
            const margin=width/2;
            const slots=[start+margin,(start+end)/2,end-margin];
            for (const t of [...new Set(slots.map(value=>round(value,3)))]) {
              if(t<start+margin-EPS||t>end-margin+EPS)continue;
              const wallPoint=add(wall.a,wall.dir,t),local=itemLocalDims(item,{overrideW:width});
              const center=add(wallPoint,wall.normal,local.d/2);
              candidates.push({x:center.x,y:center.y,rotation:wall.horizontal?0:90,normal:{...wall.normal},wallDir:{...wall.dir},wallIndex:wall.index,wallPoint,anchor:'wall',relation:'wall-run',overrideW:width,runFill:round(width/length,3),runInterval:[round(start,3),round(end,3)]});
            }
          }
        }
      }
      return candidates;
    }

    function wallPoseCandidates(item, scene,state=null) {
      const candidates = [];
      for (const wall of scene.walls) {
        // 第一版家具只允许 0° / 90°，斜墙仍参与房间边界判断，但不生成“贴斜墙”落子。
        if (Math.abs(wall.dx) > 1e-5 && Math.abs(wall.dy) > 1e-5) continue;
        if (wall.length < item.w + .08) continue;
        const rotation = wall.horizontal ? 0 : 90;
        const span = item.w;
        const normalDepth = item.d;
        const margin = span/2;
        const available=Math.max(0,wall.length-margin*2);
        const sampling=LAYOUT_CONSTRAINTS.search.semanticSampling.wall,uniformStep=Math.max(.12,Number(sampling.uniformStep)||.36),rawSlots=Math.max(1,Math.ceil(available/uniformStep));
        const uniformCap=scene.area>=Number(sampling.largeRoomArea||Infinity)?Number(sampling.largeMaxUniformPositions)||4:Number(sampling.maxUniformPositions)||9;
        const slots=Math.max(1,Math.min(rawSlots,Math.round(uniformCap)));
        const positions=[margin,wall.length-margin,wall.length/2,wall.length/3,wall.length*2/3,wall.length/4,wall.length*3/4];
        // 把已经落下的同墙家具边缘也作为吸附点。这样不同模长的书桌会真实尝试
        // “贴墙端”“贴床组/柜体”两种闭合方式，而不是只落在等分网格上留下随机缝。
        const occupiedIntervals=[];
        if(state)for(const [id,otherPose] of Object.entries(state.poses||{})){
          if(otherPose.wallIndex!==wall.index)continue;
          const other=ITEM_BY_ID[id];if(!other)continue;
          const along=dot({x:otherPose.x-wall.a.x,y:otherPose.y-wall.a.y},wall.dir),otherSpan=itemLocalDims(other,otherPose).w;
          const interval=[along-otherSpan/2,along+otherSpan/2];occupiedIntervals.push(interval);
          if(item.typeId==='desk')positions.push(interval[0]-margin,interval[1]+margin);
        }
        // 床组贴角不是让“床本体”撞进墙角，而是给外侧床头柜预留恰好一柜宽。
        // 同时投放三种床头柜宽度的精确候选，后续落床头柜时选择同档宽度即可做到零缝。
        const bedsideReserves=item.typeId==='bed'&&Number(CONFIGS.bedroom.counts.night||0)>0
          ?[...new Set([0,.35,.45,.55,Number(CONFIGS.bedroom.dimensions.night?.w)||.45].map(value=>round(value,2)))]
          :[];
        for(const reserve of bedsideReserves){positions.push(margin+reserve,wall.length-margin-reserve)}
        for (let slot=0;slot<=slots;slot++) positions.push(margin+available*slot/slots);
        const uniquePositions=[...new Set(positions
          .filter(v=>v>=margin-EPS&&v<=wall.length-margin+EPS)
          .map(v=>round(v,4)))];
        for (const t of uniquePositions) {
          const wallPoint = add(wall.a, wall.dir, t);
          const center = add(wallPoint, wall.normal, normalDepth/2);
          const wallEndGap=Math.min(t-margin,(wall.length-margin)-t),bedsideReserve=bedsideReserves.find(value=>Math.abs(value-wallEndGap)<.012)??null;
          const candidateStart=t-margin,candidateEnd=t+margin;
          let leftBoundary=0,rightBoundary=wall.length;
          for(const [start,end] of occupiedIntervals){
            if(end<=candidateStart+EPS)leftBoundary=Math.max(leftBoundary,end);
            if(start>=candidateEnd-EPS)rightBoundary=Math.min(rightBoundary,start);
          }
          const leftGap=Math.max(0,candidateStart-leftBoundary),rightGap=Math.max(0,rightBoundary-candidateEnd);
          const wallClosureGap=Math.min(leftGap,rightGap),wallSegmentFill=span/Math.max(span,rightBoundary-leftBoundary);
          candidates.push({
            x:center.x, y:center.y, rotation,
            normal:{...wall.normal}, wallDir:{...wall.dir}, wallIndex:wall.index,
            wallPoint, wallEndGap,wallClosureGap,wallSegmentFill,bedsideReserve,anchor:'wall', relation:null
          });
        }
      }
      if (state&&furnitureRule(item).run) candidates.push(...parametricWallRunCandidates(item,scene,state));
      return candidates;
    }

    function compileAnchorPreview(scene) {
      const items = FURNITURE.slice(0,3);
      const seen = new Set();
      const points = [];
      for (const item of items) {
        for (const pose of wallPoseCandidates(item, scene)) {
          const key = `${round(pose.x,2)}:${round(pose.y,2)}`;
          if (!seen.has(key) && footprintInside(item,pose,scene.polygon)) {
            seen.add(key);
            points.push({x:pose.x,y:pose.y});
          }
        }
      }
      return points.slice(0,Math.max(1,Math.round(Number(LAYOUT_CONSTRAINTS.search.semanticSampling.wall.previewLimit)||140)));
    }

    function relativeNightstandCandidates(item, state) {
      const edgeGap=0;
      const candidates=[];
      for(const bed of FURNITURE.filter(piece=>piece.typeId==='bed')) {
        const bedPose=state.poses[bed.id];
        if (!bedPose?.wallDir||!bedPose.normal||!bedPose.wallPoint) continue;
        const bedDims=itemLocalDims(bed,bedPose),nightDims=itemLocalDims(item);
        const sideOffset=bedDims.w/2+nightDims.w/2+edgeGap;
        for(const side of [-1,1]) {
          const along=add(bedPose.wallPoint,bedPose.wallDir,side*sideOffset);
          const center=add(along,bedPose.normal,nightDims.d/2);
          candidates.push({x:center.x,y:center.y,rotation:bedPose.rotation,normal:{...bedPose.normal},wallDir:{...bedPose.wallDir},wallIndex:bedPose.wallIndex,wallPoint:along,anchor:'relation',relation:'bed-side',relationSide:side,relationTarget:bed.id,slot:`${bed.id}-side-${side}`});
        }
      }
      return candidates;
    }

    function relativeChairCandidates(item, state) {
      const deskPose = state.poses.desk;
      if (!deskPose || !deskPose.normal) return [];
      const desk = ITEM_BY_ID.desk;
      const baseDistance = desk.d/2 + item.d/2 + .32;
      const lateral = deskPose.wallDir || {x:1,y:0};
      return [-.25, 0, .25].map(offset => {
        let center = add(deskPose, deskPose.normal, baseDistance);
        center = add(center, lateral, offset);
        return {
          x:center.x, y:center.y,
          rotation:deskPose.rotation,
          normal:{x:-deskPose.normal.x,y:-deskPose.normal.y}, wallDir:{x:-lateral.x,y:-lateral.y},
          wallIndex:-1, wallPoint:null,
          anchor:'relation', relation:'desk-front', relationOffset:offset
        };
      });
    }

    function livingTvCandidates(item,state,scene) {
      const sofaPose=state.poses.sofa;
      return wallPoseCandidates(item,scene).map(pose=>{
        if (!sofaPose||!sofaPose.normal) return pose;
        const opposite=dot(sofaPose.normal,pose.normal)<-.65;
        const parallel=sofaPose.rotation===pose.rotation;
        const lateral=Math.abs(dot({x:pose.x-sofaPose.x,y:pose.y-sofaPose.y},sofaPose.wallDir||{x:1,y:0}));
        if (opposite&&parallel&&lateral<1.25) pose.relation='sofa-facing';
        return pose;
      });
    }

    function livingSofaCandidates(item,scene) {
      const candidates=wallPoseCandidates(item,scene);
      const lounge=scene.designField?.zones?.lounge;
      const layouts=[
        ...(lounge?[scene.designField.orientation==='wide'?{x:lounge.x,y:lounge.y,rotation:0,normal:{x:0,y:1},wallDir:{x:1,y:0}}:{x:lounge.x,y:lounge.y,rotation:90,normal:{x:1,y:0},wallDir:{x:0,y:-1}}]:[]),
        {x:scene.width*.50,y:scene.depth*.34,rotation:0,normal:{x:0,y:1},wallDir:{x:1,y:0}},
        {x:scene.width*.50,y:scene.depth*.42,rotation:0,normal:{x:0,y:1},wallDir:{x:1,y:0}},
        {x:scene.width*.50,y:scene.depth*.58,rotation:0,normal:{x:0,y:-1},wallDir:{x:-1,y:0}},
        {x:scene.width*.50,y:scene.depth*.66,rotation:0,normal:{x:0,y:-1},wallDir:{x:-1,y:0}},
        {x:scene.width*.34,y:scene.depth*.50,rotation:90,normal:{x:1,y:0},wallDir:{x:0,y:-1}},
        {x:scene.width*.66,y:scene.depth*.50,rotation:90,normal:{x:-1,y:0},wallDir:{x:0,y:1}}
      ];
      for (const layout of layouts) candidates.push({...layout,wallIndex:-1,wallPoint:null,anchor:'zone',relation:'floating-sofa'});
      return candidates;
    }

    function relativeCoffeeCandidates(item,state) {
      const sofaPose=state.poses.sofa;
      if (!sofaPose||!sofaPose.normal) return [];
      const sofa=ITEM_BY_ID.sofa;
      const lateral=sofaPose.wallDir||{x:1,y:0};
      const distance=sofa.d/2+item.d/2+.42;
      let offsets=[-.22,0,.22];
      if (sofa.shape==='l-left') offsets=[.18,.34,.50];
      if (sofa.shape==='l-right') offsets=[-.50,-.34,-.18];
      return offsets.map(offset=>{
        let center=add(sofaPose,sofaPose.normal,distance);
        center=add(center,lateral,offset);
        return {x:center.x,y:center.y,rotation:sofaPose.rotation,normal:{...sofaPose.normal},wallDir:{...lateral},wallIndex:-1,wallPoint:null,anchor:'relation',relation:'sofa-front',relationOffset:offset};
      });
    }

    function relativeArmchairCandidates(item,state) {
      const sofaPose=state.poses.sofa;
      if (!sofaPose||!sofaPose.normal) return [];
      const sofa=ITEM_BY_ID.sofa;
      const lateral=sofaPose.wallDir||{x:1,y:0};
      const ottomanClearance=FURNITURE.some(piece=>piece.id.startsWith('ottoman')) ? .52 : 0;
      const across=sofa.d/2+item.d/2+1.28+ottomanClearance;
      const side=sofa.w/2+item.w/2+.25;
      const candidates=[];
      for (const sign of [-1,1]) {
        let center=add(sofaPose,sofaPose.normal,across);
        center=add(center,lateral,sign*.66);
        candidates.push({x:center.x,y:center.y,rotation:sofaPose.rotation,normal:{x:-sofaPose.normal.x,y:-sofaPose.normal.y},wallDir:{...lateral},wallIndex:-1,wallPoint:null,anchor:'relation',relation:'conversation-opposite',relationSide:sign,slot:`opposite-${sign}`});
        let sideCenter=add(sofaPose,lateral,sign*side);
        sideCenter=add(sideCenter,sofaPose.normal,.72+ottomanClearance*.55);
        candidates.push({x:sideCenter.x,y:sideCenter.y,rotation:(sofaPose.rotation+90)%180,normal:{x:-sign*lateral.x,y:-sign*lateral.y},wallDir:{x:sofaPose.normal.x,y:sofaPose.normal.y},wallIndex:-1,wallPoint:null,anchor:'relation',relation:'conversation-side',relationSide:sign,slot:`side-${sign}`});
      }
      return candidates;
    }

    function relativeSideTableCandidates(item,state) {
      const sofaPose=state.poses.sofa;
      if (!sofaPose||!sofaPose.wallDir) return [];
      const sofa=ITEM_BY_ID.sofa;
      const offset=sofa.w/2+item.w/2+.07;
      const candidates=[-1,1].map(sign=>{
        let center=add(sofaPose,sofaPose.wallDir,sign*offset);
        center=add(center,sofaPose.normal,.06);
        return {x:center.x,y:center.y,rotation:sofaPose.rotation,normal:{...sofaPose.normal},wallDir:{...sofaPose.wallDir},wallIndex:-1,wallPoint:null,anchor:'relation',relation:'sofa-side',relationSide:sign,slot:`side-table-${sign}`};
      });
      for (const [id,chairPose] of Object.entries(state.poses).filter(([id])=>id.startsWith('arm'))) {
        const chair=ITEM_BY_ID[id];
        const lateral=chairPose.wallDir||{x:1,y:0};
        for (const sign of [-1,1]) {
          const center=add(chairPose,lateral,sign*(chair.w/2+item.w/2+.08));
          candidates.push({x:center.x,y:center.y,rotation:chairPose.rotation,normal:{...chairPose.normal},wallDir:{...lateral},wallIndex:-1,wallPoint:null,anchor:'relation',relation:'seat-side',relationSide:sign,slot:`${id}-side-${sign}`});
        }
      }
      return candidates;
    }

    function relativeOttomanCandidates(item,state) {
      const sofaPose=state.poses.sofa;
      if (!sofaPose||!sofaPose.normal) return [];
      const sofa=ITEM_BY_ID.sofa;
      const lateral=sofaPose.wallDir||{x:1,y:0};
      const forward=sofa.d/2+item.d/2+.72;
      const spread=Math.min(.72,Math.max(.38,sofa.w*.28));
      const candidates=[-1,1].flatMap(sign=>[.82,1.05].map((factor,index)=>{
        let center=add(sofaPose,sofaPose.normal,forward*factor);
        center=add(center,lateral,sign*spread);
        return {x:center.x,y:center.y,rotation:sofaPose.rotation,normal:{...sofaPose.normal},wallDir:{...lateral},wallIndex:-1,wallPoint:null,anchor:'relation',relation:'sofa-ottoman',relationSide:sign,slot:`ottoman-${sign}-${index}`};
      }));
      for (const [id,chairPose] of Object.entries(state.poses).filter(([id])=>id.startsWith('arm'))) {
        const chair=ITEM_BY_ID[id];
        const center=add(chairPose,chairPose.normal||{x:0,y:1},chair.d/2+item.d/2+.34);
        candidates.push({x:center.x,y:center.y,rotation:chairPose.rotation,normal:{...chairPose.normal},wallDir:{...chairPose.wallDir},wallIndex:-1,wallPoint:null,anchor:'relation',relation:'seat-ottoman',relationSide:0,slot:`${id}-ottoman`});
      }
      return candidates;
    }

    function roomZoneCandidates(item,scene,relation='room-zone',state=null) {
      const points=[
        [.28,.30],[.50,.30],[.72,.30],
        [.28,.52],[.50,.52],[.72,.52],
        [.28,.72],[.50,.72],[.72,.72]
      ];
      if(relation==='floating-sofa')points.unshift([.50,.42],[.50,.58],[.42,.50],[.58,.50]);
      // 长条异形卧室的可用补座区常落在上半区靠侧墙，而不是九宫格中心。
      // 增加少量代表点即可覆盖“平移 20~30cm 后通路全通”的解，不铺满细网格。
      if(relation==='bedroom-lounge-zone')points.unshift([.20,.22],[.36,.22],[.20,.28],[.36,.28],[.20,.34],[.36,.34]);
      // 餐桌不是只能摆在九宫格中心。参考成熟规则系统的“功能区边界 + 靠墙偏好”，
      // 增加一圈离边界约 0.18~0.22 的聚类中心，使沙发前区占掉中央时餐组仍可
      // 落在另一半空间。只增加这些代表点，不按房间面积铺满细网格。
      if(relation==='dining-zone')points.unshift(
        [.18,.24],[.18,.50],[.18,.76],[.82,.24],[.82,.50],[.82,.76],
        [.34,.18],[.66,.18],[.34,.82],[.66,.82]
      );
      const grammarZone=scene.designField?.zones?.[currentProgram==='living'?'dining':'work'];
      if (grammarZone) points.unshift([grammarZone.x/scene.width,grammarZone.y/scene.depth]);
      const sofaPose=state?.poses?.sofa;
      if (relation==='dining-zone'&&sofaPose) {
        const dx=Math.abs(sofaPose.x/scene.width-.5)>=Math.abs(sofaPose.y/scene.depth-.5)?(sofaPose.x<scene.width/2?.75:.25):.5;
        const dy=dx===.5?(sofaPose.y<scene.depth/2?.75:.25):.52;
        points.unshift([dx,dy]);
      }
      const candidates=[];
      // 按“同一点的两个朝向”交错输出。configuredRuleCandidates 会按规则上限
      // 截断；旧顺序先输出全部 0°，导致餐桌的 90° 候选永远进不了前 16。
      for (const [rx,ry] of points)for (const rotation of [0,90]) {
        const normal=rotation===0?{x:0,y:1}:{x:1,y:0},wallDir=rotation===0?{x:1,y:0}:{x:0,y:-1};
        candidates.push({x:scene.width*rx,y:scene.depth*ry,rotation,normal:{...normal},wallDir:{...wallDir},wallIndex:-1,wallPoint:null,anchor:'zone',relation});
      }
      return candidates;
    }

    function relativeDiningChairCandidates(item,state) {
      const tablePose=state.poses.diningTable;
      const table=ITEM_BY_ID.diningTable;
      if (!tablePose||!table) return [];
      const lateral=tablePose.wallDir||(tablePose.rotation%180===0?{x:1,y:0}:{x:0,y:1});
      const normal=tablePose.normal||(tablePose.rotation%180===0?{x:0,y:1}:{x:1,y:0});
      const candidates=[];
      // 餐椅允许座面略收进桌沿；旧的 0.24m 额外缝隙会把四椅组无谓放大，
      // 在中型客餐厅经常只能留下三把。0.12m 仍避免实体相交，并符合组团关系。
      const sideDistance=table.d/2+item.d/2+.12;
      for (const side of [-1,1]) for (const offset of [-table.w*.25,table.w*.25]) {
        let center=add(tablePose,normal,side*sideDistance);center=add(center,lateral,offset);
        candidates.push({x:center.x,y:center.y,rotation:tablePose.rotation,normal:{x:-side*normal.x,y:-side*normal.y},wallDir:{...lateral},wallIndex:-1,wallPoint:null,anchor:'relation',relation:'dining-seat',relationSide:side,slot:`dining-side-${side}-${round(offset,2)}`});
      }
      const endDistance=table.w/2+item.d/2+.12;
      for (const side of [-1,1]) {
        const center=add(tablePose,lateral,side*endDistance);
        candidates.push({x:center.x,y:center.y,rotation:(tablePose.rotation+90)%180,normal:{x:-side*lateral.x,y:-side*lateral.y},wallDir:{...normal},wallIndex:-1,wallPoint:null,anchor:'relation',relation:'dining-seat',relationSide:side,slot:`dining-end-${side}`});
      }
      return candidates;
    }

    function relativeBedBenchCandidates(item,state) {
      const bedPose=state.poses.bed,bed=ITEM_BY_ID.bed;
      if (!bedPose||!bed) return [];
      const lateral=bedPose.wallDir||{x:1,y:0};
      const forward=bed.d/2+item.d/2+.34;
      return [-.18,0,.18].map(offset=>{
        let center=add(bedPose,bedPose.normal,forward);center=add(center,lateral,offset);
        return {x:center.x,y:center.y,rotation:bedPose.rotation,normal:{...bedPose.normal},wallDir:{...lateral},wallIndex:-1,wallPoint:null,anchor:'relation',relation:'bed-foot',relationOffset:offset};
      });
    }

    function relativeVanityStoolCandidates(item,state) {
      const vanityPose=state.poses.vanity,vanity=ITEM_BY_ID.vanity;
      if (!vanityPose||!vanity) return [];
      const lateral=vanityPose.wallDir||{x:1,y:0};
      const forward=vanity.d/2+item.d/2+.26;
      return [-.18,0,.18].map(offset=>{
        let center=add(vanityPose,vanityPose.normal,forward);center=add(center,lateral,offset);
        return {x:center.x,y:center.y,rotation:vanityPose.rotation,normal:{x:-vanityPose.normal.x,y:-vanityPose.normal.y},wallDir:{...lateral},wallIndex:-1,wallPoint:null,anchor:'relation',relation:'vanity-seat',relationOffset:offset};
      });
    }

    function cornerCandidates(item,scene,relation='corner-zone') {
      const inset=Math.max(item.w,item.d)/2+.16;
      const points=[{x:inset,y:inset},{x:scene.width-inset,y:inset},{x:inset,y:scene.depth-inset},{x:scene.width-inset,y:scene.depth-inset}];
      const center={x:scene.width/2,y:scene.depth/2};
      return points.map((point,index)=>{
        const vx=center.x-point.x,vy=center.y-point.y,length=Math.hypot(vx,vy)||1;
        const normal={x:vx/length,y:vy/length};
        const rotation=Math.abs(normal.y)>=Math.abs(normal.x)?0:90;
        return {...point,rotation,normal,wallDir:{x:normal.y,y:-normal.x},wallIndex:-1,wallPoint:null,anchor:'zone',relation,slot:`corner-${index}`};
      });
    }

    function relationDistanceSamples(entry) {
      const fallback=Math.max(0,Number(entry?.gap)||0),distance=entry?.distance||{},min=Math.max(0,Number.isFinite(Number(distance.min))?Number(distance.min):fallback),max=Math.max(min,Number.isFinite(Number(distance.max))?Number(distance.max):min),step=Math.max(.05,Number(distance.step)||.20),values=[];
      for(let value=min;value<=max+EPS&&values.length<48;value+=step)values.push(round(value,3));
      if(values.length&&values[values.length-1]<max-EPS)values.push(round(max,3));
      return values.length?values:[fallback];
    }

    function relationReferenceShapePolicy(entry={},defaults={}){
      const raw=entry?.referenceShapePolicy?.lShape||{},has=(object,key)=>object&&Object.prototype.hasOwnProperty.call(object,key)&&object[key]!=null;
      const enabled=has(raw,'enabled')?raw.enabled!==false:has(entry,'excludeForLShape')?!entry.excludeForLShape:(defaults.enabled??true);
      const legacySide=has(entry,'avoidChaiseSide')?(entry.avoidChaiseSide?'non-chaise':'any'):null,lateralSide=['any','non-chaise','chaise-only'].includes(raw.lateralSide)?raw.lateralSide:(legacySide||defaults.lateralSide||'any');
      const legacyAlign=has(entry,'lShapeCrossAlign')?(entry.lShapeCrossAlign==='main-seat'?'main-seat':'body-center'):null,frontAlign=['bbox','body-center','main-seat'].includes(raw.frontAlign)?raw.frontAlign:(legacyAlign||defaults.frontAlign||'body-center');
      return {enabled,lateralSide,frontAlign};
    }
    function writeRelationReferenceShapePolicy(entry,defaults={}){
      const policy=relationReferenceShapePolicy(entry,defaults);entry.referenceShapePolicy={...(entry.referenceShapePolicy||{}),lShape:policy};
      // 兼容仍读取旧字段的历史配置与离线脚本。
      entry.excludeForLShape=!policy.enabled;entry.avoidChaiseSide=policy.lateralSide==='non-chaise';entry.lShapeCrossAlign=policy.frontAlign==='main-seat'?'main-seat':'bbox';return policy;
    }

    function genericRelativeCandidates(item,state,entry) {
      const relativeTo=entry?.relativeTo;
      if(!relativeTo)return [];
      const relation=entry.relation||`${relativeTo}-${entry.side||'front'}`,candidates=[],side=entry.side||'front',facing=Array.isArray(entry.facing)&&entry.facing.length?entry.facing:['parallel'],distances=relationDistanceSamples(entry),limit=Math.min(48,Math.max(1,Math.round(Number(entry.maxSamples)||12)));
      for(const [targetId,targetPose] of Object.entries(state.poses)){
        const target=ITEM_BY_ID[targetId];if(!target||target.typeId!==relativeTo)continue;
        const targetShape=targetPose.overrideShape||target.shape||'box',isLShape=targetShape==='l-left'||targetShape==='l-right',chaiseSide=targetShape==='l-left'?'left':targetShape==='l-right'?'right':null;
        // L 型关系约束全部由同一个策略声明：普通沙发不受影响，左右贵妃自动镜像。
        const shapePolicy=relationReferenceShapePolicy(entry);
        if(isLShape&&!shapePolicy.enabled)continue;
        if(isLShape&&(side==='left'||side==='right')){
          if(shapePolicy.lateralSide==='non-chaise'&&side===chaiseSide)continue;
          if(shapePolicy.lateralSide==='chaise-only'&&side!==chaiseSide)continue;
        }
        const targetDims=itemLocalDims(target,targetPose),itemDims=itemLocalDims(item),forward=targetPose.normal||{x:0,y:1},lateral=targetPose.wallDir||{x:1,y:0},isLateral=side==='left'||side==='right',axis=isLateral?lateral:forward,cross=isLateral?forward:lateral,sign=(side==='back'||side==='left')?-1:1,targetExtent=(isLateral?targetDims.w:targetDims.d)/2,crossAlign=entry.crossAlign||'center';
        for(const gap of distances)for(const orientation of facing){
          const direction={x:axis.x*sign,y:axis.y*sign},itemExtent=(orientation==='parallel'&&isLateral?itemDims.w:itemDims.d)/2;let center=add(targetPose,direction,targetExtent+itemExtent+gap),crossOffset=0;
          if(isLateral){const room=Math.max(0,(targetDims.d-itemDims.d)/2);if(crossAlign==='back')crossOffset=-room;else if(crossAlign==='front')crossOffset=room}else{const room=Math.max(0,(targetDims.w-itemDims.w)/2);if(crossAlign==='left')crossOffset=-room;else if(crossAlign==='right')crossOffset=room}
          crossOffset+=Number(entry.crossOffset)||0;
          // 茶几对齐 L 型沙发的主坐面，而不是包含贵妃榻在内的外包框中心。
          if(isLShape&&!isLateral&&shapePolicy.frontAlign==='main-seat')crossOffset+=(chaiseSide==='left'?1:-1)*Math.min(.48,targetDims.w*.17);
          center=add(center,cross,crossOffset);
          const compound=entry.compoundConstraint;
          if(compound?.ancestorRelativeTo&&compound.side==='front'&&side==='front'&&targetPose.relationTarget){
            const ancestorId=targetPose.relationTarget,ancestor=ITEM_BY_ID[ancestorId],ancestorPose=state.poses[ancestorId];
            if(ancestor&&ancestorPose&&ancestor.typeId===compound.ancestorRelativeTo){
              const childCrossCenter=dot(center,cross),childCrossHalf=itemDims.w/2,relevant=footprintRects(ancestor,ancestorPose).filter(rect=>{
                const rectCross=dot(rect,cross),rectHalf=Math.abs(cross.x)*rect.w/2+Math.abs(cross.y)*rect.d/2;
                return childCrossCenter+childCrossHalf>rectCross-rectHalf+EPS&&childCrossCenter-childCrossHalf<rectCross+rectHalf-EPS;
              });
              if(relevant.length){
                const ancestorFront=Math.max(...relevant.map(rect=>dot(rect,direction)+Math.abs(direction.x)*rect.w/2+Math.abs(direction.y)*rect.d/2)),childBack=dot(center,direction)-itemDims.d/2,shift=ancestorFront+Math.max(0,Number(compound.gap)||0)-childBack;
                if(shift>0)center=add(center,direction,shift);
              }
            }
          }
          // 床头柜不能只依赖“back”的语义解释：直接把床头柜后沿投影到床头沿。
          // 这样无论床靠哪一面墙、旋转为何值，都会严格齐头而非落在床侧中段。
          let headAligned=false;
          if(isLateral&&target.typeId==='bed'&&crossAlign==='back'){
            const desired=dot(targetPose,cross)-targetDims.d/2+itemDims.d/2,current=dot(center,cross);center=add(center,cross,desired-current);headAligned=true;
          }
          let normal;
          if(orientation==='toward')normal={x:-direction.x,y:-direction.y};else if(orientation==='away')normal={...direction};else normal={...forward};
          const rotation=Math.abs(normal.y)>=Math.abs(normal.x)?0:90,wallDir={x:normal.y,y:-normal.x};
          candidates.push({...center,rotation,normal,wallDir,wallIndex:-1,wallPoint:null,anchor:'relation',relation,relationTarget:targetId,relationSide:side,relationAxis:{...direction},candidateRuleId:entry.id||relation,candidateFacing:orientation,relationGap:gap,crossAlign,headAligned,slot:`${targetId}-${side}-${crossAlign}-${orientation}-${round(gap,2)}`});
          if(candidates.length>=limit)return candidates;
        }
      }
      return candidates;
    }

    function genericWallRelativeCandidates(item,state,scene,entry) {
      const relativeTo=entry?.relativeTo;if(!relativeTo)return [];
      const distances=relationDistanceSamples(entry),minGap=Math.min(...distances)-.08,maxGap=Math.max(...distances)+.08,side=entry.side||'front',facing=Array.isArray(entry.facing)&&entry.facing.length?entry.facing:['parallel'],relation=entry.relation||`${relativeTo}-${side}`,limit=Math.min(48,Math.max(1,Math.round(Number(entry.maxSamples)||12))),rows=[],shapePolicy=relationReferenceShapePolicy(entry),isLateral=side==='left'||side==='right';
      for(const originalWallPose of wallPoseCandidates(item,scene,state))for(const [targetId,targetPose] of Object.entries(state.poses)){
        const target=ITEM_BY_ID[targetId];if(!target||target.typeId!==relativeTo)continue;
        const targetDims=itemLocalDims(target,targetPose),forward=targetPose.normal||{x:0,y:1},lateral=targetPose.wallDir||{x:1,y:0},axis=isLateral?lateral:forward,cross=isLateral?forward:lateral,sign=(side==='back'||side==='left')?-1:1;
        let wallPose=originalWallPose,delta={x:wallPose.x-targetPose.x,y:wallPose.y-targetPose.y};
        // “主体中心”是几何约束，不只是评分偏好。把沿墙离散采样点投影到沙发主体
        // 中心线，避免电视柜因 10cm 采样网格产生几厘米乃至一整格的偏心。
        if(!isLateral&&shapePolicy.frontAlign==='body-center'){
          const shift=-dot(delta,cross);wallPose={...wallPose,x:wallPose.x+cross.x*shift,y:wallPose.y+cross.y*shift};delta={x:wallPose.x-targetPose.x,y:wallPose.y-targetPose.y};
        }
        const itemDims=itemLocalDims(item,wallPose),targetExtent=(isLateral?targetDims.w:targetDims.d)/2,itemExtent=(Math.abs(dot(wallPose.normal,axis))>.7?itemDims.d:itemDims.w)/2,gap=dot(delta,axis)*sign-targetExtent-itemExtent,crossOffset=Math.abs(dot(delta,cross)),crossLimit=((isLateral?targetDims.d:targetDims.w)+(Math.abs(dot(wallPose.normal,cross))>.7?itemDims.d:itemDims.w))/2+.55;
        if(gap<minGap||gap>maxGap||crossOffset>crossLimit)continue;
        const towardVector={x:targetPose.x-wallPose.x,y:targetPose.y-wallPose.y},length=Math.hypot(towardVector.x,towardVector.y)||1,toward={x:towardVector.x/length,y:towardVector.y/length},orientation=facing.find(mode=>mode==='toward'?dot(wallPose.normal,toward)>.65:mode==='away'?dot(wallPose.normal,toward)<-.65:dot(wallPose.normal,forward)>.65);if(!orientation)continue;
        rows.push({...wallPose,relation,relationTarget:targetId,relationSide:side,candidateRuleId:entry.id||relation,candidateFacing:orientation,relationGap:round(gap,3),slot:`${targetId}-wall-${side}-${orientation}-${round(gap,2)}`});if(rows.length>=limit)return rows;
      }
      return rows;
    }

    function configuredRuleCandidates(item,state,scene) {
      const rule=furnitureRule(item),candidate=rule?.candidate||{mode:'wall'};let entries=Array.isArray(candidate.rules)&&candidate.rules.length?candidate.rules.filter(entry=>entry.enabled!==false):[candidate];
      const bedroomAspect=Math.max(scene.width/Math.max(scene.depth,EPS),scene.depth/Math.max(scene.width,EPS));
      const hotelBedroom=currentProgram==='bedroom'&&scene.shape==='recognized'&&bedroomAspect>=1.65;
      const relationPolicy=(LAYOUT_CONSTRAINTS.relationPolicies||[]).find(policy=>policy.program===currentProgram&&policy.typeId===item.typeId&&
        (!policy.shape||policy.shape===scene.shape)&&scene.area+EPS>=(policy.minArea||0)&&bedroomAspect+EPS>=(policy.minAspect||0));
      if(relationPolicy){const required=entries.filter(entry=>entry.relation===relationPolicy.requiredRelation);if(required.length)entries=required;}
      // 20㎡以上若库存已选择完整小沙发会客组，电视柜仍作为会客锚点先贴墙，
      // 后续小沙发再正对它；酒店式“正对床”只服务没有小沙发的长条卧室。
      if(item.typeId==='tvbench'&&(CONFIGS.bedroom.counts.bedroomLoveseat||0)>0&&!hotelBedroom)entries=entries.filter(entry=>entry.relativeTo!=='bed');
      // 酒店型长卧室中，电视柜继续服务床；小沙发是独立的第二落座点，可以
      // 正对电视，也可以贴剩余墙角。不能因为已有电视柜就删掉它的墙面候选。
      if(item.typeId==='bedroomLoveseat'&&state.poses.tvbench&&!hotelBedroom){const related=entries.filter(entry=>entry.mode==='relation'&&entry.relativeTo==='tvbench');if(related.length)entries=related;}
      const totalLimit=Math.min(rule?.infill?24:72,Math.max(4,Math.round(Number(candidate.maxCandidates)||32))),buckets=[];
      if(rule?.infill)return customInfillCandidates(item,scene,state).slice(0,totalLimit);
      for(const entry of entries){const mode=entry.mode||'wall',relation=entry.relation||'custom-zone',perRule=Math.min(48,Math.max(1,Math.round(Number(entry.maxSamples)||12)));let rows=[];
        if(mode==='corner'&&(entry.requiredAnchor==='wall'||rule?.allowCorner))rows=wallPoseCandidates(item,scene,state).filter(pose=>(pose.wallEndGap??Infinity)<=.12);else if(mode==='corner')rows=cornerCandidates(item,scene,relation);else if(mode==='zone')rows=roomZoneCandidates(item,scene,relation,state);else if(mode==='relation'&&rule?.requiredAnchor==='wall')rows=genericWallRelativeCandidates(item,state,scene,entry);else if(mode==='relation')rows=genericRelativeCandidates(item,state,entry);else rows=wallPoseCandidates(item,scene,state);
        // 超大卧室的电视柜先于沙发落子，必须从四面墙均匀找锚点。若仍按轮廓
        // 顺序截前 N 个，第一面墙被床占满后就会误判“无位置”。只在这一档启用
        // 按墙轮采，避免改变普通房间已经稳定的墙面落子排序。
        if(mode==='wall'&&['tvbench','bedroomLoveseat'].includes(item.typeId)&&(roomAreaTier('bedroom',scene.area).id==='studio'||bedroomAspect>=1.65)&&rows.length>perRule){const wallBuckets=new Map();for(const pose of rows){const key=Number.isFinite(pose.wallIndex)?pose.wallIndex:-1;if(!wallBuckets.has(key))wallBuckets.set(key,[]);wallBuckets.get(key).push(pose)}const distributed=[];for(let index=0;distributed.length<rows.length;index++){let added=false;for(const bucket of wallBuckets.values())if(bucket[index]){distributed.push(bucket[index]);added=true}if(!added)break}rows=distributed}
        // 墙面按轮廓顺序生成，异形房间的窗边墙常排在最后。书桌若直接截取
        // 前 N 个候选，窗边位置甚至进不了评分。先把自然采光候选提到桶前面，
        // 其余位置仍由后续合法性、椅子和通路共同筛选。
        if(item.typeId==='desk'&&mode==='wall'&&scene.window?.mid)rows.sort((a,b)=>dist(a,scene.window.mid)-dist(b,scene.window.mid));
        // 带模数的沿墙家具已根据“当前剩余连续墙段”生成了 wall-run 语义点。
        // 先保留这些高信息量点，再用固定等分点补齐预算；不扩大 maxSamples，
        // 却能避免空墙中点被轮廓前部的无效原始点挤出 Beam。
        if(item.typeId==='bedroomDisplay'&&rule?.run&&mode==='wall')rows.sort((a,b)=>Number(b.relation==='wall-run')-Number(a.relation==='wall-run'));
        buckets.push(rows.slice(0,perRule).map(pose=>({...pose,candidateRuleId:pose.candidateRuleId||entry.id||relation})));
      }
      const all=[];for(let index=0;all.length<totalLimit;index++){let added=false;for(const bucket of buckets)if(bucket[index]){all.push(bucket[index]);added=true;if(all.length>=totalLimit)break}if(!added)break}return all;
    }

    function relativeLampCandidates(item,state,scene) {
      const candidates=[];
      const sofaPose=state.poses.sofa,sofa=ITEM_BY_ID.sofa;
      if (sofaPose&&sofa) for (const sign of [-1,1]) {
        let center=add(sofaPose,sofaPose.wallDir,sign*(sofa.w/2+item.w/2+.12));
        center=add(center,sofaPose.normal,-.04);
        candidates.push({x:center.x,y:center.y,rotation:sofaPose.rotation,normal:{...sofaPose.normal},wallDir:{...sofaPose.wallDir},wallIndex:-1,wallPoint:null,anchor:'relation',relation:'seat-light',relationSide:sign,slot:`sofa-light-${sign}`});
      }
      for (const [id,pose] of Object.entries(state.poses).filter(([id])=>id.startsWith('arm'))) {
        const chair=ITEM_BY_ID[id],lateral=pose.wallDir||{x:1,y:0};
        for (const sign of [-1,1]) {
          const center=add(pose,lateral,sign*(chair.w/2+item.w/2+.10));
          candidates.push({x:center.x,y:center.y,rotation:pose.rotation,normal:{...pose.normal},wallDir:{...lateral},wallIndex:-1,wallPoint:null,anchor:'relation',relation:'seat-light',relationSide:sign,slot:`${id}-light-${sign}`});
        }
      }
      return candidates.concat(cornerCandidates(item,scene,'corner-light'));
    }

    function windowOverlap(item, pose, scene) {
      return footprintRects(item,pose).some(rect=>{
        const nearTop = rect.y - rect.d/2 < .09;
        const x0 = rect.x-rect.w/2;
        const x1 = rect.x+rect.w/2;
        return nearTop&&x1>scene.window.x0&&x0<scene.window.x1;
      });
    }

    function furnitureRule(item) {
      return FURNITURE_RULES[item.typeId]||FURNITURE_RULES.default;
    }

    function zoneRectFromSpec(item,pose,spec) {
      const normal=pose.normal||(pose.rotation%180===0?{x:0,y:1}:{x:1,y:0});
      const lateral=pose.wallDir||(pose.rotation%180===0?{x:1,y:0}:{x:0,y:1});
      const local=itemLocalDims(item,pose);
      let direction=spec.direction?{...spec.direction}:normal,bodyExtent=local.d/2,span=local.w+(spec.spanExtra||0)*2;
      if (spec.side==='back') direction={x:-normal.x,y:-normal.y};
      if (spec.side==='left'||spec.side==='right') {
        const sign=spec.side==='left'?-1:1;
        direction={x:lateral.x*sign,y:lateral.y*sign};bodyExtent=local.w/2;
        span=local.d+(spec.spanExtra||0)*2;
      }
      // depth=0 是明确关闭该家具独立使用区，不能用 `||` 回退成默认 0.42 m。
      const rawDepth=Number(spec.depth),depth=Number.isFinite(rawDepth)?Math.max(0,rawDepth):.42;
      let center=add(pose,direction,bodyExtent+(spec.gap||.025)+depth/2);
      if(spec.alignStart){const cross=(spec.side==='left'||spec.side==='right')?normal:lateral;center=add(center,cross,spec.spanExtra||0)}
      const alongX=Math.abs(direction.x)>=Math.abs(direction.y);
      return alongX?{x:center.x,y:center.y,w:depth,d:span}:{x:center.x,y:center.y,w:span,d:depth};
    }

    function functionalZones(item,pose) {
      const rule=furnitureRule(item);
      let specs=rule.zones||[rule.service||FURNITURE_RULES.default.service];
      const base=specs[0];
      if(base?.adaptiveFootZone&&item.typeId==='bench'&&pose.relation==='bed-foot'&&pose.relationAxis){
        const gap=Math.max(0,Number(pose.relationGap)||0),threshold=Math.max(.20,Number(base.adaptiveGapThreshold)||.30),between=gap>=threshold;
        // 标准床尾凳只与床尾留 10~15cm 小缝；外侧只保留约 42cm 的起身带。
        // 功能区之间不互相做碰撞拒绝，因此它可与通行区、床尾活动区共享。
        // 保留 between 分支仅用于兼容显式导入的非标准规则。
        const axis=pose.relationAxis,direction=between?{x:-axis.x,y:-axis.y}:{...axis};
        const depth=between?Math.max(.30,Math.min(Number(base.depth)||.42,gap-.04)):Math.max(.42,Number(base.depth)||.42);
        specs=[{...base,label:between?'床凳间共享落脚区':'床尾凳共享落脚区',side:'dynamic',direction,depth,gap:between?.02:(base.gap||.025),hard:base.hard!==false,sharedCirculation:true,allowBodyTypes:[]}];
      }
      return specs.map((spec,index)=>({...spec,index,rect:zoneRectFromSpec(item,pose,spec)}));
    }

    function serviceZone(item,pose) {
      return functionalZones(item,pose)[0].rect;
    }

    function hardFunctionalZones(item,pose) {
      return functionalZones(item,pose).filter(zone=>zone.hard);
    }

    function ruleAllowsBody(zoneOwner,bodyItem,zone,bodyPose,zoneOwnerPose=null) {
      if (relationPairRule(zoneOwner,zoneOwnerPose,bodyItem,bodyPose)?.allowFunctionalOverlap) return true;
      if (!zone.allowBodyTypes?.includes(bodyItem.typeId)) return false;
      return true;
    }

    function staticFurnitureRulesPass(item,pose,scene,zones=hardFunctionalZones(item,pose)) {
      const rule=furnitureRule(item);
      if (rule.requiredAnchor==='wall'&&pose.anchor!=='wall'&&!(pose.wallIndex>=0)) return false;
      if (rule.avoidWindow&&windowOverlap(item,pose,scene)) return false;
      for (const zone of zones) {
        if (!rectInsidePolygon(zone.rect,scene.polygon)) return false;
        if (overlapsDoorClearance(zone.rect,scene,.01)) return false;
      }
      return true;
    }

    function functionalConflict(item,pose,state,candidateZones=hardFunctionalZones(item,pose)) {
      const candidateRects=footprintRects(item,pose);
      for (const [id,otherPose] of Object.entries(state.poses)) {
        const other=ITEM_BY_ID[id],otherRects=footprintRects(other,otherPose);
        for (const zone of hardFunctionalZones(other,otherPose)) {
          if (candidateRects.some(rect=>rectsOverlap(rect,zone.rect,0))&&!ruleAllowsBody(other,item,zone,pose,otherPose)) return true;
        }
        for (const zone of candidateZones) {
          if (otherRects.some(rect=>rectsOverlap(rect,zone.rect,0))&&!ruleAllowsBody(item,other,zone,otherPose,pose)) return true;
        }
      }
      return false;
    }

    function legalityCheck(item,pose,state,scene) {
      if (!footprintInside(item,pose,scene.polygon)) return {legal:false,reason:'outside',label:'超出房间边界'};
      if (footprintRects(item,pose).some(rect=>overlapsDoorClearance(rect,scene,.01))) return {legal:false,reason:'door',label:'占用门洞或门扇区'};
      const zones=hardFunctionalZones(item,pose);
      if (!staticFurnitureRulesPass(item,pose,scene,zones)) return {legal:false,reason:'static',label:'违反门窗、墙面或静态功能区'};
      for (const [id,otherPose] of Object.entries(state.poses)) {
        const other=ITEM_BY_ID[id];
        if (footprintsOverlap(item,pose,other,otherPose,pairCollisionClearance(item,pose,other,otherPose))) return {legal:false,reason:'collision',label:`与${itemBaseLabel(other)}碰撞`};
      }
      if(functionalConflict(item,pose,state,zones))return {legal:false,reason:'functional',label:'侵占家具硬使用区'};
      return {legal:true,reason:'legal',label:'硬规则合法'};
    }

    function isLegal(item,pose,state,scene) {
      return legalityCheck(item,pose,state,scene).legal;
    }

    function validateState(state,scene) {
      const violations=[];
      const partial={poses:{}};
      for (const item of FURNITURE) {
        const pose=state.poses[item.id];
        if (!pose) {if(!item.optional)violations.push(`${item.id}:missing`);continue;}
        if (!isLegal(item,pose,partial,scene)) violations.push(`${item.id}:body-or-functional-zone`);
        partial.poses[item.id]=pose;
      }
      return {valid:violations.length===0,violations};
    }

    function poseIdentity(pose) {
      return [round(pose.x,2),round(pose.y,2),pose.rotation,pose.relation||'none',pose.wallIndex??-1,
        round(pose.normal?.x||0,2),round(pose.normal?.y||0,2),round(pose.wallDir?.x||0,2),round(pose.wallDir?.y||0,2),
        round(pose.wallPoint?.x||0,2),round(pose.wallPoint?.y||0,2),pose.relationSide??0,pose.slot||'none',round(pose.overrideW||0,2),round(pose.overrideD||0,2),pose.overrideShape||'box'].join(',');
    }

    function physicalPoseIdentity(item,pose) {
      return [round(pose.x,2),round(pose.y,2),pose.rotation,
        round(pose.normal?.x||0,2),round(pose.normal?.y||0,2),
        round(pose.overrideW||item.w,2),round(pose.overrideD||item.d,2),pose.overrideShape||item.shape||'box'].join(',');
    }

    function itemTypeCount(item) {
      return FURNITURE.filter(row=>(row.typeId||row.id)===(item.typeId||item.id)).length;
    }

    function itemStepLabel(item) {
      if(!item)return '';
      const siblings=FURNITURE.filter(row=>(row.typeId||row.id)===(item.typeId||item.id));
      const base=itemBaseLabel(item);
      return siblings.length>1?`${base} ${siblings.indexOf(item)+1}/${siblings.length}`:base;
    }

    function itemBaseLabel(item) {return PROGRAMS[currentProgram].types.find(row=>row.id===(item.typeId||item.id))?.label||item.label;}
    function itemDisplayLabel(item,pose) {
      const base=itemBaseLabel(item),variant=String(pose?.sizeLabel||'').trim();
      if(!variant||/^(普通\s*)?(box|标准形)$/i.test(variant))return base;
      return variant.includes(base)?variant:`${base} · ${variant}`;
    }

    function poseKey(item, pose) {
      return `${item.id}:${poseIdentity(pose)}`;
    }

    function itemVariantWidths(typeId) {
      const item=FURNITURE.find(piece=>piece.typeId===typeId);
      if(!item)return [];
      return [...new Set([item.w,...(item.sizeVariants||[]).map(variant=>variant.w)]
        .map(Number).filter(Number.isFinite).map(value=>round(value,2)))];
    }

    // 把后续紧邻家具的模数反向投影到当前床候选上。这样床不是只按自身
    // 中心/等分点采样，而会同时考虑“床 + 1/2 个床头柜 + 书桌”能否闭合整段墙。
    function bedWallModuleScore(item,pose,scene) {
      if(item.typeId!=='bed'||pose.wallIndex==null||pose.wallIndex<0)return 0;
      const wall=scene.walls[pose.wallIndex],bedWidth=itemLocalDims(item,pose).w;
      if(!wall)return 0;
      const selectedNightCount=FURNITURE.filter(piece=>piece.typeId==='night').length;
      const nightWidths=itemVariantWidths('night');
      const deskWidths=FURNITURE.some(piece=>piece.typeId==='desk')?itemVariantWidths('desk'):[];
      const totals=[];
      // 床独立贴墙、床加一个床头柜，以及完整双床头柜床组都保留。
      for(let count=0;count<=Math.min(2,selectedNightCount);count++){
        const widths=count?nightWidths:[0];
        for(const nightWidth of widths){
          totals.push({total:bedWidth+count*nightWidth,count,nightWidth,withDesk:false});
          for(const deskWidth of deskWidths)totals.push({total:bedWidth+count*nightWidth+deskWidth,count,nightWidth,withDesk:true});
        }
      }
      if(!totals.length)return 0;
      totals.sort((a,b)=>Math.abs(wall.length-a.total)-Math.abs(wall.length-b.total)||b.count-a.count||Number(b.withDesk)-Number(a.withDesk));
      const best=totals[0],residual=Math.abs(wall.length-best.total);
      let score=residual<=.025?24:residual<=.08?17:residual<=.18?8:residual<.60?-Math.min(10,residual*18):0;
      // 只有候选本身也按相同床头柜模数靠向墙端时，才视为可兑现的闭合方案。
      if(best.count>0&&pose.bedsideReserve!=null&&Math.abs(pose.bedsideReserve-best.nightWidth)<=.012)score+=10;
      if(best.count===0&&pose.wallEndGap<=.012)score+=8;
      return score;
    }

    function candidateStaticScore(item, pose, state, scene) {
      let score = pose.anchor === 'wall' ? 8 : 15;
      const candidateConfig=furnitureRule(item)?.candidate,candidateRows=Array.isArray(candidateConfig?.rules)?candidateConfig.rules:[],configuredEntry=candidateRows.find(row=>(row.id||row.relation)===pose.candidateRuleId)||candidateRows.find(row=>row.relation&&row.relation===pose.relation);if(configuredEntry)score+=24+(clamp(Number(configuredEntry.weight)||1,0,3)-1)*14;
      const rect = poseRect(pose,item);
      const roomCenter = {x:scene.width/2,y:scene.depth/2};
      const distanceFromEntry = dist(pose,scene.door.entry);
      if (item.typeId === 'bed') {
        score += 31 + Math.min(9,distanceFromEntry*2.2);
        if (windowOverlap(item,pose,scene)) score -= 20;
        const actual=itemLocalDims(item,pose),bedCount=itemTypeCount(item);
        const targetWidth=bedCount>1?(scene.area>=30?1.50:1.20):(scene.area>=18?1.80:scene.area>=11?1.50:1.20);
        score += 16-Math.abs(actual.w-targetWidth)*24;
        // 床刚落下时只轻微保留“床头柜外沿可贴侧墙”的候选；真正的零缝奖励
        // 等床头柜落下后再计算，避免第一手过强加分挤掉更可行的 Beam 分支。
        if(pose.bedsideReserve!=null)score+=4;
        score+=bedWallModuleScore(item,pose,scene);
      }
      if (item.id === 'wardrobe') {
        score += 22;
        if (windowOverlap(item,pose,scene)) score -= 58;
      }
      if (item.id === 'desk') {
        score += 16;
        const actual=itemLocalDims(item,pose);
        // 书桌背边已经由 wallPose 精确贴墙；这里进一步偏好宽模数和靠墙端闭合，
        // 避免同一段空墙明明容得下 1.2/1.4m，却选 0.9m 后留下碎缝。
        // 长桌是受控偏好，而不是压倒后续家具容量的局部绝对优势。
        score += actual.w*7;
        const closureGap=Math.min(Number.isFinite(pose.wallEndGap)?pose.wallEndGap:Infinity,Number.isFinite(pose.wallClosureGap)?pose.wallClosureGap:Infinity);
        if(Number.isFinite(closureGap))score += closureGap<=.025?12:closureGap<=.08?7:Math.max(-6,2-closureGap*9);
        // 1.60m 成品桌放进约 1.69m 窗墙时，贴死一侧会在另一角留下约 9cm
        // 难清洁缝；居中后两侧各约 4cm，属于可收口安装缝。对这种短墙优先
        // 平分余量，而不是机械奖励“单侧零缝”。
        if(pose.wallIndex>=0){const wall=scene.walls[pose.wallIndex],residual=Math.max(0,wall.length-actual.w),installGap=DESIGN_QUALITY_RULES.wall.installGapMax;if(residual>installGap&&residual<=installGap*2+EPS){const targetGap=residual/2,actualGap=Math.max(0,Number(pose.wallEndGap)||0);score+=16-Math.min(16,Math.abs(actualGap-targetGap)*180)}}
        if(Number.isFinite(pose.wallSegmentFill))score+=clamp((pose.wallSegmentFill-.48)/.42,0,1)*6;
        const nearWindow = Math.max(0, 1.6-dist(pose,scene.window.mid));
        score += nearWindow*22;
        if (windowOverlap(item,pose,scene)) score += 18;
      }
      if (item.id === 'vanity') {
        score += 18+Math.max(0,1.8-dist(pose,scene.window.mid))*12;
        if (windowOverlap(item,pose,scene)) score += 8;
      }
      if (item.id.startsWith('chest')||item.id==='shelf'||item.id==='tvbench') {
        score += 22;
        if (windowOverlap(item,pose,scene)) score -= 48;
      }
      const bedroomMediaAspect=Math.max(scene.width/Math.max(scene.depth,EPS),scene.depth/Math.max(scene.width,EPS));
      const recognizedHotelBedroom=currentProgram==='bedroom'&&scene.shape==='recognized'&&bedroomMediaAspect>=1.65;
      if(item.typeId==='tvbench'&&currentProgram==='bedroom'&&!recognizedHotelBedroom&&roomAreaTier('bedroom',scene.area).id==='studio'&&(CONFIGS.bedroom.counts.bedroomLoveseat||0)>0){
        // 超大卧室里电视柜是会客组的第一手，不能只看“自己贴墙是否漂亮”。
        // 在候选进入 Beam 前做一次很小的后继可行性检查：柜前若完全放不下
        // 正对的小沙发，这个锚点就是死棋；能形成会客组的墙位则大幅优先。
        const loveseat=FURNITURE.find(piece=>piece.typeId==='bedroomLoveseat');let loungeFeasible=false;
        if(loveseat){const nextState={...state,poses:{...state.poses,[item.id]:pose}};for(const futurePose of configuredRuleCandidates(loveseat,nextState,scene)){if(isLegal(loveseat,futurePose,nextState,scene)){loungeFeasible=true;break}}}
        score+=loungeFeasible?72:-120;
      }
      if (!configuredEntry&&item.id.startsWith('night')) {
        score += pose.relation === 'bed-side' ? 52 : -12;
        const actual=itemLocalDims(item,pose),target=scene.area<11?.35:scene.area>18?.55:.45;
        score += 7-Math.abs(actual.w-target)*22;
      }
      if(item.typeId==='night'&&pose.relationTarget){
        const bedPose=state.poses[pose.relationTarget],reserved=bedPose?.bedsideReserve,actual=itemLocalDims(item,pose);
        if(reserved>0)score+=20-Math.abs(actual.w-reserved)*80;
        // bedPose.wallEndGap 是床侧边到墙端的距离；等于床头柜宽度时，
        // 床头柜外沿恰好与侧墙齐平。此时再给强奖励，不会破坏前面落床的可行性排序。
        if(Number.isFinite(bedPose?.wallEndGap)&&bedPose.wallEndGap>0)score+=Math.max(-8,38-Math.abs(bedPose.wallEndGap-actual.w)*110);
      }
      if (!configuredEntry&&item.id === 'chair') score += pose.relation === 'desk-front' ? 48 : -10;
      if(item.typeId==='bench'){
        // 可编辑规则生成的床尾候选也必须得到语义奖励，否则正确候选会被“跳过 0 件”压掉。
        score+=pose.relation==='bed-foot'?58:-18;
        if(pose.relation==='bed-foot'&&Number.isFinite(Number(pose.relationGap)))score+=Math.max(-8,12-Math.abs(Number(pose.relationGap)-.12)*80);
      }
      if (!configuredEntry&&item.id === 'vanityStool') score += pose.relation === 'vanity-seat' ? 50 : -16;
      if(item.typeId==='lounge'){
        // 休闲椅优先背靠墙，墙面候选的实体后沿由 wallPose 精确落在线上；
        // 自由活动区仍保留为异形/满房时的兜底，但不再压过可用的贴墙方案。
        score+=pose.anchor==='wall'?34+(pose.wallEndGap<=.04?7:0):pose.relation==='reading-open-zone'?-12:-6;
      }
      if(item.typeId==='bedroomLoveseat'&&recognizedHotelBedroom){
        // 酒店式长卧室里的小沙发是独立补座，不要求抢走床对电视的主轴。
        // 背靠剩余墙面最稳定，其次才是开放区；只要通行合法就应压过 skip。
        score+=pose.anchor==='wall'?52:pose.relation==='bedroom-seat-media-facing'?34:22;
      }
      if(pose.anchor==='wall'&&Number.isFinite(pose.wallEndGap)&&['wardrobe','desk','chest','shelf','tvbench','bedroomDisplay','lounge','sideboard','bookcase','display','console'].includes(item.typeId)){
        // 成品家具的小/中/大模数不仅参与面积适配，也参与“墙端收口”评分。
        // 完全收齐墙端最优；保留 5–8cm 安装缝仍有小奖励，较大无意义缝隙不再占优。
        const storageLike=['wardrobe','chest','shelf','tvbench','bedroomDisplay','sideboard','bookcase','display','console'].includes(item.typeId);
        // 普通柜体仍按墙端收口计分；相邻家具闭缝的额外奖励目前只给书桌，
        // 避免所有沿墙家具同时抢邻接位点而压缩后续可摆容量。
        const closureGap=pose.wallEndGap;
        const wall=scene.walls[pose.wallIndex],actual=itemLocalDims(item,pose),residual=Math.max(0,(wall?.length||actual.w)-actual.w),balancedDeskInstall=item.typeId==='desk'&&residual>DESIGN_QUALITY_RULES.wall.installGapMax&&residual<=DESIGN_QUALITY_RULES.wall.installGapMax*2+EPS;
        if(balancedDeskInstall){const targetGap=residual/2;score+=18-Math.min(24,Math.abs(closureGap-targetGap)*240)}
        else score+=closureGap<=.025?(storageLike?22:16):closureGap<=DESIGN_QUALITY_RULES.wall.installGapMax?(storageLike?13:9):
          closureGap<=DESIGN_QUALITY_RULES.wall.severeGapMax?-44:closureGap<DESIGN_QUALITY_RULES.wall.usefulBayMin?-17:0;
        // 家具贴到墙端时，还要检查与相邻转角短墙的深度收口。
        // 例如 0.32m 深浅柜靠在 0.49m 返墙旁，会留下 0.17m 死缝；
        // 这种候选应在落子时被压低，不等最终墙面验收才淘汰整盘。
        const along=wall?dot({x:pose.x-wall.a.x,y:pose.y-wall.a.y},wall.dir):0,startGap=along-actual.w/2,endGap=(wall?.length||0)-(along+actual.w/2);
        const adjacentWalls=[];
        if(startGap<=DESIGN_QUALITY_RULES.wall.installGapMax+EPS)adjacentWalls.push(scene.walls[(pose.wallIndex-1+scene.walls.length)%scene.walls.length]);
        if(endGap<=DESIGN_QUALITY_RULES.wall.installGapMax+EPS)adjacentWalls.push(scene.walls[(pose.wallIndex+1)%scene.walls.length]);
        for(const adjacent of adjacentWalls){
          const returnGap=(adjacent?.length||0)-actual.d;
          if(returnGap<=DESIGN_QUALITY_RULES.wall.installGapMax+EPS)score+=10;
          else if(returnGap<=DESIGN_QUALITY_RULES.wall.severeGapMax+EPS)score-=86;
          else if(returnGap<DESIGN_QUALITY_RULES.wall.usefulBayMin-EPS)score-=30;
        }
      }
      if (!configuredEntry&&item.id === 'hamper') score += pose.relation === 'utility-corner' ? 32 : -8;
      if (item.id === 'sofa') {
        score += 34 + Math.min(8,distanceFromEntry*1.4);
        if (windowOverlap(item,pose,scene)) score -= 10;
        if ((pose.overrideShape||item.shape)?.startsWith('l-')) score += 4;
        if(pose.relation==='floating-sofa'&&pose.normal){
          const body=poseRect(pose,item),half=Math.abs(pose.normal.x)>.5?body.w/2:body.d/2;
          const rear={x:pose.x-pose.normal.x*half,y:pose.y-pose.normal.y*half};
          let rearGap=Infinity;for(let index=0;index<scene.polygon.length;index++)rearGap=Math.min(rearGap,pointSegmentDistance(rear,scene.polygon[index],scene.polygon[(index+1)%scene.polygon.length]));
          // 沙发背后要么贴实，要么留出真正可走的通道；半米左右的夹层最容易成为死角。
          score+=rearGap<=.10?12:rearGap<.78?-34:rearGap<.92?4:13;
        }
      }
      if (item.id === 'tv') {
        // 配置规则命中后也必须继续计算关系语义；旧逻辑因 configuredEntry 存在
        // 跳过了这项，导致“任意空墙电视柜”偶尔压过“与沙发正对”的电视柜。
        score += pose.relation === 'sofa-facing' ? 66 : 4;
        if (state.poses.sofa) {
          const sofaPose=state.poses.sofa,vector={x:pose.x-sofaPose.x,y:pose.y-sofaPose.y},length=Math.hypot(vector.x,vector.y)||1,towardTv={x:vector.x/length,y:vector.y/length};
          const sofaFacesTv=dot(sofaPose.normal||{x:0,y:1},towardTv),tvFacesSofa=dot(pose.normal||{x:0,y:1},{x:-towardTv.x,y:-towardTv.y});
          score += clamp(20-Math.abs(length-2.7)*9,-8,20)+clamp(sofaFacesTv*28,-34,28)+clamp(tvFacesSofa*18,-24,18);
        }
        if (windowOverlap(item,pose,scene)) score -= 72;
      }
      if (item.typeId === 'coffee') {
        score += pose.relation === 'sofa-front' ? 54 : -18;
        if(pose.relation==='sofa-front'&&Number.isFinite(Number(pose.relationGap))){
          const preferred=configuredEntry?.preferredDistance||DESIGN_GRAMMAR.living.pairs.sofaCoffee;
          const min=Number(preferred?.min??preferred?.gap?.[0]??.40),max=Number(preferred?.max??preferred?.gap?.[1]??.45),tolerance=Number(preferred?.tolerance)||.12;
          score+=bandScore(Number(pose.relationGap),min,max,tolerance)*22-6;
        }
      }
      if (item.id === 'diningTable') {
        score += pose.relation==='dining-wall'?30:pose.relation==='dining-zone'?18:0;
        if (state.poses.sofa) score += clamp((dist(pose,state.poses.sofa)-1.35)*8,-18,18);
      }
      if (!configuredEntry&&item.id.startsWith('diningChair')) score += pose.relation==='dining-seat'?48:-16;
      if (item.id.startsWith('arm')) {
        score += pose.relation==='conversation-side'?68:pose.relation==='conversation-opposite'?56:pose.relation==='conversation-open-zone'?20:pose.relation==='conversation-wall'?12:-14;
        const placedArms=Object.entries(state.poses).filter(([id])=>id.startsWith('arm'));
        for (const [,otherPose] of placedArms) {
          const mixed=otherPose.relation!==pose.relation;
          const oppositeSides=otherPose.relationSide!==pose.relationSide;
          score += mixed?12:oppositeSides?6:-18;
        }
      }
      if (item.typeId==='side') score += pose.relation === 'sofa-side' ? 44 : pose.relation==='seat-side'?38:-12;
      if (!configuredEntry&&item.id.startsWith('ottoman')) score += pose.relation === 'sofa-ottoman' ? 34 : pose.relation==='seat-ottoman'?40:-14;
      if (item.id === 'bookcase') {
        score += 20;
        if (windowOverlap(item,pose,scene)) score -= 64;
      }
      if (item.id.startsWith('bookcase')||item.id.startsWith('sideboard')||item.id.startsWith('display')||item.id==='console') {
        score += item.id.startsWith('sideboard')?27:20;
        if (windowOverlap(item,pose,scene)) score -= 64;
        if (state.poses.diningTable&&item.id.startsWith('sideboard')) score += clamp(16-dist(pose,state.poses.diningTable)*4,-4,12);
      }
      if (!configuredEntry&&item.id.startsWith('floorLamp')) score += pose.relation==='seat-light'?42:pose.relation==='corner-light'?30:-12;
      if (!configuredEntry&&item.id.startsWith('plant')) score += pose.relation==='corner-accent'?32:-10;
      if (furnitureRule(item)?.infill) {
        const seamQuality=1-clamp((pose.installationGap||0)/.10,0,1);
        // “占满整段”与“至少收住一个墙角”是两种都合理的定制柜解法。
        // 长墙受最大模数限制时 installationGap 会很大，但端点对齐仍然应得到明确奖励。
        const cornerClosure=Number.isFinite(pose.wallEndGap)?(pose.wallEndGap<=.025?22:pose.wallEndGap<=.08?13:Math.max(-6,3-pose.wallEndGap*8)):0;
        score += 38+Math.min(28,(pose.overrideW||item.w)*7)+(pose.runFill||0)*18+seamQuality*12+cornerClosure;
      } else if (pose.overrideW) {
        const reference=currentProgram==='living'?20:14;
        // 书桌使用常用离散尺码，并在中等以上卧室优先占满可用空墙，减少毫无用途的窄缝。
        const target=item.typeId==='desk'?(scene.area>=16?1.60:scene.area>=12?1.40:1.20):item.w*clamp(Math.sqrt(scene.area/reference),.82,1.45);
        score += 7-Math.abs(pose.overrideW-target)*18+clamp((pose.runFill||0)-.55,0,.4)*8;
      }

      const zone = serviceZone(item,pose);
      const zoneRule=(furnitureRule(item)?.service||FURNITURE_RULES.default.service);
      const insideSamples = rectSamples(zone).filter(p => pointInPolygon(p,scene.polygon)).length;
      score += insideSamples / 9 * 10;
      for (const [id, otherPose] of Object.entries(state.poses)) {
        const overlaps=footprintRects(ITEM_BY_ID[id],otherPose).some(otherRect=>rectsOverlap(zone,otherRect,0));
        if (overlaps) {
          // 柜前取物、展示柜浏览等软使用区只影响舒适度，不再等同碰撞。
          // 门扇、主通道和明确标为 hard 的工作区仍维持高惩罚。
          const softPenalty=furnitureRule(item)?.requiredAnchor==='wall'?2.5:4.5;
          score -= item.id.startsWith('night') && id === 'bed' ? 2 : zoneRule.hard?13:softPenalty;
        }
      }

      // 同一面墙上，家具之间 8–68cm 的缝通常既放不下东西又难清洁；把这个
      // 墙面连续性前移到候选分，避免等最终验收时才发现整盘棋已经无法收口。
      if(pose.wallIndex>=0){
        const wall=scene.walls[pose.wallIndex],width=itemLocalDims(item,pose).w;
        const along=dot({x:pose.x-wall.a.x,y:pose.y-wall.a.y},wall.dir),a0=along-width/2,a1=along+width/2;
        let nearest=Infinity;
        for(const [id,otherPose] of Object.entries(state.poses)){
          if(otherPose.wallIndex!==pose.wallIndex)continue;const other=ITEM_BY_ID[id];if(!other)continue;
          const otherWidth=itemLocalDims(other,otherPose).w,otherAlong=dot({x:otherPose.x-wall.a.x,y:otherPose.y-wall.a.y},wall.dir);
          const b0=otherAlong-otherWidth/2,b1=otherAlong+otherWidth/2,gap=Math.max(a0,b0)-Math.min(a1,b1);
          if(gap>=-.03)nearest=Math.min(nearest,Math.max(0,gap));
        }
        if(Number.isFinite(nearest))score+=nearest<=DESIGN_QUALITY_RULES.wall.installGapMax?22:nearest<=DESIGN_QUALITY_RULES.wall.severeGapMax?-64:nearest<DESIGN_QUALITY_RULES.wall.usefulBayMin?-22:0;
      }

      const corridorPoint = {x:scene.door.entry.x,y:(scene.door.entry.y+roomCenter.y)/2};
      if (pointInRect(corridorPoint,rect,.18)) score -= 18;
      // 单件分数之外，再奖励“这一手把一组家具补完整”。这相当于下棋时不只看
      // 当前棋子的价值，也看它是否完成了一块阵地，避免 Beam 总偏爱孤立的小件。
      const has=typeId=>Object.entries(state.poses).some(([id])=>ITEM_BY_ID[id]?.typeId===typeId);
      const count=typeId=>Object.entries(state.poses).filter(([id])=>ITEM_BY_ID[id]?.typeId===typeId).length;
      if(item.typeId==='tv'&&has('sofa'))score+=18;
      if(item.typeId==='coffee'&&has('sofa')&&has('tv'))score+=24;
      if(item.typeId==='chair'&&has('desk'))score+=22;
      if(item.typeId==='night'&&has('bed'))score+=count('night')?14:9;
      if(item.typeId==='diningChair'&&has('diningTable'))score+=count('diningChair')===1?22:10;
      if(item.typeId==='side'&&has('sofa'))score+=10;
      if(item.typeId==='floorLamp'&&(has('sofa')||has('arm')))score+=8;
      score += ((item.preferenceWeight??furnitureRule(item).preferenceWeight??1)-1)*18;
      return score;
    }

    function optionalSkipCost(item,state,scene) {
      const value=INVENTORY_VALUES[currentProgram]?.[item.typeId]?.value||5;
      const preference=clamp(item.preferenceWeight??furnitureRule(item).preferenceWeight??1,0,3);
      const occupied=Object.entries(state.poses).reduce((sum,[id,pose])=>{
        const placed=ITEM_BY_ID[id];return sum+(placed?furnitureArea(placed,pose):0);
      },0)/Math.max(scene.area,EPS);
      const target=objectiveDensity(INVENTORY_OBJECTIVES.balanced,currentProgram)*.70*(DENSITY_MODES[layoutDensityMode]?.density||1);
      // 高偏好家具和明显偏空的房间更不容易被主动跳过；超过舒适密度后仍允许留白。
      const infillCommitment=furnitureRule(item)?.infill&&customCabinetEnabled?18:0;
      const wallFinishCommitment=item.typeId==='bedroomDisplay'?30:0;
      // 13.5㎡ 以上的卧室应尽量形成一个独立阅读/休闲点。它仍是可选家具，
      // 但在房间明显偏空时不能和普通小件一样过早走“跳过”分支。
      const roomFillCommitment=item.typeId==='lounge'&&scene.area>=13.5?28:0;
      const conversationCommitment=currentProgram==='living'&&item.typeId==='arm'&&scene.area>=14&&item.slotIndex<2?15:0;
      // 同类家具越接近数量上限，继续增加的边际价值越低。后续槽位降低跳过
      // 代价，避免局部累计分机械偏向“全部塞满”。条件最小数量由
      // mustPlaceDependentSlot 单独保证，不受这里影响。
      const optionalOrdinal=Math.max(0,(item.slotIndex||0)-(item.minCount||0));
      const repeatSkipRelief=Math.min(18,optionalOrdinal*8);
      const computed=7+value*.18+(preference-1)*10+(DENSITY_MODES[layoutDensityMode]?.skip||0)+infillCommitment+wallFinishCommitment+roomFillCommitment+conversationCommitment-repeatSkipRelief-(occupied-target)*80;
      // 最大数量仍是软约束：无合法位置时允许跳过并继续下一类；但已经被用户或自动库存
      // 选中的槽位，只要存在合法候选，就不再因房间稍满而得到“跳过奖励”。
      const requested=Math.max(0,Number(CONFIGS[currentProgram]?.counts?.[item.typeId])||0);
      const selectedSlot=(Number(item.slotIndex)||0)<requested;
      const selectedFloor=selectedSlot?(item.typeId==='bench'?20:8):-12;
      return clamp(Math.max(selectedFloor,computed),-12,46);
    }

    function mustPlaceDependentSlot(item,state,scene) {
      // 这里只表达真正的“条件最小数量”，绝不能把 max 上限误当成必放数量。
      // 自动库存明确选中了工作组或至少一只床头柜时，组锚点不能先走 skip；
      // 若几何上放不下，外层会回退较小库存，而不是输出名义完整、实际缺件的方案。
      if(currentProgram==='bedroom'&&item.typeId==='desk'&&item.slotIndex===0&&(CONFIGS.bedroom.counts.desk||0)>0)return true;
      if(currentProgram==='bedroom'&&item.typeId==='night'&&item.slotIndex===0&&(CONFIGS.bedroom.counts.night||0)>0&&state.poses.bed)return true;
      const bedroomAspect=Math.max(scene.width/Math.max(scene.depth,EPS),scene.depth/Math.max(scene.width,EPS));
      const selectedHotelAnchor=currentProgram==='bedroom'&&scene.shape==='recognized'&&bedroomAspect>=1.65&&item.slotIndex===0&&
        (CONFIGS.bedroom.counts[item.typeId]||0)>0&&['tvbench','bedroomLoveseat'].includes(item.typeId);
      // 识别出的长条酒店型卧室把“床对电视墙 + 一处补座”当作两个锚点。
      // 若任一锚点确实无合法位置，本轮库存自然失败并回退；不再因为 skip 分高
      // 就在明明放得下时偷懒。茶几和其它小件仍保持逐件可跳过。
      if(selectedHotelAnchor)return true;
      if(item.typeId==='chair'&&state.poses.desk&&item.slotIndex===0)return true;
      if(item.typeId==='vanityStool'&&state.poses.vanity&&item.slotIndex===0)return true;
      if(item.typeId==='diningChair'&&state.poses.diningTable){
        const requested=Math.max(2,Number(CONFIGS.living.counts.diningChair)||0),required=layoutDensityMode==='rich'?Math.min(4,requested):2;
        if(item.slotIndex<required)return true;
      }
      // 面积档已选择“客餐厅”库存时，餐桌是该模块的锚点，不能在第一步被可选
      // skip 分支悄悄删掉后仍把方案当作客餐厅通过；摆不下时由外层回退清单。
      if(currentProgram==='living'&&item.typeId==='diningTable'&&item.slotIndex===0&&(CONFIGS.living.counts.diningTable||0)>0)return true;
      // 丰满模式的大客餐厅按“完整功能组”落子。过去餐桌与餐椅落下以后，
      // 单椅、边几和沿墙柜仍能走 skip，Beam 很快被六件核心家具的半成品占满；
      // 最终再靠几个小件计数冒充丰富。既然库存候选已经明确选择这些模块，
      // 第一件就必须真正落下；几何不可行时由外层换下一套库存。
      if(currentProgram==='living'&&layoutDensityMode==='rich'&&item.slotIndex===0&&scene.area>=24&&
        ['sideboard','bookcase','display','side','arm'].includes(item.typeId)&&
        (CONFIGS.living.counts[item.typeId]||0)>0)return true;
      // 只有 studio 明确选择的三件套不可拆。普通卧室里的沙发、圆几、电视柜
      // 都是逐件挑战：能放就继续，放不下只跳过这一件，不能连带删掉后续家具。
      if(currentProgram==='bedroom'&&item.slotIndex===0&&(CONFIGS.bedroom.counts[item.typeId]||0)>0){
        const completeStudioGroup=roomAreaTier('bedroom',scene.area).id==='studio'&&(CONFIGS.bedroom.counts.bedroomLoveseat||0)>0&&
          (CONFIGS.bedroom.counts.bedroomTeaTable||0)>0&&(CONFIGS.bedroom.counts.tvbench||0)>0;
        if(completeStudioGroup&&['tvbench','bedroomLoveseat','bedroomTeaTable'].includes(item.typeId))return true;
      }
      // 床头柜配置为 0–2 时，两个槽位都只是数量上限。床存在并不代表必须
      // 摆满床头柜；每个槽位都应保留“跳过并继续搜索后续家具”的分支。
      return false;
    }

    function placedTypeSignature(state){
      const counts={};for(const id of Object.keys(state.poses||{})){const typeId=ITEM_BY_ID[id]?.typeId||id;counts[typeId]=(counts[typeId]||0)+1;}
      return Object.entries(counts).sort(([a],[b])=>a.localeCompare(b)).map(([id,count])=>`${id}:${count}`).join('|');
    }
    function placedTypePoseSignature(state,typeId){
      return Object.entries(state.poses||{}).filter(([id])=>(ITEM_BY_ID[id]?.typeId||id)===typeId).map(([id,pose])=>`${id}:${poseIdentity(pose)}`).sort().join(';');
    }

    function quantityDiverseSelection(states,limit) {
      if(states.length<=limit)return states;
      const representatives=new Map();
      for(const state of states) {
        const count=Object.keys(state.poses).length;
        if(!representatives.has(count))representatives.set(count,state);
      }
      const selected=[...representatives.values()],selectedSet=new Set(selected),typeSignatures=new Set();
      if(LAYOUT_CONSTRAINTS.search.preserveEachFurnitureType){
        const typeRepresentatives=new Map(),perType=LAYOUT_CONSTRAINTS.search.representativesPerFurnitureType;
        for(const state of states){const count=Object.keys(state.poses||{}).length;for(const id of Object.keys(state.poses||{})){
          const typeId=ITEM_BY_ID[id]?.typeId||id,prior=typeRepresentatives.get(typeId);
          const poseSignature=placedTypePoseSignature(state,typeId);
          if(!prior||count<prior.count)typeRepresentatives.set(typeId,{count,states:[state],signatures:new Set([poseSignature])});
          else if(count===prior.count&&prior.states.length<perType&&!prior.signatures.has(poseSignature)){prior.states.push(state);prior.signatures.add(poseSignature);}
        }}
        for(const entry of typeRepresentatives.values())for(const state of entry.states)if(selected.length<limit&&!selectedSet.has(state)){selected.push(state);selectedSet.add(state);}
      }
      for(const state of states){
        if(selected.length>=Math.min(limit,LAYOUT_CONSTRAINTS.search.typeSignatureReserve))break;
        const signature=placedTypeSignature(state);if(typeSignatures.has(signature))continue;
        typeSignatures.add(signature);if(!selectedSet.has(state)){selected.push(state);selectedSet.add(state);}
      }
      for(const state of states) {
        if(selected.length>=limit)break;
        if(!selectedSet.has(state)){selected.push(state);selectedSet.add(state);}
      }
      return selected.sort((a,b)=>b.partialScore-a.partialScore);
    }

    function rawCandidatesForFixedItem(item, state, scene) {
      return configuredRuleCandidates(item,state,scene);
    }

    function sizePolicyFor(item,scene) {
      const policy=LAYOUT_CONSTRAINTS.search.sizePolicies?.[currentProgram]?.[item.typeId];
      if(!policy||policy.mode!=='max-feasible'||!item.sizeVariants?.length)return null;
      const targetRow=[...(policy.targetByArea||[])].sort((a,b)=>Number(b.minArea)-Number(a.minArea)).find(row=>scene.area+EPS>=Number(row.minArea));
      return {...policy,targetWidth:Number(targetRow?.width)||Math.max(...item.sizeVariants.map(row=>Number(row.w)||0))};
    }

    function semanticSizeAnchorKey(item,pose,scene,policy) {
      const rule=pose.candidateRuleId||pose.relation||pose.anchor||'candidate';
      if(Number.isInteger(pose.wallIndex)&&pose.wallIndex>=0){
        const wall=scene.walls[pose.wallIndex],dims=itemLocalDims(item,pose),along=dot({x:pose.x-wall.a.x,y:pose.y-wall.a.y},wall.dir);
        const startGap=along-dims.w/2,endGap=wall.length-(along+dims.w/2),tolerance=Math.max(.025,Number(policy.anchorTolerance)||.08);
        let slot=startGap<=tolerance?'start':endGap<=tolerance?'end':Math.abs(along-wall.length/2)<=tolerance?'center':null;
        if(!slot){const buckets=Math.max(4,Math.round(Number(policy.positionBuckets)||10));slot=`q${Math.round(clamp(along/Math.max(wall.length,EPS),0,1)*buckets)}`;}
        return `${rule}|wall-${pose.wallIndex}|${slot}`;
      }
      if(pose.anchor==='relation')return `${rule}|relation|${pose.relationTarget||''}|${pose.relationSide??''}|${pose.slot||''}|${round(pose.relationOffset||0,2)}`;
      const buckets=Math.max(4,Math.round(Number(policy.positionBuckets)||10));
      return `${rule}|zone|${Math.round(clamp(pose.x/Math.max(scene.width,EPS),0,1)*buckets)}:${Math.round(clamp(pose.y/Math.max(scene.depth,EPS),0,1)*buckets)}|${pose.rotation||0}`;
    }

    function sizePolicyMerit(item,pose,scene) {
      const policy=sizePolicyFor(item,scene);if(!policy||pose.skip)return 0;
      const width=Number(pose.overrideW)||item.w,target=Math.max(EPS,policy.targetWidth),ratio=clamp(width/target,0,1);
      return ratio*Math.max(0,Number(policy.localPriorityBonus)||0);
    }

    function semanticSizeSelection(indices,poses,item,scene) {
      const policy=sizePolicyFor(item,scene);if(!policy)return indices;
      const groups=new Map();
      for(const index of indices){const pose=poses[index];if(pose.skip)continue;const key=semanticSizeAnchorKey(item,pose,scene,policy);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(index);}
      const keep=new Set(indices.filter(index=>poses[index].skip)),fallbacks=Math.max(0,Math.round(Number(policy.fallbacksPerAnchor)||0));
      for(const rows of groups.values()){
        rows.sort((a,b)=>(Number(poses[b].overrideW)||item.w)-(Number(poses[a].overrideW)||item.w));
        rows.slice(0,1+fallbacks).forEach(index=>keep.add(index));
      }
      return indices.filter(index=>keep.has(index));
    }

    function rawCandidatesForItem(item,state,scene) {
      if(!item.sizeVariants?.length) return rawCandidatesForFixedItem(item,state,scene);
      const configuredLimit=Math.max(4,Math.round(Number(furnitureRule(item)?.candidate?.maxCandidates)||32));
      // 多模数不是把同一份 32 个位置越分越薄：每个书桌尺寸至少保留 8 个墙面落点，
      // 但总量仍封顶 56，避免 0.9~2.0m 六种模数把搜索量无界放大。
      const sizePolicy=sizePolicyFor(item,scene);
      const searchMaxRow=sizePolicy?[...(sizePolicy.searchMaxByArea||[])].sort((a,b)=>Number(b.minArea)-Number(a.minArea)).find(row=>scene.area+EPS>=Number(row.minArea)):null;
      const eligibleVariants=sizePolicy&&Number(searchMaxRow?.width)>0
        ?item.sizeVariants.filter(variant=>variant.w<=Number(searchMaxRow.width)+EPS)
        :item.sizeVariants;
      const variantFloor=sizePolicy?Math.min(56,eligibleVariants.length*9):configuredLimit;
      const buckets=[],limit=Math.min(72,Math.max(configuredLimit,variantFloor));
      for(const variant of eligibleVariants) {
        const sized={...item,w:variant.w,d:variant.d,sizeVariants:null};
        const shaped={...sized,shape:variant.shape||sized.shape};buckets.push(rawCandidatesForFixedItem(shaped,state,scene).map(pose=>({...pose,overrideW:variant.w,overrideD:variant.d,overrideShape:variant.shape||sized.shape,sizeVariant:variant.id,sizeLabel:variant.label})));
      }
      const raw=[];for(let index=0;raw.length<limit;index++){let added=false;for(const bucket of buckets)if(bucket[index]){raw.push(bucket[index]);added=true;if(raw.length>=limit)break}if(!added)break}return raw;
    }

    function generateCandidates(item, state, scene, limit = null) {
      // 房间面积变大只增加可用空间，不应增加每件家具的采样密度。超大房间每个
      // 父局面保留前 24 个高质量候选，关系槽仍由下方逻辑保证不会丢失跳过分支。
      const candidateBudget=LAYOUT_CONSTRAINTS.search.candidateBudget;
      limit=Number(limit)||candidateBudget.defaultLimit;
      if(scene.area>=candidateBudget.largeRoomArea)limit=Math.min(limit,candidateBudget.largeRoomLimit);
      const raw = rawCandidatesForItem(item,state,scene);
      const seen = new Set();
      const valid = [];
      for (const pose of raw) {
        const key = poseKey(item,pose);
        if (seen.has(key)) continue;
        seen.add(key);
        if (!isLegal(item,pose,state,scene)) continue;
        valid.push({pose, merit:candidateStaticScore(item,pose,state,scene)+sizePolicyMerit(item,pose,scene)});
      }
      const reduced=semanticSizeSelection(valid.map((_,index)=>index),valid.map(row=>row.pose),item,scene).map(index=>valid[index]);
      valid.splice(0,valid.length,...reduced);valid.sort((a,b) => b.merit-a.merit);
      if(item.optional&&!mustPlaceDependentSlot(item,state,scene)) {
        const top=valid[0]?.merit||18;
        valid.push({pose:{skip:true,relation:'optional-skip'},merit:top-optionalSkipCost(item,state,scene)});
        valid.sort((a,b)=>b.merit-a.merit);
      }
      const selected=valid.slice(0,limit),skipCandidate=valid.find(row=>row.pose?.skip);
      // 数量范围中的“跳过”是结构性选择，不能被同一父局面的局部 Top-K 挤掉。
      if(skipCandidate&&!selected.includes(skipCandidate)){
        if(selected.length>=limit&&selected.length)selected[selected.length-1]=skipCandidate;else selected.push(skipCandidate);
        selected.sort((a,b)=>b.merit-a.merit);
      }
      return selected;
    }

    function stateHash(state) {
      const groups=new Map();
      for(const item of FURNITURE){const pose=state.poses[item.id];if(!pose)continue;const typeId=item.typeId||item.id;
        if(!groups.has(typeId))groups.set(typeId,[]);
        groups.get(typeId).push(itemTypeCount(item)>1?physicalPoseIdentity(item,pose):poseIdentity(pose));
      }
      return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([typeId,poses])=>`${typeId}@${poses.sort().join(';')}`).join('|');
    }

    function expandedRect(rect,padding) {
      return {x:rect.x,y:rect.y,w:rect.w+padding*2,d:rect.d+padding*2};
    }

    // 通行半径、检查时机与零孤岛要求只从 layoutConstraints.circulation 读取。
    function shouldGuideFlow(item){return FLOW_GUIDE_TYPES[currentProgram]?.has(item.typeId);}
    function shouldHardPruneFlow(item){
      if(FLOW_HARD_PRUNE_TYPES[currentProgram]?.has(item.typeId))return true;
      if(!FLOW_HARD_PRUNE_LAST_SLOT_TYPES[currentProgram]?.has(item.typeId))return false;
      const configuredCount=Math.max(0,Math.round(CONFIGS[currentProgram].counts[item.typeId]||0));
      return item.slotIndex>=Math.max(0,configuredCount-1);
    }

    function pointSegmentDistance(p,a,b) {
      const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy||1;
      const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/length2,0,1);
      return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
    }

    function createFlowContext(scene,step=LAYOUT_CONSTRAINTS.circulation.rasterStep) {
      const cols=Math.max(1,Math.ceil(scene.width/step)),rows=Math.max(1,Math.ceil(scene.depth/step));
      const rowWords=Math.ceil(cols/32),words=rowWords*rows;
      const context={scene,step,cols,rows,rowWords,words,roomMasks:new Map(),poseMasks:new Map(),portalMasks:new Map()};
      for (const level of FLOW_RADII) {
        const mask=new Uint32Array(words);
        for (let y=0;y<rows;y++) for (let x=0;x<cols;x++) {
          const p={x:(x+.5)*step,y:(y+.5)*step};
          if (!pointInPolygon(p,scene.polygon)) continue;
          let boundary=Infinity;
          for (let i=0;i<scene.polygon.length;i++) boundary=Math.min(boundary,pointSegmentDistance(p,scene.polygon[i],scene.polygon[(i+1)%scene.polygon.length]));
          if (boundary+step*.42<level.radius) continue;
          mask[y*rowWords+(x>>>5)]|=(1<<(x&31))>>>0;
        }
        context.roomMasks.set(level.id,mask);
      }
      return context;
    }

    function rasterDenseRects(rects,context,padding=0) {
      const mask=new Uint32Array(context.words),{step,cols,rows,rowWords}=context;
      for (const rect of rects) {
        const x0=clamp(Math.floor((rect.x-rect.w/2-padding)/step),0,cols-1),x1=clamp(Math.floor((rect.x+rect.w/2+padding-EPS)/step),0,cols-1);
        const y0=clamp(Math.floor((rect.y-rect.d/2-padding)/step),0,rows-1),y1=clamp(Math.floor((rect.y+rect.d/2+padding-EPS)/step),0,rows-1);
        for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++) mask[y*rowWords+(x>>>5)]|=(1<<(x&31))>>>0;
      }
      return mask;
    }

    function popcount32(value) {
      value-=(value>>>1)&0x55555555;value=(value&0x33333333)+((value>>>2)&0x33333333);
      return (((value+(value>>>4))&0x0f0f0f0f)*0x01010101)>>>24;
    }

    function bitCount(mask) {let total=0;for(let i=0;i<mask.length;i++)total+=popcount32(mask[i]>>>0);return total;}
    function masksIntersect(a,b) {for(let i=0;i<a.length;i++)if((a[i]&b[i])!==0)return true;return false;}
    function bitAt(mask,x,y,context) {return (mask[y*context.rowWords+(x>>>5)]&((1<<(x&31))>>>0))!==0;}

    function nearestSeed(free,scene,context) {
      const sx=clamp(Math.floor(scene.door.entry.x/context.step),0,context.cols-1),sy=clamp(Math.floor(scene.door.entry.y/context.step),0,context.rows-1);
      for (let radius=0;radius<Math.max(context.cols,context.rows);radius++) {
        for (let dy=-radius;dy<=radius;dy++) for (let dx=-radius;dx<=radius;dx++) {
          if (Math.max(Math.abs(dx),Math.abs(dy))!==radius) continue;
          const x=sx+dx,y=sy+dy;if(x<0||y<0||x>=context.cols||y>=context.rows)continue;
          if(bitAt(free,x,y,context))return {x,y};
        }
      }
      return null;
    }

    function floodBitset(free,scene,context) {
      const reach=new Uint32Array(context.words),next=new Uint32Array(context.words),seed=nearestSeed(free,scene,context);
      if(!seed)return reach;
      reach[seed.y*context.rowWords+(seed.x>>>5)]|=(1<<(seed.x&31))>>>0;
      const tailBits=context.cols&31,tailMask=tailBits?((2**tailBits)-1)>>>0:0xffffffff;
      let changed=true,iterations=0;
      while(changed&&iterations++<context.cols+context.rows) {
        changed=false;
        for(let y=0;y<context.rows;y++)for(let word=0;word<context.rowWords;word++) {
          const index=y*context.rowWords+word,value=reach[index]>>>0;
          let spread=(value|((value<<1)>>>0)|(value>>>1))>>>0;
          if(word>0&&(reach[index-1]&0x80000000))spread|=1;
          if(word<context.rowWords-1&&(reach[index+1]&1))spread|=0x80000000;
          if(y>0)spread|=reach[index-context.rowWords];
          if(y<context.rows-1)spread|=reach[index+context.rowWords];
          let expanded=(spread&free[index])>>>0;
          if(word===context.rowWords-1)expanded&=tailMask;
          next[index]=expanded;
          if((expanded&(~value))!==0)changed=true;
        }
        reach.set(next);
      }
      return reach;
    }

    function poseObstacleMask(item,pose,level,context) {
      const key=`${item.id}:${item.w}:${item.d}:${pose.overrideShape||item.shape||'box'}:${poseIdentity(pose)}:${level.id}`,cached=context.poseMasks.get(key);
      if(cached)return cached;
      // 椅/凳属于可挪动物，不把“坐下后的固定人体半径”永久焊死在它四周；
      // 其实体仍占格。床、柜、桌、沙发等固定家具一律按 0.25m 扩张。
      const movable=new Set(['chair','vanityStool','diningChair','ottoman']).has(item.typeId);
      // 栅格边界本身会向外取整一格，固定物半径留 1cm 数值容差，避免把刚好
      // 0.50m 的通道因浮点/格心对齐误判成 0.48m；名义门槛仍是直径 0.50m。
      const fixedPadding=Math.max(0,level.radius-.01);
      const mask=rasterDenseRects(footprintRects(item,pose),context,movable?level.radius*.22:fixedPadding);
      context.poseMasks.set(key,mask);return mask;
    }

    function targetPortalMask(item,pose,level,context,state) {
      const zones=[serviceZone(item,pose)];
      if(item.typeId==='bed') {
        zones.push(zoneRectFromSpec(item,pose,{side:'left',depth:.58,spanExtra:-.38,gap:.04}));
        zones.push(zoneRectFromSpec(item,pose,{side:'right',depth:.58,spanExtra:-.38,gap:.04}));
      }
      if(item.typeId==='sofa') {
        zones.push(zoneRectFromSpec(item,pose,{side:'left',depth:.52,spanExtra:-.18,gap:.04}));
        zones.push(zoneRectFromSpec(item,pose,{side:'right',depth:.52,spanExtra:-.18,gap:.04}));
      }
      const pairedId=item.typeId==='desk'?'chair':item.typeId==='vanity'?'vanityStool':null;
      if(pairedId&&state.poses[pairedId]&&ITEM_BY_ID[pairedId])zones.push(serviceZone(ITEM_BY_ID[pairedId],state.poses[pairedId]));
      if(item.typeId==='diningTable') for(const [id,chairPose] of Object.entries(state.poses)) {
        const chair=ITEM_BY_ID[id];if(chair?.typeId==='diningChair')zones.push(serviceZone(chair,chairPose));
      }
      const trimmed=zones.map(zone=>{
        const trim=Math.min(level.radius*.28,zone.w*.16,zone.d*.16);
        return {x:zone.x,y:zone.y,w:Math.max(context.step,zone.w-trim*2),d:Math.max(context.step,zone.d-trim*2)};
      });
      return rasterDenseRects(trimmed,context,0);
    }

    function computeReachability(state,scene,levels=FLOW_RADII,extraRects=[]) {
      const context=scene._flowContext||(scene._flowContext=createFlowContext(scene));
      const poses=Object.entries(state.poses),results={};
      for (const level of levels) {
        const room=context.roomMasks.get(level.id),blocked=new Uint32Array(context.words);
        for (const [id,pose] of poses) {
          const item=ITEM_BY_ID[id];if(!item)continue;
          const mask=poseObstacleMask(item,pose,level,context);
          for(let i=0;i<blocked.length;i++)blocked[i]|=mask[i];
        }
        if(extraRects.length){
          const extraMask=rasterDenseRects(extraRects,context,Math.max(0,level.radius-.01));
          for(let i=0;i<blocked.length;i++)blocked[i]|=extraMask[i];
        }
        const free=new Uint32Array(context.words);
        for(let i=0;i<free.length;i++)free[i]=(room[i]&(~blocked[i]))>>>0;
        const reached=floodBitset(free,scene,context);
        // 家具明确声明的服务区（例如沙发与茶几之间、餐桌与餐椅之间）是坐姿/操作
        // 空间，不要求成为 0.50m 穿行通道。只从“孤岛面积”中扣掉这些有功能归属
        // 的格子；没有任何功能归属的墙角、凹槽和家具背后空地仍然是硬孤岛。
        const claimedRects=poses.flatMap(([id,pose])=>ITEM_BY_ID[id]?functionalZones(ITEM_BY_ID[id],pose).filter(zone=>!zone.sharedCirculation).map(zone=>zone.rect):[]);
        const claimed=claimedRects.length?rasterDenseRects(claimedRects,context,0):new Uint32Array(context.words);
        let targetCount=0,reachableTargets=0,hardTargetCount=0,reachableHardTargets=0;const targetStatus={};
        for(const [id,pose] of poses) {
          const item=ITEM_BY_ID[id];if(!item||item.accessTarget===false)continue;
          targetCount++;
          const hit=masksIntersect(reached,targetPortalMask(item,pose,level,context,state));targetStatus[id]=hit;
          if(hit)reachableTargets++;
          const secondary=currentProgram==='living'?['tv','sideboard','bookcase','display','console'].includes(item.typeId):['chest','shelf','tvbench'].includes(item.typeId);
          if(!secondary){hardTargetCount++;if(hit)reachableHardTargets++;}
        }
        let unexplainedCells=0;
        for(let i=0;i<free.length;i++)unexplainedCells+=popcount32((free[i]&(~reached[i])&(~claimed[i]))>>>0);
        const roomCells=bitCount(room),freeCells=bitCount(free),reachedCells=bitCount(reached),unreachableCells=unexplainedCells;
        const rawUnreachableArea=unreachableCells*context.step*context.step,islandPass=rawUnreachableArea<=LAYOUT_CONSTRAINTS.circulation.maxIslandArea+EPS,unreachableArea=islandPass?0:rawUnreachableArea;
        results[level.id]={targetCount,reachableTargets,hardTargetCount,reachableHardTargets,targetStatus,reachableRatio:targetCount?reachableTargets/targetCount:1,hardReachableRatio:hardTargetCount?reachableHardTargets/hardTargetCount:1,freeRatio:roomCells?freeCells/roomCells:0,connectedRatio:freeCells?1-unreachableCells/freeCells:1,reachedCells,freeCells,unreachableCells,unreachableArea,rawUnreachableArea,islandPass,minimumPassage:level.radius*2};
      }
      const tight=results.tight||results[levels[0].id],normal=results.normal||tight,comfortable=results.comfortable||normal;
      const islandRequired=LAYOUT_CONSTRAINTS.circulation.requireZeroIslands;
      return {...tight,levels:results,normalRatio:normal.reachableRatio,comfortableRatio:comfortable.reachableRatio,
        normalHardRatio:normal.hardReachableRatio,comfortableHardRatio:comfortable.hardReachableRatio,islandRequired,
        hardPass:tight.hardReachableRatio===1&&(!islandRequired||tight.islandPass)};
    }

    function relationSatisfied(state,id) {
      const pose=state.poses[id],rule=furnitureRule(ITEM_BY_ID[id]);if(!pose)return false;if(rule?.infill)return pose.anchor==='wall';const candidate=rule?.candidate||{mode:'wall'},entries=Array.isArray(candidate.rules)&&candidate.rules.length?candidate.rules:[candidate],entry=entries.find(row=>(row.id||row.relation)===pose.candidateRuleId)||entries.find(row=>row.relation&&row.relation===pose.relation)||entries[0],mode=entry?.mode||'wall';if(mode==='relation')return rule?.requiredAnchor==='wall'?pose.anchor==='wall':pose.anchor==='relation';if(mode==='corner')return entry?.requiredAnchor==='wall'||rule?.allowCorner?pose.anchor==='wall':pose.anchor==='zone';if(mode==='zone')return pose.anchor==='zone';return pose.anchor==='wall';
    }

    function bandScore(value,idealMin,idealMax,falloff) {
      if (value>=idealMin&&value<=idealMax) return 1;
      if (value<idealMin) return clamp(1-(idealMin-value)/falloff,0,1);
      return clamp(1-(value-idealMax)/falloff,0,1);
    }

    function facingScore(pose,target) {
      if (!pose?.normal) return 0;
      const vx=target.x-pose.x,vy=target.y-pose.y;
      const length=Math.hypot(vx,vy)||1;
      return clamp((dot(pose.normal,{x:vx/length,y:vy/length})-.25)/.70,0,1);
    }

    function expectedServiceOverlap(item,other) {
      if (item.typeId==='bed'&&other.id.startsWith('night')) return true;
      if (item.typeId==='bed'&&other.id==='bench') return true;
      if (item.id==='desk'&&other.id==='chair') return true;
      if (item.id==='vanity'&&other.id==='vanityStool') return true;
      if (item.id==='sofa'&&(other.id==='coffee'||other.id.startsWith('ottoman'))) return true;
      return false;
    }

    function accessClearanceScore(state,scene) {
      let clear=0,count=0;
      for (const item of FURNITURE) {
        const pose=state.poses[item.id];
        if (!pose||item.accessTarget===false) continue;
        count++;
        const zone=serviceZone(item,pose);
        let ok=rectSamples(zone).filter(p=>pointInPolygon(p,scene.polygon)).length>=6;
        for (const other of FURNITURE) {
          if (!ok||other.id===item.id||!state.poses[other.id]||expectedServiceOverlap(item,other)) continue;
          if (footprintRects(other,state.poses[other.id]).some(rect=>rectsOverlap(zone,rect))) ok=false;
        }
        if (ok) clear++;
      }
      return count?clear/count:1;
    }

    function livingMetrics(state,scene,accessScore) {
      const sofa=ITEM_BY_ID.sofa,tv=ITEM_BY_ID.tv,coffee=ITEM_BY_ID.coffee;
      const sofaPose=state.poses.sofa,tvPose=state.poses.tv,coffeePose=state.poses.coffee;
      let tvScore=0,tvGapScore=0,coffeeScore=0,coffeeGapScore=0;
      if (sofa&&tv&&sofaPose&&tvPose) {
        const delta={x:tvPose.x-sofaPose.x,y:tvPose.y-sofaPose.y};
        const forward=dot(delta,sofaPose.normal||{x:0,y:1});
        const lateral=Math.abs(dot(delta,sofaPose.wallDir||{x:1,y:0}));
        const gap=forward-sofa.d/2-tv.d/2;
        const opposed=clamp((-dot(sofaPose.normal||{x:0,y:1},tvPose.normal||{x:0,y:-1})-.45)/.5,0,1);
        const aligned=clamp(1-lateral/Math.max(.9,sofa.w*.55),0,1);
        tvGapScore=bandScore(gap,1.55,3.20,.95);
        tvScore=opposed*.38+aligned*.34+tvGapScore*.28;
      }
      if (sofa&&coffee&&sofaPose&&coffeePose) {
        const delta={x:coffeePose.x-sofaPose.x,y:coffeePose.y-sofaPose.y};
        const forward=dot(delta,sofaPose.normal||{x:0,y:1});
        const lateral=Math.abs(dot(delta,sofaPose.wallDir||{x:1,y:0}));
        const gap=forward-sofa.d/2-coffee.d/2;
        const preferred=DESIGN_GRAMMAR.living?.pairs?.sofaCoffee||{},min=Number(preferred.gap?.[0]??.35),max=Number(preferred.gap?.[1]??.40),tolerance=Number(preferred.tolerance)||.12;
        coffeeGapScore=bandScore(gap,min,max,tolerance);
        const aligned=clamp(1-lateral/Math.max(.65,sofa.w*.42),0,1);
        coffeeScore=coffeeGapScore*.62+aligned*.38;
      }

      const center=coffeePose||sofaPose&&add(sofaPose,sofaPose.normal||{x:0,y:1},sofa.d/2+.85);
      const arms=FURNITURE.filter(item=>item.id.startsWith('arm'));
      let armTotal=0;
      const armRelations=[];
      for (const arm of arms) {
        const pose=state.poses[arm.id];
        if (!pose||!center) continue;
        const radial=dist(pose,center);
        const relation=bandScore(radial,.82,1.62,.55)*.45+facingScore(pose,center)*.55;
        armTotal+=relation;
        armRelations.push(pose.relation);
      }
      let armScore=arms.length?armTotal/arms.length:1;
      if (arms.length>=2&&new Set(armRelations).size>1) armScore=Math.min(1,armScore+.08);

      const sides=FURNITURE.filter(item=>item.typeId==='side');
      const ottomans=FURNITURE.filter(item=>item.id.startsWith('ottoman'));
      const diningTable=ITEM_BY_ID.diningTable;
      const diningChairs=FURNITURE.filter(item=>item.id.startsWith('diningChair'));
      const storage=FURNITURE.filter(item=>['sideboard','bookcase','display','console'].includes(item.typeId));
      const lights=FURNITURE.filter(item=>item.id.startsWith('floorLamp'));
      const plants=FURNITURE.filter(item=>item.id.startsWith('plant'));
      const sideScore=sides.length?sides.filter(item=>relationSatisfied(state,item.id)).length/sides.length:1;
      const ottomanScore=ottomans.length?ottomans.filter(item=>relationSatisfied(state,item.id)).length/ottomans.length:1;
      let diningScore=diningTable&&state.poses.diningTable?1:!diningTable?1:0;
      if (diningChairs.length&&diningTable&&state.poses.diningTable) {
        const chairScore=diningChairs.reduce((sum,item)=>{
          const pose=state.poses[item.id];
          return sum+(pose?(relationSatisfied(state,item.id) ? .45 : 0)+facingScore(pose,state.poses.diningTable)*.55:0);
        },0)/diningChairs.length;
        diningScore=diningScore*.35+chairScore*.65;
      }
      const storageScore=storage.length?storage.reduce((sum,item)=>{
        const pose=state.poses[item.id];
        if (!pose) return sum;
        let score=relationSatisfied(state,item.id)&&!windowOverlap(item,pose,scene)?1:0;
        if (item.typeId==='sideboard'&&diningTable&&state.poses.diningTable) score*=bandScore(dist(pose,state.poses.diningTable),.65,3.0,1.2);
        return sum+score;
      },0)/storage.length:1;
      const lightScore=lights.length?lights.filter(item=>relationSatisfied(state,item.id)).length/lights.length:1;
      const plantScore=plants.length?plants.filter(item=>relationSatisfied(state,item.id)).length/plants.length:1;
      const relationWeights=[
        [relationSatisfied(state,'sofa')?1:0,1], [tvScore,3], [coffeeScore,2],
        [armScore,Math.max(1,arms.length)], [sideScore,sides.length*.45],
        [ottomanScore,ottomans.length*.45], [diningScore,diningTable?1.5:0],
        [storageScore,storage.length*.55], [lightScore,lights.length*.25], [plantScore,plants.length*.18]
      ];
      const weightTotal=relationWeights.reduce((sum,row)=>sum+row[1],0)||1;
      const relation=relationWeights.reduce((sum,row)=>sum+row[0]*row[1],0)/weightTotal;
      const livingComfort=coffeeGapScore*.28+tvGapScore*.18+armScore*.24+accessScore*.22+.08;
      const comfort=diningTable?livingComfort*.84+diningScore*.16:livingComfort;
      const windowSafe=(tvPose&&!windowOverlap(tv,tvPose,scene)?1:0)*.52+
        (sofaPose&&!windowOverlap(sofa,sofaPose,scene)?1:0)*.16+storageScore*.32;
      return {relation,comfort:clamp(comfort,0,1),daylight:clamp(windowSafe,0,1),core:(tvScore*.58+coffeeScore*.42),tvScore,coffeeScore,armScore,diningScore,storageScore};
    }

    function furnitureArea(item,pose) {
      return footprintRects(item,pose).reduce((sum,rect)=>sum+rect.w*rect.d,0);
    }

    function moduleCompletionMetrics(state,scene) {
      const placedCount=typeId=>FURNITURE.filter(item=>item.typeId===typeId&&state.poses[item.id]).length;
      const placed=typeId=>placedCount(typeId)>0;
      const tier=roomAreaTier(currentProgram,scene.area),expected=new Set(tier.modules||[]),modules=[];
      const bedroomAspect=Math.max(scene.width/Math.max(scene.depth,EPS),scene.depth/Math.max(scene.width,EPS));
      const recognizedHotelMedia=currentProgram==='bedroom'&&scene.shape==='recognized'&&scene.area>=15&&bedroomAspect>=1.65;
      if(recognizedHotelMedia)expected.delete('lounge');
      const add=(id,label,weight,parts)=>{
        const partWeight=parts.reduce((sum,row)=>sum+row[1],0)||1;
        const ratio=clamp(parts.reduce((sum,row)=>sum+clamp(row[0],0,1)*row[1],0)/partWeight,0,1);
        modules.push({id,label,weight,ratio,complete:ratio>=.985});
      };
      if(currentProgram==='bedroom'){
        const nightTarget=scene.area>=9?2:scene.area>=8?1:0;
        add('sleep','床组与基础收纳',2.4,nightTarget?[
          [placed('bed')?1:0,.48],[Math.min(1,placedCount('night')/nightTarget),.27],[placed('wardrobe')?1:0,.25]
        ]:[
          [placed('bed')?1:0,.58],[placed('wardrobe')?1:0,.42]
        ]);
        if(expected.has('work')||expected.has('micro-work'))add('work','工作组',1.25,[[placed('desk')?1:0,.55],[placed('chair')?1:0,.45]]);
        if(expected.has('lounge'))add('lounge','卧室会客组',1.45,[[placed('bedroomLoveseat')?1:0,.42],[placed('bedroomTeaTable')?1:0,.25],[placed('tvbench')?1:0,.33]]);
        if(recognizedHotelMedia)add('hotel-media','酒店式床对电视墙',1.15,[[placed('tvbench')?1:0,1]]);
        if(expected.has('storage'))add('storage','扩展收纳组',.75,[[Math.min(1,(placedCount('bedroomDisplay')+placedCount('chest')+placedCount('shelf'))/2),1]]);
        if(placed('vanity')||placed('vanityStool'))add('vanity','梳妆组',.55,[[placed('vanity')?1:0,.58],[placed('vanityStool')?1:0,.42]]);
        if(placed('lounge'))add('reading','阅读角',.45,[[1,1]]);
      }else{
        add('conversation','视听会客组',2.5,[[placed('sofa')?1:0,.40],[placed('tv')?1:0,.34],[placed('coffee')?1:0,.26]]);
        if(expected.has('guest-seating'))add('guest-seating','围合座位组',1.15,[[Math.min(1,placedCount('arm')),.55],[Math.min(1,placedCount('side')),.27],[Math.min(1,placedCount('floorLamp')),.18]]);
        if(expected.has('dining')){
          // 当前阶段以“真实第二功能区”为底线：一桌两椅即为完整紧凑餐组；
          // 更多餐椅仍可作为可选增量，不能为了凑四椅挤死通路和沿墙收纳。
          const chairTarget=Math.max(1,Number(DESIGN_GRAMMAR.living.groups.dining.minimumChairs)||1);
          const diningRatio=(placed('diningTable')?.42:0)+Math.min(1,placedCount('diningChair')/chairTarget)*.58;
          // 第二功能区必须是真实餐组，不能再用同一会客区里的两把单椅和两个柜子
          // 把模块分顶满。否则大房间视觉上仍只有一个中心团块。
          add('dining','第二功能区（餐组）',1.65,[[diningRatio,1]]);
        }
        if(expected.has('storage')){
          const storageTypes=['sideboard','bookcase','display','console'].filter(placed).length;
          add('storage','连续收纳组',.90,[[Math.min(1,storageTypes/2),1]]);
        }
      }
      const totalWeight=modules.reduce((sum,row)=>sum+row.weight,0)||1;
      const score=modules.reduce((sum,row)=>sum+row.ratio*row.weight,0)/totalWeight;
      return {
        score,completeCount:modules.filter(row=>row.complete).length,
        expectedCount:modules.length,incomplete:modules.filter(row=>!row.complete).map(row=>row.id),
        tier:tier.id,details:modules
      };
    }

    function layoutMassCenter(state,scene) {
      let mass=0,x=0,y=0;
      for(const [id,pose] of Object.entries(state.poses)) {
        const item=ITEM_BY_ID[id];if(!item)continue;
        const weight=Math.sqrt(Math.max(.04,furnitureArea(item,pose)));
        mass+=weight;x+=pose.x*weight;y+=pose.y*weight;
      }
      return mass?{x:x/mass,y:y/mass}:{...scene.designField.centroid};
    }

    function wallStorageMetrics(state,scene) {
      const storageTypes=currentProgram==='living'?new Set(['sideboard','bookcase','display','console','infillCabinet']):new Set(['wardrobe','chest','shelf','tvbench','bedroomInfillCabinet']);
      const wallRuns=new Map(),items=[];
      for(const [id,pose] of Object.entries(state.poses)) {
        const item=ITEM_BY_ID[id],rule=item&&furnitureRule(item),storageLike=item&&(storageTypes.has(item.typeId)||rule?.run||/柜|收纳|storage/i.test(`${item.category||''} ${item.role||''}`));if(!item||!storageLike||pose.wallIndex<0)continue;
        const wall=scene.walls[pose.wallIndex];if(!wall)continue;
        const width=itemLocalDims(item,pose).w,along=dot({x:pose.x-wall.a.x,y:pose.y-wall.a.y},wall.dir);
        if(!wallRuns.has(wall.index))wallRuns.set(wall.index,[]);
        wallRuns.get(wall.index).push([along-width/2,along+width/2]);
        items.push({item,pose,width});
      }
      const availableWall=inventoryRoomFeatures(scene).availableWall;
      if(!items.length)return {score:.12,continuity:.12,capacity:0,coverage:0,fragmentation:.2,sliverPenalty:0,largeGapPenalty:0,totalWidth:0,availableWall};
      let slivers=0,seams=0,largeGaps=0;
      for(const intervals of wallRuns.values()) {
        intervals.sort((a,b)=>a[0]-b[0]);
        for(let i=1;i<intervals.length;i++) {
          const gap=intervals[i][0]-intervals[i-1][1];
          if(gap>.12&&gap<.62)slivers++;else if(gap>=.62)largeGaps++;else if(gap>=0)seams++;
        }
      }
      const fillValues=items.map(({pose})=>pose.runFill||.48),continuity=clamp(fillValues.reduce((s,v)=>s+v,0)/fillValues.length+seams*.06-slivers*.12,0,1);
      const totalWidth=items.reduce((sum,row)=>sum+row.width,0),target=scene.designField.scale*(currentProgram==='living'?.62:.72);
      const capacity=bandScore(totalWidth/Math.max(target,.5),.72,1.45,.72);
      const coverage=totalWidth/Math.max(availableWall,1),coverageBand=currentProgram==='living'?bandScore(coverage,.12,.36,.18):bandScore(coverage,.16,.42,.20);
      const fragmentation=clamp(1-slivers*.18-largeGaps*.08,0,1),targetCoverage=currentProgram==='living'?.24:.30;
      const emptyWallPenalty=customCabinetEnabled?clamp((targetCoverage-coverage)/targetCoverage,0,1):0;
      return {score:clamp(continuity*.36+capacity*.30+coverageBand*.24+fragmentation*.10-emptyWallPenalty*.16,0,1),continuity,capacity,coverage,coverageBand,fragmentation,emptyWallPenalty,sliverPenalty:slivers,largeGapPenalty:largeGaps,totalWidth,availableWall};
    }

    function wallPlaneMetrics(state,scene,storage,extraWallRects=[]) {
      const rules=DESIGN_QUALITY_RULES.wall;
      const byWall=new Map(),claimedByWall=new Map();
      for(const [id,pose] of Object.entries(state.poses)){
        const item=ITEM_BY_ID[id];if(!item)continue;
        const wallFilling=currentProgram==='living'
          ?['tv','sideboard','bookcase','display','console','infillCabinet'].includes(item.typeId)
          :['wardrobe','desk','vanity','chest','shelf','tvbench','bedroomDisplay','bedroomInfillCabinet'].includes(item.typeId);
        const wallClaiming=wallFilling||['bed','sofa','bedroomLoveseat','lounge'].includes(item.typeId);
        // 床、沙发等不按柜体接缝评分，但它们确实占用了一段墙，不能把其背后的墙
        // 误报为“可继续摆柜的空墙”。claimed 与 actual 因此分开记录。
        if(!wallClaiming)continue;
        // 一些关系家具虽然没有 wallIndex，但实体背边可能确实贴墙；墙面评价按
        // 真实几何投影识别，不能只依赖候选来源标签。
        for(const rect of footprintRects(item,pose))for(const wall of scene.walls){
          if(Math.abs(wall.dx)>1e-5&&Math.abs(wall.dy)>1e-5)continue;
          const halfNormal=Math.abs(wall.normal.x)>.5?rect.w/2:rect.d/2;
          const perpendicular=dot({x:rect.x-wall.a.x,y:rect.y-wall.a.y},wall.normal);
          if(Math.abs(perpendicular-halfNormal)>.055)continue;
          const width=Math.abs(wall.dir.x)>.5?rect.w:rect.d,along=dot({x:rect.x-wall.a.x,y:rect.y-wall.a.y},wall.dir);
          if(along+width/2<-.03||along-width/2>wall.length+.03)continue;
          const interval={a:clamp(along-width/2,0,wall.length),b:clamp(along+width/2,0,wall.length),actual:wallFilling,protected:false,claimed:true};
          if(!claimedByWall.has(wall.index))claimedByWall.set(wall.index,[]);claimedByWall.get(wall.index).push(interval);
          if(wallFilling){if(!byWall.has(wall.index))byWall.set(wall.index,[]);byWall.get(wall.index).push(interval)}
        }
      }
      for(const rect of extraWallRects){
        const wall=scene.walls[rect.wallIndex];if(!wall)continue;
        const width=Math.abs(wall.dir.x)>=Math.abs(wall.dir.y)?rect.w:rect.d,along=dot({x:rect.x-wall.a.x,y:rect.y-wall.a.y},wall.dir);
        if(!byWall.has(wall.index))byWall.set(wall.index,[]);
        const interval={a:clamp(along-width/2,0,wall.length),b:clamp(along+width/2,0,wall.length),actual:true,protected:false,claimed:true,postLayout:true};
        byWall.get(wall.index).push(interval);if(!claimedByWall.has(wall.index))claimedByWall.set(wall.index,[]);claimedByWall.get(wall.index).push(interval);
      }
      const openingInterval=(wall,a,b,padding)=>{
        if(!a||!b)return null;const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(pointSegmentDistance(mid,wall.a,wall.b)>.10)return null;
        const x0=dot({x:a.x-wall.a.x,y:a.y-wall.a.y},wall.dir),x1=dot({x:b.x-wall.a.x,y:b.y-wall.a.y},wall.dir);
        return {a:clamp(Math.min(x0,x1)-padding,0,wall.length),b:clamp(Math.max(x0,x1)+padding,0,wall.length),actual:false,protected:true};
      };
      const cornerGapFillable=(wall,gap,atStart)=>{
        const depth=currentProgram==='living'?.38:.34,t=atStart?gap/2:wall.length-gap/2;
        const wallPoint={x:wall.a.x+wall.dir.x*t,y:wall.a.y+wall.dir.y*t};
        const center={x:wallPoint.x+wall.normal.x*depth/2,y:wallPoint.y+wall.normal.y*depth/2};
        const horizontal=Math.abs(wall.dir.x)>Math.abs(wall.dir.y),rect={x:center.x,y:center.y,w:horizontal?gap:depth,d:horizontal?depth:gap};
        if(!rectInsidePolygon(rect,scene.polygon)||overlapsDoorClearance(rect,scene,.025))return false;
        for(const [id,pose] of Object.entries(state.poses)){
          const item=ITEM_BY_ID[id];if(!item)continue;
          if(hardFunctionalZones(item,pose).some(zone=>rectsOverlap(rect,zone.rect,0)))return false;
        }
        return true;
      };
      let internalSlivers=0,cornerSlivers=0,severeGaps=0,awkwardGaps=0,usefulBays=0,largeGaps=0,gapLength=0,severeGapLength=0,activeWalls=0,emptyUsefulBays=0,emptyUsefulLength=0;const gapDetails=[];
      const classify=(gap,corner=false,wallIndex=-1,position='internal')=>{
        if(gap<=rules.installGapMax)return 'install';
        if(gap>=rules.severeGapMin&&gap<=rules.severeGapMax){severeGaps++;severeGapLength+=gap;if(corner)cornerSlivers++;else internalSlivers++;gapDetails.push({wallIndex,position,width:round(gap,3),severity:'severe'});return 'severe';}
        if(gap<rules.usefulBayMin&&gap<=rules.awkwardGapMax){awkwardGaps++;if(corner)cornerSlivers++;else internalSlivers++;gapDetails.push({wallIndex,position,width:round(gap,3),severity:'awkward'});return 'awkward';}
        usefulBays++;largeGaps++;gapDetails.push({wallIndex,position,width:round(gap,3),severity:'useful'});return 'useful';
      };
      for(const wall of scene.walls){
        const actual=byWall.get(wall.index)||[],claimed=claimedByWall.get(wall.index)||[],protectedRows=[],winA={x:scene.window.x0,y:scene.window.y},winB={x:scene.window.x1,y:scene.window.y};
        for(const door of sceneDoors(scene)){
          const doorA=door.a||{x:door.x0,y:door.y},doorB=door.b||{x:door.x1,y:door.y},gap=openingInterval(wall,doorA,doorB,.22);if(gap)protectedRows.push(gap);
        }
        const windowGap=openingInterval(wall,winA,winB,.10);if(windowGap)protectedRows.push(windowGap);
        // 所有门窗和已经占墙的主体之外，连续达到 0.70m 的净墙段都属于可利用空墙。
        // 过去只有墙上已经有柜时才评价，整面空墙反而完全不扣分。
        const occupied=[...claimed,...protectedRows].sort((a,b)=>a.a-b.a),occupiedMerged=[];
        for(const row of occupied){const last=occupiedMerged[occupiedMerged.length-1];if(last&&row.a<=last.b+.03)last.b=Math.max(last.b,row.b);else occupiedMerged.push({...row})}
        let cursor=0;for(const row of occupiedMerged){const free=Math.max(0,row.a-cursor);if(free>=rules.usefulBayMin){emptyUsefulBays++;emptyUsefulLength+=free}cursor=Math.max(cursor,row.b)}
        const tail=Math.max(0,wall.length-cursor);if(tail>=rules.usefulBayMin){emptyUsefulBays++;emptyUsefulLength+=tail}
        if(!actual.length)continue;activeWalls++;
        const rows=[...actual,...protectedRows];
        rows.sort((a,b)=>a.a-b.a);const merged=[];
        for(const row of rows){const last=merged[merged.length-1];if(last&&row.a<=last.b+.03){last.b=Math.max(last.b,row.b);last.actual||=row.actual;last.protected||=row.protected}else merged.push({...row})}
        const first=merged[0],last=merged[merged.length-1],startGap=first.a,endGap=wall.length-last.b;
        if(first.actual&&startGap>rules.installGapMax){
          if(cornerGapFillable(wall,startGap,true)){gapLength+=startGap;classify(startGap,true,wall.index,'start')}
          else gapDetails.push({wallIndex:wall.index,position:'start',width:round(startGap,3),severity:'architectural'});
        }
        if(last.actual&&endGap>rules.installGapMax){
          if(cornerGapFillable(wall,endGap,false)){gapLength+=endGap;classify(endGap,true,wall.index,'end')}
          else gapDetails.push({wallIndex:wall.index,position:'end',width:round(endGap,3),severity:'architectural'});
        }
        for(let index=1;index<merged.length;index++){
          const left=merged[index-1],right=merged[index],gap=right.a-left.b;if(gap<=rules.installGapMax||!left.actual||!right.actual)continue;
          gapLength+=gap;classify(gap,false,wall.index,'internal');
        }
      }
      const continuity=clamp(1-severeGaps*.28-awkwardGaps*.10-severeGapLength/Math.max(storage.availableWall,1)*.72,0,1),cornerClosure=clamp(1-cornerSlivers*.30-severeGaps*.08,0,1);
      const unusedWallRatio=clamp(emptyUsefulLength/Math.max(storage.availableWall,1),0,1),emptyWallScore=clamp(1-unusedWallRatio*1.35-emptyUsefulBays*.035,0,1);
      const score=clamp(storage.score*.32+continuity*.27+cornerClosure*.17+emptyWallScore*.24,0,1),severe=severeGaps>0;
      return {score,continuity,cornerClosure,emptyWallScore,emptyUsefulBays,emptyUsefulLength,unusedWallRatio,internalSlivers,cornerSlivers,severeGaps,awkwardGaps,usefulBays,largeGaps,gapLength,severeGapLength,gapDetails,activeWalls,severe,storage};
    }

    function preferenceSatisfaction(state) {
      const groups=new Map();
      for(const item of FURNITURE){
        const typeId=item.typeId||item.id;if(!groups.has(typeId))groups.set(typeId,[]);groups.get(typeId).push(item);
      }
      let weighted=0,weightTotal=0;const details=[];
      for(const [typeId,items] of groups){
        const placed=items.filter(item=>state.poses[item.id]).length,target=items.length;
        const minimum=Math.min(target,Math.max(0,Number(items[0].minCount)||0)),optionalSlots=Math.max(0,target-minimum);
        const preference=clamp(items[0].preferenceWeight??furnitureRule(items[0]).preferenceWeight??1,0,3);
        const required=items.some(item=>!item.optional),weight=Math.max(.18,preference)*(required?2.4:1);
        let ratio=1;
        if(placed<minimum)ratio=minimum?placed/minimum:1;
        else if(optionalSlots){
          // 上限不是目标数量。满足最小数量后，首个可选件贡献大部分偏好分，
          // 后续同类件按递减收益加分；因此 1/2 是好方案，而不是只得 50%。
          const optionalPlaced=Math.min(optionalSlots,Math.max(0,placed-minimum));
          // 可选上限仍不是硬目标，但少摆不再能轻易拿到接近满分；紧凑地多完成一件
          // 会持续获得明显收益，直到同类家具接近用户设置的期望上限。
          const base=minimum?.70:.34,decay=.58;
          const progress=optionalPlaced?(1-Math.pow(decay,optionalPlaced))/(1-Math.pow(decay,optionalSlots)):0;
          ratio=base+(1-base)*progress;
        }
        weighted+=ratio*weight;weightTotal+=weight;
        details.push({typeId,placed,minimum,maximum:target,preference,ratio});
      }
      return {score:weightTotal?weighted/weightTotal:1,details};
    }

    function sizePolicySatisfaction(state,scene) {
      const policies=LAYOUT_CONSTRAINTS.search.sizePolicies?.[currentProgram]||{},details=[];
      for(const [typeId,policy] of Object.entries(policies)){
        if(policy.mode!=='max-feasible'||policy.finalPriority!==true)continue;
        const targetRow=[...(policy.targetByArea||[])].sort((a,b)=>Number(b.minArea)-Number(a.minArea)).find(row=>scene.area+EPS>=Number(row.minArea));
        const targetWidth=Number(targetRow?.width)||0;if(!(targetWidth>0))continue;
        const placed=FURNITURE.filter(item=>item.typeId===typeId&&state.poses[item.id]).map(item=>Number(state.poses[item.id].overrideW)||item.w);
        const width=placed.length?Math.max(...placed):0,ratio=clamp(width/targetWidth,0,1);
        details.push({typeId,width:round(width,2),targetWidth:round(targetWidth,2),ratio,maxTotalTradeoff:Math.max(0,Number(policy.maxTotalTradeoff)||0)});
      }
      return {score:details.length?details.reduce((sum,row)=>sum+row.ratio,0)/details.length:1,details};
    }

    function largestUnactivatedVoidRatio(state,scene,step=.30) {
      const cols=Math.max(1,Math.ceil(scene.width/step)),rows=Math.max(1,Math.ceil(scene.depth/step)),cells=new Uint8Array(cols*rows),poses=Object.entries(state.poses);
      let roomCells=0;
      const rectDistance=(point,rect)=>Math.hypot(Math.max(0,Math.abs(point.x-rect.x)-rect.w/2),Math.max(0,Math.abs(point.y-rect.y)-rect.d/2));
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
        const point={x:(x+.5)*step,y:(y+.5)*step},index=y*cols+x;if(!pointInPolygon(point,scene.polygon))continue;roomCells++;
        let activated=false;
        for(const [id,pose] of poses){
          const item=ITEM_BY_ID[id];if(!item)continue;
          const influence=(item.typeId==='plant'||item.typeId==='floorLamp') ? .40 : .58;
          if(footprintRects(item,pose).some(rect=>rectDistance(point,rect)<=influence)||rectDistance(point,serviceZone(item,pose))<=.18){activated=true;break;}
        }
        if(!activated)cells[index]=1;
      }
      let largest=0;const queue=new Int32Array(cells.length);
      for(let start=0;start<cells.length;start++)if(cells[start]){
        let head=0,tail=0,count=0;queue[tail++]=start;cells[start]=0;
        while(head<tail){const index=queue[head++],x=index%cols,y=Math.floor(index/cols);count++;
          if(x>0&&cells[index-1]){cells[index-1]=0;queue[tail++]=index-1;}if(x+1<cols&&cells[index+1]){cells[index+1]=0;queue[tail++]=index+1;}
          if(y>0&&cells[index-cols]){cells[index-cols]=0;queue[tail++]=index-cols;}if(y+1<rows&&cells[index+cols]){cells[index+cols]=0;queue[tail++]=index+cols;}
        }
        largest=Math.max(largest,count);
      }
      return roomCells?largest/roomCells:0;
    }

    function groundPlaneMetrics(state,scene,coverageMetrics,step=DESIGN_QUALITY_RULES.floor.gridStep,extraRects=[]){
      const rules=DESIGN_QUALITY_RULES.floor,radius=rules.humanRadius;
      const cols=Math.max(1,Math.ceil(scene.width/step)),rows=Math.max(1,Math.ceil(scene.depth/step));
      const free=new Uint8Array(cols*rows),safe=new Uint8Array(cols*rows),claimed=new Uint8Array(cols*rows),visited=new Uint8Array(cols*rows);
      const bodies=[...Object.entries(state.poses).flatMap(([id,pose])=>ITEM_BY_ID[id]?footprintRects(ITEM_BY_ID[id],pose):[]),...extraRects];
      const claimedRects=Object.entries(state.poses).flatMap(([id,pose])=>ITEM_BY_ID[id]?functionalZones(ITEM_BY_ID[id],pose).map(zone=>zone.rect):[]);
      const rectDistance=(point,rect)=>Math.hypot(Math.max(0,Math.abs(point.x-rect.x)-rect.w/2),Math.max(0,Math.abs(point.y-rect.y)-rect.d/2));
      const boundaryDistance=point=>{
        let value=Infinity;for(let i=0;i<scene.polygon.length;i++)value=Math.min(value,pointSegmentDistance(point,scene.polygon[i],scene.polygon[(i+1)%scene.polygon.length]));return value;
      };
      let roomCells=0,freeCells=0,safeCells=0,narrowCells=0;
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
        const point={x:(x+.5)*step,y:(y+.5)*step},index=y*cols+x;if(!pointInPolygon(point,scene.polygon))continue;roomCells++;
        const distances=bodies.map(rect=>rectDistance(point,rect)).sort((a,b)=>a-b),bodyDistance=distances[0]??Infinity;
        if(bodyDistance<=step*.18)continue;
        free[index]=1;freeCells++;if(claimedRects.some(rect=>pointInRect(point,rect)))claimed[index]=1;
        const boundary=boundaryDistance(point);
        if(boundary+step*.36>=radius&&bodyDistance+step*.28>=radius){safe[index]=1;safeCells++;}
      }
      // 只有左右或上下两侧都被夹住的自由格才算窄缝。旧判定把正常贴墙家具的
      // 整条侧边也算成死角，导致家具越完整反而扣得越多。
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
        const index=y*cols+x;if(!free[index])continue;
        const left=x>0&&free[index-1],right=x+1<cols&&free[index+1];
        const up=y>0&&free[index-cols],down=y+1<rows&&free[index+cols];
        if((!left&&!right)||(!up&&!down))narrowCells++;
      }
      const queue=new Int32Array(safe.length),components=[];
      for(let start=0;start<safe.length;start++)if(safe[start]&&!visited[start]){
        let head=0,tail=0,count=0,unclaimedCount=0,sumX=0,sumY=0;queue[tail++]=start;visited[start]=1;
        while(head<tail){const index=queue[head++],x=index%cols,y=Math.floor(index/cols);count++;if(!claimed[index])unclaimedCount++;sumX+=(x+.5)*step;sumY+=(y+.5)*step;
          if(x>0&&safe[index-1]&&!visited[index-1]){visited[index-1]=1;queue[tail++]=index-1}if(x+1<cols&&safe[index+1]&&!visited[index+1]){visited[index+1]=1;queue[tail++]=index+1}
          if(y>0&&safe[index-cols]&&!visited[index-cols]){visited[index-cols]=1;queue[tail++]=index-cols}if(y+1<rows&&safe[index+cols]&&!visited[index+cols]){visited[index+cols]=1;queue[tail++]=index+cols}
        }
        components.push({count,unclaimedCount,area:unclaimedCount*step*step,x:sumX/count,y:sumY/count});
      }
      components.sort((a,b)=>b.count-a.count);const main=components[0]||{count:0,area:0,x:scene.designField.centroid.x,y:scene.designField.centroid.y};
      const disconnected=components.slice(1),unreachableCells=disconnected.reduce((sum,row)=>sum+row.unclaimedCount,0);
      const deadRows=disconnected.filter(row=>row.area>=rules.pocketMinArea&&row.area<=rules.pocketMaxArea),deadPocketCells=deadRows.reduce((sum,row)=>sum+row.unclaimedCount,0);
      let mass=0,massX=0,massY=0;for(const rect of bodies){const area=Math.max(.01,rect.w*rect.d);mass+=area;massX+=rect.x*area;massY+=rect.y*area;}
      const center=scene.designField.centroid,scale=Math.max(scene.designField.scale,1),massCenter=mass?{x:massX/mass,y:massY/mass}:center;
      const massDistance=dist(massCenter,center)/scale,freeDistance=dist(main,center)/scale,balanceDistance=massDistance*.62+freeDistance*.38;
      const balance=bandScore(balanceDistance,0,rules.balanceIdeal,Math.max(.05,rules.balanceSevere-rules.balanceIdeal));
      const largestVoidRatio=roomCells?main.count/roomCells:0,voidCompletion=bandScore(largestVoidRatio,rules.largestOpenMin,rules.largestOpenMax,.24);
      const unreachableFreeRatio=safeCells?unreachableCells/safeCells:0,narrowPocketRatio=freeCells?narrowCells/freeCells:0,deadPocketRatio=freeCells?deadPocketCells/freeCells:0;
      const topologyScore=clamp(1-unreachableFreeRatio*5.8-narrowPocketRatio*3.8-deadRows.length*.11,0,1);
      const density=coverageMetrics.effectiveDensity,target=coverageMetrics.targetDensity,densityScore=bandScore(density,target*.78,target*1.24,Math.max(.10,target*.52));
      const severe=unreachableFreeRatio>rules.severeUnreachableRatio||narrowPocketRatio>rules.severeNarrowRatio||balanceDistance>rules.balanceSevere;
      return {
        score:clamp(densityScore*.18+voidCompletion*.18+balance*.27+topologyScore*.37,0,1),
        densityScore,voidCompletion,balance,balanceDistance,massDistance,freeDistance,topologyScore,severe,
        deadPockets:deadRows.length,deadPocketRatio,largestVoidRatio,unreachableFreeRatio,narrowPocketRatio,
        freeRatio:roomCells?freeCells/roomCells:0,safeRatio:roomCells?safeCells/roomCells:0,componentCount:components.length
      };
    }

    function partialFieldMerit(state,scene){
      // Beam 中只需要判断趋势，不需要重复跑最终评分使用的 0.24m 精细格网。
      // 0.38m 粗格网保留断连、死角和重心失衡信号，入围方案仍会接受完整精度复核。
      const ground=groundPlaneMetrics(state,scene,stateCoverageAndActivation(state,scene),.38);
      return ground.score*24-ground.unreachableFreeRatio*95-ground.deadPockets*7-(ground.severe?24:0);
    }

    function spaceActivationMetrics(state,scene,coverageMetrics) {
      const density=coverageMetrics.effectiveDensity,target=coverageMetrics.targetDensity;
      const densityScore=bandScore(density,target*.72,target*1.18,Math.max(.10,target*.55));
      const largestVoidRatio=largestUnactivatedVoidRatio(state,scene),voidLimit=currentProgram==='living' ? .18 : .13;
      const voidCompletion=bandScore(largestVoidRatio,0,voidLimit,.34);
      return {score:clamp(densityScore*.62+voidCompletion*.38,0,1),densityScore,voidCompletion,largestVoidRatio};
    }

    function groupCompactness(state,ids,anchorId,scene,ideal=[.08,.28]) {
      const anchor=state.poses[anchorId];if(!anchor)return .45;
      const poses=Object.entries(state.poses).filter(([id])=>ids.some(type=>id===type||ITEM_BY_ID[id]?.typeId===type)&&id!==anchorId).map(([,pose])=>pose);
      if(!poses.length)return .72;
      const mean=poses.reduce((sum,pose)=>sum+dist(pose,anchor),0)/poses.length/scene.designField.scale;
      return bandScore(mean,ideal[0],ideal[1],.24);
    }

    function stateCoverageAndActivation(state,scene) {
      const counts=baseInventoryCounts(currentProgram);for(const key of Object.keys(counts))counts[key]=0;
      let effectiveArea=0;
      for(const item of FURNITURE) {
        const pose=state.poses[item.id];if(!pose)continue;
        counts[item.typeId]=(counts[item.typeId]||0)+1;
        const zone=furnitureRule(item).service||FURNITURE_RULES.default.service;
        const local=itemLocalDims(item,pose),zoneArea=(local.w+(zone.spanExtra||0)*2)*(zone.depth||.42);
        effectiveArea+=furnitureArea(item,pose)+zoneArea*(zone.hard?.42:.14);
      }
      const coverage=inventoryCoverage(currentProgram,counts,scene);
      const reference=currentProgram==='living'?20:14,baseTarget=objectiveDensity(INVENTORY_OBJECTIVES.balanced,currentProgram);
      const target=baseTarget*clamp(1-Math.log2(Math.max(scene.area,EPS)/reference)*.055,.86,1.08)*.86*(DENSITY_MODES[layoutDensityMode]?.density||1);
      const density=effectiveArea/Math.max(scene.area,EPS);
      const activation=clamp(density/Math.max(target*.78,.08),0,1)*bandScore(density,0,target+.10,.18);
      return {counts,coverage:coverage.score,activation:clamp(activation,0,1),effectiveDensity:density,targetDensity:target};
    }

    function designMetrics(state,scene,reach) {
      const massCenter=layoutMassCenter(state,scene),balanceDistance=dist(massCenter,scene.designField.centroid)/scene.designField.scale;
      const balance=bandScore(balanceDistance,0,.17,.28);
      const voidScore=clamp(reach.connectedRatio*.48+(reach.levels.normal?.connectedRatio||reach.connectedRatio)*.30+(reach.levels.comfortable?.connectedRatio||reach.levels.normal?.connectedRatio||reach.connectedRatio)*.22,0,1);
      const storage=wallStorageMetrics(state,scene),wall=wallPlaneMetrics(state,scene,storage),activationMetrics=stateCoverageAndActivation(state,scene);
      let alignment=.65,compact=.65,zoning=.72,symmetry=.72;
      if(currentProgram==='living') {
        const sofa=state.poses.sofa,tv=state.poses.tv,coffee=state.poses.coffee;
        if(sofa&&tv&&coffee) {
          const axis=sofa.wallDir||{x:1,y:0};
          const tvOffset=Math.abs(dot({x:tv.x-sofa.x,y:tv.y-sofa.y},axis))/Math.max(ITEM_BY_ID.sofa.w,.8);
          const coffeeOffset=Math.abs(dot({x:coffee.x-sofa.x,y:coffee.y-sofa.y},axis))/Math.max(ITEM_BY_ID.sofa.w,.8);
          alignment=clamp((1-tvOffset)*.54+(1-coffeeOffset)*.46,0,1);
        }
        compact=groupCompactness(state,['coffee','arm','side','ottoman','floorLamp'],'sofa',scene,[.08,.30]);
        const dining=state.poses.diningTable;
        if(sofa&&dining)zoning=bandScore(dist(sofa,dining)/scene.designField.scale,.28,.62,.25);
        const arms=Object.entries(state.poses).filter(([id])=>ITEM_BY_ID[id]?.typeId==='arm').map(([,pose])=>pose);
        if(sofa&&arms.length>=2) {
          const lateral=sofa.wallDir||{x:1,y:0},values=arms.map(pose=>dot({x:pose.x-sofa.x,y:pose.y-sofa.y},lateral));
          symmetry=values.some(value=>value<0)&&values.some(value=>value>0)?bandScore(Math.abs(Math.abs(Math.min(...values))-Math.max(...values)),0,.35,.65):.42;
        }
      } else {
        const bed=state.poses.bed,nights=Object.entries(state.poses).filter(([id])=>ITEM_BY_ID[id]?.typeId==='night').map(([,pose])=>pose);
        compact=groupCompactness(state,['night','bench'],'bed',scene,[.06,.24]);
        if(bed&&nights.length>=2) {
          const lateral=bed.wallDir||{x:1,y:0},values=nights.map(pose=>dot({x:pose.x-bed.x,y:pose.y-bed.y},lateral));
          symmetry=values.some(value=>value<0)&&values.some(value=>value>0)?bandScore(Math.abs(Math.abs(Math.min(...values))-Math.max(...values)),0,.16,.42):.38;
          alignment=symmetry;
        }
        const desk=state.poses.desk;if(bed&&desk)zoning=bandScore(dist(bed,desk)/scene.designField.scale,.28,.68,.25);
      }
      const composition=clamp(alignment*.24+compact*.21+zoning*.17+symmetry*.11+balance*.13+voidScore*.14,0,1);
      return {composition,storage:wall.score,alignment,compact,zoning,symmetry,balance,voidScore,storageDetails:storage,wallDetails:wall,...activationMetrics};
    }

    function evaluateFull(state,scene,flowLevels=FLOW_RADII) {
      // 搜索走完所有槽位即为完整方案；0–N 槽位允许没有 pose。
      const allPlaced = FURNITURE.every(item => item.optional||state.poses[item.id]);
      const reach = computeReachability(state,scene,flowLevels);
      let relationHits = 0;
      const placedItems=FURNITURE.filter(item=>state.poses[item.id]);
      for (const item of placedItems) if (relationSatisfied(state,item.id)) relationHits++;
      const accessScore=accessClearanceScore(state,scene);

      let functionScore;
      let daylightScore;
      let relationScore=placedItems.length?relationHits/placedItems.length:0;
      let comfortScore=accessScore;
      let diagnostics={};
      const stateCoverage=stateCoverageAndActivation(state,scene);
      const modules=moduleCompletionMetrics(state,scene);
      if (currentProgram==='living') {
        const quality=livingMetrics(state,scene,accessScore);
        functionScore=allPlaced?(modules.score*72+stateCoverage.coverage*28):placedItems.length/Math.max(1,FURNITURE.filter(item=>!item.optional).length)*58;
        relationScore=quality.relation;
        comfortScore=quality.comfort;
        daylightScore=quality.daylight*100;
        diagnostics=quality;
      } else {
        const deskPose=state.poses.desk;
        const deskNearWindow=deskPose?clamp(1-dist(deskPose,scene.window.mid)/2.3,0,1):0;
        const vanity=ITEM_BY_ID.vanity,vanityPose=state.poses.vanity;
        const vanityNearWindow=vanity&&vanityPose?clamp(1-dist(vanityPose,scene.window.mid)/2.3,0,1):1;
        const storageItems=FURNITURE.filter(item=>['wardrobe','chest','shelf','tvbench'].includes(item.typeId));
        const placedStorage=storageItems.filter(item=>state.poses[item.id]);
        const storageClearWindow=placedStorage.length?placedStorage.filter(item=>!windowOverlap(item,state.poses[item.id],scene)).length/placedStorage.length:1;
        functionScore=allPlaced?modules.score*72+stateCoverage.coverage*28:placedItems.length/Math.max(1,FURNITURE.filter(item=>!item.optional).length)*60;
        daylightScore=(vanity?deskNearWindow*.50+vanityNearWindow*.25+storageClearWindow*.25:deskNearWindow*.65+storageClearWindow*.35)*100;
      }
      const design=designMetrics(state,scene,reach);
      const preference=preferenceSatisfaction(state);
      const sizePolicy=sizePolicySatisfaction(state,scene);
      const activation=spaceActivationMetrics(state,scene,design);
      const ground=groundPlaneMetrics(state,scene,design);
      const circulation=clamp(reach.hardReachableRatio*.34+reach.reachableRatio*.22+reach.normalHardRatio*.16+reach.normalRatio*.10+
        reach.comfortableHardRatio*.06+reach.connectedRatio*.08+(reach.levels.normal?.connectedRatio||0)*.04,0,1);
      const scores = {
        feasible: allPlaced&&reach.hardPass ? 100 : Math.round(placedItems.filter(item=>!item.optional).length/Math.max(1,FURNITURE.filter(item=>!item.optional).length)*(reach.hardPass?86:68)),
        function: Math.round(clamp(functionScore,0,100)),
        modules: Math.round(modules.score*100),
        circulation: Math.round(circulation*100),
        relation: Math.round(clamp(relationScore*100,0,100)),
        composition: Math.round(design.composition*100),
        storage: Math.round(design.storage*100),
        comfort: Math.round(clamp(comfortScore*100,0,100)),
        daylight: Math.round(daylightScore),
        preference: Math.round(preference.score*100),
        activation: Math.round(activation.score*100),
        ground: Math.round(ground.score*100)
      };
      const weights=DESIGN_QUALITY_RULES.weights;
      let total=scores.function*weights.function+scores.ground*weights.ground+scores.storage*weights.wall+scores.relation*weights.relation+scores.circulation*weights.circulation;
      // 地面与墙面的严重缺陷采用封顶，而不是靠其它对象高分抵消。
      const severeFieldDefect=ground.severe||design.wallDetails.severe;
      const weakField=scores.ground<DESIGN_QUALITY_RULES.gates.minGround||scores.storage<DESIGN_QUALITY_RULES.gates.minWall;
      if(severeFieldDefect)total=Math.min(total,DESIGN_QUALITY_RULES.gates.severeDefectCap);
      else if(weakField)total=Math.min(total,DESIGN_QUALITY_RULES.gates.weakFieldCap);
      if (allPlaced) total=Math.min(total,scores.function+14,scores.circulation+14,scores.relation+12,scores.storage+15,scores.ground+15,scores.comfort+18);
      const placedDiningChairs=placedItems.filter(item=>item.typeId==='diningChair').length;
      const diningChairMinimum=Math.max(1,Number(DESIGN_GRAMMAR.living.groups.dining.minimumChairs)||1);
      const diningCoherent=!state.poses.diningTable||placedDiningChairs>=Math.min(diningChairMinimum,CONFIGS.living.counts.diningChair||0);
      const guestSeatingCoherent=currentProgram!=='living'||!roomAreaTier('living',scene.area).modules.includes('guest-seating')||placedItems.some(item=>item.typeId==='arm');
      const focusChallenge=(LAYOUT_CONSTRAINTS.inventory.focusChallenges?.[currentProgram]||[]).find(row=>scene.area+EPS>=Number(row.minArea||0)&&scene.area-EPS<=Number(row.maxArea??Infinity));
      const focusChallengeCoherent=!focusChallenge||Object.entries(focusChallenge.target||{}).every(([typeId,count])=>placedItems.filter(item=>item.typeId===typeId).length>=Number(count));
      // 丰满度是质量门槛，不只是库存估算偏好。过去异形大客厅即使只落下
      // 沙发、电视、茶几和两件小家具也会通过，视觉上必然显空。
      const irregularRoom=scene.shape!=='rect';
      const richMinimum=layoutDensityMode==='rich'?configuredAreaValue(LAYOUT_CONSTRAINTS.inventory.richMinimum[currentProgram],scene.area,irregularRoom?'irregular':'value'):0;
      const complementConfig=LAYOUT_CONSTRAINTS.postLayout.wallComplements,complementProgram=complementConfig.programs[currentProgram];
      const potentialPostFurniture=customCabinetEnabled&&complementConfig.enabled&&complementConfig.countTowardRichMinimum
        ?configuredAreaValue(complementProgram.budgetByArea,scene.area):0;
      const densityCoherent=placedItems.length+potentialPostFurniture>=richMinimum;
      const quality=LAYOUT_CONSTRAINTS.qualityPass;
      const requiredModuleScore=configuredAreaValue(quality.requiredModuleScore[currentProgram],scene.area)||DESIGN_QUALITY_RULES.gates.minModules;
      // 长条卧室的一整面连续空墙不能仅靠“墙面尚有可用余量”混过去。
      // 这类房间最适合酒店式床尾电视/浅柜；最大空白墙段超过 3.2m 时，
      // 要求搜索继续尝试真实沿墙家具，而不是输出一条空走廊。
      const bedroomAspect=Math.max(scene.width/Math.max(scene.depth,EPS),scene.depth/Math.max(scene.width,EPS));
      const longBedroom=quality.longBedroomWall;
      const longBedroomWallRequired=currentProgram==='bedroom'&&scene.shape==='recognized'&&scene.area>=longBedroom.minArea&&bedroomAspect>=longBedroom.minAspect;
      const largestEmptyWallBay=Math.max(0,...(design.wallDetails.gapDetails||[]).filter(row=>row.severity==='useful'||row.severity==='architectural').map(row=>Number(row.width)||0));
      const bedroomWallCoherent=!longBedroomWallRequired||largestEmptyWallBay<=longBedroom.maxEmptyBay;
      const bedroomWallFinishable=bedroomWallCoherent||customCabinetEnabled;
      const searchSevereFieldDefect=ground.severe||(design.wallDetails.severe&&!customCabinetEnabled);
      // 大房间即使通路很漂亮，若最大连续空地仍超过约一半，也只是把家具堆成
      // 一个中央团块。它作为搜索期硬门槛，逼迫两组家具真正展开到不同区域。
      const largeGround=quality.largeRoomGround;
      const largeRoomGroundCoherent=!(currentProgram==='living'&&scene.area>=largeGround.minArea&&scene.area<=largeGround.maxArea&&ground.largestVoidRatio>largeGround.maxLargestVoidRatio);
      // 50 分代表硬使用区与主要通道均已满足的紧凑方案。旧阈值 52 会把完整的
      // “卧室单人沙发 + 茶几 + 小电视柜”组合误判失败，随后反复尝试更臃肿库存。
      const qualityPass=allPlaced&&diningCoherent&&guestSeatingCoherent&&focusChallengeCoherent&&densityCoherent&&largeRoomGroundCoherent&&bedroomWallFinishable&&reach.hardPass&&!searchSevereFieldDefect&&
        scores.modules>=requiredModuleScore&&scores.circulation>=quality.minimumScores.circulation&&scores.relation>=quality.minimumScores.relation&&scores.composition>=quality.minimumScores.composition&&
        scores.storage>=DESIGN_QUALITY_RULES.gates.minWall&&scores.ground>=DESIGN_QUALITY_RULES.gates.minGround&&scores.comfort>=quality.minimumScores.comfort&&scores.preference>=quality.minimumScores.preference;
      diagnostics={...diagnostics,...design,modules,preference,sizePolicy,activation,ground,functionCoverage:stateCoverage.coverage,diningCoherent,guestSeatingCoherent,focusChallengeCoherent,placedDiningChairs,richMinimum,densityCoherent,potentialPostFurniture,largeRoomGroundCoherent,longBedroomWallRequired,largestEmptyWallBay,bedroomWallCoherent,requiredModuleScore,severeFieldDefect,weakField};
      return { total:round(total,1), scores, reach, qualityPass, diagnostics };
    }

    function traceEvaluationBreakdown(evaluation) {
      const scores=evaluation?.scores||{},diagnostics=evaluation?.diagnostics||{},wall=diagnostics.wallDetails||{};
      const percent=value=>Math.round(clamp(Number.isFinite(value)?value:0,0,1)*100);
      return {
        ground:Number(scores.ground)||0,wall:Number(scores.storage)||0,relation:Number(scores.relation)||0,
        circulation:Number(scores.circulation)||0,alignment:percent(diagnostics.alignment),daylight:Number(scores.daylight)||0,
        emptyWall:percent(wall.emptyWallScore),corner:percent(wall.cornerClosure),
        severeWallGaps:Number(wall.severeGaps)||0,awkwardWallGaps:Number(wall.awkwardGaps)||0
      };
    }

    function solutionSignature(state) {
      const p = state.poses;
      const ids=PROGRAMS[currentProgram].primaryIds;
      return ids.map(id=>p[id]?.wallIndex??p[id]?.relation??'x').join('-');
    }

    function poseDifference(p,q) {
      const sizeDelta=Math.abs((p.overrideW||0)-(q.overrideW||0))+Math.abs((p.overrideD||0)-(q.overrideD||0));
      return dist(p,q)+(p.rotation===q.rotation?0:1.1)+sizeDelta*.9;
    }

    function minimumGroupDifference(left,right) {
      if(left.length!==right.length)return Math.abs(left.length-right.length)*10;
      const n=left.length;if(!n)return 0;
      const size=1<<n,dp=new Float64Array(size);dp.fill(Infinity);dp[0]=0;
      for(let mask=0;mask<size;mask++){
        let index=0;for(let bits=mask;bits;bits&=bits-1)index++;
        if(index>=n||!Number.isFinite(dp[mask]))continue;
        for(let j=0;j<n;j++)if(!(mask&(1<<j))){const next=mask|(1<<j),cost=dp[mask]+poseDifference(left[index],right[j]);if(cost<dp[next])dp[next]=cost;}
      }
      return dp[size-1];
    }

    function stateDifference(a,b) {
      const typeIds=[...new Set(FURNITURE.map(item=>item.typeId||item.id))];let sum=0;
      for(const typeId of typeIds){
        const items=FURNITURE.filter(item=>(item.typeId||item.id)===typeId);
        const left=items.map(item=>a.poses[item.id]).filter(Boolean),right=items.map(item=>b.poses[item.id]).filter(Boolean);
        sum+=minimumGroupDifference(left,right);
      }
      return sum;
    }

    function dedupeFinalLayouts(states,minimumDifference=.36) {
      const unique=[];
      for(const state of [...states].sort((a,b)=>b.evaluation.total-a.evaluation.total)) {
        if(unique.every(other=>stateDifference(other,state)>=minimumDifference)) unique.push(state);
      }
      return unique;
    }

    function chooseObjectiveSolutions(evaluated) {
      // 最终选择按完整功能组和全局场评分，而不是按裸家具件数。多放三个孤立小件
      // 不应压过少一件、但地面连续且会客/工作模块完整的设计。
      return [...evaluated].sort((a,b)=>{
        const passDelta=Number(b.evaluation?.qualityPass)-Number(a.evaluation?.qualityPass);if(passDelta)return passDelta;
        const moduleDelta=(b.evaluation?.scores?.modules??0)-(a.evaluation?.scores?.modules??0);if(Math.abs(moduleDelta)>=3)return moduleDelta;
        if(layoutDensityMode==='rich'){
          const pieceDelta=Object.keys(b.poses||{}).length-Object.keys(a.poses||{}).length;if(pieceDelta)return pieceDelta;
        }
        const sizeA=a.evaluation?.diagnostics?.sizePolicy,sizeB=b.evaluation?.diagnostics?.sizePolicy,sizeDelta=(sizeB?.score??1)-(sizeA?.score??1);
        const sizeTradeoff=Math.max(0,...[...(sizeA?.details||[]),...(sizeB?.details||[])].map(row=>Number(row.maxTotalTradeoff)||0));
        const totalDelta=(b.evaluation?.total??-Infinity)-(a.evaluation?.total??-Infinity);
        if(Math.abs(sizeDelta)>=.08&&Math.abs(totalDelta)<=sizeTradeoff)return sizeDelta;
        if(totalDelta)return totalDelta;
        return Object.keys(b.poses||{}).length-Object.keys(a.poses||{}).length;
      }).slice(0,3);
    }

    function upgradeSelectedSizePolicies(states,scene) {
      return states.map(state=>{
        let upgraded=state;
        for(const [typeId,policy] of Object.entries(LAYOUT_CONSTRAINTS.search.sizePolicies?.[currentProgram]||{})){
          if(policy.mode!=='max-feasible'||policy.finalPriority!==true)continue;
          const item=FURNITURE.find(row=>row.typeId===typeId&&upgraded.poses?.[row.id]);
          if(!item?.sizeVariants?.length)continue;
          const pose=upgraded.poses[item.id],currentWidth=Number(pose.overrideW)||item.w;
          const targetRow=[...(policy.targetByArea||[])].sort((a,b)=>Number(b.minArea)-Number(a.minArea)).find(row=>scene.area+EPS>=Number(row.minArea));
          const targetWidth=Number(targetRow?.width)||currentWidth;
          if(currentWidth+EPS>=targetWidth)continue;
          const variants=item.sizeVariants.filter(row=>row.w>currentWidth+EPS&&row.w<=targetWidth+EPS).sort((a,b)=>b.w-a.w);
          const baseline=upgraded.evaluation||evaluateFull(upgraded,scene),tradeoff=Math.max(0,Number(policy.maxTotalTradeoff)||0);
          for(const variant of variants){
            const anchoredPose={...pose,overrideW:variant.w,overrideD:variant.d,overrideShape:variant.shape||item.shape,sizeVariant:variant.id,sizeLabel:variant.label};
            if(Number.isInteger(pose.wallIndex)&&pose.wallIndex>=0){
              const wall=scene.walls[pose.wallIndex],oldDims=itemLocalDims(item,pose),newDims=itemLocalDims(item,anchoredPose);
              if(wall){
                const along=dot({x:pose.x-wall.a.x,y:pose.y-wall.a.y},wall.dir),startGap=along-oldDims.w/2,endGap=wall.length-(along+oldDims.w/2);
                let nextAlong=along;
                if(startGap<=.16&&startGap<=endGap)nextAlong=newDims.w/2+Math.max(0,startGap);
                else if(endGap<=.16)nextAlong=wall.length-newDims.w/2-Math.max(0,endGap);
                anchoredPose.x+=wall.dir.x*(nextAlong-along);anchoredPose.y+=wall.dir.y*(nextAlong-along);
              }
            }
            const dependentIds=FURNITURE.filter(row=>(policy.dependentTypes||[]).includes(row.typeId)&&upgraded.poses?.[row.id]).map(row=>row.id);
            const basePoses={...upgraded.poses};delete basePoses[item.id];dependentIds.forEach(id=>delete basePoses[id]);
            const sized={...item,w:variant.w,d:variant.d,sizeVariants:null,shape:variant.shape||item.shape};
            const generated=rawCandidatesForFixedItem(sized,{poses:basePoses},scene).map(row=>({...row,overrideW:variant.w,overrideD:variant.d,overrideShape:variant.shape||item.shape,sizeVariant:variant.id,sizeLabel:variant.label}));
            const unique=new Map();for(const candidatePose of [anchoredPose,...generated])unique.set(poseIdentity(candidatePose),candidatePose);
            const poses=[...unique.values()].filter(candidatePose=>isLegal(item,candidatePose,{poses:basePoses},scene)).sort((a,b)=>{
              const anchorA=(a.wallIndex===pose.wallIndex?4:0)+(a.candidateRuleId===pose.candidateRuleId?2:0)-dist(a,pose)*.25;
              const anchorB=(b.wallIndex===pose.wallIndex?4:0)+(b.candidateRuleId===pose.candidateRuleId?2:0)-dist(b,pose)*.25;
              return anchorB-anchorA;
            }).slice(0,Math.max(1,Math.round(Number(policy.repairCandidateLimit)||12)));
            let best=null;
            for(const nextPose of poses){
              const nextPoses={...basePoses,[item.id]:nextPose};let dependentPass=true;
              for(const dependentId of dependentIds){
                const dependent=ITEM_BY_ID[dependentId],oldDependent=upgraded.poses[dependentId];
                const candidates=rawCandidatesForFixedItem(dependent,{poses:nextPoses},scene).filter(row=>isLegal(dependent,row,{poses:nextPoses},scene)).sort((a,b)=>candidateStaticScore(dependent,b,{poses:nextPoses},scene)-candidateStaticScore(dependent,a,{poses:nextPoses},scene)||dist(a,oldDependent)-dist(b,oldDependent));
                if(!candidates.length){dependentPass=false;break;}nextPoses[dependentId]=candidates[0];
              }
              if(!dependentPass)continue;
              const candidate={...upgraded,poses:nextPoses},evaluation=evaluateFull(candidate,scene);
              if(!evaluation.reach.hardPass||(baseline.qualityPass&&!evaluation.qualityPass)||evaluation.total+EPS<baseline.total-tradeoff)continue;
              if(!best||evaluation.total>best.evaluation.total)best={...candidate,evaluation};
            }
            if(best){upgraded=best;break;}
          }
        }
        return upgraded;
      });
    }

    function solutionPoolFromEvaluated(evaluatedAll) {
      const strict=evaluatedAll.filter(state=>state.evaluation.qualityPass);
      for (const state of strict) state.evaluation.qualityTier='strict';
      if (strict.length>=3) return strict;
      const relaxed=evaluatedAll.filter(state=>!strict.includes(state)&&
        state.evaluation.reach.hardPass&&state.evaluation.scores.circulation>=45&&state.evaluation.scores.relation>=52&&state.evaluation.scores.composition>=42&&state.evaluation.scores.storage>=30&&state.evaluation.scores.ground>=30&&state.evaluation.scores.comfort>=44&&state.evaluation.scores.preference>=35&&state.evaluation.scores.activation>=28);
      for (const state of relaxed) state.evaluation.qualityTier='hard-valid';
      const pool=[...strict,...relaxed];
      if (pool.length<3) for (const state of evaluatedAll) if (!pool.includes(state)&&state.evaluation.reach.hardPass) {
        state.evaluation.qualityTier='hard-valid';pool.push(state);
        if (pool.length>=3) break;
      }
      // 定制柜可能把墙角死区完整填实。搜索阶段允许把“硬目标均可达、且孤岛足够小”
      // 的骨架交给末轮修复；最终输出仍必须重新通过零孤岛硬门槛。
      const complements=LAYOUT_CONSTRAINTS.postLayout.wallComplements;
      if(customCabinetEnabled&&complements.enabled&&pool.length<3)for(const state of evaluatedAll){
        const reach=state.evaluation.reach;
        if(pool.includes(state)||reach.hardReachableRatio<1||reach.unreachableArea>complements.maxRecoverableIslandArea+EPS)continue;
        state.evaluation.qualityTier='post-repair-pending';pool.push(state);
        if(pool.length>=3)break;
      }
      return pool;
    }

    function searchScalar(scene,options={}) {
      const beamWidth = options.beamWidth || 120;
      const startTime = performance.now();
      const stats = { mode:'scalar', nodes:0, legal:0, pruned:0, duplicates:0, qualityRejected:0, depths:[], timeMs:0, avgUs:0 };
      let beam = [{poses:{}, partialScore:0, lastMove:null}];
      const trace = [{poses:{},partialScore:0,lastMove:null,depth:0,beamSize:1}];

      for (let depth=0; depth<FURNITURE.length; depth++) {
        const item = FURNITURE[depth];
        const nextStates = [];
        const hashes = new Map();
        for (const state of beam) {
          const candidates = generateCandidates(item,state,scene);
          if (!candidates.length) { stats.pruned++; continue; }
          for (const {pose,merit} of candidates) {
            stats.nodes++;
            const nextPoses=pose.skip?{...state.poses}:{...state.poses,[item.id]:pose};
            const next = {
              poses:nextPoses,
              partialScore:state.partialScore+merit,
              lastMove:{itemId:item.id,pose,merit,skipped:Boolean(pose.skip)}
            };
            if (depth<FURNITURE.length-1) {
              const future = FURNITURE[depth+1];
              const domain = generateCandidates(future,next,scene,22);
              if (!domain.length) { stats.pruned++; continue; }
              // 不只看“下一手有几个位置”，也看其中最好的位置质量。这样沙发会
              // 为正对电视柜预留方向，衣柜会为较高优先级的书桌保留完整墙段。
              next.partialScore += Math.min(domain.length,12)*.28+clamp(domain[0]?.merit||0,-20,120)*.10;
            }
            stats.legal++;
            const hash=stateHash(next);
            const prior=hashes.get(hash);
            if (prior && prior.partialScore>=next.partialScore) { stats.duplicates++; continue; }
            hashes.set(hash,next);
          }
        }
        nextStates.push(...hashes.values());
        nextStates.sort((a,b)=>b.partialScore-a.partialScore);
        beam=quantityDiverseSelection(nextStates,beamWidth);
        stats.depths.push({depth:depth+1,itemId:item.id,expanded:stats.nodes,beam:beam.length,pruned:stats.pruned});
        if (!beam.length) break;
        trace.push({...beam[0],depth:depth+1,beamSize:beam.length});
      }

      const evaluatedAll=beam.map(state=>({...state,evaluation:evaluateFull(state,scene)}))
        .sort((a,b)=>b.evaluation.total-a.evaluation.total);
      const strictCount=evaluatedAll.filter(state=>state.evaluation.qualityPass).length;
      stats.qualityRejected=evaluatedAll.length-strictCount;
      const bestReach=evaluatedAll.slice().sort((a,b)=>Number(b.evaluation.reach.hardPass)-Number(a.evaluation.reach.hardPass)||a.evaluation.reach.unreachableArea-b.evaluation.reach.unreachableArea||b.evaluation.reach.hardReachableRatio-a.evaluation.reach.hardReachableRatio)[0]?.evaluation.reach;
      stats.bestReach=bestReach?{hardPass:bestReach.hardPass,hardReachableRatio:bestReach.hardReachableRatio,islandArea:round(bestReach.unreachableArea,3),connectedRatio:round(bestReach.connectedRatio,3),targetStatus:{...bestReach.targetStatus}}:null;
      const selected=upgradeSelectedSizePolicies(chooseObjectiveSolutions(solutionPoolFromEvaluated(evaluatedAll)),scene);
      stats.timeMs=performance.now()-startTime;
      stats.avgUs=stats.nodes?stats.timeMs*1000/stats.nodes:0;
      return {solutions:selected,trace,stats,scene};
    }

    // Matrix frontier: every retained board expands all key poses into one flat
    // typed-array batch. A conservative bitset is the broad phase; exact geometry
    // only runs for the small subset whose occupancy words intersect.
    function createMatrixContext(scene,step=.12) {
      const cols=Math.max(1,Math.ceil(scene.width/step));
      const rows=Math.max(1,Math.ceil(scene.depth/step));
      return {scene,step,cols,rows,words:Math.ceil(cols*rows/32),profiles:new Map()};
    }

    function rasterRectMask(rects,context,padding=0) {
      const words=new Map();
      const {step,cols,rows}=context;
      for (const rect of rects) {
        const x0=clamp(Math.floor((rect.x-rect.w/2-padding)/step),0,cols-1);
        const x1=clamp(Math.floor((rect.x+rect.w/2+padding-EPS)/step),0,cols-1);
        const y0=clamp(Math.floor((rect.y-rect.d/2-padding)/step),0,rows-1);
        const y1=clamp(Math.floor((rect.y+rect.d/2+padding-EPS)/step),0,rows-1);
        for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++) {
          const cell=y*cols+x,word=cell>>>5,bit=(1<<(cell&31))>>>0;
          words.set(word,((words.get(word)||0)|bit)>>>0);
        }
      }
      const indices=new Uint32Array(words.size),masks=new Uint32Array(words.size);
      let cursor=0;
      for (const [word,mask] of words) { indices[cursor]=word;masks[cursor]=mask;cursor++; }
      return {indices,masks};
    }

    function matrixProfile(item,pose,scene,context) {
      const key=`${item.id}:${item.w}:${item.d}:${pose.overrideShape||item.shape||'box'}:${poseIdentity(pose)}`;
      const cached=context.profiles.get(key);
      if (cached) return cached;
      const rects=footprintRects(item,pose);
      const hardZones=hardFunctionalZones(item,pose);
      const inside=rects.every(rect=>rectInsidePolygon(rect,scene.polygon));
      const clearsDoor=!rects.some(rect=>overlapsDoorClearance(rect,scene,.01));
      const profile={
        rects,hardZones,staticLegal:inside&&clearsDoor&&staticFurnitureRulesPass(item,pose,scene,hardZones),
        bodyMask:rasterRectMask(rects,context,0),
        collisionMask:rasterRectMask(rects,context,.026),
        actionMask:rasterRectMask(hardZones.map(zone=>zone.rect),context,0)
      };
      context.profiles.set(key,profile);
      return profile;
    }

    function sparseMaskHits(occupancy,sparse) {
      for (let i=0;i<sparse.indices.length;i++) if ((occupancy[sparse.indices[i]]&sparse.masks[i])!==0) return true;
      return false;
    }

    function extendOccupancy(occupancy,sparse) {
      const next=occupancy.slice();
      for (let i=0;i<sparse.indices.length;i++) {
        const word=sparse.indices[i];next[word]=(next[word]|sparse.masks[i])>>>0;
      }
      return next;
    }

    function exactProfileCollision(item,pose,profile,state) {
      for (const existing of state._placed) {
        const clearance=pairCollisionClearance(item,pose,existing.item,existing.pose);
        for (const candidateRect of profile.rects) for (const otherRect of existing.rects) {
          if (rectsOverlap(candidateRect,otherRect,clearance)) return true;
        }
      }
      return false;
    }

    function exactProfileFunctionalConflict(item,pose,profile,state) {
      for (const existing of state._hardZones) {
        if (profile.rects.some(rect=>rectsOverlap(rect,existing.zone.rect,0))&&
          !ruleAllowsBody(existing.owner,item,existing.zone,pose,existing.pose)) return true;
      }
      for (const zone of profile.hardZones) for (const existing of state._placed) {
        if (existing.rects.some(rect=>rectsOverlap(rect,zone.rect,0))&&
          !ruleAllowsBody(item,existing.item,zone,existing.pose,pose)) return true;
      }
      return false;
    }

    function batchCandidateMatrix(item,beam,scene,context,limit,stats,scoreCandidates=true) {
      const poses=[];
      const parentList=[];
      for (let parent=0;parent<beam.length;parent++) {
        const seen=new Set();
        for (const pose of rawCandidatesForItem(item,beam[parent],scene)) {
          const key=poseKey(item,pose);
          if (seen.has(key)) continue;
          seen.add(key);poses.push(pose);parentList.push(parent);
        }
        if(item.optional&&!mustPlaceDependentSlot(item,beam[parent],scene)){poses.push({skip:true,relation:'optional-skip'});parentList.push(parent);}
      }
      const total=poses.length;
      const parentIndex=new Uint32Array(total);
      const legalMask=new Uint8Array(total);
      const meritVector=new Float64Array(total);
      const profiles=new Array(total);
      const grouped=Array.from({length:beam.length},()=>[]);
      const rejectCounts=Array.from({length:beam.length},()=>({static:0,collision:0,functional:0,scoreCut:0}));
      stats.batches++;
      stats.matrixCandidates+=total;
      for (let i=0;i<total;i++) {
        const parent=parentList[i];parentIndex[i]=parent;
        const state=beam[parent],pose=poses[i];
        if(pose.skip){profiles[i]={skip:true};legalMask[i]=1;grouped[parent].push(i);continue;}
        const profile=matrixProfile(item,pose,scene,context);profiles[i]=profile;
        stats.matrixCells+=profile.rects.length*state._rects.length;
        if (!profile.staticLegal) {rejectCounts[parent].static++;continue;}
        const broadHit=sparseMaskHits(state._occ,profile.collisionMask);
        if (!broadHit) stats.broadPhasePasses++;
        else {
          stats.exactChecks++;
          if (exactProfileCollision(item,pose,profile,state)) {rejectCounts[parent].collision++;continue;}
        }
        const actionBroadHit=sparseMaskHits(state._hardOcc,profile.bodyMask)||sparseMaskHits(state._occ,profile.actionMask);
        if (actionBroadHit) {
          stats.actionChecks++;
          if (exactProfileFunctionalConflict(item,pose,profile,state)) {rejectCounts[parent].functional++;continue;}
        }
        legalMask[i]=1;
        meritVector[i]=scoreCandidates?candidateStaticScore(item,pose,state,scene)+sizePolicyMerit(item,pose,scene):0;
        grouped[parent].push(i);
      }
      const records=[];
      const counts=new Uint16Array(beam.length);
      for (let parent=0;parent<grouped.length;parent++) {
        let indices=grouped[parent];
        indices=semanticSizeSelection(indices,poses,item,scene);
        const skipIndex=indices.find(index=>poses[index].skip);
        if(skipIndex>=0) {
          const placed=indices.filter(index=>!poses[index].skip);
          const top=placed.length?Math.max(...placed.map(index=>meritVector[index])):18;
          meritVector[skipIndex]=top-optionalSkipCost(item,beam[parent],scene);
        }
        if (scoreCandidates) indices.sort((a,b)=>meritVector[b]-meritVector[a]);
        const kept=indices.slice(0,limit);
        // 0–N / min–max 的跳过值必须进入全局 Beam；局部 Top-K 只裁切几何采样点。
        if(skipIndex>=0&&!kept.includes(skipIndex)){
          if(kept.length>=limit&&kept.length)kept[kept.length-1]=skipIndex;else kept.push(skipIndex);
          if(scoreCandidates)kept.sort((a,b)=>meritVector[b]-meritVector[a]);
        }
        counts[parent]=kept.length;rejectCounts[parent].scoreCut=Math.max(0,indices.length-kept.length);
        for (const index of kept) records.push({
          parentIndex:parentIndex[index],pose:poses[index],merit:meritVector[index],profile:profiles[index]
        });
      }
      return {records,counts,parentIndex,legalMask,meritVector,rejectCounts};
    }

    function selectEvaluatedSolutions(beam,stats) {
      // 最终评分必须覆盖不同实际家具数，不能只看累计局部分最高的“塞满型”状态。
      const finalists=quantityDiverseSelection(beam,Math.min(160,beam.length));
      const evaluatedAll=finalists.map(state=>({...state,evaluation:evaluateFull(state,stats.scene,FLOW_RADII.slice(0,2))}))
        .sort((a,b)=>b.evaluation.total-a.evaluation.total);
      const strictCount=evaluatedAll.filter(state=>state.evaluation.qualityPass).length;
      stats.qualityRejected=evaluatedAll.length-strictCount;
      const bestReach=evaluatedAll.slice().sort((a,b)=>Number(b.evaluation.reach.hardPass)-Number(a.evaluation.reach.hardPass)||a.evaluation.reach.unreachableArea-b.evaluation.reach.unreachableArea||b.evaluation.reach.hardReachableRatio-a.evaluation.reach.hardReachableRatio)[0]?.evaluation.reach;
      stats.bestReach=bestReach?{hardPass:bestReach.hardPass,hardReachableRatio:bestReach.hardReachableRatio,islandArea:round(bestReach.unreachableArea,3),connectedRatio:round(bestReach.connectedRatio,3),targetStatus:{...bestReach.targetStatus}}:null;
      const qualifiedPool=solutionPoolFromEvaluated(evaluatedAll);
      const outputPool=dedupeFinalLayouts(qualifiedPool,.36);
      stats.outputDuplicateRejected=qualifiedPool.length-outputPool.length;
      stats.outputRecords=outputPool.map(state=>({treeId:state._treeId,total:state.evaluation.total,qualityTier:state.evaluation.qualityTier||'strict'}));
      return upgradeSelectedSizePolicies(chooseObjectiveSolutions(outputPool),stats.scene).map(state=>{
        const qualityTier=state.evaluation.qualityTier;
        return {...state,evaluation:{...evaluateFull(state,stats.scene),qualityTier}};
      });
    }

    function searchMatrix(scene,options={}) {
      const searchRules=LAYOUT_CONSTRAINTS.search,beamWidth=options.beamWidth||searchRules.defaultBeamWidth;
      const startTime=performance.now();
      const context=createMatrixContext(scene,options.gridStep||searchRules.matrixGridStep);
      let treeSerial=0;
      const beamTree={
        root:{id:'n0',parentId:null,depth:0,itemId:null,score:0,merit:0,status:'retained',poses:{}},
        rounds:[],nodeById:new Map()
      };
      beamTree.nodeById.set(beamTree.root.id,beamTree.root);
      const stats={
        mode:'matrix',nodes:0,legal:0,pruned:0,duplicates:0,qualityRejected:0,depths:[],
        timeMs:0,avgUs:0,batches:0,matrixCandidates:0,matrixCells:0,broadPhasePasses:0,
        exactChecks:0,actionChecks:0,forwardChecked:0,flowChecks:0,flowPruned:0,scene
      };
      let beam=[{
        poses:{},partialScore:0,lastMove:null,_occ:new Uint32Array(context.words),
        _hardOcc:new Uint32Array(context.words),_rects:[],_placed:[],_hardZones:[],_hash:'',_treeId:'n0'
      }];
      const trace=[{poses:{},partialScore:0,lastMove:null,depth:0,beamSize:1}];

      for (let depth=0;depth<FURNITURE.length;depth++) {
        const item=FURNITURE[depth];
        // 每个父局面只保留少量“真正不同”的高分候选。过去固定放行 72 个，
        // 对可跳过的附属家具也做全量展开，房间放大后会产生大量无意义笛卡尔积。
        const coreType=new Set(searchRules.perParent.coreTypes).has(item.typeId);
        const wideLiving=currentProgram==='living'&&scene.area>=searchRules.perParent.largeLivingArea;
        // 大房间增加的是可摆容量，不是每个父局面的分叉预算。旧版在 >=28㎡时
        // 无差别放行 72 个候选，丰富客厅会迅速膨胀到 8 万节点以上。
        const limits=wideLiving?searchRules.perParent.largeLiving:searchRules.perParent.normal;
        const perParentLimit=coreType?limits.core:(item.optional?limits.optional:limits.required);
        const batch=batchCandidateMatrix(item,beam,scene,context,perParentLimit,stats,true);
        const rejectSummary=batch.rejectCounts.reduce((sum,row)=>{for(const key of Object.keys(sum))sum[key]+=row[key]||0;return sum;},{static:0,collision:0,functional:0,scoreCut:0,flow:0,island:0});
        const treeRound={depth:depth+1,itemId:item.id,parentIds:beam.map(state=>state._treeId),nodes:[],rawCandidates:batch.parentIndex.length,legalCandidates:batch.records.length,rejectSummary,beamWidth};
        beamTree.rounds.push(treeRound);
        // 上一轮节点虽曾进入 Beam，但可能在本轮一个合法候选都生成不出来。
        // 必须回写父节点状态，否则树上会出现“进入下一回合”却没有任何子连线的假象。
        for(let parentIndex=0;parentIndex<beam.length;parentIndex++)if(batch.counts[parentIndex]===0){
          const parentNode=beamTree.nodeById.get(beam[parentIndex]._treeId);if(!parentNode)continue;
          const rejected=batch.rejectCounts[parentIndex]||{},parts=[];
          if(rejected.static)parts.push(`越界/门窗/静态禁区 ${rejected.static}`);
          if(rejected.collision)parts.push(`家具碰撞 ${rejected.collision}`);
          if(rejected.functional)parts.push(`功能区冲突 ${rejected.functional}`);
          if(rejected.scoreCut)parts.push(`局部分截断 ${rejected.scoreCut}`);
          parentNode.status='no-next';parentNode.reason=`下一手 ${itemStepLabel(item)||item.id} 没有合法候选：${parts.length?parts.join('、'):'候选生成器未返回采样点'}`;
        }
        if(depth>0){const previousRound=beamTree.rounds[depth-1];previousRound.retained=previousRound.nodes.filter(node=>node.status==='retained'||node.status==='finalist').length;previousRound.statusCounts=previousRound.nodes.reduce((counts,node)=>{counts[node.status]=(counts[node.status]||0)+1;return counts;},{});}
        const hashes=new Map();
        for (const record of batch.records) {
          const parent=beam[record.parentIndex];stats.nodes++;
          const skipped=Boolean(record.pose.skip);
          const nextPoses=skipped?{...parent.poses}:{...parent.poses,[item.id]:record.pose};
          const treeNode={
            id:`n${++treeSerial}`,parentId:parent._treeId,depth:depth+1,itemId:item.id,
            score:parent.partialScore+record.merit,merit:record.merit,status:'pending',reason:skipped?'数量上限分支：本槽位主动跳过':'等待本轮筛选',
            pose:record.pose,poses:nextPoses,parentRank:record.parentIndex+1,rank:0,skipped
          };
          const hash=stateHash({poses:treeNode.poses});
          treeRound.nodes.push(treeNode);beamTree.nodeById.set(treeNode.id,treeNode);
          const next={
            poses:treeNode.poses,
            partialScore:treeNode.score,
            lastMove:{itemId:item.id,pose:record.pose,merit:record.merit,skipped},
            _parent:parent,_profile:record.profile,_flowPenalty:parent._flowPenalty||0,_hash:hash,_treeId:treeNode.id,_treeNode:treeNode
          };
          const prior=hashes.get(hash);
          if (prior&&prior.partialScore>=next.partialScore) {treeNode.status='duplicate';treeNode.reason='状态哈希重复，保留同构局面中的高分项';stats.duplicates++;continue;}
          if (prior?._treeNode) {prior._treeNode.status='duplicate';prior._treeNode.reason='状态哈希重复，被同构高分项替换';}
          hashes.set(hash,next);stats.legal++;
        }
        let nextStates=[...hashes.values()].sort((a,b)=>b.partialScore-a.partialScore);
        nextStates.forEach((state,index)=>state._treeNode.rank=index+1);
        // 必放槽位无解时不能拿“上一回合的半盘棋”冒充完整方案。
        if (!nextStates.length) {stats.pruned++;beam=[];break;}

        // Forward checking is itself one matrix batch. Only the strongest 2× beam
        // reaches it; weak branches are cut before allocating occupancy arrays.
        const preLimit=depth<FURNITURE.length-1?Math.max(beamWidth+12,Math.ceil(beamWidth*1.28)):beamWidth;
        const rankedPrecut=nextStates.slice(0,preLimit),skipReserve=Math.max(1,Math.round(preLimit*searchRules.skipBranchReserveRatio));
        for(const state of nextStates)if(state.lastMove?.skipped&&!rankedPrecut.includes(state)){
          const replacement=rankedPrecut.findLastIndex(row=>!row.lastMove?.skipped);
          if(replacement<0||rankedPrecut.filter(row=>row.lastMove?.skipped).length>=skipReserve)break;
          rankedPrecut[replacement]=state;
        }
        // “已落地件数”代表不同密度的棋局。若预截断只按局部分，核心安全骨架会在
        // 连续可选家具回合中被高件数支路全部挤掉，后面即使有空墙也无法继续尝试。
        if(searchRules.preserveQuantityCounts){
          const representatives=new Map();
          for(const state of nextStates){const count=Object.keys(state.poses).length;if(!representatives.has(count))representatives.set(count,state);}
          const protectedStates=new Set([...representatives.values()]),typeSignatures=new Set();
          if(searchRules.preserveEachFurnitureType){
            const typeRepresentatives=new Map(),perType=searchRules.representativesPerFurnitureType;
            for(const state of nextStates){const count=Object.keys(state.poses||{}).length;for(const id of Object.keys(state.poses||{})){
              const typeId=ITEM_BY_ID[id]?.typeId||id,prior=typeRepresentatives.get(typeId);
              const poseSignature=placedTypePoseSignature(state,typeId);
              if(!prior||count<prior.count)typeRepresentatives.set(typeId,{count,states:[state],signatures:new Set([poseSignature])});
              else if(count===prior.count&&prior.states.length<perType&&!prior.signatures.has(poseSignature)){prior.states.push(state);prior.signatures.add(poseSignature);}
            }}
            for(const entry of typeRepresentatives.values())for(const state of entry.states)protectedStates.add(state);
          }
          for(const state of nextStates){
            if(typeSignatures.size>=searchRules.typeSignatureReserve)break;
            const signature=placedTypeSignature(state);if(typeSignatures.has(signature))continue;
            typeSignatures.add(signature);protectedStates.add(state);
          }
          for(const state of protectedStates)if(!rankedPrecut.includes(state)){
            const replacement=rankedPrecut.findLastIndex(row=>!protectedStates.has(row));
            if(replacement>=0)rankedPrecut[replacement]=state;
          }
        }
        const preselected=new Set(rankedPrecut);
        for (const state of nextStates)if(!preselected.has(state)){state._treeNode.status='precut';state._treeNode.reason=`预截断：只让累计分前 ${preLimit} 名及保留的跳过分支进入昂贵检查`;}
        nextStates=rankedPrecut.sort((a,b)=>b.partialScore-a.partialScore);
        for (const next of nextStates) {
          if(next._profile.skip) {
            next._occ=next._parent._occ;next._hardOcc=next._parent._hardOcc;next._rects=next._parent._rects;
            next._placed=next._parent._placed;next._hardZones=next._parent._hardZones;
          } else {
            next._occ=extendOccupancy(next._parent._occ,next._profile.bodyMask);
            next._hardOcc=extendOccupancy(next._parent._hardOcc,next._profile.actionMask);
            next._rects=next._parent._rects.concat(next._profile.rects);
            next._placed=next._parent._placed.concat({item,pose:next.lastMove.pose,rects:next._profile.rects});
            next._hardZones=next._parent._hardZones.concat(next._profile.hardZones.map(zone=>({owner:item,pose:next.lastMove.pose,zone})));
          }
          delete next._parent;delete next._profile;
        }
        // 半盘棋不直接判死：后续贴墙柜可能覆盖小死角，桌椅成组也会改变服务入口。
        // 在会改变空间拓扑的关键落子后只更新“可撤销引导分”；后续家具若覆盖死角，
        // 旧扣分会自动退回。完整局面再由 0.50m + 零孤岛硬门槛统一剪枝。
        // 卧室的后置沙发/床尾凳同样可能封死先落下的衣柜柜门区；客厅家具更多，
        // 仍只在会改变拓扑的关键类型上复核，避免每个小件都触发水漫。
        const needsFlowGuide=shouldGuideFlow(item);
        if(needsFlowGuide)for(const next of nextStates){
          stats.flowChecks++;
          const flow=computeReachability(next,scene,[FLOW_RADII[0]]);
          // 核心家具“摆得下但用不了”不是小扣分。尤其衣柜柜门区不可达时，
          // 必须让可达候选压过单纯更贴墙的候选；孤岛项仍保持可撤销。
          const penalty=Math.min(90,flow.unreachableArea*20+(1-flow.hardReachableRatio)*90);
          next.partialScore+=(next._flowPenalty||0)-penalty;next._flowPenalty=penalty;
        }
        // 真实户型在中途就硬剪；标准几何保留可撤销引导，因为后续定制柜可能
        // 恰好填平一个小夹缝。所有场景在完整局面仍统一执行零孤岛硬门槛。
        if(LAYOUT_CONSTRAINTS.circulation.pruneDuringSearch&&shouldHardPruneFlow(item)){
          nextStates=nextStates.filter(next=>{
            stats.flowChecks++;
            const flow=computeReachability(next,scene,[FLOW_RADII[0]]);
            if(flow.hardPass)return true;
            if(flow.islandPass)treeRound.rejectSummary.flow++;else treeRound.rejectSummary.island++;
            next._treeNode.status='flow-pruned';next._treeNode.reason=flow.islandPass?`关键家具不可达，${FLOW_RADII[0].radius*2}m 水漫失败`:`形成 ${flow.unreachableArea.toFixed(2)}㎡ 孤岛，或通行缝小于 ${FLOW_RADII[0].radius*2}m`;
            stats.flowPruned++;stats.pruned++;return false;
          });
          if(!nextStates.length){beam=[];break;}
        }
        if (depth<FURNITURE.length-1) {
          const future=FURNITURE[depth+1];
          // 可选家具天然拥有“跳过”分支，不可能造成下一手无解；对它做前向矩阵
          // 只会重复一次碰撞检测。只为必放家具执行前向检查。
          const futureDefault=CONFIGS[currentProgram].counts[future.typeId]||0;
          const protectOptional=future.optional&&futureDefault>0&&['desk','coffee','arm','lounge','bedroomLoveseat'].includes(future.typeId);
          if(future.optional&&!protectOptional){
            for(const state of nextStates){state._treeNode.forwardDomain=1;}
          }else{
          const forward=batchCandidateMatrix(future,nextStates,scene,context,protectOptional?8:10,stats,true);
          stats.forwardChecked+=nextStates.length;
          const bestMerit=new Float64Array(nextStates.length);bestMerit.fill(-Infinity);
          for(const record of forward.records)if(record.merit>bestMerit[record.parentIndex])bestMerit[record.parentIndex]=record.merit;
          nextStates=nextStates.filter((state,index)=>{
            const domain=forward.counts[index];
            state._treeNode.forwardDomain=domain;
            const futureRequired=!future.optional||mustPlaceDependentSlot(future,state,scene);
            if (!domain&&futureRequired) {state._treeNode.status='forward-pruned';state._treeNode.reason=`下一件 ${future.label} 已无合法位置`;stats.pruned++;return false;}
            if(!domain&&future.optional){state.partialScore-=18;return true;}
            state.partialScore+=Math.min(domain,12)*.28+clamp(bestMerit[index],-20,120)*.10;return true;
          });
          }
          nextStates.sort((a,b)=>b.partialScore-a.partialScore);
        }
        // 在会客核心、围合座位、餐组和连续柜完成的关键回合，给排名靠前的局面
        // 做一次低分辨率全地面复核。这样长家具链切断空间会在 Beam 内被淘汰，
        // 不再到最终评分时才判死刑。
        const fieldMilestone=item.typeId==='coffee'||(item.typeId==='arm'&&item.slotIndex===0)||
          (item.typeId==='diningChair'&&item.slotIndex===1);
        if(fieldMilestone){
          // 只复核排名最靠前的一小批。沿墙柜的连续性已有局部评分负责，不再每落
          // 一件柜体就给整个 Beam 重算全地面。
          const fieldReviewLimit=Math.min(nextStates.length,Math.max(32,Math.min(56,Math.ceil(beamWidth*.34))));
          for(const state of nextStates.slice(0,fieldReviewLimit)){
            state.partialScore+=partialFieldMerit(state,scene);state._treeNode.score=state.partialScore;
          }
          nextStates.sort((a,b)=>b.partialScore-a.partialScore);
        }
        nextStates.forEach((state,index)=>{state._treeNode.rank=index+1;state._treeNode.score=state.partialScore;});
        const selectedBeam=quantityDiverseSelection(nextStates,beamWidth),selectedBeamSet=new Set(selectedBeam);
        for (const state of nextStates) if(!selectedBeamSet.has(state)) {state._treeNode.status='beam-cut';state._treeNode.reason=`本轮排名 ${state._treeNode.rank}，超出 Beam-${beamWidth}，且同件数已有更优代表`;}
        beam=selectedBeam;
        for (const state of beam) {state._treeNode.status='retained';state._treeNode.reason=state.lastMove?.skipped?`数量为上限：本槽位选择 0 件并进入下一回合`:`本轮排名 ${state._treeNode.rank}，进入下一回合`;}
        treeRound.retained=beam.length;
        treeRound.statusCounts=treeRound.nodes.reduce((counts,node)=>{counts[node.status]=(counts[node.status]||0)+1;return counts;},{});
        stats.depths.push({
          depth:depth+1,itemId:item.id,expanded:stats.nodes,beam:beam.length,
          pruned:stats.pruned,batchCandidates:batch.records.length
        });
        if (!beam.length) break;
        trace.push({...beam[0],depth:depth+1,beamSize:beam.length});
      }

      const selected=selectEvaluatedSolutions(beam,stats);
      const selectedByTreeId=new Map(selected.map((state,index)=>[state._treeId,index]));
      beamTree.outputs=(stats.outputRecords||[]).map((record,index)=>{
        const parent=beamTree.nodeById.get(record.treeId),solutionIndex=selectedByTreeId.get(record.treeId),topRank=index<3?index+1:null;
        const node={id:`out-${index+1}`,parentId:record.treeId,depth:FURNITURE.length+1,itemId:null,score:record.total,merit:0,status:'output',reason:topRank?`全局总分 TOP ${topRank} · 对应空间方案 ${String.fromCharCode(65+topRank-1)}`:`通过最终通行与质量验证 · 总分 ${record.total.toFixed(1)}`,poses:parent?.poses||{},outputIndex:index+1,qualityTier:record.qualityTier,topRank,solutionIndex:Number.isInteger(solutionIndex)?solutionIndex:null};
        beamTree.nodeById.set(node.id,node);return node;
      });
      beamTree.outputCount=beamTree.outputs.length;beamTree.outputDuplicateRejected=stats.outputDuplicateRejected||0;delete stats.outputRecords;
      selected.forEach((state,index)=>{if(state._treeNode){state._treeNode.solutionIndex=index;state._treeNode.status='finalist';state._treeNode.reason=`最终完整评分入选方案 ${String.fromCharCode(65+index)}`;}});
      // 搜索结束后再做一次结构校验：任何仍标为 retained 却没有真实子节点的状态，
      // 都必须明确标成终止，而不能继续显示绿色“进入下一回合”。
      const actualParentIds=new Set();
      for(const round of beamTree.rounds)for(const node of round.nodes)actualParentIds.add(node.parentId);
      for(const node of beamTree.outputs||[])actualParentIds.add(node.parentId);
      for(const round of beamTree.rounds)for(const node of round.nodes)if(node.status==='retained'&&!actualParentIds.has(node.id)){
        if(node.depth>=FURNITURE.length){node.status='final-pruned';node.reason='未进入最终输出：最终通行、质量评分或最终方案去重未通过';}
        else{node.status='no-next';node.reason=`下一回合未产生实际子状态（下一手：${itemStepLabel(FURNITURE[node.depth])||FURNITURE[node.depth]?.id||'未知家具'}）`;}
      }
      for(const round of beamTree.rounds){round.retained=round.nodes.filter(node=>node.status==='retained'||node.status==='finalist').length;round.statusCounts=round.nodes.reduce((counts,node)=>{counts[node.status]=(counts[node.status]||0)+1;return counts;},{});}
      stats.timeMs=performance.now()-startTime;
      // “一次试摆”应包含合法和被快速淘汰的候选。只除以最终生成节点数会在
      // 剪枝增强后反而显示更慢，不能代表 Bitset/矩阵前筛的真实成本。
      stats.avgUs=stats.matrixCandidates?stats.timeMs*1000/stats.matrixCandidates:0;
      delete stats.scene;
      return {solutions:selected,trace,stats,scene,beamTree};
    }

    function sortFurnitureForScene(scene){
      const shapeTypes=LAYOUT_CONSTRAINTS.search.orderByShape?.[scene.shape]?.[currentProgram],rows=LAYOUT_CONSTRAINTS.search.orderByArea?.[currentProgram]||[],configured=[...rows].sort((a,b)=>Number(b.minArea)-Number(a.minArea)).find(row=>scene.area+EPS>=Number(row.minArea)),types=shapeTypes||configured?.types;
      if(!types?.length)return;
      const rank=new Map(types.map((typeId,index)=>[typeId,index])),stable=new Map(FURNITURE.map((item,index)=>[item.id,index]));
      FURNITURE.sort((a,b)=>(rank.get(a.typeId)??999)-(rank.get(b.typeId)??999)||(stable.get(a.id)??0)-(stable.get(b.id)??0));
    }

    function search(scene,options={}) {
      sortFurnitureForScene(scene);
      return options.mode==='scalar'?searchScalar(scene,options):searchMatrix(scene,options);
    }

    const INVENTORY_VALUES={
      bedroom:{
        bed:{value:18,category:'core'},wardrobe:{value:16,category:'storage'},desk:{value:11,category:'work'},
        vanity:{value:9,category:'work'},chest:{value:7,category:'storage'},shelf:{value:6,category:'storage'},
        tvbench:{value:5,category:'leisure'},bench:{value:5,category:'comfort'},night:{value:7,category:'comfort'},
        chair:{value:4,category:'work'},vanityStool:{value:3,category:'work'},lounge:{value:6,category:'comfort'},
        bedroomLoveseat:{value:14,category:'comfort'},bedroomTeaTable:{value:8,category:'comfort'},bedroomDisplay:{value:9,category:'storage'},
        bedroomInfillCabinet:{value:14,category:'storage'}
      },
      living:{
        sofa:{value:18,category:'core'},tv:{value:14,category:'core'},coffee:{value:10,category:'core'},
        diningTable:{value:11,category:'dining'},diningChair:{value:4,category:'dining'},sideboard:{value:12,category:'storage'},
        bookcase:{value:8,category:'storage'},display:{value:7,category:'storage'},console:{value:7,category:'storage'},
        arm:{value:9,category:'comfort'},ottoman:{value:5,category:'comfort'},side:{value:5,category:'comfort'},
        floorLamp:{value:3,category:'decor'},plant:{value:2.5,category:'decor'},infillCabinet:{value:17,category:'storage'}
      }
    };

    const INVENTORY_OBJECTIVES={
      balanced:{label:'综合最优',density:{bedroom:.42,living:.38},multipliers:{core:1.15,storage:1.08,work:1.04,dining:1.04,comfort:1.08,leisure:.95,decor:.72}},
      circulation:{label:'通行优先',density:{bedroom:.32,living:.25},multipliers:{core:1.2,storage:.68,work:.85,dining:.72,comfort:.82,leisure:.7,decor:.35}},
      function:{label:'功能丰富',density:{bedroom:.49,living:.43},multipliers:{core:1.08,storage:1.35,work:1.28,dining:1.35,comfort:1.12,leisure:1.1,decor:.82}}
    };

    // 面积模数只决定“启用哪些完整功能模块”，具体档位来自全局配置。
    function roomAreaTier(programId,area){
      return [...ROOM_AREA_MODULES[programId]].reverse().find(tier=>area+EPS>=tier.minArea)||ROOM_AREA_MODULES[programId][0];
    }
    function configuredAreaValue(rows,area,field='value'){
      const row=[...(rows||[])].sort((a,b)=>Number(b.minArea)-Number(a.minArea)).find(item=>area+EPS>=Number(item.minArea));
      return Number(row?.[field]??row?.value??0);
    }
    function configuredAreaTarget(rows,area){
      const row=[...(rows||[])].sort((a,b)=>Number(b.minArea)-Number(a.minArea)).find(item=>area+EPS>=Number(item.minArea));
      return row?.target||{};
    }

    // 外层不再把家具视作彼此无关的商品，而是以设计师常用的“功能组合包”扩充。
    // target 表示组合完成时的最低总数量；同一组合只补缺，不会重复无限加入。
    const FUNCTION_BUNDLES={
      bedroom:[
        {id:'wall-infill-finish',minArea:11,target:{bedroomInfillCabinet:1}},
        {id:'bedside-pair',minArea:9,target:{night:2}},
        {id:'hotel-twin',minArea:24,target:{bed:2,night:1}},
        {id:'work-bay',minArea:12,target:{desk:1,chair:1}},
        {id:'vanity-bay',minArea:16,target:{vanity:1,vanityStool:1}},
        {id:'storage-wall',minArea:16,target:{chest:1,bedroomDisplay:1}},
        {id:'bed-foot',minArea:18,target:{bench:1}},
        {id:'reading-corner',minArea:14,target:{lounge:1}},
        {id:'bedroom-lounge',minArea:20,target:{bedroomLoveseat:1,bedroomTeaTable:1,tvbench:1}}
      ],
      living:[
        {id:'wall-infill-finish',minArea:15,target:{infillCabinet:1}},
        {id:'conversation-ring',minArea:14,target:{arm:2,side:1,floorLamp:1}},
        {id:'compact-dining',minArea:19,target:{diningTable:1,diningChair:2}},
        {id:'dining-storage',minArea:23,target:{diningTable:1,diningChair:4,sideboard:1}},
        {id:'storage-wall',minArea:16,target:{bookcase:1,display:1}},
        {id:'reading-corner',minArea:25,target:{arm:3,side:2,floorLamp:2}},
        {id:'entry-bay',minArea:30,target:{console:1,plant:1}},
        {id:'soft-finish',minArea:20,target:{plant:2,floorLamp:1}},
        {id:'large-room-fill',minArea:42,target:{sideboard:2,bookcase:2,display:1,arm:3,ottoman:1,side:2,plant:2}}
      ]
    };

    function objectiveDensity(objective,programId) {
      return typeof objective.density==='number'?objective.density:objective.density[programId];
    }

    function inventoryPieceCount(counts) {
      return Object.values(counts).reduce((sum,value)=>sum+(Number(value)||0),0);
    }

    function inventoryCountsSignature(programId,counts) {
      return PROGRAMS[programId].types.map(type=>`${type.id}:${counts[type.id]||0}`).join('|');
    }

    function baseInventoryCounts(programId) {
      return Object.fromEntries(PROGRAMS[programId].types.map(type=>[type.id,type.minCount||0]));
    }

    function configuredGeometryPresets(programId,typeId){
      const type=PROGRAMS[programId].types.find(row=>row.id===typeId),base=CONFIGS[programId].dimensions[typeId];
      const sameShape=(type?.geometryVariants||[]).filter(row=>(row.shape||type.shape)===(type.shape||'box'));
      const variants=sameShape.map(row=>({w:row.w,d:row.d}));
      return variants.length?variants:(base?[base]:[]);
    }
    function estimateDimensions(programId,typeId) {
      const presets=configuredGeometryPresets(programId,typeId);
      return presets[Math.floor((presets.length-1)/2)]||CONFIGS[programId].dimensions[typeId];
    }

    function inventoryRoomFeatures(scene) {
      const wallPerimeter=scene.walls.filter(wall=>Math.abs(wall.dx)<EPS||Math.abs(wall.dy)<EPS).reduce((sum,wall)=>sum+wall.length,0);
      const windowWidth=Math.max(0,scene.window.x1-scene.window.x0);
      const doorWidth=sceneDoors(scene).reduce((sum,door)=>sum+(Number(door.width)||0),0);
      const availableWall=Math.max(1,wallPerimeter-doorWidth-windowWidth*.72);
      return {availableWall,compactness:clamp(scene.area/(scene.width*scene.depth),.45,1)};
    }

    function infillWallBudget(programId,scene) {
      if(!customCabinetEnabled||layoutDensityMode!=='rich')return 0;
      const typeId=programId==='living'?'infillCabinet':'bedroomInfillCabinet',type=PROGRAMS[programId].types.find(row=>row.id===typeId);
      if(!type)return 0;
      const run=FURNITURE_RULES[typeId]?.run||{},minimum=Math.max(.4,Number(run.min)||.6);
      const eligibleWalls=scene.walls.filter(wall=>(Math.abs(wall.dx)<EPS||Math.abs(wall.dy)<EPS)&&wall.length>=minimum+.15).length;
      const threshold=programId==='living'?15:11;if(scene.area<threshold||!eligibleWalls)return 0;
      const areaStep=Math.max(4,Number(run.areaPerCabinet)||(programId==='living'?12:8));
      const areaBudget=1+Math.floor((scene.area-threshold)/areaStep);
      // 异形/长条房间的可用墙段远多于普通矩形，只按面积会把 17~18㎡ 的房间
      // 永久限制为 1 段柜。墙段预算增长得很慢，既允许第二面墙收口，也不会
      // 因为轮廓被切成很多小段而让候选量爆炸。
      const wallBudget=1+Math.floor(Math.max(0,eligibleWalls-4)/3);
      const configuredCap=Math.max(1,Math.round(Number(run.wallCountCap)||type.maxCount));
      return Math.min(type.maxCount,configuredCap,eligibleWalls,Math.max(areaBudget,wallBudget));
    }

    function inventoryCoverage(programId,counts,scene) {
      // 面积倍率用于放大几何，不应无限线性增加家具品类目标。超过约 44㎡后，
      // 剩余空间交给最终活动区与墙面收口解释，避免 2.5×/3× 客厅追逐 25–30 件库存。
      const area=programId==='living'?Math.min(scene.area,44):Math.min(scene.area,36),parts=[];
      const ratio=(value,target)=>target<=0?1:clamp((value||0)/target,0,1);
      if(programId==='living') {
        const core=((counts.sofa||0)>0&&(counts.tv||0)>0&&(counts.coffee||0)>0)?1:0;
        const armTarget=area<14?0:area<27?2:area<45?3:4;
        const sideTarget=area<14?0:area<34?1:2;
        const diningWanted=area>=19;
        const dining=diningWanted?Math.min(ratio(counts.diningTable,1),ratio(counts.diningChair,area>=32?4:2)):1;
        const storageTarget=area<14?0:area<32?1:area<48?3:5;
        const storage=(counts.sideboard||0)+(counts.bookcase||0)+(counts.display||0)+(counts.console||0);
        const lightTarget=area<14?0:area<34?1:2;
        const finishTarget=area<20?0:area<42?1:2;
        parts.push([core,3.2],[ratio(counts.arm,armTarget),1.4],[ratio(counts.side,sideTarget),.65],[dining,area>=19?1.5:0],
          [ratio(storage,storageTarget),1.35],[ratio(counts.floorLamp,lightTarget),.55],[ratio(counts.plant,finishTarget),.35]);
      } else {
        const core=((counts.bed||0)>0&&(counts.wardrobe||0)>0)?1:0;
        const bedsideTarget=area<9?0:2;
        const bedsideCount=counts.night||0;
        // 一只床头柜已经构成完整的单侧床头组；第二只主要增加对称性和便利性。
        const bedside=bedsideTarget===0?1:bedsideCount<=0?0:bedsideCount===1?.88:1;
        const activityWanted=area>=12;
        const activity=activityWanted?Math.max(Math.min(ratio(counts.desk,1),ratio(counts.chair,1)),Math.min(ratio(counts.vanity,1),ratio(counts.vanityStool,1))):1;
        const extraStorageTarget=area<16?0:area<30?1:3;
        const extraStorage=(counts.chest||0)+(counts.shelf||0)+(counts.tvbench||0)+(counts.bedroomDisplay||0);
        const comfortTarget=area<18?0:area<28?1:2;
        const comfort=(counts.bench||0)+(counts.lounge||0)+(counts.bedroomLoveseat||0);
        const bedroomAspect=Math.max(scene.width/Math.max(scene.depth,EPS),scene.depth/Math.max(scene.width,EPS));
        const recognizedHotelMedia=scene.shape==='recognized'&&area>=15&&bedroomAspect>=1.65;
        const loungeSet=recognizedHotelMedia?1:area>=17?Math.min(ratio(counts.bedroomLoveseat,1),ratio(counts.bedroomTeaTable,1)):1;
        parts.push([core,3.2],[bedside,1.25],[activity,1.5],[ratio(extraStorage,extraStorageTarget),1.1],
          [ratio(comfort,comfortTarget),.65],[loungeSet,area>=17?.55:0]);
      }
      const weight=parts.reduce((sum,row)=>sum+row[1],0)||1;
      return {score:parts.reduce((sum,row)=>sum+row[0]*row[1],0)/weight,parts};
    }

    function completionTargets(programId,scene) {
      if(programId==='living')return {
        side:layoutDensityMode==='rich'?1:0,arm:layoutDensityMode==='rich'?(roomAreaTier('living',scene.area).modules.includes('dining')?1:scene.area>=14?2:1):0,
        floorLamp:layoutDensityMode==='rich'?1:0,plant:0,
        infillCabinet:0,
        // 大客厅不能只靠一组沙发和定制柜撑满；34㎡以上先锁定两种常规沿墙家具，
        // 其余连续空墙交给最终定制柜补全，避免第三种成品柜制造新的墙缝。
        sideboard:scene.area>=34&&layoutDensityMode==='rich'?1:0,
        bookcase:scene.area>=34&&layoutDensityMode==='rich'?1:0,
        display:0
      };
      // 常规卧室也不能只剩“床 + 衣柜”。是否完成工作/会客组由配置的面积模块决定；
      // 丰富模式只增加末轮浅柜，不再把展示柜、休闲椅同时设为硬目标而挤掉核心家具。
      const bedroomAspect=Math.max(scene.width/Math.max(scene.depth,EPS),scene.depth/Math.max(scene.width,EPS)),modules=new Set(roomAreaTier('bedroom',scene.area).modules||[]);
      const recognizedHotelMedia=scene.shape==='recognized'&&scene.area>=15&&bedroomAspect>=1.65;
      return {
        night:scene.area>=9?2:scene.area>=6.2?1:0,
        desk:modules.has('work')||(scene.area>=6.2&&scene.area<9)?1:0,
        chair:modules.has('work')||(scene.area>=6.2&&scene.area<9)?1:0,
        // 床尾凳、休闲椅、小沙发和展示柜是“可选构图”，不能同时作为硬完成目标。
        // 否则 18㎡ 左右的卧室会在过满候选与只剩核心家具之间跳跃。
        chest:0,bench:0,bedroomDisplay:0,lounge:0,
        bedroomLoveseat:layoutDensityMode==='rich'&&modules.has('lounge')&&!recognizedHotelMedia?1:0,
        bedroomTeaTable:layoutDensityMode==='rich'&&modules.has('lounge')&&!recognizedHotelMedia?1:0,
        tvbench:layoutDensityMode==='rich'&&(modules.has('lounge')||recognizedHotelMedia)?1:0,
        bedroomInfillCabinet:0
      };
    }

    function inventoryEstimate(programId,counts,scene,objectiveId) {
      const objective=INVENTORY_OBJECTIVES[objectiveId],features=inventoryRoomFeatures(scene);
      let utility=0,effectiveArea=0,wallDemand=0,missingPreferencePenalty=0,missingCompletionPenalty=0;
      const densityModel=DENSITY_MODES[layoutDensityMode]||DENSITY_MODES.standard,targets=completionTargets(programId,scene);
      for (const type of PROGRAMS[programId].types) {
        const value=INVENTORY_VALUES[programId][type.id]||{value:4,category:'comfort'};
        const preference=clamp(type.preferenceWeight??FURNITURE_RULES[type.id]?.preferenceWeight??1,0,3),preferredCount=DEFAULT_CONFIGS[programId].counts[type.id]??type.minCount??0,count=counts[type.id]||0;
        if(count<preferredCount)missingPreferencePenalty+=(preferredCount-count)*value.value*(.65+preference*.55);
        if(!count)continue;
        const multiplier=(objective.multipliers[value.category]??1)*(densityModel.categoryBoost[value.category]??1);
        const preferenceMultiplier=.25+preference*.75;
        const dims=estimateDimensions(programId,type.id),rule=FURNITURE_RULES[type.id]||FURNITURE_RULES.default;
        const zone=rule.service||FURNITURE_RULES.default.service;
        const zoneArea=(dims.w+(zone.spanExtra||0)*2)*(zone.depth||.42);
        const pieceArea=dims.w*dims.d+zoneArea*(zone.hard?.62:.18);
        const repeatDecay=value.category==='comfort'||value.category==='decor'?.68:value.category==='storage'?.74:.84;
        for (let index=0;index<count;index++) utility+=value.value*multiplier*preferenceMultiplier*Math.pow(repeatDecay,index);
        effectiveArea+=pieceArea*count;
        if (rule.requiredAnchor==='wall') wallDemand+=dims.w*count;
      }
      for(const [typeId,target] of Object.entries(targets)){
        const type=PROGRAMS[programId].types.find(row=>row.id===typeId);if(!type||!target)continue;
        const missing=Math.max(0,Math.min(type.maxCount,target)-(counts[typeId]||0)),value=INVENTORY_VALUES[programId][typeId]?.value||5;
        missingCompletionPenalty+=missing*value*3.8;
      }
      const referenceArea=programId==='living'?20:14;
      // 大房间的家具密度只轻微下降；先前的 sqrt(reference/area) 会让面积越大越空。
      const areaFactor=clamp(1-Math.log2(Math.max(scene.area,EPS)/referenceArea)*.055,.86,1.08);
      const targetDensity=objectiveDensity(objective,programId)*areaFactor*(.90+features.compactness*.10)*densityModel.density;
      const density=effectiveArea/Math.max(scene.area,EPS),wallRatio=wallDemand/features.availableWall;
      const underDensity=Math.max(0,targetDensity-density),overDensity=Math.max(0,density-targetDensity-.045);
      const densityPenalty=underDensity*235+overDensity*360+overDensity*overDensity*720;
      const wallPenalty=Math.max(0,wallRatio-.78)*110;
      const pieces=inventoryPieceCount(counts),basePieces=inventoryPieceCount(baseInventoryCounts(programId));
      const areaRate=programId==='living'?.26:.23,wallRate=programId==='living'?.15:.11;
      const objectiveOffset=objectiveId==='function'?3:objectiveId==='circulation'?-(2+scene.area*.05):0;
      const softPieceCapacity=(basePieces+scene.area*areaRate+features.availableWall*wallRate+objectiveOffset)*densityModel.capacity;
      const excessPieces=Math.max(0,pieces-softPieceCapacity);
      const complexityPenalty=layoutDensityMode==='rich'?excessPieces*2.4+excessPieces*excessPieces*3.2:excessPieces*5+excessPieces*excessPieces*6;
      const coverage=inventoryCoverage(programId,counts,scene);
      const coverageWeight=objectiveId==='function'?165:objectiveId==='circulation'?58:110;
      const missingFunctionPenalty=(1-coverage.score)*coverageWeight;
      const score=utility*1.65-densityPenalty-wallPenalty-complexityPenalty-missingFunctionPenalty-missingPreferencePenalty-missingCompletionPenalty;
      return {score,utility,effectiveArea,density,targetDensity,wallDemand,wallRatio,pieces,softPieceCapacity,coverage:coverage.score,missingFunctionPenalty,missingPreferencePenalty,missingCompletionPenalty};
    }

    function bundleTargetCounts(programId,counts,bundle) {
      const next={...counts};let changed=false;
      for(const [typeId,target] of Object.entries(bundle.target)) {
        const type=PROGRAMS[programId].types.find(row=>row.id===typeId);if(!type)continue;
        if(FURNITURE_RULES[typeId]?.infill)continue;
        const value=Math.min(type.maxCount,Math.max(type.minCount||0,target));
        if((next[typeId]||0)<value){next[typeId]=value;changed=true;}
      }
      return changed?next:null;
    }

    function inventoryAddActions(programId,counts,scene,objectiveId) {
      const program=PROGRAMS[programId],actions=[];
      for(const bundle of FUNCTION_BUNDLES[programId]) {
        if(scene.area+EPS<bundle.minArea)continue;
        const next=bundleTargetCounts(programId,counts,bundle);if(next)actions.push(next);
      }
      for (const type of program.types) {
        const current=counts[type.id]||0;if(current>=type.maxCount)continue;
        if(FURNITURE_RULES[type.id]?.infill)continue;
        if (type.id==='chair'||type.id==='vanityStool') continue;
        if (type.id==='bedroomTeaTable'&&!(counts.bedroomLoveseat>0||counts.lounge>0)) continue;
        if (type.id==='bed'&&current>=1&&scene.area<20) continue;
        const next={...counts};
        if (type.id==='desk'&&current===0) {next.desk=1;next.chair=1;}
        else if (type.id==='vanity'&&current===0) {next.vanity=1;next.vanityStool=1;}
        else if (type.id==='diningTable'&&current===0) {next.diningTable=1;next.diningChair=Math.max(2,next.diningChair||0);}
        else if (type.id==='diningChair') {
          if (!(counts.diningTable>0)) continue;
          next.diningChair=current+1;
        } else next[type.id]=current+1;
        actions.push(next);
      }
      return actions;
    }

    function generateInventoryFrontier(programId,scene,objectiveId) {
      const objective=INVENTORY_OBJECTIVES[objectiveId],base=baseInventoryCounts(programId);
      const first={counts:base,estimate:inventoryEstimate(programId,base,scene,objectiveId)};
      let beam=[first];const collected=[first],seen=new Set([inventoryCountsSignature(programId,base)]);
      const maxDepth=PROGRAMS[programId].types.reduce((sum,type)=>sum+type.maxCount-(type.minCount||0),0);
      const baseMaxDensity=objectiveId==='function'?.59:objectiveId==='balanced'?.53:.45,maxDensity=baseMaxDensity*(layoutDensityMode==='rich'?1.16:layoutDensityMode==='airy'?.88:1);
      for (let depth=0;depth<maxDepth;depth++) {
        const children=[];
        for (const state of beam) for (const counts of inventoryAddActions(programId,state.counts,scene,objectiveId)) {
          const signature=inventoryCountsSignature(programId,counts);if(seen.has(signature))continue;seen.add(signature);
          const estimate=inventoryEstimate(programId,counts,scene,objectiveId);
          if (estimate.density>maxDensity||estimate.wallRatio>1.12) continue;
          children.push({counts,estimate});
        }
        if (!children.length) break;
        children.sort((a,b)=>b.estimate.score-a.estimate.score);
        beam=children.slice(0,24);collected.push(...beam);
      }
      const unique=new Map();
      for (const state of collected) {
        const signature=inventoryCountsSignature(programId,state.counts),prior=unique.get(signature);
        if (!prior||state.estimate.score>prior.estimate.score) unique.set(signature,state);
      }
      return [...unique.values()].sort((a,b)=>b.estimate.score-a.estimate.score);
    }

    function inventoryCandidateSequence(programId,frontier,limit=7) {
      if (!frontier.length) return [];
      const byPieces=new Map();
      for (const candidate of frontier) if (!byPieces.has(candidate.estimate.pieces)) byPieces.set(candidate.estimate.pieces,candidate);
      const representatives=[...byPieces.values()];
      const basePieces=inventoryPieceCount(baseInventoryCounts(programId));
      const targetPieces=frontier[0].estimate.pieces;
      const desired=[1,.86,.72,.60,.48,.35,0].map(ratio=>Math.round(basePieces+(targetPieces-basePieces)*ratio));
      const sequence=[],used=new Set();
      for (const desiredPieces of desired) {
        const candidate=representatives.filter(item=>!used.has(item.estimate.pieces))
          .sort((a,b)=>Math.abs(a.estimate.pieces-desiredPieces)-Math.abs(b.estimate.pieces-desiredPieces)||b.estimate.score-a.estimate.score)[0];
        if (!candidate) continue;
        used.add(candidate.estimate.pieces);sequence.push(candidate);
        if (sequence.length>=limit) break;
      }
      for (const candidate of representatives) {
        if (sequence.length>=limit) break;
        if (!used.has(candidate.estimate.pieces)) {used.add(candidate.estimate.pieces);sequence.push(candidate);}
      }
      return sequence;
    }

    // 在完整库存 Frontier 前先试摆一组“设计阶梯”。这些不是写死坐标，
    // 而是数量组合；实际坐标、方向和模数尺寸仍由同一套候选规则 + Beam 搜索。
    // 目的是补上“床+衣柜”和“一次塞入所有可选家具”之间的实用中间档。
    function stagedInventoryCandidates(programId,scene,objectiveId) {
      const program=PROGRAMS[programId],typeById=new Map(program.types.map(type=>[type.id,type]));
      const make=values=>{
        const counts=baseInventoryCounts(programId);
        for(const [typeId,value] of Object.entries(values)){
          const type=typeById.get(typeId);if(!type)continue;
          counts[typeId]=clamp(Math.round(value),type.minCount||0,type.maxCount);
        }
        return {counts,estimate:inventoryEstimate(programId,counts,scene,objectiveId)};
      };
      const area=scene.area,tier=roomAreaTier(programId,area),modules=new Set(tier.modules),rows=[];
      if(programId==='bedroom'){
        const core={bed:1,wardrobe:1};
        if(area>=9)core.night=2;
        if(area>=12){core.desk=1;core.chair=1;}
        const micro={...core};
        // 8㎡以下优先保证床和衣柜；床头柜会挤掉必需衣柜，书桌也不能靠
        // “输出缺家具的半盘棋”伪装成丰富。8㎡以上才挑战桌/床头柜组合。
        if(area>=8&&area<9){micro.night=1;micro.desk=1;micro.chair=1;}
        // 通行版先保证睡眠、收纳、工作三个基本组可用。
        rows.push(make(micro));
        const focusChallenge=(LAYOUT_CONSTRAINTS.inventory.focusChallenges?.bedroom||[]).find(row=>area+EPS>=Number(row.minArea||0)&&area-EPS<=Number(row.maxArea??Infinity));
        if(focusChallenge)rows.push({...make({...core,...(focusChallenge.challenge||focusChallenge.target)}),moduleChallenge:true,focusChallenge:true});
        // “丰富”不再先用面积表删掉可选家具。先把所有有意义的模块交给同一盘
        // 棋：合法且改善构图就落下；放不下时走该槽位的 skip，继续尝试后面的
        // 家具。这样面积是几何搜索的结果，而不是人为写死的准入条件。
        const richChallenge={...core,tvbench:1,bedroomLoveseat:1,bedroomTeaTable:1,bench:1,
          chest:1,shelf:1,bedroomDisplay:1,lounge:1,vanity:1,vanityStool:1};
        rows.push({...make(richChallenge),autoChallenge:true});
        const bedroomAspect=Math.max(scene.width/Math.max(scene.depth,EPS),scene.depth/Math.max(scene.width,EPS));
        const longBedroomConfig=LAYOUT_CONSTRAINTS.inventory.longBedroomChallenge;
        const longBedroomChallengeActive=longBedroomConfig?.enabled===true
          &&(!longBedroomConfig.shape||scene.shape===longBedroomConfig.shape)
          &&area+EPS>=Number(longBedroomConfig.minArea||0)
          &&bedroomAspect+EPS>=Number(longBedroomConfig.minAspect||0);
        // 长条卧室中，床尾凳、浅展示柜和会客组一起进入搜索；放不下的单件自动 skip。
        // 具体家具数量来自配置，这里不再另外写一套场景规则。
        if(longBedroomChallengeActive)rows.push({...make({...core,...longBedroomConfig.counts}),longBedroomChallenge:true});
        // 少量锚点盘仅作为丰富盘无法通过时的几何退路。
        rows.push({...make({...core,night:1,tvbench:1,bedroomLoveseat:1}),hotelAnchorChallenge:true});
        rows.push({...make({bed:1,wardrobe:1,night:0,desk:1,chair:1,tvbench:1}),hotelMediaFallback:true});
        // 长条卧室优先尝试酒店式“床尾壁挂电视 + 超薄电视柜”。它是睡眠组的
        // 延伸，不要求先摆小沙发，也不会把 0.4m 深普通电视柜硬塞进窄通道。
        const hotelMediaPreferred=area>=15&&bedroomAspect>=1.65;
        if(area>=15)rows.push(make({...core,tvbench:1}));
        // 大卧室先试完整的“单人/小沙发 + 茶几 + 小电视柜”硬家具组。
        // 活动区与填缝柜均在硬家具搜索结束后补，不再抢占这组的优先级。
        if(area>=20)rows.push(make({...core,bedroomLoveseat:1,bedroomTeaTable:1,tvbench:1}));
        if(modules.has('storage'))rows.push(make({...core,bedroomLoveseat:1,bedroomTeaTable:1,tvbench:1,bedroomDisplay:1,chest:1}));
        // 中等卧室仍可只尝试一个休闲中心，避免床尾凳、休闲椅和小沙发同时抢通道。
        if(area>=14.5)rows.push(make({...core,bedroomLoveseat:1}));
        if(area>=12.8)rows.push(make({...core,lounge:1}));
        // 接近方形的常规卧室（如 3.6×3.8）床尾通常已有一整条横向余量，
        // 床尾凳可紧贴床尾或留出坐姿落脚缝，不应等到 15.5㎡才进入库存候选。
        if(area>=13.2)rows.push(make({...core,bench:1}));
        // 展示柜优先用于消化连续空墙；大卧室再尝试与一个休闲中心组合。
        if(area>=13.5)rows.push(make({...core,bedroomDisplay:1}));
        if(area>=18)rows.push(make({...core,bench:1,bedroomDisplay:1}));
        // 真正的几何兜底必须也是一盘走完的棋。过去依赖“必放槽位无解后返回
        // 上一回合”伪造床+衣柜方案；修正搜索终止后在这里显式保留基础清单。
        rows.push({...make({bed:1,wardrobe:1}),essentialFallback:true});
      }else{
        const conversation={sofa:1,tv:1,coffee:1},core={...conversation};
        if(area>=14){core.arm=2;core.side=1;core.floorLamp=1;}
        rows.push(make(core));
        if(area>=16)rows.push(make({...core,bookcase:1}));
        if(area>=18)rows.push(make({...core,display:1}));
        // 大客厅可以是纯会客+连续收纳构图，不应因为没有餐桌就跳转到 20+ 件的过载 Frontier。
        if(area>=22)rows.push(make({...core,sideboard:1,bookcase:1,display:1}));
        // 大客餐厅仍保留会客核心，但家具增长以完整模块为单位。
        if(area>=30)rows.push(make({...core,arm:3,side:2,floorLamp:2,sideboard:2,bookcase:1,display:1,infillCabinet:0}));
        const largeDiningChairTarget=2;
        if(area>=19)rows.push({...make({...conversation,arm:1,side:1,diningTable:1,diningChair:largeDiningChairTarget,...configuredAreaTarget(LAYOUT_CONSTRAINTS.inventory.stagedSupport?.living,area)}),moduleChallenge:true});
        if(area>=23)rows.push(make({...conversation,arm:1,side:1,diningTable:1,diningChair:4,sideboard:1}));
        // 大客厅优先尝试紧凑但完整的双区骨架：围合会客 + 双人餐组 +
        // 两种沿墙收纳。它比四椅三柜组合更容易保住 0.50m 连通通路。
        if(area>=34)rows.push(make({...conversation,arm:1,side:1,floorLamp:1,diningTable:1,diningChair:2,sideboard:1,bookcase:1}));
        if(modules.has('storage'))rows.push(make({...core,arm:2,side:1,floorLamp:1,diningTable:1,diningChair:4,sideboard:1,bookcase:1,display:1}));
        if(modules.has('storage'))rows.push(make({...conversation,arm:1,side:1,diningTable:1,diningChair:2,sideboard:1,bookcase:1,display:1}));
      }
      // 功能丰富从较多件数开始，通行优先从基线开始。
      // 综合方案则先尝试一个与面积相称的休闲/床尾构图，避免 A 方案永远只有基础家具。
      if(objectiveId==='function')rows.reverse();
      else if(objectiveId==='balanced'&&programId==='bedroom'){
        const bedroomAspect=Math.max(scene.width/Math.max(scene.depth,EPS),scene.depth/Math.max(scene.width,EPS));
        const hotelMediaPreferred=area>=15&&bedroomAspect>=1.65;
        const recognizedHotelMediaPreferred=scene.shape==='recognized'&&hotelMediaPreferred;
        const preferred=area>=6.2&&area<9
          ?rows.find(row=>(row.counts.night||0)>=1&&(row.counts.desk||0)>0&&(row.counts.chair||0)>0)
          :layoutDensityMode==='rich'&&rows.some(row=>row.focusChallenge)?rows.find(row=>row.focusChallenge)
          :layoutDensityMode==='rich'&&recognizedHotelMediaPreferred?(rows.find(row=>row.longBedroomChallenge)||rows.find(row=>row.hotelAnchorChallenge))
          :layoutDensityMode==='rich'?rows.find(row=>row.autoChallenge)
          :recognizedHotelMediaPreferred?rows.find(row=>(row.counts.tvbench||0)>0&&(row.counts.bedroomLoveseat||0)===0)
          :area>=20
          ?rows.find(row=>(row.counts.bedroomLoveseat||0)>0&&(row.counts.bedroomTeaTable||0)>0&&(row.counts.tvbench||0)>0)
          :hotelMediaPreferred?rows.find(row=>(row.counts.tvbench||0)>0)
          :area>=13.2?(rows.find(row=>(row.counts.bench||0)>0)||rows.find(row=>(row.counts.bedroomLoveseat||0)>0))
          :area>=12.8?rows.find(row=>(row.counts.lounge||0)>0):null;
        if(preferred){
          const corePieces=Math.min(...rows.map(row=>row.estimate.pieces)),enriched=rows.filter(row=>row!==preferred&&row.estimate.pieces>corePieces),baseline=rows.filter(row=>row!==preferred&&row.estimate.pieces<=corePieces);
          rows.splice(0,rows.length,preferred,...enriched,...baseline);
        }
      }else if(objectiveId==='balanced'&&programId==='living'&&modules.has('dining')){
        // 客餐厅先挑战完整餐组；随面积增加的沿墙辅助家具来自同一份配置，
        // 不再在这里写死“必须书柜”，避免多门异形客厅被某一柜型堵出孤岛。
        const chairTarget=2;
        const support=configuredAreaTarget(LAYOUT_CONSTRAINTS.inventory.stagedSupport?.living,area);
        const preferred=rows.find(row=>(row.counts.diningTable||0)>0&&(row.counts.diningChair||0)>=chairTarget&&Object.entries(support).every(([typeId,count])=>(row.counts[typeId]||0)>=count));
        if(preferred)rows.splice(0,rows.length,preferred,...rows.filter(row=>row!==preferred));
      }
      const unique=new Map();for(const row of rows)unique.set(inventoryCountsSignature(programId,row.counts),row);
      return [...unique.values()];
    }

    function applyAutoDimensions(programId,mode,sofaPreset=null,scene=null) {
      const config=CONFIGS[programId];
      for(const type of PROGRAMS[programId].types){
        const presets=configuredGeometryPresets(programId,type.id);if(!presets.length)continue;
        const areaModes=LAYOUT_CONSTRAINTS.inventory.variantModeByArea?.[programId]?.[type.id]||[],configuredMode=scene?[...areaModes].sort((a,b)=>Number(b.minArea)-Number(a.minArea)).find(row=>scene.area+EPS>=Number(row.minArea))?.mode:null,typeMode=configuredMode||mode;
        const index=typeMode==='compact'?0:typeMode==='generous'?presets.length-1:Math.floor((presets.length-1)/2);
        config.dimensions[type.id]={...presets[index]};
      }
    }

    function profileForInventory(programId,scene,objectiveId,candidate,forceCompact=false) {
      const objective=INVENTORY_OBJECTIVES[objectiveId],densityTarget=candidate.estimate.targetDensity;
      let mode='standard';
      if (forceCompact||candidate.estimate.density>densityTarget+.035) mode='compact';
      else if (candidate.estimate.density<densityTarget-.10&&scene.area>18&&candidate.estimate.pieces<candidate.estimate.softPieceCapacity*.72) mode='generous';
      // 全清单挑战中的多数家具本来就允许 skip，不能把“名义件数”误判为一定
      // 全部落地并整体缩小。长卧室先用真实常规模数下棋，放不下的单件再跳过。
      if(programId==='bedroom'&&candidate.autoChallenge&&!forceCompact)mode='standard';
      // 大客厅的功能方案已经通过“更多件数”表达丰富度，再把每件家具放大为 generous
      // 会同时挤死餐组和沿墙柜，导致同一配置在标准模数可行、放大模数却连续失败。
      if(programId==='living'&&scene.area>=30&&candidate.estimate.pieces>=10&&mode==='generous')mode='standard';
      const configuredStandardModules=LAYOUT_CONSTRAINTS.search.auto.profileRules.forceStandardRoomModules;
      if(roomAreaTier(programId,scene.area).modules.some(moduleId=>configuredStandardModules.includes(moduleId)))mode='standard';
      // 窄长大卧室已经通过“床组 + 工作组 + 会客组三件套”表达丰富度。
      // 再把每件家具整体放大，会把横向 0.50m 通路吃掉；标准模数仍允许单件
      // 在多尺寸搜索中按墙长择优，是更稳定的酒店式解法。
      const bedroomAspect=Math.max(scene.width/Math.max(scene.depth,EPS),scene.depth/Math.max(scene.width,EPS));
      if(programId==='bedroom'&&bedroomAspect>=1.65&&(candidate.counts.bedroomLoveseat||0)>0&&(candidate.counts.bedroomTeaTable||0)>0&&mode==='generous')mode='standard';
      let sofaPreset=null;
      if (programId==='living') {
        if (mode==='compact') sofaPreset=scene.area>=30?'three':'loveseat';
        else if (mode==='generous') sofaPreset=scene.area>48?'four':'three';
        else sofaPreset='three';
      }
      return {mode,sofaPreset};
    }

    function snapshotProgramConfig(programId) {
      const config=CONFIGS[programId];
      return {counts:{...config.counts},dimensions:Object.fromEntries(Object.entries(config.dimensions).map(([id,dims])=>[id,{...dims}])),sofaPreset:config.sofaPreset};
    }

    function applyProgramSnapshot(programId,snapshot) {
      const config=CONFIGS[programId];config.counts={...snapshot.counts};
      config.dimensions=Object.fromEntries(Object.entries(snapshot.dimensions).map(([id,dims])=>[id,{...dims}]));
      if (snapshot.sofaPreset) config.sofaPreset=snapshot.sofaPreset;
      setProgram(programId);refreshFurniture();
    }

    function autoSelectInventory(options={}) {
      const programId=PROGRAMS[options.programId]?options.programId:currentProgram;
      variableSizeSearch=true;
      setProgram(programId);
      const config=CONFIGS[programId],program=PROGRAMS[programId];
      let attempts=0,totalNodes=0,totalTimeMs=0,totalBatches=0,totalMatrixCandidates=0;const trials=[];
      const makeCurrentScene=()=>makeScene(options.shape||'rect',options.width||program.defaultWidth,options.depth||program.defaultDepth,options.areaMultiplier||1);
      const trialScene=makeCurrentScene(),cache=new Map();
      // 28㎡以上房间采用固定计算预算。超大卧室与超大客厅一样，面积变大只切换
      // 功能模块，不允许把“试多少套库存”或每件家具的采样量同步放大。
      const autoSearch=LAYOUT_CONSTRAINTS.search.auto,largeRoomBudget=trialScene.area>=autoSearch.attemptLimit.largeArea,attemptLimit=largeRoomBudget?autoSearch.attemptLimit.large:autoSearch.attemptLimit.normal;
      const passesHardFurniturePhase=solution=>!!solution?.evaluation?.qualityPass;
      // 相同数量在不同目标下使用不同 Beam 宽度与验收阈值，失败结果不能跨目标复用。
      const configurationKey=(counts,profile,objectiveId)=>`${inventoryCountsSignature(programId,counts)}@${profile.mode}:${profile.sofaPreset||'-'}:${objectiveId}`;
      // 功能方案要求“多一个完整功能组”，不要求在库存估算阶段同时填满所有类别。
      // 过高的 .84 会跳过 9~14 件的实用组合，直接去试 19~20 件的过载候选。
      // 大客厅的“会客核心 + 沿墙收纳”本身就是完整方案，不能仅因没有餐桌而被
      // 0.72~0.76 的面积覆盖率门槛提前删掉；否则会直接跳进 13+ 件餐组并反复失败。
      const diningTier=programId==='living'&&roomAreaTier('living',trialScene.area).modules.includes('dining');
      const coverageFloorFor=objectiveId=>objectiveId==='function'
        ?(programId==='bedroom'?.80:diningTier?.66:.70)
        :objectiveId==='circulation'?(programId==='bedroom'?.78:diningTier?.60:.66)
        :(programId==='bedroom'?.72:diningTier?.62:.68);
      // 配置层的条件全部来自数量与面积，无需进入几何 Beam 才能知道结果。
      // 先挡掉必定会被 strictOk 否决的配置，避免过去“完整试摆后再判失败”的浪费。
      const passesInventoryGates=(candidate,objectiveId)=>{
        if(!candidate?.estimate)return false;
        if(candidate.essentialFallback||candidate.hotelMediaFallback||candidate.moduleChallenge)return true;
        // 酒店锚点方案允许“一只床头柜换一张沙发”。这是设计取舍，不是缺件；
        // 真实可行性继续交给 0.50m 通路、孤岛和完整质量评分。
        if(layoutDensityMode==='rich'&&candidate.estimate.missingCompletionPenalty>16&&!candidate.hotelAnchorChallenge&&!candidate.longBedroomChallenge)return false;
        if(candidate.estimate.coverage+EPS<coverageFloorFor(objectiveId))return false;
        return true;
      };
      const tryConfiguration=(candidate,objectiveId,forceCompact=false)=>{
        const profile=profileForInventory(programId,trialScene,objectiveId,candidate,forceCompact),key=configurationKey(candidate.counts,profile,objectiveId);
        if (cache.has(key)) return cache.get(key);
        applyAutoDimensions(programId,profile.mode,profile.sofaPreset,trialScene);config.counts={...candidate.counts};refreshFurniture();
        // 综合/通行只需快速找到高质量可行解，使用较窄 Beam；“功能丰富”保留
        // 原来的宽 Beam，避免为了速度牺牲最终可摆家具数。
        const richFinal=objectiveId==='function';
        const compactLivingBudget=programId==='living'&&trialScene.area<18?46:null;
        const largeLiving=programId==='living'&&trialScene.area>=28,largeRoom=trialScene.area>=28;
        const trialBedroomAspect=Math.max(trialScene.width/Math.max(trialScene.depth,EPS),trialScene.depth/Math.max(trialScene.width,EPS));
        const largeBedroomLounge=programId==='bedroom'&&(candidate.counts.bedroomLoveseat||0)>0&&(largeRoom||trialBedroomAspect>=1.65);
        const bedroomMediaFallback=programId==='bedroom'&&candidate.hotelMediaFallback;
        const qualityDining=programId==='living'&&diningTier;
        const calculatedBeamWidth=bedroomMediaFallback?120:largeBedroomLounge?(trialBedroomAspect>=1.65&&trialScene.area<28?120:72):qualityDining&&largeRoom?152:(richFinal||qualityDining
          ?(largeRoom?Math.min(52,34+Math.round(FURNITURE.length*.8)):(FURNITURE.length>=20?92:Math.min(62,44+Math.round(FURNITURE.length*1.2))))
          :(largeRoom?Math.min(36,24+Math.round(FURNITURE.length*.55)):(compactLivingBudget||(FURNITURE.length>=20?52:Math.min(44,28+Math.round(FURNITURE.length*.8))))));
        const beamWidth=layoutDensityMode==='rich'?Math.max(calculatedBeamWidth,configuredAreaValue(autoSearch.richMinimumBeamWidthByArea,trialScene.area)):calculatedBeamWidth;
        // 超大客厅仍使用精确矩形复核；这里只把 Bitset broad-phase 的格网从
        // 0.12m 放宽到 0.15m，减少 occupancy words 与复制成本，不改变最终几何判定。
        const adaptiveGridStep=trialScene.area>=40?.15:.12;
        const probe=search(trialScene,{beamWidth,gridStep:adaptiveGridStep}),inventoryItems=FURNITURE.map(item=>({...item}));
        // 补柜会改变地面、墙面和通行结果，因此库存方案必须按“补柜后的最终现场”验收。
        probe.solutions=probe.solutions.map(solution=>{
          const finalized={...solution,evaluation:JSON.parse(JSON.stringify(solution.evaluation)),inventoryItems};
          finalized.decorItems=validatePostLayoutDecor(finalized,trialScene,synthesizeSoftDecor(finalized,trialScene,inventoryItems));
          return finalized;
        });
        const coverageFloor=coverageFloorFor(objectiveId);
        const completionOk=layoutDensityMode!=='rich'||candidate.estimate.missingCompletionPenalty<=16||candidate.longBedroomChallenge||candidate.hotelAnchorChallenge||candidate.hotelMediaFallback||candidate.essentialFallback||candidate.moduleChallenge;
        const strictOk=completionOk&&candidate.estimate.coverage>=coverageFloor&&probe.solutions.some(passesHardFurniturePhase);
        attempts++;totalNodes+=probe.stats.nodes;totalTimeMs+=probe.stats.timeMs;totalBatches+=probe.stats.batches||0;totalMatrixCandidates+=probe.stats.matrixCandidates||probe.stats.nodes;
        trials.push({objective:objectiveId,pieces:FURNITURE.length,counts:{...candidate.counts},mode:profile.mode,ok:strictOk,timeMs:probe.stats.timeMs,bestReach:probe.stats.bestReach,bestEvaluation:probe.solutions[0]?.evaluation?{qualityPass:probe.solutions[0].evaluation.qualityPass,scores:{...probe.solutions[0].evaluation.scores},reach:{hardPass:probe.solutions[0].evaluation.reach.hardPass,hardReachableRatio:probe.solutions[0].evaluation.reach.hardReachableRatio,islandArea:probe.solutions[0].evaluation.reach.unreachableArea},placed:Object.keys(probe.solutions[0].poses||{}).length,diagnostics:{densityCoherent:probe.solutions[0].evaluation.diagnostics?.densityCoherent,bedroomWallCoherent:probe.solutions[0].evaluation.diagnostics?.bedroomWallCoherent,severeFieldDefect:probe.solutions[0].evaluation.diagnostics?.severeFieldDefect,postLayoutValidation:probe.solutions[0].evaluation.diagnostics?.postLayoutValidation}}:null});
        const trial={ok:strictOk,probe,profile,key,candidate,items:inventoryItems,config:snapshotProgramConfig(programId)};
        cache.set(key,trial);return trial;
      };
      const objectives=['balanced','circulation','function'],plans=new Array(objectives.length),usedKeys=new Set();
      // search() 的输出既保留高分解，也保留构图多样性，因此数组第一项不保证
      // 是实际落地件数最多的一项。丰满模式下先比较落地件数，再比较最终总分；
      // 通行优先仍按最终总分选择，避免为了多一件家具破坏它的目标语义。
      const chooseObjectiveSolution=(solutions,objectiveId)=>[...(solutions||[])].sort((a,b)=>{
        const passDelta=Number(b.evaluation?.qualityPass)-Number(a.evaluation?.qualityPass);if(passDelta)return passDelta;
        if(objectiveId==='circulation'){
          const fieldA=(a.evaluation?.scores?.circulation||0)*.62+(a.evaluation?.scores?.ground||0)*.38;
          const fieldB=(b.evaluation?.scores?.circulation||0)*.62+(b.evaluation?.scores?.ground||0)*.38;
          if(fieldB!==fieldA)return fieldB-fieldA;
        }
        const moduleDelta=(b.evaluation?.scores?.modules||0)-(a.evaluation?.scores?.modules||0);if(Math.abs(moduleDelta)>=3)return moduleDelta;
        if(layoutDensityMode==='rich'){
          const pieceDelta=Object.keys(b.poses||{}).length-Object.keys(a.poses||{}).length;if(pieceDelta)return pieceDelta;
        }
        const totalDelta=(b.evaluation?.total??-Infinity)-(a.evaluation?.total??-Infinity);if(totalDelta)return totalDelta;
        return Object.keys(b.poses||{}).length-Object.keys(a.poses||{}).length;
      })[0];
      const makePlan=(trial,objectiveId,allowAny=false)=>{
        const strictSolutions=trial.probe.solutions.filter(passesHardFurniturePhase);
        const chosen=chooseObjectiveSolution(strictSolutions.length||!allowAny?strictSolutions:trial.probe.solutions,objectiveId);
        if(!chosen)return null;
        // 同一盘搜索结果会被 A/B/C 三个视角复用，但最终补柜会原地更新评分。
        // 每个方案必须拥有独立 evaluation，避免后一个方案覆盖前一个方案的墙面账目。
        return {...chosen,evaluation:JSON.parse(JSON.stringify(chosen.evaluation)),inventoryItems:trial.items,inventoryConfig:trial.config,inventoryProfile:trial.profile,inventoryKey:trial.key,inventoryObjective:objectiveId,
          inventoryLabel:INVENTORY_OBJECTIVES[objectiveId].label,inventoryEstimate:trial.candidate.estimate,planTrace:trial.probe.trace,planBeamTree:trial.probe.beamTree};
      };
      let balancedTrial=null;
      for (let objectiveIndex=0;objectiveIndex<objectives.length;objectiveIndex++) {
        const objectiveId=objectives[objectiveIndex];
        // 丰满模式先找一盘通过完整质量门槛的“好棋”。同一批入围解已经包含
        // 构图多样性，后两个目标只需换排序视角，无需把相同库存再搜索两遍。
        if(objectiveIndex>0&&layoutDensityMode==='rich'&&balancedTrial){
          const reusedPlan=makePlan(balancedTrial,objectiveId);
          if(reusedPlan){plans[objectiveIndex]=reusedPlan;continue;}
        }
        const frontier=generateInventoryFrontier(programId,trialScene,objectiveId);
        let accepted=null,checked=0;const checkedSignatures=new Set();
        const balancedPieces=plans[0]?.inventoryItems.length;
        const functionFloor=balancedPieces?Math.max(inventoryPieceCount(baseInventoryCounts(programId)),balancedPieces-4):0;
        const staged=stagedInventoryCandidates(programId,trialScene,objectiveId);
        let candidateSequence=[...staged,...inventoryCandidateSequence(programId,frontier,7)];
        // 阶梯候选携带“酒店锚点/真实兜底”等语义；同数量的 Frontier 只能排在
        // 后面，不能用普通对象覆盖这些标记。
        const candidateBySignature=new Map();for(const candidate of candidateSequence){const signature=inventoryCountsSignature(programId,candidate.counts);if(!candidateBySignature.has(signature))candidateBySignature.set(signature,candidate)}candidateSequence=[...candidateBySignature.values()];
        if (objectiveId==='circulation'&&balancedPieces) candidateSequence=candidateSequence.filter(candidate=>candidate.estimate.pieces<=balancedPieces);
        if (objectiveId==='function'&&balancedPieces) candidateSequence=candidateSequence.filter(candidate=>candidate.estimate.pieces>=functionFloor);
        candidateSequence=candidateSequence.filter(candidate=>passesInventoryGates(candidate,objectiveId));
        for (const candidate of candidateSequence) {
          if (attempts>=attemptLimit) break;
          checkedSignatures.add(inventoryCountsSignature(programId,candidate.counts));
          let trial=tryConfiguration(candidate,objectiveId,false);checked++;
          if (!trial.ok||usedKeys.has(trial.key)) continue;
          accepted=trial;break;
        }
        if (!accepted&&plans.some(Boolean)&&attempts<attemptLimit) {
          const feasibleCeiling=Math.max(...plans.filter(Boolean).map(plan=>plan.inventoryItems.length));
          let alternatives=0;
          for (const candidate of frontier) {
            const signature=inventoryCountsSignature(programId,candidate.counts);
            if ((objectiveId!=='function'&&candidate.estimate.pieces>feasibleCeiling)||checkedSignatures.has(signature)) continue;
            if (objectiveId==='circulation'&&balancedPieces&&candidate.estimate.pieces>balancedPieces) continue;
            if (objectiveId==='function'&&balancedPieces&&candidate.estimate.pieces<functionFloor) continue;
            if (!passesInventoryGates(candidate,objectiveId)) continue;
            checkedSignatures.add(signature);alternatives++;
            const trial=tryConfiguration(candidate,objectiveId,false);
            if (trial.ok&&!usedKeys.has(trial.key)) {accepted=trial;break;}
            if (alternatives>=3||attempts>=attemptLimit) break;
          }
        }
        if (!accepted) continue;
        usedKeys.add(accepted.key);
        const plan=makePlan(accepted,objectiveId);if(!plan)continue;
        plans[objectiveIndex]=plan;
        if(objectiveIndex===0)balancedTrial=accepted;
      }
      if (plans.filter(Boolean).length<objectives.length) {
        const placedCount=trial=>Math.max(0,...(trial.probe.solutions||[]).map(solution=>Object.keys(solution.poses||{}).length));
        const bestScore=trial=>Math.max(-Infinity,...(trial.probe.solutions||[]).map(solution=>solution.evaluation?.total??-Infinity));
        const attempted=[...cache.values()].sort((a,b)=>Number(b.ok)-Number(a.ok)||placedCount(b)-placedCount(a)||bestScore(b)-bestScore(a)||b.candidate.estimate.score-a.candidate.estimate.score);
        const successful=attempted.filter(trial=>trial.ok);
        // 固定预算内即使没有达到严格阈值，也使用实际落地最多的已算局面；
        // 不再额外启动一次“3 件主家具”的兜底搜索，既省时也避免大房间突然变空。
        if (!successful.length&&attempted.length) successful.push(...attempted);
        if (!successful.length) {
          const base={counts:baseInventoryCounts(programId)};base.estimate=inventoryEstimate(programId,base.counts,trialScene,'balanced');
          successful.push(tryConfiguration(base,'balanced',true));
        }
        for (let objectiveIndex=0;objectiveIndex<objectives.length;objectiveIndex++) {
          if (plans[objectiveIndex]) continue;
          const objectiveId=objectives[objectiveIndex];
          const balancedPieces=plans[0]?.inventoryItems.length;
          const functionFloor=balancedPieces?Math.max(inventoryPieceCount(baseInventoryCounts(programId)),balancedPieces-4):0;
          const eligible=successful.filter(trial=>objectiveId==='circulation'&&balancedPieces?trial.items.length<=balancedPieces:
            objectiveId==='function'&&balancedPieces?trial.items.length>=functionFloor:true);
          const fallback=eligible.find(trial=>!usedKeys.has(trial.key))||eligible.find(trial=>trial.key===plans[0]?.inventoryKey)||eligible[0]||successful[0];
          if (!fallback) continue;
          usedKeys.add(fallback.key);
          const plan=makePlan(fallback,objectiveId,true);if(!plan)continue;
          plans[objectiveIndex]=plan;
        }
      }
      const completePlans=plans.filter(Boolean);
      // 软装是最终方案的“附着层”：它不占用 Bitset、不扩张 Beam，只依附已经
      // 通过硬规则的家具和墙面生成。这样既能表达真实设计的丰富度，也不会把
      // 地毯、台灯、挂画错误地当成一个个需要碰撞试摆的 Box。
      for(const plan of completePlans){
        applyProgramSnapshot(programId,plan.inventoryConfig);
        if(!plan.decorItems)plan.decorItems=validatePostLayoutDecor(plan,trialScene,synthesizeSoftDecor(plan,trialScene,plan.inventoryItems));
      }
      const primary=completePlans[0],primaryConfig=primary?.inventoryConfig||snapshotProgramConfig(programId);
      applyProgramSnapshot(programId,primaryConfig);
      const stats={mode:'inventory-matrix',nodes:totalNodes,matrixCandidates:totalMatrixCandidates,timeMs:totalTimeMs,avgUs:totalMatrixCandidates?totalTimeMs*1000/totalMatrixCandidates:0,batches:totalBatches,depths:[],qualityRejected:0};
      const probe={solutions:completePlans,trace:primary?.planTrace||[{poses:{},depth:0}],beamTree:primary?.planBeamTree||null,stats,scene:trialScene};
      return {
        counts:{...primaryConfig.counts},scene:trialScene,probe,attempts,totalNodes,totalTimeMs,trials,
        feasible:completePlans.length>0,sizeMode:primary?.inventoryProfile?.mode||'compact',
        sofaPreset:primaryConfig.sofaPreset,plans:completePlans.map(plan=>({objective:plan.inventoryObjective,pieces:plan.inventoryItems.length,counts:plan.inventoryConfig.counts}))
      };
    }

    function synthesizeSoftDecor(state,roomScene,inventoryItems=null) {
      const items=inventoryItems||state?.inventoryItems||FURNITURE,poses=state?.poses||{},byType=new Map();
      for(const item of items){if(!poses[item.id])continue;const list=byType.get(item.typeId)||[];list.push({item,pose:poses[item.id]});byType.set(item.typeId,list);}
      const first=typeId=>byType.get(typeId)?.[0]||null,all=typeId=>byType.get(typeId)||[],decor=[];
      const bodyOf=entry=>entry?footprintRects(entry.item,entry.pose)[0]:null;
      const add=(kind,label,body,extra={})=>{if(!body)return;decor.push({kind,label,x:body.x,y:body.y,w:body.w,d:body.d,rotation:body.rotation||0,layer:'overlay',...extra});};
      const baseOccupied=[],baseHard=[];
      for(const item of items){const pose=poses[item.id];if(!pose)continue;baseOccupied.push(...footprintRects(item,pose));baseHard.push(...hardFunctionalZones(item,pose).map(zone=>zone.rect));}

      // 大房间的沿墙补全不进入 Beam。这里只对最终方案做一次有上限的空墙扫描，
      // 因而不会把“可变长度 × 墙段 × 回合”乘进搜索树。18/28/40㎡分别最多补 1/2/3 组。
      const synthesizeWallComplements=()=>{
        const complementRules=LAYOUT_CONSTRAINTS.postLayout.wallComplements,programRules=complementRules.programs[currentProgram];
        if(!customCabinetEnabled||complementRules.enabled!==true||roomScene.area<programRules.minimumArea)return [];
        // 配置中的墙段预算仍决定需要补几段，但它只在最终方案上执行；上限避免
        // 超大房间沿每面空墙无限补柜，也不会把这些柜体重新带回搜索树。
        const areaTarget=configuredAreaValue(programRules.budgetByArea,roomScene.area);
        const target=Math.min(programRules.maxBudget,Math.max(areaTarget,infillWallBudget(currentProgram,roomScene)));
        // 0.10–0.59m 不是一件独立家具，而是定制柜的封板/窄柜模块；它专门解决
        // 角落和柜间死缝。仍作为实体参加最终通行复核，不能偷偷侵占走道。
        const depth=programRules.depth,minWidth=programRules.minWidth,maxWidth=programRules.maxWidth;
        const candidates=[],tvFlanks=[],faux={id:'postWallDisplay',typeId:currentProgram==='living'?'display':'bedroomDisplay',w:1,d:depth,shape:'box'};
        const tvEntry=currentProgram==='bedroom'?first('tvbench'):null,tvBody=bodyOf(tvEntry),tvWallIndex=tvEntry?.pose?.wallIndex;
        for(const wall of roomScene.walls){
          if(Math.abs(wall.dx)>1e-5&&Math.abs(wall.dy)>1e-5)continue;
          let intervals=freeWallIntervals(wall,state,roomScene,faux,0);
          for(const door of sceneDoors(roomScene)){
            const doorA=door.a||{x:door.x0,y:door.y},doorB=door.b||{x:door.x1,y:door.y};
            if(!pointOnSegment(doorA,wall.a,wall.b)||!pointOnSegment(doorB,wall.a,wall.b))continue;
            const d0=dot({x:doorA.x-wall.a.x,y:doorA.y-wall.a.y},wall.dir),d1=dot({x:doorB.x-wall.a.x,y:doorB.y-wall.a.y},wall.dir);
            intervals=intervals.flatMap(([a,b])=>subtractInterval([[a,b]],Math.min(d0,d1)-.08,Math.max(d0,d1)+.08));
          }
          for(const [start,end] of intervals){
            const available=end-start;if(available<minWidth-EPS)continue;
            // 电视柜两侧优先用同深度的窄收纳柜收边。旧逻辑一律按 0.34m 深、
            // 2.4m 长生成大柜，常把本来可行的 0.7m 填缝柜误判成堵路。
            if(tvBody&&wall.index===tvWallIndex){
              const tvAlong=dot({x:tvEntry.pose.x-wall.a.x,y:tvEntry.pose.y-wall.a.y},wall.dir),horizontal=Math.abs(wall.dir.x)>Math.abs(wall.dir.y),tvRun=horizontal?tvBody.w:tvBody.d;
              const tvStart=tvAlong-tvRun/2,tvEnd=tvAlong+tvRun/2,left=end<=tvStart+.06,right=start>=tvEnd-.06;
              if(left||right){
              const mediaRules=programRules.mediaFlank,width=round(Math.floor(Math.min(mediaRules.maxWidth,available)*10+EPS)/10,1),mediaDepth=clamp(horizontal?tvBody.d:tvBody.w,mediaRules.minDepth,mediaRules.maxDepth);
                if(width>=mediaRules.minWidth){
                  const t=left?end-width/2:start+width/2,wallPoint={x:wall.a.x+wall.dir.x*t,y:wall.a.y+wall.dir.y*t},center={x:wallPoint.x+wall.normal.x*mediaDepth/2,y:wallPoint.y+wall.normal.y*mediaDepth/2};
                  const rect={x:center.x,y:center.y,w:horizontal?width:mediaDepth,d:horizontal?mediaDepth:width,rotation:0};
                  if(rectInsidePolygon(rect,roomScene.polygon)&&!overlapsDoorClearance(rect,roomScene,.025)&&!baseOccupied.some(body=>rectsOverlap(rect,body,-.005))&&!baseHard.some(zone=>rectsOverlap(rect,zone,0)))tvFlanks.push({...rect,wallIndex:wall.index,runWidth:width,available,gapKind:'media-flank',mediaSide:left?'左':'右',score:180+width*12});
                }
              }
            }
            const width=available<=maxWidth+complementRules.closureExtensionMax?round(available,2):round(Math.floor(Math.min(maxWidth,available)*10+EPS)/10,1);if(width<minWidth)continue;
            const slots=available>width+.32?[start+width/2,(start+end)/2,end-width/2]:[(start+end)/2];
            for(const t of slots){
              const wallPoint={x:wall.a.x+wall.dir.x*t,y:wall.a.y+wall.dir.y*t},center={x:wallPoint.x+wall.normal.x*depth/2,y:wallPoint.y+wall.normal.y*depth/2};
              const horizontal=Math.abs(wall.dir.x)>Math.abs(wall.dir.y),rect={x:center.x,y:center.y,w:horizontal?width:depth,d:horizontal?depth:width,rotation:0};
              if(!rectInsidePolygon(rect,roomScene.polygon)||overlapsDoorClearance(rect,roomScene,.025))continue;
              // 收口板本来就要与相邻柜体/电视柜贴合；负 5mm 仅消除“边界相接被
              // 当作碰撞”的数值误判，真实实体重叠仍会被拒绝。
              if(baseOccupied.some(body=>rectsOverlap(rect,body,-.005))||baseHard.some(zone=>rectsOverlap(rect,zone,0)))continue;
              const closurePriority=available<=DESIGN_QUALITY_RULES.wall.severeGapMax?72:available<DESIGN_QUALITY_RULES.wall.usefulBayMin?42:0;
              candidates.push({...rect,wallIndex:wall.index,runWidth:width,available,gapKind:available<DESIGN_QUALITY_RULES.wall.usefulBayMin?'closure':'useful',score:closurePriority+width*12-Math.max(0,available-width)*1.5});
            }
          }
        }
        // 角落/柜间碎缝优先修，但不能让五个 10cm 收口板吃完全部预算。
        // 大客厅最多预留两个碎缝位，其余候选优先覆盖 0.7m 以上的真正空墙。
        const closures=candidates.filter(row=>row.gapKind==='closure').sort((a,b)=>b.score-a.score);
        const useful=candidates.filter(row=>row.gapKind==='useful').sort((a,b)=>b.runWidth-a.runWidth||b.score-a.score);
        const selected=[],append=rows=>{for(const candidate of rows){if(selected.some(row=>rectsOverlap(candidate,row,complementRules.dedupeClearance)))continue;selected.push(candidate);if(selected.length>=target*complementRules.candidateMultiplier)break}};
        // 一整面空墙比十几厘米收口更影响视觉。至少先保留一个 1.2m 以上的
        // 有效墙段候选，再用剩余预算修角落，避免两个小封板耗尽全部补全名额。
        append(tvFlanks.sort((a,b)=>a.mediaSide.localeCompare(b.mediaSide)||b.runWidth-a.runWidth));append(useful.filter(row=>row.runWidth>=complementRules.priorityUsefulWidth).slice(0,1));append(closures.slice(0,Math.min(complementRules.closureReserve,target)));append(useful);append(closures.slice(Math.min(complementRules.closureReserve,target)));
        return selected.map((body,index)=>({kind:'postDisplayCabinet',label:body.gapKind==='media-flank'?`电视墙${body.mediaSide}侧薄柜 ${body.runWidth.toFixed(1)} m`:`${body.runWidth<.6?'定制收口':'定制展示柜'} ${body.runWidth.toFixed(1)} m`,x:body.x,y:body.y,w:body.w,d:body.d,runWidth:body.runWidth,rotation:0,color:body.gapKind==='media-flank'?'#607d75':body.runWidth<.6?'#789087':index?'#71877e':'#5d7f78',layer:'overlay',collision:'post-layout',wallIndex:body.wallIndex,postLayoutBudget:target}));
      };

      // 若 Beam 没有保留硬休闲椅，则用最多 8 个墙角候选做一次收尾；实体背边/侧边
      // 直接落在墙线上，不再使用旧 cornerCandidates 的 0.16m 内缩。
      const synthesizeCornerSeat=(solidComplements=[])=>{
        if(currentProgram!=='bedroom'||roomScene.area<12.5||first('lounge')||first('bedroomLoveseat'))return null;
        const loveseat=roomScene.area>=18,dims=loveseat?[1.10,.68]:[.64,.64],blocked=[...baseOccupied,...solidComplements.map(row=>({x:row.x,y:row.y,w:row.w,d:row.d}))];
        const variants=[[dims[0],dims[1]],[dims[1],dims[0]]],corners=[[0,0],[roomScene.width,0],[0,roomScene.depth],[roomScene.width,roomScene.depth]],candidates=[];
        for(const [w,d] of variants)for(const [cx,cy] of corners){
          const rect={x:cx===0?w/2:roomScene.width-w/2,y:cy===0?d/2:roomScene.depth-d/2,w,d,rotation:0};
          if(!rectInsidePolygon(rect,roomScene.polygon)||overlapsDoorClearance(rect,roomScene,.10))continue;
          if(blocked.some(body=>rectsOverlap(rect,body,.04))||baseHard.some(zone=>rectsOverlap(rect,zone,.02)))continue;
          candidates.push({...rect,score:dist(rect,roomScene.door.entry)+Math.min(rect.x,roomScene.width-rect.x,rect.y,roomScene.depth-rect.y)*.1});
        }
        candidates.sort((a,b)=>b.score-a.score);const best=candidates[0];
        return best?{kind:loveseat?'activityLoveseat':'activityChair',label:loveseat?'贴墙单人沙发':'贴墙休闲椅',x:best.x,y:best.y,w:best.w,d:best.d,rotation:0,color:'#6b9888',layer:'overlay',collision:'post-layout'}:null;
      };

      // “活动区”是最终剩余空间的解释层。大房间可生成多块，但数量固定封顶；
      // 每选中一块就加入阻挡集合，后续活动区不会互相重叠。
      const synthesizeActivityZones=(solidComplements=[])=>{
        if(roomScene.area<7.5)return [];
        const hasSemanticSeating=currentProgram==='bedroom'?(!!first('bedroomLoveseat')||!!first('lounge')):(!!first('sofa')||all('arm').length>0);
        const target=currentProgram==='bedroom'?(hasSemanticSeating?1:roomScene.area>=30?2:roomScene.area>=18?2:1):(roomScene.area>=26?1:0);
        if(!target)return [];
        const occupied=[...baseOccupied,...solidComplements.map(row=>({x:row.x,y:row.y,w:row.w,d:row.d}))],hard=[...baseHard],selected=[];
        const sizes=roomScene.area>=28?[[2.5,1.9],[2.2,1.7],[2.0,1.6],[1.8,1.4],[1.5,1.2],[1.0,.9]]:roomScene.area>=18?[[2.1,1.6],[1.8,1.4],[1.6,1.3],[1.3,1.1],[1.0,.9]]:[[1.5,1.2],[1.3,1.1],[1.15,1.0],[1.0,.9],[.9,.8],[.8,.8]];
        const center={x:roomScene.width/2,y:roomScene.depth/2};
        for(let zoneIndex=0;zoneIndex<target;zoneIndex++){
          let best=null;
          for(const [w0,d0] of sizes){
            for(const [w,d] of [[w0,d0],[d0,w0]]){
              for(let y=d/2+.08;y<=roomScene.depth-d/2-.08+EPS;y+=.14){
                for(let x=w/2+.08;x<=roomScene.width-w/2-.08+EPS;x+=.14){
                  const rect={x,y,w,d,rotation:0};
                  if(!rectInsidePolygon(rect,roomScene.polygon)||overlapsDoorClearance(rect,roomScene,.04))continue;
                  if(occupied.some(body=>rectsOverlap(rect,body,.08))||hard.some(zone=>rectsOverlap(rect,zone,.02)))continue;
                  const edge=Math.min(x-w/2,roomScene.width-x-w/2,y-d/2,roomScene.depth-y-d/2);
                  const score=w*d-Math.hypot(x-center.x,y-center.y)*.07+Math.min(.35,edge)*.10-zoneIndex*.05;
                  if(!best||score>best.score)best={...rect,score};
                }
              }
            }
            if(best&&best.w*best.d>=1.35)break;
          }
          if(!best||best.w*best.d<.62)break;
          const row={kind:'activityZone',label:target>1?`活动区 ${zoneIndex+1}`:'活动区',x:best.x,y:best.y,w:best.w,d:best.d,rotation:0,color:'#2f8a78',layer:'floor',collision:'ignore'};
          selected.push(row);occupied.push({x:row.x,y:row.y,w:row.w,d:row.d});
        }
        return selected;
      };
      // 当前阶段只输出直接落在地面的软装。地毯是最底层衬底，不参与碰撞、通行占用或 Beam 落子。
      const floorRule=LAYOUT_CONSTRAINTS.postLayout.floorOnly===true?(FLOOR_SURFACE_RULES[currentProgram]||[]).find(rule=>(rule.preferences?.defaultCount??rule.quantity?.min??1)>0&&roomScene.area+EPS>=Number(rule.surface?.minArea||0)&&roomScene.area-EPS<=Number(rule.surface?.maxArea??Infinity)):null;
      if(floorRule){const anchor=first(floorRule.surface?.relativeTo||(currentProgram==='bedroom'?'bed':'sofa')),body=bodyOf(anchor),padding=floorRule.surface?.padding||{},normal=anchor?.pose?.normal||{x:0,y:1};if(body){const side=Math.max(0,Number(padding.side)||0),front=Math.max(0,Number(padding.front)||0),back=Math.max(0,Number(padding.back)||0),normalHorizontal=Math.abs(normal.x)>.5,desiredW=Math.max(body.w+(normalHorizontal?front+back:side*2),Number(floorRule.geometry?.width)||0),desiredD=Math.max(body.d+(normalHorizontal?side*2:front+back),Number(floorRule.geometry?.depth)||0),w=Math.min(roomScene.width-.16,desiredW),d=Math.min(roomScene.depth-.16,desiredD),shift=(front-back)/2,x=Math.min(roomScene.width-w/2-.08,Math.max(w/2+.08,body.x+normal.x*shift)),y=Math.min(roomScene.depth-d/2-.08,Math.max(d/2+.08,body.y+normal.y*shift));add('rug',floorRule.label||'地毯',body,{x,y,w,d,color:floorRule.color||'#c9ad78',layer:'floor',collision:'ignore'})}}
      const wallComplements=synthesizeWallComplements();decor.push(...wallComplements);
      // 当前阶段只保留直接落地的实体/地面层：地毯与最终补柜。床品、抱枕、
      // 台灯、桌面绿植、挂画、搁板、窗帘等非落地陈设全部退出生成与计数。
      return decor;
    }

    function validatePostLayoutDecor(plan,scene,decor){
      const baseline=plan.evaluation.diagnostics.ground,baselineWall=plan.evaluation.diagnostics.wallDetails,coverage=stateCoverageAndActivation(plan,scene),accepted=[],solids=[],wallSolids=[],storage=wallStorageMetrics(plan,scene);
      let currentGround=baseline,currentWall=baselineWall,currentReach=plan.evaluation.reach,acceptedPostLayout=0;
      const postRejectSummary={budget:0,flow:0,ground:0,wall:0},postRejected=[];
      for(const row of decor){
        if(row.collision!=='post-layout'){accepted.push(row);continue;}
        if(acceptedPostLayout>=Math.max(1,Number(row.postLayoutBudget)||1)){postRejectSummary.budget++;postRejected.push({label:row.label,wallIndex:row.wallIndex,reason:'budget'});continue;}
        const rect={x:row.x,y:row.y,w:row.w,d:row.d,rotation:row.rotation||0};
        // 定制柜也是落地实体，不能在 Beam 结束后偷偷堵住 0.50m 通路或造出孤岛。
        const candidateReach=computeReachability(plan,scene,[FLOW_RADII[0]],[...solids,rect]);
        const progressiveRepair=LAYOUT_CONSTRAINTS.postLayout.wallComplements.allowProgressiveIslandRepair&&candidateReach.hardReachableRatio===1&&
          candidateReach.unreachableArea+LAYOUT_CONSTRAINTS.postLayout.wallComplements.minIslandImprovement<=(currentReach?.unreachableArea??Infinity)+EPS;
        if(!candidateReach.hardPass&&!progressiveRepair){postRejectSummary.flow++;postRejected.push({label:row.label,wallIndex:row.wallIndex,reason:'flow',islandArea:round(candidateReach.unreachableArea,3)});continue;}
        const candidateGround=groundPlaneMetrics(plan,scene,coverage,DESIGN_QUALITY_RULES.floor.gridStep,[...solids,rect]);
        const closureModule=Number(row.runWidth)>0&&Number(row.runWidth)<.6;
        // 十几厘米的收口板与相邻柜体/墙形成同一实体。粗地面栅格会把它误计成
        // 新障碍并触发 narrow severe；只要精确 0.50m 水漫仍通过且地面分下降
        // 不超过 8 分，就允许它消除更严重的墙缝。
        const groundTolerance=closureModule?.08:.04;
        if((candidateGround.severe&&!closureModule)||candidateGround.score+groundTolerance<(currentGround?.score??0)){postRejectSummary.ground++;postRejected.push({label:row.label,wallIndex:row.wallIndex,reason:'ground'});continue;}
        const nextWallRows=row.kind==='postDisplayCabinet'?[...wallSolids,row]:wallSolids;
        const candidateWall=wallPlaneMetrics(plan,scene,storage,nextWallRows);
        const priorSevere=currentWall?.severeGaps||0;
        const wallCoverageImproved=(currentWall?.unusedWallRatio??1)-candidateWall.unusedWallRatio>=LAYOUT_CONSTRAINTS.postLayout.wallComplements.minUnusedWallImprovement;
        const wallScoreDropped=candidateWall.score+LAYOUT_CONSTRAINTS.postLayout.wallComplements.maxWallScoreDrop<(currentWall?.score??0);
        if(candidateWall.severeGaps>priorSevere||wallScoreDropped||(!wallCoverageImproved&&candidateWall.score<(currentWall?.score??0)-EPS)){postRejectSummary.wall++;postRejected.push({label:row.label,wallIndex:row.wallIndex,reason:'wall',beforeUnused:round(currentWall?.unusedWallRatio||0,3),afterUnused:round(candidateWall.unusedWallRatio,3),beforeSevere:priorSevere,afterSevere:candidateWall.severeGaps,gaps:candidateWall.gapDetails});continue;}
        solids.push(rect);acceptedPostLayout++;if(row.kind==='postDisplayCabinet')wallSolids.push(row);accepted.push(row);currentGround=candidateGround;currentWall=candidateWall;currentReach=candidateReach;
      }
      const wall=currentWall||baselineWall;
      const finalReach=computeReachability(plan,scene,FLOW_RADII,solids);
      const scores=plan.evaluation.scores;scores.ground=Math.round((currentGround||baseline).score*100);scores.storage=Math.round(wall.score*100);
      const weights=DESIGN_QUALITY_RULES.weights;
      let total=scores.function*weights.function+scores.ground*weights.ground+scores.storage*weights.wall+scores.relation*weights.relation+scores.circulation*weights.circulation;
      const severe=(currentGround||baseline).severe||wall.severe;
      if(severe)total=Math.min(total,DESIGN_QUALITY_RULES.gates.severeDefectCap);
      total=Math.min(total,scores.function+14,scores.circulation+14,scores.relation+12,scores.storage+15,scores.ground+15,scores.comfort+18);
      plan.evaluation.total=round(total,1);
      plan.evaluation.reach=finalReach;
      // 墙面补全会改变最终的地面/墙面结果，必须按最终现场重新过一遍质量门槛。
      // 不能和补全前的 qualityPass 做 AND，否则已经消除的墙缝仍会永久留下失败状态。
      const diagnostics=plan.evaluation.diagnostics,quality=LAYOUT_CONSTRAINTS.qualityPass;
      // 末轮补柜之后才对“大面积可用空墙”做硬验收。搜索前若直接卡这个指标，
      // 会把本来能由定制柜修好的骨架提前淘汰；最终仍超过 46% 或空墙分低于 12，
      // 则不能再由对象分数抵消。
      const largeWall=quality.largeRoomWall;
      const largeRoomWallCoherent=!(currentProgram==='living'&&scene.area>=largeWall.minArea&&scene.area<=largeWall.maxArea&&
        (wall.unusedWallRatio>largeWall.maxUnusedWallRatio||wall.emptyWallScore<largeWall.minEmptyWallScore));
      const finalLargestEmptyWallBay=Math.max(0,...(wall.gapDetails||[]).filter(row=>row.severity==='useful'||row.severity==='architectural').map(row=>Number(row.width)||0));
      const finalBedroomWallCoherent=diagnostics.longBedroomWallRequired!==true||finalLargestEmptyWallBay<=quality.longBedroomWall.maxEmptyBay;
      const largeGround=quality.largeRoomGround;
      const finalLargeRoomGroundCoherent=!(currentProgram==='living'&&scene.area>=largeGround.minArea&&scene.area<=largeGround.maxArea&&
        (currentGround||baseline).largestVoidRatio>largeGround.maxLargestVoidRatio);
      const finalDensityCoherent=Object.keys(plan.poses||{}).length+(LAYOUT_CONSTRAINTS.postLayout.wallComplements.countTowardRichMinimum?acceptedPostLayout:0)>=(diagnostics.richMinimum||0);
      plan.evaluation.qualityPass=scores.feasible===100&&diagnostics.diningCoherent!==false&&diagnostics.guestSeatingCoherent!==false&&diagnostics.focusChallengeCoherent!==false&&finalDensityCoherent&&finalLargeRoomGroundCoherent&&largeRoomWallCoherent&&finalBedroomWallCoherent&&finalReach.hardPass&&!severe&&
        scores.modules>=(diagnostics.requiredModuleScore||0)&&scores.circulation>=quality.minimumScores.circulation&&scores.relation>=quality.minimumScores.relation&&scores.composition>=quality.minimumScores.composition&&
        scores.storage>=DESIGN_QUALITY_RULES.gates.minWall&&scores.ground>=DESIGN_QUALITY_RULES.gates.minGround&&scores.comfort>=quality.minimumScores.comfort&&scores.preference>=quality.minimumScores.preference;
      plan.evaluation.diagnostics={...plan.evaluation.diagnostics,densityCoherent:finalDensityCoherent,ground:currentGround||baseline,wallDetails:wall,largeRoomGroundCoherent:finalLargeRoomGroundCoherent,largeRoomWallCoherent,largestEmptyWallBay:finalLargestEmptyWallBay,bedroomWallCoherent:finalBedroomWallCoherent,severeFieldDefect:severe,postLayoutValidation:{
        baselineGroundScore:round((baseline?.score||0)*100,1),baselineGroundSevere:Boolean(baseline?.severe),
        baselineWallScore:round((baselineWall?.score||0)*100,1),baselineWallSevere:Boolean(baselineWall?.severe),
        acceptedSolids:solids.length,rejectedSolids:decor.filter(row=>row.collision==='post-layout').length-solids.length,
        rejectSummary:postRejectSummary,rejectedDetails:postRejected,hardPass:finalReach.hardPass,islandArea:finalReach.unreachableArea
      }};
      return accepted;
    }

    // 户型选择器与离线回归共用同一套识别结果解析，避免页面能选择的房间
    // 没有被测试脚本覆盖。该段必须位于无 DOM 的引擎提前返回之前。
    const ROOM_TYPE_LABELS={living_room:'客厅',bedroom:'卧室',kitchen:'厨房',bathroom:'卫生间',office:'办公室',closet:'衣帽间',balcony:'阳台',corridor:'走廊',dining_room:'餐厅',pipe:'管井',elevator_room:'电梯间'};
    const SUPPORTED_ROOM_PROGRAM={living_room:'living',bedroom:'bedroom'};
    const pointLike=value=>Array.isArray(value)?value.length>=2&&Number.isFinite(Number(value[0]))&&Number.isFinite(Number(value[1])):value&&Number.isFinite(Number(value.x))&&Number.isFinite(Number(value.y));
    const directRing=value=>{
      let ring=value;
      while(Array.isArray(ring)&&ring.length===1&&Array.isArray(ring[0]))ring=ring[0];
      return Array.isArray(ring)&&ring.length>=3&&ring.slice(0,Math.min(3,ring.length)).every(pointLike)?ring:null;
    };
    function roomPolygon(value) {
      if (!value) return null;
      const preferred=['polygon','room_polygon','points','contour','contour_points','outline','vertices','boundary'];
      if (typeof value==='object'&&!Array.isArray(value)) for(const key of preferred){const ring=directRing(value[key]);if(ring)return ring;}
      return directRing(value);
    }
    function collectRecognizedRooms(roomData) {
      const rooms=[];
      const visit=(value,inheritedType='')=>{
        if(value==null)return;
        if(Array.isArray(value)){
          const tupleType=String(value[0]||'').toLowerCase(),tupleRing=directRing(value[1]);
          if(ROOM_TYPE_LABELS[tupleType]&&tupleRing){rooms.push({type:tupleType,rawPolygon:tupleRing,source:{rawArea:Number(value[2])||0,centroid:value[3]}});return;}
          const ring=directRing(value);
          if(ring&&inheritedType){rooms.push({type:inheritedType,rawPolygon:ring,source:{}});return;}
          value.forEach(row=>visit(row,inheritedType));return;
        }
        if(typeof value!=='object')return;
        const type=String(value.room_type||value.roomType||value.type||value.category||inheritedType||'').toLowerCase();
        const polygon=roomPolygon(value);
        if(type&&ROOM_TYPE_LABELS[type]&&polygon){rooms.push({type,rawPolygon:polygon,source:value});return;}
        if(type&&ROOM_TYPE_LABELS[type]&&!polygon&&Object.keys(value).length<8)rooms.push({type,rawPolygon:null,source:value});
        Object.entries(value).forEach(([key,child])=>{
          if(['polygon','room_polygon','points','contour','contour_points','outline','vertices','boundary'].includes(key))return;
          visit(child,ROOM_TYPE_LABELS[key]?key:type||inheritedType);
        });
      };
      visit(roomData);
      const seen=new Set();return rooms.filter(room=>{const key=`${room.type}:${JSON.stringify(room.rawPolygon||[])}`;if(seen.has(key))return false;seen.add(key);return true;});
    }
    function prepareRecognizedRooms(payload,inputArea) {
      const root=payload?.data||payload||{};
      const rooms=collectRecognizedRooms(root.room_data??root.rooms??root);
      const entranceIndexes=new Set((Array.isArray(root.enter_door_index_list)?root.enter_door_index_list:[]).map(Number));
      const rawOpenings=(Array.isArray(root.close_data)?root.close_data:[]).map((row,sourceIndex)=>{
        const points=Array.isArray(row?.[1])?row[1].filter(pointLike).map(point=>Array.isArray(point)?{x:Number(point[0]),y:Number(point[1])}:{x:Number(point.x),y:Number(point.y)}):[];
        return {type:String(row?.[0]||''),points,sourceIndex,isEntrance:entranceIndexes.has(sourceIndex)};
      }).filter(opening=>opening.points.length>=2);
      const pixelRooms=rooms.filter(room=>room.rawPolygon).map(room=>{
        const points=room.rawPolygon.map(point=>Array.isArray(point)?{x:Number(point[0]),y:Number(point[1])}:{x:Number(point.x),y:Number(point.y)});
        const xs=points.map(p=>p.x),ys=points.map(p=>p.y),span=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
        return {room,points,span,rawArea:polygonArea(points)};
      });
      const rawPixelArea=pixelRooms.filter(row=>row.span>20).reduce((sum,row)=>sum+row.rawArea,0);
      const apiScale=Number(root.scale_rate);
      const sharedScale=Number.isFinite(apiScale)&&apiScale>0?apiScale:(rawPixelArea>0&&inputArea>0?Math.sqrt(inputArea/rawPixelArea):1);
      return rooms.map(room=>{
        const row=pixelRooms.find(item=>item.room===room);if(!row)return {...room,polygon:null};
        const scale=row.span<=20?1:sharedScale;
        const rawMinX=Math.min(...row.points.map(p=>p.x)),rawMinY=Math.min(...row.points.map(p=>p.y));
        const scaled=row.points.map(point=>({x:point.x*scale,y:point.y*scale}));
        const minX=Math.min(...scaled.map(p=>p.x)),minY=Math.min(...scaled.map(p=>p.y));
        const polygon=scaled.map(point=>({x:round(point.x-minX,4),y:round(point.y-minY,4)}));
        if(polygon.length>3&&dist(polygon[0],polygon[polygon.length-1])<1e-5)polygon.pop();
        if(polygonSignedArea(polygon)<0)polygon.reverse();
        const width=Math.max(...polygon.map(p=>p.x)),depth=Math.max(...polygon.map(p=>p.y));
        const rawEdges=row.points.map((a,index)=>({a,b:row.points[(index+1)%row.points.length]}));
        const openings=rawOpenings.filter(opening=>opening.points.slice(0,2).every(point=>Math.min(...rawEdges.map(edge=>pointSegmentDistance(point,edge.a,edge.b)))<=2.5))
          .map(opening=>({...opening,rawPoints:opening.points.slice(0,2).map(point=>({...point})),points:opening.points.slice(0,2).map(point=>({x:round((point.x-rawMinX)*scale,4),y:round((point.y-rawMinY)*scale,4)}))}));
        return {...room,polygon,openings,width,depth,area:polygonArea(polygon)};
      });
    }

    const Engine = { PROGRAMS, CONFIGS, SOFA_PRESETS, INVENTORY_VALUES, INVENTORY_OBJECTIVES, roomAreaTier, VARIABLE_SIZE_PRESETS, FURNITURE_RULES, getDesignGrammar:()=>JSON.parse(JSON.stringify(DESIGN_GRAMMAR)), applyFurnitureCatalog, applyDesignQualityRules, applyLayoutConstraints, applyGlobalConfig, validateLayoutConstraints, getDesignQualityRules:()=>JSON.parse(JSON.stringify(DESIGN_QUALITY_RULES)),getLayoutConstraints:()=>JSON.parse(JSON.stringify(LAYOUT_CONSTRAINTS)),getFlowRadii:()=>JSON.parse(JSON.stringify(FLOW_RADII)),getRoomAreaModules:()=>JSON.parse(JSON.stringify(ROOM_AREA_MODULES)), setProgram, refreshFurniture, setVariableSizeSearch, setLayoutDensityMode, setCustomCabinetEnabled, applyProgramSnapshot, autoSelectInventory, generateInventoryFrontier, stagedInventoryCandidates, inventoryEstimate, synthesizeSoftDecor, getFurniture:()=>FURNITURE, makeScene, search, searchMatrix, searchScalar, evaluateFull, traceEvaluationBreakdown, computeReachability, designMetrics, generateCandidates, validateState, isLegal, wallPoseCandidates, functionalZones, footprintRects, polygonArea, pointInPolygon, prepareRecognizedRooms,
      setRecognizedRoomOverrideForTest:value=>{recognizedRoomOverride=value}
    };
    globalThis.RoomChessEngine = Engine;

    if (typeof document === 'undefined') return;

    const canvas=document.getElementById('board');
    const ctx=canvas.getContext('2d');
    const beamCanvas=document.getElementById('beamTreeCanvas');
    const beamCtx=beamCanvas.getContext('2d');
    const ui={
      appShell:document.querySelector('.app-shell'),layoutView:document.getElementById('layoutViewBtn'),treeView:document.getElementById('treeViewBtn'),
      width:document.getElementById('roomWidth'), depth:document.getElementById('roomDepth'),
      multiplier:document.getElementById('areaMultiplier'), multiplierOutput:document.getElementById('areaMultiplierOutput'),liveRoomArea:document.getElementById('liveRoomArea'),
      generate:document.getElementById('generateBtn'), reset:document.getElementById('resetBtn'),lSofaDemo:document.getElementById('lSofaDemoBtn'),
      recognizeFloorplan:document.getElementById('recognizeFloorplanBtn'),recognitionModal:document.getElementById('recognitionModal'),
      closeRecognition:document.getElementById('closeRecognitionBtn'),floorplanFile:document.getElementById('floorplanFile'),floorplanArea:document.getElementById('floorplanArea'),
      runRecognition:document.getElementById('runRecognitionBtn'),recognitionStatus:document.getElementById('recognitionStatus'),recognizedRooms:document.getElementById('recognizedRooms'),
      floorplanPreview:document.getElementById('floorplanPreview'),floorplanPreviewEmpty:document.getElementById('floorplanPreviewEmpty'),
      recognizedSizeEditor:document.getElementById('recognizedSizeEditor'),recognizedSizeTitle:document.getElementById('recognizedSizeTitle'),
      recognizedTestWidth:document.getElementById('recognizedTestWidth'),recognizedTestDepth:document.getElementById('recognizedTestDepth'),
      recognizedSizeReset:document.getElementById('recognizedSizeReset'),recognizedSizeApply:document.getElementById('recognizedSizeApply'),
      envelope:document.getElementById('showEnvelope'), anchors:document.getElementById('showAnchors'), stepCandidates:document.getElementById('showStepCandidates'),bitset:document.getElementById('showBitset'),
      boardStatus:document.getElementById('boardStatus'), roomArea:document.getElementById('roomAreaLabel'),
      candidateBadge:document.getElementById('candidateBadge'),
      appTitle:document.getElementById('appTitle'), legend:document.getElementById('legend'), furnitureKicker:document.getElementById('furnitureKicker'),
      autoInventory:document.getElementById('autoInventory'),
      customCabinet:document.getElementById('customCabinetEnabled'),
      exportConfig:document.getElementById('exportConfigBtn'),importConfig:document.getElementById('importConfigBtn'),resetConfig:document.getElementById('resetConfigBtn'),
      importConfigFile:document.getElementById('importConfigFile'),configSaveStatus:document.getElementById('configSaveStatus'),
      nodes:document.getElementById('metricNodes'), time:document.getElementById('metricTime'),
      us:document.getElementById('metricUs'), depthMetric:document.getElementById('metricDepth'), score:document.getElementById('metricScore'),
      furnitureConfig:document.getElementById('furnitureConfig'), furnitureList:document.getElementById('furnitureList'), scoreList:document.getElementById('scoreList'),
      traceKicker:document.getElementById('traceKicker'), traceStatus:document.getElementById('traceStatus'), traceLog:document.getElementById('traceLog'),
      prev:document.getElementById('prevBtn'), next:document.getElementById('nextBtn'), play:document.getElementById('playBtn'),
      traceRange:document.getElementById('traceRange'), traceRangeOutput:document.getElementById('traceRangeOutput'),
      solutionStrip:document.getElementById('solutionStrip'),solutionPreviewToolbar:document.getElementById('solutionPreviewToolbar'),configComparisonSwitch:document.getElementById('configComparisonSwitch'),
      beamSummary:document.getElementById('beamSummary'),beamRound:document.getElementById('beamRoundRange'),beamRoundOutput:document.getElementById('beamRoundOutput'),
      beamFilters:document.getElementById('beamFilters'),beamEmpty:document.getElementById('beamEmpty'),beamDetail:document.getElementById('beamDetail'),
      beamBoardMode:document.getElementById('beamBoardMode'),beamOverviewMode:document.getElementById('beamOverviewMode'),beamExpandAll:document.getElementById('beamExpandAll'),beamFocusBest:document.getElementById('beamFocusBest'),beamResetView:document.getElementById('beamResetView'),beamFullscreen:document.getElementById('beamFullscreen'),beamPanel:document.querySelector('.beam-panel'),beamPlanSwitch:document.getElementById('beamPlanSwitch')
    };
    const cloneConfig=value=>JSON.parse(JSON.stringify(value));
    function normalizeConfigBundle(raw) {
      if(!raw||typeof raw!=='object')throw new Error('配置文件不是有效对象');
      if(raw.schema&&raw.schema!=='room-chess-config')throw new Error('不是空间棋配置文件');
      const source=raw.programs||raw.configs||raw,programs=cloneConfig(DEFAULT_CONFIGS);
      for(const programId of Object.keys(PROGRAMS)){
        const incoming=source[programId];if(!incoming||typeof incoming!=='object')continue;
        for(const type of PROGRAMS[programId].types){
          const dims=incoming.dimensions?.[type.id];
          if(dims){
            const w=Number(dims.w),d=Number(dims.d);
            if(Number.isFinite(w))programs[programId].dimensions[type.id].w=clamp(w,.3,4.2);
            if(Number.isFinite(d))programs[programId].dimensions[type.id].d=clamp(d,.25,3.2);
          }
          const count=Number(incoming.counts?.[type.id]);
          if(Number.isFinite(count))programs[programId].counts[type.id]=clamp(Math.round(count),type.minCount,type.maxCount);
        }
        if(programId==='living'&&incoming.sofaPreset)programs.living.sofaPreset=configuredSofaVariant(incoming.sofaPreset).id;
      }
      const preferences={autoInventory:raw.preferences?.autoInventory!==false,variableSizeSearch:raw.preferences?.variableSizeSearch!==false,layoutDensityMode:'rich',customCabinetEnabled:raw.preferences?.customCabinetEnabled!==false};
      return {schema:'room-chess-config',version:1,programs,preferences};
    }
    function replaceRuntimeConfig(bundle) {
      for(const programId of Object.keys(PROGRAMS)){
        CONFIGS[programId].dimensions=cloneConfig(bundle.programs[programId].dimensions);
        CONFIGS[programId].counts=cloneConfig(bundle.programs[programId].counts);
        if(programId==='living')CONFIGS.living.sofaPreset=bundle.programs.living.sofaPreset;
      }
      ui.autoInventory.checked=bundle.preferences.autoInventory;
      variableSizeSearch=bundle.preferences.variableSizeSearch;
      layoutDensityMode='rich';
      customCabinetEnabled=bundle.preferences.customCabinetEnabled!==false;ui.customCabinet.checked=customCabinetEnabled;
      document.querySelectorAll('.density-tab').forEach(button=>button.classList.toggle('active',button.dataset.density===layoutDensityMode));
      refreshFurniture();
    }
    function currentConfigBundle() {
      return {schema:'room-chess-config',version:1,exportedAt:new Date().toISOString(),programs:cloneConfig(CONFIGS),preferences:{autoInventory:ui.autoInventory.checked,variableSizeSearch,layoutDensityMode,customCabinetEnabled}};
    }
    function saveConfigToBrowser(message='配置已自动保存到当前浏览器') {
      if(!ENABLE_LOCAL_CONFIG_PERSISTENCE){ui.configSaveStatus.textContent='无本地保存模式：配置仅在本次页面有效，刷新恢复默认';return;}
      try{localStorage.setItem(LOCAL_CONFIG_KEY,JSON.stringify(currentConfigBundle()));ui.configSaveStatus.textContent=message;}
      catch(error){ui.configSaveStatus.textContent=`本地保存失败：${error.message}`;}
    }
    function applyUserConfig(raw,{persist=true,autoSearch=true}={}) {
      const bundle=normalizeConfigBundle(raw);replaceRuntimeConfig(bundle);
      if(persist)saveConfigToBrowser('配置已加载并保存到当前浏览器');
      setupStaticUI();compileCurrentScene(autoSearch);return bundle;
    }
    if(ENABLE_LOCAL_CONFIG_PERSISTENCE){
      try{
        const stored=localStorage.getItem(LOCAL_CONFIG_KEY);
        if(stored){replaceRuntimeConfig(normalizeConfigBundle(JSON.parse(stored)));ui.configSaveStatus.textContent='已载入当前浏览器保存的配置';}
      }catch(error){ui.configSaveStatus.textContent=`本地配置无效，已使用默认配置：${error.message}`;replaceRuntimeConfig(normalizeConfigBundle({programs:DEFAULT_CONFIGS}));}
      window.addEventListener('storage',event=>{if(event.key===FURNITURE_CATALOG_KEY)location.reload();});
    }else{
      ui.configSaveStatus.textContent='无本地保存模式：已忽略浏览器旧配置';
    }
    let shape='rect';
    // 配置尚未从 FastAPI 读到之前不编译场景，避免任何代码内置约束参与启动。
    let scene=null;
    let result=null;
    let activeState={poses:{}};
    let activeSolution=0;
    let traceIndex=0;
    let playing=false;
    let playTimer=null;
    let searchDebounce=null;
    let candidateSnapshotCache={key:null,value:null};
    let beamRoundIndex=1;
    let beamFilter='all';
    let beamHitTargets=[];
    let treeInspectNodeId=null;
    let beamVisualMode='board';
    let beamExpansionMode='all';
    let beamExpandedNodes=new Set(['n0']);
    let beamFocusPath=new Set(['n0']);
    let beamOutputPath=new Set();
    let beamBranchOffsets=new Map();
    let beamViewport={x:46,y:56,scale:1};
    let beamDrag=null;
    let beamSuppressClick=false;
    let beamNeedsCenter=true;
    let lSofaDemoPending=false;
    let configRunMode='current',activeConfigProfile='current',comparisonRuns={};

    function activateSolutionInventory(solution) {
      if (!solution?.inventoryConfig) return;
      applyProgramSnapshot(currentProgram,solution.inventoryConfig);
    }

    function activePlanTrace() {
      const solution=result?.solutions?.[activeSolution];
      if (!solution) return result?.trace||[{poses:{},depth:0,lastMove:null}];
      const itemIds=(solution.inventoryItems||FURNITURE).map(item=>item.id).filter(id=>solution.poses[id]);
      const traceKey=itemIds.map(id=>`${id}:${poseIdentity(solution.poses[id])}`).join('|');
      if (solution._displayTrace?.key===traceKey) return solution._displayTrace.trace;
      const searchTrace=solution.planTrace||result?.trace||[],tree=solution.planBeamTree||result?.beamTree;
      const pathByItem=new Map();
      if(tree?.nodeById&&solution._treeId){
        let node=tree.nodeById.get(solution._treeId),guard=0;
        while(node&&node.id!=='n0'&&guard++<FURNITURE.length+3){pathByItem.set(node.itemId,node);node=tree.nodeById.get(node.parentId)}
      }
      const poses={},trace=[{poses:{},partialScore:0,lastMove:null,depth:0,beamSize:1}];
      itemIds.forEach((id,index)=>{
        const item=ITEM_BY_ID[id],pose=solution.poses[id],treeNode=pathByItem.get(id);poses[id]=pose;
        // 可选家具的搜索轨迹可能记录 skip 分支；skip 只有 `{skip:true}`，没有坐标，
        // 不能拿它和最终真实落子做 poseIdentity 比较。
        const fallback=searchTrace.find(row=>row.lastMove?.itemId===id&&!row.lastMove?.pose?.skip&&poseIdentity(row.lastMove.pose)===poseIdentity(pose));
        const merit=Number(treeNode?.merit??fallback?.lastMove?.merit??candidateStaticScore(item,pose,{poses:Object.fromEntries(Object.entries(poses).filter(([key])=>key!==id))},scene))||0;
        trace.push({poses:{...poses},partialScore:Number(treeNode?.score??fallback?.partialScore??0)||0,lastMove:{itemId:id,pose,merit},depth:index+1,beamSize:searchTrace[index+1]?.beamSize||0});
      });
      solution._displayTrace={key:traceKey,trace};return trace;
    }

    function activeBeamTree() {
      return result?.solutions?.[activeSolution]?.planBeamTree||result?.beamTree||null;
    }

    function traceCandidateSnapshot() {
      if (!result||!FURNITURE.length||treeInspectNodeId) return null;
      const trace=activePlanTrace();
      const current=trace[clamp(traceIndex,0,trace.length-1)]||trace[0];
      if (traceIndex>=trace.length-1) return null;
      const next=trace[traceIndex+1],item=ITEM_BY_ID[next.lastMove.itemId]||FURNITURE[traceIndex];
      const parentState={poses:{...(activeState.poses||current.poses)}};
      const selected=next.poses?.[item.id]||next.lastMove.pose;
      if (!item) return null;
      const cacheKey=`${currentProgram}:${activeSolution}:${traceIndex}:${item.id}:${stateHash(parentState)}`;
      if (candidateSnapshotCache.key===cacheKey) return candidateSnapshotCache.value;
      const seen=new Set(),raw=[];
      for (const pose of rawCandidatesForItem(item,parentState,scene)) {
        const key=poseKey(item,pose);if(seen.has(key))continue;seen.add(key);raw.push(pose);
      }
      const legal=[],rejected=[],rejectSummary={outside:0,door:0,static:0,collision:0,functional:0};
      for (const pose of raw) {
        const check=legalityCheck(item,pose,parentState,scene);
        if (check.legal) legal.push({pose,merit:candidateStaticScore(item,pose,parentState,scene)});
        else {rejected.push({pose,reason:check.reason,label:check.label});rejectSummary[check.reason]=(rejectSummary[check.reason]||0)+1;}
      }
      legal.sort((a,b)=>b.merit-a.merit);
      const retained=legal.slice(0,72),retainedKeys=new Set(retained.map(row=>poseKey(item,row.pose)));
      const legalDeferred=legal.filter(row=>!retainedKeys.has(poseKey(item,row.pose)));
      const value={item,parentState,selected,rawCount:raw.length,legal,retained,legalDeferred,rejected,rejectSummary};
      candidateSnapshotCache={key:cacheKey,value};return value;
    }

    function candidateSource(pose) {
      const relation=String(pose?.relation||'');
      if (relation.includes('corner')) return 'corner';
      if (pose?.anchor==='relation') return 'relation';
      if (pose?.anchor==='zone') return 'zone';
      if (pose?.anchor==='wall'||Number.isInteger(pose?.wallIndex)) return 'wall';
      return relation ? 'relation' : 'zone';
    }

    function candidateSourceLabel(pose) {
      return ({wall:'沿墙采样',relation:'家具关系采样',zone:'功能区采样',corner:'角落采样'})[candidateSource(pose)];
    }

    function updateCandidateBadge(snapshot=traceCandidateSnapshot()) {
      if (!ui.stepCandidates.checked) {ui.candidateBadge.hidden=true;return;}
      ui.candidateBadge.hidden=false;
      if (!snapshot) {ui.candidateBadge.textContent=result&&traceIndex>=activePlanTrace().length-1?'全部家具已落下 · 向左拖动步骤轴回看采样点':'等待生成下一手采样点';return;}
      const phase=`当前已放 ${traceIndex} 件 · 下一手`;
      const source=[...new Set(snapshot.retained.map(row=>candidateSourceLabel(row.pose)))].join('、')||'规则生成';
      const specs=[...new Set(snapshot.retained.map(row=>row.pose.sizeLabel).filter(Boolean))].join(' / ');
      const r=snapshot.rejectSummary||{},reasons=[r.outside&&`越界 ${r.outside}`,r.door&&`挡门 ${r.door}`,r.static&&`门窗/静态 ${r.static}`,r.collision&&`家具碰撞 ${r.collision}`,r.functional&&`功能区 ${r.functional}`].filter(Boolean).join('、')||'无';
      const round=activeBeamTree()?.rounds?.[traceIndex],roundReject=round?.rejectSummary||{};
      const topology=`整回合拓扑剪枝：通路 ${roundReject.flow||0} · 孤岛 ${roundReject.island||0}`;
      ui.candidateBadge.innerHTML=`<strong>${phase}：${snapshot.item.label}</strong><br>生成 ${snapshot.rawCount} · 硬合法 ${snapshot.legal.length} · 送入搜索 ${snapshot.retained.length} · 淘汰 ${snapshot.rejected.length}（${reasons}） · ${topology} · 来源：${source}${specs?` · 规格：${specs}`:''}`;
    }

    function renderFurnitureConfig() {
      const program=PROGRAMS[currentProgram];
      const config=CONFIGS[currentProgram];
      const sofaVariants=currentProgram==='living'?configuredSofaVariants():[],selectedSofa=currentProgram==='living'?configuredSofaVariant(config.sofaPreset):null;
      const sofaSelect=currentProgram==='living'?`
        <div class="sofa-preset">
          <label for="sofaPreset">沙发形状（来自配置）</label>
          <select id="sofaPreset" data-sofa-preset ${ui.autoInventory.checked?'disabled':''}>
            ${sofaVariants.map(variant=>`<option value="${variant.id}" ${selectedSofa?.id===variant.id?'selected':''}>${variant.label} · ${variant.w.toFixed(2)}×${variant.d.toFixed(2)} m</option>`).join('')}
          </select>
        </div>`:'';
      let lastCategory='';
      const rows=program.types.map(type=>{
        const dims=config.dimensions[type.id];
        const count=config.counts[type.id];
        const category=type.category!==lastCategory?`<div class="config-group">${type.category}</div>`:'';
        lastCategory=type.category;
        const countControl=type.maxCount>type.minCount?`
          <select aria-label="${type.label}数量" data-config-count="${type.id}" ${ui.autoInventory.checked?'disabled':''}>
            ${Array.from({length:type.maxCount-type.minCount+1},(_,i)=>i+type.minCount).map(value=>`<option value="${value}" ${value===count?'selected':''}>${value}</option>`).join('')}
          </select>`:'<span class="config-fixed">固定</span>';
        return `${category}<div class="config-row">
          <label>${type.label}</label>
          <input type="number" min="0.3" max="4.2" step="0.05" value="${dims.w.toFixed(2)}" aria-label="${type.label}宽度" data-config-type="${type.id}" data-config-dim="w" ${ui.autoInventory.checked?'disabled':''} />
          <input type="number" min="0.25" max="3.2" step="0.05" value="${dims.d.toFixed(2)}" aria-label="${type.label}深度" data-config-type="${type.id}" data-config-dim="d" ${ui.autoInventory.checked?'disabled':''} />
          ${countControl}
        </div>`;
      }).join('');
      const dependencyNote=currentProgram==='living'?'选择餐椅会自动启用餐桌。':'选择梳妆凳会自动启用梳妆台。';
      const modeNote=ui.autoInventory.checked?`当前由系统自动选择类型、数量、尺寸档位与沙发形式；布置丰满度为“${DENSITY_MODES[layoutDensityMode].label}”。关闭开关后可手动指定。`:'当前为手动数量与尺寸模式。';
      const requiredNote=currentProgram==='living'?'沙发、电视柜为必选主家具；茶几及其余家具均允许 0–N。拓展填缝定制柜始终排在最后，宽度输入仅作选配估算，真正落子宽度由该分支的剩余连续墙段反算。':'床为 1–2 张、衣柜为必选家具；自动模式会把单人床、双人床、大床以及多种床头柜规格与位置一起搜索，手动模式则严格采用输入尺寸。';
      ui.furnitureConfig.innerHTML=`${sofaSelect}
        <div class="config-head"><span>家具类型</span><span>宽 m</span><span>深 m</span><span>数量上限</span></div>
        ${rows}
        <p class="config-note">尺寸是实际家具尺寸，不随房间面积倍率缩放。数量表示上限：除必选最小数量外，每个槽位都会同时搜索“摆放 / 跳过”，最终输出可以少于该数量。${requiredNote}${modeNote}${dependencyNote}</p>`;
    }

    function setupStaticUI() {
      const program=PROGRAMS[currentProgram];
      ui.appTitle.textContent=program.title;
      document.title=program.title.replace('卧室','居住').replace('客厅','居住');
      canvas.setAttribute('aria-label',`${currentProgram==='living'?'客厅':'卧室'}家具排布棋盘`);
      ui.furnitureKicker.textContent=`上限 ${FURNITURE.length} 件 · ${ui.autoInventory.checked?'自动选配':'手动上限'}`;
      ui.generate.innerHTML=`<span>▶</span>${ui.autoInventory.checked?'自动选配并生成方案':'搜索 3 个方案'}`;
      renderFurnitureConfig();
      ui.furnitureList.innerHTML=FURNITURE.map(item=>{
        const rule=furnitureRule(item),zone=rule.service||FURNITURE_RULES.default.service;
        const variants=item.sizeVariants;
        const dimensionText=rule.infill?`${rule.run.min.toFixed(2)}–${rule.run.max.toFixed(2)} × ${item.d.toFixed(2)} m · 末轮按余量定尺`:variants?.length?`${variants.map(row=>`${row.w.toFixed(2)}×${row.d.toFixed(2)}`).join(' / ')} m · 离散可变棋`:rule.run?`${rule.run.min.toFixed(2)}–${rule.run.max.toFixed(2)} × ${item.d.toFixed(2)} m · 连续柜`:`${item.w.toFixed(2)} × ${item.d.toFixed(2)} m${item.shape?.startsWith('l-')?' · L':''}`;
        return `
        <div class="furniture-row">
          <span class="swatch" style="background:${item.color}"></span>
          <span><strong>${item.label}</strong> · ${item.role}<small>${zone.label}${zone.hard?' · 硬约束':' · 评分区'}</small></span>
          <span>${dimensionText}</span>
        </div>`}).join('');
      ui.legend.innerHTML=FURNITURE.slice(0,3).map(item=>`<span><i style="background:${item.color}"></i>${item.label}</span>`).join('')+
        '<span><i style="border:1px dashed #ff5b38;background:rgba(255,91,56,.08)"></i>硬功能区</span>'+
        '<span><i style="border:1px dashed #2f8a78;background:rgba(47,138,120,.06)"></i>家具软使用区</span>';
      ui.scoreList.innerHTML=SCORE_KEYS.map(([key,label])=>`
        <div class="score-row" data-score="${key}">
          <span class="score-name">${label}</span>
          <span class="score-track"><span class="score-fill"></span></span>
          <span class="score-number">0</span>
        </div>`).join('');
    }

    function compileCurrentScene(autoSearch=false) {
      stopPlay();
      if (searchDebounce) clearTimeout(searchDebounce);
      scene=makeScene(shape,Number(ui.width.value),Number(ui.depth.value),Number(ui.multiplier.value));
      result=null; activeState={poses:{}}; activeSolution=0; traceIndex=0;candidateSnapshotCache={key:null,value:null};treeInspectNodeId=null;beamRoundIndex=1;
      ui.multiplierOutput.textContent=`${scene.areaMultiplier.toFixed(2)}×`;
      ui.liveRoomArea.textContent=`${scene.area.toFixed(2)} m²`;
      ui.roomArea.textContent=`${scene.area.toFixed(2)} m² · ${scene.width.toFixed(2)}×${scene.depth.toFixed(2)} m · ${scene.compiledAnchors.length} 锚点`;
      ui.boardStatus.textContent='场景已编译 · 等待搜索';
      ui.nodes.textContent='0'; ui.time.textContent='—'; ui.us.textContent='—';
      ui.depthMetric.textContent=`0 / ${FURNITURE.length}`; ui.score.textContent='—';
      ui.traceRange.min='0';ui.traceRange.max='0';ui.traceRange.value='0';ui.traceRangeOutput.textContent='0 / 0';
      ui.solutionStrip.innerHTML='';
      renderTrace(); updateScores(null);updateCandidateBadge(null);resizeAndDraw();renderBeamTree();
      if (autoSearch) searchDebounce=setTimeout(performSearch,260);
    }

    function resizeAndDraw() {
      const rect=canvas.getBoundingClientRect();
      const dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
      const width=Math.max(320,Math.floor(rect.width));
      const height=Math.max(400,Math.floor(rect.height));
      if (canvas.width!==Math.floor(width*dpr)||canvas.height!==Math.floor(height*dpr)) {
        canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);
      }
      ctx.setTransform(dpr,0,0,dpr,0,0);
      // 页面初次加载或切换房间时，ResizeObserver 可能早于 scene 编译完成触发。
      // 此时只清空旧帧，等正常编译流程再次调用，避免读取空场景宽深。
      if(!scene){ctx.clearRect(0,0,width,height);return;}
      updateCandidateBadge();
      drawBoard(width,height);
    }

    function transformFor(width,height) {
      const pad=Math.min(width,height)*.11;
      const scale=Math.min((width-pad*2)/scene.width,(height-pad*2)/scene.depth);
      const offsetX=(width-scene.width*scale)/2;
      const offsetY=(height-scene.depth*scale)/2;
      return {
        scale, offsetX, offsetY,
        p:p=>({x:offsetX+p.x*scale,y:offsetY+p.y*scale}),
        rect:r=>({x:offsetX+(r.x-r.w/2)*scale,y:offsetY+(r.y-r.d/2)*scale,w:r.w*scale,h:r.d*scale})
      };
    }

    function drawSoftDecor(drawCtx,tr,state,items,layer) {
      const rows=state?.decorItems||synthesizeSoftDecor(state,scene,items);
      drawCtx.save();
      for(const item of rows.filter(row=>row.layer===layer)){
        const r=tr.rect(item),cx=r.x+r.w/2,cy=r.y+r.h/2;
        if(item.kind==='rug'){
          drawCtx.fillStyle='rgba(214,183,127,.24)';drawCtx.strokeStyle='rgba(158,119,68,.58)';drawCtx.lineWidth=1.2;drawCtx.setLineDash([5,4]);drawCtx.beginPath();drawCtx.roundRect(r.x,r.y,r.w,r.h,Math.min(14,r.w*.08,r.h*.08));drawCtx.fill();drawCtx.stroke();drawCtx.setLineDash([]);
          drawCtx.strokeStyle='rgba(158,119,68,.18)';for(let y=r.y+7;y<r.y+r.h;y+=8){drawCtx.beginPath();drawCtx.moveTo(r.x+5,y);drawCtx.lineTo(r.x+r.w-5,y);drawCtx.stroke();}
          continue;
        }
        if(item.kind==='activityZone'){
          drawCtx.fillStyle='rgba(47,138,120,.055)';drawCtx.strokeStyle='rgba(47,138,120,.72)';drawCtx.lineWidth=1.3;drawCtx.setLineDash([5,4]);
          drawCtx.beginPath();drawCtx.roundRect(r.x,r.y,r.w,r.h,Math.min(12,r.w*.08,r.h*.08));drawCtx.fill();drawCtx.stroke();drawCtx.setLineDash([]);
          if(r.w>54&&r.h>28){drawCtx.fillStyle='rgba(25,102,85,.88)';drawCtx.font=`700 ${Math.max(9,Math.min(12,r.h*.13))}px system-ui`;drawCtx.textAlign='center';drawCtx.textBaseline='middle';drawCtx.fillText('活动区',cx,cy)}
          continue;
        }
        if(item.kind==='activityTable'||item.kind==='activityCushion'||item.kind==='activityChair'||item.kind==='activityLoveseat'){
          drawCtx.fillStyle=item.color||'#8aa69a';drawCtx.strokeStyle='rgba(45,72,64,.72)';drawCtx.lineWidth=1.1;
          drawCtx.beginPath();
          if(item.kind==='activityTable'||item.kind==='activityCushion')drawCtx.arc(cx,cy,Math.max(3,Math.min(r.w,r.h)/2),0,Math.PI*2);
          else drawCtx.roundRect(r.x,r.y,r.w,r.h,Math.min(9,r.w*.2,r.h*.2));
          drawCtx.fill();drawCtx.stroke();
          if(r.w>24&&r.h>18){drawCtx.fillStyle='#fff';drawCtx.font=`800 ${Math.max(7,Math.min(10,r.h*.22))}px system-ui`;drawCtx.textAlign='center';drawCtx.textBaseline='middle';drawCtx.fillText(item.label,cx,cy)}
          continue;
        }
        if(item.kind==='postDisplayCabinet'){
          drawCtx.fillStyle=item.color||'#5d7f78';drawCtx.strokeStyle='rgba(30,72,64,.92)';drawCtx.lineWidth=1.5;
          drawCtx.beginPath();drawCtx.roundRect(r.x,r.y,r.w,r.h,Math.min(7,r.w*.10,r.h*.10));drawCtx.fill();drawCtx.stroke();
          drawCtx.strokeStyle='rgba(255,255,255,.32)';drawCtx.lineWidth=1;
          if(r.w>=r.h){for(let x=r.x+Math.max(12,r.h);x<r.x+r.w-5;x+=Math.max(15,r.h*1.2)){drawCtx.beginPath();drawCtx.moveTo(x,r.y+3);drawCtx.lineTo(x,r.y+r.h-3);drawCtx.stroke();}}
          else{for(let y=r.y+Math.max(12,r.w);y<r.y+r.h-5;y+=Math.max(15,r.w*1.2)){drawCtx.beginPath();drawCtx.moveTo(r.x+3,y);drawCtx.lineTo(r.x+r.w-3,y);drawCtx.stroke();}}
          if(Math.max(r.w,r.h)>58){drawCtx.fillStyle='#fff';drawCtx.font=`800 ${Math.max(8,Math.min(11,Math.min(r.w,r.h)*.25))}px system-ui`;drawCtx.textAlign='center';drawCtx.textBaseline='middle';drawCtx.fillText(item.label,cx,cy)}
          continue;
        }
        if(item.kind==='curtain'){
          drawCtx.strokeStyle='rgba(93,139,128,.76)';drawCtx.lineWidth=Math.max(3,r.h);drawCtx.setLineDash([7,3]);drawCtx.beginPath();drawCtx.moveTo(r.x,r.y+r.h/2);drawCtx.lineTo(r.x+r.w,r.y+r.h/2);drawCtx.stroke();drawCtx.setLineDash([]);continue;
        }
        if(item.kind==='tableLamp'||item.kind==='deskLamp'||item.kind==='wallLamp'){
          const radius=Math.max(3,Math.min(r.w,r.h)*.48);drawCtx.fillStyle=item.color||'#efbd55';drawCtx.strokeStyle='rgba(91,69,31,.72)';drawCtx.lineWidth=1;drawCtx.beginPath();drawCtx.arc(cx,cy,radius,0,Math.PI*2);drawCtx.fill();drawCtx.stroke();drawCtx.beginPath();drawCtx.moveTo(cx,cy+radius*.25);drawCtx.lineTo(cx,cy+radius*.8);drawCtx.stroke();if(radius>=6){drawCtx.fillStyle='#5b451f';drawCtx.font=`800 ${Math.max(7,Math.min(10,radius*.78))}px system-ui`;drawCtx.textAlign='center';drawCtx.textBaseline='middle';drawCtx.fillText('灯',cx,cy-radius*.06)}continue;
        }
        if(item.kind==='deskPlant'||item.kind==='consoleDecor'){
          drawCtx.fillStyle=item.color||'#5f8b68';drawCtx.strokeStyle='rgba(42,84,55,.7)';for(const [dx,dy,scale] of [[0,-.2,1],[-.28,.08,.72],[.28,.08,.72]]){drawCtx.beginPath();drawCtx.arc(cx+dx*r.w,cy+dy*r.h,Math.max(2,Math.min(r.w,r.h)*.32*scale),0,Math.PI*2);drawCtx.fill();drawCtx.stroke();}continue;
        }
        if(item.kind==='mirror'){
          drawCtx.fillStyle='rgba(134,174,178,.22)';drawCtx.strokeStyle=item.color||'#86aeb2';drawCtx.lineWidth=2;drawCtx.beginPath();drawCtx.roundRect(r.x,r.y,r.w,r.h,Math.min(8,r.h/2));drawCtx.fill();drawCtx.stroke();continue;
        }
        if(item.kind==='wallShelf'||item.kind==='mediaShelf'){
          drawCtx.fillStyle=item.color||'#8b6a4e';drawCtx.fillRect(r.x,r.y,Math.max(2,r.w),Math.max(3,r.h));drawCtx.fillStyle='rgba(255,255,255,.8)';for(let x=r.x+r.w*.25;x<r.x+r.w;x+=r.w*.25)drawCtx.fillRect(x,r.y,1,Math.max(3,r.h));continue;
        }
        if(item.kind==='wallArt'){
          const gap=3,w=(r.w-gap*2)/3;for(let i=0;i<3;i++){drawCtx.fillStyle=i===1?'rgba(190,99,62,.65)':'rgba(184,121,100,.38)';drawCtx.fillRect(r.x+i*(w+gap),r.y,w,Math.max(4,r.h));}continue;
        }
        drawCtx.fillStyle=item.color||'rgba(199,125,99,.45)';drawCtx.strokeStyle='rgba(91,69,58,.34)';drawCtx.lineWidth=1;drawCtx.beginPath();drawCtx.roundRect(r.x,r.y,r.w,r.h,Math.min(8,r.w*.18,r.h*.18));drawCtx.fill();drawCtx.stroke();
      }
      drawCtx.restore();
    }

    function drawBoard(width,height) {
      ctx.clearRect(0,0,width,height);
      const tr=transformFor(width,height);
      ctx.fillStyle='#fbfaf5';ctx.fillRect(0,0,width,height);
      ctx.save();
      ctx.beginPath();
      scene.polygon.forEach((p,i)=>{const q=tr.p(p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});
      ctx.closePath();
      ctx.fillStyle='#fffef9';ctx.fill();
      ctx.restore();
      drawMetricGrid(tr,width,height);
      drawRoomAreaWatermark(tr);
      ctx.save();ctx.beginPath();scene.polygon.forEach((p,i)=>{const q=tr.p(p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.closePath();ctx.lineWidth=4;ctx.strokeStyle='#25312d';ctx.lineJoin='round';ctx.stroke();ctx.restore();
      drawDoorWindow(tr);
      if (ui.anchors.checked) drawAnchors(tr);
      drawSoftDecor(ctx,tr,activeState,FURNITURE,'floor');
      for (const item of FURNITURE) {
        const pose=activeState.poses[item.id];
        if (pose) drawFurniture(item,pose,tr,item.id===activeState.lastMove?.itemId);
      }
      drawSoftDecor(ctx,tr,activeState,FURNITURE,'overlay');
      if (ui.bitset.checked) drawBitsetOccupancy(tr);
      if (ui.stepCandidates.checked) drawStepCandidates(tr);
      // 软装、栅格和候选标记都可能经过家具；类型名称始终最后绘制。
      for(const item of FURNITURE){const pose=activeState.poses[item.id];if(pose)drawFurnitureLabel(item,pose,tr)}
      drawRoomLabels(tr);
    }

    function drawBitsetOccupancy(tr) {
      const placed=FURNITURE.filter(item=>activeState.poses[item.id]);if(!placed.length)return;
      const step=.12,cells=new Map();let lShapeItem=null;
      for(const item of placed){const pose=activeState.poses[item.id];if((pose.overrideShape||item.shape)?.startsWith('l-'))lShapeItem=item;
        for(const rect of footprintRects(item,pose)){
          const x0=Math.floor((rect.x-rect.w/2)/step),x1=Math.floor((rect.x+rect.w/2-EPS)/step);
          const y0=Math.floor((rect.y-rect.d/2)/step),y1=Math.floor((rect.y+rect.d/2-EPS)/step);
          for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)cells.set(`${x},${y}`,cells.get(`${x},${y}`)||item);
        }
      }
      ctx.save();ctx.beginPath();scene.polygon.forEach((p,i)=>{const q=tr.p(p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.closePath();ctx.clip();
      for(const [key,owner] of cells){const [x,y]=key.split(',').map(Number),a=tr.p({x:x*step,y:y*step}),b=tr.p({x:(x+1)*step,y:(y+1)*step}),isL=owner.shape?.startsWith('l-');ctx.fillStyle=isL?'rgba(92,70,190,.18)':'rgba(255,255,255,.08)';ctx.strokeStyle='rgba(255,255,255,.76)';ctx.lineWidth=.65;ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);}
      ctx.restore();
      // 家具内部也使用与房间相同的 5 格 / 10 格加粗节奏，只改变为高反差白线。
      ctx.save();ctx.beginPath();for(const item of placed)for(const rect of footprintRects(item,activeState.poses[item.id])){const r=tr.rect(rect);ctx.rect(r.x,r.y,r.w,r.h);}ctx.clip();
      const drawFurnitureFamily=(multiple,color,lineWidth)=>{ctx.strokeStyle=color;ctx.lineWidth=lineWidth;
        for(let cell=0;cell*step<=scene.width+EPS;cell+=multiple){const a=tr.p({x:cell*step,y:0}),b=tr.p({x:cell*step,y:scene.depth});ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
        for(let cell=0;cell*step<=scene.depth+EPS;cell+=multiple){const a=tr.p({x:0,y:cell*step}),b=tr.p({x:scene.width,y:cell*step});ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
      };
      drawFurnitureFamily(5,'rgba(255,255,255,.88)',1.0);drawFurnitureFamily(10,'rgba(255,255,255,.98)',1.35);ctx.restore();
      const anchor=lShapeItem?tr.p(activeState.poses[lShapeItem.id]):tr.p({x:scene.width/2,y:.18});ctx.save();ctx.font='850 10px system-ui';ctx.textAlign='center';ctx.textBaseline='bottom';const label=lShapeItem?`L 形足迹：${cells.size} 个占用 bit · 2 个矩形掩码 OR`:`当前局面：${cells.size} 个占用 bit · 栅格 ${step.toFixed(2)} m`;const tw=ctx.measureText(label).width,labelY=lShapeItem?anchor.y-lShapeItem.d*tr.scale/2-14:anchor.y;ctx.fillStyle='rgba(255,255,255,.95)';ctx.strokeStyle='rgba(92,70,190,.36)';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(anchor.x-tw/2-7,labelY-17,tw+14,20,8);ctx.fill();ctx.stroke();ctx.fillStyle='#5c46be';ctx.fillText(label,anchor.x,labelY-2);ctx.restore();
    }

    function drawMetricGrid(tr,width,height) {
      // 与矩阵搜索、家具 Bitset 完全共用 0.12 m 原点和步长。
      const step=.12,stepPx=step*tr.scale;
      const minX=Math.floor(-tr.offsetX/stepPx)-1,maxX=Math.ceil((width-tr.offsetX)/stepPx)+1;
      const minY=Math.floor(-tr.offsetY/stepPx)-1,maxY=Math.ceil((height-tr.offsetY)/stepPx)+1;
      const drawFamily=(predicate,color,lineWidth)=>{
        ctx.save();ctx.strokeStyle=color;ctx.lineWidth=lineWidth;
        for(let cell=minX;cell<=maxX;cell++)if(predicate(cell)){const x=tr.offsetX+cell*stepPx;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}
        for(let cell=minY;cell<=maxY;cell++)if(predicate(cell)){const y=tr.offsetY+cell*stepPx;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
        ctx.restore();
      };
      drawFamily(cell=>Math.abs(cell)%5!==0,'rgba(31,69,61,.105)',.65);
      drawFamily(cell=>Math.abs(cell)%5===0&&Math.abs(cell)%10!==0,'rgba(31,69,61,.19)',1.0);
      drawFamily(cell=>Math.abs(cell)%10===0,'rgba(31,69,61,.31)',1.35);

      // 每 10 格 = 1.20 m；标尺与 Bitset 单元严格整数对齐。
      ctx.save();ctx.fillStyle='rgba(31,69,61,.68)';ctx.font='800 9px system-ui';
      ctx.textAlign='center';ctx.textBaseline='top';
      for(let cell=10;cell*step<scene.width-EPS;cell+=10){const p=tr.p({x:cell*step,y:0});ctx.fillText(`${(cell*step).toFixed(1)}m`,p.x,p.y+5);}
      ctx.textAlign='left';ctx.textBaseline='middle';
      for(let cell=10;cell*step<scene.depth-EPS;cell+=10){const p=tr.p({x:0,y:cell*step});ctx.fillText(`${(cell*step).toFixed(1)}m`,p.x+6,p.y);}
      ctx.restore();
    }

    function drawDoorWindow(tr) {
      ctx.save();
      for(const d of sceneDoors(scene)){
        const rawA=d.a||{x:d.x0,y:d.y},rawB=d.b||{x:d.x1,y:d.y},inward=d.inward||{x:0,y:-1},a=tr.p(rawA),b=tr.p(rawB),kind=d.kind||recognizedDoorKind(d.type),hinge=b;
        ctx.strokeStyle=kind==='opening'?'#bc765f':'#ff5b38';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
        if(kind==='swing'){
          ctx.lineWidth=1.5;ctx.setLineDash([5,5]);ctx.beginPath();
          const closedAngle=Math.atan2(a.y-b.y,a.x-b.x),openRaw={x:rawB.x+inward.x*d.width,y:rawB.y+inward.y*d.width},open=tr.p(openRaw),openAngle=Math.atan2(open.y-b.y,open.x-b.x);
          ctx.arc(hinge.x,hinge.y,d.width*tr.scale,closedAngle,openAngle);ctx.stroke();ctx.beginPath();ctx.moveTo(hinge.x,hinge.y);ctx.lineTo(open.x,open.y);ctx.stroke();ctx.setLineDash([]);
        }else if(kind==='slide'){
          const offset={x:inward.x*.055,y:inward.y*.055},sa=tr.p({x:rawA.x+offset.x,y:rawA.y+offset.y}),sb=tr.p({x:rawB.x+offset.x,y:rawB.y+offset.y});ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sa.x,sa.y);ctx.lineTo(sb.x,sb.y);ctx.stroke();
        }
        const midRaw={x:(rawA.x+rawB.x)/2+inward.x*.18,y:(rawA.y+rawB.y)/2+inward.y*.18},mid=tr.p(midRaw),typeLabel=kind==='slide'?'推拉门':kind==='opening'?'门洞':'门',label=`${typeLabel} ${d.width.toFixed(1)} m`;
        ctx.font='800 11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';const labelWidth=ctx.measureText(label).width+12;
        ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillRect(mid.x-labelWidth/2,mid.y-10,labelWidth,20);ctx.fillStyle='#d94326';ctx.fillText(label,mid.x,mid.y);
      }
      const w=scene.window;const wa=tr.p({x:w.x0,y:w.y}),wb=tr.p({x:w.x1,y:w.y});
      ctx.strokeStyle='#43a8bd';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(wa.x,wa.y);ctx.lineTo(wb.x,wb.y);ctx.stroke();
      ctx.restore();
    }

    function drawAnchors(tr) {
      ctx.save();
      for (const p of scene.compiledAnchors) {
        const q=tr.p(p);ctx.beginPath();ctx.arc(q.x,q.y,3.2,0,Math.PI*2);
        ctx.fillStyle='rgba(255,91,56,.68)';ctx.fill();
      }
      ctx.restore();
    }

    function drawStepCandidates(tr) {
      const snapshot=traceCandidateSnapshot();if(!snapshot)return;
      const markerPath=(pose,q,r)=>{
        const source=candidateSource(pose);ctx.beginPath();
        if(source==='relation') {ctx.moveTo(q.x,q.y-r);ctx.lineTo(q.x+r,q.y);ctx.lineTo(q.x,q.y+r);ctx.lineTo(q.x-r,q.y);ctx.closePath();}
        else if(source==='zone') ctx.rect(q.x-r*.82,q.y-r*.82,r*1.64,r*1.64);
        else if(source==='corner') {ctx.moveTo(q.x,q.y-r);ctx.lineTo(q.x+r*.92,q.y+r*.75);ctx.lineTo(q.x-r*.92,q.y+r*.75);ctx.closePath();}
        else ctx.arc(q.x,q.y,r,0,Math.PI*2);
      };
      const drawDirection=(pose,color,length=.15)=>{
        if(!pose.normal)return;
        const a=tr.p(pose),b=tr.p(add(pose,pose.normal,length));
        ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      };
      ctx.save();
      for (const row of snapshot.legalDeferred) {
        const q=tr.p(row.pose);markerPath(row.pose,q,4.2);
        ctx.strokeStyle='rgba(190,142,54,.82)';ctx.lineWidth=1.5;ctx.stroke();
      }
      for (const row of snapshot.rejected) {
        const pose=row.pose,q=tr.p(pose),r=4.4;ctx.strokeStyle='rgba(195,76,59,.72)';ctx.lineWidth=1.35;
        ctx.beginPath();ctx.moveTo(q.x-r,q.y-r);ctx.lineTo(q.x+r,q.y+r);ctx.moveTo(q.x+r,q.y-r);ctx.lineTo(q.x-r,q.y+r);ctx.stroke();
      }
      for (const row of snapshot.retained) {
        const q=tr.p(row.pose);markerPath(row.pose,q,5.1);
        ctx.fillStyle='rgba(26,155,118,.88)';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=1.2;ctx.stroke();drawDirection(row.pose,'rgba(26,155,118,.68)');
      }
      if(snapshot.selected) {
        const q=tr.p(snapshot.selected);ctx.beginPath();ctx.arc(q.x,q.y,10.2,0,Math.PI*2);
        ctx.strokeStyle='#ff5b38';ctx.lineWidth=3.4;ctx.stroke();ctx.beginPath();ctx.arc(q.x,q.y,3.1,0,Math.PI*2);ctx.fillStyle='#ff5b38';ctx.fill();
        drawDirection(snapshot.selected,'#ff5b38',.24);
      }
      ctx.restore();
    }

    function drawFurniture(item,pose,tr,highlight=false) {
      if (ui.envelope.checked) {
        for (const zone of functionalZones(item,pose)) {
          const zr=tr.rect(zone.rect);ctx.save();ctx.setLineDash(zone.hard?[6,4]:[3,5]);ctx.lineWidth=1.35;
          ctx.strokeStyle=zone.hard?'rgba(255,91,56,.76)':'rgba(47,138,120,.64)';
          ctx.fillStyle=zone.hard?'rgba(255,91,56,.065)':'rgba(47,138,120,.045)';
          ctx.fillRect(zr.x,zr.y,zr.w,zr.h);ctx.strokeRect(zr.x,zr.y,zr.w,zr.h);ctx.restore();
        }
      }
      const rects=footprintRects(item,pose);
      ctx.save();
      ctx.fillStyle=item.color;ctx.strokeStyle=highlight?'#ff5b38':'rgba(13,25,21,.55)';ctx.lineWidth=highlight?4:1.5;
      for (const rect of rects) {
        const r=tr.rect(rect);ctx.beginPath();
        const radius=Math.min(10,r.w*.10,r.h*.10);
        ctx.roundRect(r.x,r.y,r.w,r.h,radius);ctx.fill();ctx.stroke();
      }
      if (pose.normal) {
        const c=tr.p(pose),tip=tr.p(add(pose,pose.normal,.22));
        ctx.strokeStyle='rgba(255,255,255,.72)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();
      }
      ctx.restore();
    }

    function drawFurnitureLabel(item,pose,tr){
      const rect=footprintRects(item,pose)[0],labelRect=tr.rect(rect),label=itemDisplayLabel(item,pose),fontSize=Math.max(9,Math.min(14,labelRect.w*.12));
      ctx.save();ctx.font=`800 ${fontSize}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';const x=labelRect.x+labelRect.w/2,y=labelRect.y+labelRect.h/2,textWidth=Math.min(labelRect.w-4,ctx.measureText(label).width+8),textHeight=fontSize+5;
      ctx.fillStyle='rgba(20,40,49,.34)';ctx.beginPath();ctx.roundRect(x-textWidth/2,y-textHeight/2,textWidth,textHeight,4);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(label,x,y,Math.max(8,labelRect.w-5));ctx.restore();
    }

    function drawRoomLabels(tr) {
      ctx.save();ctx.fillStyle='rgba(24,35,31,.48)';ctx.font='700 11px system-ui';
      const top=tr.p({x:scene.width/2,y:0});ctx.textAlign='center';ctx.fillText(`${scene.width.toFixed(1)} m`,top.x,top.y-13);
      const side=tr.p({x:scene.width,y:scene.depth/2});ctx.save();ctx.translate(side.x+16,side.y);ctx.rotate(Math.PI/2);ctx.fillText(`${scene.depth.toFixed(1)} m`,0,0);ctx.restore();
      ctx.restore();
    }

    function drawRoomAreaWatermark(tr) {
      const center=tr.p(scene.designField?.centroid||polygonCentroid(scene.polygon)),label=`${scene.area.toFixed(2)} m²`;
      ctx.save();ctx.font='900 18px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
      const width=ctx.measureText(label).width+24;
      ctx.fillStyle='rgba(232,246,241,.72)';ctx.strokeStyle='rgba(13,119,98,.24)';ctx.lineWidth=1;
      ctx.beginPath();ctx.roundRect(center.x-width/2,center.y-17,width,34,12);ctx.fill();ctx.stroke();
      ctx.fillStyle='rgba(13,92,76,.48)';ctx.fillText(label,center.x,center.y);ctx.restore();
    }

    function updateScores(evaluation) {
      document.querySelectorAll('[data-score]').forEach(row=>{
        const key=row.dataset.score;const value=evaluation?.scores?.[key]||0;
        row.querySelector('.score-fill').style.width=`${value}%`;
        row.querySelector('.score-number').textContent=value;
      });
      ui.score.textContent=evaluation?evaluation.total.toFixed(1):'—';
    }

    const BEAM_STATUS={
      retained:{label:'进入下一回合',color:'#1a9b76'},finalist:{label:'通过最终验证',color:'#1a9b76'},output:{label:'最终输出',color:'#5c46be'},
      'beam-cut':{label:'Beam 名次不足',color:'#be8e36'},precut:{label:'累计局部分不足',color:'#d6a84f'},
      'flow-pruned':{label:'通行连通性失败',color:'#c34c3b'},'forward-pruned':{label:'下一手已无位置',color:'#d65b48'},
      'no-next':{label:'下一回合无分支',color:'#d65b48'},'final-pruned':{label:'最终验证未输出',color:'#b04b3f'},
      duplicate:{label:'同构去重',color:'#8c667b'},pending:{label:'未完成筛选',color:'#9aa39f'}
    };

    function beamNodeVisible(node) {
      if (beamFilter==='all') return true;
      if (beamFilter==='retained') return node.status==='retained'||node.status==='finalist';
      if (beamFilter==='cut') return node.status==='beam-cut'||node.status==='precut';
      return node.status==='flow-pruned'||node.status==='forward-pruned'||node.status==='no-next'||node.status==='final-pruned'||node.status==='duplicate';
    }

    function renderBeamOverview() {
      const tree=activeBeamTree();
      const rect=beamCanvas.getBoundingClientRect();
      const width=Math.max(320,Math.floor(rect.width)),height=Math.max(420,Math.floor(rect.height));
      const dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
      if(beamCanvas.width!==Math.floor(width*dpr)||beamCanvas.height!==Math.floor(height*dpr)){beamCanvas.width=Math.floor(width*dpr);beamCanvas.height=Math.floor(height*dpr);}
      beamCtx.setTransform(dpr,0,0,dpr,0,0);beamCtx.clearRect(0,0,width,height);beamHitTargets=[];
      beamCtx.fillStyle='#fbfaf5';beamCtx.fillRect(0,0,width,height);
      if(!tree?.rounds?.length){ui.beamEmpty.hidden=false;ui.beamSummary.textContent='等待搜索';ui.beamRound.disabled=true;return;}
      ui.beamEmpty.hidden=true;ui.beamRound.disabled=false;
      beamRoundIndex=clamp(beamRoundIndex,1,tree.rounds.length);
      ui.beamRound.min='1';ui.beamRound.max=String(tree.rounds.length);ui.beamRound.value=String(beamRoundIndex);
      const round=tree.rounds[beamRoundIndex-1],item=ITEM_BY_ID[round.itemId];
      ui.beamRoundOutput.textContent=`${beamRoundIndex} / ${tree.rounds.length} · ${itemStepLabel(item)||round.itemId}`;
      const allNodes=round.nodes,visible=allNodes.filter(beamNodeVisible);
      const retained=allNodes.filter(n=>n.status==='retained'||n.status==='finalist').length;
      const cut=allNodes.filter(n=>n.status==='beam-cut'||n.status==='precut').length;
      const pruned=allNodes.filter(n=>n.status==='flow-pruned'||n.status==='forward-pruned'||n.status==='duplicate').length;
      ui.beamSummary.textContent=`本轮 ${allNodes.length} 条分支 · 保留 ${retained}`;
      if(!treeInspectNodeId) ui.beamDetail.innerHTML=`<strong>第 ${beamRoundIndex} 回合 · 放置 ${itemStepLabel(item)||round.itemId}</strong><br>上一轮父局面 ${round.parentIds.length} 个；原始采样 ${round.rawCandidates.toLocaleString()} 个；每父局面取前 72 后展开 ${allNodes.length.toLocaleString()} 个。最终保留 ${retained}，排名截断 ${cut}，规则剪枝 ${pruned}。`;

      // 顶部总览：每一根柱是一回合，柱高表示进入搜索的分支数，颜色切片表示去向。
      const overviewTop=22,overviewHeight=58,overviewLeft=42,overviewRight=width-24;
      const maxRoundNodes=Math.max(1,...tree.rounds.map(r=>r.nodes.length));
      const slot=(overviewRight-overviewLeft)/tree.rounds.length;
      beamCtx.font='700 9px system-ui';beamCtx.textAlign='center';beamCtx.textBaseline='bottom';
      tree.rounds.forEach((r,index)=>{
        const x=overviewLeft+slot*(index+.5),barW=Math.max(5,Math.min(24,slot*.56));
        const counts={retained:0,cut:0,pruned:0,other:0};
        r.nodes.forEach(n=>{if(n.status==='retained'||n.status==='finalist')counts.retained++;else if(n.status==='beam-cut'||n.status==='precut')counts.cut++;else if(n.status.includes('pruned')||n.status==='no-next'||n.status==='duplicate')counts.pruned++;else counts.other++;});
        const total=Math.max(1,r.nodes.length),barH=Math.max(5,r.nodes.length/maxRoundNodes*overviewHeight),base=overviewTop+overviewHeight;
        let y=base;
        for(const [key,color] of [['retained','#1a9b76'],['cut','#be8e36'],['pruned','#c34c3b'],['other','#9aa39f']]){const h=barH*counts[key]/total;if(h){beamCtx.fillStyle=color;beamCtx.fillRect(x-barW/2,y-h,barW,h);y-=h;}}
        if(index===beamRoundIndex-1){beamCtx.strokeStyle='#18231f';beamCtx.lineWidth=2;beamCtx.strokeRect(x-barW/2-3,base-barH-3,barW+6,barH+6);}
        beamCtx.fillStyle='#69736f';beamCtx.fillText(String(index+1),x,overviewTop+overviewHeight+15);
        beamHitTargets.push({type:'round',round:index+1,x:x-slot*.45,y:overviewTop-5,w:slot*.9,h:overviewHeight+24});
      });

      const plotTop=128,plotBottom=height-42,leftX=72,rightX=width-74;
      beamCtx.strokeStyle='rgba(24,35,31,.10)';beamCtx.lineWidth=1;beamCtx.beginPath();beamCtx.moveTo(leftX,plotTop-18);beamCtx.lineTo(leftX,plotBottom+14);beamCtx.moveTo(rightX,plotTop-18);beamCtx.lineTo(rightX,plotBottom+14);beamCtx.stroke();
      beamCtx.fillStyle='#69736f';beamCtx.font='800 10px system-ui';beamCtx.textAlign='center';beamCtx.fillText(`父局面 ${round.parentIds.length}`,leftX,plotTop-27);beamCtx.fillText(`子局面 ${visible.length} / ${allNodes.length}`,rightX,plotTop-27);
      const parents=round.parentIds.map(id=>tree.nodeById.get(id)).filter(Boolean).sort((a,b)=>b.score-a.score);
      const parentY=new Map();
      parents.forEach((parent,index)=>parentY.set(parent.id,parents.length===1?(plotTop+plotBottom)/2:plotTop+index*(plotBottom-plotTop)/(parents.length-1)));
      const sorted=[...visible].sort((a,b)=>b.score-a.score);
      const childY=new Map();
      sorted.forEach((node,index)=>childY.set(node.id,sorted.length===1?(plotTop+plotBottom)/2:plotTop+index*(plotBottom-plotTop)/(sorted.length-1)));
      beamCtx.lineWidth=.65;
      for(const node of sorted){const py=parentY.get(node.parentId);if(py==null)continue;const ny=childY.get(node.id);beamCtx.strokeStyle=(BEAM_STATUS[node.status]?.color||'#9aa39f')+'32';beamCtx.beginPath();beamCtx.moveTo(leftX+4,py);beamCtx.bezierCurveTo(width*.34,py,width*.66,ny,rightX-4,ny);beamCtx.stroke();}
      for(const parent of parents){const y=parentY.get(parent.id),selected=treeInspectNodeId===parent.id;beamCtx.beginPath();beamCtx.arc(leftX,y,selected?5:Math.max(1.5,3.2-Math.log10(parents.length+1)),0,Math.PI*2);beamCtx.fillStyle=selected?'#ff5b38':'#18231f';beamCtx.fill();beamHitTargets.push({type:'node',id:parent.id,x:leftX,y,r:7});}
      for(const node of sorted){const y=childY.get(node.id),selected=treeInspectNodeId===node.id,color=BEAM_STATUS[node.status]?.color||'#9aa39f';beamCtx.beginPath();beamCtx.arc(rightX,y,selected?6:(sorted.length>900?1.35:sorted.length>300?1.8:2.8),0,Math.PI*2);beamCtx.fillStyle=color;beamCtx.fill();if(selected){beamCtx.strokeStyle='#18231f';beamCtx.lineWidth=2;beamCtx.stroke();}beamHitTargets.push({type:'node',id:node.id,x:rightX,y,r:Math.max(6,sorted.length>500?4:7)});}
      if(!sorted.length){beamCtx.fillStyle='#69736f';beamCtx.font='700 12px system-ui';beamCtx.textAlign='center';beamCtx.fillText('当前筛选条件下没有节点',width/2,(plotTop+plotBottom)/2);}
      beamCtx.fillStyle='#89918d';beamCtx.font='700 9px system-ui';beamCtx.textAlign='left';beamCtx.fillText('上方 = 累计启发分更高',18,height-15);
    }

    function beamChildren(tree) {
      if(tree._children)return tree._children;
      const children=new Map();
      for(const round of tree.rounds)for(const node of round.nodes){if(!children.has(node.parentId))children.set(node.parentId,[]);children.get(node.parentId).push(node);}
      for(const node of tree.outputs||[]){if(!children.has(node.parentId))children.set(node.parentId,[]);children.get(node.parentId).push(node);}
      for(const rows of children.values())rows.sort((a,b)=>{
        const priority=node=>node.status==='output'?5:node.status==='finalist'?4:node.status==='retained'?3:node.status==='beam-cut'?2:1;
        return priority(b)-priority(a)||b.score-a.score;
      });
      tree._children=children;return children;
    }

    function beamTerminalSummary(tree,parent,terminalNodes) {
      if(!terminalNodes.length)return null;
      const counts=terminalNodes.reduce((result,node)=>{result[node.status]=(result[node.status]||0)+1;return result;},{});
      const ordered=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
      const representative=[...terminalNodes].sort((a,b)=>b.score-a.score)[0];
      const reasonText=ordered.map(([status,count])=>`${BEAM_STATUS[status]?.label||status} ${count}`).join('、');
      const id=`terminal-${parent.id}`;
      const summary={id,parentId:parent.id,depth:(parent.depth||0)+1,itemId:representative.itemId,score:representative.score,merit:representative.merit,status:ordered[0]?.[0]||'pending',reason:`未进入下一回合：${reasonText}`,terminalReason:reasonText,poses:representative.poses||parent.poses||{},pose:representative.pose,terminalSummary:true,terminalCount:terminalNodes.length,terminalCounts:counts};
      tree.nodeById.set(id,summary);return summary;
    }

    function resetBeamBoardView() {
      const tree=activeBeamTree();beamExpandedNodes=new Set(['n0']);beamFocusPath=new Set(['n0']);beamOutputPath=new Set();beamBranchOffsets=new Map();
      const finalist=result?.solutions?.[activeSolution]?._treeNode?.id;
      let cursor=finalist?tree?.nodeById?.get(finalist):null;
      while(cursor){beamFocusPath.add(cursor.id);if(cursor.parentId)beamExpandedNodes.add(cursor.parentId);cursor=cursor.parentId?tree.nodeById.get(cursor.parentId):null;}
      if(tree){
        for(const output of tree.outputs||[]){let branch=output;while(branch){beamOutputPath.add(branch.id);if(branch.parentId)beamExpandedNodes.add(branch.parentId);branch=branch.parentId?tree.nodeById.get(branch.parentId):null;}}
        if(beamExpansionMode==='all')for(const round of tree.rounds)for(const node of round.nodes)if(node.status==='retained'||node.status==='finalist')beamExpandedNodes.add(node.id);
      }
      beamViewport={x:52,y:70,scale:beamExpansionMode==='all'?.38:.68};beamNeedsCenter=true;treeInspectNodeId=null;
    }

    function drawBeamMiniBoard(node,x,y,w,h) {
      const pad=5,scale=Math.min((w-pad*2)/scene.width,(h-pad*2)/scene.depth),ox=x+(w-scene.width*scale)/2,oy=y+(h-scene.depth*scale)/2;
      const point=p=>({x:ox+p.x*scale,y:oy+p.y*scale});
      const rect=r=>({x:ox+(r.x-r.w/2)*scale,y:oy+(r.y-r.d/2)*scale,w:r.w*scale,h:r.d*scale});
      beamCtx.beginPath();scene.polygon.forEach((p,i)=>{const q=point(p);i?beamCtx.lineTo(q.x,q.y):beamCtx.moveTo(q.x,q.y);});beamCtx.closePath();beamCtx.fillStyle='#fffef9';beamCtx.fill();beamCtx.strokeStyle='#56615d';beamCtx.lineWidth=1.2;beamCtx.stroke();
      for(const [id,pose] of Object.entries(node.poses||{})){const item=ITEM_BY_ID[id];if(!item)continue;for(const body of footprintRects(item,pose)){const r=rect(body);beamCtx.fillStyle=item.color;beamCtx.strokeStyle=id===node.itemId?'#ff5b38':'rgba(13,25,21,.5)';beamCtx.lineWidth=id===node.itemId?2.2:1;beamCtx.beginPath();beamCtx.roundRect(r.x,r.y,r.w,r.h,Math.min(3,r.w*.12,r.h*.12));beamCtx.fill();beamCtx.stroke();}}
      beamCtx.strokeStyle='#ff5b38';beamCtx.lineWidth=2;for(const door of sceneDoors(scene)){const doorA=point(door.a||{x:door.x0,y:door.y}),doorB=point(door.b||{x:door.x1,y:door.y});beamCtx.beginPath();beamCtx.moveTo(doorA.x,doorA.y);beamCtx.lineTo(doorB.x,doorB.y);beamCtx.stroke();}
      const winA=point({x:scene.window.x0,y:0}),winB=point({x:scene.window.x1,y:0});beamCtx.strokeStyle='#43a8bd';beamCtx.beginPath();beamCtx.moveTo(winA.x,winA.y);beamCtx.lineTo(winB.x,winB.y);beamCtx.stroke();
    }

    function renderBeamBoardTree() {
      const tree=activeBeamTree(),rect=beamCanvas.getBoundingClientRect(),width=Math.max(320,Math.floor(rect.width)),height=Math.max(420,Math.floor(rect.height)),dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
      if(beamCanvas.width!==Math.floor(width*dpr)||beamCanvas.height!==Math.floor(height*dpr)){beamCanvas.width=Math.floor(width*dpr);beamCanvas.height=Math.floor(height*dpr);}
      beamCtx.setTransform(dpr,0,0,dpr,0,0);beamCtx.clearRect(0,0,width,height);beamCtx.fillStyle='#fbfaf5';beamCtx.fillRect(0,0,width,height);beamHitTargets=[];
      if(!tree?.rounds?.length){ui.beamEmpty.hidden=false;ui.beamSummary.textContent='等待搜索';return;}ui.beamEmpty.hidden=true;
      const children=beamChildren(tree),displayChildren=new Map();
      const chooseChildren=parentId=>{
        const rows=children.get(parentId)||[];
        if(!beamExpandedNodes.has(parentId))return [];
        // 聚焦模式只显示确实走到最终输出层的祖先链。
        if(beamExpansionMode==='focus')return rows.filter(node=>beamOutputPath.has(node.id));
        // 全部展开用于逐节点调试：每个已经落子并形成状态的候选都原样显示，绝不合并。
        return rows;
      };
      const visible=new Map([['n0',tree.root]]),walk=id=>{const rows=chooseChildren(id);displayChildren.set(id,rows);for(const child of rows){visible.set(child.id,child);walk(child.id);}};walk('n0');
      const positions=new Map(),cardW=230,cardH=146,compactH=28,columnGap=88,rowGap=16;
      const isCompact=node=>false,nodeHeight=node=>cardH;let leafY=0;
      const fitText=(value,maxWidth)=>{const text=String(value??'');if(beamCtx.measureText(text).width<=maxWidth)return text;let low=0,high=text.length;while(low<high){const mid=Math.ceil((low+high)/2),candidate=text.slice(0,mid)+'…';if(beamCtx.measureText(candidate).width<=maxWidth)low=mid;else high=mid-1;}return text.slice(0,low)+'…';};
      const layout=id=>{const node=visible.get(id),rows=displayChildren.get(id)||[],h=nodeHeight(node);let center;if(!rows.length){center=leafY+h/2;leafY+=h+rowGap;}else{const centers=rows.map(child=>layout(child.id));center=(centers[0]+centers[centers.length-1])/2;}positions.set(id,{x:(node.depth||0)*(cardW+columnGap),y:center-h/2,h});return center;};layout('n0');
      const graphDepth=tree.rounds.length+((tree.outputs||[]).length?1:0);
      const contentHeight=Math.max(cardH,leafY-rowGap),contentWidth=(graphDepth+1)*(cardW+columnGap)-columnGap;
      if(beamNeedsCenter){const rootPosition=positions.get('n0');const fitScale=Math.min(.42,Math.max(.08,(height-110)/Math.max(contentHeight,1)));beamViewport.scale=fitScale;beamViewport.x=52;beamViewport.y=height/2-(rootPosition.y+rootPosition.h/2)*beamViewport.scale;beamNeedsCenter=false;}
      beamCtx.save();beamCtx.setTransform(dpr*beamViewport.scale,0,0,dpr*beamViewport.scale,dpr*beamViewport.x,dpr*beamViewport.y);
      beamCtx.textAlign='center';beamCtx.textBaseline='middle';
      for(let depth=0;depth<=graphDepth;depth++){
        const x=depth*(cardW+columnGap),isOutput=depth>tree.rounds.length,round=depth&&!isOutput?tree.rounds[depth-1]:null,item=round?ITEM_BY_ID[round.itemId]:null;
        if(depth){beamCtx.save();beamCtx.setLineDash([8,9]);beamCtx.strokeStyle='rgba(24,35,31,.25)';beamCtx.lineWidth=1.2;beamCtx.beginPath();beamCtx.moveTo(x-columnGap/2,-58);beamCtx.lineTo(x-columnGap/2,contentHeight+cardH+28);beamCtx.stroke();beamCtx.restore();}
        beamCtx.fillStyle=isOutput?'#5c46be':'#18231f';beamCtx.font='900 11px system-ui';beamCtx.fillText(isOutput?`最终输出 · ${tree.outputCount||0} 个 · A/B/C 边框已标记`:depth?`第 ${depth} 手 · ${itemStepLabel(item)||round.itemId}`:'起点 · 空房间',x+cardW/2,-42);
        if(round){const r=round.rejectSummary||{};beamCtx.fillStyle='#8a5a4b';beamCtx.font='700 8px system-ui';beamCtx.fillText(`静态 ${r.static||0} · 碰撞 ${r.collision||0} · 功能 ${r.functional||0} · 通路 ${r.flow||0} · 孤岛 ${r.island||0} · 局部分 ${r.scoreCut||0}`,x+cardW/2,-25);}
      }
      // 聚焦模式中的所有可见边都通向最终输出，用半透明走廊包住整片胜出路径。
      if(beamExpansionMode==='focus')for(const [parentId,rows] of displayChildren){const p=positions.get(parentId);if(!p||!beamOutputPath.has(parentId))continue;for(const child of rows){if(!beamOutputPath.has(child.id))continue;const c=positions.get(child.id);beamCtx.strokeStyle='rgba(21,154,123,.16)';beamCtx.lineWidth=22;beamCtx.beginPath();beamCtx.moveTo(p.x+cardW,p.y+p.h/2);beamCtx.bezierCurveTo(p.x+cardW+columnGap*.48,p.y+p.h/2,c.x-columnGap*.48,c.y+c.h/2,c.x,c.y+c.h/2);beamCtx.stroke();}}
      for(const [parentId,rows] of displayChildren){const p=positions.get(parentId);if(!p)continue;for(const child of rows){const c=positions.get(child.id),topColor=child.topRank===1?'#f0a52b':child.topRank===2?'#7d63d5':child.topRank===3?'#159a7b':null,isFocus=beamExpansionMode==='focus'&&beamOutputPath.has(parentId)&&beamOutputPath.has(child.id);beamCtx.strokeStyle=topColor||(isFocus?'rgba(21,154,123,.92)':child.status==='output'?'rgba(92,70,190,.66)':(BEAM_STATUS[child.status]?.color||'#126c5c')+'55');beamCtx.lineWidth=child.topRank?3.6:child.status==='output'?2.4:isFocus?3:1.25;beamCtx.beginPath();beamCtx.moveTo(p.x+cardW,p.y+p.h/2);beamCtx.bezierCurveTo(p.x+cardW+columnGap*.48,p.y+p.h/2,c.x-columnGap*.48,c.y+c.h/2,c.x,c.y+c.h/2);beamCtx.stroke();}}
      const activePlanTreeId=result?.solutions?.[activeSolution]?._treeId;
      for(const [id,node] of visible){const p=positions.get(id),status=BEAM_STATUS[node.status]||BEAM_STATUS.retained,selected=treeInspectNodeId===id,compact=isCompact(node),isFocus=beamExpansionMode==='focus'&&beamOutputPath.has(id);
        const isOutput=node.status==='output',topColor=node.topRank===1?'#f0a52b':node.topRank===2?'#7d63d5':node.topRank===3?'#159a7b':null;
        const spaceSolutionIndex=isOutput?(result?.autoSelection?(node.parentId===activePlanTreeId?activeSolution:null):node.solutionIndex):null;
        beamCtx.shadowColor=topColor?'rgba(240,165,43,.28)':'rgba(35,45,40,.10)';beamCtx.shadowBlur=selected?14:topColor?15:compact?3:9;beamCtx.shadowOffsetY=compact?1:4;beamCtx.fillStyle=topColor?'#fffcf3':compact?`${status.color}12`:'#fff';beamCtx.strokeStyle=topColor||status.color;beamCtx.lineWidth=topColor?3:isFocus?2.8:compact?1:1.5;beamCtx.beginPath();beamCtx.roundRect(p.x,p.y,cardW,p.h,compact?7:14);beamCtx.fill();beamCtx.stroke();beamCtx.shadowColor='transparent';
        if(isFocus&&!compact){beamCtx.save();beamCtx.setLineDash([7,5]);beamCtx.strokeStyle='rgba(21,154,123,.88)';beamCtx.lineWidth=2;beamCtx.beginPath();beamCtx.roundRect(p.x-7,p.y-7,cardW+14,p.h+14,18);beamCtx.stroke();beamCtx.restore();}
        if(selected){beamCtx.save();beamCtx.setLineDash([6,5]);beamCtx.strokeStyle='rgba(49,92,147,.9)';beamCtx.lineWidth=1.6;beamCtx.beginPath();beamCtx.roundRect(p.x-6,p.y-6,cardW+12,p.h+12,compact?10:18);beamCtx.stroke();beamCtx.restore();}
        const item=node.itemId?ITEM_BY_ID[node.itemId]:null,sizeName=node.skipped?' · 跳过（0 件）':node.pose?.sizeLabel?` · ${node.pose.sizeLabel}`:'';beamCtx.fillStyle=topColor||isOutput?'#5c46be':'#18231f';if(topColor)beamCtx.fillStyle=topColor;beamCtx.font='800 11px system-ui';beamCtx.textAlign='left';beamCtx.textBaseline='middle';const outputTitle=node.topRank?`方案 ${String.fromCharCode(64+node.topRank)} · 最终输出`:`输出方案 ${node.outputIndex}`;const nodeTitle=node.depth?`${node.depth}. ${itemStepLabel(item)||node.itemId}${sizeName}`:'0. 空房间';beamCtx.fillText(fitText(isOutput?outputTitle:nodeTitle,cardW-20),p.x+10,p.y+14);beamCtx.fillStyle=topColor||status.color;beamCtx.font='800 9px system-ui';beamCtx.textAlign='right';const continued=node.status==='retained'||node.status==='finalist'||node.status==='output';const scoreText=isOutput?`总分 ${node.score.toFixed(1)}`:continued?`排名 #${node.rank||'-'} · 累计 ${node.score.toFixed(1)} 分`:`最终累计 ${node.score.toFixed(1)} 分`;beamCtx.fillText(fitText(scoreText,cardW-20),p.x+cardW-10,p.y+30);
        if(compact){beamCtx.fillStyle=status.color;beamCtx.font='750 8px system-ui';beamCtx.textAlign='left';beamCtx.fillText(`${status.label}${node.reason?` · ${node.reason}`:''}`.slice(0,36),p.x+10,p.y+21);}
        else{
          drawBeamMiniBoard(node,p.x+10,p.y+38,cardW-20,78);
          beamCtx.textAlign='left';
          if(!continued){
            beamCtx.fillStyle=status.color;beamCtx.font='800 8px system-ui';beamCtx.fillText('未进入下一回合',p.x+10,p.y+126);
            beamCtx.font='700 8px system-ui';beamCtx.fillText(fitText(node.reason||status.label,cardW-20),p.x+10,p.y+138);
          }else{
            beamCtx.fillStyle=topColor||'#69736f';beamCtx.font='700 8px system-ui';const footer=node.topRank?`全局总分第 ${node.topRank} 名`:isFocus?'通向最终输出':'进入下一回合';beamCtx.fillText(fitText(footer,cardW-20),p.x+10,p.y+134);
          }
        }
        const availableChildren=(children.get(id)||[]).filter(node=>beamExpansionMode!=='focus'||beamOutputPath.has(node.id));
        if(availableChildren.length){
          const expanded=beamExpandedNodes.has(id),buttonX=p.x+cardW-17,buttonY=p.y+15;
          beamCtx.fillStyle=expanded?'#18231f':'#fff';beamCtx.strokeStyle=expanded?'#18231f':status.color;beamCtx.lineWidth=1.6;beamCtx.beginPath();beamCtx.roundRect(buttonX-10,buttonY-10,20,20,6);beamCtx.fill();beamCtx.stroke();
          beamCtx.strokeStyle=expanded?'#fff':status.color;beamCtx.lineWidth=2;beamCtx.beginPath();beamCtx.moveTo(buttonX-4,buttonY);beamCtx.lineTo(buttonX+4,buttonY);if(!expanded){beamCtx.moveTo(buttonX,buttonY-4);beamCtx.lineTo(buttonX,buttonY+4)}beamCtx.stroke();
          beamHitTargets.push({type:'fold',id,x:buttonX-13,y:buttonY-13,w:26,h:26});
          if(!expanded){beamCtx.fillStyle=status.color;beamCtx.font='800 8px system-ui';beamCtx.textAlign='right';beamCtx.fillText(`${availableChildren.length} 条`,buttonX-14,buttonY);}
        }
        beamHitTargets.push({type:'node',id,x:p.x,y:p.y,w:cardW,h:p.h});
      }
      beamCtx.restore();
      // 固定在视口顶部的层标题，不随纵向拖动画布消失。
      for(let depth=0;depth<=graphDepth;depth++){
        const worldX=depth*(cardW+columnGap),screenX=beamViewport.x+worldX*beamViewport.scale,bandW=Math.max(76,(cardW+columnGap)*beamViewport.scale-8);if(screenX+bandW<0||screenX>width)continue;
        const isOutput=depth>tree.rounds.length,round=depth&&!isOutput?tree.rounds[depth-1]:null,item=round?ITEM_BY_ID[round.itemId]:null,r=round?.rejectSummary||{};
        beamCtx.fillStyle='rgba(255,255,255,.92)';beamCtx.strokeStyle='rgba(24,35,31,.12)';beamCtx.lineWidth=1;beamCtx.beginPath();beamCtx.roundRect(screenX+2,8,bandW-4,34,8);beamCtx.fill();beamCtx.stroke();
        beamCtx.fillStyle=isOutput?'#5c46be':'#18231f';beamCtx.font='850 9px system-ui';beamCtx.textAlign='center';beamCtx.textBaseline='middle';beamCtx.fillText(isOutput?`输出 ${tree.outputCount||0}`:depth?`${depth}. ${itemStepLabel(item)||round.itemId}`:'0. 空房间',screenX+bandW/2,19);
        if(round){beamCtx.fillStyle='#9a5a48';beamCtx.font='700 7px system-ui';beamCtx.fillText(`静 ${r.static||0}｜撞 ${r.collision||0}｜功 ${r.functional||0}｜通 ${r.flow||0}｜岛 ${r.island||0}｜分 ${r.scoreCut||0}`,screenX+bandW/2,32);}
      }
      ui.beamSummary.textContent=`棋盘节点 ${visible.size} · 总记录 ${tree.rounds.reduce((n,r)=>n+r.nodes.length,0).toLocaleString()}`;
      ui.beamRoundOutput.textContent=`${tree.rounds.length} 回合 · ${FURNITURE.length} 件`;
      if(!treeInspectNodeId){
        const actualRecords=tree.rounds.reduce((n,r)=>n+r.nodes.length,0),mapping='每张卡片都是棋子落下后真实形成的完整棋盘；终止节点右上角显示最终累计分，底部显示未进入下一回合的原因，不做合并。最终输出层中，金色、紫色、绿色粗框分别标记方案 A、B、C。';
        const modeText=beamExpansionMode==='all'
          ?`全部展开：逐条显示 ${visible.size.toLocaleString()} 个真实状态节点，不合并、不折叠`
          :`聚焦优胜：只显示最终走到输出层的分支；绿色走廊标记完整胜出路径`;
        ui.beamDetail.innerHTML=`<strong>${modeText} · 搜索记录 ${actualRecords.toLocaleString()} 条 · 输出 ${tree.outputCount||0} 个</strong><br>${mapping} 另有 ${tree.outputDuplicateRejected||0} 个最终视觉等价方案已合并。`;
      }
      beamCtx.fillStyle='rgba(24,35,31,.48)';beamCtx.font='700 10px system-ui';beamCtx.textAlign='right';beamCtx.fillText(`画布 ${Math.round(beamViewport.scale*100)}% · ${Math.round(contentWidth)}×${Math.round(contentHeight)}`,width-16,height-14);
    }

    function renderBeamTree() {
      if(configRunMode!=='compare'){ui.beamPlanSwitch.hidden=true;ui.beamPlanSwitch.innerHTML='';}
      ui.beamPanel.classList.toggle('board-mode',beamVisualMode==='board');ui.beamBoardMode.classList.toggle('active',beamVisualMode==='board');ui.beamOverviewMode.classList.toggle('active',beamVisualMode==='overview');ui.beamExpandAll.classList.toggle('active',beamExpansionMode==='all');ui.beamFocusBest.classList.toggle('active',beamExpansionMode==='focus');ui.beamFilters.hidden=beamVisualMode!=='overview';
      if(beamVisualMode==='board')renderBeamBoardTree();else renderBeamOverview();
    }

    function inspectBeamNode(id) {
      const node=activeBeamTree()?.nodeById?.get(id);if(!node)return;
      treeInspectNodeId=id;activeState={poses:{...(node.poses||{})}};candidateSnapshotCache={key:null,value:null};
      const item=node.itemId?ITEM_BY_ID[node.itemId]:null,status=BEAM_STATUS[node.status]||BEAM_STATUS.pending;
      const pose=node.pose;
      const poseDetail=node.skipped?`；本槽位选择 0 件，本手 ${node.merit.toFixed(2)} 分，累计 ${node.score.toFixed(2)} 分`:pose?`；坐标 (${pose.x.toFixed(2)}, ${pose.y.toFixed(2)}) m，旋转 ${pose.rotation||0}°，本手 ${node.merit.toFixed(2)} 分，累计 ${node.score.toFixed(2)} 分${node.forwardDomain!=null?`，下一手合法域 ${node.forwardDomain} 个`:''}`:'';
      const heading=node.status==='output'?(node.topRank?`全局总分 TOP ${node.topRank} · 空间方案 ${String.fromCharCode(64+node.topRank)}`:`最终输出方案 ${node.outputIndex}`):node.depth?`第 ${node.depth} 回合 · ${itemStepLabel(item)||node.itemId}${node.skipped?' · 跳过（0 件）':pose?.sizeLabel?` · ${pose.sizeLabel} ${pose.overrideW.toFixed(2)}×${pose.overrideD.toFixed(2)} m`:''}`:'起始空房间';
      ui.beamDetail.innerHTML=`<strong>${heading} · ${status.label}</strong><br>${node.reason||'Beam 保留局面'}${poseDetail}。`;
      ui.depthMetric.textContent=`${node.depth} / ${FURNITURE.length}`;ui.boardStatus.textContent=`正在查看 Beam 节点 ${node.id} · ${status.label}`;
      updateScores(evaluateFull(activeState,scene));renderBeamTree();resizeAndDraw();
    }

    function drawSolutionPreview(preview,state) {
      const pctx=preview.getContext('2d'),width=preview.width,height=preview.height;
      const previewItems=state.inventoryItems||FURNITURE;
      const pad=22,scale=Math.min((width-pad*2)/scene.width,(height-pad*2)/scene.depth);
      const ox=(width-scene.width*scale)/2,oy=(height-scene.depth*scale)/2;
      const point=p=>({x:ox+p.x*scale,y:oy+p.y*scale});
      const rect=r=>({x:ox+(r.x-r.w/2)*scale,y:oy+(r.y-r.d/2)*scale,w:r.w*scale,h:r.d*scale});
      pctx.clearRect(0,0,width,height);pctx.fillStyle='#faf9f5';pctx.fillRect(0,0,width,height);
      pctx.beginPath();scene.polygon.forEach((p,i)=>{const q=point(p);i?pctx.lineTo(q.x,q.y):pctx.moveTo(q.x,q.y);});pctx.closePath();
      pctx.fillStyle='#fffef9';pctx.fill();pctx.strokeStyle='#25312d';pctx.lineWidth=3;pctx.lineJoin='round';pctx.stroke();
      drawSoftDecor(pctx,{p:point,rect},state,previewItems,'floor');
      for (const item of previewItems) {
        const pose=state.poses[item.id];if(!pose)continue;
        for (const zone of hardFunctionalZones(item,pose)) {
          const zr=rect(zone.rect);pctx.save();pctx.setLineDash([4,3]);pctx.strokeStyle='rgba(255,91,56,.58)';
          pctx.fillStyle='rgba(255,91,56,.045)';pctx.fillRect(zr.x,zr.y,zr.w,zr.h);pctx.strokeRect(zr.x,zr.y,zr.w,zr.h);pctx.restore();
        }
      }
      drawSoftDecor(pctx,{p:point,rect},state,previewItems,'overlay');
      for (const item of previewItems) {
        const pose=state.poses[item.id];if(!pose)continue;
        for (const body of footprintRects(item,pose)) {
          const r=rect(body);pctx.fillStyle=item.color;pctx.strokeStyle='rgba(13,25,21,.52)';pctx.lineWidth=1.1;
          pctx.beginPath();pctx.roundRect(r.x,r.y,r.w,r.h,Math.min(6,r.w*.08,r.h*.08));pctx.fill();pctx.stroke();
        }
        const first=rect(footprintRects(item,pose)[0]);
        if (first.w>45&&first.h>22) {pctx.fillStyle='rgba(255,255,255,.95)';pctx.font='700 9px system-ui';pctx.textAlign='center';pctx.textBaseline='middle';pctx.fillText(itemDisplayLabel(item,pose),first.x+first.w/2,first.y+first.h/2);}
      }
      pctx.strokeStyle='#ff5b38';pctx.lineWidth=4;for(const door of sceneDoors(scene)){const doorA=point(door.a||{x:door.x0,y:door.y}),doorB=point(door.b||{x:door.x1,y:door.y});pctx.beginPath();pctx.moveTo(doorA.x,doorA.y);pctx.lineTo(doorB.x,doorB.y);pctx.stroke();}
      const winA=point({x:scene.window.x0,y:0}),winB=point({x:scene.window.x1,y:0});
      pctx.strokeStyle='#43a8bd';pctx.lineWidth=5;pctx.beginPath();pctx.moveTo(winA.x,winA.y);pctx.lineTo(winB.x,winB.y);pctx.stroke();
    }

    function renderSolutions() {
      if (!result?.solutions?.length) { ui.solutionStrip.innerHTML='';ui.solutionPreviewToolbar.hidden=true; return; }
      ui.solutionPreviewToolbar.hidden=false;
      const labels=result.autoSelection?['综合最优','通行优先','功能丰富']:['总分 TOP 1','总分 TOP 2','总分 TOP 3'];
      const scoreKeys=result.autoSelection?['total','circulation','function']:['total','total','total'];
      const scoreLabels=result.autoSelection?['总分','通行','功能']:['总分','总分','总分'];
      const program=PROGRAMS[currentProgram];
      ui.solutionStrip.innerHTML=result.solutions.map((s,i)=>{
        const label=s.inventoryLabel||labels[i]||'候选方案';
        const itemCount=Object.keys(s.poses).length,decorCount=(s.decorItems||synthesizeSoftDecor(s,scene,s.inventoryItems)).length;
        const modeName={compact:'紧凑',standard:'标准',generous:'宽裕'}[s.inventoryProfile?.mode]||'自定义';
        const details=program.primaryIds.map((id,j)=>{
          const p=s.poses[id];
          return `${program.primaryLabels[j]} ${p?.wallIndex>=0?p.wallIndex+1:'关系位'}`;
        }).join(' · ');
        const score=scoreKeys[i]==='total'?s.evaluation.total:s.evaluation.scores[scoreKeys[i]];
        // 卡片展示最终模块完成度，而不是“库存类别覆盖率”。后者会把完整的
        // 会客/餐组/收纳方案显示成 66%，与右侧功能模块 100 分互相矛盾。
        const coverage=Math.round(Number(s.evaluation.scores?.modules)||0);
        return `
        <button class="solution-card ${i===activeSolution?'active':''}" data-solution="${i}" aria-label="查看方案 ${String.fromCharCode(65+i)} ${label}">
          <span class="solution-preview-viewport" title="固定比例方案缩略图"><canvas class="solution-preview" width="480" height="300" data-preview="${i}" aria-hidden="true"></canvas></span>
          <span class="solution-meta">
            <span class="solution-letter">${String.fromCharCode(65+i)}</span>
            <span><span class="solution-name">${label}</span><span class="solution-desc">${itemCount} 件硬家具 + ${decorCount} 件后补落地件 · ${modeName}尺寸 · 功能覆盖 ${coverage}% · 总 ${s.evaluation.total.toFixed(0)} / 地面 ${s.evaluation.scores.ground} / 墙面 ${s.evaluation.scores.storage} / 偏好 ${s.evaluation.scores.preference} / 激活 ${s.evaluation.scores.activation} / 通行 ${s.evaluation.scores.circulation}</span></span>
            <span class="solution-score">${Number(score).toFixed(0)}<small>${scoreLabels[i]}</small></span>
          </span>
        </button>`}).join('');
      ui.solutionStrip.querySelectorAll('[data-solution]').forEach(btn=>btn.addEventListener('click',()=>selectSolution(Number(btn.dataset.solution))));
      ui.solutionStrip.querySelectorAll('[data-preview]').forEach(preview=>drawSolutionPreview(preview,result.solutions[Number(preview.dataset.preview)]));
    }

    function selectSolution(index) {
      stopPlay();activeSolution=index;treeInspectNodeId=null;
      const chosen=result?.solutions?.[index];if(!chosen)return;
      activateSolutionInventory(chosen);setupStaticUI();
      resetBeamBoardView();
      const trace=activePlanTrace();activeState=chosen;traceIndex=trace.length-1;
      candidateSnapshotCache={key:null,value:null};
      updateScores(chosen.evaluation);renderSolutions();renderTrace();resizeAndDraw();renderBeamTree();
      ui.boardStatus.textContent=`方案 ${String.fromCharCode(65+index)} · 硬规则、多尺度通行与设计语法验证通过${result?.autoSelection?` · 上限 ${FURNITURE.length} 件 / 实际 ${Object.keys(chosen.poses).length} 件硬家具 + ${(chosen.decorItems||synthesizeSoftDecor(chosen,scene,chosen.inventoryItems)).length} 件后补落地件`:''}`;
    }

    function renderTrace() {
      const trace=activePlanTrace();
      traceIndex=clamp(traceIndex,0,trace.length-1);
      const previousLogScroll=ui.traceLog.scrollTop;
      ui.traceKicker.textContent=`${Math.max(0,trace.length-1)} 个落子`;
      const current=trace[traceIndex];
      const nextItem=trace[traceIndex+1]?.lastMove?ITEM_BY_ID[trace[traceIndex+1].lastMove.itemId]:null;
      ui.traceStatus.textContent=nextItem?`已放 ${current.depth||0} 件 · 下一手 ${nextItem.label}`:`第 ${current.depth||0} 手 / ${FURNITURE.length} · 已完成`;
      ui.traceRange.min='0';ui.traceRange.max=String(Math.max(0,trace.length-1));ui.traceRange.value=String(traceIndex);
      ui.traceRangeOutput.textContent=`${traceIndex} / ${Math.max(0,trace.length-1)}`;
      ui.traceLog.innerHTML=trace.map((s,i)=>{
        if (!s.lastMove) return `<button type="button" class="trace-entry ${i===traceIndex?'active':''}" data-trace-step="${i}">起始局面：房间边界、门窗和第一手采样已编译</button>`;
        const item=ITEM_BY_ID[s.lastMove.itemId];
        const p=s.lastMove.pose;
        const relationActions={
          'bed-side':'与床建立床组关系','desk-front':'放入书桌操作区',
          'sofa-facing':'与沙发建立视听轴','sofa-front':'放入沙发前方',
          'conversation-opposite':'放入对向会客位','conversation-side':'放入侧向会客位','sofa-side':'放入沙发边位',
          'seat-side':'放入座椅边位','sofa-ottoman':'放入沙发脚凳位','seat-ottoman':'放入单椅脚凳位','floating-sofa':'放入客厅中部锚区',
          'dining-zone':'放入客餐分区','dining-seat':'围绕餐桌落座','bed-foot':'放入床尾辅助区','vanity-seat':'放入梳妆操作区',
          'reading-corner':'放入阅读角','utility-corner':'放入收纳角','seat-light':'放入座位照明位','corner-light':'放入角落照明位','corner-accent':'放入角落软装位'
        };
        const sizeAction=p.sizeLabel?` · 选择${p.sizeLabel} ${(p.overrideW??item?.w??0).toFixed(2)}×${(p.overrideD??item?.d??0).toFixed(2)} m`:'';
        const ruleAction=p.candidateRuleId?` · 规则 ${p.candidateRuleId}`:'';
        const action=(p.relation==='custom-infill'?`末轮扫描余墙并定尺 ${p.overrideW?.toFixed(2)||''} m · 安装余缝 ${Math.round((p.installationGap||0)*1000)} mm`:p.relation==='wall-run'?`沿墙连续补齐 ${p.overrideW?.toFixed(2)||''} m`:(relationActions[p.relation]||`靠墙 ${p.wallIndex+1} 落子`))+sizeAction+ruleAction;
        const local=`局部 ${s.lastMove.merit>=0?'+':''}${s.lastMove.merit.toFixed(1)}`,partial=s.partialScore?` · 搜索累计 ${s.partialScore.toFixed(1)}`:'';
        let vector='';
        if(i===traceIndex&&s._evaluation){
          const previous=trace[i-1]?._evaluation,currentBreakdown=traceEvaluationBreakdown(s._evaluation),previousBreakdown=previous?traceEvaluationBreakdown(previous):null;
          const keys=[['ground','地面'],['wall','墙面'],['relation','关系'],['circulation','通行'],['alignment','对齐'],['daylight','采光'],['emptyWall','空墙'],['corner','墙角']];
          const parts=keys.map(([key,label])=>{const value=currentBreakdown[key],delta=previousBreakdown?value-previousBreakdown[key]:null;return `${label} ${value}${delta==null?'':` (${delta>=0?'+':''}${delta})`}`});
          const totalDelta=previous?s._evaluation.total-previous.total:null;
          const gapText=`墙缝：严重 ${currentBreakdown.severeWallGaps} · 尴尬 ${currentBreakdown.awkwardWallGaps}`;
          vector=`<span class="trace-score-detail">当前总分 ${s._evaluation.total.toFixed(1)}${totalDelta==null?'':` (${totalDelta>=0?'+':''}${totalDelta.toFixed(1)})`} · ${parts.join(' · ')}<br>${gapText}</span>`;
        }
        return `<button type="button" class="trace-entry ${i===traceIndex?'active':''}" data-trace-step="${i}">第 ${s.depth} 手：${itemStepLabel(item)} ${action}<br>${local}${partial} · 保留 ${s.beamSize||0} 个候选局面${vector}</button>`;
      }).join('');
      ui.traceLog.scrollTop=previousLogScroll;
      ui.traceLog.querySelectorAll('[data-trace-step]').forEach(button=>button.addEventListener('click',()=>showTraceStep(Number(button.dataset.traceStep))));
    }

    function showTraceStep(index) {
      if (!result)return;
      treeInspectNodeId=null;
      const viewportX=window.scrollX,viewportY=window.scrollY;
      const trace=activePlanTrace();
      traceIndex=clamp(index,0,trace.length-1);
      activeState=trace[traceIndex];
      candidateSnapshotCache={key:null,value:null};
      const evaluation=evaluateFull(activeState,scene);trace[traceIndex]._evaluation=evaluation;
      if(traceIndex>0&&!trace[traceIndex-1]._evaluation)trace[traceIndex-1]._evaluation=evaluateFull(trace[traceIndex-1],scene);
      updateScores(evaluation);
      ui.depthMetric.textContent=`${traceIndex} / ${FURNITURE.length}`;
      const nextItem=trace[traceIndex+1]?.lastMove?ITEM_BY_ID[trace[traceIndex+1].lastMove.itemId]:null;
      ui.boardStatus.textContent=nextItem?`${traceIndex?`第 ${traceIndex} 手后`:'空房间'} · 正在显示 ${nextItem.label} 的下一手采样点`:`第 ${traceIndex} 手 · 完整方案`;
      renderTrace();resizeAndDraw();renderBeamTree();
      requestAnimationFrame(()=>{if(window.scrollX!==viewportX||window.scrollY!==viewportY)window.scrollTo(viewportX,viewportY);});
    }

    function stopPlay() {
      playing=false;ui.play.textContent='▶';if(playTimer)clearTimeout(playTimer);playTimer=null;
    }

    function playTrace() {
      if (!result)return;
      const trace=activePlanTrace();
      if (playing) {stopPlay();return;}
      if (traceIndex>=trace.length-1) traceIndex=0;
      playing=true;ui.play.textContent='Ⅱ';
      const tick=()=>{
        if(!playing)return;
        showTraceStep(traceIndex);
        if(traceIndex>=trace.length-1){stopPlay();selectSolution(activeSolution);return;}
        traceIndex++;playTimer=setTimeout(tick,520);
      };
      tick();
    }

    function runSearchWithConfigProfile(profileId){
      applyServerConfigProfile(profileId);setProgram(currentProgram);refreshFurniture();
      let runScene=makeScene(shape,Number(ui.width.value),Number(ui.depth.value),Number(ui.multiplier.value)),autoSelection=null,runResult;
      if(ui.autoInventory.checked){
        autoSelection=autoSelectInventory({programId:currentProgram,shape,width:Number(ui.width.value),depth:Number(ui.depth.value),areaMultiplier:Number(ui.multiplier.value)});runScene=autoSelection.scene;runResult=autoSelection.probe;runResult.scene=runScene;runResult.autoSelection=autoSelection;runResult.stats.nodes=autoSelection.totalNodes;runResult.stats.timeMs=autoSelection.totalTimeMs;runResult.stats.avgUs=runResult.stats.matrixCandidates?runResult.stats.timeMs*1000/runResult.stats.matrixCandidates:0;
      }else{setVariableSizeSearch(false);const adaptiveBeam=Math.min(240,160+Math.max(0,FURNITURE.length-7)*8);runResult=search(runScene,{beamWidth:adaptiveBeam})}
      return {profileId,result:runResult,scene:runScene,autoSelection};
    }

    function comparisonButtonMarkup(profileId,run,buttonClass='config-compare-btn'){
      const label='当前全局配置',solution=run?.result?.solutions?.[0],placed=solution?Object.keys(solution.poses||{}).length:0,total=solution?.evaluation?.total?.toFixed(1)??'无方案',ground=solution?.evaluation?.scores?.ground??'-',wall=solution?.evaluation?.scores?.storage??'-';
      return `<button class="${buttonClass} ${activeConfigProfile===profileId?'active':''}" type="button" data-config-profile="${profileId}"><strong>${label}</strong><span>${placed} 件 · 总分 ${total} · 地面 ${ground} · 墙面 ${wall}</span></button>`;
    }
    function renderConfigComparisonSwitches(){
      const comparing=configRunMode==='compare'&&comparisonRuns.current&&comparisonRuns.default;ui.configComparisonSwitch.hidden=!comparing;
      if(!comparing){ui.configComparisonSwitch.innerHTML='';ui.beamPlanSwitch.hidden=true;ui.beamPlanSwitch.innerHTML='';return}
      ui.configComparisonSwitch.innerHTML=['current','default'].map(id=>comparisonButtonMarkup(id,comparisonRuns[id])).join('');ui.configComparisonSwitch.querySelectorAll('[data-config-profile]').forEach(button=>button.addEventListener('click',()=>activateComparisonRun(button.dataset.configProfile)));
      ui.beamPlanSwitch.hidden=false;ui.beamPlanSwitch.innerHTML=['current','default'].map(id=>comparisonButtonMarkup(id,comparisonRuns[id],'beam-plan-btn')).join('');ui.beamPlanSwitch.querySelectorAll('[data-config-profile]').forEach(button=>button.addEventListener('click',()=>activateComparisonRun(button.dataset.configProfile)));
    }
    function activateComparisonRun(profileId){
      const run=comparisonRuns[profileId];if(!run)return;applyServerConfigProfile(profileId);setProgram(currentProgram);scene=run.scene;result=run.result;activeConfigProfile=profileId;activeSolution=0;
      if(result.solutions.length)activateSolutionInventory(result.solutions[0]);setupStaticUI();ui.multiplierOutput.textContent=`${scene.areaMultiplier.toFixed(2)}×`;ui.liveRoomArea.textContent=`${scene.area.toFixed(2)} m²`;ui.roomArea.textContent=`${scene.area.toFixed(2)} m² · ${scene.width.toFixed(2)}×${scene.depth.toFixed(2)} m · ${scene.compiledAnchors.length} 锚点`;ui.nodes.textContent=result.stats.nodes.toLocaleString();ui.time.textContent=result.stats.timeMs<10?`${result.stats.timeMs.toFixed(2)} ms`:`${result.stats.timeMs.toFixed(1)} ms`;ui.us.textContent=`${result.stats.avgUs.toFixed(2)} μs`;
      if(!result.solutions.length){activeState={poses:{}};updateScores(null);ui.boardStatus.textContent='当前全局配置没有通过质量门槛的方案';renderSolutions();renderTrace();renderConfigComparisonSwitches();resizeAndDraw();renderBeamTree();return}
      const trace=activePlanTrace();traceIndex=0;activeState=trace[0];ui.depthMetric.textContent=`${trace.length-1} / ${FURNITURE.length}`;beamRoundIndex=1;treeInspectNodeId=null;resetBeamBoardView();const solution=result.solutions[0];ui.boardStatus.textContent=`正在查看当前全局配置 · ${Object.keys(solution.poses||{}).length} 件 · 总分 ${solution.evaluation.total.toFixed(1)} · 地面 ${solution.evaluation.scores.ground} · 墙面 ${solution.evaluation.scores.storage}`;renderSolutions();renderTrace();showTraceStep(lSofaDemoPending?1:0);renderConfigComparisonSwitches();renderBeamTree();
    }

    function performSearch() {
      stopPlay();ui.generate.disabled=true;comparisonRuns={};const runIds=['current'];ui.boardStatus.textContent=`正在执行当前全局配置的${DENSITY_MODES[layoutDensityMode].label}布置…`;
      const runSearch=()=>setTimeout(()=>{
        for(const profileId of runIds)comparisonRuns[profileId]=runSearchWithConfigProfile(profileId);
        ui.generate.disabled=false;activateComparisonRun('current');
        if(lSofaDemoPending){ui.boardStatus.textContent='L 形沙发已落子 · 茶几对齐主坐面，边几与单人沙发只在非贵妃侧';lSofaDemoPending=false;}
      },30);
      if(document.visibilityState==='hidden')runSearch();else requestAnimationFrame(runSearch);
    }

    let recognizedFloorplanRooms=[];
    let selectedRecognizedRoom=null;
    let floorplanPreviewImage=null;
    let floorplanPreviewTransform=null;
    let floorplanImageSequence=0;
    function drawFloorplanPreview() {
      const canvas=ui.floorplanPreview,box=canvas.parentElement,rect=box.getBoundingClientRect();
      const width=Math.max(260,Math.floor(rect.width)),height=Math.max(240,Math.floor(rect.height)),dpr=Math.max(1,Math.min(2,devicePixelRatio||1));
      canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);const context=canvas.getContext('2d');context.setTransform(dpr,0,0,dpr,0,0);
      context.clearRect(0,0,width,height);context.fillStyle='#f3f4f0';context.fillRect(0,0,width,height);
      const allPoints=recognizedFloorplanRooms.flatMap(room=>(room.rawPolygon||[]).map(point=>Array.isArray(point)?{x:Number(point[0]),y:Number(point[1])}:{x:Number(point.x),y:Number(point.y)}));
      const imageReady=floorplanPreviewImage?.complete&&floorplanPreviewImage.naturalWidth;
      const minX=imageReady?0:(allPoints.length?Math.min(...allPoints.map(p=>p.x)):0),minY=imageReady?0:(allPoints.length?Math.min(...allPoints.map(p=>p.y)):0);
      const sourceWidth=imageReady?floorplanPreviewImage.naturalWidth:(allPoints.length?Math.max(...allPoints.map(p=>p.x))-minX:1);
      const sourceHeight=imageReady?floorplanPreviewImage.naturalHeight:(allPoints.length?Math.max(...allPoints.map(p=>p.y))-minY:1);
      const scale=Math.min((width-20)/Math.max(1,sourceWidth),(height-20)/Math.max(1,sourceHeight));
      const offsetX=(width-sourceWidth*scale)/2-minX*scale,offsetY=(height-sourceHeight*scale)/2-minY*scale;
      floorplanPreviewTransform={scale,offsetX,offsetY};
      if(imageReady){context.globalAlpha=.64;context.drawImage(floorplanPreviewImage,offsetX,offsetY,sourceWidth*scale,sourceHeight*scale);context.globalAlpha=1;}
      recognizedFloorplanRooms.forEach((room,index)=>{
        if(!room.rawPolygon?.length)return;const supported=Boolean(SUPPORTED_ROOM_PROGRAM[room.type]),active=room===selectedRecognizedRoom;
        const points=room.rawPolygon.map(point=>Array.isArray(point)?{x:Number(point[0]),y:Number(point[1])}:{x:Number(point.x),y:Number(point.y)});
        context.beginPath();points.forEach((point,i)=>{const x=offsetX+point.x*scale,y=offsetY+point.y*scale;i?context.lineTo(x,y):context.moveTo(x,y);});context.closePath();
        context.fillStyle=active?'rgba(255,91,56,.34)':supported?'rgba(16,151,121,.22)':'rgba(112,122,117,.14)';context.fill();
        context.strokeStyle=active?'#ff5b38':supported?'#0e9277':'#8d9692';context.lineWidth=active?3:1.5;context.setLineDash(supported?[]:[5,4]);context.stroke();context.setLineDash([]);
        const cx=points.reduce((sum,p)=>sum+p.x,0)/points.length,cy=points.reduce((sum,p)=>sum+p.y,0)/points.length;
        context.fillStyle=active?'#b92e15':supported?'#075f50':'#626a67';context.font='800 11px sans-serif';context.textAlign='center';context.textBaseline='middle';
        context.fillText(`${index+1} ${ROOM_TYPE_LABELS[room.type]||room.type}`,offsetX+cx*scale,offsetY+cy*scale);
      });
      const openingKeys=new Set(),openings=[];
      recognizedFloorplanRooms.flatMap(room=>room.openings||[]).forEach(opening=>{
        if(!opening.rawPoints?.length)return;const key=`${opening.type}:${opening.rawPoints.map(point=>`${point.x},${point.y}`).join('|')}`;
        if(!openingKeys.has(key)){openingKeys.add(key);openings.push(opening);}
      });
      openings.forEach(opening=>{
        const a=opening.rawPoints[0],b=opening.rawPoints[1],ax=offsetX+a.x*scale,ay=offsetY+a.y*scale,bx=offsetX+b.x*scale,by=offsetY+b.y*scale,isDoor=opening.type.startsWith('door');
        context.strokeStyle=isDoor?'#ff5b38':'#31a7bf';context.lineWidth=isDoor?4:5;context.beginPath();context.moveTo(ax,ay);context.lineTo(bx,by);context.stroke();
        if(isDoor){const label=`${dist(opening.points[0],opening.points[1]).toFixed(1)}m`;context.font='800 9px sans-serif';context.textAlign='center';context.textBaseline='bottom';context.fillStyle='#d94326';context.fillText(label,(ax+bx)/2,(ay+by)/2-4);}
      });
      ui.floorplanPreviewEmpty.hidden=Boolean(imageReady||recognizedFloorplanRooms.length);
    }
    function setFloorplanPreviewFile(file) {
      recognizedFloorplanRooms=[];selectedRecognizedRoom=null;
      ui.recognizedSizeEditor.hidden=true;
      const sequence=++floorplanImageSequence;
      if(!file){floorplanPreviewImage=null;drawFloorplanPreview();return;}
      const url=URL.createObjectURL(file),image=new Image();floorplanPreviewImage=image;
      image.onload=()=>{URL.revokeObjectURL(url);if(sequence===floorplanImageSequence)drawFloorplanPreview();};
      image.onerror=()=>{URL.revokeObjectURL(url);if(sequence===floorplanImageSequence){floorplanPreviewImage=null;drawFloorplanPreview();}};image.src=url;
    }
    function setFloorplanPreviewUrl(url) {
      if(!url)return;const sequence=++floorplanImageSequence,image=new Image();
      image.onload=()=>{if(sequence!==floorplanImageSequence)return;floorplanPreviewImage=image;drawFloorplanPreview();};
      image.onerror=()=>{if(sequence===floorplanImageSequence)ui.recognitionStatus.textContent+=' 原始响应图加载失败，暂时保留上传预览图。';};
      image.src=url;
    }
    function renderRecognizedRooms(rooms) {
      recognizedFloorplanRooms=rooms;
      ui.recognizedRooms.replaceChildren();
      if(!rooms.length){ui.recognitionStatus.textContent='接口已返回，但没有读到可展示的房间；请检查 room_data。';drawFloorplanPreview();return;}
      rooms.forEach((room,index)=>{
        const supported=Boolean(SUPPORTED_ROOM_PROGRAM[room.type]&&room.polygon&&room.width>=1&&room.depth>=1);
        const button=document.createElement('button');button.type='button';button.className=`recognized-room${room===selectedRecognizedRoom?' active':''}`;button.disabled=!supported;
        const indexBox=document.createElement('span');indexBox.className='room-index';indexBox.textContent=String(index+1);
        const copy=document.createElement('span');const title=document.createElement('strong');title.textContent=ROOM_TYPE_LABELS[room.type]||room.type;
        const meta=document.createElement('small');meta.textContent=room.polygon?`${room.area.toFixed(1)} ㎡ · ${room.width.toFixed(2)} × ${room.depth.toFixed(2)} m`:'接口未返回轮廓';copy.append(title,meta);
        const support=document.createElement('span');support.className='room-support';support.textContent=supported?'选择并排布':SUPPORTED_ROOM_PROGRAM[room.type]?'轮廓不可用':'暂未接入';
        button.append(indexBox,copy,support);if(supported)button.addEventListener('click',()=>applyRecognizedRoom(room));ui.recognizedRooms.append(button);
      });
      const enabled=rooms.filter(room=>SUPPORTED_ROOM_PROGRAM[room.type]&&room.polygon).length;
      ui.recognitionStatus.textContent=`识别到 ${rooms.length} 个房间，其中 ${enabled} 个客厅/卧室可进入排布。`;
      ui.recognizedSizeEditor.hidden=!selectedRecognizedRoom;
      drawFloorplanPreview();
    }
    let uploadedFloorplanId=null;
    let floorplanUploadSequence=0;
    const floorplanApiBase=location.origin==='http://127.0.0.1:8765'?'':'http://127.0.0.1:8765';
    function resolveFloorplanAssetUrl(value,fallback='') {
      const source=String(value||fallback||'').trim();
      if(!source)return '';
      if(/^(?:https?:|data:|blob:)/i.test(source))return source;
      if(source.startsWith('/'))return floorplanApiBase?`${floorplanApiBase}${source}`:source;
      try{return new URL(source,location.href).href;}catch{return source;}
    }
    function getFloorplanRawImage(payload) {
      const responseData=payload?.data||payload||{};
      return responseData.raw_image||responseData.rawImage||payload?.raw_image||payload?.rawImage||'';
    }
    async function fetchJsonWithRetry(url,options,label,maxAttempts=3) {
      let lastError=null;
      for(let attempt=1;attempt<=maxAttempts;attempt++){
        try{
          const response=await fetch(url,options),text=await response.text();
          if(!text.trim())throw new Error(`${label}返回空响应（HTTP ${response.status}）`);
          let data;try{data=JSON.parse(text);}catch{throw new Error(`${label}返回了不完整的 JSON（HTTP ${response.status}）`);}
          if(!response.ok||Number(data?.status)>=400)throw new Error(data?.message||data?.msg||data?.detail||`${label}失败（HTTP ${response.status}）`);
          return data;
        }catch(error){
          lastError=error;if(attempt<maxAttempts)await new Promise(resolve=>setTimeout(resolve,400*attempt));
        }
      }
      throw lastError||new Error(`${label}失败`);
    }
    async function uploadFloorplan(fileOverride=null) {
      const file=fileOverride instanceof File?fileOverride:ui.floorplanFile.files?.[0];
      uploadedFloorplanId=null;ui.runRecognition.disabled=true;ui.recognizedRooms.replaceChildren();
      const sequence=++floorplanUploadSequence;
      setFloorplanPreviewFile(file);
      if(!file){ui.recognitionStatus.textContent='选择文件后将自动上传';return;}
      try{
        ui.recognitionStatus.textContent=`正在上传：${file.name}…`;
        const form=new FormData();form.append('image_obj_bytes',file,file.name);
        const upload=await fetchJsonWithRetry(`${floorplanApiBase}/api/upload`,{method:'POST',body:form},'上传');
        const imageId=upload?.data?.image_id||upload?.image_id;if(!imageId)throw new Error('上传响应中没有 data.image_id');
        if(sequence!==floorplanUploadSequence)return;
        uploadedFloorplanId=imageId;ui.runRecognition.disabled=false;
        ui.recognitionStatus.textContent=`上传完成：${file.name}。点击“开始推理”。`;
      }catch(error){if(sequence===floorplanUploadSequence)ui.recognitionStatus.textContent=`上传失败：${error.message}。请确认 floorplan_api.py 正在运行。`;}
    }
    async function loadQuickSample(button) {
      const sampleUrl=button.dataset.sampleUrl,sampleJson=button.dataset.sampleJson,area=Number(button.dataset.sampleArea)||80;
      document.querySelectorAll('.quick-sample').forEach(item=>item.classList.toggle('active',item===button));
      // 示例已经固化了完整识别响应：切换示例时只读取本地图片与 JSON，
      // 不再生成 File、不调用上传接口，也不产生可继续远端推理的 image_id。
      floorplanUploadSequence++;uploadedFloorplanId=null;ui.floorplanFile.value='';ui.floorplanArea.value=String(area);ui.runRecognition.disabled=true;ui.recognizedRooms.replaceChildren();ui.recognitionStatus.textContent='正在读取本地示例结果…';
      try{
        const fallbackImageUrl=resolveFloorplanAssetUrl(sampleUrl);
        const jsonUrl=resolveFloorplanAssetUrl(sampleJson);
        if(!jsonUrl)throw new Error('示例没有配置本地 JSON');
        const cached=await fetchJsonWithRetry(jsonUrl,{cache:'force-cache'},'本地示例',1);
        const rawImageUrl=resolveFloorplanAssetUrl(getFloorplanRawImage(cached),fallbackImageUrl);
        setFloorplanPreviewUrl(rawImageUrl);
        renderRecognizedRooms(prepareRecognizedRooms(cached,area));
        ui.recognitionStatus.textContent=`本地示例已载入 · ${recognizedFloorplanRooms.length} 个房间 · 叠图底图：${getFloorplanRawImage(cached)?'JSON raw_image':'示例缩略图（JSON 无 raw_image）'}。`;
      }catch(error){ui.recognitionStatus.textContent=`示例载入失败：${error.message}`;}
    }
    async function runFloorplanRecognition() {
      if(!uploadedFloorplanId){ui.recognitionStatus.textContent='请先选择文件并等待自动上传完成。';return;}
      ui.runRecognition.disabled=true;ui.recognizedRooms.replaceChildren();
      const apiBase=location.origin==='http://127.0.0.1:8765'?'':'http://127.0.0.1:8765';
      const recognizeUrl=`${apiBase}/api/recognize`;
      try{
        ui.recognitionStatus.textContent='正在推理房间类型与轮廓…';
        const inputArea=Math.max(1,Number(ui.floorplanArea.value)||80);
        const recognized=await fetchJsonWithRetry(recognizeUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image_id:uploadedFloorplanId,input_area:inputArea,use_conver:false})},'推理');
        setFloorplanPreviewUrl(resolveFloorplanAssetUrl(getFloorplanRawImage(recognized)));
        renderRecognizedRooms(prepareRecognizedRooms(recognized,inputArea));
      }catch(error){ui.recognitionStatus.textContent=`识别失败：${error.message}。请确认 floorplan_api.py 正在运行。`;}
      finally{ui.runRecognition.disabled=!uploadedFloorplanId;}
    }
    function applyRecognizedRoom(room) {
      const programId=SUPPORTED_ROOM_PROGRAM[room.type];if(!programId||!room.polygon)return;
      selectedRecognizedRoom=room;renderRecognizedRooms(recognizedFloorplanRooms);
      recognizedRoomOverride={programId,polygon:room.polygon,openings:room.openings||[],sourceType:room.type};setProgram(programId);shape='recognized';
      ui.width.value=room.width.toFixed(2);ui.depth.value=room.depth.toFixed(2);ui.multiplier.value='1';ui.autoInventory.checked=true;setVariableSizeSearch(true);
      ui.recognizedSizeEditor.hidden=false;ui.recognizedSizeTitle.textContent=`${ROOM_TYPE_LABELS[room.type]} · 识别房间尺寸测试`;
      ui.recognizedTestWidth.value=room.width.toFixed(2);ui.recognizedTestDepth.value=room.depth.toFixed(2);
      document.querySelectorAll('.program-tab').forEach(button=>button.classList.toggle('active',button.dataset.program===programId));
      document.querySelectorAll('.shape-tab').forEach(button=>button.classList.remove('active'));
      setupStaticUI();setAppView('layout');compileCurrentScene(true);
      ui.boardStatus.textContent=`已载入识别结果 · ${ROOM_TYPE_LABELS[room.type]} ${room.area.toFixed(1)} ㎡ · 可修改顶部宽/深或面积倍率继续测试`;
    }

    document.querySelectorAll('.shape-tab').forEach(btn=>btn.addEventListener('click',()=>{
      recognizedRoomOverride=null;shape=btn.dataset.shape;document.querySelectorAll('.shape-tab').forEach(b=>b.classList.toggle('active',b===btn));compileCurrentScene(true);
    }));
    document.querySelectorAll('.program-tab').forEach(btn=>btn.addEventListener('click',()=>{
      recognizedRoomOverride=null;setProgram(btn.dataset.program);
      const program=PROGRAMS[currentProgram];
      ui.width.value=program.defaultWidth;ui.depth.value=program.defaultDepth;
      document.querySelectorAll('.program-tab').forEach(b=>b.classList.toggle('active',b===btn));
      setupStaticUI();compileCurrentScene(true);
    }));
    document.querySelectorAll('.density-tab').forEach(btn=>btn.addEventListener('click',()=>{
      if(btn.disabled||btn.dataset.density!=='rich')return;
      layoutDensityMode='rich';
      document.querySelectorAll('.density-tab').forEach(button=>button.classList.toggle('active',button===btn));
      saveConfigToBrowser(`已切换为${DENSITY_MODES[layoutDensityMode].label}布置`);compileCurrentScene(true);
    }));
    document.querySelectorAll('.config-run-tab').forEach(btn=>btn.addEventListener('click',()=>{
      configRunMode=['current','default','compare'].includes(btn.dataset.configRun)?btn.dataset.configRun:'current';activeConfigProfile=configRunMode==='default'?'default':'current';comparisonRuns={};
      document.querySelectorAll('.config-run-tab').forEach(button=>button.classList.toggle('active',button===btn));renderConfigComparisonSwitches();compileCurrentScene(false);performSearch();
    }));
    ui.furnitureConfig.addEventListener('change',event=>{
      const target=event.target;
      const config=CONFIGS[currentProgram];
      if (target.matches('[data-sofa-preset]')) {
        const variant=configuredSofaVariant(target.value);
        config.sofaPreset=variant.id;
        config.dimensions.sofa={w:variant.w,d:variant.d};
      } else if (target.dataset.configCount) {
        const typeId=target.dataset.configCount;
        const type=PROGRAMS[currentProgram].types.find(item=>item.id===typeId);
        config.counts[typeId]=clamp(Math.round(Number(target.value)||0),type.minCount,type.maxCount);
        if (currentProgram==='living'&&typeId==='diningChair'&&config.counts.diningChair>0) config.counts.diningTable=1;
        if (currentProgram==='living'&&typeId==='diningTable'&&config.counts.diningTable===0) config.counts.diningChair=0;
        if (currentProgram==='bedroom'&&typeId==='vanityStool'&&config.counts.vanityStool>0) config.counts.vanity=1;
        if (currentProgram==='bedroom'&&typeId==='vanity'&&config.counts.vanity===0) config.counts.vanityStool=0;
      } else if (target.dataset.configType&&target.dataset.configDim) {
        const typeId=target.dataset.configType;
        const dim=target.dataset.configDim;
        const value=Number(target.value);
        config.dimensions[typeId][dim]=clamp(Number.isFinite(value)?value:config.dimensions[typeId][dim],dim==='w'?.3:.25,dim==='w'?4.2:3.2);
      } else return;
      refreshFurniture();saveConfigToBrowser();setupStaticUI();compileCurrentScene(true);
    });
    let dimensionFrame=0;
    const updateDimensionsLive=()=>{
      if(!Number.isFinite(Number(ui.width.value))||!Number.isFinite(Number(ui.depth.value)))return;
      // 识别房间中修改宽深属于“按原轮廓缩放测试”，不再退出识别模式。
      if(shape!=='recognized')recognizedRoomOverride=null;
      cancelAnimationFrame(dimensionFrame);dimensionFrame=requestAnimationFrame(()=>compileCurrentScene(true));
    };
    [ui.width,ui.depth].forEach(input=>input.addEventListener('input',updateDimensionsLive));
    ui.autoInventory.addEventListener('change',()=>{setVariableSizeSearch(ui.autoInventory.checked);saveConfigToBrowser();setupStaticUI();compileCurrentScene(true);});
    ui.customCabinet.addEventListener('change',()=>{setCustomCabinetEnabled(ui.customCabinet.checked);saveConfigToBrowser(customCabinetEnabled?'已开启常规模数定制柜收口':'已关闭定制柜生成');setupStaticUI();compileCurrentScene(true);});
    ui.exportConfig.addEventListener('click',()=>{
      const blob=new Blob([JSON.stringify(currentConfigBundle(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=`空间棋配置-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),0);ui.configSaveStatus.textContent='配置 JSON 已导出';
    });
    ui.importConfig.addEventListener('click',()=>{ui.importConfigFile.value='';ui.importConfigFile.click();});
    ui.importConfigFile.addEventListener('change',async()=>{
      const file=ui.importConfigFile.files?.[0];if(!file)return;
      try{applyUserConfig(JSON.parse(await file.text()));ui.configSaveStatus.textContent=`已加载：${file.name}`;}
      catch(error){ui.configSaveStatus.textContent=`配置加载失败：${error.message}`;}
    });
    ui.resetConfig.addEventListener('click',()=>{
      if(!confirm('清除当前浏览器中的旧家具目录、配置档案和空间棋参数，并重新载入代码内置的最新默认配置？'))return;
      [
        LOCAL_CONFIG_KEY,
        FURNITURE_CATALOG_KEY,
        'room-chess-furniture-rule-profiles-v1',
        'room-chess-furniture-rule-active-profile-v1'
      ].forEach(key=>localStorage.removeItem(key));
      // 旧目录是在脚本启动阶段编译进 PROGRAMS/FURNITURE_RULES 的，单纯修改表单无法撤销；
      // 必须重新载入，让页面从源代码中的最新规则重新构建整个棋子库。
      location.reload();
    });
    ui.multiplier.addEventListener('input',updateDimensionsLive);
    ui.generate.addEventListener('click',performSearch);
    ui.reset.addEventListener('click',()=>compileCurrentScene(false));
    ui.recognizeFloorplan.addEventListener('click',()=>{ui.recognitionModal.hidden=false;document.body.classList.add('recognition-open');setTimeout(()=>{resizeAndDraw();drawFloorplanPreview();},230);});
    ui.closeRecognition.addEventListener('click',()=>{ui.recognitionModal.hidden=true;document.body.classList.remove('recognition-open');setTimeout(resizeAndDraw,230);});
    ui.floorplanFile.addEventListener('change',()=>{document.querySelectorAll('.quick-sample').forEach(item=>item.classList.remove('active'));uploadFloorplan();});
    ui.recognizedSizeReset.addEventListener('click',()=>{
      if(!selectedRecognizedRoom)return;
      ui.recognizedTestWidth.value=selectedRecognizedRoom.width.toFixed(2);ui.recognizedTestDepth.value=selectedRecognizedRoom.depth.toFixed(2);
      ui.width.value=ui.recognizedTestWidth.value;ui.depth.value=ui.recognizedTestDepth.value;ui.multiplier.value='1';compileCurrentScene(true);
    });
    ui.recognizedSizeApply.addEventListener('click',()=>{
      if(!selectedRecognizedRoom||shape!=='recognized')return;
      const width=clamp(Number(ui.recognizedTestWidth.value)||selectedRecognizedRoom.width,1,12),depth=clamp(Number(ui.recognizedTestDepth.value)||selectedRecognizedRoom.depth,1,12);
      ui.recognizedTestWidth.value=width.toFixed(2);ui.recognizedTestDepth.value=depth.toFixed(2);ui.width.value=width.toFixed(2);ui.depth.value=depth.toFixed(2);compileCurrentScene(true);
      ui.boardStatus.textContent=`识别轮廓尺寸测试 · ${width.toFixed(2)} × ${depth.toFixed(2)} m · 门窗已同步缩放`;
    });
    document.querySelectorAll('.quick-sample').forEach(button=>button.addEventListener('click',()=>loadQuickSample(button)));
    ui.runRecognition.addEventListener('click',runFloorplanRecognition);
    ui.floorplanPreview.addEventListener('click',event=>{
      if(!floorplanPreviewTransform)return;const rect=ui.floorplanPreview.getBoundingClientRect(),t=floorplanPreviewTransform;
      const point={x:(event.clientX-rect.left-t.offsetX)/t.scale,y:(event.clientY-rect.top-t.offsetY)/t.scale};
      const target=recognizedFloorplanRooms.filter(room=>SUPPORTED_ROOM_PROGRAM[room.type]&&room.rawPolygon?.length)
        .sort((a,b)=>(a.source?.rawArea||Infinity)-(b.source?.rawArea||Infinity))
        .find(room=>pointInPolygon(point,room.rawPolygon.map(value=>Array.isArray(value)?{x:Number(value[0]),y:Number(value[1])}:{x:Number(value.x),y:Number(value.y)})));
      if(target)applyRecognizedRoom(target);
    });
    ui.lSofaDemo.addEventListener('click',()=>{
      setProgram('living');const config=CONFIGS.living,preset=configuredSofaVariants().find(variant=>variant.shape==='l-left');
      if(!preset){ui.boardStatus.textContent='当前家具配置没有左贵妃 L 形沙发；请先在配置中心为沙发启用该形状变体。';return;}
      config.sofaPreset=preset.id;config.dimensions.sofa={w:preset.w,d:preset.d};
      config.counts={...config.counts,sofa:1,tv:1,coffee:1,diningTable:0,diningChair:0,sideboard:1,bookcase:0,display:0,console:0,arm:1,ottoman:0,side:1,floorLamp:0,plant:0};
      refreshFurniture();shape='rect';ui.width.value='5.8';ui.depth.value='4.8';ui.multiplier.value='1';ui.autoInventory.checked=false;ui.bitset.checked=true;
      ui.stepCandidates.checked=false;setVariableSizeSearch(false);lSofaDemoPending=true;
      document.querySelectorAll('.program-tab').forEach(button=>button.classList.toggle('active',button.dataset.program==='living'));
      document.querySelectorAll('.shape-tab').forEach(button=>button.classList.toggle('active',button.dataset.shape==='rect'));
      setupStaticUI();setAppView('layout');compileCurrentScene(true);
    });
    ui.envelope.addEventListener('change',resizeAndDraw);ui.anchors.addEventListener('change',resizeAndDraw);ui.stepCandidates.addEventListener('change',resizeAndDraw);ui.bitset.addEventListener('change',resizeAndDraw);
    ui.prev.addEventListener('click',()=>showTraceStep(traceIndex-1));
    ui.next.addEventListener('click',()=>showTraceStep(traceIndex+1));
    ui.play.addEventListener('click',playTrace);
    ui.traceRange.addEventListener('input',()=>{stopPlay();showTraceStep(Number(ui.traceRange.value));});
    const setAppView=mode=>{const treeMode=mode==='tree';ui.appShell.classList.toggle('tree-mode',treeMode);ui.layoutView.classList.toggle('active',!treeMode);ui.treeView.classList.toggle('active',treeMode);if(treeMode)requestAnimationFrame(renderBeamTree);else requestAnimationFrame(resizeAndDraw);};
    ui.layoutView.addEventListener('click',()=>setAppView('layout'));ui.treeView.addEventListener('click',()=>setAppView('tree'));
    ui.beamBoardMode.addEventListener('click',()=>{beamVisualMode='board';resetBeamBoardView();renderBeamTree();});
    ui.beamOverviewMode.addEventListener('click',()=>{beamVisualMode='overview';treeInspectNodeId=null;renderBeamTree();});
    ui.beamExpandAll.addEventListener('click',()=>{beamExpansionMode='all';beamVisualMode='board';resetBeamBoardView();renderBeamTree();});
    ui.beamFocusBest.addEventListener('click',()=>{beamExpansionMode='focus';beamVisualMode='board';resetBeamBoardView();renderBeamTree();});
    ui.beamResetView.addEventListener('click',()=>{if(beamVisualMode==='board')resetBeamBoardView();else{beamRoundIndex=1;treeInspectNodeId=null;}renderBeamTree();});
    ui.beamFullscreen.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await ui.beamPanel.requestFullscreen();}catch{ui.beamDetail.innerHTML='<strong>无法进入全屏</strong><br>当前浏览器限制了本地文件的全屏权限，可使用浏览器菜单或 F11。';}});
    document.addEventListener('fullscreenchange',()=>{ui.beamFullscreen.textContent=document.fullscreenElement?'退出全屏':'全屏查看';requestAnimationFrame(renderBeamTree);});
    ui.beamRound.addEventListener('input',()=>{beamRoundIndex=Number(ui.beamRound.value);treeInspectNodeId=null;renderBeamTree();});
    ui.beamFilters.addEventListener('click',event=>{const button=event.target.closest('[data-beam-filter]');if(!button)return;beamFilter=button.dataset.beamFilter;treeInspectNodeId=null;ui.beamFilters.querySelectorAll('[data-beam-filter]').forEach(btn=>btn.classList.toggle('active',btn===button));renderBeamTree();});
    beamCanvas.addEventListener('click',event=>{if(beamSuppressClick){beamSuppressClick=false;return;}const rect=beamCanvas.getBoundingClientRect(),sx=event.clientX-rect.left,sy=event.clientY-rect.top;
      if(beamVisualMode==='board'){const x=(sx-beamViewport.x)/beamViewport.scale,y=(sy-beamViewport.y)/beamViewport.scale,hits=[...beamHitTargets].reverse().filter(t=>x>=t.x&&x<=t.x+t.w&&y>=t.y&&y<=t.y+t.h),target=hits.find(t=>t.type==='fold')||hits[0];if(!target)return;
        if(target.type==='fold'){if(beamExpandedNodes.has(target.id))beamExpandedNodes.delete(target.id);else beamExpandedNodes.add(target.id);beamNeedsCenter=true;renderBeamTree();return;}
        beamExpandedNodes.add(target.id);inspectBeamNode(target.id);return;
      }
      const roundTarget=beamHitTargets.find(t=>t.type==='round'&&sx>=t.x&&sx<=t.x+t.w&&sy>=t.y&&sy<=t.y+t.h);if(roundTarget){beamRoundIndex=roundTarget.round;treeInspectNodeId=null;renderBeamTree();return;}let nearest=null,best=Infinity;for(const target of beamHitTargets){if(target.type!=='node')continue;const distance=Math.hypot(sx-target.x,sy-target.y);if(distance<=target.r&&distance<best){nearest=target;best=distance;}}if(nearest)inspectBeamNode(nearest.id);
    });
    beamCanvas.addEventListener('wheel',event=>{if(beamVisualMode!=='board')return;event.preventDefault();const rect=beamCanvas.getBoundingClientRect(),mx=event.clientX-rect.left,my=event.clientY-rect.top,old=beamViewport.scale,next=clamp(old*Math.exp(-event.deltaY*.001),.06,1.65),wx=(mx-beamViewport.x)/old,wy=(my-beamViewport.y)/old;beamViewport.scale=next;beamViewport.x=mx-wx*next;beamViewport.y=my-wy*next;renderBeamTree();},{passive:false});
    beamCanvas.addEventListener('pointerdown',event=>{if(beamVisualMode!=='board')return;beamDrag={x:event.clientX,y:event.clientY,originX:beamViewport.x,originY:beamViewport.y,moved:false};beamCanvas.setPointerCapture(event.pointerId);beamCanvas.classList.add('dragging');});
    beamCanvas.addEventListener('pointermove',event=>{if(beamDrag){const dx=event.clientX-beamDrag.x,dy=event.clientY-beamDrag.y;if(Math.hypot(dx,dy)>3)beamDrag.moved=true;beamViewport.x=beamDrag.originX+dx;beamViewport.y=beamDrag.originY+dy;renderBeamTree();return;}const rect=beamCanvas.getBoundingClientRect(),sx=event.clientX-rect.left,sy=event.clientY-rect.top;if(beamVisualMode==='board'){const x=(sx-beamViewport.x)/beamViewport.scale,y=(sy-beamViewport.y)/beamViewport.scale;beamCanvas.style.cursor=beamHitTargets.some(t=>x>=t.x&&x<=t.x+t.w&&y>=t.y&&y<=t.y+t.h)?'pointer':'grab';}else beamCanvas.style.cursor=beamHitTargets.some(t=>t.type==='round'?sx>=t.x&&sx<=t.x+t.w&&sy>=t.y&&sy<=t.y+t.h:Math.hypot(sx-t.x,sy-t.y)<=t.r)?'pointer':'crosshair';});
    beamCanvas.addEventListener('pointerup',event=>{if(beamDrag?.moved)beamSuppressClick=true;beamDrag=null;beamCanvas.classList.remove('dragging');try{beamCanvas.releasePointerCapture(event.pointerId);}catch{}});
    beamCanvas.addEventListener('dblclick',event=>{if(beamVisualMode!=='board')return;const rect=beamCanvas.getBoundingClientRect(),sx=event.clientX-rect.left,sy=event.clientY-rect.top,x=(sx-beamViewport.x)/beamViewport.scale,y=(sy-beamViewport.y)/beamViewport.scale,target=[...beamHitTargets].reverse().find(t=>t.type==='node'&&x>=t.x&&x<=t.x+t.w&&y>=t.y&&y<=t.y+t.h);if(!target)return;beamViewport.x=rect.width/2-(target.x+target.w/2)*beamViewport.scale;beamViewport.y=rect.height/2-(target.y+target.h/2)*beamViewport.scale;renderBeamTree();});
    window.addEventListener('resize',()=>{resizeAndDraw();renderBeamTree();drawFloorplanPreview();});

    const serverCatalogLoaded=await loadFurnitureCatalogFromServer();
    if(serverCatalogLoaded){ui.configSaveStatus.textContent='当前全局配置已生效（唯一规则源）';}
    else{
      ui.configSaveStatus.textContent='全局配置无效或服务未启动，已停止排布';
      ui.boardStatus.textContent='请通过 python floorplan_api.py 启动，并检查 /api/furniture-config';
      ui.generate.disabled=true;
      return;
    }
    setupStaticUI();compileCurrentScene();
    const initialParams=new URLSearchParams(location.search);
    if(initialParams.get('demo')==='lsofa')ui.lSofaDemo.click();
    else{
      if(initialParams.get('view')==='tree')setAppView('tree');
      setTimeout(performSearch,420);
    }
  })();
  /* ROOM_CHESS_ENGINE_END */
