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
  caps: { 
    critFromGearRune: 0.50,   // 50% crit max from gear+rune
    evaFromGearRune: 0.40,    // 40% evasion max from gear+rune
    drFromGearRune: 1.00      // 100% DR max
  },
  baseInterval: {
    Original:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Primal:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Chaos:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Abyss:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    "PvP/Boss":{Berserker:2.2,Paladin:2.5,Ranger:2.0,Sorcerer:2.3}
  },
  lineValues: {
    Primal:   {AS:0.12, CR:0.12, EV:0.12, ATK:0.23, CD:0.35, MD:0.35, HP:0.23, DF:0.23, DR:0.14},
    Original: {AS:0.12, CR:0.12, EV:0.12, ATK:0.23, CD:0.35, MD:0.35, HP:0.23, DF:0.23, DR:0.17},
    Chaos:    {AS:0.14, CR:0.14, EV:0.14, ATK:0.26, CD:0.40, MD:0.40, HP:0.26, DF:0.26, DR:0.19},
    Abyss:    {AS:0.16, CR:0.16, EV:0.16, ATK:0.29, CD:0.45, MD:0.45, HP:0.29, DF:0.29, DR:0.21}
  },
  purple5th: {
    // special purple rules by slot
    Helm:   ["Boss DMG","HP%"],
    Belt:   ["Boss DMG","HP%"],
    Necklace: ["Crit DMG"],
    Ring:   ["Crit DMG"],
    Chest:  ["ATK%"],
    Gloves: ["ATK%"],
    Boots:  ["ATK%"]
  },
  pets: {
    None:{AS:0, CR:0},
    B:{AS:0.08, CR:0.06},
    A:{AS:0.10, CR:0.09},
    S:{AS:0.12, CR:0.12}
  }
};
// ---- Helpers ----
function fmtPct(p){ return (p*100).toFixed(1) + '%'; }
function fmtSec(s){ return s.toFixed(3) + 's'; }

// ---- Core ----
function run(){
  const cls    = els.cls.value;
  const focus  = els.focus.value;
  const weap   = els.weap.value;       // weapon type
  const tier   = els.gearTier.value;   // gear tier
  const statColor = +els.col.value;
  const charMod   = +els.char.value;
  const guild     = (+els.guild.value||0)/100;
  const secret    = (+els.secret.value||0)/100;
  const target    = +els.target.value || 0.25;
  const fury      = (els.fury.checked && cls === 'Berserker') ? 1.25 : 1.0;

  const base = rules.baseInterval[weap][cls];
  const tierVals = rules.lineValues[tier];
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
      for (let quick=1; quick<=2; quick++){
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
    document.getElementById('slots').innerHTML = '';
    document.getElementById('totals').innerHTML = '';
    return;
  }

  renderCombo(cls, focus, weap, tier, base, target, best);
  renderSlots(cls, focus, tier, best);
  renderTotals(best);
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

function renderSlots(cls, focus, tier, best){
  const box = document.getElementById('slots');
  box.innerHTML = '';

  const tierVals = best.tierVals;
  const layout = {};
  for (const s of rules.slots) layout[s] = [];

  // reset counters
  best.critLines = 0;
  best.evaLines  = 0;
  best.drLines   = 0;

  // --- Weapon rules ---
  if (focus === "DPS") {
    layout['Weapon'] = (tier === "Primal")
      ? ["Cast Demon Lord","ATK%","Crit DMG"]
      : ["Cast Demon Lord","ATK%","Crit DMG","Monster DMG"];
  } else {
    layout['Weapon'] = (tier === "Primal")
      ? ["Cast Evasion","HP%","DEF%"]
      : ["Cast Evasion","HP%","DEF%","DR%"];
    if (tier !== "Primal") best.drLines++;
  }

  // --- ATK SPD allocation ---
  let asLeft = best.gearLines;
  for (const s of rules.slots){
    if (s!=="Weapon" && asLeft>0){
      layout[s].push("ATK SPD");
      asLeft--;
    }
  }

  // --- Per-slot normal stat priority ---
  for (const slot of rules.slots){
    if (slot === "Weapon") continue;

    // add 5th stat FIRST if Helm or Belt
    if (slot === "Helm" || slot === "Belt"){
      layout[slot].push("Boss DMG / HP%"); // display choice
    }

    // DPS priority
    if (focus === "DPS"){
      const dpsPriority = ["Crit Chance","ATK%","Crit DMG","Monster DMG"];
      for (const stat of dpsPriority){
        if (layout[slot].length < 5 && !layout[slot].includes(stat)){
          layout[slot].push(stat);
          if(stat==="Crit Chance") best.critLines++;
        }
      }
    }

    // Tank priority
    if (focus === "Tank"){
      const tankPriority = ["ATK SPD","Evasion","DR%","ATK%","Crit Chance"];
      for (const stat of tankPriority){
        if (layout[slot].length < 5 && !layout[slot].includes(stat)){
          layout[slot].push(stat);
          if(stat==="Evasion") best.evaLines++;
          if(stat==="DR%") best.drLines++;
          if(stat==="Crit Chance") best.critLines++;
        }
      }
    }

    // trim to 5 lines max (5th + 4 normals)
    layout[slot] = layout[slot].slice(0,5);
  }

  // --- Render ---
  for (const [slot,stats] of Object.entries(layout)){
    const div=document.createElement('div');
    div.className='slot';
    div.innerHTML=`<h3>${slot}</h3>`+stats.map(s=>`<div>- ${s}</div>`).join('');
    box.appendChild(div);
  }

  renderTotals(best);
}
