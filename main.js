
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

  const passiveAS = statColor + charMod + guild + secret;
  let best = null;

  const petOptions = Object.entries(rules.pets);

  // Pass 1: try WITHOUT quicken
  for (let rune=0; rune<=6; rune++){
    for (const [petName,petAS] of petOptions){
      for (let gearLines=0; gearLines<=8; gearLines++){
        const totalAS = passiveAS + rune*0.01 + petAS + gearLines*tierVals.AS;
        const finalInterval = base * (1 - totalAS) * fury;
        if (finalInterval <= target){
          const requiredAS = 1 - (target / base);
          const waste = totalAS - requiredAS;
          if (!best || gearLines < best.gearLines || 
             (gearLines === best.gearLines && waste < best.waste - 1e-9)) {
            best = {gearLines,rune,petName,petAS,quick:0,totalAS,finalInterval,waste,tierVals,
                    critLines:0,evaLines:0,drLines:0};
          }
        }
      }
    }
  }

  // Pass 2: allow quicken (only if nothing worked)
  if (!best){
    for (let rune=0; rune<=6; rune++){
      for (const [petName,petAS] of petOptions){
        for (let quick=1; quick<=2; quick++){ // cap quicken at 2
          for (let gearLines=0; gearLines<=8; gearLines++){
            const totalAS = passiveAS + rune*0.01 + petAS + gearLines*tierVals.AS + quick*0.01;
            const finalInterval = base * (1 - totalAS) * fury;
            if (finalInterval <= target){
              const requiredAS = 1 - (target / base);
              const waste = totalAS - requiredAS;
              if (!best || gearLines < best.gearLines ||
                 (gearLines === best.gearLines && waste < best.waste - 1e-9)) {
                best = {gearLines,rune,petName,petAS,quick,totalAS,finalInterval,waste,tierVals,
                        critLines:0,evaLines:0,drLines:0};
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

  // --- Attack Speed ---
  const asGear = best.gearLines * tierVals.AS;
  const asRune = best.rune * 0.01;      
  const asPet  = best.petAS || 0;
  const asQuick = (best.quick || 0) * 0.01;

  const asGearRune = asGear + asRune;
  const asFinal = asGear + asRune + asPet + asQuick;
  const asWaste = Math.max(0, asGearRune - (1 - (best.finalInterval / (best.base || 1))));

  // --- Crit Chance ---
  const critFromGear = best.critLines * tierVals.CR; 
  const critFromRune = best.critRune || 0; 
  const critGearRune = Math.min(critFromGear + critFromRune, rules.caps.critFromGearRune);
  const critWaste    = (critFromGear + critFromRune) - rules.caps.critFromGearRune;
  const critWithPet  = critGearRune + (best.critPet || 0);

  // --- Evasion ---
  const evaFromGear = best.evaLines * tierVals.EV;
  const evaFromRune = best.evaRune || 0;
  const evaGearRune = Math.min(evaFromGear + evaFromRune, rules.caps.evaFromGearRune);
  const evaWaste    = (evaFromGear + evaFromRune) - rules.caps.evaFromGearRune;

  // --- DR% ---
  const drFromGear = best.drLines * tierVals.DR;
  const drFromRune = best.drRune || 0;
  const drGearRune = Math.min(drFromGear + drFromRune, rules.caps.drFromGearRune);
  const drWaste    = (drFromGear + drFromRune) - rules.caps.drFromGearRune;

  const html = `
    <h3>Totals</h3>
    <div>Attack Speed (gear+rune) = ${(asGearRune*100).toFixed(1)}%</div>
        ${asWaste>0 ? `(waste ${(asWaste*100).toFixed(1)}%)` : ''}</div>
    <div>Crit Chance (gear+rune) = ${(critGearRune*100).toFixed(1)}%
        ${critWaste>0 ? `(waste ${(critWaste*100).toFixed(1)}%)` : ''}</div>
    <div>Crit Chance + Pet = ${(critWithPet*100).toFixed(1)}%</div>
    <div>Evasion (gear+rune) = ${(evaGearRune*100).toFixed(1)}%
        ${evaWaste>0 ? `(waste ${(evaWaste*100).toFixed(1)}%)` : ''}</div>
    <div>DR% (gear+rune) = ${(drGearRune*100).toFixed(1)}%
        ${drWaste>0 ? `(waste ${(drWaste*100).toFixed(1)}%)` : ''}</div>
  `;

  box.innerHTML = html;
}
