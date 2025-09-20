// ==========================
// Rediscover Optimizer v4 (dynamic, 5th-stat-first)
// ==========================

const els = {};
window.addEventListener('DOMContentLoaded', () => {
  const q = id => document.getElementById(id);
  ['cls','focus','weap','gearTier','col','char','guild','secret','target','fury']
    .forEach(id => els[id] = q(id));
  els.runBtn = document.getElementById('runBtn');
  els.runBtn.addEventListener('click', run);
});

// ---------- Rules ----------
const rules = {
  slots: ["Weapon","Necklace","Helm","Chest","Gloves","Boots","Belt","Ring"],
  caps: {
    critFromGearRune: 0.50,  // gear+rune crit cap
    evaFromGearRune: 0.40,   // gear+rune evasion cap
    drFromGearRune: 1.00,    // gear+rune DR cap
    critTotal: 1.00          // crit+pet hard cap
  },
  // Base interval by weapon tier
  baseInterval: {
    Original:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Primal:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Chaos:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Abyss:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    "PvP/Boss":{Berserker:2.2,Paladin:2.5,Ranger:2.0,Sorcerer:2.3}
  },
  // Correct per-line values you gave
  lineValues: {
    Primal:   {AS:0.12, CR:0.12, EV:0.12, ATK:0.23, CD:0.35, MD:0.35, HP:0.23, DF:0.23, DR:0.14},
    Original: {AS:0.12, CR:0.12, EV:0.12, ATK:0.23, CD:0.35, MD:0.35, HP:0.23, DF:0.23, DR:0.17},
    Chaos:    {AS:0.14, CR:0.14, EV:0.14, ATK:0.26, CD:0.40, MD:0.40, HP:0.26, DF:0.26, DR:0.19},
    Abyss:    {AS:0.16, CR:0.16, EV:0.16, ATK:0.29, CD:0.45, MD:0.45, HP:0.29, DF:0.29, DR:0.21}
  },
  // “Purple 5th” rules: display only, applied at top of slot
  purple5th: {
    Weapon: {Chaos:true, Abyss:true, label:"Crit DMG (5th 80%)"},
    Necklace: {all:true, label:"Crit DMG (5th)"},
    Ring:     {all:true, label:"Crit DMG (5th)"},
    Helm:     {all:true, label:"Boss DMG / HP% (5th)"},
    Belt:     {all:true, label:"Boss DMG / HP% (5th)"}
  },
  // Pet options (AS and Crit)
  pets: {
    None:{AS:0.00, CR:0.00},
    B:{AS:0.06, CR:0.06},
    A:{AS:0.09, CR:0.09},
    S:{AS:0.12, CR:0.12}
  }
};

const fmtPct = p => (p*100).toFixed(1) + '%';
const fmtSec = s => s.toFixed(3) + 's';

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
  const fury      = (els.fury.checked && cls === 'Berserker') ? 1.25 : 1.0;

  const base = rules.baseInterval[weap][cls];
  const tierVals = rules.lineValues[tier];
  const passiveAS = statColor + charMod + guild + secret;

  let best = null;
  const petOptions = Object.entries(rules.pets);

  // Try WITHOUT quicken first
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
          if (!best || gearLines < best.gearLines || (gearLines === best.gearLines && waste < best.waste - 1e-9)){
            best = {gearLines,rune,quick:0, petName,petAS,critPet:petCR, totalAS,finalInterval,waste,
                    tierVals, critLines:0, evaLines:0, drLines:0};
          }
        }
      }
    }
  }
  // If no valid combo, allow quicken (Lv1–2) as last resort
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
              if (!best || gearLines < best.gearLines || (gearLines === best.gearLines && waste < best.waste - 1e-9)){
                best = {gearLines,rune,quick, petName,petAS,critPet:petCR, totalAS,finalInterval,waste,
                        tierVals, critLines:0, evaLines:0, drLines:0};
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

// ---------- Summary ----------
function renderCombo(cls,focus,weap,tier,base,target,best){
  const sum = document.getElementById('summary');
  sum.innerHTML = `
    <h3>Optimal Combo</h3>
    <div>${cls} (${focus}) | Weapon: ${weap} | Gear: ${tier}</div>
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

// ---------- Slots (dynamic fill, 5th stat first) ----------
function renderSlots(cls,focus,tier,best){
  const box = document.getElementById('slots');
  box.innerHTML = '';

  const tierVals = best.tierVals;
  const layout = {};
  for (const s of rules.slots) layout[s] = [];

  // reset counters for totals
  best.critLines = 0;
  best.evaLines  = 0;
  best.drLines   = 0;

  // 5th stat at the TOP where applicable
  if (rules.purple5th.Weapon && (tier==="Chaos" || tier==="Abyss")) layout['Weapon'].push("Crit DMG (5th 80%)");
  if (rules.purple5th.Necklace) layout['Necklace'].push("Crit DMG (5th)");
  if (rules.purple5th.Ring)     layout['Ring'].push("Crit DMG (5th)");
  layout['Helm'].push("Boss DMG / HP% (5th)");
  layout['Belt'].push("Boss DMG / HP% (5th)");

  // Weapon baseline after 5th stat (if any)
  if (focus === "DPS") {
    if (tier === "Primal" || tier === "Original") {
      layout['Weapon'].push("Cast Demon Lord","ATK%","Crit DMG","Monster DMG");
    } else {
      layout['Weapon'].push("Cast Demon Lord","ATK%","Crit DMG","Monster DMG");
      // already has 5th on top for Chaos/Abyss
    }
  } else { // Tank
    if (tier === "Primal" || tier === "Original") {
      layout['Weapon'].push("Cast Evasion","HP%","DEF%");
    } else {
      layout['Weapon'].push("Cast Evasion","HP%","DEF%","DR%");
      best.drLines += 1; // DR on tank weapon
    }
  }

  // Assign ATK SPD lines from the optimizer output
  let asLeft = best.gearLines;
  for (const s of rules.slots){
    if (s!=="Weapon" && asLeft>0){
      layout[s].push("ATK SPD");
      asLeft--;
    }
  }

  // Dynamic fill per slot
  // First Crit (DPS) or Evasion (Tank) up to caps, then DR for Tank, then filler
  let critAccum = 0, evaAccum = 0, drAccum = 0;

  const canAdd = (slot, stat) => layout[slot].length < ((tier==="Chaos"||tier==="Abyss") ? 5 : 4) && !layout[slot].includes(stat);

  for (const slot of rules.slots){
    if (slot === "Weapon") continue;

    // Crit (DPS-first priority)
    if (focus==="DPS"){
      if (!layout[slot].includes("ATK SPD") && (critAccum + tierVals.CR) <= rules.caps.critFromGearRune && canAdd(slot,"Crit Chance")){
        layout[slot].push("Crit Chance");
        critAccum += tierVals.CR;
        best.critLines += 1;
      }
    }

    // Evasion (Tank-first priority)
    if (focus==="Tank"){
      if (!layout[slot].includes("ATK SPD") &&
          (evaAccum + tierVals.EV) <= rules.caps.evaFromGearRune &&
          canAdd(slot,"Evasion")){
        layout[slot].push("Evasion");
        evaAccum += tierVals.EV;
        best.evaLines += 1;
      }
    }
  }

  // DR for Tanks up to 100% with minimal waste
  if (focus==="Tank"){
    for (const slot of rules.slots){
      if (slot==="Weapon") continue;
      if (canAdd(slot,"DR%") && drAccum + tierVals.DR <= rules.caps.drFromGearRune){
        layout[slot].push("DR%");
        drAccum += tierVals.DR;
        best.drLines += 1;
      }
    }
  }

  // Secondary pass: fill remaining with priorities
  for (const slot of rules.slots){
    if (slot==="Weapon") continue;
    const capacity = (tier==="Chaos"||tier==="Abyss") ? 5 : 4;

    const filler = (focus==="DPS")
      ? ["ATK%","Crit DMG","Monster DMG"]
      : ["HP%","DEF%","ATK%","Crit Chance"]; // crit last for tanks

    // For DPS, after crit pass, try another crit if still under cap and slot space remains
    if (focus==="DPS"){
      while (layout[slot].length < capacity &&
             !layout[slot].includes("ATK SPD") &&
             (critAccum + tierVals.CR) <= rules.caps.critFromGearRune){
        if (!layout[slot].includes("Crit Chance")){
          layout[slot].push("Crit Chance");
          critAccum += tierVals.CR;
          best.critLines += 1;
        } else break;
      }
    }

    // Fill leftover with priorities
    for (const stat of filler){
      if (layout[slot].length >= capacity) break;
      if (!layout[slot].includes(stat)){
        layout[slot].push(stat);
        if (stat==="Crit Chance") best.critLines += 1;
        if (stat==="Evasion")     best.evaLines  += 1;
        if (stat==="DR%")         best.drLines   += 1;
      }
    }

    // Trim to capacity just in case
    layout[slot] = layout[slot].slice(0, capacity);
  }

  // Render slots
  const box = document.getElementById('slots');
  box.innerHTML = '';
  for (const [slot,stats] of Object.entries(layout)){
    const div = document.createElement('div');
    div.className = 'slot';
    div.innerHTML = `<h3>${slot}</h3>` + stats.map(s => `<div>- ${s}</div>`).join('');
    box.appendChild(div);
  }
}

// ---------- Totals (gear+rune shown; pet only added to crit-with-pet) ----------
function renderTotals(best){
  const box = document.getElementById('totals');
  box.innerHTML = '';

  const t = best.tierVals;

  // Attack Speed (gear+rune only)
  const asGear = best.gearLines * t.AS;
  const asRune = best.rune * 0.01;
  const totalAS = asGear + asRune;

  // Crit Chance
  const critFromLines = best.critLines * t.CR;
  const critGearRune  = Math.min(critFromLines, rules.caps.critFromGearRune);
  const critWaste     = Math.max(0, critFromLines - rules.caps.critFromGearRune);
  const critWithPet   = Math.min(critGearRune + (best.critPet || 0), rules.caps.critTotal);

  // Evasion
  const evaFromLines = best.evaLines * t.EV;
  const evaGearRune  = Math.min(evaFromLines, rules.caps.evaFromGearRune);
  const evaWaste     = Math.max(0, evaFromLines - rules.caps.evaFromGearRune);

  // DR
  const drFromLines = best.drLines * t.DR;
  const drGearRune  = Math.min(drFromLines, rules.caps.drFromGearRune);
  const drWaste     = Math.max(0, drFromLines - rules.caps.drFromGearRune);

  // Purple “5th” bonuses for Chaos/Abyss shown separately
  const isChaosAbyss = (t.AS === 0.14 || t.AS === 0.16);
  const purpleATK = isChaosAbyss ? 3 * t.ATK : 0;      // Chest/Gloves/Boots
  const purpleCD  = isChaosAbyss ? 2 * t.CD  : 0;      // Necklace/Ring
  const purpleHP  = isChaosAbyss ? 2 * t.HP  : 0;      // Helm/Belt (the alternative to Boss DMG)
  // Boss DMG is displayed as alternative; not added to Monster DMG total.

  box.innerHTML = `
    <h3>Totals</h3>
    <div>Attack Speed (gear+rune) = ${(totalAS*100).toFixed(1)}%</div>
    <div>Crit Chance (gear+rune) = ${(critGearRune*100).toFixed(1)}% ${critWaste>0 ? `(waste ${(critWaste*100).toFixed(1)}%)` : ''}</div>
    <div>Crit Chance + Pet = ${(critWithPet*100).toFixed(1)}%</div>
    <div>Evasion (gear+rune) = ${(evaGearRune*100).toFixed(1)}% ${evaWaste>0 ? `(waste ${(evaWaste*100).toFixed(1)}%)` : ''}</div>
    <div>DR% (gear+rune) = ${(drGearRune*100).toFixed(1)}% ${drWaste>0 ? `(waste ${(drWaste*100).toFixed(1)}%)` : ''}</div>
    <hr/>
    <div>ATK% (incl. purple) = ${((best.atkLines||0)*t.ATK + purpleATK)*100}%</div>
    <div>Crit DMG (incl. purple) = ${((best.cdLines||0)*t.CD + purpleCD).toFixed(2)}</div>
    <div>Monster DMG (gear) = ${((best.mdLines||0)*t.MD)*100}%</div>
    <div>Boss DMG (5th on Helm/Belt) = shown as choice vs HP%</div>
    <div>HP% (incl. purple) = ${((best.hpLines||0)*t.HP + purpleHP)*100}%</div>
    <div>DEF% = ${((best.dfLines||0)*t.DF)*100}%</div>
  `;
}