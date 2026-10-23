// Tests navigateur (Playwright + Chromium) : solo, sauvegardes, appel, zoom, menus, surchauffe, qualité,
// recycleur, coin pause, partie à deux (?net=fake) avec coupure, portrait. Captures dans tests/captures/.
// Prérequis : 1) lancer d'abord partie-complete.test.mjs (il crée tests/fixtures/*.json)
//             2) servir la racine du dépôt : python3 -m http.server 8765 --bind 127.0.0.1
// Usage : node two-supply-droides/tests/navigateur.test.cjs   → affiche « OK » à la fin (BASE=… pour une autre adresse).
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
const fs = require('fs');
const OUT = __dirname + '/captures/';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8765/two-supply-droides/';
const KEY = 'twosupply-droides-save-v04';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const L6 = fs.readFileSync(__dirname + '/fixtures/state-l6.json', 'utf8');
const L14 = fs.readFileSync(__dirname + '/fixtures/state-l14.json', 'utf8');
const LATE = fs.readFileSync(__dirname + '/fixtures/state-late.json', 'utf8');
const until = (p, fn, arg, ms = 15000) => p.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);
const assert = (c, m) => { if (!c) throw new Error('ÉCHEC : ' + m); console.log('  ok ·', m); };

(async () => {
  const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const mkctx = (w, h, dpr = 2) => browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  const watch = (p, name) => {
    p.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_PROXY|ERR_NAME/.test(m.text())) errors.push(name + ': ' + m.text()); });
    p.on('pageerror', (e) => errors.push(name + ' PAGEERROR: ' + e.message));
    return p;
  };
  const resume = async (p, save, how = '#btn-resume-solo') => {
    await p.goto(BASE + (how === '#btn-resume-duo' ? '?net=fake' : ''));
    await p.evaluate(([k, s]) => localStorage.setItem(k, s), [KEY, save]);
    await p.reload();
    await until(p, () => !document.getElementById('resume').hidden);
    await p.click(how);
  };

  // ---------- nouvelle partie solo ----------
  console.log('SOLO');
  const ctx = await mkctx(844, 390);
  const A = watch(await ctx.newPage(), 'solo');
  await A.goto(BASE);
  await A.evaluate(() => localStorage.clear());
  await A.reload();
  await sleep(300);
  assert(await A.evaluate(() => getComputedStyle(document.getElementById('resume')).display === 'none'), 'pas de bloc « Reprendre » sans sauvegarde');
  await A.click('#btn-solo');
  await A.waitForFunction(() => window.__ts && window.__ts.app.playing);
  assert(!(await A.evaluate(() => document.getElementById('screen-confirm').classList.contains('active'))), 'pas de confirmation sans sauvegarde');
  assert(await until(A, () => document.getElementById('save-tick').classList.contains('on'), null, 4000), '« Partie sauvegardée ✓ » au démarrage');
  await A.screenshot({ path: OUT + '00-sauvegarde-ok.png' });
  await A.click('#btn-go');
  await sleep(900);
  // Joystick au doigt (les gestes de zoom sont bloqués, le joystick doit toujours marcher)
  {
    const cdp = await ctx.newCDPSession(A);
    const x0 = await A.evaluate(() => [window.__ts.app.me.x, window.__ts.app.me.z]);
    const pt = (x, y, id = 0) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(150, 300)] });
    for (let k = 1; k <= 8; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(150 + k * 6, 300 - k * 5)] }); await sleep(40); }
    // deuxième doigt sur le bouton d'action pendant que le joystick est tenu
    const ab = await A.evaluate(() => { const r = document.getElementById('btn-action').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(198, 260), pt(ab[0], ab[1], 1)] });
    await sleep(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const x1 = await A.evaluate(() => [window.__ts.app.me.x, window.__ts.app.me.z]);
    assert(Math.hypot(x1[0] - x0[0], x1[1] - x0[1]) > 0.5, 'le joystick au doigt fait marcher (' + Math.hypot(x1[0] - x0[0], x1[1] - x0[1]).toFixed(1) + ' m)');
    assert(await A.evaluate(() => !window.visualViewport || window.visualViewport.scale === 1), 'pas de zoom de la page après joystick + bouton');
    // Secours : page zoomée → bouton « Recadrer l'écran » dans la partie visible
    // (Chromium sans écran ne zoome pas pour de vrai : on simule le zoom ×2 de Safari sur la zone visible)
    const fakeZoom = (on) => A.evaluate((on) => {
      const v = window.visualViewport;
      const vals = on ? { scale: 2, offsetLeft: 100, offsetTop: 50, width: 422, height: 195 } : { scale: 1, offsetLeft: 0, offsetTop: 0, width: innerWidth, height: innerHeight };
      for (const [k, x] of Object.entries(vals)) Object.defineProperty(v, k, { get: () => x, configurable: true });
      v.dispatchEvent(new Event('resize'));
    }, on);
    await fakeZoom(true);
    assert(await until(A, () => !document.getElementById('btn-unzoom').hidden, null, 4000), 'page zoomée : bouton « Recadrer l’écran »');
    const inView = await A.evaluate(() => { const r = document.getElementById('btn-unzoom').getBoundingClientRect(), v = window.visualViewport; return r.left >= v.offsetLeft - 1 && r.right <= v.offsetLeft + v.width + 1 && r.top >= v.offsetTop - 1 && r.bottom <= v.offsetTop + v.height + 1; });
    assert(inView, 'le bouton est dans la partie visible de l’écran zoomé');
    await A.screenshot({ path: OUT + '00b-zoom-secours.png' });
    await fakeZoom(false);
    assert(await until(A, () => document.getElementById('btn-unzoom').hidden, null, 4000), 'bouton masqué une fois dézoomé');
  }
  // Appel : le bord orange s'éteint quand on arrive sur place
  await A.evaluate(() => { window.__ts.tp(-4, 4); window.__ts.app.sim.fx.push({ to: 'A', k: 'call', text: 'Ton partenaire t’appelle !', x: 6, z: 4 }); });
  assert(await until(A, () => document.getElementById('call-flash').classList.contains('on'), null, 12000), 'appel : bord qui clignote');
  await sleep(2500);
  assert(await A.evaluate(() => document.getElementById('call-flash').classList.contains('on')), 'appel : le bord clignote toujours tant qu’on n’est pas venu');
  await A.evaluate(() => window.__ts.tp(5, 4));
  assert(await until(A, () => !document.getElementById('call-flash').classList.contains('on'), null, 12000), 'appel : le bord s’éteint une fois sur place');
  // … ou au bout de 15 secondes
  await A.evaluate(() => { window.__ts.tp(-4, 4); window.__ts.app.sim.fx.push({ to: 'A', k: 'call', text: 'Ton partenaire t’appelle !', x: 6, z: 4 }); });
  assert(await until(A, () => document.getElementById('call-flash').classList.contains('on'), null, 4000), 'deuxième appel');
  const tc = Date.now();
  assert(await until(A, () => !document.getElementById('call-flash').classList.contains('on'), null, 20000), 'le bord s’éteint seul');
  const waited = (Date.now() - tc) / 1000;
  assert(waited > 12 && waited < 17.5, 'au bout d’environ 15 s (' + waited.toFixed(1) + ' s)');
  assert(await A.evaluate(() => /Niveau 1\/20/.test(document.getElementById('level-name').textContent)), '20 niveaux');
  assert(await A.evaluate(() => !!document.getElementById('btn-team').offsetWidth && !!document.getElementById('btn-vest').offsetWidth), 'boutons Équipe et Vestiaire visibles');
  await A.screenshot({ path: OUT + '01-start.png' });
  await A.click('#btn-team');
  await until(A, () => document.getElementById('screen-usine').classList.contains('active'));
  await sleep(300);
  const locked = await A.evaluate(() => document.querySelectorAll('#usine-body .org-card.locked').length);
  assert(locked === 13, 'métiers sous cadenas au niveau 1 : ' + locked);
  await A.screenshot({ path: OUT + '02-equipe-cadenas.png' });
  await A.click('.tab[data-tab="vestiaire"]');
  await sleep(300);
  await A.screenshot({ path: OUT + '03-vestiaire-n1.png' });
  await A.click('#btn-usine-close');

  // Planche d'icônes (déclassés, rebuts, isolant, kits)
  await A.evaluate(async () => {
    const UI = await import('./js/ui.js');
    const C = await import('./js/config.js');
    const d = document.createElement('div');
    d.id = 'iconsheet';
    d.style.cssText = 'position:fixed;inset:0;z-index:99;background:#20252c;color:#fff;display:grid;grid-template-columns:repeat(10,1fr);gap:3px;padding:6px;font:600 8px Barlow,sans-serif;align-content:start;overflow:auto';
    d.innerHTML = Object.keys(C.ITEMS).map((k) => `<div style="display:flex;flex-direction:column;align-items:center;gap:1px;text-align:center">${UI.itemIcon(k).replace('class="mi"', 'class="mi" style="width:28px;height:28px"')}${C.ITEMS[k].name}</div>`).join('');
    document.body.appendChild(d);
  });
  await sleep(200);
  await A.screenshot({ path: OUT + '04-icones.png' });
  await A.evaluate(() => document.getElementById('iconsheet').remove());

  // Forge : seulement des carcasses
  await A.evaluate(async () => { const C = await import('./js/config.js'); window.__ts.forceBuild('forge'); const p = C.PLOTS.find((x) => x.id === 'forge'); window.__ts.tp(p.x, p.z + C.MACHINES.forge.d / 2 + 0.8); });
  assert(await until(A, () => document.getElementById('btn-ctx').textContent === 'Recettes'), 'bouton Recettes');
  await A.click('#btn-ctx');
  await until(A, () => document.getElementById('screen-recettes').classList.contains('active'));
  await sleep(300);
  const rows = await A.evaluate(() => [...document.querySelectorAll('#recettes-body .rrow b')].map((b) => b.textContent));
  assert(rows.every((t) => /Carcasse/.test(t)), 'la forge ne fait que des carcasses : ' + rows.join(', '));
  await A.screenshot({ path: OUT + '05-recettes-forge.png' });
  await A.click('#btn-recettes-close');

  // Bulle « à récupérer » visible de loin, et « +2 » quand un droïde sort
  await A.evaluate(() => { const S = window.__ts.app.sim; S.machines.forge.out = { carcasse: 2 }; window.__ts.tp(-4, 4); });
  assert(await until(A, () => [...document.querySelectorAll('#labels .outb')].some((e) => e.offsetParent !== null)), 'bulle à récupérer au-dessus de la forge');
  await A.evaluate(async () => {
    const C = await import('./js/config.js');
    window.__ts.forceBuild('assembleur');
    const S = window.__ts.app.sim; S.machines.assembleur.inp = { carcasse: 1, circuit: 1 };
    const p = C.PLOTS.find((x) => x.id === 'assembleur');
    window.__ts.tp(p.x, p.z + C.MACHINES.assembleur.d / 2 + 0.8);
    window.__ts.advance(11, true);
  });
  assert(await until(A, () => document.querySelectorAll('#labels .cred').length > 0, null, 4000), '« +2 crédits » au-dessus de l’assembleur');
  await A.screenshot({ path: OUT + '06-bulle-et-credits.png' });

  // ---------- sauvegardes : quitter, confirmation avant d'écraser ----------
  console.log('SAUVEGARDES');
  await A.click('#btn-usine');
  await until(A, () => document.getElementById('screen-usine').classList.contains('active'));
  assert(await A.evaluate(() => document.getElementById('btn-quit').textContent === 'Sauvegarder et quitter'), 'bouton « Sauvegarder et quitter » dans l’Usine');
  await A.screenshot({ path: OUT + '06b-usine-quitter.png' });
  await Promise.all([A.waitForNavigation(), A.click('#btn-quit')]);
  assert(await until(A, () => getComputedStyle(document.getElementById('resume')).display !== 'none' && /niveau 1\/20/.test(document.getElementById('resume-info').textContent)), 'retour à l’accueil avec la partie sauvegardée');
  await A.click('#btn-solo');
  assert(await until(A, () => document.getElementById('screen-confirm').classList.contains('active'), null, 4000), '« Jouer seul » avec une sauvegarde : confirmation');
  assert(!(await A.evaluate(() => window.__ts.app.playing)), 'la partie ne démarre pas sans réponse');
  await A.screenshot({ path: OUT + '06c-confirmation.png' });
  await A.click('#btn-confirm-cancel');
  assert(await until(A, () => !document.getElementById('screen-confirm').classList.contains('active')), 'Annuler ferme la confirmation');
  await A.click('#btn-solo');
  await until(A, () => document.getElementById('screen-confirm').classList.contains('active'));
  await A.click('#btn-confirm-resume');
  assert(await until(A, () => window.__ts.app.playing && !!window.__ts.app.sim.machines.forge && !!window.__ts.app.sim.machines.assembleur), '« Reprendre ma partie » : on retrouve la forge et l’assembleur');
  await A.evaluate(() => window.__ts.saveGame());
  await A.goto(BASE);
  await A.click('#btn-solo');
  await until(A, () => document.getElementById('screen-confirm').classList.contains('active'));
  await A.click('#btn-confirm-new');
  assert(await until(A, () => window.__ts.app.playing && !window.__ts.app.sim.machines.forge), '« Nouvelle partie » : partie neuve');
  assert(await A.evaluate((k) => { const d = JSON.parse(localStorage.getItem(k)); return !d.st.machines.forge; }, KEY), 'l’ancienne sauvegarde est remplacée seulement après confirmation');

  // ---------- niveau 6 : courant, surchauffe ----------
  console.log('SURCHAUFFE');
  await resume(A, L6);
  await A.waitForFunction(() => window.__ts && window.__ts.app.playing);
  assert(await until(A, () => /Générateur · charbon \d\/5 · bois \d\/5/.test(document.getElementById('power').textContent)), 'indicateur : charbon et bois sur 5 (' + await A.evaluate(() => document.getElementById('power').textContent) + ')');
  assert(!(await A.evaluate(() => /surchauffe/.test(document.getElementById('power').textContent + document.getElementById('labels').textContent))), 'la surchauffe n’est pas annoncée à l’avance');
  await A.screenshot({ path: OUT + '07-courant.png' });
  await A.evaluate(() => { const S = window.__ts.app.sim; S.gen.play = 3599.8; });
  assert(await until(A, () => document.getElementById('screen-lock').classList.contains('active')), 'écran de surchauffe');
  const t0 = await A.evaluate(() => window.__ts.app.sim.time);
  await sleep(1500);
  assert(await A.evaluate((t) => window.__ts.app.sim.time === t, t0), 'le jeu est à l’arrêt pendant la surchauffe');
  assert(await A.evaluate(() => /^(29|30):\d\d$/.test(document.getElementById('lock-count').textContent)), 'décompte de 30 minutes');
  await A.screenshot({ path: OUT + '08-surchauffe.png' });
  await A.click('#btn-lock-vest');
  await until(A, () => document.getElementById('screen-usine').classList.contains('active'));
  await sleep(300);
  await A.screenshot({ path: OUT + '09-vestiaire-pendant-surchauffe.png' });
  await A.click('#btn-usine-close');
  // on quitte et on revient : le décompte est toujours là
  await A.evaluate(() => window.__ts.saveGame());
  await A.goto(BASE);
  assert(await until(A, () => !!document.getElementById('resume-lock') && /\d+:\d\d/.test(document.getElementById('resume-lock').textContent)), 'accueil : reprise dans mm:ss');
  await A.screenshot({ path: OUT + '10-accueil-surchauffe.png' });
  await A.click('#btn-resume-solo');
  assert(await until(A, () => document.getElementById('screen-lock').classList.contains('active')), 'décompte toujours visible après être revenu');
  await A.evaluate(() => { window.__ts.app.sim.gen.lockUntil = Date.now() - 1; });
  assert(await until(A, () => !document.getElementById('screen-lock').classList.contains('active')), 'fin de la pause');
  assert(await A.evaluate(() => /vide/.test(document.getElementById('action-label').textContent + document.getElementById('power').textContent) || window.__ts.app.sim.machines.generateur.inp.charbon === undefined), 'générateur vide après la pause');
  // Passage de niveau : l'annonce liste ce qui est débloqué
  await A.evaluate(async () => { const C = await import('./js/config.js'); const S = window.__ts.app.sim; for (const g of C.LEVELS[S.level].goals) S.goals[g.id] = true; });
  assert(await until(A, () => document.getElementById('screen-levelup').classList.contains('active')), 'annonce de niveau');
  const unl = await A.evaluate(() => document.getElementById('lvl-body').textContent);
  assert(/Machine|Métier/.test(unl), 'nouveautés listées : ' + unl.slice(0, 120));
  await A.screenshot({ path: OUT + '11-niveau-7.png' });
  await A.click('#btn-lvl-ok');

  // ---------- niveau 14 : zone des déclassés, vestiaire, tenues ----------
  console.log('QUALITÉ');
  await resume(A, L14);
  await A.waitForFunction(() => window.__ts && window.__ts.app.playing);
  await A.evaluate(async () => { const C = await import('./js/config.js'); const S = window.__ts.app.sim; S.machines.zone.inp = { circuit_d: 3, carcasse_d: 2 }; const p = C.PLOTS.find((x) => x.id === 'zone'); window.__ts.tp(p.x, p.z - C.MACHINES.zone.d / 2 - 0.8); });
  assert(await until(A, () => document.getElementById('btn-ctx').textContent === 'Déclassés'), 'bouton Déclassés près de la zone');
  await A.click('#btn-ctx');
  await until(A, () => document.getElementById('screen-zone').classList.contains('active'));
  await sleep(400);
  await A.click('#zone-body button[data-a="ztake"][data-k="circuit_d"][data-n="1"]');
  assert(await until(A, () => window.__ts.app.sim.players.A.sac.circuit_d === 1), 'pièce déclassée prise dans la zone');
  await A.screenshot({ path: OUT + '12-zone.png' });
  await A.click('#btn-zone-close');
  await A.evaluate(() => { window.__ts.app.sim.credits += 600; });
  await A.click('#btn-vest');
  await until(A, () => document.getElementById('screen-usine').classList.contains('active'));
  await sleep(400);
  const packBtn = await A.$('#usine-body .pick.pack[data-t="recherche"]');
  assert(!!packBtn, 'pack L’intégrale proposé');
  await packBtn.click();
  assert(await until(A, () => !!window.__ts.app.sim.wardrobe.owned['recherche:gilet']), 'pack acheté');
  await A.click('#usine-body .pick.buy[data-t="recherche"][data-o="or"]');
  assert(await until(A, () => (window.__ts.app.sim.wardrobe.wear.recherche || {}).peinture === 'or'), 'peinture dorée cumulée avec les vêtements');
  await sleep(400);
  await A.screenshot({ path: OUT + '13-vestiaire.png' });
  await A.click('#btn-usine-close');
  await A.evaluate(() => { const S = window.__ts.app.sim; const d = S.droids.find((x) => x.type === 'logistique'); d.job = null; d.st = 'idle'; d.x = 2; d.z = 3; window.__ts.tp(2, 5.5, Math.PI); window.__ts.cam.zoomBy(0.55); });
  await sleep(1500);
  await A.screenshot({ path: OUT + '14-droide-habille.png' });

  // ---------- 0.4.2 : métiers plus tôt, recycleur, coin pause ----------
  console.log('0.4.2');
  {
    const lv = await A.evaluate(async () => { const UI = await import('./js/ui.js'); return [UI.unlocksOf(5).map((x) => x.join(' ')).join(' | '), UI.unlocksOf(10).map((x) => x.join(' ')).join(' | '), UI.unlocksOf(7).map((x) => x.join(' ')).join(' | ')]; });
    assert(/Agent de recherche/.test(lv[0]), 'niveau 5 : agent de recherche (' + lv[0] + ')');
    assert(/Agent logistique expert/.test(lv[1]), 'niveau 10 : agent logistique expert (' + lv[1] + ')');
    assert(/Recycleur/.test(lv[2]), 'niveau 7 : recycleur (' + lv[2] + ')');
    // le recycleur : on coche les objets en trop
    await A.evaluate(async () => {
      const C = await import('./js/config.js');
      const S = window.__ts.app.sim; S.stock.isolant = 23; S.stock.k_outils = 6;
      if (!S.machines.recycleur) window.__ts.forceBuild('recycleur');
      const pl = C.PLOTS.find((x) => x.id === 'recycleur'); window.__ts.tp(pl.x, pl.z + C.MACHINES.recycleur.d / 2 + 0.8);
    });
    assert(await until(A, () => document.getElementById('btn-ctx').textContent === 'Recettes'), 'bouton Recettes du recycleur');
    await A.click('#btn-ctx');
    await until(A, () => document.getElementById('screen-recettes').classList.contains('active'));
    await sleep(400);
    await A.click('.tbtn[data-k="isolant"]');
    assert(await until(A, () => (window.__ts.app.sim.machines.recycleur.trash || []).includes('isolant') && window.__ts.app.sim.machines.recycleur.sel.includes('surplus')), 'isolants cochés « en trop »');
    assert(await until(A, () => document.querySelector('.tbtn[data-k="isolant"]').classList.contains('on')), 'case cochée dans le menu');
    await A.screenshot({ path: OUT + '14b-recycleur.png' });
    await A.click('#btn-recettes-close');
    // coin pause : les droïdes sans tâche s'assoient avec un café
    await A.evaluate(() => { window.__ts.tp(4.4, 4.2, Math.PI); window.__ts.advance(25); });
    assert(await until(A, () => window.__ts.app.sim.droids.some((d) => d.pose === 'sit')), 'des droïdes assis au coin pause');
    assert(await until(A, () => /pause café/.test([...document.querySelectorAll('#labels .wsub')].map((e) => e.textContent).join(' '))), 'étiquette « en pause café »');
    await sleep(1500);
    await A.screenshot({ path: OUT + '14c-coin-pause.png' });
  }

  // ---------- 0.4.3 : coéquipier au canapé, appel en solo, noms de près, moins d'objets dessinés ----------
  console.log('0.4.3');
  {
    assert(await until(A, () => window.__ts.app.bot.seated), 'le coéquipier IA est assis au canapé');
    assert(await until(A, () => /pause café/.test(document.getElementById('mode-name').textContent)), 'mode : « IA : en pause café »');
    await A.screenshot({ path: OUT + '14d-coequipier-canape.png' });
    assert(await A.evaluate(() => !document.getElementById('btn-call').classList.contains('hidden')), 'bouton d’appel visible en solo');
    await A.click('#btn-call');
    await A.evaluate(() => window.__ts.advance(6));
    assert(await until(A, () => /te rejoint/.test(document.getElementById('mode-name').textContent)), 'appelé, le coéquipier vient');
    // (sans carte graphique, une image peut prendre plus d'une seconde : on attend le résultat)
    const forgeShown = (x, z, want) => A.evaluate(([x, z]) => window.__ts.tp(x, z, Math.PI), [x, z]).then(() => until(A, (w) => /Forge/.test([...document.getElementById('labels').children].filter((e) => e.style.display !== 'none').map((e) => e.textContent).join(' ')) === w, want, 8000));
    assert(await forgeShown(-17, -10 + 1.2 + 1.5, true), 'nom de la forge à 1,5 m');
    assert(await forgeShown(-17, -10 + 1.2 + 6, false), 'pas de nom de la forge à 6 m');
    await A.evaluate(() => window.__ts.tp(0, 3, Math.PI));
    await sleep(1500);
    const dc = await A.evaluate(() => [window.__ts.renderer().drawCalls, window.__ts.renderer().shadowCalls, window.__ts.app.sim.droids.length]);
    console.log('  objets dessinés :', dc[0], '· ombres :', dc[1], '· droïdes :', dc[2]);
    await A.screenshot({ path: OUT + '14e-usine.png' });
  }

  // ---------- 0.5 : aménager, tenues du joueur, pièces lourdes, nuit ----------
  console.log('0.5');
  {
    // Aménager : la barre « Poser ici » apparaît, le fantôme suit le joueur ; Annuler la ferme
    await A.evaluate(() => window.__ts.tp(0, 4, 0));
    await A.click('#btn-usine');
    await until(A, () => document.getElementById('screen-usine').classList.contains('active'));
    await A.click('.tab[data-tab="amenager"]');
    assert(await until(A, () => !!document.querySelector('#usine-body button[data-a="place"][data-m="ceramique"]')), 'onglet Aménager : liste des machines');
    await A.click('#usine-body button[data-a="place"][data-m="ceramique"]');
    assert(await until(A, () => !document.getElementById('place-bar').hidden), 'barre « Poser ici » affichée');
    await sleep(1200);
    await A.screenshot({ path: OUT + '15-amenager.png' });
    const msg = await A.evaluate(() => document.getElementById('place-msg').textContent);
    assert(/emplacement libre|Impossible/.test(msg), 'message d’emplacement : ' + msg);
    await A.click('#btn-place-cancel');
    assert(await until(A, () => document.getElementById('place-bar').hidden), 'Annuler ferme la barre');
    // Onglet Moi : acheter une cape et choisir sa couleur
    await A.evaluate(() => { window.__ts.app.sim.credits += 300; });
    await A.click('#btn-usine');
    await until(A, () => document.getElementById('screen-usine').classList.contains('active'));
    await A.click('.tab[data-tab="moi"]');
    assert(await until(A, () => !!document.querySelector('#usine-body button[data-a="mebuy"][data-o="cape"]')), 'onglet Moi');
    await A.click('#usine-body button[data-a="mebuy"][data-o="cape"]');
    assert(await until(A, () => (window.__ts.app.sim.wardrobe.me.A.wear || {}).dos === 'cape'), 'cape achetée et portée');
    assert(await until(A, () => !!document.querySelector('#usine-body .swb[data-o="cape"][data-n="6"]')), 'couleurs proposées');
    await A.click('#usine-body .swb[data-o="cape"][data-n="6"]');
    assert(await until(A, () => window.__ts.app.sim.wardrobe.me.A.col.cape === 6), 'couleur choisie');
    await A.click('#btn-usine-close');
    // Nuit : lampadaires allumés
    await A.evaluate(() => { window.__ts.app.sim.time = 560; window.__ts.tp(-17, 2, Math.PI); });
    assert(await until(A, () => window.__ts.renderer().env.night > 0.9), 'la nuit tombe');
    await sleep(1500);
    await A.screenshot({ path: OUT + '16-nuit.png' });
    await A.evaluate(() => { window.__ts.app.sim.time = 30; });
  }

  // ---------- 0.6 : commandes en haut à gauche, emballeuse « Faire venir » ----------
  console.log('0.6');
  {
    await A.evaluate(() => { const S = window.__ts.app.sim; S.orders = [{ id: 901, want: { ouvrier: 2 }, left: { ouvrier: 2 }, special: false, t: 280, life: 300, reward: 56 }, { id: 902, want: { logistique: 1 }, left: { logistique: 1 }, special: true, t: 200, life: 300, reward: 65 }]; S.orderT = 999; });
    assert(await until(A, () => { const o = document.getElementById('orders'); return !o.hidden && /2 droïdes standards/.test(o.textContent) && /agent logistique/.test(o.textContent); }), 'commandes affichées (standard et ★ spéciale)');
    await A.evaluate(async () => { const C = await import('./js/config.js'); const S = window.__ts.app.sim; S.machines.emballeuse.inp.carton = 1; S.machines.emballeuse.out = {}; S.machines.emballeuse.broken = null; const p = C.PLOTS.find((x) => x.id === 'emballeuse'); window.__ts.tp(p.x, p.z + C.MACHINES.emballeuse.d / 2 + 0.6, Math.PI); });
    assert(await until(A, () => /Faire venir/.test(document.getElementById('action-label').textContent)), 'emballeuse : « Faire venir » pour la commande spéciale');
    await sleep(800);
    await A.screenshot({ path: OUT + '17-commandes.png' });
  }
  await ctx.close();

  // ---------- duo : grosse usine (messages découpés), coupure et reconnexion, appel ----------
  console.log('DUO');
  const dctx = await mkctx(844, 390, 1);
  const H = watch(await dctx.newPage(), 'hôte');
  const G = watch(await dctx.newPage(), 'invité');
  await resume(H, LATE, '#btn-resume-duo');
  await H.waitForFunction(() => document.getElementById('wait-code').textContent !== '····');
  const code = await H.textContent('#wait-code');
  await G.goto(BASE + '?net=fake&join=' + code);
  assert(await until(G, () => window.__ts && window.__ts.app.playing && window.__ts.app.st.level >= 19, null, 20000), 'l’invité reçoit l’usine du niveau 20 (gros état découpé)');
  const size = await H.evaluate(() => JSON.stringify(window.__ts.app.sim).length);
  console.log('  taille de l’état :', size, 'caractères');
  await sleep(1500);
  const g1 = await G.evaluate(() => window.__ts.app.st.time);
  await sleep(1500);
  assert(await G.evaluate((t) => window.__ts.app.st.time > t, g1), 'l’état continue d’arriver chez l’invité');
  await H.screenshot({ path: OUT + '15-duo-hote.png' });
  // appel
  await G.evaluate(() => { const o = document.getElementById('screen-levelup'); o.classList.remove('active'); });
  await G.click('#btn-call');
  assert(await until(H, () => document.getElementById('call-msg').classList.contains('on')), 'l’hôte reçoit l’appel (message au centre)');
  await sleep(500);
  await H.screenshot({ path: OUT + '16-appel.png' });
  await G.click('#btn-usine');
  await until(G, () => document.getElementById('screen-usine').classList.contains('active'));
  assert(await G.evaluate(() => document.getElementById('btn-quit').textContent === 'Quitter la partie' && /téléphone de ton partenaire/.test(document.getElementById('quit-note').textContent)), 'invité : « Quitter la partie », sauvegarde chez le partenaire');
  await G.click('#btn-quit');
  assert(await G.evaluate(() => /Toucher encore/.test(document.getElementById('btn-quit').textContent) && window.__ts.app.playing), 'à deux : il faut toucher deux fois pour quitter');
  await G.screenshot({ path: OUT + '16b-invite-quitter.png' });
  await G.click('#btn-usine-close');
  // coupure (comme un écran verrouillé) puis reconnexion automatique
  await G.evaluate(() => window.__cutLinks());
  assert(await until(H, () => document.getElementById('screen-lost').classList.contains('active') && window.__ts.app.paused, null, 8000), 'hôte : partenaire déconnecté, partie en pause');
  await H.screenshot({ path: OUT + '17-coupure-hote.png' });
  assert(await until(G, () => !document.getElementById('screen-lost').classList.contains('active') && window.__ts.app.link && window.__ts.app.link.open, null, 30000), 'l’invité se reconnecte tout seul');
  assert(await until(H, () => !document.getElementById('screen-lost').classList.contains('active') && !window.__ts.app.paused, null, 10000), 'l’hôte reprend');
  await sleep(1200);
  await G.screenshot({ path: OUT + '18-reconnecte-invite.png' });
  await dctx.close();

  // ---------- portrait ----------
  console.log('PORTRAIT');
  const pctx = await mkctx(390, 844);
  const P = watch(await pctx.newPage(), 'portrait');
  await resume(P, L14);
  await P.waitForFunction(() => window.__ts && window.__ts.app.playing);
  await P.click('#btn-rotate-ok').catch(() => {});
  await sleep(1200);
  await P.screenshot({ path: OUT + '19-portrait.png' });
  await P.click('#btn-vest');
  await sleep(500);
  await P.screenshot({ path: OUT + '20-portrait-vestiaire.png' });
  await pctx.close();

  await browser.close();
  console.log('ERREURS :', errors.length ? errors : 'aucune');
  console.log(errors.length ? 'KO' : 'OK');
})().catch((e) => { console.error(e); process.exit(1); });
