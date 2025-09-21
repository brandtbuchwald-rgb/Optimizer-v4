/// ==========================
// Rediscover Optimizer v4 — Debug Build (fixed exclusivity + caps)
// ==========================

const els = {};
window.addEventListener('DOMContentLoaded', () => {
  const q = id => document.getElementById(id);
  [
    'cls','focus','weap','gearTier','col','char',
    'guild','secret','guildCrit','secretCrit','secretEva',
    'target','fury'
  ].forEach(id => els[id] = q(id));
  els.runBtn = document.getElementById('runBtn');
  els.runBtn.addEventListener('click', run);
});

// ---------- Master Rules ----------
const rules = {
  slots: ["Weapon","Necklace","Helm","Chest","Gloves","Boots","Belt","Ring"],

  caps: {
    critFromGearRune: 0.50,
    evaFromGearRune:  0.40,
    drFromGearRune:   1.00
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
    castDPS: { chaosAbyss: "Cast Demon Lord (19%)", normal: "Cast Demon Lord (17%)" },
    castTank:{ chaosAbyss: "Cast Evasion (19%)",    normal: "Cast Evasion (17%)"    }
  }
};

// ---------- Helpers ----------
const fmtPct = p => (p*100).toFixed(1) + '%';
const fmtSec = s => s.toFixed(3) + 's';

function statWithValue(label, t) {
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
  const guildAS   = (+els.guild.value||0)/100;
  const secretAS  = (+els.secret.value||0)/100;
  const target    = +els.target.value || 0.25;
  const furyMult  = (els.fury.checked && cls === 'Berserker') ? 1.25 : 1.0;

  const base = rules.baseInterval[weap][cls];
  const tierVals = rules.lineValues[tier];
  const passiveAS = statColor + charMod + guildAS + secretAS;

  let best = null;
  const petOptions = Object.entries(rules.pets);

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
              critLines:0, evaLines:0, drLines:0, atkLines:0, cdLines:0, mdLines:0, hpLines:0, dfLines:0, asLines:0};
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
  renderSlots(cls, focus, tier, weap, best);
  renderTotals(focus, tier, best);
}

// ---------- Summary ----------
function renderCombo(cls,focus,weap,tier,base,target,best){
  const sum = document.getElementById('summary');
  sum.innerHTML = `
    <h3>Optimal Combo</h3>
    <div>${cls} (${focus}) | Weapon tier: ${weap} | Gear tier: ${tier}</div>
    <div>Base Interval: ${fmtSec(base)} → Target: ${fmtSec(target)}</div>
    <ul>
      <li>${best.gearLines} gear line(s) ATK SPD @ ${fmtPct(best.tierVals.AS)} each = ${fmtPct(best.gearLines*best.tierVals.AS)}</li>
      <li>Rune ${best.rune*100}%</li>
      <li>Pet ${best.petName} (AS ${fmtPct(best.petAS)}, Crit ${fmtPct(best.critPet||0)})</li>
    </ul>
    <div>= ${fmtPct(best.totalAS)} total → Cap reached at ${fmtSec(target)}</div>
    <div>Waste: ${fmtPct(best.waste)}</div>
    <hr/>
  `;
}

// ---------- Slots ----------
function renderSlots(cls, focus, tier, weap, best) {
  const box = document.getElementById('slots');
  box.innerHTML = '';

  const t = best.tierVals;
  const layout = {};
  for (const s of rules.slots) layout[s] = [];

  const isChaosAbyss = (tier === "Chaos" || tier==="Abyss");
  const isPvP = (weap === "PvP/Boss");

  const capPerSlot = slot => {
    if (tier === "Primal") return 3;
    if (tier === "Chaos" || tier === "Abyss") return 5;
    return 4; // Original + PvP/Boss
  };

  const CAP_STATS = new Set(["ATK SPD","Crit Chance","Evasion"]);
  const slotHasAnyCap = arr => arr.some(st => CAP_STATS.has(st));

  const tryAdd = (slot, stat) => {
    if (CAP_STATS.has(stat) && slotHasAnyCap(layout[slot])) return false;
    if (layout[slot].length >= capPerSlot(slot)) return false;
    if (layout[slot].includes(stat)) return false;

    layout[slot].push(statWithValue(stat,t));

    if (stat==="Crit Chance") best.critLines++;
    if (stat==="Evasion")     best.evaLines++;
    if (stat==="DR%")         best.drLines++;
    if (stat==="ATK%")        best.atkLines++;
    if (stat==="Crit DMG")    best.cdLines++;
    if (stat==="Monster DMG") best.mdLines++;
    if (stat==="HP%")         best.hpLines++;
    if (stat==="DEF%")        best.dfLines++;
    if (stat==="ATK SPD")     best.asLines++;
    return true;
  };

  // Purples only for Chaos/Abyss (not PvP/Boss)
  if (isChaosAbyss && !isPvP) {
    layout['Weapon'].push(
      focus==="DPS" ? purple(rules.purple5thLabels.WeaponDPS) : purple(rules.purple5thLabels.WeaponTank)
    );
    ["Necklace","Ring","Helm","Belt","Chest","Gloves","Boots"].forEach(s => {
      layout[s].push(purple(rules.purple5thLabels[s]));
    });
  }

  // Weapon pool
  const castLabel = (focus==="DPS")
    ? (isChaosAbyss && !isPvP ? rules.weaponPool.castDPS.chaosAbyss : rules.weaponPool.castDPS.normal)
    : (isChaosAbyss && !isPvP ? rules.weaponPool.castTank.chaosAbyss : rules.weaponPool.castTank.normal);
  tryAdd('Weapon', castLabel);

  const weaponFill = (focus==="DPS")
    ? ["ATK%","Crit DMG","Monster DMG","HP%","DEF%","DR%"]
    : ["HP%","DEF%","DR%","ATK%","Crit DMG","Monster DMG"];
  for (const s of weaponFill) tryAdd('Weapon', s);

  // ATK SPD lines
  let asLeft = best.gearLines;
  for (const s of rules.slots) {
    if (s!=="Weapon" && asLeft>0) {
      if (tryAdd(s,"ATK SPD")) asLeft--;
    }
  }

  // First-pass caps
  for (const slot of rules.slots) {
    if (slot==="Weapon") continue;
    if (focus==="DPS") {
      if (!slotHasAnyCap(layout[slot]) && (best.critLines*t.CR) < rules.caps.critFromGearRune) tryAdd(slot,"Crit Chance");
      if (!slotHasAnyCap(layout[slot]) && (best.evaLines*t.EV) < rules.caps.evaFromGearRune)   tryAdd(slot,"Evasion");
    } else {
      if ((best.drLines*t.DR) < rules.caps.drFromGearRune)     tryAdd(slot,"DR%");
      if (!slotHasAnyCap(layout[slot]) && (best.evaLines*t.EV) < rules.caps.evaFromGearRune)   tryAdd(slot,"Evasion");
      if (!slotHasAnyCap(layout[slot]) && (best.critLines*t.CR) < rules.caps.critFromGearRune) tryAdd(slot,"Crit Chance");
    }
  }

  // Fillers
  const fillerDPS = ["Crit Chance","Evasion","ATK%","Crit DMG","Monster DMG","HP%","DEF%","DR%"];
  const fillerTank = ["DR%","Evasion","Crit Chance","HP%","DEF%","ATK%","Crit DMG","Monster DMG"];

  for (const slot of rules.slots) {
    if (slot==="Weapon") continue;
    const order = (focus==="DPS") ? fillerDPS : fillerTank;
    for (const stat of order) {
      if (layout[slot].length >= capPerSlot(slot)) break;
      if (CAP_STATS.has(stat) && slotHasAnyCap(layout[slot])) continue;
      if (stat==="Crit Chance" && (best.critLines*t.CR) >= rules.caps.critFromGearRune) continue;
      if (stat==="Evasion" && (best.evaLines*t.EV) >= rules.caps.evaFromGearRune) continue;
      if (stat==="DR%" && (best.drLines*t.DR) >= rules.caps.drFromGearRune) continue;
      tryAdd(slot,stat);
    }
  }

  // Render
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
function renderTotals(focus,tier,best){
  const box=document.getElementById('totals');
  box.innerHTML='';

  const t=best.tierVals;
  const isChaosAbyss=(tier==="Chaos"||tier==="Abyss");

  let atkSpd = best.asLines*t.AS + best.rune*0.01;

  let critBase = best.critLines*t.CR + best.rune*0.01;
  let evaBase  = best.evaLines*t.EV + best.rune*0.01;
  let dr       = best.drLines*t.DR + best.rune*0.01;

  critBase = Math.min(critBase, rules.caps.critFromGearRune);
  evaBase  = Math.min(evaBase,  rules.caps.evaFromGearRune);
  dr       = Math.min(dr,       rules.caps.drFromGearRune);

  const critBuff = (+els.guildCrit.value||0)/100 + (+els.secretCrit.value||0)/100;
  const evaBuff  = (+els.secretEva.value||0)/100;

  let crit = critBase + critBuff + (best.critPet||0);
  let eva  = evaBase  + evaBuff;

  let atk = best.atkLines*t.ATK;
  let cd  = best.cdLines*t.CD;
  let md  = best.mdLines*t.MD;
  let hp  = best.hpLines*t.HP;
  let df  = best.dfLines*t.DF;

  if (isChaosAbyss){
    atk += 3*t.ATK;
    cd  += 3*t.CD;
    if (best._focus==="Tank") hp+=t.HP;
    hp += 2*t.HP;
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
