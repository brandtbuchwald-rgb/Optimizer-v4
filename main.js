// ==========================
// Rediscover Optimizer v4 — Rules-Accurate
// ==========================

const els = {};
window.addEventListener('DOMContentLoaded', () => {
  const q = id => document.getElementById(id);
  ['cls','focus','weap','gearTier','col','char','guild','secret','target','fury']
    .forEach(id => els[id] = q(id));
  els.runBtn = document.getElementById('runBtn');
  els.runBtn.addEventListener('click', run);
});

// ---------- Master Rules ----------
const rules = {
  slots: ["Weapon","Necklace","Helm","Chest","Gloves","Boots","Belt","Ring"],

  caps: {
    critFromGearRune: 0.50,
    evaFromGearRune:  0.40,
    drFromGearRune:   1.00,
    critTotal:        1.00
  },

  baseInterval: {
    Original:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Primal:  {Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Chaos:   {Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Abyss:   {Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    "PvP/Boss":{Berserker:2.2,Paladin:2.5,Ranger:2.0,Sorcerer:2.3}
  },

  lineValues: {
    Primal:   {AS:0.12, CR:0.12, EV:0.12, ATK:0.23, CD:0.35, MD:0.35, HP:0.23, DF:0.23, DR:0.14},
    Original: {AS:0.12, CR:0.12, EV:0.12, ATK:0.23, CD:0.35, MD:0.35, HP:0.23, DF:0.23, DR:0.17},
    Chaos:    {AS:0.14, CR:0.14, EV:0.14, ATK:0.26, CD:0.40, MD:0.40, HP:0.26, DF:0.26, DR:0.19},
    Abyss:    {AS:0.16, CR:0.16, EV:0.16, ATK:0.29, CD:0.45, MD:0.45, HP:0.29, DF:0.29, DR:0.21}
  },

  purple5thLabels: {
    Necklace: "Crit DMG",
    Ring:     "Crit DMG",
    Helm:     "Boss DMG / HP%",
    Belt:     "Boss DMG / HP%",
    WeaponDPS: "Crit DMG",
    WeaponTank: "HP%",
    Chest:   "ATK%",
    Gloves:  "ATK%",
    Boots:   "ATK%"
  },

  pets: {
    None:{AS:0.00, CR:0.00},
    B:{AS:0.06, CR:0.06},
    A:{AS:0.09, CR:0.09},
    S:{AS:0.12, CR:0.12}
  },

  weaponPool: {
    common: ["ATK%","Crit DMG","DR%","HP%","DEF%","Monster DMG"],
    castDPS: { chaosAbyss: "Cast Demon Lord (19%)", normal: "Cast Demon Lord (17%)" },
    castTank:{ chaosAbyss: "Cast Evasion (19%)",    normal: "Cast Evasion (17%)"    }
  }
};

// ---------- Helpers ----------
const fmtPct = p => (p*100).toFixed(1) + '%';
const fmtSec = s => s.toFixed(3) + 's';

const NUMERIC_KEYS = new Set([
  "ATK%", "Crit DMG", "Monster DMG", "HP%", "DEF%", "DR%", "Evasion", "Crit Chance", "ATK SPD"
]);

function statWithValue(label, t) {
  if (label.includes("purple-stat") || label.includes("Boss DMG")) return label;
  if (!NUMERIC_KEYS.has(label)) return label;

  const map = {
    "ATK%":"ATK","Crit DMG":"CD","Monster DMG":"MD","HP%":"HP",
    "DEF%":"DF","DR%":"DR","Evasion":"EV","Crit Chance":"CR","ATK SPD":"AS"
  };

  const key = map[label];
  const val = t[key];
  return (typeof val === "number") ? `${label} +${(val*100).toFixed(0)}%` : label;
}

const purple = txt => `<span class="purple-stat">${txt}</span>`;

// ---------- Core ----------
function run(){
  const cls    = els.cls.value;
  const focus  = els.focus.value;
  const weap   = els.weap.value;
  const tier   = els.gearTier.value;
  const statColor = +els.col.value;
  const charMod   = +els.char.value;
  const guild     = (+els.guild.value||0)/100;
  const secret    = (+els.secret.value||0)/100;
  const target    = +els.target.value || 0.25;
  const furyMult  = (els.fury.checked && cls === 'Berserker') ? 1.25 : 1.0;

  const base = rules.baseInterval[weap][cls];
  const tierVals = rules.lineValues[tier];
  const passiveAS = statColor + charMod + guild + secret;

  let best = null;
  const petOptions = Object.entries(rules.pets);

  // Pass 1
  for (let rune=0; rune<=6; rune++){
    for (const [petName, petStats] of petOptions){
      const petAS = petStats.AS;
      const petCR = petStats.CR;
      for (let gearLines=0; gearLines<=8; gearLines++){
        const totalAS = passiveAS + rune*0.01 + petAS + gearLines*tierVals.AS;
        const finalInterval = base * (1 - totalAS) * furyMult;
        if (finalInterval <= target){
          const requiredAS = 1 - (target / base);
          const waste = totalAS - requiredAS;
          if (!best || gearLines < best.gearLines || (gearLines === best.gearLines && waste < best.waste)){
            best = {gearLines, rune, quick:0, petName, petAS, critPet:petCR,
              totalAS, finalInterval, waste, tierVals,
              critLines:0, evaLines:0, drLines:0, atkLines:0, cdLines:0, mdLines:0, hpLines:0, dfLines:0};
          }
        }
      }
    }
  }

  // Pass 2 (Quicken)
  if (!best){
    for (let rune=0; rune<=6; rune++){
      for (let quick=1; quick<=2; quick++){
        for (const [petName, petStats] of petOptions){
          const petAS = petStats.AS;
          const petCR = petStats.CR;
          for (let gearLines=0; gearLines<=8; gearLines++){
            const totalAS = passiveAS + rune*0.01 + petAS + quick*0.01 + gearLines*tierVals.AS;
            const finalInterval = base * (1 - totalAS) * furyMult;
            if (finalInterval <= target){
              const requiredAS = 1 - (target / base);
              const waste = totalAS - requiredAS;
              if (!best || gearLines < best.gearLines || (gearLines === best.gearLines && waste < best.waste)){
                best = {gearLines, rune, quick, petName, petAS, critPet:petCR,
                  totalAS, finalInterval, waste, tierVals,
                  critLines:0, evaLines:0, drLines:0, atkLines:0, cdLines:0, mdLines:0, hpLines:0, dfLines:0};
              }
            }
          }
        }
      }
    }
  }

  if (!best){
    document.getElementById('summary').innerHTML = "<b>No valid combo reaches the target interval.</b>";
    document.getElementById('slots').innerHTML = '';
    document.getElementById('totals').innerHTML = '';
    return;
  }

  renderCombo(cls, focus, weap, tier, base, target, best);
  renderSlots(cls, focus, tier, best);
  renderTotals(focus, tier, best);
}

// ---------- Summary ----------
function renderCombo(cls,focus,weap,tier,base,target,best){
  const sum = document.getElementById('summary');
  sum.innerHTML = `
    <h3>Optimal Combo</h3>
    <div>${cls} (${focus}) | Weapon tier for base: ${weap} | Gear tier for lines: ${tier}</div>
    <div>Base Interval: ${fmtSec(base)} → Target: ${fmtSec(target)}</div>
    <ul>
      <li>${best.gearLines} gear line(s) ATK SPD @ ${fmtPct(best.tierVals.AS)} each = ${fmtPct(best.gearLines*best.tierVals.AS)}</li>
      <li>Rune ${best.rune}%</li>
      <li>Pet ${best.petName} (AS ${fmtPct(best.petAS)}, Crit ${fmtPct(best.critPet||0)})</li>
      ${best.quick>0 ? `<li>Quicken Lv ${best.quick} (${fmtPct(best.quick*0.01)})</li>` : ""}
    </ul>
    <div>= ${fmtPct(best.totalAS)} total → Cap reached at ${fmtSec(target)}</div>
    <div>Waste: ${fmtPct(best.waste)}</div>
    <hr/>
  `;
}

// ---------- Slots ----------
function renderSlots(cls, focus, tier, best) {
  const box = document.getElementById('slots');
  box.innerHTML = '';

  const t = best.tierVals;
  const layout = {};
  for (const s of rules.slots) layout[s] = [];

  const isChaosAbyss = (tier === "Chaos" || tier === "Abyss");
  const capPerSlot = slot => isChaosAbyss ? 5 : 4;

  const CAP_STATS = new Set(["ATK SPD","Crit Chance","Evasion","DR%"]);
  const slotHasAnyCap = arr => arr.some(s => CAP_STATS.has(s));

  const canAdd = (slot, stat) => {
    if (layout[slot].length >= capPerSlot(slot)) return false;
    if (layout[slot].includes(stat)) return false;
    if (CAP_STATS.has(stat) && slotHasAnyCap(layout[slot])) return false;
    return true;
  };

  // Purples first
  if (isChaosAbyss) {
    layout['Weapon'].push(
      focus === "DPS"
        ? purple(rules.purple5thLabels.WeaponDPS)
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

  // ATK SPD assignment
  let asLeft = best.gearLines;
  for (const s of rules.slots) {
    if (s!=="Weapon" && asLeft>0) {
      if (canAdd(s,"ATK SPD")) {
        layout[s].push(statWithValue("ATK SPD", t));
        asLeft--;
      }
    }
  }

  // Track totals with rune + pet included for caps
  let critAccum = best.rune*0.01 + (best.critPet||0);
  let evaAccum  = best.rune*0.01;
  let drAccum   = best.rune*0.01;

  const tryAddLine = (slot, stat) => {
    if (!canAdd(slot, stat)) return false;
    layout[slot].push(statWithValue(stat, t));
    if (stat==="Crit Chance") best.critLines++;
    if (stat==="Evasion")     best.evaLines++;
    if (stat==="DR%")         best.drLines++;
    if (stat==="ATK%")        best.atkLines++;
    if (stat==="Crit DMG")    best.cdLines++;
    if (stat==="Monster DMG") best.mdLines++;
    if (stat==="HP%")         best.hpLines++;
    if (stat==="DEF%")        best.dfLines++;
    return true;
  };

  // First pass caps
  for (const slot of rules.slots) {
    if (slot === "Weapon") continue;
    const capacity = capPerSlot(slot);
    const hasAS = layout[slot].includes("ATK SPD");
    const hasCap = slotHasAnyCap(layout[slot]);

    if (focus === "DPS") {
      if (!hasCap && !hasAS && (critAccum + t.CR) <= rules.caps.critFromGearRune) {
        if (tryAddLine(slot,"Crit Chance")) critAccum += t.CR;
      }
      if (!hasCap && !hasAS && layout[slot].length < capacity && (evaAccum + t.EV) <= rules.caps.evaFromGearRune) {
        if (tryAddLine(slot,"Evasion")) evaAccum += t.EV;
      }
    } else { // Tank
      if (!hasCap && layout[slot].length < capacity && (drAccum + t.DR) <= rules.caps.drFromGearRune) {
        if (tryAddLine(slot,"DR%")) drAccum += t.DR;
      }
      if (!hasCap && !hasAS && (evaAccum + t.EV) <= rules.caps.evaFromGearRune) {
        if (tryAddLine(slot,"Evasion")) evaAccum += t.EV;
      }
      if (!hasCap && !hasAS && layout[slot].length < capacity && (critAccum + t.CR) <= rules.caps.critFromGearRune) {
        if (tryAddLine(slot,"Crit Chance")) critAccum += t.CR;
      }
    }
  }

  // Fillers
  const fillerOrderDPS  = ["Crit Chance","Evasion","ATK%","Crit DMG","Monster DMG","HP%","DEF%","DR%"];
  const fillerOrderTank = ["DR%","Evasion","Crit Chance","HP%","DEF%","ATK%","Crit DMG","Monster DMG"];

  for (const slot of rules.slots) {
    if (slot === "Weapon") continue;
    const capacity = capPerSlot(slot);
    const order = (focus === "DPS") ? fillerOrderDPS : fillerOrderTank;

    for (const stat of order) {
      if (layout[slot].length >= capacity) break;
      if (CAP_STATS.has(stat) && slotHasCap(layout[slot])) continue;

      // Global cap checks
      if (stat === "Crit Chance" && (critAccum + t.CR) > rules.caps.critFromGearRune) continue;
      if (stat === "Evasion"     && (evaAccum + t.EV) > rules.caps.evaFromGearRune) continue;
      if (stat === "DR%"         && (drAccum  + t.DR) > rules.caps.drFromGearRune) continue;

      if (tryAddLine(slot, stat)) {
        if (stat === "Crit Chance") critAccum += t.CR;
        if (stat === "Evasion")     evaAccum  += t.EV;
        if (stat === "DR%")         drAccum   += t.DR;
      }
    }
  }

  // Render slots
  for (const [slot,stats] of Object.entries(layout)){
    const div=document.createElement('div');
    div.className='slot';
    div.innerHTML=`<h3>${slot}</h3>`+stats.map(s=>`<div>- ${s}</div>`).join('');
    box.appendChild(div);
  }

  best._isChaosAbyss=isChaosAbyss;
  best._focus=focus;
}
// ---------- Totals ----------
/function renderTotals(focus, tier, best){
  const box=document.getElementById('totals');
  box.innerHTML='';

  const t=best.tierVals;
  const isChaosAbyss=(tier==="Chaos"||tier==="Abyss");

  let atkSpd = best.gearLines*t.AS + best.rune*0.01;
  let crit   = best.critLines*t.CR + best.rune*0.01;
  let eva    = best.evaLines*t.EV  + best.rune*0.01;
  let dr     = best.drLines*t.DR   + best.rune*0.01; // ✅ now includes rune
  let atk    = best.atkLines*t.ATK;
  let cd     = best.cdLines*t.CD;
  let md     = best.mdLines*t.MD;
  let hp     = best.hpLines*t.HP;
  let df     = best.dfLines*t.DF;

  // Add pet contributions
  crit += (best.critPet||0);

  // Add purple contributions
  if (isChaosAbyss) {
    atk += 3 * t.ATK; // Chest, Gloves, Boots
    cd  += 2 * t.CD;  // Necklace + Ring
    cd  += t.CD;      // Weapon DPS purple
    if (best._focus === "Tank") hp += t.HP;
    hp += 2 * t.HP;   // Helm + Belt
  }

  box.innerHTML = `
    <div><b>Attack Speed (gear + rune)</b> = ${(atkSpd*100).toFixed(1)}%</div>
    <div><b>Crit Chance (gear + rune + pet)</b> = ${(crit*100).toFixed(1)}%</div>
    <div><b>Evasion (gear + rune)</b> = ${(eva*100).toFixed(1)}%</div>
    <div><b>DR% (gear + rune)</b> = ${(dr*100).toFixed(1)}%</div>
    <hr>
    <div><b>ATK%</b> = ${(atk*100).toFixed(1)}%</div>
    <div><b>Crit DMG</b> = ${(cd*100).toFixed(1)}%</div>
    <div><b>Monster DMG</b> = ${(md*100).toFixed(1)}%</div>
    <div><b>HP%</b> = ${(hp*100).toFixed(1)}%</div>
    <div><b>DEF%</b> = ${(df*100).toFixed(1)}%</div>
  `;
}
