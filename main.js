// ==========================
// Rediscover Optimizer v4
// ==========================

const els = {};
window.addEventListener('DOMContentLoaded', () => {
  const q = id => document.getElementById(id);
  ['cls','focus','gearTier','col','char','guild','secret','target','fury',
   'line_atkspd','line_crit','line_eva','line_atk','line_cd',
   'line_md','line_hp','line_def','line_dr'
  ].forEach(id => els[id] = q(id));
  els.runBtn = document.getElementById('runBtn');
  els.runBtn.addEventListener('click', () => run());
});

// ---- Rules ----
const rules = {
  slots: ["Weapon","Necklace","Helm","Chest","Gloves","Boots","Belt","Ring"],
  caps: { critFromGearRune: 0.50, evaFromGearRune: 0.40 },
  priority: {
    DPS: ["ATK SPD","Crit Chance","Evasion","ATK%","Crit DMG","Monster DMG","HP%","DEF%"],
    Tank: ["ATK SPD","Evasion","Crit Chance","DR%","HP%","DEF%","ATK%","Crit DMG"]
  },
  // in rules.baseInterval
baseInterval: {
  Primal:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
  Original:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
  Chaos:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
  Abyss:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2}
},

// in rules.lineValues
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
  for (let quick=0; quick<=5; quick++){
    for (const [petName,petAS] of petOptions){
      for (let gearLines=0; gearLines<=8; gearLines++){
        const totalAS = passiveAS + rune*0.01 + quick*0.01 + petAS + gearLines*tierVals.AS;
        const finalInterval = base * (1 - totalAS) * fury;
        if (finalInterval <= target){
          const requiredAS = 1 - (target / base);           // AS needed ignoring fury (fury already applied above)
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

  // Weapon baseline
  layout['Weapon'] = ['ATK%','Crit DMG','Monster DMG','DR%','Cast Demon Lord'];

  // Assign ATK SPD lines
  let asLeft = best.gearLines;
  for (const s of rules.slots){
    if (s!=="Weapon" && asLeft>0){
      layout[s].push("ATK SPD");
      asLeft--;
    }
  }

  // Crit Chance until 50%
  let critAccum=0;
  for (const s of rules.slots){
    if (s!=="Weapon" && !layout[s].includes("ATK SPD") && critAccum<rules.caps.critFromGearRune){
      layout[s].push("Crit Chance");
      critAccum += tierVals.CR;
    }
  }

  // Evasion until 40%
  let evaAccum=0;
  for (const s of rules.slots){
    if (s!=="Weapon" && !layout[s].includes("ATK SPD") && !layout[s].includes("Crit Chance") && evaAccum<rules.caps.evaFromGearRune){
      layout[s].push("Evasion");
      evaAccum += tierVals.EV;
    }
  }

  // Fill remaining with DPS priorities
  const filler = (focus==="DPS")?["ATK%","Crit DMG","Monster DMG"]:["Evasion","HP%","DR%","DEF%","ATK%"];
  for (const s of rules.slots){
    while(layout[s].length<4){
      for (const f of filler){
        if(layout[s].length<4 && !layout[s].includes(f)) layout[s].push(f);
      }
    }
  }

  // Output slots
  for (const [slot,stats] of Object.entries(layout)){
    const div=document.createElement('div');
    div.className='slot';
    div.innerHTML=`<h3>${slot}</h3>`+stats.map(s=>`<div>- ${s}</div>`).join('');
    box.appendChild(div);
  }

  // Add totals panel at the end
  renderTotals(best, layout);
}
function renderTotals(best, layout){
  const box = document.getElementById('slots');
  const div = document.createElement('div');
  div.className = 'slot';

  // Count how many lines of each stat were assigned
  const statCounts = {};
  for (const stats of Object.values(layout)){
    for (const s of stats){
      statCounts[s] = (statCounts[s]||0)+1;
    }
  }

  const tierVals = best.tierVals;

  function statLine(name, val, perLine=null, count=null){
    if (count && perLine){
      return `<div>${name} = ${fmtPct(val)} (${count} × ${fmtPct(perLine)})</div>`;
    } else {
      return `<div>${name} = ${fmtPct(val)}</div>`;
    }
  }

  // Totals math
  const atkSpd = (statCounts['ATK SPD']||0) * tierVals.AS;
  const crit   = (statCounts['Crit Chance']||0) * tierVals.CR;
  const eva    = (statCounts['Evasion']||0) * tierVals.EV;
  const atk    = (statCounts['ATK%']||0) * tierVals.ATK;
  const cd     = (statCounts['Crit DMG']||0) * tierVals.CD;
  const md     = (statCounts['Monster DMG']||0) * tierVals.MD;
  const hp     = (statCounts['HP%']||0) * tierVals.HP;
  const df     = (statCounts['DEF%']||0) * tierVals.DF;
  const dr     = (statCounts['DR%']||0) * tierVals.DR;

  div.innerHTML = `
    <h3>Totals</h3>
    ${statLine("Attack Speed", atkSpd, tierVals.AS, statCounts['ATK SPD']||0)}
    ${statLine("Crit Chance", crit, tierVals.CR, statCounts['Crit Chance']||0)}
    ${statLine("Evasion", eva, tierVals.EV, statCounts['Evasion']||0)}
    ${statLine("Attack%", atk, tierVals.ATK, statCounts['ATK%']||0)}
    ${statLine("Crit DMG", cd, tierVals.CD, statCounts['Crit DMG']||0)}
    ${statLine("Monster DMG", md, tierVals.MD, statCounts['Monster DMG']||0)}
    ${statLine("HP%", hp, tierVals.HP, statCounts['HP%']||0)}
    ${statLine("DEF%", df, tierVals.DF, statCounts['DEF%']||0)}
    ${statLine("DR%", dr, tierVals.DR, statCounts['DR%']||0)}
  `;

  box.appendChild(div);
}
