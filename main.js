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

// ---------- Master Rules (from Rediscover Build Generator 2.0 PDF) ----------
const rules = {
  // Render order
  slots: ["Weapon","Necklace","Helm","Chest","Gloves","Boots","Belt","Ring"],

  // Caps
  caps: {
    critFromGearRune: 0.50,  // gear + rune crit cap
    evaFromGearRune:  0.40,  // gear + rune evasion cap
    drFromGearRune:   1.00,  // gear + rune DR cap
    critTotal:        1.00   // crit hard cap incl. pet
  },

  // Base interval by weapon tier (class specific)
  baseInterval: {
    Original:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Primal:  {Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Chaos:   {Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Abyss:   {Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    "PvP/Boss":{Berserker:2.2,Paladin:2.5,Ranger:2.0,Sorcerer:2.3}
  },

  // Per-line values by gear tier
  lineValues: {
    Primal:   {AS:0.12, CR:0.12, EV:0.12, ATK:0.23, CD:0.35, MD:0.35, HP:0.23, DF:0.23, DR:0.14},
    Original: {AS:0.12, CR:0.12, EV:0.12, ATK:0.23, CD:0.35, MD:0.35, HP:0.23, DF:0.23, DR:0.17},
    Chaos:    {AS:0.14, CR:0.14, EV:0.14, ATK:0.26, CD:0.40, MD:0.40, HP:0.26, DF:0.26, DR:0.19},
    Abyss:    {AS:0.16, CR:0.16, EV:0.16, ATK:0.29, CD:0.45, MD:0.45, HP:0.29, DF:0.29, DR:0.21}
  },

  // Purple (5th) rules per slot
  purple5thLabels: {
    Necklace: "Crit DMG (5th)",
    Ring:     "Crit DMG (5th)",
    Helm:     "Boss DMG / HP% (5th)",
    Belt:     "Boss DMG / HP% (5th)",
    WeaponDPS: "Crit DMG (5th +80)",
    WeaponTank: "HP% (5th +52%)",
    Chest:   "ATK% (5th)",
    Gloves:  "ATK% (5th)",
    Boots:   "ATK% (5th)"
  },

  // Pet options
  pets: {
    None:{AS:0.00, CR:0.00},
    B:{AS:0.06, CR:0.06},
    A:{AS:0.09, CR:0.09},
    S:{AS:0.12, CR:0.12}
  },

  // Weapon stat pools (no AS/CR/EV on weapons)
  // Note: Cast values differ by Chaos/Abyss vs others
  weaponPool: {
    common: ["ATK%","Crit DMG","DEF%","HP%","Damage Reduction","Monster DMG"],
    castDPS: { chaosAbyss: "Cast Demon Lord (19%)", normal: "Cast Demon Lord (17%)" },
    castTank:{ chaosAbyss: "Cast Evasion (19%)",    normal: "Cast Evasion (17%)"   }
  }
};

const fmtPct = p => (p*100).toFixed(1) + '%';
const fmtSec = s => s.toFixed(3) + 's';
// Wrap purple 5th stats in purple span
const purple = txt => `<span class="purple-stat">${txt}</span>`;
// ---------- Core ----------
function run(){
  const cls    = els.cls.value;
  const focus  = els.focus.value;   // DPS | Tank
  const weap   = els.weap.value;    // tier for base speed incl. PvP/Boss
  const tier   = els.gearTier.value;// tier for line values
  const statColor = +els.col.value; // 0, .10, .20, .30
  const charMod   = +els.char.value;// -0.10, 0, .07, .10
  const guild     = (+els.guild.value||0)/100;
  const secret    = (+els.secret.value||0)/100;
  const target    = +els.target.value || 0.25;
  const furyMult  = (els.fury.checked && cls === 'Berserker') ? 1.25 : 1.0;

  const base = rules.baseInterval[weap][cls];
  const tierVals = rules.lineValues[tier];

  // Passive AS that is not gear/rune
  const passiveAS = statColor + charMod + guild + secret;

  // brute force search: minimal gear AS lines first, then minimal waste
  let best = null;
  const petOptions = Object.entries(rules.pets);

  // Pass 1: no Quicken
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
          if (!best || gearLines < best.gearLines || (gearLines === best.gearLines && waste < best.waste - 1e-9)){
            best = {
              gearLines, rune, quick:0, petName, petAS, critPet:petCR,
              totalAS, finalInterval, waste, tierVals,
              // counters for totals filled later
              critLines:0, evaLines:0, drLines:0, atkLines:0, cdLines:0, mdLines:0, hpLines:0, dfLines:0
            };
          }
        }
      }
    }
  }

  // Pass 2: allow Quicken 1–2 as last resort
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
              if (!best || gearLines < best.gearLines || (gearLines === best.gearLines && waste < best.waste - 1e-9)){
                best = {
                  gearLines, rune, quick, petName, petAS, critPet:petCR,
                  totalAS, finalInterval, waste, tierVals,
                  critLines:0, evaLines:0, drLines:0, atkLines:0, cdLines:0, mdLines:0, hpLines:0, dfLines:0
                };
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

// ---------- Slots (strict per PDF) ----------
function renderSlots(cls, focus, tier, best) {
  const box = document.getElementById('slots');
  box.innerHTML = '';

  const t = best.tierVals;
  const layout = {};
  for (const s of rules.slots) layout[s] = [];

  const isChaosAbyss = (tier === "Chaos" || tier === "Abyss");
  const capPerSlot = slot => isChaosAbyss ? 5 : 4;

  const canAdd = (slot, stat) =>
    layout[slot].length < capPerSlot(slot) && !layout[slot].includes(stat);

  // Map stat → value for this tier
  const valMap = {
    "ATK SPD": t.AS,
    "Crit Chance": t.CR,
    "Evasion": t.EV,
    "ATK%": t.ATK,
    "Crit DMG": t.CD,
    "Monster DMG": t.MD,
    "Boss DMG": t.BD,
    "HP%": t.HP,
    "DEF%": t.DF,
    "DR%": t.DR
  };

  // render helpers
  const statLabel = stat => `${stat} +${(valMap[stat] * 100).toFixed(0)}%`;
  const purpleLabel = stat => `<span class="purple-stat">${statLabel(stat)}</span>`;

  // 🔮 Add 5th stats for Chaos/Abyss
  if (isChaosAbyss) {
    layout['Weapon'].push(
      focus === "DPS"
        ? purpleLabel(rules.purple5thLabels.WeaponDPS)
        : purpleLabel(rules.purple5thLabels.WeaponTank)
    );
    layout['Necklace'].push(purpleLabel(rules.purple5thLabels.Necklace));
    layout['Ring'].push(purpleLabel(rules.purple5thLabels.Ring));
    layout['Helm'].push(purpleLabel(rules.purple5thLabels.Helm));
    layout['Belt'].push(purpleLabel(rules.purple5thLabels.Belt));
    layout['Chest'].push(purpleLabel(rules.purple5thLabels.Chest));
    layout['Gloves'].push(purpleLabel(rules.purple5thLabels.Gloves));
    layout['Boots'].push(purpleLabel(rules.purple5thLabels.Boots));
  }

  // 🟢 Existing logic (modified to use statLabel)

  // Weapon pool setup
  const castLabel = (focus==="DPS")
    ? (isChaosAbyss ? rules.weaponPool.castDPS.chaosAbyss : rules.weaponPool.castDPS.normal)
    : (isChaosAbyss ? rules.weaponPool.castTank.chaosAbyss : rules.weaponPool.castTank.normal);

  if (canAdd('Weapon', castLabel)) layout['Weapon'].push(castLabel);

  const weaponFillPriority = (focus==="DPS")
    ? ["ATK%","Crit DMG","Monster DMG","HP%","DEF%","DR%"]
    : ["HP%","DEF%","DR%","ATK%","Crit DMG","Monster DMG"];

  for (const stat of weaponFillPriority) {
    if (canAdd('Weapon', stat)) layout['Weapon'].push(statLabel(stat));
  }

  // ATK SPD distribution
  let asLeft = best.gearLines;
  for (const s of rules.slots) {
    if (s!=="Weapon" && asLeft>0) {
      if (canAdd(s,"ATK SPD")) {
        layout[s].push(statLabel("ATK SPD"));
        asLeft--;
      }
    }
  }

  // Crit/Eva/DR priorities
  let critAccum = 0, evaAccum = 0, drAccum = 0;

  const tryAddLine = (slot, stat) => {
    if (!canAdd(slot, stat)) return false;
    layout[slot].push(statLabel(stat));
    // track totals
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

  // Pass 1: capped stats
  for (const slot of rules.slots){
    if (slot==="Weapon") continue;
    const capacity = capPerSlot(slot);
    const hasAS = layout[slot].some(s => s.includes("ATK SPD"));

    if (focus==="DPS"){
      if ((critAccum + t.CR) <= rules.caps.critFromGearRune && !hasAS)
        if (tryAddLine(slot,"Crit Chance")) critAccum += t.CR;

      if ((evaAccum + t.EV) <= rules.caps.evaFromGearRune && !hasAS && layout[slot].length < capacity)
        if (tryAddLine(slot,"Evasion")) evaAccum += t.EV;
    } else {
      if ((evaAccum + t.EV) <= rules.caps.evaFromGearRune && !hasAS)
        if (tryAddLine(slot,"Evasion")) evaAccum += t.EV;

      if ((critAccum + t.CR) <= rules.caps.critFromGearRune && !hasAS && layout[slot].length < capacity)
        if (tryAddLine(slot,"Crit Chance")) critAccum += t.CR;

      if ((drAccum + t.DR) <= rules.caps.drFromGearRune && layout[slot].length < capacity)
        if (tryAddLine(slot,"DR%")) drAccum += t.DR;
    }
  }

  // Pass 2: filler
  const fillerOrderDPS  = ["Crit Chance","Evasion","ATK%","Crit DMG","Monster DMG","HP%","DEF%"];
  const fillerOrderTank = ["Evasion","Crit Chance","DR%","HP%","DEF%","ATK%","Crit DMG"];

  for (const slot of rules.slots){
    if (slot==="Weapon") continue;
    const capacity = capPerSlot(slot);
    const order = (focus==="DPS") ? fillerOrderDPS : fillerOrderTank;

    for (const stat of order){
      if (layout[slot].length >= capacity) break;
      if (stat==="Crit Chance" && (critAccum + t.CR) > rules.caps.critFromGearRune) continue;
      if (stat==="Evasion"     && (evaAccum  + t.EV) > rules.caps.evaFromGearRune)  continue;
      if (stat==="DR%"         && (drAccum   + t.DR) > rules.caps.drFromGearRune)   continue;

      if (tryAddLine(slot, stat)){
        if (stat==="Crit Chance") critAccum += t.CR;
        if (stat==="Evasion")     evaAccum  += t.EV;
        if (stat==="DR%")         drAccum   += t.DR;
      }
    }

    layout[slot] = layout[slot].slice(0, capacity);
  }

  // Render slots (purple already styled)
  for (const [slot, stats] of Object.entries(layout)) {
    const div = document.createElement('div');
    div.className = 'slot';
    div.innerHTML = `<h3>${slot}</h3>` + stats.map(s => `<div>- ${s}</div>`).join('');
    box.appendChild(div);
  }

  best._isChaosAbyss = isChaosAbyss;
  best._focus = focus;
}
// ---------- Totals (gear+rune shown; pet added to crit-with-pet; purple handled separately) ----------
function renderTotals(focus, tier, best){
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

  // Non-capped accumulations
  const atkFromLines = best.atkLines * t.ATK;
  const cdFromLines  = best.cdLines  * t.CD;
  const mdFromLines  = best.mdLines  * t.MD;
  const hpFromLines  = best.hpLines  * t.HP;
  const dfFromLines  = best.dfLines  * t.DF;

  // Purple “5th” bonuses for Chaos/Abyss shown and included where appropriate
  // Chest/Gloves/Boots → ATK% 5th (3 slots)
  // Necklace/Ring → Crit DMG 5th (2 slots)
  // Helm/Belt → HP% 5th alternative to Boss DMG (we’ll include HP% as one possible choice)
  // Weapon → DPS: +80 Crit DMG; Tank: +52% HP
  const isCA = best._isChaosAbyss;

  const purpleATK = isCA ? 3 * t.ATK : 0;      // chest/gloves/boots
  const purpleCD  = isCA ? 2 * t.CD  : 0;      // necklace/ring
  const purpleHP  = isCA ? 2 * t.HP  : 0;      // helm/belt (if choosing HP over Boss DMG)

  const weaponPurpleCD = isCA && best._focus==="DPS" ? 80 : 0; // flat +80 CD
  const weaponPurpleHP = isCA && best._focus==="Tank" ? 0.52 : 0; // +52% HP

  // Totals
  const totalATKpct = (atkFromLines + purpleATK) * 100;
  const totalCD     = (cdFromLines + purpleCD) + weaponPurpleCD; // CD is shown as scalar sum, your UI previously printed a raw number
  const totalMDpct  = (mdFromLines) * 100;
  const totalHPpct  = (hpFromLines + purpleHP + weaponPurpleHP) * 100;
  const totalDFpct  = (dfFromLines) * 100;

  box.innerHTML = `
    <h3>Totals</h3>
    <div>Attack Speed (gear + rune) = ${(totalAS*100).toFixed(1)}%</div>
    <div>Crit Chance (gear + rune) = ${(critGearRune*100).toFixed(1)}% ${critWaste>0 ? `(waste ${(critWaste*100).toFixed(1)}%)` : ''}</div>
    <div>Crit Chance + Pet = ${(critWithPet*100).toFixed(1)}%</div>
    <div>Evasion (gear + rune) = ${(evaGearRune*100).toFixed(1)}% ${evaWaste>0 ? `(waste ${(evaWaste*100).toFixed(1)}%)` : ''}</div>
    <div>DR% (gear + rune) = ${(drGearRune*100).toFixed(1)}% ${drWaste>0 ? `(waste ${(drWaste*100).toFixed(1)}%)` : ''}</div>
    <hr/>
    <div>ATK% (incl. purple ATK on Chest/Gloves/Boots) = ${totalATKpct.toFixed(1)}%</div>
    <div>Crit DMG (incl. purple on Weapon${isCA ? ', Necklace, Ring' : ''}) = ${totalCD.toFixed(2)}</div>
    <div>Monster DMG (gear) = ${totalMDpct.toFixed(1)}%</div>
    <div>Boss DMG (Helm/Belt 5th) = shown as choice vs HP%</div>
    <div>HP% (incl. purple on Helm/Belt and Tank Weapon) = ${totalHPpct.toFixed(1)}%</div>
    <div>DEF% = ${totalDFpct.toFixed(1)}%</div>
  `;
}
