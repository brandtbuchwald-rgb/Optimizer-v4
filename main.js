// ==========================
// Rediscover Optimizer v4 (Final Clean, Dual Selectors)
// ==========================

const els = {};
window.addEventListener('DOMContentLoaded', () => {
  const q = id => document.getElementById(id);
  ['cls','focus','weap','gearTier','col','char','guild','secret','target','fury']
    .forEach(id => els[id] = q(id));
  els.runBtn = document.getElementById('runBtn');
  els.runBtn.addEventListener('click', () => run());
});

// ---- Rules ----
const rules = {
  slots: ["Weapon","Necklace","Helm","Chest","Gloves","Boots","Belt","Ring"],
  caps: { critFromGearRune: 0.50, evaFromGearRune: 0.40, drFromGearRune: 1.00 },
  baseInterval: {
    Original:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Primal:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
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
  pets: {
  None:{AS:0, CR:0},
  B:{AS:0.08, CR:0.06},
  A:{AS:0.10, CR:0.09},
  S:{AS:0.12, CR:0.12}
};

// ---- Helpers ----
function fmtPct(p){ return (p*100).toFixed(1) + '%'; }
function fmtSec(s){ return s.toFixed(3) + 's'; }

// ---- Core ----
function run(){
  const cls    = els.cls.value;
  const focus  = els.focus.value;
  const weap   = els.weap.value;       // weapon type (Original / Primal / Chaos / Abyss / PvP/Boss)
  const tier   = els.gearTier.value;   // gear tier (Primal / Original / Chaos / Abyss)
  const statColor = +els.col.value;
  const charMod   = +els.char.value;
  const guild     = (+els.guild.value||0)/100;
  const secret    = (+els.secret.value||0)/100;
  const target    = +els.target.value || 0.25;
  const fury      = (els.fury.checked && cls === 'Berserker') ? 1.25 : 1.0;

  const base = rules.baseInterval[weap][cls];   // weapon sets base interval
  const tierVals = rules.lineValues[tier];      // gear tier sets line values
  const passiveAS = statColor + charMod + guild + secret;

  let best = null;
  const petOptions = Object.entries(rules.pets);

  // 1) Try WITHOUT quicken
  for (let rune=0; rune<=6; rune++){
    for (const [petName, petStats] of petOptions){
      const petAS = petStats.AS;
      const petCR = petStats.CR;

      for (let gearLines=0; gearLines<=8; gearLines++){
        const totalAS = passiveAS + rune*0.01 + petAS + gearLines*tierVals.AS;
        const finalInterval = base * (1 - totalAS) * fury;

        if (finalInterval <= target){
          const requiredAS = 1 - (target / base);
          const waste = totalAS - requiredAS;

          if (!best || gearLines < best.gearLines ||
             (gearLines === best.gearLines && waste < best.waste - 1e-9)){
            best = {
              gearLines,rune,quick:0,
              petName,petAS,critPet:petCR,
              totalAS,finalInterval,waste,
              tierVals,critLines:0,evaLines:0,drLines:0
            };
          }
        }
      }
    }
  }

  // 2) If no valid combo, allow quicken (last resort)
  if (!best){
    for (let rune=0; rune<=6; rune++){
      for (let quick=1; quick<=2; quick++){ // only Lv1-2
        for (const [petName, petStats] of petOptions){
          const petAS = petStats.AS;
          const petCR = petStats.CR;

          for (let gearLines=0; gearLines<=8; gearLines++){
            const totalAS = passiveAS + rune*0.01 + petAS + quick*0.01 + gearLines*tierVals.AS;
            const finalInterval = base * (1 - totalAS) * fury;

            if (finalInterval <= target){
              const requiredAS = 1 - (target / base);
              const waste = totalAS - requiredAS;

              if (!best || gearLines < best.gearLines ||
                 (gearLines === best.gearLines && waste < best.waste - 1e-9)){
                best = {
                  gearLines,rune,quick,
                  petName,petAS,critPet:petCR,
                  totalAS,finalInterval,waste,
                  tierVals,critLines:0,evaLines:0,drLines:0
                };
              }
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

  renderCombo(cls,focus,weap,tier,base,target,best);
  renderSlots(cls,focus,tier,best);
}

// ---- Combo Summary ----
function renderCombo(cls,focus,weap,tier,base,target,best){
  const sum = document.getElementById('summary');
  sum.innerHTML = `
    <h3>Optimal Combo</h3>
    <div>${cls} (${focus}) | Weapon: ${weap} | Tier: ${tier}</div>
    <div>Base Interval: ${fmtSec(base)} → Target: ${fmtSec(target)}</div>
    <ul>
      <li>${best.gearLines} gear line(s) ATK SPD @ ${fmtPct(best.tierVals.AS)} each = ${fmtPct(best.gearLines*best.tierVals.AS)}</li>
      <li>Rune ${best.rune*1}%</li>
      <li>Pet ${best.petName} (AS ${fmtPct(best.petAS)}, Crit ${fmtPct(best.critPet||0)})</li>
      ${best.quick>0 ? `<li>Quicken Lv ${best.quick} (${fmtPct(best.quick*0.01)})</li>` : ""}
    </ul>
    <div>= ${fmtPct(best.totalAS)} total → Cap reached at ${fmtSec(target)}</div>
    <div>Waste: ${fmtPct(best.waste)}</div>
    <hr/>
  `;
}
// ---- Slots ----
function renderSlots(cls,focus,tier,best){
  const box = document.getElementById('slots');
  box.innerHTML = '';

  const tierVals = best.tierVals;
  const layout = {};
  for (const s of rules.slots) layout[s] = [];

  // reset counters
  best.critLines = 0;
  best.evaLines  = 0;
  best.drLines   = 0;

  // Weapon rules
  if (focus === "DPS") {
    layout['Weapon'] = tier==="Primal"
      ? ["Cast Demon Lord","ATK%","Crit DMG"]
      : ["Cast Demon Lord","ATK%","Crit DMG","Monster DMG"];
  } else {
    layout['Weapon'] = tier==="Primal"
      ? ["Cast Evasion","HP%","DEF%"]
      : ["Cast Evasion","HP%","DEF%","DR%"];
    if (tier!=="Primal") best.drLines++;
  }

  // ATK SPD lines
  let asLeft = best.gearLines;
  for (const s of rules.slots){
    if (s!=="Weapon" && asLeft>0){
      layout[s].push("ATK SPD");
      asLeft--;
    }
  }

  // Crit Chance
  let critAccum = 0;
  for (const s of rules.slots){
    if (s!=="Weapon" &&
        !layout[s].includes("ATK SPD") &&
        (critAccum + tierVals.CR) <= rules.caps.critFromGearRune){
      layout[s].push("Crit Chance");
      critAccum += tierVals.CR;
      best.critLines++;
    }
  }

  // Evasion
  let evaAccum = 0;
  for (const s of rules.slots){
    if (s!=="Weapon" &&
        !layout[s].includes("ATK SPD") &&
        !layout[s].includes("Crit Chance") &&
        (evaAccum + tierVals.EV) <= rules.caps.evaFromGearRune){
      layout[s].push("Evasion");
      evaAccum += tierVals.EV;
      best.evaLines++;
    }
  }

  // DR%
  let drAccum = 0;
  for (const s of rules.slots){
    if (s!=="Weapon" &&
        drAccum + tierVals.DR <= rules.caps.drFromGearRune &&
        layout[s].length < 4){
      layout[s].push("DR%");
      drAccum += tierVals.DR;
      best.drLines++;
    }
  }

  // Fill remaining
  let filler = (focus==="DPS")
    ? ["ATK%","Crit DMG","Monster DMG"]
    : ["DR%","HP%","DEF%","ATK%","Crit Chance"];

  for (const s of rules.slots){
    while(layout[s].length<4){
      for (const f of filler){
        if(layout[s].length<4 && !layout[s].includes(f)){
          layout[s].push(f);
          if(f==="Crit Chance") best.critLines++;
          if(f==="Evasion") best.evaLines++;
          if(f==="DR%") best.drLines++;
        }
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

  renderTotals(best);
}

// ---- Totals ----
function renderTotals(best){
  const box = document.getElementById('totals');
  box.innerHTML = '';

  const asGear = best.gearLines * best.tierVals.AS;
  const asRune = best.rune * 0.01;
  const totalAS = asGear + asRune;

  // Crit Chance gear+rune
  const rawCrit = best.critLines * best.tierVals.CR;
  const critGearRune = Math.min(rawCrit, rules.caps.critFromGearRune);
  const critWaste = Math.max(0, rawCrit - rules.caps.critFromGearRune);

  // Crit Chance with pet
  const critWithPet = critGearRune + (best.critPet || 0);

  // Evasion
  const rawEva = best.evaLines * best.tierVals.EV;
  const evaGearRune = Math.min(rawEva, rules.caps.evaFromGearRune);
  const evaWaste = Math.max(0, rawEva - rules.caps.evaFromGearRune);

  // DR
  const rawDR = best.drLines * best.tierVals.DR;
  const drGearRune = Math.min(rawDR, rules.caps.drFromGearRune);
  const drWaste = Math.max(0, rawDR - rules.caps.drFromGearRune);

  const html = `
    <h3>Totals</h3>
    <div>Attack Speed (gear+rune) = ${(totalAS*100).toFixed(1)}%</div>
    <div>Crit Chance (gear+rune) = ${(critGearRune*100).toFixed(1)}% ${critWaste>0?`(waste ${(critWaste*100).toFixed(1)}%)`:''}</div>
    <div>Crit Chance + Pet = ${(critWithPet*100).toFixed(1)}%</div>
    <div>Evasion (gear+rune) = ${(evaGearRune*100).toFixed(1)}% ${evaWaste>0?`(waste ${(evaWaste*100).toFixed(1)}%)`:''}</div>
    <div>DR% (gear+rune) = ${(drGearRune*100).toFixed(1)}% ${drWaste>0?`(waste ${(drWaste*100).toFixed(1)}%)`:''}</div>
  `;
  box.innerHTML = html;
}
