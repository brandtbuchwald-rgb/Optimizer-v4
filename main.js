// ==========================
// Rediscover Optimizer v4 — Final (always outputs)
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
  caps: { critFromGearRune:0.50, evaFromGearRune:0.40, drFromGearRune:1.00, critTotal:1.00 },
  baseInterval: {
    Original:{Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Primal:  {Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Chaos:   {Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    Abyss:   {Berserker:2.0,Paladin:2.4,Ranger:1.8,Sorcerer:2.2},
    "PvP/Boss":{Berserker:2.2,Paladin:2.5,Ranger:2.0,Sorcerer:2.3}
  },
  lineValues: {
    Primal:   {AS:0.12,CR:0.12,EV:0.12,ATK:0.23,CD:0.35,MD:0.35,HP:0.23,DF:0.23,DR:0.14},
    Original: {AS:0.12,CR:0.12,EV:0.12,ATK:0.23,CD:0.35,MD:0.35,HP:0.23,DF:0.23,DR:0.17},
    Chaos:    {AS:0.14,CR:0.14,EV:0.14,ATK:0.26,CD:0.40,MD:0.40,HP:0.26,DF:0.26,DR:0.19},
    Abyss:    {AS:0.16,CR:0.16,EV:0.16,ATK:0.29,CD:0.45,MD:0.45,HP:0.29,DF:0.29,DR:0.21}
  },
  purple5th: {
    WeaponDPS:"Crit DMG (5th +80)", WeaponTank:"HP% (5th +52%)",
    Necklace:"Crit DMG (5th)", Ring:"Crit DMG (5th)",
    Helm:"Boss DMG / HP% (5th)", Belt:"Boss DMG / HP% (5th)",
    Chest:"ATK% (5th)", Gloves:"ATK% (5th)", Boots:"ATK% (5th)"
  },
  pets: { None:{AS:0,CR:0}, B:{AS:0.06,CR:0.06}, A:{AS:0.09,CR:0.09}, S:{AS:0.12,CR:0.12} },
  weaponPool: {
    common:["ATK%","Crit DMG","DEF%","HP%","Damage Reduction","Monster DMG"],
    castDPS:{chaos:"Cast Demon Lord (19%)",normal:"Cast Demon Lord (17%)"},
    castTank:{chaos:"Cast Evasion (19%)",normal:"Cast Evasion (17%)"}
  }
};

const fmtPct = p=>(p*100).toFixed(1)+'%';
const fmtSec = s=>s.toFixed(3)+'s';

// ---------- Core ----------
function run(){
  const cls=els.cls.value, focus=els.focus.value, weap=els.weap.value, tier=els.gearTier.value;
  const statColor=+els.col.value, charMod=+els.char.value;
  const guild=(+els.guild.value||0)/100, secret=(+els.secret.value||0)/100;
  const target=+els.target.value||0.25;
  const fury=(els.fury.checked&&cls==="Berserker")?1.25:1.0;

  const base=rules.baseInterval[weap][cls], tVals=rules.lineValues[tier];
  const passiveAS=statColor+charMod+guild+secret;
  let best=null;

  const tryCombos=(allowQuick)=>{
    for(let rune=0;rune<=6;rune++){
      for(const [petName,petStats] of Object.entries(rules.pets)){
        for(let quick=0;quick<=(allowQuick?2:0);quick++){
          for(let gearLines=0;gearLines<=8;gearLines++){
            const totalAS=passiveAS+rune*0.01+petStats.AS+quick*0.01+gearLines*tVals.AS;
            const interval=base*(1-totalAS)*fury;
            if(interval<=target){
              const req=1-(target/base), waste=totalAS-req;
              if(!best||gearLines<best.gearLines||(gearLines===best.gearLines&&waste<best.waste)){
                best={gearLines,rune,quick,petName,petAS:petStats.AS,critPet:petStats.CR,
                      totalAS,finalInterval:interval,waste,tierVals:tVals,
                      critLines:0,evaLines:0,drLines:0,atkLines:0,cdLines:0,mdLines:0,hpLines:0,dfLines:0};
              }
            }
          }
        }
      }
    }
  };

  tryCombos(false);
  if(!best) tryCombos(true);

  renderCombo(cls,focus,weap,tier,base,target,best);
  renderSlots(cls,focus,tier,best);
  renderTotals(focus,tier,best);
}

// ---------- Summary ----------
function renderCombo(cls,focus,weap,tier,base,target,best){
  document.getElementById('summary').innerHTML=`
    <h3>Optimal Combo</h3>
    <div>${cls} (${focus}) | Weapon: ${weap} | Gear: ${tier}</div>
    <div>Base Interval: ${fmtSec(base)} → Target: ${fmtSec(target)}</div>
    <ul>
      <li>${best.gearLines} ATK SPD line(s)</li>
      <li>Rune ${best.rune}%</li>
      <li>Pet ${best.petName} (AS ${fmtPct(best.petAS)}, Crit ${fmtPct(best.critPet||0)})</li>
      ${best.quick?`<li>Quicken Lv ${best.quick} (${fmtPct(best.quick*0.01)})</li>`:""}
    </ul>
    <div>Total AS = ${fmtPct(best.totalAS)} → Interval ${fmtSec(best.finalInterval)}</div>
    <hr/>
  `;
}

// ---------- Slots ----------
function renderSlots(cls,focus,tier,best){
  const box=document.getElementById('slots'); box.innerHTML='';
  const t=best.tierVals,isCA=(tier==="Chaos"||tier==="Abyss");
  const valMap={"ATK%":t.ATK,"Crit DMG":t.CD,"Monster DMG":t.MD,"HP%":t.HP,"DEF%":t.DF,
                "Evasion":t.EV,"Crit Chance":t.CR,"ATK SPD":t.AS,"DR%":t.DR};
  const statLabel=s=>valMap[s]?`${s} +${(valMap[s]*100).toFixed(0)}%`:s;

  const layout={}; for(const s of rules.slots) layout[s]=[];

  // Purples
  if(isCA){
    layout['Weapon'].push(focus==="DPS"?rules.purple5th.WeaponDPS:rules.purple5th.WeaponTank);
    layout['Necklace'].push(rules.purple5th.Necklace); layout['Ring'].push(rules.purple5th.Ring);
    layout['Helm'].push(rules.purple5th.Helm); layout['Belt'].push(rules.purple5th.Belt);
    layout['Chest'].push(rules.purple5th.Chest); layout['Gloves'].push(rules.purple5th.Gloves);
    layout['Boots'].push(rules.purple5th.Boots);
  }

  // Weapon
  const cast=(focus==="DPS")?(isCA?rules.weaponPool.castDPS.chaos:rules.weaponPool.castDPS.normal)
                            :(isCA?rules.weaponPool.castTank.chaos:rules.weaponPool.castTank.normal);
  layout['Weapon'].push(cast);

  // Assign AS
  let asLeft=best.gearLines;
  for(const s of rules.slots){ if(s!=="Weapon"&&asLeft>0){ layout[s].push("ATK SPD"); asLeft--; } }

  // Fill
  let crit=0,eva=0,dr=0;
  const add=(slot,stat)=>{layout[slot].push(stat);
    if(stat==="Crit Chance")best.critLines++;
    if(stat==="Evasion")best.evaLines++;
    if(stat==="DR%")best.drLines++;
    if(stat==="ATK%")best.atkLines++;
    if(stat==="Crit DMG")best.cdLines++;
    if(stat==="Monster DMG")best.mdLines++;
    if(stat==="HP%")best.hpLines++;
    if(stat==="DEF%")best.dfLines++;
  };
  const orderDPS=["Crit Chance","Evasion","ATK%","Crit DMG","Monster DMG","HP%","DEF%"];
  const orderTank=["Evasion","DR%","Crit Chance","HP%","DEF%","ATK%","Crit DMG"];

  for(const slot of rules.slots){
    if(slot==="Weapon")continue;
    const order=(focus==="DPS")?orderDPS:orderTank, cap=(isCA?5:4);
    for(const stat of order){
      const over=(stat==="Crit Chance"&&crit+t.CR>rules.caps.critFromGearRune)||
                 (stat==="Evasion"&&eva+t.EV>rules.caps.evaFromGearRune)||
                 (stat==="DR%"&&dr+t.DR>rules.caps.drFromGearRune);
      if(over)continue;
      if(layout[slot].length<cap){
        add(slot,stat);
        if(stat==="Crit Chance")crit+=t.CR;
        if(stat==="Evasion")eva+=t.EV;
        if(stat==="DR%")dr+=t.DR;
      }
    }
  }

  // Render
  for(const [slot,stats] of Object.entries(layout)){
    const div=document.createElement('div'); div.className='slot';
    div.innerHTML=`<h3>${slot}</h3>`+stats.map(s=>`<div>- ${statLabel(s)}</div>`).join('');
    box.appendChild(div);
  }
}

// ---------- Totals ----------
function renderTotals(focus,tier,best){
  const box=document.getElementById('totals'),t=best.tierVals;
  const atk=(best.atkLines*t.ATK)*100, cd=(best.cdLines*t.CD).toFixed(2),
        md=(best.mdLines*t.MD)*100, hp=(best.hpLines*t.HP)*100, df=(best.dfLines*t.DF)*100,
        eva=(best.evaLines*t.EV)*100, dr=(best.drLines*t.DR)*100, crit=(best.critLines*t.CR)*100;
  box.innerHTML=`
    <h3>Equipment Stats</h3>
    <div>Attack Speed = ${(best.totalAS*100).toFixed(1)}%</div>
    <div>Attack = ${atk.toFixed(0)}%</div>
    <div>Crit Chance = ${crit.toFixed(0)}%</div>
    <div>Crit Chance + Pet = ${((crit/100)+(best.critPet||0))*100}%</div>
    <div>Crit Damage = ${cd}</div>
    <div>Evasion = ${eva.toFixed(0)}%</div>
    <div>DR% = ${dr.toFixed(0)}%</div>
    <div>HP% = ${hp.toFixed(0)}%</div>
    <div>DEF% = ${df.toFixed(0)}%</div>
    <div>Monster DMG = ${md.toFixed(0)}%</div>
    <div>Boss DMG = shown as choice (Helm/Belt)</div>`;
}
