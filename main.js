
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

  // passive buffs (not included in gear totals)
  const passiveAS = statColor + charMod + guild + secret;

  let best = null;
  const petOptions = Object.entries(rules.pets);

  // 1) Try combos WITHOUT quicken first
  for (let rune=0; rune<=6; rune++){
    for (const [petName,petAS] of petOptions){
      for (let gearLines=0; gearLines<=8; gearLines++){
        const totalAS = passiveAS + rune*0.01 + petAS + gearLines*tierVals.AS;
        const finalInterval = base * (1 - totalAS) * fury;
        if (finalInterval <= target){
          const requiredAS = 1 - (target / base);
          const waste = totalAS - requiredAS;

          if (!best ||
              gearLines < best.gearLines ||
              (gearLines === best.gearLines && waste < best.waste - 1e-9)) {
            best = {
              gearLines,rune,quick:0,petName,petAS,totalAS,finalInterval,waste,
              tierVals,critLines:0,evaLines:0,drLines:0
            };
          }
        }
      }
    }
  }

  // 2) If no valid combo, allow Quicken as last resort
  if (!best){
    for (let rune=0; rune<=6; rune++){
      for (let quick=1; quick<=2; quick++){   // cap quicken at Lv2
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
                best = {
                  gearLines,rune,quick,petName,petAS,totalAS,finalInterval,waste,
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

  renderCombo(cls,focus,tier,base,target,best);
  renderSlots(cls,focus,tier,best);
}

// --- Totals ---
function renderTotals(best){
  const box = document.getElementById('totals');
  box.innerHTML = '';

  // Gear+rune AS only
  const asGear = best.gearLines * best.tierVals.AS;
  const asRune = best.rune * 0.01;
  const totalAS = asGear + asRune;

  // Crit Chance gear+rune (cap 50%)
  const critGearRune = Math.min(best.critLines * best.tierVals.CR, rules.caps.critFromGearRune);
  const critWaste = (critGearRune > rules.caps.critFromGearRune) ? critGearRune - rules.caps.critFromGearRune : 0;

  // Evasion gear+rune (cap 40%)
  const evaGearRune = Math.min(best.evaLines * best.tierVals.EV, rules.caps.evaFromGearRune);
  const evaWaste = (evaGearRune > rules.caps.evaFromGearRune) ? evaGearRune - rules.caps.evaFromGearRune : 0;

  // DR gear+rune (cap 100%)
  const drGearRune = Math.min(best.drLines * best.tierVals.DR, rules.caps.drFromGearRune);
  const drWaste = (drGearRune > rules.caps.drFromGearRune) ? drGearRune - rules.caps.drFromGearRune : 0;

  const html = `
    <h3>Totals</h3>
    <div>Attack Speed (gear+rune) = ${(totalAS*100).toFixed(1)}%</div>
    <div>Crit Chance (gear+rune) = ${(critGearRune*100).toFixed(1)}% ${critWaste>0 ? `(waste ${(critWaste*100).toFixed(1)}%)` : ''}</div>
    <div>Evasion (gear+rune) = ${(evaGearRune*100).toFixed(1)}% ${evaWaste>0 ? `(waste ${(evaWaste*100).toFixed(1)}%)` : ''}</div>
    <div>DR% (gear+rune) = ${(drGearRune*100).toFixed(1)}% ${drWaste>0 ? `(waste ${(drWaste*100).toFixed(1)}%)` : ''}</div>
  `;
  box.innerHTML = html;
}

// --- Render slot-by-slot ---
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

  // ---- Weapon Rules ----
  if (focus === "DPS") {
    if (tier === "Primal") {
      layout['Weapon'] = ["Cast Demon Lord","ATK%","Crit DMG"];
    } else {
      layout['Weapon'] = ["Cast Demon Lord","ATK%","Crit DMG","Monster DMG"];
    }
  } else { // Tank
    if (tier === "Primal") {
      layout['Weapon'] = ["Cast Evasion","HP%","DEF%"];
    } else {
      layout['Weapon'] = ["Cast Evasion","HP%","DEF%","DR%"];
      best.drLines += 1; // DR on tank weapon
    }
  }

  // ---- Assign ATK SPD lines ----
  let asLeft = best.gearLines;
  for (const s of rules.slots){
    if (s!=="Weapon" && asLeft>0){
      layout[s].push("ATK SPD");
      asLeft--;
    }
  }

  // ---- Crit Chance until cap ----
  let critAccum = 0;
  for (const s of rules.slots){
    if (s !== "Weapon" &&
        !layout[s].includes("ATK SPD") &&
        (critAccum + tierVals.CR) <= rules.caps.critFromGearRune){
      layout[s].push("Crit Chance");
      critAccum += tierVals.CR;
      best.critLines += 1;
    }
  }

  // ---- Evasion until cap ----
  let evaAccum = 0;
  for (const s of rules.slots){
    if (s !== "Weapon" &&
        !layout[s].includes("ATK SPD") &&
        !layout[s].includes("Crit Chance") &&
        (evaAccum + tierVals.EV) <= rules.caps.evaFromGearRune){
      layout[s].push("Evasion");
      evaAccum += tierVals.EV;
      best.evaLines += 1;
    }
  }

  // ---- DR% until 100% ----
  let drAccum = 0;
  for (const s of rules.slots){
    if (s !== "Weapon" &&
        drAccum + tierVals.DR <= rules.caps.drFromGearRune &&
        layout[s].length < 4){
      layout[s].push("DR%");
      drAccum += tierVals.DR;
      best.drLines += 1;
    }
  }

  // ---- Fill remaining ----
  let filler;
  if (focus==="DPS"){
    filler = ["ATK%","Crit DMG","Monster DMG"];
  } else {
    filler = ["DR%","HP%","DEF%","ATK%","Crit Chance"];
  }

  for (const s of rules.slots){
    while (layout[s].length < 4){
      for (const f of filler){
        if (layout[s].length < 4 && !layout[s].includes(f)){
          layout[s].push(f);
          if (f==="Crit Chance") best.critLines += 1;
          if (f==="Evasion") best.evaLines += 1;
          if (f==="DR%") best.drLines += 1;
        }
      }
    }
  }

  // ---- Output slot breakdown ----
  for (const [slot,stats] of Object.entries(layout)){
    const div=document.createElement('div');
    div.className='slot';
    div.innerHTML=`<h3>${slot}</h3>`+stats.map(s=>`<div>- ${s}</div>`).join('');
    box.appendChild(div);
  }

  // ---- Totals panel ----
  renderTotals(best);
}
