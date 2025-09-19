// ===========================
// Rediscover Optimizer v4
// ===========================
// Chaos/Abyss purple 5th lines
// Buffs entered as %
// Totals section with clean breakdown

const els = {};
window.addEventListener('DOMContentLoaded', () => {
  const q = id => document.getElementById(id);
  [
    'cls','focus','weap','col','char','guild','secret','rune',
    'quicken','pet','target','fury',
    'line_atkspd','line_crit','line_eva','line_atk','line_cd',
    'line_md','line_hp','line_def','line_dr'
  ].forEach(id => els[id] = q(id));
  els.runBtn = document.getElementById('runBtn');

  els.runBtn.addEventListener('click', () => run(rules));
  run(rules);
});

// Hardcoded rules
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
  }
};

function pctNum(el){
  // User enters 5 for 5% → convert to 0.05
  const val = +el.value || 0;
  return Math.min(Math.max(val/100, -1), 5);
}
function fmtPct(p){ return (p*100).toFixed(1) + '%'; }
function fmtSec(s){ return s.toFixed(3) + 's'; }

function baseInterval(rules, weaponTier, cls){
  return rules.baseInterval[weaponTier][cls];
}

function requiredAtkSpdFraction({base, quicken, fury, target}){
  const denom = Math.max(base * (1 - quicken) * fury, 1e-9);
  const need = 1 - (target / denom);
  return Math.min(Math.max(need, 0), 0.95);
}

function run(rules){
  const cls    = els.cls.value;
  const focus  = els.focus.value;
  const weap   = els.weap.value;

  const statColor = +els.col.value;
  const charMod   = +els.char.value;
  const guild     = pctNum(els.guild);
  const secret    = pctNum(els.secret);
  const runeAS    = pctNum(els.rune);
  const quicken = (+els.quicken.value || 0) * 0.01;
  const petAS     = +els.pet.value;
  const target    = +els.target.value || 0.25;
  const fury      = (els.fury.checked && cls === 'Berserker') ? 1.25 : 1.0;

  const base = baseInterval(rules, weap, cls);
  const needAS = requiredAtkSpdFraction({base, quicken, fury, target});
  const passiveAS = statColor + charMod + guild + secret + runeAS + petAS;
  const needFromEquip = Math.max(0, needAS - passiveAS);

  // Pull line values from rules (gear tier specific)
  const tierVals = rules.lineValues[weap] || {};
  const line = {
    AS: tierVals.AS || +els.line_atkspd.value || 0.08,
    CR: tierVals.CR || +els.line_crit.value   || 0.16,
    EV: tierVals.EV || +els.line_eva.value    || 0.12,
    ATK: +els.line_atk.value    || 0.18,
    CD:  +els.line_cd.value     || 40,
    MD:  +els.line_md.value     || 0.18,
    HP:  +els.line_hp.value     || 0.20,
    DF:  +els.line_def.value    || 0.20,
    DR:  +els.line_dr.value     || 0.12
  };

  const slots = rules.slots.slice();
  const layout = {};
  for (const s of slots) layout[s] = [];

  // 1. Weapon
  allocateWeapon(layout, focus);

  // 2. Assign ATK SPD across slots until cap
  let asAccum = 0;
  const nonWeaponSlots = slots.filter(s => s !== "Weapon");
  for (const s of nonWeaponSlots){
    if (asAccum < needFromEquip){
      layout[s].push("ATK SPD");
      asAccum += line.AS;
    }
    if (asAccum >= needFromEquip) break;
  }

 // 3. Crit Chance until 50%
let critAccum = 0;
for (const s of nonWeaponSlots){
  if (!layout[s].includes("ATK SPD") && critAccum < rules.caps.critFromGearRune){
    layout[s].push("Crit Chance");
    critAccum += line.CR;
    if (critAccum >= rules.caps.critFromGearRune) break; // stop adding Crit completely
  }
}

// 4. Evasion until 40%
let evaAccum = 0;
for (const s of nonWeaponSlots){
  if (!layout[s].includes("ATK SPD") &&
      !layout[s].includes("Crit Chance") &&
      evaAccum < rules.caps.evaFromGearRune){
    layout[s].push("Evasion");
    evaAccum += line.EV;
    if (evaAccum >= rules.caps.evaFromGearRune) break; // stop adding Eva completely
  }
}
  // 5. Fill remaining with DPS/Tank priorities
  const filler = (focus === "DPS")
    ? ["ATK%","Crit DMG","Monster DMG"]
    : ["Evasion","HP%","DR%","DEF%","ATK%"];
  for (const s of nonWeaponSlots){
    while (layout[s].length < 4){
      for (const f of filler){
        if (layout[s].length < 4 && !layout[s].includes(f)){
          layout[s].push(f);
        }
      }
    }
  }

  // 6. Purple 5th line rules for Chaos/Abyss
  if (weap === "Chaos" || weap === "Abyss"){
    for (const s of nonWeaponSlots){
      if (s === "Ring" || s === "Necklace"){
        layout[s].push("Crit DMG (Purple)");
      } else if (["Chest","Gloves","Boots"].includes(s)){
        layout[s].push("ATK% (Purple)");
      } else if (s === "Helm" || s === "Belt"){
        if (focus === "DPS"){
          layout[s].push("Boss DMG (Purple)");
        } else {
          layout[s].push("HP% (Purple)");
        }
      }
    }
  }

  // 7. Compute totals
  const totalAS = Math.min(0.95, passiveAS + asAccum); // clamp
  const finalInterval = base * (1 - quicken) * fury * (1 - totalAS);

  // --- Totals calculation ---
  const totals = {AS:0, CR:0, EV:0, ATK:0, CD:0, MD:0, HP:0, DF:0, DR:0, Boss:0};
  for (const [slot, stats] of Object.entries(layout)){
    for (const s of stats){
      if (s === "ATK SPD") totals.AS += line.AS;
      if (s === "Crit Chance") totals.CR += line.CR;
      if (s === "Evasion") totals.EV += line.EV;
      if (s.startsWith("ATK%")) totals.ATK += line.ATK;
      if (s.startsWith("Crit DMG")) totals.CD += (s.includes("(Purple)") ? 80 : line.CD);
      if (s === "Monster DMG") totals.MD += line.MD;
      if (s.startsWith("HP%")) totals.HP += line.HP;
      if (s === "DEF%") totals.DF += line.DF;
      if (s === "DR%") totals.DR += line.DR;
      if (s.startsWith("Boss DMG")) totals.Boss += line.MD;
    }
  }

  // Equipment-only stat views
  const equipRunePetAS = asAccum + runeAS + petAS;
  const critEquipRune = Math.min(totals.CR + runeAS, rules.caps.critFromGearRune);
  const critWithPet = critEquipRune + petAS;
  const evaEquipRune = Math.min(totals.EV + runeAS, rules.caps.evaFromGearRune);

  renderSummary({cls, focus, weap, base, target, totalAS, needAS, finalInterval});
  renderSlots(layout);
  renderTotals({equipRunePetAS, critEquipRune, critWithPet, evaEquipRune, totals});
}

function allocateWeapon(layout, focus){
  if (focus === 'DPS') {
    layout['Weapon'] = ['ATK%','Crit DMG','Monster DMG','DR%','Cast Demon Lord'];
  } else {
    layout['Weapon'] = ['DR%','HP%','DEF%','ATK%','Cast Evasion'];
  }
}

function renderSummary(d){
  const sum = document.getElementById('summary');

  let intervalText;
  if (d.finalInterval <= d.target) {
    intervalText = `Cap reached: ${fmtSec(d.target)}`;
  } else {
    intervalText = `Current interval: ${fmtSec(d.finalInterval)}`;
  }

  sum.innerHTML = `
    <div><b>${d.cls}</b> (${d.focus}) | Tier: ${d.weap}</div>
    <div>Base Interval: ${fmtSec(d.base)} → Target: ${fmtSec(d.target)}</div>
    <div>Total AS: ${fmtPct(d.totalAS)} | Needed: ${fmtPct(d.needAS)}</div>
    <div>${intervalText}</div>
    <hr/>
  `;
}

function renderSlots(layout){
  const box = document.getElementById('slots');
  box.innerHTML = '';
  for (const [slot, stats] of Object.entries(layout)){
    const div = document.createElement('div');
    div.className = 'slot';
    div.innerHTML = `<h3>${slot}</h3>` +
      stats.map(s => `<span class="pill">${s}</span>`).join('');
    box.appendChild(div);
  }
}

function renderTotals(d){
  const box = document.getElementById('slots');
  const div = document.createElement('div');
  div.className = 'slot';
  div.innerHTML = `
    <h3>Totals</h3>
    <div>Attack Speed = ${fmtPct(d.equipRunePetAS)}</div>
    <div>Crit Chance = ${fmtPct(d.critEquipRune)} (Pet ${fmtPct(d.critWithPet)})</div>
    <div>Evasion = ${fmtPct(d.evaEquipRune)}</div>
    <div>Attack% = ${fmtPct(d.totals.ATK)}</div>
    <div>Crit DMG = ${d.totals.CD}</div>
    <div>Monster DMG = ${fmtPct(d.totals.MD)}</div>
    <div>HP% = ${fmtPct(d.totals.HP)}</div>
    <div>DEF% = ${fmtPct(d.totals.DF)}</div>
    <div>DR% = ${fmtPct(d.totals.DR)}</div>
    <div>Boss DMG = ${fmtPct(d.totals.Boss)}</div>
  `;
  box.appendChild(div);
}
