// ==========================
// Rediscover Optimizer v3
// ==========================

const els = {};
window.addEventListener('DOMContentLoaded', () => {
  const q = id => document.getElementById(id);
  ['cls','focus','weap','col','char','guild','secret','target','fury',
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
  baseInterval: {
    Original:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Primal:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Chaos:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Abyss:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    "PvP/Boss":{Berserker:2.2,Paladin:2.5,Ranger:2.0,Sorcerer:2.3}
  },
  lineValues: {
    Original:{AS:0.12,CR:0.14,EV:0.10},
    Primal:{AS:0.12,CR:0.14,EV:0.10},
    Chaos:{AS:0.16,CR:0.16,EV:0.12},
    Abyss:{AS:0.16,CR:0.16,EV:0.12},
    "PvP/Boss":{AS:0.12,CR:0.14,EV:0.10}
  },
  pets: { None:0, B:0.08, A:0.10, S:0.12 }
};

function fmtPct(p){ return (p*100).toFixed(1) + '%'; }
function fmtSec(s){ return s.toFixed(3) + 's'; }

// --- Core ---
function run(){
  const cls    = els.cls.value;
  const focus  = els.focus.value;
  const weap   = els.weap.value;
  const statColor = +els.col.value;
  const charMod   = +els.char.value;
  const guild     = (+els.guild.value||0)/100;
  const secret    = (+els.secret.value||0)/100;
  const target    = +els.target.value || 0.25;
  const fury      = (els.fury.checked && cls === 'Berserker') ? 1.25 : 1.0;

  const base = rules.baseInterval[weap][cls];
  const line = {
    AS: +els.line_atkspd.value || rules.lineValues[weap].AS,
    CR: +els.line_crit.value   || rules.lineValues[weap].CR,
    EV: +els.line_eva.value    || rules.lineValues[weap].EV,
    ATK: +els.line_atk.value   || 0.18,
    CD:  +els.line_cd.value    || 40,
    MD:  +els.line_md.value    || 0.18,
    HP:  +els.line_hp.value    || 0.20,
    DF:  +els.line_def.value   || 0.20,
    DR:  +els.line_dr.value    || 0.12
  };

  // passive buffs (don’t show in totals)
  const passiveAS = statColor + charMod + guild + secret;

  // --- Brute force search for best combo ---
  let best = null;
  const petOptions = Object.entries(rules.pets);
  for (let rune=0; rune<=6; rune++){
    for (let quick=0; quick<=5; quick++){
      for (let [petName,petAS] of petOptions){
        for (let gearLines=0; gearLines<=8; gearLines++){
          const totalAS = passiveAS + (rune*0.01) + (quick*0.01) + petAS + (gearLines*line.AS);
          const finalInterval = base * (1 - totalAS) * fury;
          if (finalInterval <= target){
            const waste = totalAS - (1 - target/base);
            if (!best || waste < best.waste){
              best = {gearLines,rune,quick,petName,petAS,totalAS,finalInterval,waste};
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

  renderCombo(cls,focus,weap,base,target,best,line,passiveAS);
  renderSlots(cls,focus,weap,best,line);
}

// --- Render combo summary ---
function renderCombo(cls,focus,weap,base,target,best,line,passiveAS){
  const sum = document.getElementById('summary');
  sum.innerHTML = `
    <h3>Optimal Combo</h3>
    <div>${cls} (${focus}) | Tier: ${weap}</div>
    <div>Base Interval: ${fmtSec(base)} → Target: ${fmtSec(target)}</div>
    <ul>
      <li>${best.gearLines} gear line(s) ATK SPD (${fmtPct(best.gearLines*line.AS)})</li>
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
function renderSlots(cls,focus,weap,best,line){
  const box = document.getElementById('slots');
  box.innerHTML = '';

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
      critAccum += line.CR;
    }
  }

  // Evasion until 40%
  let evaAccum=0;
  for (const s of rules.slots){
    if (s!=="Weapon" && !layout[s].includes("ATK SPD") && !layout[s].includes("Crit Chance") && evaAccum<rules.caps.evaFromGearRune){
      layout[s].push("Evasion");
      evaAccum += line.EV;
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

  // Output
  for (const [slot,stats] of Object.entries(layout)){
    const div=document.createElement('div');
    div.className='slot';
    div.innerHTML=`<h3>${slot}</h3>`+stats.map(s=>`<div>- ${s}</div>`).join('');
    box.appendChild(div);
  }
}
