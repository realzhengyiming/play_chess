  (async()=>{
    'use strict';
    // 配置只保存在 FastAPI 的唯一全局文件中；浏览器不再读写 cookie/localStorage。
    const ENABLE_LOCAL_CONFIG_PERSISTENCE=false;
    const GLOBAL_CONFIG_API='/api/furniture-config';
    const BASELINE_VERSION=16;
    const STORAGE_KEY='room-chess-furniture-rule-catalog-v1';
    const PROFILE_STORAGE_KEY='room-chess-furniture-rule-profiles-v1';
    const ACTIVE_PROFILE_KEY='room-chess-furniture-rule-active-profile-v1';
    const DEFAULT_ROOM_TYPES=[{id:'bedroom',label:'卧室',engineEnabled:true},{id:'living',label:'客厅',engineEnabled:true}];
    const DEFAULT_COUNTS={bedroom:{bed:1,night:2,wardrobe:1,desk:1,chair:1,bench:0,chest:0,shelf:0,tvbench:0,bedroomDisplay:0,lounge:0,bedroomLoveseat:0,bedroomTeaTable:0,vanity:0,vanityStool:0,bedroomInfillCabinet:1,bedroomRug:1},living:{sofa:1,tv:1,coffee:1,diningTable:0,diningChair:0,sideboard:0,bookcase:0,display:0,console:0,arm:2,ottoman:0,side:1,floorLamp:1,plant:0,infillCabinet:1,livingRug:0}};
    const DEFAULT_DESIGN_QUALITY_RULES={
      version:2,weights:{function:.22,ground:.26,wall:.22,relation:.15,circulation:.15},
      floor:{gridStep:.24,humanRadius:.23,pocketMinArea:.08,pocketMaxArea:1.45,severeUnreachableRatio:.055,severeNarrowRatio:.12,balanceIdeal:.13,balanceSevere:.28,largestOpenMin:.12,largestOpenMax:.44},
      wall:{installGapMax:.08,severeGapMin:.08,severeGapMax:.42,awkwardGapMax:.68,usefulBayMin:.70},
      gates:{minGround:58,minWall:50,minModules:65,severeDefectCap:64,weakFieldCap:78}
    };
    const DEFAULT_LAYOUT_CONSTRAINTS={
      version:1,
      circulation:{
        rasterStep:.14,requireZeroIslands:true,pruneDuringSearch:true,maxIslandArea:.025,hardLevelId:'tight',
        levels:[{id:'tight',radius:.25},{id:'normal',radius:.30},{id:'comfortable',radius:.40}],
        searchChecks:{
          guideTypes:{
            bedroom:['bed','night','wardrobe','desk','chair','vanity','vanityStool','bench','lounge','bedroomLoveseat','bedroomTeaTable','tvbench','chest','shelf','bedroomDisplay'],
            living:['coffee','diningTable','sideboard','bookcase','display','console']
          },
          // 途中只剪已经稳定的核心拓扑；餐桌椅等“尚未成组”的中间盘面只记引导分。
          // 完整方案仍无条件执行 0.5m 通行与零孤岛硬验收。
          hardPruneTypes:{bedroom:[],living:[]},
          hardPruneLastSlotTypes:{bedroom:[],living:[]}
        }
      },
      densityModes:{
        airy:{enabled:false,label:'疏朗',density:.82,capacity:.82,skip:-5,categoryBoost:{storage:.86,comfort:.82,decor:.65}},
        standard:{enabled:false,label:'标准',density:1,capacity:1,skip:0,categoryBoost:{storage:1,comfort:1,decor:1}},
        rich:{enabled:true,label:'丰富',density:1.24,capacity:1.40,skip:14,categoryBoost:{storage:1.34,comfort:1.28,decor:1.36}}
      },
      inventory:{
        variantModeByArea:{living:{diningTable:[{minArea:34,mode:'generous'}]},bedroom:{}},
        // 长条卧室不再只试“床+电视柜+小沙发”的七件锚点盘。
        // 以下真实家具同时进入一盘棋，放不下的单件由 skip 分支放弃。
        longBedroomChallenge:{enabled:true,shape:'recognized',minArea:20,minAspect:1.65,counts:{night:1,tvbench:1,bench:1,bedroomLoveseat:1,bedroomTeaTable:1,bedroomDisplay:1,chest:1},requiredCounts:{bench:1,bedroomDisplay:1}},
        focusChallenges:{bedroom:[
          {minArea:11.5,maxArea:13.19,target:{bench:1}},
          {minArea:13.2,maxArea:14.5,target:{tvbench:1},challenge:{tvbench:1,bench:1}}
        ],living:[]},
        stagedSupport:{living:[
          {minArea:0,target:{},irregularTarget:{}},
          {minArea:14,target:{display:1},irregularTarget:{display:1}},
          {minArea:19,target:{bookcase:1,display:1},irregularTarget:{display:1}},
          {minArea:24,target:{sideboard:1,display:1},irregularTarget:{display:1}},
          {minArea:34,target:{sideboard:1,bookcase:2,display:1,console:1},irregularTarget:{sideboard:1,bookcase:1,display:1,console:1}}
        ],bedroom:[{minArea:0,target:{}}]},
        roomAreaModules:{
          bedroom:[{id:'micro-bedroom',label:'微型卧室',minArea:0,modules:['sleep']},{id:'sleep',label:'睡眠卧室',minArea:9,modules:['sleep']},{id:'work-bedroom',label:'工作卧室',minArea:10,modules:['sleep','work']},{id:'suite-lounge',label:'套房会客',minArea:20,modules:['sleep','work','lounge']},{id:'studio',label:'超大单间',minArea:32,modules:['sleep','work','lounge','storage']}],
          living:[{id:'compact-living',label:'紧凑会客厅',minArea:0,modules:['conversation']},{id:'living',label:'标准会客厅',minArea:14,modules:['conversation','guest-seating']},{id:'living-dining',label:'客餐厅',minArea:19,modules:['conversation','guest-seating','dining']},{id:'grand-living-dining',label:'大客餐厅',minArea:34,modules:['conversation','guest-seating','dining','storage']}]
        },
        richMinimum:{
          bedroom:[{minArea:0,value:2,irregular:2},{minArea:8,value:3,irregular:3},{minArea:10,value:5,irregular:5},{minArea:15,value:7,irregular:6},{minArea:17,value:7,irregular:7},{minArea:20,value:8,irregular:7}],
          living:[{minArea:0,value:3,irregular:3},{minArea:16,value:6,irregular:6},{minArea:19,value:8,irregular:7},{minArea:24,value:8,irregular:7},{minArea:34,value:10,irregular:9}]
        }
      },
      qualityPass:{
        minimumScores:{circulation:55,relation:62,composition:50,comfort:50,preference:45},
        requiredModuleScore:{bedroom:[{minArea:0,value:65}],living:[{minArea:0,value:65},{minArea:19,value:85},{minArea:34,value:97}]},
        longBedroomWall:{minArea:15,minAspect:1.65,maxEmptyBay:3.20},
        largeRoomGround:{minArea:34,maxArea:80,maxLargestVoidRatio:.54},
        largeRoomWall:{minArea:34,maxArea:80,maxUnusedWallRatio:.48,minEmptyWallScore:.12}
      },
      relationPolicies:[
        {id:'recognized-hotel-tv-axis',program:'bedroom',shape:'recognized',minArea:15,minAspect:1.65,typeId:'tvbench',requiredRelation:'bedroom-tv-bed-facing'}
      ],
      designGrammar:{
        living:{groups:{lounge:{anchor:'sofa',members:['sofa','tv','coffee','arm','side','ottoman','floorLamp'],compact:[.12,.30]},dining:{anchor:'diningTable',members:['diningTable','diningChair','sideboard'],minimumChairs:1,compact:[.10,.25]}},zones:{wide:{lounge:[.34,.49],dining:[.73,.51]},deep:{lounge:[.50,.34],dining:[.51,.73]}},pairs:{sofaCoffee:{gap:[.35,.40],compact:[.30,.40],hardMin:.28},sofaTv:{gap:[1.55,3.20]},conversation:{radius:[.82,1.62]},diningSideboard:{clearance:{min:.75,ideal:[.80,1.20],max:3,tolerance:.35}}}},
        bedroom:{groups:{sleep:{anchor:'bed',members:['bed','night','bench'],compact:[.10,.27]},work:{anchor:'desk',members:['desk','chair'],compact:[.06,.18]},lounge:{anchor:'bedroomLoveseat',members:['bedroomLoveseat','tvbench','bedroomTeaTable','lounge'],compact:[.08,.22]}},zones:{wide:{sleep:[.36,.48],work:[.75,.42]},deep:{sleep:[.48,.38],work:[.72,.72]}},pairs:{nightBed:{gap:[0,.08]},benchBed:{gap:[.24,.58]}}}
      },
      search:{
        defaultBeamWidth:120,matrixGridStep:.12,skipBranchReserveRatio:.20,preserveQuantityCounts:true,preserveEachFurnitureType:true,representativesPerFurnitureType:8,typeSignatureReserve:24,
        semanticSampling:{wall:{uniformStep:.36,maxUniformPositions:9,largeRoomArea:28,largeMaxUniformPositions:4,previewLimit:140}},
        sizePolicies:{
          bedroom:{desk:{mode:'max-feasible',targetByArea:[{minArea:0,width:.9},{minArea:10,width:1.2},{minArea:16,width:1.4},{minArea:20,width:1.6}],searchMaxByArea:[{minArea:0,width:1.4},{minArea:16,width:1.8},{minArea:22,width:2}],dependentTypes:['chair'],repairCandidateLimit:12,positionBuckets:10,anchorTolerance:.08,fallbacksPerAnchor:1,localPriorityBonus:22,finalPriority:true,maxTotalTradeoff:8}},
          living:{}
        },
        orderByShape:{recognized:{living:['sofa','tv','coffee','arm','side','diningTable','diningChair','ottoman','sideboard','bookcase','display','console','floorLamp','plant','infillCabinet']}},
        orderByArea:{
          bedroom:[{minArea:0,types:['bed','night','wardrobe','desk','chair','tvbench','bench','bedroomLoveseat','bedroomTeaTable','chest','shelf','bedroomDisplay','lounge','vanity','vanityStool','bedroomInfillCabinet']}],
          living:[{minArea:0,types:['sofa','tv','coffee','arm','side','diningTable','diningChair','ottoman','sideboard','bookcase','display','console','floorLamp','plant','infillCabinet']},{minArea:34,types:['sofa','tv','coffee','diningTable','diningChair','arm','side','ottoman','sideboard','bookcase','display','console','floorLamp','plant','infillCabinet']}]
        },
        auto:{attemptLimit:{normal:12,large:6,largeArea:28},richMinimumBeamWidthByArea:[{minArea:0,value:240},{minArea:22,value:72},{minArea:28,value:52},{minArea:40,value:44}],profileRules:{forceStandardRoomModules:['dining']}},
        candidateBudget:{defaultLimit:72,largeRoomArea:32,largeRoomLimit:24},
        perParent:{coreTypes:['bed','sofa','tv','wardrobe'],largeLivingArea:28,normal:{core:28,optional:12,required:18},largeLiving:{core:24,optional:9,required:14}}
      },
      postLayout:{floorOnly:true,wallComplements:{enabled:true,repairOnly:true,countTowardRichMinimum:false,maxRecoverableIslandArea:.20,allowProgressiveIslandRepair:true,minIslandImprovement:.015,minUnusedWallImprovement:.04,maxWallScoreDrop:.02,closureExtensionMax:.12,dedupeClearance:.08,candidateMultiplier:3,priorityUsefulWidth:1.2,closureReserve:2,programs:{
        bedroom:{minimumArea:0,depth:.34,minWidth:.60,maxWidth:4.8,maxBudget:5,budgetByArea:[{minArea:0,value:2},{minArea:28,value:3},{minArea:40,value:5}],mediaFlank:{minWidth:.60,maxWidth:.80,minDepth:.22,maxDepth:.30}},
        living:{minimumArea:0,depth:.38,minWidth:.60,maxWidth:8.0,maxBudget:5,budgetByArea:[{minArea:0,value:2},{minArea:28,value:3},{minArea:40,value:5}],mediaFlank:{minWidth:.60,maxWidth:.80,minDepth:.22,maxDepth:.30}}
      }}}
    };
    const row=(program,id,label,width,depth,category,role,color,rule={})=>({
      schemaVersion:1,program,id,label,category,role,color,geometry:{width,depth,shape:'box'},quantity:{min:0,max:1},accessTarget:false,
      preferences:{weight:1},
      candidate:{mode:rule.requiredAnchor==='wall'?'wall':'zone',rotations:[0,90],relativeTo:'',relation:'',gap:0},
      placement:{requiredAnchor:rule.requiredAnchor||'none',avoidWindow:!!rule.avoidWindow,allowCorner:false},
      service:{label:'日常使用区',side:'front',depth:.42,spanExtra:0,hard:false,sharedCirculation:false,allowBodyTypes:[]},
      ...(rule.patch||{}),run:rule.run||null,infill:!!rule.infill
    });
    const candidateRule=(id,mode,options={})=>({id,enabled:true,mode,rotations:[0,90],relativeTo:'',relation:'',side:'front',crossAlign:'center',distance:{min:0,max:0,step:.2},facing:['parallel'],maxSamples:12,weight:1,collisionClearance:.025,allowFunctionalOverlap:false,...options});
    const defaults=[
      row('bedroom','bed','双人床',1.5,2,'核心家具','睡眠核心','#2f6da0',{requiredAnchor:'wall',patch:{quantity:{min:1,max:1},accessTarget:true,placement:{requiredAnchor:'wall',avoidWindow:false,allowCorner:true},candidate:{rules:[candidateRule('bed-wall','wall',{maxSamples:20}),candidateRule('bed-corner','corner',{relation:'wall-end-corner',maxSamples:8,weight:1.35})],maxCandidates:28},service:{label:'床尾活动区',side:'front',depth:.6,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('bedroom','wardrobe','衣柜',1.8,.6,'核心家具','衣物收纳','#9b6a46',{requiredAnchor:'wall',avoidWindow:true,run:{min:.9,max:3.2,step:.1,fill:[.72,.96]},patch:{quantity:{min:1,max:1},accessTarget:true,candidate:{rules:[candidateRule('wardrobe-open-wall','wall',{maxSamples:32})],maxCandidates:32},service:{label:'柜前取用区',side:'front',depth:.42,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('bedroom','desk','书桌',1.2,.55,'工作与梳妆','工作学习','#2f8a78',{requiredAnchor:'wall',patch:{geometry:{width:1.2,depth:.55,shape:'box',variants:[{id:'desk-90',label:'书桌 0.9 m',width:.9,depth:.55,shape:'box'},{id:'desk-120',label:'书桌 1.2 m',width:1.2,depth:.55,shape:'box'},{id:'desk-140',label:'书桌 1.4 m',width:1.4,depth:.55,shape:'box'},{id:'desk-160',label:'书桌 1.6 m',width:1.6,depth:.55,shape:'box'}]},accessTarget:true,service:{label:'座椅与工作区',side:'front',depth:.6,spanExtra:0,hard:false,allowBodyTypes:['chair']}}}),
      row('bedroom','chair','工作椅',.5,.5,'床组与座椅','工作组','#59a391',{patch:{candidate:{rules:[candidateRule('chair-desk-front','relation',{relativeTo:'desk',relation:'desk-front',side:'front',distance:{min:0,max:0,step:.05},facing:['toward'],maxSamples:3,weight:1.25,collisionClearance:0})],maxCandidates:4},service:{label:'工作椅占位',side:'back',depth:0,spanExtra:0,hard:false,sharedCirculation:true,allowBodyTypes:[]}}}),
      row('bedroom','vanity','梳妆台',1,.45,'工作与梳妆','梳妆','#a66f86',{requiredAnchor:'wall',patch:{accessTarget:true,service:{label:'梳妆操作区',side:'front',depth:.6,spanExtra:0,hard:false,allowBodyTypes:['vanityStool']}}}),
      row('bedroom','vanityStool','梳妆凳',.42,.42,'床组与座椅','梳妆组','#b78aa0',{patch:{candidate:{rules:[candidateRule('stool-vanity-front','relation',{relativeTo:'vanity',relation:'vanity-seat',side:'front',distance:{min:0,max:0,step:.05},facing:['toward'],maxSamples:3,collisionClearance:0})],maxCandidates:4},service:{label:'梳妆凳后侧共享通行区',side:'back',depth:.6,spanExtra:0,hard:false,sharedCirculation:true,allowBodyTypes:[]}}}),
      row('bedroom','night','床头柜',.45,.45,'床组与座椅','床组','#6a8db2',{patch:{quantity:{min:0,max:2},candidate:{rules:[candidateRule('night-bed-left','relation',{relativeTo:'bed',relation:'bed-side',side:'left',crossAlign:'back',distance:{min:0,max:0,step:.05},facing:['parallel'],maxSamples:4,collisionClearance:0,allowFunctionalOverlap:true,weight:1.55}),candidateRule('night-bed-right','relation',{relativeTo:'bed',relation:'bed-side',side:'right',crossAlign:'back',distance:{min:0,max:0,step:.05},facing:['parallel'],maxSamples:4,collisionClearance:0,allowFunctionalOverlap:true,weight:1.55})],maxCandidates:8},service:{label:'床头柜取用区',side:'front',depth:.42,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('bedroom','bench','床尾凳',1.1,.4,'床组与座椅','床尾辅助','#6686a2',{patch:{candidate:{rules:[candidateRule('bench-bed-foot-center','relation',{relativeTo:'bed',relation:'bed-foot',side:'front',crossAlign:'center',distance:{min:.10,max:.15,step:.05},facing:['toward'],maxSamples:4,allowFunctionalOverlap:true,weight:1.42}),candidateRule('bench-bed-foot-left','relation',{relativeTo:'bed',relation:'bed-foot',side:'front',crossAlign:'left',crossOffset:-.25,distance:{min:.08,max:.12,step:.04},facing:['toward'],maxSamples:4,allowFunctionalOverlap:true,weight:1.5}),candidateRule('bench-bed-foot-right','relation',{relativeTo:'bed',relation:'bed-foot',side:'front',crossAlign:'right',crossOffset:.25,distance:{min:.08,max:.12,step:.04},facing:['toward'],maxSamples:4,allowFunctionalOverlap:true,weight:1.5})],maxCandidates:12},service:{label:'床尾凳共享落脚区',side:'front',depth:.42,spanExtra:0,hard:false,allowBodyTypes:[],sharedCirculation:true,adaptiveFootZone:true,adaptiveGapThreshold:.30}}}),
      row('bedroom','chest','斗柜',1,.45,'收纳家具','叠放收纳','#a47b58',{requiredAnchor:'wall',run:{min:.7,max:1.8,step:.1,fill:[.58,.88]},patch:{quantity:{min:0,max:2},accessTarget:true,service:{label:'抽屉取用区',side:'front',depth:.48,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('bedroom','shelf','书柜',.9,.35,'收纳家具','书物收纳','#6d796f',{requiredAnchor:'wall',avoidWindow:true,run:{min:.7,max:2.4,step:.1,fill:[.62,.92]},patch:{accessTarget:true,service:{label:'取物站立区',side:'front',depth:.42,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('bedroom','tvbench','卧室电视柜',1.2,.4,'收纳家具','视听收纳','#505f69',{requiredAnchor:'wall',avoidWindow:true,run:{min:1,max:2.6,step:.1,fill:[.58,.9]},patch:{preferences:{defaultCount:0,weight:1.65},accessTarget:true,candidate:{rules:[candidateRule('tvbench-bed-facing','relation',{relativeTo:'bed',relation:'bedroom-tv-bed-facing',side:'front',distance:{min:.45,max:2.8,step:.15},facing:['toward'],maxSamples:24,weight:2.4,referenceShapePolicy:{lShape:{enabled:true,lateralSide:'any',frontAlign:'body-center'}}}),candidateRule('tvbench-loveseat-facing','relation',{relativeTo:'bedroomLoveseat',relation:'bedroom-media-facing',side:'front',distance:{min:.55,max:2.8,step:.25},facing:['toward'],maxSamples:18,weight:2.1,referenceShapePolicy:{lShape:{enabled:true,lateralSide:'any',frontAlign:'body-center'}}}),candidateRule('tvbench-wall','wall',{maxSamples:40,weight:1.15})],maxCandidates:56},service:{label:'设备取用区',side:'front',depth:.4,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('bedroom','lounge','休闲椅',.72,.72,'床组与座椅','阅读休憩','#6b9888',{requiredAnchor:'wall',patch:{quantity:{min:0,max:2},placement:{requiredAnchor:'wall',avoidWindow:false,allowCorner:true},candidate:{rules:[candidateRule('reading-wall','wall',{relation:'reading-wall',maxSamples:16,weight:1.85,collisionClearance:0}),candidateRule('reading-open-zone','zone',{enabled:false,relation:'reading-open-zone',maxSamples:8,weight:.72})],maxCandidates:16},service:{label:'休闲椅使用区',side:'front',depth:.6,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('bedroom','bedroomLoveseat','卧室小沙发',1.25,.72,'休闲会客','小型会客区','#c98272',{patch:{candidate:{rules:[candidateRule('loveseat-tv-facing','relation',{relativeTo:'tvbench',relation:'bedroom-seat-media-facing',side:'front',distance:{min:.55,max:2.8,step:.25},facing:['toward'],maxSamples:24,weight:1.65}),candidateRule('loveseat-wall','wall',{maxSamples:12,weight:1.18}),candidateRule('loveseat-open-zone','zone',{relation:'bedroom-lounge-zone',maxSamples:10})],maxCandidates:40},service:{label:'小沙发起坐区',side:'front',depth:.42,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('bedroom','bedroomTeaTable','卧室圆几',.56,.56,'休闲会客','茶歇中心','#b78b55',{patch:{candidate:{rules:[candidateRule('tea-loveseat-front','relation',{relativeTo:'bedroomLoveseat',relation:'lounge-table',side:'front',distance:{min:.3,max:.4,step:.05},facing:['parallel'],maxSamples:6,weight:1.25}),candidateRule('tea-chair-front','relation',{relativeTo:'lounge',relation:'lounge-table',side:'front',distance:{min:.24,max:.34,step:.05},facing:['parallel'],maxSamples:6})],maxCandidates:12},service:{label:'圆几取用区',side:'front',depth:.24,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('bedroom','bedroomDisplay','卧室展示柜',1.2,.32,'沿墙浅柜','空墙陈列与浅收纳','#738276',{requiredAnchor:'wall',avoidWindow:true,run:{min:.7,max:2.4,step:.1,fill:[.62,.94]},patch:{quantity:{min:0,max:2},accessTarget:true,candidate:{rules:[candidateRule('bedroom-display-wall','wall',{maxSamples:14,weight:1.2})],maxCandidates:14},service:{label:'展示柜取用区',side:'front',depth:.42,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('library','hamper','洗衣篮',.42,.42,'小件家具','衣物暂存','#9b9070',{patch:{candidate:{mode:'corner',rotations:[0,90],relativeTo:'',relation:'utility-corner',gap:0},service:{label:'取放衣物区',side:'front',depth:.6,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('bedroom','bedroomInfillCabinet','卧室定制填缝柜',1.8,.4,'拓展填缝定制柜','末轮空墙补齐','#526f68',{requiredAnchor:'wall',avoidWindow:true,infill:true,run:{min:.6,max:3,step:.05,modules:[.6,.8,1,1.2,1.5,1.8,2.4,3],fill:[.72,1],maxByWalls:true,maxPerWall:1,wallCountCap:4,areaPerCabinet:8},patch:{quantity:{min:0,max:4},accessTarget:true,service:{label:'定制柜取用区',side:'front',depth:.45,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('bedroom','bedroomRug','卧室地毯',2.5,3.1,'地面陈设','长卧室留白整合','#cdbb8e',{patch:{quantity:{min:0,max:1},preferences:{defaultCount:1,weight:1},surface:{layer:'floor',collision:'ignore',relativeTo:'bedroomLoveseat',minArea:20,padding:{side:.70,front:2.35,back:.10}},service:{label:'卧室地面衬底',side:'front',depth:0,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('living','sofa','沙发',2.2,.9,'会客核心','会客核心','#be633e',{patch:{quantity:{min:1,max:1},accessTarget:true,geometry:{width:2.2,depth:.9,shape:'box',variants:[{id:'box',label:'普通三人沙发',width:2.2,depth:.9,shape:'box'},{id:'l-left',label:'左贵妃 L 形沙发',width:2.8,depth:1.65,shape:'l-left'},{id:'l-right',label:'右贵妃 L 形沙发',width:2.8,depth:1.65,shape:'l-right'}]},candidate:{rules:[candidateRule('sofa-wall','wall',{maxSamples:16,weight:1.25}),candidateRule('sofa-zone','zone',{enabled:false,relation:'floating-sofa',maxSamples:12})],maxCandidates:28},service:{label:'沙发起坐区',side:'front',depth:.6,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('living','tv','电视柜',1.8,.45,'会客核心','视听中心','#34424d',{requiredAnchor:'wall',avoidWindow:true,patch:{quantity:{min:1,max:1},accessTarget:true,candidate:{rules:[candidateRule('tv-facing-sofa','relation',{relativeTo:'sofa',relation:'sofa-facing',side:'front',distance:{min:1.55,max:3.2,step:.25},facing:['toward'],maxSamples:18,weight:1.55,referenceShapePolicy:{lShape:{enabled:true,lateralSide:'any',frontAlign:'body-center'}}}),candidateRule('tv-open-wall','wall',{maxSamples:12})],maxCandidates:30},service:{label:'设备与抽屉区',side:'front',depth:.6,spanExtra:0,hard:true,allowBodyTypes:[]}}}),
      row('living','coffee','茶几',1.2,.6,'会客核心','会客中心','#bd9252',{patch:{quantity:{min:1,max:1},candidate:{rules:[candidateRule('coffee-sofa-front','relation',{relativeTo:'sofa',relation:'sofa-front',side:'front',distance:{min:.3,max:.4,step:.05},facing:['toward','away'],maxSamples:6,weight:1.5,collisionClearance:0})],maxCandidates:8},service:{label:'茶几取用区',side:'front',depth:.6,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('living','arm','单人沙发',.8,.8,'座椅与小件','围合座位','#d7895d',{patch:{quantity:{min:0,max:4},candidate:{rules:[candidateRule('arm-sofa-left','relation',{relativeTo:'sofa',relation:'conversation-side',side:'left',distance:{min:.14,max:.34,step:.1},facing:['toward'],maxSamples:6,weight:2.15,referenceShapePolicy:{lShape:{enabled:false,lateralSide:'any',frontAlign:'body-center'}}}),candidateRule('arm-sofa-right','relation',{relativeTo:'sofa',relation:'conversation-side',side:'right',distance:{min:.14,max:.34,step:.1},facing:['toward'],maxSamples:6,weight:2.15,referenceShapePolicy:{lShape:{enabled:false,lateralSide:'any',frontAlign:'body-center'}}}),candidateRule('arm-sofa-opposite','relation',{relativeTo:'sofa',relation:'conversation-opposite',side:'front',distance:{min:.7,max:1.3,step:.2},facing:['toward'],maxSamples:8,weight:1.35,referenceShapePolicy:{lShape:{enabled:false,lateralSide:'any',frontAlign:'body-center'}}}),candidateRule('arm-side-front','relation',{relativeTo:'side',relation:'sofa-side-chair-chain',side:'front',distance:{min:.04,max:.16,step:.06},facing:['parallel'],maxSamples:10,weight:1.9,allowFunctionalOverlap:true,compoundConstraint:{ancestorRelativeTo:'sofa',side:'front',gap:.04}}),candidateRule('arm-open-zone','zone',{relation:'conversation-open-zone',maxSamples:12,weight:.72}),candidateRule('arm-wall','wall',{relation:'conversation-wall',maxSamples:12,weight:.68})],maxCandidates:42},service:{label:'单椅起坐区',side:'back',depth:.6,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('living','side','边几',.5,.5,'座椅与小件','沙发组','#79927e',{patch:{quantity:{min:0,max:2},candidate:{mode:'relation',rotations:[0,90],relativeTo:'sofa',relation:'sofa-side',gap:.07},service:{label:'边几取用区',side:'front',depth:.6,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('living','ottoman','脚凳',.6,.5,'座椅与小件','弹性座位','#aa7d67',{patch:{quantity:{min:0,max:2},candidate:{mode:'relation',rotations:[0,90],relativeTo:'arm',relation:'seat-ottoman',gap:.34},service:{label:'脚凳使用区',side:'front',depth:.6,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('living','diningTable','餐桌',1.4,.8,'客餐家具','客餐厅用餐','#8f704d',{patch:{preferences:{defaultCount:0,weight:1.5},accessTarget:true,candidate:{rules:[candidateRule('dining-wall','wall',{relation:'dining-wall',maxSamples:28,weight:1.7,collisionClearance:0}),candidateRule('dining-zone','zone',{relation:'dining-zone',maxSamples:20,weight:1.25,collisionClearance:0})],maxCandidates:44},placement:{requiredAnchor:'none',avoidWindow:false,allowCorner:true},service:{label:'餐桌使用区',side:'front',depth:.6,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('living','diningChair','餐椅',.46,.5,'客餐家具','餐桌组','#b08a64',{patch:{quantity:{min:0,max:6},candidate:{rules:['front','back','left','right'].map(side=>candidateRule(`dining-${side}`,'relation',{relativeTo:'diningTable',relation:'dining-seat',side,distance:{min:0,max:0,step:.05},facing:['toward'],maxSamples:4,collisionClearance:0})) ,maxCandidates:20},service:{label:'餐椅后侧共享通行区',side:'back',depth:.5,spanExtra:0,hard:false,sharedCirculation:true,allowBodyTypes:[]}}}),
      row('living','sideboard','餐边柜',1.6,.45,'沿墙柜体','餐储与台面','#8b6a4e',{requiredAnchor:'wall',run:{min:1,max:3.2,step:.1,fill:[.66,.96]},patch:{quantity:{min:0,max:2},accessTarget:true,service:{label:'餐边柜前共享通行区',side:'front',depth:.75,spanExtra:0,hard:false,blocksFurniture:true,sharedCirculation:true,allowBodyTypes:[]}}}),
      row('living','bookcase','书柜 / 矮柜',1.2,.35,'沿墙柜体','沿墙收纳','#7b6657',{requiredAnchor:'wall',avoidWindow:true,run:{min:.8,max:2.6,step:.1,fill:[.62,.94]},patch:{quantity:{min:0,max:2},accessTarget:true,service:{label:'取书站立区',side:'front',depth:.42,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('living','display','展示柜',.9,.38,'沿墙柜体','陈列收纳','#65736b',{requiredAnchor:'wall',avoidWindow:true,run:{min:.7,max:2,step:.1,fill:[.56,.86]},patch:{quantity:{min:0,max:2},accessTarget:true,service:{label:'展示柜取用区',side:'front',depth:.45,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('living','console','玄关 / 沙发边柜',1.2,.35,'沿墙柜体','窄型台面','#927a69',{requiredAnchor:'wall',run:{min:.8,max:2.4,step:.1,fill:[.6,.92]},patch:{accessTarget:true,service:{label:'窄柜取用区',side:'front',depth:.4,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('living','floorLamp','落地灯',.36,.36,'座椅与小件','座位照明','#c5a968',{patch:{quantity:{min:0,max:2},candidate:{rules:[candidateRule('lamp-arm-left','relation',{relativeTo:'arm',relation:'seat-light',side:'left',distance:{min:.04,max:.18,step:.07},maxSamples:6}),candidateRule('lamp-arm-right','relation',{relativeTo:'arm',relation:'seat-light',side:'right',distance:{min:.04,max:.18,step:.07},maxSamples:6}),candidateRule('lamp-sofa-left','relation',{relativeTo:'sofa',relation:'seat-light',side:'left',crossAlign:'front',distance:{min:.04,max:.18,step:.07},maxSamples:6}),candidateRule('lamp-sofa-right','relation',{relativeTo:'sofa',relation:'seat-light',side:'right',crossAlign:'front',distance:{min:.04,max:.18,step:.07},maxSamples:6})],maxCandidates:24},service:{label:'灯具维护区',side:'front',depth:.3,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('living','plant','绿植',.42,.42,'座椅与小件','角落软装','#5f8b68',{patch:{quantity:{min:0,max:3},candidate:{mode:'corner',rotations:[0,90],relativeTo:'',relation:'corner-accent',gap:0},service:{label:'绿植养护区',side:'front',depth:.3,spanExtra:0,hard:false,allowBodyTypes:[]}}}),
      row('living','infillCabinet','拓展填缝定制柜',2.4,.4,'拓展填缝定制柜','末轮墙面补齐','#526f68',{requiredAnchor:'wall',avoidWindow:true,infill:true,run:{min:1.1,max:5.6,step:.05,modules:[1.2,1.5,1.8,2.4,3,3.6,4.2,4.8,5.6],fill:[.96,1],maxByWalls:true,maxPerWall:1,wallCountCap:5,areaPerCabinet:12},patch:{quantity:{min:0,max:5},accessTarget:true,service:{label:'定制柜取用区',side:'front',depth:.45,spanExtra:0,hard:false,allowBodyTypes:[]}}})
      ,row('living','livingRug','客厅地毯',2.8,2.2,'地面活动区','会客区地面衬底','#d0b780',{patch:{quantity:{min:0,max:1},surface:{layer:'floor',collision:'ignore',relativeTo:'sofa',secondary:'coffee',padding:{side:.32,front:.72,back:.12}},service:{label:'会客地面衬底',side:'front',depth:0,spanExtra:0,hard:false,allowBodyTypes:[]}}})
    ];
    const DEFAULT_MODULE_VARIANTS={
      'bedroom:bed':[[1.2,1.9],[1.5,2],[1.8,2]],'bedroom:wardrobe':[[1,.55],[1.8,.6],[2.2,.62]],'bedroom:night':[[.38,.38],[.45,.45],[.5,.48]],
      'bedroom:vanity':[[.8,.42],[1,.45],[1.2,.48]],'bedroom:chest':[[.8,.42],[1,.45],[1.2,.48]],'bedroom:shelf':[[.7,.32],[.9,.35],[1.1,.38]],
      'bedroom:tvbench':[[1.2,.24],[1.2,.3],[1.5,.36]],'bedroom:bench':[[.9,.36],[1.1,.4],[1.3,.42]],'bedroom:chair':[[.46,.46],[.5,.5],[.56,.56]],
      'bedroom:vanityStool':[[.38,.38],[.42,.42],[.46,.46]],'bedroom:lounge':[[.64,.64],[.72,.72],[.8,.8]],'bedroom:bedroomLoveseat':[[1.1,.68],[1.25,.72],[1.45,.76]],
      'bedroom:bedroomTeaTable':[[.46,.46],[.56,.56],[.64,.64]],'bedroom:bedroomDisplay':[[.8,.3],[1.2,.32],[1.6,.34]],
      'living:tv':[[1.4,.4],[1.8,.45],[2.4,.48]],'living:coffee':[[.9,.5],[1.2,.6],[1.4,.7]],'living:diningTable':[[1.1,.7],[1.4,.8],[1.6,.85]],
      'living:diningChair':[[.42,.46],[.46,.5],[.5,.54]],'living:sideboard':[[1.2,.4],[1.6,.45],[2,.48]],'living:bookcase':[[.9,.32],[1.2,.35],[1.5,.38]],
      'living:display':[[.7,.34],[.9,.38],[1.1,.42]],'living:console':[[.9,.3],[1.2,.35],[1.4,.38]],'living:arm':[[.72,.72],[.8,.8],[.88,.86]],
      'living:ottoman':[[.52,.44],[.6,.5],[.68,.56]],'living:side':[[.42,.42],[.5,.5],[.56,.56]],'living:floorLamp':[[.32,.32],[.36,.36],[.4,.4]],'living:plant':[[.34,.34],[.42,.42],[.5,.5]]
    };
    const DEFAULT_SEARCH_VARIANTS=new Set(['bedroom:bed','bedroom:night','bedroom:desk','bedroom:vanity','bedroom:tvbench','bedroom:bench','bedroom:chair','bedroom:vanityStool','bedroom:lounge','bedroom:bedroomLoveseat','bedroom:bedroomTeaTable','living:sofa','living:tv','living:coffee','living:diningTable','living:diningChair','living:sideboard','living:bookcase','living:display','living:console','living:arm','living:ottoman','living:side']);

    const clone=value=>JSON.parse(JSON.stringify(value));
    const ruleKey=rule=>`${rule.program}:${rule.id}`;
    const profileId=()=>`profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
    function normalizeProfile(row){
      const rawCatalog=normalizeCatalog(row.catalog),upgradeIds=['bedroomLoveseat','bedroomTeaTable','bedroomDisplay'];
      const upgrading=Number(row.baselineVersion||0)<BASELINE_VERSION;
      if(upgrading)for(const id of upgradeIds){const base=defaults.find(rule=>rule.id===id);if(base&&!rawCatalog.some(rule=>rule.id===id))rawCatalog.push(normalizeRule(clone(base),rawCatalog.length))}
      const catalog=[...new Map(rawCatalog.map(rule=>[rule.id,rule])).values()],defaultsByRule=clone(row.defaultsByRule||{}),roomTypes=Array.isArray(row.roomTypes)?clone(row.roomTypes):clone(DEFAULT_ROOM_TYPES),roomAssignments=clone(row.roomAssignments||{}),roomSettings=clone(row.roomSettings||{}),hasAssignments=!!row.roomAssignments;
      for(const rule of rawCatalog)if(!['shared','library'].includes(rule.program)&&!roomTypes.some(type=>type.id===rule.program))roomTypes.push({id:rule.program,label:rule.program,engineEnabled:false});for(const base of DEFAULT_ROOM_TYPES)if(!roomTypes.some(type=>type.id===base.id))roomTypes.push(clone(base));
      for(const type of roomTypes){roomAssignments[type.id]=Array.isArray(roomAssignments[type.id])?[...new Set(roomAssignments[type.id])]:[];roomSettings[type.id]=roomSettings[type.id]||{}}
      if(upgrading){roomAssignments.bedroom||=[];roomSettings.bedroom||={};for(const id of upgradeIds){const rule=catalog.find(item=>item.id===id);if(!rule)continue;if(!roomAssignments.bedroom.includes(id))roomAssignments.bedroom.push(id);roomSettings.bedroom[id]||={min:0,max:rule.quantity.max,defaultCount:DEFAULT_COUNTS.bedroom[id]??0,weight:1,priority:roomAssignments.bedroom.length*10}}}
      if(upgrading){const canonical=['bed','night','wardrobe','desk','chair','bench','tvbench','bedroomLoveseat','bedroomTeaTable','chest','shelf','bedroomDisplay','lounge','vanity','vanityStool','bedroomInfillCabinet'],current=roomAssignments.bedroom||[],rank=new Map(canonical.map((id,index)=>[id,index]));roomAssignments.bedroom=[...current].sort((a,b)=>(rank.get(a)??999)-(rank.get(b)??999)||current.indexOf(a)-current.indexOf(b));}
      // V3：浅展示柜先占墙，休闲椅再使用剩余地面；只迁移一次，之后仍尊重用户手动排序。
      if(upgrading){const canonical=['bed','night','wardrobe','desk','chair','bench','tvbench','bedroomLoveseat','bedroomTeaTable','chest','shelf','bedroomDisplay','lounge','vanity','vanityStool','bedroomInfillCabinet'],current=roomAssignments.bedroom||[],rank=new Map(canonical.map((id,index)=>[id,index]));roomAssignments.bedroom=[...current].sort((a,b)=>(rank.get(a)??999)-(rank.get(b)??999)||current.indexOf(a)-current.indexOf(b));}
      if(!hasAssignments)for(const rule of rawCatalog){if(['shared','library'].includes(rule.program)||rule.id==='hamper')continue;roomAssignments[rule.program]||=[];if(!roomAssignments[rule.program].includes(rule.id))roomAssignments[rule.program].push(rule.id);roomSettings[rule.program]||={};roomSettings[rule.program][rule.id]={min:rule.quantity.min,max:rule.quantity.max,defaultCount:rule.preferences?.defaultCount??rule.quantity.min,weight:rule.preferences?.weight??1,priority:rule.preferences?.priority??100}}
      // 旧版在清单尚为空时提前排序，随后才填充家具，导致展示柜/小沙发跑到床前面。
      // 新迁移必须位于清单填充之后，并同步数量与优先级；用户之后仍可自行调整。
      if(upgrading){
        const canonical=['bed','night','wardrobe','desk','chair','tvbench','bench','bedroomLoveseat','bedroomTeaTable','chest','shelf','bedroomDisplay','lounge','vanity','vanityStool','bedroomInfillCabinet'];
        const current=roomAssignments.bedroom||[],rank=new Map(canonical.map((id,index)=>[id,index]));
        roomAssignments.bedroom=[...current].sort((a,b)=>(rank.get(a)??999)-(rank.get(b)??999)||current.indexOf(a)-current.indexOf(b));
        roomAssignments.bedroom.forEach((id,index)=>{const rule=catalog.find(item=>item.id===id);if(!rule)return;roomSettings.bedroom||={};const setting=roomSettings.bedroom[id]||{};roomSettings.bedroom[id]={...setting,defaultCount:DEFAULT_COUNTS.bedroom[id]??setting.defaultCount??rule.quantity.min,priority:(index+1)*10};});
      }
      if(upgrading){
        const canonical=['sofa','tv','coffee','diningTable','diningChair','arm','side','floorLamp','sideboard','bookcase','display','console','ottoman','plant','infillCabinet','livingRug'];
        const current=roomAssignments.living||[],rank=new Map(canonical.map((id,index)=>[id,index]));
        roomAssignments.living=[...current].sort((a,b)=>(rank.get(a)??999)-(rank.get(b)??999)||current.indexOf(a)-current.indexOf(b));
        roomAssignments.living.forEach((id,index)=>{const rule=catalog.find(item=>item.id===id);if(!rule)return;roomSettings.living||={};const setting=roomSettings.living[id]||{};roomSettings.living[id]={...setting,defaultCount:DEFAULT_COUNTS.living[id]??setting.defaultCount??rule.quantity.min,priority:(index+1)*10};});
      }
      if(upgrading){const current=roomAssignments.living||[],rank=new Map(['sofa','tv','coffee','diningTable','diningChair','arm','side','floorLamp','sideboard','bookcase','display','console','ottoman','plant','infillCabinet','livingRug'].map((id,index)=>[id,index]));roomAssignments.living=[...current].sort((a,b)=>(rank.get(a)??999)-(rank.get(b)??999)||current.indexOf(a)-current.indexOf(b));roomAssignments.living.forEach((id,index)=>{roomSettings.living||={};roomSettings.living[id]={...(roomSettings.living[id]||{}),priority:(index+1)*10}})}
      if(upgrading){const current=roomAssignments.bedroom||[],rank=new Map(['bed','night','wardrobe','desk','chair','tvbench','bench','bedroomLoveseat','bedroomTeaTable','chest','shelf','bedroomDisplay','lounge','vanity','vanityStool','bedroomInfillCabinet'].map((id,index)=>[id,index]));roomAssignments.bedroom=[...current].sort((a,b)=>(rank.get(a)??999)-(rank.get(b)??999)||current.indexOf(a)-current.indexOf(b));roomAssignments.bedroom.forEach((id,index)=>{roomSettings.bedroom||={};roomSettings.bedroom[id]={...(roomSettings.bedroom[id]||{}),priority:(index+1)*10}})}
      for(const type of roomTypes){roomAssignments[type.id]=roomAssignments[type.id].filter(id=>catalog.some(rule=>rule.id===id));roomAssignments[type.id].forEach((id,index)=>{const rule=catalog.find(item=>item.id===id),saved=roomSettings[type.id][id]||{};roomSettings[type.id][id]={min:Math.max(0,Math.round(Number(saved.min??rule.quantity.min)||0)),max:Math.max(0,Math.round(Number(saved.max??rule.quantity.max)||0)),defaultCount:Math.max(0,Math.round(Number(saved.defaultCount??rule.preferences?.defaultCount??0)||0)),weight:Math.min(3,Math.max(0,Number(saved.weight??rule.preferences?.weight??1)||0)),priority:(index+1)*10};if(roomSettings[type.id][id].max<roomSettings[type.id][id].min)roomSettings[type.id][id].max=roomSettings[type.id][id].min;if(roomSettings[type.id][id].defaultCount<roomSettings[type.id][id].min)roomSettings[type.id][id].defaultCount=roomSettings[type.id][id].min;if(roomSettings[type.id][id].defaultCount>roomSettings[type.id][id].max)roomSettings[type.id][id].defaultCount=roomSettings[type.id][id].max})}
      for(const [key,rule] of Object.entries(defaultsByRule))defaultsByRule[key]=normalizeRule(rule);for(const rule of catalog)defaultsByRule[ruleKey(rule)]||=clone(rule);return {...row,baselineVersion:BASELINE_VERSION,catalog,defaultsByRule,roomTypes,roomAssignments,roomSettings};
    }
    function loadProfiles(){
      if(!ENABLE_LOCAL_CONFIG_PERSISTENCE)return [normalizeProfile({id:profileId(),name:'临时配置（刷新恢复默认）',catalog:normalizeCatalog(clone(defaults)),updatedAt:new Date().toISOString()})];
      try{const rows=JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY));if(Array.isArray(rows)&&rows.length)return rows.filter(row=>row?.id&&row?.name&&Array.isArray(row.catalog)).map(normalizeProfile)}catch(error){}
      let legacy=null;try{const rows=JSON.parse(localStorage.getItem(STORAGE_KEY));if(Array.isArray(rows)&&rows.length)legacy=normalizeCatalog(rows)}catch(error){}
      return [normalizeProfile({id:profileId(),name:'我的配置',catalog:legacy||normalizeCatalog(clone(defaults)),updatedAt:new Date().toISOString()})];
    }
    let globalDesignQualityRules=clone(DEFAULT_DESIGN_QUALITY_RULES),globalLayoutConstraints=clone(DEFAULT_LAYOUT_CONSTRAINTS);
    let profiles=loadProfiles(),activeProfileId=profiles[0]?.id;
    if(!profiles.some(profile=>profile.id===activeProfileId))activeProfileId=profiles[0].id;
    let catalog=clone(profiles.find(profile=>profile.id===activeProfileId).catalog),selectedId=catalog[0]?.id||null,original=null,autoSaveTimer=null,remoteSaveTimer=null,serverReady=false,candidateRulesDraft=[],geometryVariantsDraft=[],selectedCandidateRuleIndex=0,activeRoomTypeId='bedroom',previewVariantId='base',previewMode='item',viewMode='library';
    // Node 基线导出器复用与编辑页完全相同的 normalize/compile 流程，避免手写两份默认 JSON。
    if(typeof document==='undefined'){globalThis.FurnitureConfigBaseline=globalConfigPayload();return;}
    const pendingDefaultKeys=new Set();
    const $=id=>document.getElementById(id),form=$('ruleForm'),status=$('status');
    const fields=['ruleId','ruleLabel','ruleProgram','ruleCategory','ruleRole','ruleColor','width','depth','shape','searchVariants','minCount','maxCount','defaultCount','preferenceWeight','placementPriority','accessTarget','candidateMode','requiredAnchor','rotations','relativeTo','relationSide','crossAlign','relation','relationGapMin','relationGapMax','relationGapStep','facingModes','candidateRuleLimit','candidateRuleWeight','candidateCollisionClearance','candidateAllowFunctionalOverlap','lShapeEnabled','lShapeLateralSide','lShapeFrontAlign','candidateTotalLimit','avoidWindow','allowCorner','serviceLabel','serviceSide','serviceDepth','spanExtra','serviceAlignStart','adaptiveFootZone','serviceSharedCirculation','allowBodyTypes','serviceHard','runEnabled','runMin','runMax','runStep','fillMin','fillMax','runMaxByWalls','runMaxPerWall','runWallCountCap','runAreaPerCabinet'];

    function lShapePolicy(entry={},resolve=true){
      const raw=entry?.referenceShapePolicy?.lShape||{},has=(object,key)=>object&&Object.prototype.hasOwnProperty.call(object,key)&&object[key]!=null;
      const enabled=has(raw,'enabled')?raw.enabled!==false:has(entry,'excludeForLShape')?!entry.excludeForLShape:null;
      const legacySide=has(entry,'avoidChaiseSide')?(entry.avoidChaiseSide?'non-chaise':'any'):null,lateralSide=['any','non-chaise','chaise-only'].includes(raw.lateralSide)?raw.lateralSide:legacySide;
      const legacyAlign=has(entry,'lShapeCrossAlign')?(entry.lShapeCrossAlign==='main-seat'?'main-seat':'bbox'):null,frontAlign=['bbox','body-center','main-seat'].includes(raw.frontAlign)?raw.frontAlign:legacyAlign;
      return {enabled:enabled??(resolve?true:null),lateralSide:lateralSide??(resolve?'any':null),frontAlign:frontAlign??(resolve?'bbox':null)};
    }
    function writeLShapePolicy(entry,policy=lShapePolicy(entry)){
      entry.referenceShapePolicy={...(entry.referenceShapePolicy||{}),lShape:{...policy}};
      delete entry.excludeForLShape;delete entry.avoidChaiseSide;delete entry.lShapeCrossAlign;
      return entry;
    }

    function normalizeCandidateEntry(entry,index=0){
      const gap=Math.max(0,Number(entry?.gap)||0),distance=entry?.distance||{},min=Math.max(0,Number.isFinite(Number(distance.min))?Number(distance.min):gap),max=Math.max(min,Number.isFinite(Number(distance.max))?Number(distance.max):min),step=Math.max(.05,Number(distance.step)||.2),facing=Array.isArray(entry?.facing)&&entry.facing.length?entry.facing.filter(value=>['toward','away','parallel'].includes(value)):['parallel'];
      const has=(key)=>entry&&Object.prototype.hasOwnProperty.call(entry,key);
      const policy=lShapePolicy(entry,false);
      return {id:entry?.id||`candidate-${index+1}`,enabled:entry?.enabled!==false,mode:entry?.mode||'wall',rotations:Array.isArray(entry?.rotations)&&entry.rotations.length?entry.rotations:[0,90],relativeTo:entry?.relativeTo||'',relation:entry?.relation||'',side:['front','back','left','right'].includes(entry?.side)?entry.side:'front',crossAlign:['center','back','front','left','right'].includes(entry?.crossAlign)?entry.crossAlign:'center',crossOffset:Number(entry?.crossOffset)||0,distance:{min,max,step},facing:[...new Set(facing)],maxSamples:Math.min(48,Math.max(1,Math.round(Number(entry?.maxSamples)||12))),weight:Math.min(3,Math.max(0,Number.isFinite(Number(entry?.weight))?Number(entry.weight):1)),collisionClearance:Math.min(1,Math.max(0,Number.isFinite(Number(entry?.collisionClearance))?Number(entry.collisionClearance):.025)),allowFunctionalOverlap:!!entry?.allowFunctionalOverlap,compoundConstraint:entry?.compoundConstraint?clone(entry.compoundConstraint):undefined,referenceShapePolicy:{...(entry?.referenceShapePolicy||{}),lShape:policy}};
    }
    function candidateRulesFromCandidate(candidate={}){
      if(Array.isArray(candidate.rules)&&candidate.rules.length)return candidate.rules.map(normalizeCandidateEntry);
      const relation=String(candidate.relation||''),sides=/side/i.test(relation)?['left','right']:[/back|behind/i.test(relation)?'back':'front'];
      return sides.map((side,index)=>normalizeCandidateEntry({...candidate,id:`candidate-${index+1}`,side,distance:candidate.distance||{min:Number(candidate.gap)||0,max:Number(candidate.gap)||0,step:.2}},index));
    }

    function normalizeRule(rule,index=0){
      const value=clone(rule),finite=(input,fallback)=>Number.isFinite(Number(input))?Number(input):fallback,min=Math.max(0,Math.round(finite(value.quantity?.min,0))),max=Math.max(min,Math.round(finite(value.quantity?.max,1)));
      const defaultCount=DEFAULT_COUNTS[value.program]?.[value.id]??min;
      value.quantity={min,max};value.preferences={defaultCount:Math.min(max,Math.max(min,Math.round(finite(value.preferences?.defaultCount,defaultCount)))),weight:Math.min(3,Math.max(0,finite(value.preferences?.weight,1))),priority:Math.max(1,Math.round(finite(value.preferences?.priority,(index+1)*10)))};
      value.geometry=value.geometry||{width:1,depth:.4,shape:'box'};if(value.program==='living'&&value.id==='sofa'&&!Array.isArray(value.geometry.variants))value.geometry.variants=[{id:'box',label:'普通沙发',width:value.geometry.width,depth:value.geometry.depth,shape:'box'},{id:'l-left',label:'左贵妃 L 形沙发',width:Math.max(2.8,value.geometry.width+.5),depth:Math.max(1.65,value.geometry.depth+.65),shape:'l-left'},{id:'l-right',label:'右贵妃 L 形沙发',width:Math.max(2.8,value.geometry.width+.5),depth:Math.max(1.65,value.geometry.depth+.65),shape:'l-right'}];
      const modulePresets=DEFAULT_MODULE_VARIANTS[`${value.program}:${value.id}`];if(modulePresets&&!Array.isArray(value.geometry.variants))value.geometry.variants=modulePresets.map((dims,moduleIndex)=>({id:`${value.id}-m${moduleIndex+1}`,label:`${value.label} ${moduleIndex+1}号`,width:dims[0],depth:dims[1],shape:'box'}));
      if(!Object.prototype.hasOwnProperty.call(value.geometry,'searchVariants'))value.geometry.searchVariants=DEFAULT_SEARCH_VARIANTS.has(`${value.program}:${value.id}`);
      if(Array.isArray(value.geometry.variants))value.geometry.variants=value.geometry.variants.filter(row=>row&&row.shape).map((row,index)=>({id:row.id||`${row.shape}-${index+1}`,label:row.label||row.id||row.shape,width:Math.max(.1,finite(row.width??row.w,value.geometry.width)),depth:Math.max(.1,finite(row.depth??row.d,value.geometry.depth)),shape:row.shape}));value.candidate={rules:candidateRulesFromCandidate(value.candidate||{}),maxCandidates:Math.min(72,Math.max(4,Math.round(Number(value.candidate?.maxCandidates)||32)))};value.placement={requiredAnchor:'none',avoidWindow:false,allowCorner:false,...value.placement};value.placement.allowCorner=!!value.placement.allowCorner;value.service={sharedCirculation:false,...(value.service||{label:'日常使用区',side:'front',depth:.42,spanExtra:0,hard:false,allowBodyTypes:[]})};
      // 迁移旧配置：休闲椅不能只采样四个墙角，还要少量采样真正空闲的地面区域。
      if(value.program==='bedroom'&&value.id==='lounge'){
        if(!value.candidate.rules.some(entry=>entry.mode==='zone'))value.candidate.rules.push(normalizeCandidateEntry({id:'reading-open-zone',mode:'zone',rotations:[0,90],relation:'reading-open-zone',maxSamples:10,weight:1.18},value.candidate.rules.length));
        value.candidate.maxCandidates=Math.max(14,value.candidate.maxCandidates);
      }
      if(value.program==='bedroom'&&value.id==='night')for(const entry of value.candidate.rules)if(entry.relativeTo==='bed'||entry.relation==='bed-side'){
        entry.crossAlign='back';entry.distance={min:0,max:0,step:.05};entry.collisionClearance=0;entry.allowFunctionalOverlap=true;entry.weight=Math.max(1.55,entry.weight||1);
      }
      // 旧配置只有“相对沙发的前/左/右”，没有区分 L 型沙发的贵妃侧与主坐面。
      // 在编辑器中补齐同一套缺省语义，用户打开旧规则时即可看到、修改并自动保存。
      if(value.program==='living')for(const entry of value.candidate.rules){
        const policy=lShapePolicy(entry,false);
        if(value.id==='coffee'&&entry.relativeTo==='sofa'&&entry.side==='front'&&policy.frontAlign==null)policy.frontAlign='main-seat';
        if(value.id==='tv'&&entry.relativeTo==='sofa'&&entry.side==='front')policy.frontAlign='body-center';
        if(value.id==='arm'&&entry.relativeTo==='sofa'){
          if(entry.side==='front'&&policy.enabled==null)policy.enabled=false;
          if(entry.side==='left'||entry.side==='right')policy.enabled=false;
        }
        if(value.id==='side'&&entry.relativeTo==='sofa'&&(entry.side==='left'||entry.side==='right')&&policy.lateralSide==null)policy.lateralSide='non-chaise';
        writeLShapePolicy(entry,{enabled:policy.enabled??true,lateralSide:policy.lateralSide||'any',frontAlign:policy.frontAlign||'bbox'});
      }
      if(value.program==='living'&&value.id==='arm'){
        value.candidate.rules=value.candidate.rules.filter(entry=>entry.side!=='outward');
        if(!value.candidate.rules.some(entry=>entry.relativeTo==='side'&&entry.side==='front'))value.candidate.rules.push(normalizeCandidateEntry({id:'arm-side-front',mode:'relation',relativeTo:'side',relation:'sofa-side-chair-chain',side:'front',distance:{min:.04,max:.16,step:.06},facing:['parallel'],maxSamples:10,weight:1.9,allowFunctionalOverlap:true,compoundConstraint:{ancestorRelativeTo:'sofa',side:'front',gap:.04}},value.candidate.rules.length));
        for(const entry of value.candidate.rules)if(entry.relativeTo==='side'&&entry.side==='front'){entry.allowFunctionalOverlap=true;entry.compoundConstraint={ancestorRelativeTo:'sofa',side:'front',gap:.04,...(entry.compoundConstraint||{})}}
      }
      if(value.program==='bedroom'&&value.id==='tvbench'&&!value.candidate.rules.some(entry=>entry.relativeTo==='bedroomLoveseat'))value.candidate.rules.unshift(normalizeCandidateEntry({id:'tvbench-loveseat-facing',mode:'relation',relativeTo:'bedroomLoveseat',relation:'bedroom-media-facing',side:'front',distance:{min:1,max:2.8,step:.25},facing:['toward'],maxSamples:18,weight:1.55},0));
      if(value.program==='bedroom'&&value.id==='tvbench'){for(const entry of value.candidate.rules){if(entry.relativeTo==='bedroomLoveseat'){entry.distance={...(entry.distance||{}),min:Math.min(1,Number(entry.distance?.min)||1)};writeLShapePolicy(entry,{enabled:true,lateralSide:'any',frontAlign:'body-center'})}if(entry.mode==='wall')entry.maxSamples=Math.max(40,Number(entry.maxSamples)||0)}value.candidate.maxCandidates=Math.max(56,value.candidate.maxCandidates||0)}
      for(const entry of value.candidate.rules)writeLShapePolicy(entry);
      if(value.program==='bedroom'&&value.id==='desk'&&!value.geometry.variants?.length)value.geometry.variants=[
        {id:'desk-90',label:'书桌 0.9 m',width:.9,depth:.55,shape:'box'},
        {id:'desk-120',label:'书桌 1.2 m',width:1.2,depth:.55,shape:'box'},
        {id:'desk-140',label:'书桌 1.4 m',width:1.4,depth:.55,shape:'box'},
        {id:'desk-160',label:'书桌 1.6 m',width:1.6,depth:.55,shape:'box'}
      ];
      if(value.program==='bedroom'&&value.id==='chair'&&value.service.label==='座椅后退区'&&Math.abs(finite(value.service.depth,.6)-.6)<1e-6){value.service.label='工作椅占位';value.service.depth=0;value.service.hard=false;value.service.spanExtra=0;}
      const cabinetUpgrade={wardrobe:['柜前取用区',.42],chest:['抽屉取用区',.48],shelf:['取物站立区',.42],tvbench:['设备取用区',.40],bedroomDisplay:['展示柜取用区',.42],bedroomInfillCabinet:['定制柜取用区',.45],sideboard:['柜前取用区',.50],bookcase:['取书站立区',.42],display:['展示柜取用区',.45],console:['窄柜取用区',.40],infillCabinet:['定制柜取用区',.45]}[value.id];
      const legacyWardrobe=value.id==='wardrobe'&&value.service.label==='柜门开启区'&&Math.abs(finite(value.service.depth,.42)-.42)<1e-6;
      if(cabinetUpgrade&&value.service.hard!==false&&(legacyWardrobe||Math.abs(finite(value.service.depth,.6)-.6)<1e-6)){value.service.label=cabinetUpgrade[0];value.service.depth=cabinetUpgrade[1];value.service.hard=false;value.service.spanExtra=0;}
      if(value.program==='bedroom'&&['desk','vanity'].includes(value.id))value.service.hard=false;
      if(value.program==='bedroom'&&value.id==='bench'){
        value.service.label='床尾凳共享落脚区';value.service.depth=.42;value.service.hard=false;value.service.spanExtra=0;value.service.allowBodyTypes=[];value.service.sharedCirculation=true;value.service.adaptiveFootZone=true;value.service.adaptiveGapThreshold=.30;
        const desired=[candidateRule('bench-bed-foot-center','relation',{relativeTo:'bed',relation:'bed-foot',side:'front',crossAlign:'center',distance:{min:.10,max:.15,step:.05},facing:['toward'],maxSamples:4,allowFunctionalOverlap:true,weight:1.42}),candidateRule('bench-bed-foot-left','relation',{relativeTo:'bed',relation:'bed-foot',side:'front',crossAlign:'left',crossOffset:-.25,distance:{min:.08,max:.12,step:.04},facing:['toward'],maxSamples:4,allowFunctionalOverlap:true,weight:1.5}),candidateRule('bench-bed-foot-right','relation',{relativeTo:'bed',relation:'bed-foot',side:'front',crossAlign:'right',crossOffset:.25,distance:{min:.08,max:.12,step:.04},facing:['toward'],maxSamples:4,allowFunctionalOverlap:true,weight:1.5})];
        value.candidate.rules=desired.map(normalizeCandidateEntry);value.candidate.maxCandidates=12;
      }
      value.service.alignStart=!!value.service.alignStart;
      return value;
    }
    function normalizeCatalog(rows){return rows.map(normalizeRule)}
    function compactRule(rule){
      const value=clone(rule);delete value.schemaVersion;
      value.candidate={rules:clone(value.candidate?.rules||[]),maxCandidates:value.candidate?.maxCandidates??32};
      for(const entry of value.candidate.rules){delete entry.excludeForLShape;delete entry.avoidChaiseSide;delete entry.lShapeCrossAlign;for(const key of Object.keys(entry))if(entry[key]===undefined)delete entry[key]}
      return value;
    }
    function compiledCatalog(profile=currentProfile()){
      if(!profile)return[];const result=[];for(const type of profile.roomTypes||DEFAULT_ROOM_TYPES)for(const id of profile.roomAssignments?.[type.id]||[]){const source=catalog.find(rule=>rule.id===id)||profile.catalog.find(rule=>rule.id===id);if(!source)continue;const rule=clone(source),setting=profile.roomSettings?.[type.id]?.[id]||{};rule.program=type.id;rule.quantity={min:setting.min??rule.quantity.min,max:setting.max??rule.quantity.max};rule.preferences={...(rule.preferences||{}),defaultCount:setting.defaultCount??rule.preferences?.defaultCount??rule.quantity.min,weight:setting.weight??rule.preferences?.weight??1,priority:setting.priority??100};result.push(rule)}return result;
    }
    function globalConfigPayload(profile=currentProfile()){
      return {schemaVersion:9,baselineVersion:BASELINE_VERSION,profileName:'全局家具配置',updatedAt:new Date().toISOString(),designQualityRules:clone(globalDesignQualityRules),layoutConstraints:clone(globalLayoutConstraints),roomTypes:clone(profile?.roomTypes||DEFAULT_ROOM_TYPES),furnitureLibrary:catalog.map(compactRule),roomAssignments:clone(profile?.roomAssignments||{}),roomSettings:clone(profile?.roomSettings||{})};
    }
    function applyGlobalConfigPayload(parsed){
      if(!globalThis.RoomChessConfigContract)throw new Error('全局配置契约模块未加载');
      globalThis.RoomChessConfigContract.assertGlobalConfig(parsed);
      const rows=parsed?.furnitureLibrary||parsed?.furnitureRules;if(!Array.isArray(rows)||!rows.length)throw new Error('服务端配置缺少 furnitureLibrary');
      if(!parsed.designQualityRules||!parsed.layoutConstraints)throw new Error('服务端配置缺少 designQualityRules 或 layoutConstraints；拒绝套用 JS 默认值');
      const profile=normalizeProfile({...parsed,id:'global-profile',name:'全局配置',catalog:normalizeCatalog(rows),roomTypes:Array.isArray(parsed.roomTypes)?parsed.roomTypes:DEFAULT_ROOM_TYPES,roomAssignments:parsed.roomAssignments,roomSettings:parsed.roomSettings,updatedAt:parsed.updatedAt||new Date().toISOString()});
      globalDesignQualityRules=clone(parsed.designQualityRules);globalLayoutConstraints=clone(parsed.layoutConstraints);
      profiles=[profile];activeProfileId=profile.id;catalog=clone(profile.catalog);selectedId=catalog.some(row=>row.id===selectedId)?selectedId:catalog[0]?.id||null;activeRoomTypeId=profile.roomTypes.some(row=>row.id===activeRoomTypeId)?activeRoomTypeId:'bedroom';
    }
    async function initializeGlobalConfig(){
      try{
        const response=await fetch(GLOBAL_CONFIG_API);
        const payload=await response.json();if(!response.ok)throw new Error(payload.detail||`HTTP ${response.status}`);
        applyGlobalConfigPayload(payload.config);serverReady=true;status.className='status ok';status.textContent='已读取 FastAPI 当前全局配置；页面不会再用 JS 内置规则覆盖它。';
      }catch(error){serverReady=false;status.className='status error';status.textContent=`全局配置连接失败：${error.message}`;}
    }
    function scheduleGlobalSave(){
      if(!serverReady)return;clearTimeout(remoteSaveTimer);remoteSaveTimer=setTimeout(async()=>{
        try{const nextConfig=globalConfigPayload();globalThis.RoomChessConfigContract.assertGlobalConfig(nextConfig);const response=await fetch(GLOBAL_CONFIG_API,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(nextConfig)});const payload=await response.json();if(!response.ok)throw new Error(payload.detail||`HTTP ${response.status}`);status.className='status ok';status.textContent=`已保存到 FastAPI 全局配置 ${new Date().toLocaleTimeString('zh-CN',{hour12:false})}`;}
        catch(error){status.className='status error';status.textContent=`全局配置保存失败：${error.message}`;}
      },320);
    }
    function persist({remote=true}={}){
      const profile=profiles.find(row=>row.id===activeProfileId);if(profile){profile.catalog=clone(catalog);profile.updatedAt=new Date().toISOString()}
      if(ENABLE_LOCAL_CONFIG_PERSISTENCE){localStorage.setItem(PROFILE_STORAGE_KEY,JSON.stringify(profiles));localStorage.setItem(ACTIVE_PROFILE_KEY,activeProfileId);localStorage.setItem(STORAGE_KEY,JSON.stringify(compiledCatalog(profile)));}
      renderProfiles();renderRoomTypes();renderRoomPlan();
      if(remote)scheduleGlobalSave();
    }
    function currentProfile(){return profiles.find(row=>row.id===activeProfileId)}
    function defaultForRule(rule){return currentProfile()?.defaultsByRule?.[ruleKey(rule)]||null}
    function finalizeRuleDefault(rule=active()){
      if(!rule)return;const key=ruleKey(rule),profile=currentProfile();if(!profile.defaultsByRule)profile.defaultsByRule={};if(!profile.defaultsByRule[key]||pendingDefaultKeys.has(key)){profile.defaultsByRule[key]=clone(rule);pendingDefaultKeys.delete(key);persist()}
    }
    function uniqueProfileName(base){let name=(base||'新配置').trim()||'新配置',index=2;while(profiles.some(row=>row.name===name))name=`${base} ${index++}`;return name}
    function renderProfiles(){
      const select=$('profileSelect');if(!select)return;select.innerHTML=profiles.map(profile=>`<option value="${escapeHtml(profile.id)}" ${profile.id===activeProfileId?'selected':''}>${escapeHtml(profile.name)} · ${profile.catalog.length} 条</option>`).join('');
      $('deleteProfileBtn').disabled=profiles.length<=1;
    }
    function currentRoomTypes(){return currentProfile()?.roomTypes||DEFAULT_ROOM_TYPES}
    function currentRoomAssignments(roomId=activeRoomTypeId){const profile=currentProfile();profile.roomAssignments=profile.roomAssignments||{};return profile.roomAssignments[roomId]||(profile.roomAssignments[roomId]=[])}
    function currentRoomSettings(roomId=activeRoomTypeId){const profile=currentProfile();profile.roomSettings=profile.roomSettings||{};return profile.roomSettings[roomId]||(profile.roomSettings[roomId]={})}
    function roomTypeLabel(id){return currentRoomTypes().find(type=>type.id===id)?.label||id}
    function renderRoomTypes(){
      if(!$('roomTypeSelect'))return;const roomTypes=currentRoomTypes();if(!roomTypes.some(type=>type.id===activeRoomTypeId))activeRoomTypeId=roomTypes[0]?.id||'bedroom';$('roomTypeSelect').innerHTML=roomTypes.map(type=>`<option value="${escapeHtml(type.id)}" ${type.id===activeRoomTypeId?'selected':''}>${escapeHtml(type.label)}${type.engineEnabled?' · 已接入空间棋':' · 仅配置'}</option>`).join('');const programOptions=roomTypes.map(type=>`<option value="${escapeHtml(type.id)}">${escapeHtml(type.label)}</option>`).join('')+'<option value="library">家具库</option><option value="shared">通用</option>',ruleValue=$('ruleProgram').value||'library';$('programFilter').innerHTML='<option value="all">全部家具</option>';$('programFilter').value='all';$('ruleProgram').innerHTML=programOptions;$('ruleProgram').value=[...$('ruleProgram').options].some(option=>option.value===ruleValue)?ruleValue:'library';const rows=currentRoomAssignments();$('roomTypeSummary').textContent=`${roomTypeLabel(activeRoomTypeId)} · 已加入 ${rows.length} 类家具 · 顺序和数量独立`;$('deleteRoomTypeBtn').disabled=DEFAULT_ROOM_TYPES.some(type=>type.id===activeRoomTypeId);$('renameRoomTypeBtn').disabled=DEFAULT_ROOM_TYPES.some(type=>type.id===activeRoomTypeId);
    }
    function renderRoomPlan(){
      if(!$('roomAssignmentList'))return;const assigned=currentRoomAssignments(),settings=currentRoomSettings(),available=catalog.filter(rule=>!assigned.includes(rule.id)).sort((a,b)=>a.label.localeCompare(b.label,'zh-CN'));$('roomFurnitureSelect').innerHTML=available.map(rule=>`<option value="${escapeHtml(rule.id)}">${escapeHtml(rule.label)} · ${escapeHtml(rule.category)}</option>`).join('')||'<option value="">没有更多可加入家具</option>';$('addRoomFurnitureBtn').disabled=!available.length;$('roomPoolHint').textContent=`家具库共 ${catalog.length} 类，当前房间已引用 ${assigned.length} 类。`;$('roomOrderTitle').textContent=`${roomTypeLabel(activeRoomTypeId)} · 落子优先级清单`;$('roomAssignmentList').innerHTML=assigned.map((id,index)=>{const rule=catalog.find(item=>item.id===id);if(!rule)return'';const setting=settings[id]||{};return `<div class="room-item" data-room-item="${escapeHtml(id)}"><span class="room-rank">${index+1}</span><span><strong>${escapeHtml(rule.label)}</strong><small>${escapeHtml(rule.category)} · ${escapeHtml(id)}</small></span><input type="number" min="0" max="20" step="1" value="${setting.min??0}" data-room-setting="min" title="最少数量"><input type="number" min="0" max="20" step="1" value="${setting.max??1}" data-room-setting="max" title="最多数量"><input class="optional-col" type="number" min="0" max="20" step="1" value="${setting.defaultCount??0}" data-room-setting="defaultCount" title="默认数量"><input class="optional-col" type="number" min="0" max="3" step="0.1" value="${setting.weight??1}" data-room-setting="weight" title="选用偏好"><span class="room-actions"><button class="btn" type="button" data-room-move="-1" ${index===0?'disabled':''}>↑</button><button class="btn" type="button" data-room-move="1" ${index===assigned.length-1?'disabled':''}>↓</button></span><button class="btn danger" type="button" data-room-remove>移除</button></div>`}).join('')||'<p class="schema-note">这个房间还没有家具。请从左侧家具物品库加入；空清单不会进入空间棋搜索。</p>';
      $('roomAssignmentList').querySelectorAll('[data-room-item]').forEach(row=>{const id=row.dataset.roomItem;row.querySelectorAll('[data-room-setting]').forEach(input=>input.addEventListener('change',()=>updateRoomSetting(id,input.dataset.roomSetting,input.value)));row.querySelectorAll('[data-room-move]').forEach(button=>button.addEventListener('click',()=>moveRoomFurniture(id,Number(button.dataset.roomMove))));row.querySelector('[data-room-remove]')?.addEventListener('click',()=>removeRoomFurniture(id))});
    }
    function addRoomFurniture(){const id=$('roomFurnitureSelect').value;if(!id||currentRoomAssignments().includes(id))return;const rule=catalog.find(item=>item.id===id);currentRoomAssignments().push(id);currentRoomSettings()[id]={min:0,max:Math.max(1,rule.quantity?.max||1),defaultCount:Math.min(1,Math.max(0,rule.quantity?.max||1)),weight:rule.preferences?.weight??1,priority:currentRoomAssignments().length*10};persist();status.className='status ok';status.textContent=`已把“${rule.label}”加入${roomTypeLabel(activeRoomTypeId)}；这里只新增引用，家具本体配置没有复制。`}
    function removeRoomFurniture(id){const rule=catalog.find(item=>item.id===id);if(!confirm(`从${roomTypeLabel(activeRoomTypeId)}落子清单移除“${rule?.label||id}”？家具仍保留在物品库。`))return;currentProfile().roomAssignments[activeRoomTypeId]=currentRoomAssignments().filter(item=>item!==id);delete currentRoomSettings()[id];persist()}
    function moveRoomFurniture(id,direction){const rows=currentRoomAssignments(),index=rows.indexOf(id),target=index+direction;if(index<0||target<0||target>=rows.length)return;[rows[index],rows[target]]=[rows[target],rows[index]];rows.forEach((item,idx)=>{currentRoomSettings()[item].priority=(idx+1)*10});persist()}
    function updateRoomSetting(id,key,value){const setting=currentRoomSettings()[id];setting[key]=key==='weight'?Math.min(3,Math.max(0,Number(value)||0)):Math.max(0,Math.round(Number(value)||0));if(setting.max<setting.min)setting.max=setting.min;if(setting.defaultCount<setting.min)setting.defaultCount=setting.min;if(setting.defaultCount>setting.max)setting.defaultCount=setting.max;persist()}
    function constraintDocument(){return {designQualityRules:clone(globalDesignQualityRules),layoutConstraints:clone(globalLayoutConstraints)}}
    function validateConstraintDocument(value){
      const errors=[],quality=value?.designQualityRules,layout=value?.layoutConstraints,circulation=layout?.circulation,modes=layout?.densityModes;
      if(!quality?.weights||!quality?.floor||!quality?.wall||!quality?.gates)errors.push('designQualityRules 必须包含 weights / floor / wall / gates');
      if(!circulation?.levels?.length)errors.push('layoutConstraints.circulation.levels 不能为空');
      const hard=circulation?.levels?.find(row=>row.id===circulation?.hardLevelId);
      if(!hard||Number(hard.radius)<.25)errors.push('硬通行半径不得小于 0.25m（即最窄通过缝隙 0.5m）');
      if(circulation?.requireZeroIslands!==true)errors.push('requireZeroIslands 必须为 true');
      if(modes?.rich?.enabled!==true||modes?.airy?.enabled!==false||modes?.standard?.enabled!==false)errors.push('当前阶段只允许 rich，airy / standard 必须停用');
      if(!layout?.search||!layout?.postLayout||!layout?.inventory||!layout?.qualityPass||!layout?.designGrammar)errors.push('layoutConstraints 缺少 search / postLayout / inventory / qualityPass / designGrammar');
      if(!(Number(layout?.search?.semanticSampling?.wall?.maxUniformPositions)>0))errors.push('search.semanticSampling.wall.maxUniformPositions 必须为正数');
      const wallComplements=layout?.postLayout?.wallComplements;
      if(wallComplements?.repairOnly!==true||wallComplements?.countTowardRichMinimum!==false)errors.push('postLayout.wallComplements 只能修缝，且不得计入丰富度');
      const longBedroomChallenge=layout?.inventory?.longBedroomChallenge;
      if(longBedroomChallenge?.enabled!==true||!(Number(longBedroomChallenge.minArea)>0)||!(Number(longBedroomChallenge.minAspect)>1)||!longBedroomChallenge.counts||!longBedroomChallenge.requiredCounts)errors.push('inventory.longBedroomChallenge 必须包含启用条件、家具数量与真实家具必放数量');
      const deskSizePolicy=layout?.search?.sizePolicies?.bedroom?.desk;
      if(!deskSizePolicy)errors.push('search.sizePolicies.bedroom.desk 不能为空');
      else if(!Array.isArray(deskSizePolicy.targetByArea)||!deskSizePolicy.targetByArea.length||!Array.isArray(deskSizePolicy.searchMaxByArea)||!deskSizePolicy.searchMaxByArea.length||!(Number(deskSizePolicy.repairCandidateLimit)>0))errors.push('书桌模数策略缺少面积目标、搜索上限或末轮候选预算');
      return errors;
    }
    function renderGlobalConstraints(){
      if(!$('globalConstraintsJson'))return;const circulation=globalLayoutConstraints.circulation||{},hard=(circulation.levels||[]).find(row=>row.id===circulation.hardLevelId),rich=globalLayoutConstraints.densityModes?.rich||{},search=globalLayoutConstraints.search||{},wall=globalDesignQualityRules.wall||{};
      $('globalConstraintsJson').value=JSON.stringify(constraintDocument(),null,2);
      $('constraintsSummary').innerHTML=[['最窄通行',`${((hard?.radius||0)*2).toFixed(2)} m`],['孤岛',circulation.requireZeroIslands?'禁止':'允许'],['开放模式',rich.enabled?'仅丰富':'配置错误'],['Beam 基准',search.defaultBeamWidth??'—'],['墙缝重罚',`${wall.severeGapMin??'—'}–${wall.severeGapMax??'—'} m`]].map(([label,value])=>`<div class="constraint-card"><span>${label}</span><strong>${value}</strong></div>`).join('');
    }
    function saveGlobalConstraints(){
      const output=$('globalConstraintsStatus');try{const parsed=JSON.parse($('globalConstraintsJson').value),errors=validateConstraintDocument(parsed);if(errors.length)throw new Error(errors.join('；'));globalDesignQualityRules=clone(parsed.designQualityRules);globalLayoutConstraints=clone(parsed.layoutConstraints);persist();renderGlobalConstraints();output.className='status ok';output.textContent='结构有效，已保存到 FastAPI 当前全局配置。';}catch(error){output.className='status error';output.textContent=`未保存：${error.message}`;}
    }
    function setViewMode(mode){viewMode=['room','constraints'].includes(mode)?mode:'library';document.body.classList.toggle('mode-library',viewMode==='library');document.body.classList.toggle('mode-room',viewMode==='room');document.body.classList.toggle('mode-constraints',viewMode==='constraints');$('libraryModeBtn').classList.toggle('active',viewMode==='library');$('roomModeBtn').classList.toggle('active',viewMode==='room');$('constraintsModeBtn').classList.toggle('active',viewMode==='constraints');renderRoomPlan();if(viewMode==='constraints')renderGlobalConstraints()}
    function selectRoomType(id){
      clearTimeout(autoSaveTimer);if(active()&&!save({automatic:true,silent:true}))return;finalizeRuleDefault();activeRoomTypeId=id;renderRoomTypes();renderRoomPlan();status.className='status ok';status.textContent=`已切换到“${roomTypeLabel(id)}”；这里显示该房间引用的家具、数量和落子顺序。`;
    }
    function createRoomType(){
      const label=(prompt('新房间类型名称，例如：书房')||'').trim();if(!label)return;let id=(prompt('房间类型 ID（英文）',label.toLowerCase().replace(/\s+/g,'_'))||'').trim();if(!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)){alert('房间类型 ID 必须以字母开头，只包含字母、数字、_、-');return}if(currentRoomTypes().some(type=>type.id===id)){alert(`房间类型 ${id} 已存在`);return}currentProfile().roomTypes.push({id,label,engineEnabled:false});currentProfile().roomAssignments[id]=[];currentProfile().roomSettings[id]={};persist();selectRoomType(id);
    }
    function renameRoomType(){const type=currentRoomTypes().find(row=>row.id===activeRoomTypeId);if(!type||type.engineEnabled)return;const label=(prompt('房间类型名称',type.label)||'').trim();if(!label)return;type.label=label;persist();renderRoomTypes()}
    function deleteRoomType(){const type=currentRoomTypes().find(row=>row.id===activeRoomTypeId);if(!type||type.engineEnabled)return;if(!confirm(`删除房间类型“${type.label}”及它的落子清单？家具物品库不会删除。`))return;delete currentProfile().roomAssignments[type.id];delete currentProfile().roomSettings[type.id];currentProfile().roomTypes=currentRoomTypes().filter(row=>row.id!==type.id);activeRoomTypeId='bedroom';persist();selectRoomType(activeRoomTypeId)}
    function activateProfile(id,message='',skipCurrentSave=false){
      clearTimeout(autoSaveTimer);if(!skipCurrentSave){if(active()&&!save({automatic:true,silent:true})){renderProfiles();return}finalizeRuleDefault()}const profile=profiles.find(row=>row.id===id);if(!profile)return;activeProfileId=id;catalog=normalizeCatalog(clone(profile.catalog));if(!currentRoomTypes().some(type=>type.id===activeRoomTypeId))activeRoomTypeId=currentRoomTypes()[0]?.id||'bedroom';selectedId=catalog[0]?.id||null;persist();renderList();setForm(active());$('autoSaveKicker').textContent='修改后自动保存';status.className='status ok';status.textContent=message||`已切换到“${profile.name}”，空间棋将读取该档案。`;
    }
    function createProfile(copyCurrent=false){
      const suggested=copyCurrent?`${profiles.find(row=>row.id===activeProfileId)?.name||'配置'} 副本`:'新用户配置',name=prompt('配置档案名称',uniqueProfileName(suggested));if(!name)return;
      const source=currentProfile(),profile=normalizeProfile({id:profileId(),name:uniqueProfileName(name),catalog:copyCurrent?clone(catalog):normalizeCatalog(clone(defaults)),defaultsByRule:copyCurrent?clone(source?.defaultsByRule||{}):{},roomTypes:copyCurrent?clone(source?.roomTypes||DEFAULT_ROOM_TYPES):clone(DEFAULT_ROOM_TYPES),roomAssignments:copyCurrent?clone(source?.roomAssignments||{}):undefined,roomSettings:copyCurrent?clone(source?.roomSettings||{}):undefined,updatedAt:new Date().toISOString()});profiles.push(profile);activateProfile(profile.id,`已创建并启用“${profile.name}”。`);
    }
    function deleteProfile(){
      if(profiles.length<=1)return;const current=profiles.find(row=>row.id===activeProfileId);if(!confirm(`删除配置档案“${current.name}”？此操作只删除当前浏览器中的该档案。`))return;
      clearTimeout(autoSaveTimer);if(!save({automatic:true,silent:true}))return;finalizeRuleDefault();profiles=profiles.filter(row=>row.id!==activeProfileId);activateProfile(profiles[0].id,`已删除“${current.name}”，并切换到“${profiles[0].name}”。`,true);
    }
    function active(){return catalog.find(rule=>rule.id===selectedId)||catalog[0]}
    function number(id,fallback=0){const value=Number($(id).value);return Number.isFinite(value)?value:fallback}
    function splitList(value){return value.split(',').map(row=>row.trim()).filter(Boolean)}
    function furnitureEnumRows(program,excludeId=''){
      return catalog.filter(rule=>rule.id!==excludeId).sort((a,b)=>a.label.localeCompare(b.label,'zh-CN'));
    }
    function populateFurnitureEnums(program,excludeId='',relativeValue='',allowedValues=[]){
      const rows=furnitureEnumRows(program,excludeId),relative=$('relativeTo'),allowed=new Set(allowedValues||[]),known=new Set(rows.map(rule=>rule.id));
      const extras=[relativeValue,...allowed].filter(value=>value&&!known.has(value));for(const value of extras){rows.push({id:value,label:`${value}（外部类型）`,program:'external'});known.add(value)}
      relative.innerHTML='<option value="">无</option>'+rows.map(rule=>`<option value="${escapeHtml(rule.id)}">${escapeHtml(rule.label)} · ${escapeHtml(rule.id)}</option>`).join('');relative.value=relativeValue||'';
      $('allowBodyTypes').innerHTML=rows.length?rows.map(rule=>`<label class="enum-option"><input type="checkbox" value="${escapeHtml(rule.id)}" ${allowed.has(rule.id)?'checked':''}/><span title="${escapeHtml(rule.id)}">${escapeHtml(rule.label)} · ${escapeHtml(rule.id)}</span></label>`).join(''):'<span class="enum-empty">当前房间还没有其他家具类型</span>';
    }
    function candidateSideLabel(side){return ({front:'正面',back:'背面',left:'左侧',right:'右侧'})[side]||side}
    function syncCandidateRuleFromForm(){
      if(!candidateRulesDraft.length)return;const current=candidateRulesDraft[selectedCandidateRuleIndex];if(!current)return;
      current.mode=$('candidateMode').value;current.rotations=splitList($('rotations').value).map(Number).filter(Number.isFinite);current.relativeTo=$('relativeTo').value;current.relation=$('relation').value.trim();current.side=$('relationSide').value;current.crossAlign=$('crossAlign').value;current.distance={min:Math.max(0,number('relationGapMin',0)),max:Math.max(0,number('relationGapMax',0)),step:Math.max(.05,number('relationGapStep',.2))};if(current.distance.max<current.distance.min)current.distance.max=current.distance.min;current.facing=[...$('facingModes').querySelectorAll('input:checked')].map(input=>input.value);if(!current.facing.length)current.facing=['parallel'];current.maxSamples=Math.min(48,Math.max(1,Math.round(number('candidateRuleLimit',12))));current.weight=Math.min(3,Math.max(0,number('candidateRuleWeight',1)));current.collisionClearance=Math.min(1,Math.max(0,number('candidateCollisionClearance',.025)));current.allowFunctionalOverlap=$('candidateAllowFunctionalOverlap').checked;writeLShapePolicy(current,{enabled:$('lShapeEnabled').value!=='deny',lateralSide:$('lShapeLateralSide').value,frontAlign:$('lShapeFrontAlign').value});renderCandidateEstimate();
    }
    function loadCandidateRuleForm(index=0){
      selectedCandidateRuleIndex=Math.min(Math.max(0,index),candidateRulesDraft.length-1);const entry=candidateRulesDraft[selectedCandidateRuleIndex];if(!entry)return;$('candidateMode').value=entry.mode;$('rotations').value=(entry.rotations||[0,90]).join(', ');populateFurnitureEnums($('ruleProgram').value,$('ruleId').value,entry.relativeTo||'',valueFromServiceAllowed());$('relation').value=entry.relation||'';$('relationSide').value=entry.side||'front';$('crossAlign').value=entry.crossAlign||'center';$('relationGapMin').value=entry.distance?.min??0;$('relationGapMax').value=entry.distance?.max??entry.distance?.min??0;$('relationGapStep').value=entry.distance?.step??.2;$('candidateRuleLimit').value=entry.maxSamples||12;$('candidateRuleWeight').value=entry.weight??1;$('candidateCollisionClearance').value=entry.collisionClearance??.025;$('candidateAllowFunctionalOverlap').checked=!!entry.allowFunctionalOverlap;const policy=lShapePolicy(entry);$('lShapeEnabled').value=policy.enabled?'allow':'deny';$('lShapeLateralSide').value=policy.lateralSide;$('lShapeFrontAlign').value=policy.frontAlign==='body-center'?'body-center':policy.frontAlign;const facing=new Set(entry.facing||['parallel']);$('facingModes').querySelectorAll('input').forEach(input=>input.checked=facing.has(input.value));renderCandidateTabs();renderCandidateEstimate();
    }
    function valueFromServiceAllowed(){return [...$('allowBodyTypes').querySelectorAll('input:checked')].map(input=>input.value)}
    function renderCandidateTabs(){
      $('candidateRuleTabs').innerHTML=candidateRulesDraft.map((entry,index)=>`<button class="candidate-tab ${index===selectedCandidateRuleIndex?'active':''}" type="button" data-candidate-index="${index}">${index+1}. ${entry.mode==='relation'?candidateSideLabel(entry.side):({wall:'沿墙',zone:'功能区',corner:'角落'})[entry.mode]}${entry.relativeTo?` · ${escapeHtml(entry.relativeTo)}`:''}${entry.enabled===false?' <em>停用</em>':''}</button>`).join('');$('deleteCandidateRuleBtn').disabled=candidateRulesDraft.length<=1;$('candidateRuleTabs').querySelectorAll('[data-candidate-index]').forEach(button=>button.addEventListener('click',()=>{syncCandidateRuleFromForm();loadCandidateRuleForm(Number(button.dataset.candidateIndex))}));
    }
    function renderCandidateEstimate(){
      const entry=candidateRulesDraft[selectedCandidateRuleIndex];if(!entry)return;const totalLimit=Math.max(1,Number($('candidateTotalLimit').value)||32);$('candidateEstimate').textContent=`本条规则最多保留 ${Math.max(1,Number(entry.maxSamples)||12)} 个候选；家具总上限 ${totalLimit} 个。右侧实时预览会按距离、方向、旋转、沿墙槽位、跨规则去重和总上限统一估算，之后才进入碰撞、门窗与 Beam 筛选。`;
    }
    function addCandidateRule(){
      syncCandidateRuleFromForm();const source=candidateRulesDraft[selectedCandidateRuleIndex]||normalizeCandidateEntry({},0),sides=['front','back','left','right'],nextSide=sides[(sides.indexOf(source.side)+1)%sides.length],next=normalizeCandidateEntry({...clone(source),id:`candidate-${Date.now().toString(36)}`,side:nextSide},candidateRulesDraft.length);candidateRulesDraft.push(next);loadCandidateRuleForm(candidateRulesDraft.length-1);scheduleAutoSave();
    }
    function deleteCandidateRule(){
      if(candidateRulesDraft.length<=1)return;candidateRulesDraft.splice(selectedCandidateRuleIndex,1);loadCandidateRuleForm(Math.min(selectedCandidateRuleIndex,candidateRulesDraft.length-1));scheduleAutoSave();
    }
    function geometryFromForm(){
      const previous=clone(original?.geometry||{}),width=number('width',1),depth=number('depth',.4),shape=$('shape').value;
      const variants=geometryVariantsDraft.map((row,index)=>({id:String(row.id||`variant-${index+1}`),label:String(row.label||`尺寸 ${index+1}`),width:Math.max(.1,Number(row.width)||width),depth:Math.max(.1,Number(row.depth)||depth),shape:['box','l-left','l-right'].includes(row.shape)?row.shape:'box'}));
      return {...previous,width,depth,shape,variants,searchVariants:$('searchVariants').checked};
    }
    function renderGeometryVariants(){
      const list=$('geometryVariantList');
      list.innerHTML=geometryVariantsDraft.map((row,index)=>`<div class="variant-row" data-variant-index="${index}"><input data-variant-key="label" value="${escapeHtml(row.label||'')}" aria-label="尺寸名称"><input data-variant-key="width" type="number" min="0.1" max="8" step="0.01" value="${Number(row.width)||1}" aria-label="宽度"><input data-variant-key="depth" type="number" min="0.1" max="5" step="0.01" value="${Number(row.depth)||.4}" aria-label="深度"><select data-variant-key="shape" aria-label="形状"><option value="box" ${row.shape==='box'?'selected':''}>普通矩形</option><option value="l-left" ${row.shape==='l-left'?'selected':''}>左贵妃 L</option><option value="l-right" ${row.shape==='l-right'?'selected':''}>右贵妃 L</option></select><button class="btn danger" type="button" data-delete-variant>删除</button></div>`).join('')||'<div class="variant-empty">当前只使用上方基础尺寸；点击“添加尺寸”建立多尺寸清单。</div>';
      list.querySelectorAll('[data-variant-index]').forEach(row=>{const index=Number(row.dataset.variantIndex);row.querySelectorAll('[data-variant-key]').forEach(input=>input.addEventListener('input',()=>{const key=input.dataset.variantKey;geometryVariantsDraft[index][key]=['width','depth'].includes(key)?Number(input.value):input.value;scheduleAutoSave()}));row.querySelector('[data-delete-variant]').addEventListener('click',()=>{geometryVariantsDraft.splice(index,1);renderGeometryVariants();scheduleAutoSave()})});
    }
    function addGeometryVariant(){
      const index=geometryVariantsDraft.length,baseLabel=$('ruleLabel').value.trim()||'家具';geometryVariantsDraft.push({id:`${$('ruleId').value.trim()||'variant'}-${Date.now().toString(36)}`,label:`${baseLabel} ${index+1}号`,width:number('width',1),depth:number('depth',.4),shape:$('shape').value});renderGeometryVariants();scheduleAutoSave();
    }
    function serviceFromForm(){
      const previous=clone(original?.service||{}),service={...previous,label:$('serviceLabel').value.trim(),side:$('serviceSide').value,depth:number('serviceDepth',.42),spanExtra:number('spanExtra',0),alignStart:$('serviceAlignStart').checked,adaptiveFootZone:$('adaptiveFootZone').checked,hard:$('serviceHard').checked,sharedCirculation:$('serviceSharedCirculation').checked,allowBodyTypes:[...$('allowBodyTypes').querySelectorAll('input:checked')].map(input=>input.value)};
      if(service.adaptiveFootZone||Object.prototype.hasOwnProperty.call(previous,'adaptiveGapThreshold'))service.adaptiveGapThreshold=Number(previous.adaptiveGapThreshold)||.42;else delete service.adaptiveGapThreshold;
      if(!service.adaptiveFootZone&&!Object.prototype.hasOwnProperty.call(previous,'adaptiveFootZone'))delete service.adaptiveFootZone;
      return service;
    }
    function valueFromForm(){
      syncCandidateRuleFromForm();const run=$('runEnabled').checked?{min:number('runMin',.8),max:number('runMax',2.4),step:number('runStep',.1),fill:[number('fillMin',.6),number('fillMax',.92)],maxByWalls:$('runMaxByWalls').checked,maxPerWall:Math.max(1,Math.round(number('runMaxPerWall',1))),wallCountCap:Math.max(1,Math.round(number('runWallCountCap',4))),areaPerCabinet:Math.max(2,number('runAreaPerCabinet',10))}:null;
      return {...clone(original||{}),program:$('ruleProgram').value,id:$('ruleId').value.trim(),label:$('ruleLabel').value.trim(),category:$('ruleCategory').value.trim(),role:$('ruleRole').value.trim(),color:$('ruleColor').value,
        geometry:geometryFromForm(),quantity:{min:Math.round(number('minCount',0)),max:Math.round(number('maxCount',1))},preferences:{defaultCount:Math.round(number('defaultCount',0)),weight:number('preferenceWeight',1),priority:Math.round(number('placementPriority',100))},accessTarget:$('accessTarget').checked,
        candidate:{rules:clone(candidateRulesDraft),maxCandidates:Math.min(72,Math.max(4,Math.round(number('candidateTotalLimit',32))))},
        placement:{requiredAnchor:$('requiredAnchor').value,avoidWindow:$('avoidWindow').checked,allowCorner:$('allowCorner').checked},
        service:serviceFromForm(),run};
    }
    function setForm(rule){
      original=clone(rule);$('ruleId').value=rule.id;$('ruleLabel').value=rule.label;$('ruleProgram').value=rule.program;$('ruleCategory').value=rule.category;$('ruleRole').value=rule.role;$('ruleColor').value=rule.color||'#376f9e';
      const firstCandidate=rule.candidate?.rules?.[0]||rule.candidate||{};populateFurnitureEnums(rule.program,rule.id,firstCandidate.relativeTo||'',rule.service?.allowBodyTypes||[]);candidateRulesDraft=candidateRulesFromCandidate(rule.candidate);selectedCandidateRuleIndex=0;
      $('editingRuleTitle').textContent=`当前编辑：${rule.label}（${rule.id}）`;$('width').value=rule.geometry.width;$('depth').value=rule.geometry.depth;$('shape').value=rule.geometry.shape||'box';geometryVariantsDraft=clone(rule.geometry.variants||[]);$('searchVariants').checked=rule.geometry.searchVariants===true;renderGeometryVariants();$('minCount').value=rule.quantity.min;$('maxCount').value=rule.quantity.max;$('defaultCount').value=rule.preferences?.defaultCount??rule.quantity.min;$('preferenceWeight').value=rule.preferences?.weight??1;$('placementPriority').value=rule.preferences?.priority??100;$('accessTarget').checked=!!rule.accessTarget;
      $('requiredAnchor').value=rule.placement.requiredAnchor||'none';$('avoidWindow').checked=!!rule.placement.avoidWindow;$('allowCorner').checked=!!rule.placement.allowCorner;$('candidateTotalLimit').value=rule.candidate?.maxCandidates||32;
      $('serviceLabel').value=rule.service.label;$('serviceSide').value=rule.service.side;$('serviceDepth').value=rule.service.depth;$('spanExtra').value=rule.service.spanExtra||0;$('serviceAlignStart').checked=!!rule.service.alignStart;$('adaptiveFootZone').checked=!!rule.service.adaptiveFootZone;$('serviceSharedCirculation').checked=!!rule.service.sharedCirculation;const forcedSoft=rule.program==='bedroom'&&['desk','vanity','bench'].includes(rule.id);$('serviceHard').checked=forcedSoft?false:!!rule.service.hard;$('serviceHard').disabled=forcedSoft;$('serviceHard').closest('label').title=forcedSoft?'该家具的活动带固定为可重叠软使用区':'';
      $('runEnabled').checked=!!rule.run;$('runMin').value=rule.run?.min??.8;$('runMax').value=rule.run?.max??2.4;$('runStep').value=rule.run?.step??.1;$('fillMin').value=rule.run?.fill?.[0]??.6;$('fillMax').value=rule.run?.fill?.[1]??.92;$('runMaxByWalls').checked=!!rule.run?.maxByWalls;$('runMaxPerWall').value=rule.run?.maxPerWall??1;$('runWallCountCap').value=rule.run?.wallCountCap??(rule.program==='living'?5:4);$('runAreaPerCabinet').value=rule.run?.areaPerCabinet??(rule.program==='living'?12:8);previewVariantId=(rule.geometry.variants||[])[0]?.id||'base';previewMode=hasSemanticRelations(rule)?'group':'item';loadCandidateRuleForm(0);toggleRun();renderLive();
    }
    function validate(rule){
      const errors=[];
      if(!/^[A-Za-z][A-Za-z0-9_-]*$/.test(rule.id))errors.push('类型 ID 必须以字母开头，只包含字母、数字、_、-');
      if(!rule.label)errors.push('缺少显示名称');if(rule.geometry.width<=0||rule.geometry.depth<=0)errors.push('实体宽深必须大于 0');
      if(rule.quantity.max<rule.quantity.min)errors.push('最多数量不能小于最少数量');if(rule.preferences.defaultCount<rule.quantity.min||rule.preferences.defaultCount>rule.quantity.max)errors.push('默认数量必须在最少和最多数量之间');if(rule.preferences.weight<0||rule.preferences.weight>3)errors.push('选用偏好必须在 0–3 之间');if(rule.preferences.priority<1)errors.push('摆放优先级必须大于 0');if(rule.service.depth<0)errors.push('使用区深度不能为负数');
      for(const [index,entry] of (rule.candidate.rules||[rule.candidate]).entries()){if(entry.mode==='relation'&&!entry.relativeTo)errors.push(`候选规则 ${index+1}：关系型候选需要选择相对家具`);if(entry.distance&&entry.distance.max<entry.distance.min)errors.push(`候选规则 ${index+1}：最大距离不能小于最小距离`);if(entry.distance&&entry.distance.step<=0)errors.push(`候选规则 ${index+1}：距离步长必须大于 0`);if(!entry.facing?.length)errors.push(`候选规则 ${index+1}：至少选择一种朝向`)}
      if(rule.run&&(rule.run.max<rule.run.min||rule.run.step<=0||rule.run.fill[1]<rule.run.fill[0]))errors.push('连续柜体的范围或填充比例无效');
      return errors;
    }
    function renderList(){
      const query=$('searchInput').value.trim().toLowerCase();
      const rows=catalog.filter(rule=>(!query||`${rule.id} ${rule.label} ${rule.category}`.toLowerCase().includes(query)));
      $('catalogCount').textContent=`${rows.length} / ${catalog.length}`;
      const sorted=rows.sort((a,b)=>a.category.localeCompare(b.category,'zh-CN')||a.label.localeCompare(b.label,'zh-CN'));
      $('ruleList').innerHTML=sorted.map(rule=>{const defaultState=pendingDefaultKeys.has(ruleKey(rule))?'默认待锁定':'默认已记录',usedIn=currentRoomTypes().filter(type=>currentProfile().roomAssignments?.[type.id]?.includes(rule.id)).map(type=>type.label);return `<div class="rule-row"><button class="rule-item ${rule.id===selectedId?'active':''}" type="button" data-rule-id="${rule.id}" aria-label="编辑 ${rule.label}"><span class="dot" style="background:${rule.color}"></span><span><strong>${rule.label}</strong><small>${defaultState} · ${rule.category} · ${usedIn.length?`用于 ${usedIn.join('、')}`:'尚未加入房间'}</small></span><code>${rule.id}</code></button></div>`}).join('')||'<p class="schema-note">没有匹配规则。</p>';
      $('ruleList').querySelectorAll('[data-rule-id]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.ruleId===selectedId)return;clearTimeout(autoSaveTimer);if(!save({automatic:true,silent:true}))return;finalizeRuleDefault(active());selectedId=button.dataset.ruleId;setForm(active());renderList()}));
    }
    function renumberProgram(program,ordered){ordered.forEach((rule,index)=>{rule.preferences={...(rule.preferences||{}),priority:(index+1)*10}})}
    function moveRule(id,direction){const rule=catalog.find(row=>row.id===id);if(!rule)return;const ordered=catalog.filter(row=>row.program===rule.program).sort((a,b)=>(a.preferences?.priority||100)-(b.preferences?.priority||100)),index=ordered.indexOf(rule),target=index+direction;if(target<0||target>=ordered.length)return;[ordered[index],ordered[target]]=[ordered[target],ordered[index]];renumberProgram(rule.program,ordered);persist();selectedId=id;setForm(rule);renderList();status.className='status ok';status.textContent=`已更新${rule.program==='bedroom'?'卧室':rule.program==='living'?'客厅':'通用家具'}摆放顺序，并保存到当前档案。`}
    function moveRuleBefore(sourceId,targetId){if(sourceId===targetId)return;const source=catalog.find(row=>row.id===sourceId),target=catalog.find(row=>row.id===targetId);if(!source||!target||source.program!==target.program)return;const ordered=catalog.filter(row=>row.program===source.program).sort((a,b)=>(a.preferences?.priority||100)-(b.preferences?.priority||100));ordered.splice(ordered.indexOf(source),1);ordered.splice(ordered.indexOf(target),0,source);renumberProgram(source.program,ordered);persist();selectedId=source.id;setForm(source);renderList();status.className='status ok';status.textContent='已通过拖拽更新摆放顺序，并保存到当前档案。'}
    function toggleRun(){$('runFields').style.opacity=$('runEnabled').checked?'1':'.38';$('runFields').querySelectorAll('input').forEach(input=>input.disabled=!$('runEnabled').checked)}
    const SAMPLE_RULE_COLORS=['#d49a31','#2aa487','#5a73d8','#d46a61','#8b65bd','#4c8db7'];
    function candidateDistanceValues(entry){
      const min=Math.max(0,Number(entry.distance?.min)||0),max=Math.max(min,Number(entry.distance?.max)||min),step=Math.max(.05,Number(entry.distance?.step)||.2),values=[];
      for(let value=min;value<=max+1e-7&&values.length<80;value+=step)values.push(Number(value.toFixed(4)));
      return values.length?values:[min];
    }
    function candidatePreviewStats(rule,geometry){
      const roomW=3.6,roomD=3.8,w=Math.max(.1,Number(geometry.width)||1),d=Math.max(.1,Number(geometry.depth)||.4),entries=(rule.candidate.rules||[rule.candidate]).filter(entry=>entry&&entry.enabled!==false),rows=[];
      let rawCount=0,limitedCount=0;
      entries.forEach((entry,ruleIndex)=>{
        const rotations=(entry.rotations||[0,90]).length?entry.rotations:[0],facings=(entry.facing||['parallel']).length?entry.facing:['parallel'],combos=[];
        if(entry.mode==='relation'){
          candidateDistanceValues(entry).forEach((distance,distanceIndex)=>facings.forEach((facing,facingIndex)=>rotations.forEach(rotation=>combos.push({mode:'relation',ruleIndex,side:entry.side||'front',distance,distanceIndex,facing,facingIndex,rotation,key:`relation|${entry.relativeTo||''}|${entry.side||'front'}|${entry.crossAlign||'center'}|${distance.toFixed(4)}|${facing}|${rotation}`}))));
        }else{
          let slots=4;
          if(entry.mode==='wall')slots=Math.max(8,Math.ceil((roomW*2+roomD*2)/Math.max(.24,Math.min(w,d)*.45)));
          if(entry.mode==='zone')slots=Math.max(4,Math.floor(Math.max(.2,roomW-w)/.45)+1)*Math.max(3,Math.floor(Math.max(.2,roomD-d)/.45)+1);
          for(let slot=0;slot<slots;slot++)rotations.forEach(rotation=>combos.push({mode:entry.mode||'wall',ruleIndex,slot,slots,rotation,key:`${entry.mode||'wall'}|${slot}|${rotation}`}));
        }
        rawCount+=combos.length;const limited=combos.slice(0,Math.max(1,Number(entry.maxSamples)||12));limitedCount+=limited.length;rows.push({entry,ruleIndex,raw:combos.length,limited});
      });
      const uniqueMap=new Map();rows.forEach(row=>row.limited.forEach(sample=>{if(!uniqueMap.has(sample.key))uniqueMap.set(sample.key,sample)}));
      const unique=[...uniqueMap.values()],totalLimit=Math.max(1,Number(rule.candidate.maxCandidates)||32),accepted=unique.slice(0,totalLimit);
      return {roomW,roomD,rows,rawCount,limitedCount,uniqueCount:unique.length,totalLimit,accepted};
    }
    function candidateSampleMarkup(stats,W,H){
      const left=22,right=W-22,top=18,bottom=H-38,width=right-left,height=bottom-top,zoneCols=6;
      const point=(sample,index)=>{
        let x=W/2,y=(H-20)/2;
        if(sample.mode==='corner'){
          const corners=[[left,top],[right,top],[right,bottom],[left,bottom]];[x,y]=corners[sample.slot%4];
        }else if(sample.mode==='wall'){
          const perimeter=2*(width+height),distance=(sample.slot/Math.max(1,sample.slots))*perimeter;
          if(distance<=width){x=left+distance;y=top}else if(distance<=width+height){x=right;y=top+distance-width}else if(distance<=2*width+height){x=right-(distance-width-height);y=bottom}else{x=left;y=bottom-(distance-2*width-height)}
        }else if(sample.mode==='zone'){
          x=left+24+(sample.slot%zoneCols)*(width-48)/(zoneCols-1);y=top+23+(Math.floor(sample.slot/zoneCols)%5)*(height-46)/4;
        }else{
          const spread=((index%7)-3)*7,offset=45+Math.min(42,(Number(sample.distance)||0)*34)+Math.floor(index/7)*4;
          if(sample.side==='back'){x=W/2+spread;y=(H-20)/2-offset}else if(sample.side==='left'){x=W/2-offset;y=(H-20)/2+spread}else if(sample.side==='right'){x=W/2+offset;y=(H-20)/2+spread}else{x=W/2+spread;y=(H-20)/2+offset}
        }
        const color=SAMPLE_RULE_COLORS[sample.ruleIndex%SAMPLE_RULE_COLORS.length],selected=sample.ruleIndex===selectedCandidateRuleIndex;
        return `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${selected?5:3.7}" fill="${color}" fill-opacity="${selected ? 0.95 : 0.72}" stroke="white" stroke-width="1.4"/><text x="${x.toFixed(1)}" y="${(y+2.5).toFixed(1)}" text-anchor="middle" fill="white" font-family="system-ui" font-size="6" font-weight="800">${sample.ruleIndex+1}</text></g>`;
      };
      return stats.accepted.map(point).join('');
    }
    function previewRoomMarkup(stats,W,H){
      const left=22,right=W-22,top=18,bottom=H-38,midX=(left+right)/2,midY=(top+bottom)/2,doorW=38,windowW=72;
      return `<g aria-label="3.6 × 3.8 米测试房间">
        <rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}" rx="3" fill="#fffef9" fill-opacity=".72" stroke="#26352f" stroke-width="5"/>
        <rect x="${midX-55}" y="${midY-34}" width="110" height="68" rx="12" fill="#126c5c" fill-opacity=".035" stroke="#126c5c" stroke-opacity=".18" stroke-width="1" stroke-dasharray="4 5"/>
        <text x="${midX}" y="${midY-40}" text-anchor="middle" fill="#7b8580" font-family="system-ui" font-size="8" font-weight="700">房间中心区</text>
        <line x1="${midX-windowW/2}" y1="${top}" x2="${midX+windowW/2}" y2="${top}" stroke="#43a8bd" stroke-width="7"/>
        <text x="${midX}" y="${top+13}" text-anchor="middle" fill="#31889a" font-family="system-ui" font-size="7" font-weight="700">窗</text>
        <line x1="${midX-doorW/2}" y1="${bottom}" x2="${midX+doorW/2}" y2="${bottom}" stroke="#ff5b38" stroke-width="7"/>
        <path d="M ${midX-doorW/2} ${bottom} A ${doorW} ${doorW} 0 0 1 ${midX+doorW/2} ${bottom-doorW}" fill="none" stroke="#ff5b38" stroke-opacity=".42" stroke-width="1.5"/>
        <text x="${left+7}" y="${top+13}" fill="#52615b" font-family="system-ui" font-size="7" font-weight="750">墙角</text>
        <text x="${right-7}" y="${bottom-8}" text-anchor="end" fill="#52615b" font-family="system-ui" font-size="7" font-weight="750">墙边</text>
        <text x="${left+8}" y="${H-24}" fill="#69736f" font-family="system-ui" font-size="8" font-weight="700">测试房间 ${stats.roomW.toFixed(1)} × ${stats.roomD.toFixed(1)} m</text>
      </g>`;
    }
    function renderCandidatePreviewSummary(stats){
      const cut=stats.uniqueCount>stats.totalLimit;
      $('samplePreviewSummary').innerHTML=`<div class="sample-metric"><span>理论组合</span><strong>${stats.rawCount}</strong></div><div class="sample-metric"><span>规则上限后</span><strong>${stats.limitedCount}</strong></div><div class="sample-metric"><span>跨规则去重</span><strong>${stats.uniqueCount}</strong></div><div class="sample-metric ${cut?'warn':''}"><span>预计进入搜索</span><strong>${stats.accepted.length}${cut?' / 截断':''}</strong></div>`;
      $('sampleRuleLegend').innerHTML=`<span class="sample-rule-chip">按 3.6 × 3.8 m 预览房间估算</span>`+stats.rows.map(row=>`<span class="sample-rule-chip"><i style="background:${SAMPLE_RULE_COLORS[row.ruleIndex%SAMPLE_RULE_COLORS.length]}"></i>规则 ${row.ruleIndex+1}：${row.raw} → ${row.limited.length}</span>`).join('');
    }
    function semanticEntries(rule){return candidateRulesFromCandidate(rule?.candidate||{}).filter(entry=>entry.enabled!==false&&entry.mode==='relation'&&entry.relativeTo)}
    function hasSemanticRelations(rule){return semanticEntries(rule).length>0||catalog.some(item=>item.program===rule.program&&semanticEntries(item).some(entry=>entry.relativeTo===rule.id))}
    function semanticGroupPreview(rule,geometry,W,H,zoom){
      const incoming=[];for(const item of catalog)if(item.program===rule.program&&item.id!==rule.id)for(const entry of semanticEntries(item))if(entry.relativeTo===rule.id)incoming.push({item,entry});
      const outgoing=semanticEntries(rule).map(entry=>({item:rule,entry,parent:catalog.find(item=>item.program===rule.program&&item.id===entry.relativeTo)})).filter(row=>row.parent);
      let centerRule=rule,centerGeometry=geometry,relations=[];
      if(incoming.length)relations=incoming.slice(0,9).map(row=>({child:row.item,entry:row.entry}));
      else if(outgoing.length){centerRule=outgoing[0].parent;centerGeometry=centerRule.geometry;relations=outgoing.slice(0,9).map(row=>({child:rule,entry:row.entry}));}
      else return null;
      const dimsOf=(item,override=null)=>{const source=override||item.geometry||{},variant=source.width?source:(source.variants||[])[0]||{};return {w:Math.max(.18,Number(variant.width??variant.w)||1),d:Math.max(.18,Number(variant.depth??variant.d)||.5),shape:variant.shape||source.shape||'box'}};
      const centerDims=dimsOf(centerRule,centerGeometry),isLShape=centerDims.shape==='l-left'||centerDims.shape==='l-right',chaiseSide=centerDims.shape==='l-left'?'left':centerDims.shape==='l-right'?'right':null;
      if(isLShape)relations=relations.filter(({entry})=>{const policy=lShapePolicy(entry),side=entry.side||'front';if(!policy.enabled)return false;if(side==='left'||side==='right'){if(policy.lateralSide==='non-chaise'&&side===chaiseSide)return false;if(policy.lateralSide==='chaise-only'&&side!==chaiseSide)return false}return true});
      const sequence=[0,-1,1,-2,2,-3,3],nodes=[{item:centerRule,dims:centerDims,x:0,y:0,primary:true}],links=[],sideCounts=new Map();
      const addRelation=(parent,child,entry)=>{
        const side=entry.side||'front',childDims=dimsOf(child),distance=(Number(entry.distance?.min)||0)+(Math.max(Number(entry.distance?.max)||0,Number(entry.distance?.min)||0)-(Number(entry.distance?.min)||0))/2,isSide=side==='left'||side==='right',sign=side==='left'||side==='back'?-1:1,targetExtent=(isSide?parent.dims.w:parent.dims.d)/2,childExtent=(isSide?childDims.w:childDims.d)/2,key=`${nodes.indexOf(parent)}:${side}`,index=sideCounts.get(key)||0;
        let cross=sequence[index%sequence.length]*(isSide?childDims.d+.16:childDims.w+.16);sideCounts.set(key,index+1);
        if(parent.primary&&isLShape&&!isSide&&lShapePolicy(entry).frontAlign==='main-seat')cross+=(chaiseSide==='left'?1:-1)*Math.min(.48,centerDims.w*.17);
        const offset=targetExtent+childExtent+distance,x=parent.x+(isSide?sign*offset:cross),y=parent.y+(isSide?cross:sign*offset),node={item:child,dims:childDims,x,y,primary:false};nodes.push(node);links.push({parent,node,entry});return node;
      };
      const centerNode=nodes[0];for(const {child,entry} of relations)addRelation(centerNode,child,entry);
      // 语义组不应只画一跳二元关系。把“沙发 → 边几 → 边几前方单椅”继续展开一层，
      // 配置人员才能直观看到三件家具最终形成转角，而不是误以为单椅排在边几外侧。
      for(const parent of nodes.slice(1)){
        const dependents=[];for(const child of catalog)if(child.program===rule.program&&child.id!==parent.item.id)for(const entry of semanticEntries(child))if(entry.relativeTo===parent.item.id)dependents.push({child,entry});
        for(const dependent of dependents.slice(0,3))if(nodes.length<13)addRelation(parent,dependent.child,dependent.entry);
      }
      const bounds=nodes.reduce((box,node)=>({x1:Math.min(box.x1,node.x-node.dims.w/2),y1:Math.min(box.y1,node.y-node.dims.d/2),x2:Math.max(box.x2,node.x+node.dims.w/2),y2:Math.max(box.y2,node.y+node.dims.d/2)}),{x1:Infinity,y1:Infinity,x2:-Infinity,y2:-Infinity}),scale=Math.min(66,(W-54)/Math.max(.5,bounds.x2-bounds.x1),(H-76)/Math.max(.5,bounds.y2-bounds.y1))*zoom,cx=W/2-(bounds.x1+bounds.x2)/2*scale,cy=(H-28)/2-(bounds.y1+bounds.y2)/2*scale,X=value=>cx+value*scale,Y=value=>cy+value*scale;
      const body=node=>{const x=X(node.x-node.dims.w/2),y=Y(node.y-node.dims.d/2),w=node.dims.w*scale,d=node.dims.d*scale,stroke=node.primary?'#18231f':'rgba(24,35,31,.55)',sw=node.primary?2.4:1.4,color=node.item.color||'#668b7c',shape=node.dims.shape||'box';let parts=`<rect x="${x}" y="${y}" width="${w}" height="${shape.startsWith('l-')?d*.54:d}" rx="6" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>`;if(shape.startsWith('l-')){const cw=w*.34,cx2=shape==='l-left'?x:x+w-cw;parts+=`<rect x="${cx2}" y="${y}" width="${cw}" height="${d}" rx="6" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>`;}return `${parts}<text x="${X(node.x)}" y="${Y(node.y)+3}" text-anchor="middle" fill="white" font-family="system-ui" font-size="${node.primary?10:8}" font-weight="800">${escapeHtml(node.item.label||node.item.id)}</text>`};
      const linkMarkup=links.map(({parent,node,entry},index)=>{const mx=(X(parent.x)+X(node.x))/2,my=(Y(parent.y)+Y(node.y))/2-3,label=entry.relation||`${entry.side||'front'} · ${entry.distance?.min??0}–${entry.distance?.max??0}m`;return `<line x1="${X(parent.x)}" y1="${Y(parent.y)}" x2="${X(node.x)}" y2="${Y(node.y)}" stroke="${SAMPLE_RULE_COLORS[index%SAMPLE_RULE_COLORS.length]}" stroke-width="1.7" stroke-dasharray="5 4" marker-end="url(#semanticArrow)"/><text x="${mx}" y="${my}" text-anchor="middle" fill="#53615c" font-family="system-ui" font-size="6.5" font-weight="750" paint-order="stroke" stroke="#fffef9" stroke-width="3">${escapeHtml(label)}</text>`}).join('');
      return {markup:`<defs><marker id="semanticArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#69736f"/></marker></defs>${linkMarkup}${nodes.map(body).join('')}<text x="${W/2}" y="${H-9}" text-anchor="middle" fill="#69736f" font-family="system-ui" font-size="9" font-weight="750">语义组示意 · 虚线表示相对方位、朝向与距离约束</text>`,links};
    }
    function renderPreview(rule){
      const svg=$('previewSvg'),W=360,H=260,variants=(rule.geometry.variants||[]).length?rule.geometry.variants:[{id:'base',label:rule.geometry.shape?.startsWith('l-')?'L 形':'标准形',...rule.geometry}];if(!variants.some(item=>item.id===previewVariantId))previewVariantId=variants[0].id;const geometry=variants.find(item=>item.id===previewVariantId)||variants[0],w=geometry.width,d=geometry.depth,gap=.08,side=rule.service.side||'front',extra=Math.max(0,rule.service.spanExtra||0),serviceDepth=Math.max(0,rule.service.depth||0),horizontal=side==='front'||side==='back',serviceW=horizontal?w+extra*2:serviceDepth,serviceD=horizontal?serviceDepth:d+extra*2;
      const variantLabel=item=>/^(普通\s*)?(box|标准形)$/i.test(String(item.label||''))?(rule.label||'普通矩形'):item.label||item.shape||item.id;
      $('previewVariantTabs').innerHTML=variants.map(item=>`<button type="button" class="preview-variant ${item.id===previewVariantId?'active':''}" data-preview-variant="${escapeHtml(item.id)}">${escapeHtml(variantLabel(item))}</button>`).join('');$('previewVariantTabs').querySelectorAll('[data-preview-variant]').forEach(button=>button.addEventListener('click',()=>{previewVariantId=button.dataset.previewVariant;renderPreview(rule)}));$('previewModeTabs').querySelectorAll('[data-preview-mode]').forEach(button=>button.classList.toggle('active',button.dataset.previewMode===previewMode));const zoom=Number($('previewZoom').value)||1;$('previewZoomValue').textContent=`${Math.round(zoom*100)}%`;
      const sampleStats=candidatePreviewStats(rule,geometry),roomMarkup=previewRoomMarkup(sampleStats,W,H),groupPreview=previewMode==='group'?semanticGroupPreview(rule,geometry,W,H,zoom):null;
      if(groupPreview){svg.innerHTML=`${roomMarkup}${groupPreview.markup}`;$('samplePreviewSummary').innerHTML=`<div class="sample-metric"><span>相关家具</span><strong>${new Set(groupPreview.links.map(row=>row.node.item.id)).size}</strong></div><div class="sample-metric"><span>关系规则</span><strong>${groupPreview.links.length}</strong></div><div class="sample-metric"><span>当前形状</span><strong>${geometry.shape?.startsWith('l-')?'L':'Box'}</strong></div><div class="sample-metric"><span>使用区关系</span><strong>可重叠</strong></div>`;$('sampleRuleLegend').innerHTML=groupPreview.links.map((row,index)=>`<span class="sample-rule-chip"><i style="background:${SAMPLE_RULE_COLORS[index%SAMPLE_RULE_COLORS.length]}"></i>${escapeHtml(row.node.item.label)}：${escapeHtml(row.entry.side||'front')} · ${escapeHtml(row.entry.relation||'relation')}</span>`).join('');return;}
      let zone={x:-serviceW/2,y:d/2+gap,w:serviceW,d:serviceD};if(side==='back')zone.y=-d/2-gap-serviceD;if(side==='left')zone={x:-w/2-gap-serviceW,y:-serviceD/2,w:serviceW,d:serviceD};if(side==='right')zone={x:w/2+gap,y:-serviceD/2,w:serviceW,d:serviceD};if(rule.service.alignStart){if(horizontal)zone.x=-w/2;else zone.y=-d/2}
      const bounds={x1:Math.min(-w/2,zone.x),y1:Math.min(-d/2,zone.y),x2:Math.max(w/2,zone.x+zone.w),y2:Math.max(d/2,zone.y+zone.d)},centerX=(bounds.x1+bounds.x2)/2,centerY=(bounds.y1+bounds.y2)/2,scale=Math.min(128,(W-34)/(bounds.x2-bounds.x1||1),(H-58)/(bounds.y2-bounds.y1||1))*zoom,cx=W/2-centerX*scale,cy=(H-28)/2-centerY*scale,X=value=>cx+value*scale,Y=value=>cy+value*scale,rect=(x,y,rw,rd,attrs='')=>`<rect x="${X(x)}" y="${Y(y)}" width="${rw*scale}" height="${rd*scale}" ${attrs}/>`;
      const zoneColor=rule.service.hard?'#ff5b38':'#126c5c',allowedLabels=(rule.service.allowBodyTypes||[]).map(id=>catalog.find(row=>row.id===id)?.label||id),zoneLabel=rule.service.hard?(allowedLabels.length?`允许：${allowedLabels.join('、')}`:'家具实体不可进入'):rule.service.sharedCirculation?'共享通行区，参与孤岛检查':'软提示区，可与其他区域重叠',zoneMarkup=serviceDepth?rect(zone.x,zone.y,zone.w,zone.d,`rx="7" fill="${zoneColor}" fill-opacity=".08" stroke="${zoneColor}" stroke-width="2" stroke-dasharray="7 5"`):'',isL=geometry.shape?.startsWith('l-'),baseDepth=d*.54,chaiseWidth=w*.34,chaiseX=geometry.shape==='l-left'?-w/2:w/2-chaiseWidth,bodyMarkup=isL?rect(-w/2,-d/2,w,baseDepth,`rx="9" fill="${rule.color}" stroke="#18231f" stroke-opacity=".55" stroke-width="2"`)+rect(chaiseX,-d/2,chaiseWidth,d,`rx="9" fill="${rule.color}" stroke="#18231f" stroke-opacity=".55" stroke-width="2"`):rect(-w/2,-d/2,w,d,`rx="9" fill="${rule.color}" stroke="#18231f" stroke-opacity=".55" stroke-width="2"`),frontY=Y(d/2),arrowEnd=Math.min(frontY+26,Y(bounds.y2));
      const sampleMarkup=candidateSampleMarkup(sampleStats,W,H);renderCandidatePreviewSummary(sampleStats);
      svg.innerHTML=`${roomMarkup}${sampleMarkup}${zoneMarkup}${serviceDepth?`<text x="${X(zone.x+zone.w/2)}" y="${Y(zone.y+zone.d/2)-5}" text-anchor="middle" dominant-baseline="middle" fill="${zoneColor}" font-family="system-ui" font-size="9" font-weight="750">${escapeHtml(rule.service.label||'使用区')}</text><text x="${X(zone.x+zone.w/2)}" y="${Y(zone.y+zone.d/2)+8}" text-anchor="middle" dominant-baseline="middle" fill="${zoneColor}" font-family="system-ui" font-size="8">${serviceW.toFixed(2)} × ${serviceD.toFixed(2)} m · ${escapeHtml(zoneLabel)}</text>`:''}${bodyMarkup}<line x1="${X(0)}" y1="${Y(0)}" x2="${X(0)}" y2="${arrowEnd}" stroke="white" stroke-width="3"/><path d="M ${X(0)-5} ${arrowEnd-6} L ${X(0)} ${arrowEnd} L ${X(0)+5} ${arrowEnd-6}" fill="none" stroke="white" stroke-width="2"/><text x="${X(0)}" y="${Y(0)}" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="system-ui" font-size="13" font-weight="700">${escapeHtml(rule.label||rule.id)}</text><text x="${X(0)}" y="${frontY+12}" text-anchor="middle" fill="#69736f" font-family="system-ui" font-size="8" font-weight="700">家具正面</text><text x="${W/2}" y="${H-9}" text-anchor="middle" fill="#69736f" font-family="system-ui" font-size="10">实体 ${w.toFixed(2)} × ${d.toFixed(2)} m · 自动居中</text>`;
    }
    function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
    function renderLive(){const rule=valueFromForm(),errors=validate(rule);$('jsonPreview').textContent=JSON.stringify(compactRule(rule),null,2);renderPreview(rule);const first=rule.candidate.rules?.[0]||{},seatFacing=first.mode==='relation'&&/desk|table|vanity/i.test(first.relativeTo||'');$('orientationHint').textContent=seatFacing?`方向说明：${rule.label||rule.id}的正面朝向“${first.relativeTo}”；“${rule.service.label||'使用区'}”设为${rule.service.side==='back'?'背面时位于远离桌面的一侧，用于拉椅和起身。':'正面时位于家具与桌面之间。'}`:'方向说明：使用区方向以家具自身“正面”为基准，而不是以画布上下方向为基准。';status.className=`status ${errors.length?'error':'ok'}`;status.textContent=errors.length?errors.join('；'):'规则结构有效；停止输入约 0.5 秒后自动保存并应用。'}
    function scheduleAutoSave(){
      clearTimeout(autoSaveTimer);renderLive();$('autoSaveKicker').textContent='等待自动保存…';autoSaveTimer=setTimeout(()=>save({automatic:true}),500);
    }
    function save({automatic=false,silent=false}={}){
      const rule=valueFromForm(),errors=validate(rule);if(errors.length){renderLive();$('autoSaveKicker').textContent='存在错误，尚未保存';return false}
      const previous=active(),previousKey=previous?ruleKey(previous):'',nextKey=ruleKey(rule),collision=catalog.find(item=>item.id===rule.id&&item.id!==selectedId);if(collision){status.className='status error';status.textContent=`ID ${rule.id} 已存在`;$('autoSaveKicker').textContent='ID 冲突，尚未保存';return false}
      const index=catalog.findIndex(item=>item.id===selectedId);if(index>=0)catalog[index]=rule;else catalog.push(rule);
      if(previousKey&&previousKey!==nextKey){const profile=currentProfile();if(profile?.defaultsByRule?.[previousKey]){const baseline=profile.defaultsByRule[previousKey];delete profile.defaultsByRule[previousKey];profile.defaultsByRule[nextKey]={...clone(baseline),program:rule.program,id:rule.id}}if(pendingDefaultKeys.delete(previousKey))pendingDefaultKeys.add(nextKey)}
      selectedId=rule.id;persist();original=clone(rule);renderList();renderLive();const time=new Date().toLocaleTimeString('zh-CN',{hour12:false});$('autoSaveKicker').textContent=`已自动保存 ${time}`;if(!silent){status.className='status ok';status.textContent=automatic?'已自动保存并应用。空间棋页面会读取最新配置。':'已保存并应用。'}return true;
    }
    function createRule(copyCurrent=false){
      clearTimeout(autoSaveTimer);if(!save({automatic:true,silent:true}))return;finalizeRuleDefault(active());const base=copyCurrent?clone(valueFromForm()):row('library','newFurniture','新家具',1,.4,'自定义家具','待定义','#376f9e',{});let suffix=1,id=copyCurrent?`${base.id}Copy`:base.id;while(catalog.some(rule=>rule.id===id))id=`${copyCurrent?base.id+'Copy':'newFurniture'}${suffix++}`;base.id=id;base.label=copyCurrent?`${base.label} 副本`:base.label;base.program='library';catalog.push(base);selectedId=id;if(copyCurrent)currentProfile().defaultsByRule[ruleKey(base)]=clone(base);else pendingDefaultKeys.add(ruleKey(base));persist();renderList();setForm(base);status.className='status ok';status.textContent=copyCurrent?'已复制为新的家具物品；尚未加入任何房间。':'已在家具物品库中新建；完成定义后，再到“房间落子清单”加入需要的房间。';
    }
    function restoreCurrentRuleDefault(){
      clearTimeout(autoSaveTimer);const current=active();if(!current)return;if(pendingDefaultKeys.has(ruleKey(current))||!defaultForRule(current))finalizeRuleDefault(current);const baseline=defaultForRule(current);if(!baseline)return;if(!confirm(`将“${current.label}”恢复为第一次创建时的默认配置？`))return;const index=catalog.indexOf(current);catalog[index]=clone(baseline);selectedId=baseline.id;persist();setForm(catalog[index]);renderList();$('autoSaveKicker').textContent='已恢复默认并保存';status.className='status ok';status.textContent='已恢复当前家具的独立默认配置，并自动应用。';
    }
    function exportCatalog(){const current=currentProfile(),payload={...globalConfigPayload(current),exportedAt:new Date().toISOString()},blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`room-chess-${(current?.name||'furniture-rules').replace(/[\\/:*?"<>|]/g,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),0)}
    function importCatalog(file){const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result),rows=Array.isArray(parsed)?parsed:(parsed.furnitureLibrary||parsed.furnitureRules);if(!Array.isArray(rows)||!rows.length)throw new Error('没有 furnitureLibrary 或 furnitureRules 数组');const constraintErrors=validateConstraintDocument(parsed);if(constraintErrors.length)throw new Error(`全局约束无效：${constraintErrors.join('；')}`);const normalized=normalizeCatalog(rows),invalid=normalized.flatMap((rule,index)=>validate(rule).map(message=>`第 ${index+1} 条：${message}`));if(invalid.length)throw new Error(invalid.slice(0,4).join('；'));const imported=normalizeProfile({id:'global-profile',name:'全局配置',catalog:normalized,roomTypes:Array.isArray(parsed.roomTypes)?parsed.roomTypes:DEFAULT_ROOM_TYPES,roomAssignments:parsed.roomAssignments,roomSettings:parsed.roomSettings,updatedAt:new Date().toISOString()});globalDesignQualityRules=clone(parsed.designQualityRules);globalLayoutConstraints=clone(parsed.layoutConstraints);profiles=[imported];activeProfileId=imported.id;catalog=clone(imported.catalog);selectedId=catalog[0]?.id||null;activeRoomTypeId='bedroom';persist();renderList();setForm(active());renderGlobalConstraints();status.className='status ok';status.textContent='已导入完整配置（家具、房间清单、全局约束）并覆盖 FastAPI 当前版本。';}catch(error){status.className='status error';status.textContent=`导入失败：${error.message}`}};reader.readAsText(file)}

    form.addEventListener('submit',event=>{event.preventDefault();clearTimeout(autoSaveTimer);save({automatic:true})});
    fields.forEach(id=>$(id).addEventListener('input',()=>{if(id==='runEnabled')toggleRun();scheduleAutoSave()}));
    $('ruleProgram').addEventListener('change',()=>{const allowed=[...$('allowBodyTypes').querySelectorAll('input:checked')].map(input=>input.value);populateFurnitureEnums($('ruleProgram').value,$('ruleId').value,$('relativeTo').value,allowed);scheduleAutoSave()});
    $('addCandidateRuleBtn').addEventListener('click',addCandidateRule);$('deleteCandidateRuleBtn').addEventListener('click',deleteCandidateRule);
    $('addGeometryVariantBtn').addEventListener('click',addGeometryVariant);
    $('programFilter').addEventListener('change',event=>{if(currentRoomTypes().some(type=>type.id===event.target.value)){activeRoomTypeId=event.target.value;$('roomTypeSelect').value=activeRoomTypeId;renderRoomTypes()}renderList()});$('searchInput').addEventListener('input',renderList);$('resetBtn').addEventListener('click',restoreCurrentRuleDefault);$('newBtn').addEventListener('click',()=>createRule(false));$('newLibraryFurnitureBtn').addEventListener('click',()=>createRule(false));$('duplicateBtn').addEventListener('click',()=>createRule(true));$('exportBtn').addEventListener('click',exportCatalog);$('importFile').addEventListener('change',event=>{const file=event.target.files[0];if(file)importCatalog(file);event.target.value=''});
    $('roomTypeSelect').addEventListener('change',event=>selectRoomType(event.target.value));$('newRoomTypeBtn').addEventListener('click',createRoomType);$('renameRoomTypeBtn').addEventListener('click',renameRoomType);$('deleteRoomTypeBtn').addEventListener('click',deleteRoomType);$('previewZoom').addEventListener('input',()=>renderPreview(valueFromForm()));$('previewModeTabs').addEventListener('click',event=>{const button=event.target.closest('[data-preview-mode]');if(!button)return;previewMode=button.dataset.previewMode;renderPreview(valueFromForm())});
    $('libraryModeBtn').addEventListener('click',()=>setViewMode('library'));$('roomModeBtn').addEventListener('click',()=>setViewMode('room'));$('constraintsModeBtn').addEventListener('click',()=>setViewMode('constraints'));$('saveGlobalConstraintsBtn').addEventListener('click',saveGlobalConstraints);$('addRoomFurnitureBtn').addEventListener('click',addRoomFurniture);
    $('profileSelect').addEventListener('change',event=>activateProfile(event.target.value));$('newProfileBtn').addEventListener('click',()=>createProfile(false));$('copyProfileBtn').addEventListener('click',()=>createProfile(true));$('deleteProfileBtn').addEventListener('click',deleteProfile);
    $('restoreDefaultsBtn').addEventListener('click',async()=>{if(!confirm('用 FastAPI 保存的基础默认配置覆盖当前全局配置？'))return;try{const response=await fetch(`${GLOBAL_CONFIG_API}/restore`,{method:'POST'}),payload=await response.json();if(!response.ok)throw new Error(payload.detail||`HTTP ${response.status}`);applyGlobalConfigPayload(payload.config);pendingDefaultKeys.clear();activeRoomTypeId='bedroom';selectedId=catalog[0]?.id||null;persist({remote:false});renderList();setForm(active());status.className='status ok';status.textContent='已由服务端基础配置恢复全局当前配置。';}catch(error){status.className='status error';status.textContent=`恢复失败：${error.message}`;}});
    $('deleteBtn').addEventListener('click',()=>{const rule=active(),requiredBy=currentRoomTypes().filter(type=>Number(currentProfile().roomSettings?.[type.id]?.[rule.id]?.min)>0).map(type=>type.label);if(requiredBy.length){status.className='status error';status.textContent=`该家具由${requiredBy.join('、')}配置为最少 1 件以上；请先在房间落子清单把最少数量改为 0。`;return}if(catalog.length<=1){status.className='status error';status.textContent='家具物品库至少保留一条记录。';return}if(!confirm(`从家具物品库删除“${rule.label}”？它也会从所有房间落子清单移除。`))return;delete currentProfile().defaultsByRule[ruleKey(rule)];pendingDefaultKeys.delete(ruleKey(rule));for(const type of currentRoomTypes()){currentProfile().roomAssignments[type.id]=(currentProfile().roomAssignments[type.id]||[]).filter(id=>id!==rule.id);delete currentProfile().roomSettings[type.id]?.[rule.id]}catalog=catalog.filter(item=>item!==rule);selectedId=catalog[0].id;persist();renderList();setForm(active());status.className='status ok';status.textContent='已删除家具物品及所有房间对它的引用。'});
    window.addEventListener('beforeunload',()=>{clearTimeout(autoSaveTimer);if(save({automatic:true,silent:true}))finalizeRuleDefault(active())});
    await initializeGlobalConfig();persist({remote:false});renderProfiles();renderList();setForm(active());setViewMode('library');
  })();
