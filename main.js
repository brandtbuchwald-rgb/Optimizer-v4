
// ==========================
// Rediscover Optimizer v4 (Clean)
// ==========================

// ==========================
// Rediscover Optimizer v4 (Clean)
// ==========================

const els = {};
window.addEventListener('DOMContentLoaded', () => {
  const q = id => document.getElementById(id);
  ['cls','focus','gearTier','col','char','guild','secret','target','fury'
  ].forEach(id => els[id] = q(id));
  els.runBtn = document.getElementById('runBtn');
  els.runBtn.addEventListener('click', () => run());
});

// ---- Rules ----
const rules = {
  slots: ["Weapon","Necklace","Helm","Chest","Gloves","Boots","Belt","Ring"],
  caps: { critFromGearRune: 0.50, evaFromGearRune: 0.40, drFromGearRune: 1.00 },
  baseInterval: {
    Primal:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Original:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Chaos:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Abyss:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    "PvP/Boss":{Berserker:2.2,Paladin:2.5,Ranger:2.0,Sorcerer:2.3}
  },
  lineValues: {
    Primal:{AS:0.12, CR:0.14, EV:0.10, ATK:0.12, CD:40, MD:0.12, HP:0.14, DF:0.12, DR:0.10},
    Original:{AS:0.12, CR:0.14, EV:0.10, ATK:0.12, CD:40, MD:0.12, HP:0.14, DF:0.12, DR:0.10},
    Chaos:{AS:0.14, CR:0.15, EV:0.11, ATK:0.14, CD:40, MD:0.14, HP:0.16, DF:0.14, DR:0.11},
    Abyss:{AS:0.16, CR:0.16, EV:0.12, ATK:0.16, CD:40, MD:0.16, HP:0.18, DF:0.16, DR:0.12}
  },
  pets: { None:0, B:0.08, A:0.10, S:0.12 }
};

function fmtPct(p){ return (p*100).toFixed(1) + '%'; }
function fmtSec(s){ return s.toFixed(3) + 's'; }

// --- Core ---
function run(){
  const cls    = els.cls.value;
  const focus  = els.focus.value;
  const tier   = els.gearTier.value;
  const statColor = +els.col.value;
  const charMod   = +els.char.value;
  const guild     = (+els.guild.value||0)/100;
  const secret    = (+els.secret.value||0)/100;
  const target    = +els.target.value || 0.25;
  const fury      = (els.fury.checked && cls === 'Berserker') ? 1.25 : 1.0;

  const base = rules.baseInterval[tier][cls];
  const tierVals = rules.lineValues[tier];

  // passive buffs (don’t show in totals)
  const passiveAS = statColor + charMod + guild + secret;

  // --- Brute force search for best combo ---
  let best = null;
  const petOptions = Object.entries(rules.pets);

  for (let rune=0; rune<=6; rune++){
    for (let quick=0; quick<=2; quick++){  // limit quicken to lvl 2
      for (const [petName,petAS] of petOptions){
        for (let gearLines=0; gearLines<=8; gearLines++){
          const totalAS = passiveAS + rune*0.01 + quick*0.01 + petAS + gearLines*tierVals.AS;
          const finalInterval = base * (1 - totalAS) * fury;
          if (finalInterval <= target){
            const requiredAS = 1 - (target / base);
            const waste = totalAS - requiredAS;

            if (!best ||
                gearLines < best.gearLines ||
                (gearLines === best.gearLines && waste < best.waste - 1e-9)) {
              best = {gearLines,rune,quick,petName,petAS,totalAS,finalInterval,waste,tierVals};
            }
          }
        }
      }
    }
  }

  if (!best){
    document.getElementById('summary').innerHTML = "<b>No valid combo reaches cap.</b>";
    return;
  }

  renderCombo(cls,focus,tier,base,target,best);
  renderSlots(cls,focus,tier,best);
}

// --- Render combo summary ---
function renderCombo(cls,focus,tier,base,target,best){
  const sum = document.getElementById('summary');
  sum.innerHTML = `
    <h3>Optimal Combo</h3>
    <div>${cls} (${focus}) | Tier: ${tier}</div>
    <div>Base Interval: ${fmtSec(base)} → Target: ${fmtSec(target)}</div>
    <ul>
      <li>${best.gearLines} gear line(s) ATK SPD @ ${fmtPct(best.tierVals.AS)} each = ${fmtPct(best.gearLines*best.tierVals.AS)}</li>
      <li>Rune ${best.rune}%</li>
      <li>Pet ${best.petName} (${fmtPct(best.petAS)})</li>
      <li>Quicken Lv ${best.quick} (${fmtPct(best.quick*0.01)})</li>
    </ul>
    <div>= ${fmtPct(best.totalAS)} total → Cap reached at ${fmtSec(target)}</div>
    <div>Waste: ${fmtPct(best.waste)}</div>
    <hr/>
  `;
}

// --- Render slot-by-slot ---
function renderSlots(cls,focus,tier,best){
  const box = document.getElementById('slots');
  box.innerHTML = '';

  const tierVals = best.tierVals;
  const layout = {};
  for (const s of rules.slots) layout[s] = [];

  // Weapon rules
  if (focus === "DPS"){
    layout['Weapon'] = (tier === "Primal")
      ? ["Cast Demon Lord","ATK%","Crit DMG"]
      : ["Cast Demon Lord","ATK%","Crit DMG","Monster DMG"];
  } else {
    layout['Weapon'] = (tier === "Primal")
      ? ["Cast Evasion","HP%","DEF%"]
      : ["Cast Evasion","HP%","DEF%","DR%"];
  }

  // Assign ATK SPD
  let asLeft = best.gearLines;
  for (const s of rules.slots){
    if (s!=="Weapon" && asLeft>0){
      layout[s].push("ATK SPD");
      asLeft--;
    }
  }

  // Crit, Evasion, DR filling (respect caps)
  let critAccum=0, evaAccum=0, drAccum=0;
  for (const s of rules.slots){
    if (s==="Weapon") continue;

    if (!layout[s].includes("ATK SPD") &&
        (critAccum + tierVals.CR) <= rules.caps.critFromGearRune){
      layout[s].push("Crit Chance");
      critAccum += tierVals.CR;
    }
    if (!layout[s].includes("ATK SPD") &&
        !layout[s].includes("Crit Chance") &&
        (evaAccum + tierVals.EV) <= rules.caps.evaFromGearRune){
      layout[s].push("Evasion");
      evaAccum += tierVals.EV;
    }
    if ((drAccum + tierVals.DR) <= rules.caps.drFromGearRune &&
        layout[s].length<4){
      layout[s].push("DR%");
      drAccum += tierVals.DR;
    }
  }

  // Fill with focus-specific priorities
  const filler = (focus==="DPS")
    ? ["ATK%","Crit DMG","Monster DMG"]
    : ["DR%","HP%","DEF%","ATK%","Crit Chance"];
  for (const s of rules.slots){
    while(layout[s].length<4){
      for (const f of filler){
        if (layout[s].length<4 && !layout[s].includes(f)){
          layout[s].push(f);
        }
      }
    }
  }

  // Output
  for (const [slot,stats] of Object.entries(layout)){
    const div=document.createElement('div');
    div.className='slot';
    div.innerHTML=`<h3>${slot}</h3>`+stats.map(s=>`<div>- ${s}</div>`).join('');
    box.appendChild(div);
  }

  renderTotals(best,tierVals);
}

// --- Totals with waste tracking ---
function renderTotals(best, tierVals) {
  const box = document.getElementById('totals');
  box.innerHTML = '';

  // --- Attack Speed (gear + rune only) ---
  const asGear = best.gearLines * tierVals.AS;
  const asRune = best.rune * 0.01; // rune input is %
  const totalAS = asGear + asRune;
  const requiredAS = 1 - (best.finalInterval / (rules.baseInterval[best.tier][best.cls])); 
  const asWaste = Math.max(totalAS - requiredAS, 0);

  // --- Crit Chance ---
  const rawCrit = (best.critLines || 0) * tierVals.CR + (best.critRune || 0);
  const critFromGearRune = Math.min(rawCrit, rules.caps.critFromGearRune);
  const critWithPet = critFromGearRune + (best.critPet || 0);
  const critWaste = Math.max(rawCrit - rules.caps.critFromGearRune, 0);

  // --- Evasion ---
  const rawEva = (best.evaLines || 0) * tierVals.EV + (best.evaRune || 0);
  const evaTotal = Math.min(rawEva, rules.caps.evaFromGearRune);
  const evaWaste = Math.max(rawEva - rules.caps.evaFromGearRune, 0);

  // --- Output ---
  const html = `
    <h3>Totals</h3>
    <div>Attack Speed (Gear+Rune) = ${(totalAS*100).toFixed(1)}% 
      ${asWaste > 0 ? `(waste ${(asWaste*100).toFixed(1)}%)` : ''}</div>

    <div>Crit Chance (Gear+Rune) = ${(critFromGearRune*100).toFixed(1)}% 
      (with Pet ${(critWithPet*100).toFixed(1)}%) 
      ${critWaste > 0 ? `(waste ${(critWaste*100).toFixed(1)}%)` : ''}</div>

    <div>Evasion (Gear+Rune) = ${(evaTotal*100).toFixed(1)}% 
      ${evaWaste > 0 ? `(waste ${(evaWaste*100).toFixed(1)}%)` : ''}</div>
  `;

  box.innerHTML = html;
}
