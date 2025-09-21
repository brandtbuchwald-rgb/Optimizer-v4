// ==========================
// Rediscover Optimizer v4 (full, with caps + debug)
// ==========================

let rules;
let els = {};

async function init() {
  rules = await loadGearRules();
  els.cls   = document.getElementById('cls');
  els.focus = document.getElementById('focus');
  els.tier  = document.getElementById('tier');
  els.weap  = document.getElementById('weap');
  els.rune  = document.getElementById('rune');
  els.pet   = document.getElementById('pet');
  els.guildCrit  = document.getElementById('guildCrit');
  els.secretCrit = document.getElementById('secretCrit');
  els.secretEva  = document.getElementById('secretEva');

  document.getElementById('optBtn').onclick = optimize;
}
window.onload = init;

async function loadGearRules() {
  const res = await fetch('assets/gearRules.json');
  return await res.json();
}

// ---- helpers ----
function purple(label) {
  return `<span style="color:purple;font-weight:bold">${label}</span>`;
}
function statWithValue(stat, t) {
  switch(stat) {
    case "ATK SPD": return `${stat} +${(t.AS*100).toFixed(0)}%`;
    case "Crit Chance": return `${stat} +${(t.CR*100).toFixed(0)}%`;
    case "Evasion": return `${stat} +${(t.EV*100).toFixed(0)}%`;
    case "DR%": return `${stat} +${(t.DR*100).toFixed(0)}%`;
    case "ATK%": return `${stat} +${(t.ATK*100).toFixed(0)}%`;
    case "Crit DMG": return `${stat} +${(t.CD*100).toFixed(0)}%`;
    case "Monster DMG": return `${stat} +${(t.MD*100).toFixed(0)}%`;
    case "HP%": return `${stat} +${(t.HP*100).toFixed(0)}%`;
    case "DEF%": return `${stat} +${(t.DF*100).toFixed(0)}%`;
    default: return stat;
  }
}

// ---- main optimize ----
function optimize() {
  const cls   = els.cls.value;
  const focus = els.focus.value;
  const tier  = els.tier.value;

  // baseline values
  const best = {
    tierVals: rules.tierVals[tier],
    rune: (+els.rune.value||0)/100,
    critPet: parseFloat(els.pet.value)||0,
    gearLines: 2 // adjust if needed
  };

  renderSlots(cls, focus, tier, best);
  renderTotals(focus, tier, best);
}

// ---- render slots ----
function renderSlots(cls, focus, tier, best) {
  const box = document.getElementById('slots');
  box.innerHTML = '';

  const t = best.tierVals;
  const layout = {};
  for (const s of rules.slots) layout[s] = [];

  const isChaosAbyss = (tier === "Chaos" || tier === "Abyss");
  const capPerSlot = slot => isChaosAbyss ? 5 : (tier==="Primal" ? 3 : 4);

  const CAP_STATS = new Set(["ATK SPD","Crit Chance","Evasion"]);
  const slotHasAnyCap = arr => arr.some(s => CAP_STATS.has(s));

  const canAdd = (slot, stat) => {
    if (layout[slot].length >= capPerSlot(slot)) return false;
    if (layout[slot].includes(stat)) return false;
    if (CAP_STATS.has(stat) && slotHasAnyCap(layout[slot])) return false;
    return true;
  };

  // Purples
  if (isChaosAbyss) {
    layout['Weapon'].push(
      focus==="DPS" ? purple(rules.purple5thLabels.WeaponDPS)
                    : purple(rules.purple5thLabels.WeaponTank)
    );
    layout['Necklace'].push(purple(rules.purple5thLabels.Necklace));
    layout['Ring'].push(purple(rules.purple5thLabels.Ring));
    layout['Helm'].push(purple(rules.purple5thLabels.Helm));
    layout['Belt'].push(purple(rules.purple5thLabels.Belt));
    layout['Chest'].push(purple(rules.purple5thLabels.Chest));
    layout['Gloves'].push(purple(rules.purple5thLabels.Gloves));
    layout['Boots'].push(purple(rules.purple5thLabels.Boots));
  }

  // Weapon pool
  const castLabel = (focus==="DPS")
    ? (isChaosAbyss ? rules.weaponPool.castDPS.chaosAbyss : rules.weaponPool.castDPS.normal)
    : (isChaosAbyss ? rules.weaponPool.castTank.chaosAbyss : rules.weaponPool.castTank.normal);
  if (canAdd('Weapon', castLabel)) layout['Weapon'].push(castLabel);

  const weaponFillPriority = (focus==="DPS")
    ? ["ATK%","Crit DMG","Monster DMG","HP%","DEF%","DR%"]
    : ["HP%","DEF%","DR%","ATK%","Crit DMG","Monster DMG"];
  for (const stat of weaponFillPriority) {
    if (canAdd('Weapon', stat)) layout['Weapon'].push(statWithValue(stat, t));
  }

  // Assign ATK SPD
  let asLeft = best.gearLines;
  best.asLines=0;
  for (const s of rules.slots) {
    if (s!=="Weapon" && asLeft>0) {
      if (canAdd(s,"ATK SPD")) {
        layout[s].push(statWithValue("ATK SPD",t));
        best.asLines++;
        asLeft--;
      }
    }
  }

  // Trackers
  best.critLines=0; best.evaLines=0; best.drLines=0;
  best.atkLines=0; best.cdLines=0; best.mdLines=0; best.hpLines=0; best.dfLines=0;

  const tryAddLine=(slot,stat)=>{
    if(!canAdd(slot,stat))return false;
    layout[slot].push(statWithValue(stat,t));
    if(stat==="Crit Chance") best.critLines++;
    if(stat==="Evasion")     best.evaLines++;
    if(stat==="DR%")         best.drLines++;
    if(stat==="ATK%")        best.atkLines++;
    if(stat==="Crit DMG")    best.cdLines++;
    if(stat==="Monster DMG") best.mdLines++;
    if(stat==="HP%")         best.hpLines++;
    if(stat==="DEF%")        best.dfLines++;
    return true;
  };

  // First pass caps
  for (const slot of rules.slots) {
    if (slot==="Weapon") continue;
    const hasAS=layout[slot].includes("ATK SPD");

    if(focus==="DPS"){
      if(!hasAS && (best.critLines*t.CR)<rules.caps.critFromGearRune) tryAddLine(slot,"Crit Chance");
      if(!hasAS && (best.evaLines*t.EV)<rules.caps.evaFromGearRune)   tryAddLine(slot,"Evasion");
    }else{
      if((best.drLines*t.DR)<rules.caps.drFromGearRune)               tryAddLine(slot,"DR%");
      if(!hasAS && (best.evaLines*t.EV)<rules.caps.evaFromGearRune)   tryAddLine(slot,"Evasion");
      if(!hasAS && (best.critLines*t.CR)<rules.caps.critFromGearRune) tryAddLine(slot,"Crit Chance");
    }
  }

  // Fillers
  const fillerOrderDPS=["Crit Chance","Evasion","ATK%","Crit DMG","Monster DMG","HP%","DEF%","DR%"];
  const fillerOrderTank=["DR%","Evasion","Crit Chance","HP%","DEF%","ATK%","Crit DMG","Monster DMG"];
  for(const slot of rules.slots){
    if(slot==="Weapon")continue;
    const order=(focus==="DPS")?fillerOrderDPS:fillerOrderTank;
    for(const stat of order){
      if(layout[slot].length>=capPerSlot(slot))break;
      if(CAP_STATS.has(stat)&&slotHasAnyCap(layout[slot]))continue;
      if(stat==="Crit Chance"&&(best.critLines*t.CR)>=rules.caps.critFromGearRune)continue;
      if(stat==="Evasion"&&(best.evaLines*t.EV)>=rules.caps.evaFromGearRune)continue;
      if(stat==="DR%"&&(best.drLines*t.DR)>=rules.caps.drFromGearRune)continue;
      tryAddLine(slot,stat);
    }
  }

  // Render
  for(const[slot,stats]of Object.entries(layout)){
    const div=document.createElement('div');
    div.className='slot';
    div.innerHTML=`<h3>${slot}</h3>`+stats.map(s=>`<div>- ${s}</div>`).join('');
    box.appendChild(div);
  }
  best._isChaosAbyss=isChaosAbyss; best._focus=focus;
}

// ---- totals ----
function renderTotals(focus,tier,best){
  const box=document.getElementById('totals'); box.innerHTML='';
  const t=best.tierVals; const isChaosAbyss=(tier==="Chaos"||tier==="Abyss");

  let atkSpd=best.asLines*t.AS+best.rune;
  let critBase=best.critLines*t.CR+best.rune;
  let evaBase =best.evaLines*t.EV+best.rune;
  let dr      =best.drLines*t.DR+best.rune;
  let atk=best.atkLines*t.ATK, cd=best.cdLines*t.CD, md=best.mdLines*t.MD,
      hp=best.hpLines*t.HP, df=best.dfLines*t.DF;

  critBase=Math.min(critBase,rules.caps.critFromGearRune);
  evaBase =Math.min(evaBase,rules.caps.evaFromGearRune);
  dr      =Math.min(dr,rules.caps.drFromGearRune);

  const critBuff=(+els.guildCrit.value||0)/100+(+els.secretCrit.value||0)/100;
  const evaBuff=(+els.secretEva.value||0)/100;

  let crit=critBase+critBuff+(best.critPet||0);
  let eva =evaBase+evaBuff;

  if(isChaosAbyss){
    atk+=3*t.ATK;
    cd+=2*t.CD+t.CD;
    if(best._focus==="Tank") hp+=t.HP;
    hp+=2*t.HP;
  }

  box.innerHTML=`
    <div><b>Attack Speed</b> = ${(atkSpd*100).toFixed(1)}%</div>
    <div><b>Crit Chance (incl. buffs)</b> = ${(crit*100).toFixed(1)}%</div>
    <div><b>Evasion (incl. secret tech)</b> = ${(eva*100).toFixed(1)}%</div>
    <div><b>DR%</b> = ${(dr*100).toFixed(1)}%</div>
    <hr>
    <div><b>ATK%</b> = ${(atk*100).toFixed(1)}%</div>
    <div><b>Crit DMG</b> = ${(cd*100).toFixed(1)}%</div>
    <div><b>Monster DMG</b> = ${(md*100).toFixed(1)}%</div>
    <div><b>HP%</b> = ${(hp*100).toFixed(1)}%</div>
    <div><b>DEF%</b> = ${(df*100).toFixed(1)}%</div>
    <hr>
    <div style="font-size:0.9em;opacity:0.7">
      Debug: AS=${best.asLines}, CR=${best.critLines}, EV=${best.evaLines}, DR=${best.drLines}
    </div>
  `;
}
