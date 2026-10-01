/* ─────────────────────────────────────────────────────────────
   map.js: the live map, "Night Earth".
   MapLibre GL (a globe that zooms down to real streets), tiles from
   OpenFreeMap (OpenStreetMap data), recoloured for night and day.
   Pins are lights: yellow = noticed, purple = team forming,
   green = in action (pulsing), white = resolved.
   Lines of light join similar problems in different countries.
   The app talks to it through window.MapView only.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var MV = window.MapView = {};
  var RAD = Math.PI / 180, DEG = 180 / Math.PI;
  var map = null, ready = false, mode = 'hidden', spinOn = false, userBusy = false, failed = false, animOn = false;
  var handlers = {};
  var lastItems = [], lastSel = null, lastExt = {}, lastTheme = 'dark', styleTheme = 'dark', styleReady = false;
  var EMPTY = { type: 'FeatureCollection', features: [] };

  MV.on = function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); };
  function emit(ev, a) { (handlers[ev] || []).forEach(function (f) { f(a); }); }
  MV.ready = function () { return ready; };
  MV.failed = function () { return failed; };
  var reduceMotion = function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };

  /* ───────── palettes: dark = night (default), light = day ───────── */
  var PAL = {
    dark: { land: '#18133A', park: '#132636', water: '#0A0820', dots: '#1B1640', coast: '#4E43A0', ice: '#221C4A', resid: '#1B1640', wood: '#141F33',
      waterway: '#231D52', building: '#1F1947', buildingLine: '#2C2560', roadMinor: '#221C4C', roadCase: '#1B1640', roadInner: '#312A6C',
      roadSubtle: 'rgba(120,100,210,0.5)', rail: '#2F2866', railDash: '#18133A', boundary: '#5E52B0', boundaryState: '#312A6C',
      label: '#EEEAFF', labelSoft: '#B8AEE6', labelMuted: '#8479BE', halo: '#0A0820', waterLabel: '#8C80DA',
      horizon: '#3D2F99', atmo: 1, cityLight: '#FFE2A0', cityOpacity: 0.55,
      bg: '#0A0820', ink: '#F0EDFF', panel: '#17123A', lamp: '#FFD166', signal: '#A78BFA', go: '#34E0A1', steady: '#F4F0FF', edge: '#2A2358' },
    light: { land: '#F5F8FC', park: '#D8EFE4', water: '#CADCF1', dots: '#B4C9E3', coast: '#6F8DB6', ice: '#FFFFFF', resid: '#EDF2F8', wood: '#E2EFE6',
      waterway: '#B3CCE6', building: '#E3E9F2', buildingLine: '#D1DAE7', roadMinor: '#FFFFFF', roadCase: '#CBD6E6', roadInner: '#FFFFFF',
      roadSubtle: 'rgba(150,170,200,0.55)', rail: '#C9D4E3', railDash: '#F5F8FC', boundary: '#8397B8', boundaryState: '#C1CEE0',
      label: '#0A1224', labelSoft: '#3A4968', labelMuted: '#6A7A99', halo: '#F5F8FC', waterLabel: '#3E6699',
      horizon: '#A9C8EE', atmo: 0.7, cityLight: '#F39A0D', cityOpacity: 0,
      bg: '#EAF1FB', ink: '#0A1224', panel: '#FFFFFF', lamp: '#F39A0D', signal: '#6E56CF', go: '#0C9A60', steady: '#33415F', edge: '#D2DDEE' }
  };
  function P() { return PAL[lastTheme] || PAL.dark; }

  // [layer id, paint property, value(P)]: set in the style JSON at start, and with setPaintProperty on theme change
  var RULES = [
    ['background', 'background-color', function (p) { return p.land; }],
    ['park', 'fill-color', function (p) { return p.park; }],
    ['water', 'fill-color', function (p) { return p.water; }],
    ['water-edge', 'line-color', function (p) { return p.coast; }],
    ['landcover_ice_shelf', 'fill-color', function (p) { return p.ice; }],
    ['landcover_glacier', 'fill-color', function (p) { return p.ice; }],
    ['landuse_residential', 'fill-color', function (p) { return p.resid; }],
    ['landcover_wood', 'fill-color', function (p) { return p.wood; }],
    ['waterway', 'line-color', function (p) { return p.waterway; }],
    ['building', 'fill-color', function (p) { return p.building; }],
    ['building', 'fill-outline-color', function (p) { return p.buildingLine; }],
    ['road_area_pier', 'fill-color', function (p) { return p.land; }],
    ['road_pier', 'line-color', function (p) { return p.land; }],
    ['aeroway-area', 'fill-color', function (p) { return p.roadInner; }],
    ['aeroway-runway', 'line-color', function (p) { return p.roadInner; }],
    ['boundary_2', 'line-color', function (p) { return p.boundary; }],
    ['boundary_disputed', 'line-color', function (p) { return p.boundary; }],
    ['boundary_3', 'line-color', function (p) { return p.boundaryState; }],
    ['city-lights', 'circle-color', function (p) { return p.cityLight; }],
    ['city-lights', 'circle-opacity', function (p) { return ['interpolate', ['linear'], ['zoom'], 0, p.cityOpacity, 5, p.cityOpacity * 0.8, 7.5, 0]; }]
  ];
  ['tunnel_motorway_casing', 'highway_major_casing', 'highway_motorway_casing', 'highway_motorway_bridge_casing'].forEach(function (id) { RULES.push([id, 'line-color', function (p) { return p.roadCase; }]); });
  ['tunnel_motorway_inner', 'highway_major_inner'].forEach(function (id) { RULES.push([id, 'line-color', function (p) { return p.roadInner; }]); });
  ['highway_motorway_inner', 'highway_motorway_bridge_inner'].forEach(function (id) { RULES.push([id, 'line-color', function (p) { return ['interpolate', ['linear'], ['zoom'], 5.8, p.roadSubtle, 6, p.roadInner]; }]); });
  ['highway_major_subtle', 'highway_motorway_subtle'].forEach(function (id) { RULES.push([id, 'line-color', function (p) { return p.roadSubtle; }]); });
  ['highway_minor', 'highway_path', 'aeroway-taxiway', 'aeroway-runway-casing'].forEach(function (id) { RULES.push([id, 'line-color', function (p) { return p.roadMinor; }]); });
  ['railway_transit', 'railway_service', 'railway'].forEach(function (id) { RULES.push([id, 'line-color', function (p) { return p.rail; }]); });
  ['railway_transit_dashline', 'railway_service_dashline', 'railway_dashline'].forEach(function (id) { RULES.push([id, 'line-color', function (p) { return p.railDash; }]); });

  function labelColor(id, p) {
    if (/water/.test(id)) return p.waterLabel;
    if (/^label_(city|town|country)/.test(id)) return p.label;
    if (/highway-name|airport|label_other|label_state/.test(id)) return p.labelMuted;
    return p.labelSoft;
  }
  function skyFor(p) {
    // transparent sky, so the page's stars show around the globe; a soft atmosphere at world zoom
    return { 'sky-color': 'rgba(0,0,0,0)', 'horizon-color': p.horizon, 'fog-color': p.bg, 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.3,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, p.atmo, 4, p.atmo * 0.7, 7, 0] };
  }

  function buildStyle(p) {
    var st = JSON.parse(JSON.stringify(window.BASE_STYLE));
    var waterIdx = -1, waterFilter, firstSymbol = -1;
    st.layers.forEach(function (l, i) { if (l.id === 'water') { waterIdx = i; waterFilter = l.filter; } });
    var extra = [
      { id: 'water-dots', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', maxzoom: 7,
        paint: { 'fill-pattern': 'dots', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 5, 0.5, 7, 0] } },
      { id: 'water-edge', type: 'line', source: 'openmaptiles', 'source-layer': 'water',
        paint: { 'line-color': p.coast, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 4, 0.9, 9, 0.7, 15, 0.6],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 7, 0.55, 12, 0.25] } }
    ];
    if (waterFilter) extra.forEach(function (l) { l.filter = waterFilter; });
    st.layers.splice(waterIdx + 1, 0, extra[0], extra[1]);
    st.layers.forEach(function (l, i) { if (firstSymbol < 0 && l.type === 'symbol') firstSymbol = i; });
    // city lights: the earth at night, fading out as you zoom in
    st.layers.splice(firstSymbol, 0, { id: 'city-lights', type: 'circle', source: 'openmaptiles', 'source-layer': 'place', maxzoom: 8,
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
      paint: { 'circle-color': p.cityLight, 'circle-blur': 0.7,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, ['match', ['get', 'class'], 'city', 1.8, 1], 5, ['match', ['get', 'class'], 'city', 3.6, 1.8]],
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, p.cityOpacity, 5, p.cityOpacity * 0.8, 7.5, 0] } });
    var byId = {};
    st.layers.forEach(function (l) { byId[l.id] = l; });
    RULES.forEach(function (r) { var l = byId[r[0]]; if (l) { l.paint = l.paint || {}; l.paint[r[1]] = r[2](p); } });
    st.layers.forEach(function (l) {
      if (l.type !== 'symbol') return;
      if (l.layout && l.layout['text-field'] && /name/.test(JSON.stringify(l.layout['text-field']))) {
        l.layout['text-field'] = ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']];
      }
      l.paint = l.paint || {};
      l.paint['text-color'] = labelColor(l.id, p);
      l.paint['text-halo-color'] = p.halo; l.paint['text-halo-width'] = 1.2; l.paint['text-halo-blur'] = 0.4;
    });
    st.projection = { type: 'globe' };
    st.sky = skyFor(p);
    return st;
  }

  function recolor(p) {
    if (!map) return;
    RULES.forEach(function (r) { if (map.getLayer(r[0])) { try { map.setPaintProperty(r[0], r[1], r[2](p)); } catch (e) { /* ignore */ } } });
    map.getStyle().layers.forEach(function (l) {
      if (l.type !== 'symbol' || /^(items|sel-|cluster)/.test(l.id)) return;
      map.setPaintProperty(l.id, 'text-color', labelColor(l.id, p));
      map.setPaintProperty(l.id, 'text-halo-color', p.halo);
    });
    try { map.setSky(skyFor(p)); } catch (e) { /* older runtime */ }
    paintDataLayers(p);
    addImages(p, true);
    setData(lastItems, lastSel, lastExt);
  }

  /* ───────── lights (pin images, drawn so they follow the theme) ───────── */
  var ICONS = ['s1', 's3', 's4', 's5', 's6', 'person', 'team'];
  function drawIcon(kind, mine, p) {
    var r = 2, S = 34, c = document.createElement('canvas');
    c.width = c.height = S * r;
    var x = c.getContext('2d'); x.scale(r, r);
    var cx = S / 2, cy = S / 2;
    var col = kind === 's1' ? p.lamp : (kind === 's3' || kind === 'team' || kind === 'person') ? p.signal : (kind === 's4' || kind === 's5') ? p.go : p.steady;
    function glow(rad, a) {
      var g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, hexA(col, a)); g.addColorStop(1, hexA(col, 0));
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, Math.PI * 2); x.fill();
    }
    if (kind === 'person') {
      glow(10, 0.45);
      x.fillStyle = col; x.beginPath();
      for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? 2.2 : 7; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      x.closePath(); x.fill();
    } else if (kind === 's6') {
      glow(11, 0.25);
      x.strokeStyle = col; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, 5.5, 0, Math.PI * 2); x.stroke();
      x.fillStyle = col; x.beginPath(); x.arc(cx, cy, 2, 0, Math.PI * 2); x.fill();
    } else if (kind === 'team') {
      glow(13, 0.35);
      x.strokeStyle = col; x.lineWidth = 2.2; x.beginPath(); x.arc(cx, cy, 6.5, 0, Math.PI * 2); x.stroke();
      x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 3, cy); x.lineTo(cx + 3, cy); x.moveTo(cx, cy - 3); x.lineTo(cx, cy + 3); x.stroke();
    } else {
      glow(15, kind === 's3' ? 0.4 : 0.55);
      x.fillStyle = col; x.beginPath(); x.arc(cx, cy, 5.2, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.85)'; x.beginPath(); x.arc(cx - 1.2, cy - 1.2, 1.6, 0, Math.PI * 2); x.fill();
      if (kind === 's3') { x.strokeStyle = col; x.lineWidth = 1.4; x.beginPath(); x.arc(cx, cy, 8.5, 0, Math.PI * 2); x.stroke(); }
    }
    if (mine) {
      x.fillStyle = p.lamp; x.strokeStyle = p.bg; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(cx + 10, cy - 13); x.lineTo(cx + 13, cy - 10); x.lineTo(cx + 10, cy - 7); x.lineTo(cx + 7, cy - 10); x.closePath(); x.fill(); x.stroke();
    }
    return x.getImageData(0, 0, S * r, S * r);
  }
  function drawSel(p) {
    var r = 2, S = 48, c = document.createElement('canvas'); c.width = c.height = S * r;
    var x = c.getContext('2d'); x.scale(r, r);
    var g = x.createRadialGradient(24, 24, 8, 24, 24, 24);
    g.addColorStop(0, hexA(p.lamp, 0.35)); g.addColorStop(1, hexA(p.lamp, 0));
    x.fillStyle = g; x.beginPath(); x.arc(24, 24, 24, 0, Math.PI * 2); x.fill();
    x.strokeStyle = p.lamp; x.lineWidth = 2.5; x.beginPath(); x.arc(24, 24, 13, 0, Math.PI * 2); x.stroke();
    return x.getImageData(0, 0, S * r, S * r);
  }
  function drawDots(p) {
    var r = 2, S = 10, c = document.createElement('canvas'); c.width = c.height = S * r;
    var x = c.getContext('2d'); x.scale(r, r); x.fillStyle = p.dots; x.beginPath(); x.arc(5, 5, 0.8, 0, Math.PI * 2); x.fill();
    return x.getImageData(0, 0, S * r, S * r);
  }
  function hexA(hex, a) {
    var h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(function (ch) { return ch + ch; }).join('');
    var n = parseInt(h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function put(name, img, update) {
    if (update && map.hasImage(name)) map.updateImage(name, img);
    else if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 });
  }
  function addImages(p, update) {
    ICONS.forEach(function (k) { put('i-' + k, drawIcon(k, false, p), update); put('i-' + k + '-m', drawIcon(k, true, p), update); });
    put('i-sel', drawSel(p), update);
    put('dots', drawDots(p), update);
  }

  /* ───────── data on the map ───────── */
  function iconFor(it) {
    var k = it.kind === 'person' ? 'person' : it.kind === 'team' ? 'team' : it.stage >= 6 ? 's6' : it.stage === 5 ? 's5' : it.stage === 4 ? 's4' : it.stage === 3 ? 's3' : 's1';
    return 'i-' + k + (it.mine ? '-m' : '');
  }
  function colorFor(it, p) {
    if (it.kind === 'person' || it.kind === 'team') return p.signal;
    return it.stage >= 6 ? p.steady : it.stage >= 4 ? p.go : it.stage === 3 ? p.signal : p.lamp;
  }
  var HALO_KM = { city: 9, country: 300, continent: 1500 };
  function circlePoly(lon, lat, km) {
    var d = km / 6371, la1 = lat * RAD, lo1 = lon * RAD, pts = [];
    for (var i = 0; i <= 72; i++) {
      var b = 2 * Math.PI * i / 72;
      var la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
      var lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
      pts.push([lo2 * DEG, la2 * DEG]);
    }
    return pts;
  }
  // great-circle line between two [lon, lat] points, longitudes kept continuous
  function arc(a, b, n) {
    n = n || 48;
    var v = function (q) { return [Math.cos(q[1] * RAD) * Math.cos(q[0] * RAD), Math.cos(q[1] * RAD) * Math.sin(q[0] * RAD), Math.sin(q[1] * RAD)]; };
    var A = v(a), B = v(b), dot = Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])), d = Math.acos(dot);
    if (d < 1e-6) return [a, b];
    var pts = [], prev = null;
    for (var i = 0; i <= n; i++) {
      var t = i / n, s1 = Math.sin((1 - t) * d) / Math.sin(d), s2 = Math.sin(t * d) / Math.sin(d);
      var x = s1 * A[0] + s2 * B[0], y = s1 * A[1] + s2 * B[1], z = s1 * A[2] + s2 * B[2];
      var lon = Math.atan2(y, x) * DEG, lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * DEG;
      if (prev !== null) { while (lon - prev > 180) lon -= 360; while (lon - prev < -180) lon += 360; }
      prev = lon; pts.push([lon, lat]);
    }
    return pts;
  }
  function lines(pairs) {
    return { type: 'FeatureCollection', features: (pairs || []).map(function (pr) { return { type: 'Feature', geometry: { type: 'LineString', coordinates: arc(pr[0], pr[1]) }, properties: {} }; }) };
  }
  function setData(items, selId, ext) {
    lastItems = items || []; lastSel = selId || null; lastExt = ext || {};
    if (!ready) return;
    var p = P(), feats = [], halos = [], sel = [];
    lastItems.forEach(function (it) {
      var f = { type: 'Feature', geometry: { type: 'Point', coordinates: [it.lon, it.lat] }, properties: { id: it.id, icon: iconFor(it), st: it.kind === 'problem' || it.kind === 'project' ? it.stage : 0 } };
      if (it.id === lastSel) sel.push(f); else feats.push(f);
      var km = it.kind !== 'person' && HALO_KM[it.scale];
      if (km && (it.showHalo || it.id === lastSel)) {
        halos.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circlePoly(it.lon, it.lat, km)] }, properties: { color: colorFor(it, p), sel: it.id === lastSel } });
      }
    });
    map.getSource('items').setData({ type: 'FeatureCollection', features: feats });
    map.getSource('sel').setData({ type: 'FeatureCollection', features: sel });
    map.getSource('halos').setData({ type: 'FeatureCollection', features: halos });
    map.getSource('arcs').setData(lines(lastExt.arcs));
    map.getSource('arcs-sel').setData(lines(lastExt.selArcs));
    map.getSource('team-lines').setData(lines(lastExt.teamLines));
  }
  MV.setData = setData;

  function paintDataLayers(p) {
    if (!map.getLayer('clusters')) return;
    map.setPaintProperty('cluster-glow', 'circle-color', p.lamp);
    map.setPaintProperty('clusters', 'circle-color', p.panel);
    map.setPaintProperty('clusters', 'circle-stroke-color', p.lamp);
    map.setPaintProperty('cluster-count', 'text-color', p.ink);
    map.setPaintProperty('arcs-glow', 'line-color', p.signal);
    map.setPaintProperty('arcs-line', 'line-color', p.signal);
    map.setPaintProperty('arcs-sel', 'line-color', p.lamp);
    map.setPaintProperty('team-lines', 'line-color', p.signal);
    map.setPaintProperty('pulse', 'circle-color', p.go);
  }
  function addDataLayers() {
    var p = P();
    map.addSource('halos', { type: 'geojson', data: EMPTY });
    map.addSource('arcs', { type: 'geojson', data: EMPTY });
    map.addSource('arcs-sel', { type: 'geojson', data: EMPTY });
    map.addSource('team-lines', { type: 'geojson', data: EMPTY });
    map.addSource('items', { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 34, clusterMaxZoom: 11 });
    map.addSource('sel', { type: 'geojson', data: EMPTY });
    // an area stops being useful once you're zoomed in past it, so the halos fade out at street level
    map.addLayer({ id: 'halo-fill', type: 'fill', source: 'halos', maxzoom: 12.5, paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['get', 'sel'], 0.14, 0.05] } });
    map.addLayer({ id: 'halo-line', type: 'line', source: 'halos', maxzoom: 12.5, paint: { 'line-color': ['get', 'color'], 'line-dasharray': [2, 2], 'line-width': ['case', ['get', 'sel'], 1.6, 1], 'line-opacity': ['case', ['get', 'sel'], 0.9, 0.4] } });
    // lines of light between similar problems (visible from far away, fading as you zoom in)
    map.addLayer({ id: 'arcs-glow', type: 'line', source: 'arcs', maxzoom: 7, layout: { 'line-cap': 'round' },
      paint: { 'line-color': p.signal, 'line-width': 5, 'line-blur': 4, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.22, 5, 0.12, 7, 0] } });
    map.addLayer({ id: 'arcs-line', type: 'line', source: 'arcs', maxzoom: 7, layout: { 'line-cap': 'round' },
      paint: { 'line-color': p.signal, 'line-width': 1.3, 'line-dasharray': [0, 4, 3], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.75, 5, 0.5, 7, 0] } });
    map.addLayer({ id: 'arcs-sel', type: 'line', source: 'arcs-sel', layout: { 'line-cap': 'round' },
      paint: { 'line-color': p.lamp, 'line-width': 2, 'line-opacity': 0.85, 'line-dasharray': [2, 2] } });
    map.addLayer({ id: 'team-lines', type: 'line', source: 'team-lines', layout: { 'line-cap': 'round' },
      paint: { 'line-color': p.signal, 'line-width': 1.2, 'line-opacity': 0.6 } });
    map.addLayer({ id: 'pulse', type: 'circle', source: 'items', filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'st'], 5]],
      paint: { 'circle-color': p.go, 'circle-radius': 8, 'circle-opacity': 0.4, 'circle-blur': 0.5, 'circle-pitch-alignment': 'map' } });
    map.addLayer({ id: 'cluster-glow', type: 'circle', source: 'items', filter: ['has', 'point_count'],
      paint: { 'circle-color': p.lamp, 'circle-radius': ['step', ['get', 'point_count'], 22, 6, 27, 15, 32], 'circle-blur': 1, 'circle-opacity': 0.35 } });
    map.addLayer({ id: 'clusters', type: 'circle', source: 'items', filter: ['has', 'point_count'],
      paint: { 'circle-color': p.panel, 'circle-radius': ['step', ['get', 'point_count'], 13, 6, 16, 15, 19], 'circle-stroke-width': 2, 'circle-stroke-color': p.lamp } });
    map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'items', filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-allow-overlap': true },
      paint: { 'text-color': p.ink } });
    map.addLayer({ id: 'items', type: 'symbol', source: 'items', filter: ['!', ['has', 'point_count']],
      layout: { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true } });
    map.addLayer({ id: 'sel-hi', type: 'symbol', source: 'sel', layout: { 'icon-image': 'i-sel', 'icon-allow-overlap': true } });
    map.addLayer({ id: 'sel-item', type: 'symbol', source: 'sel', layout: { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true } });
  }

  /* ───────── motion: moving dashes on the lines of light, pulsing ACT lights ───────── */
  var DASH = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];
  var dashStep = -1, lastPulse = 0;
  function startAnim() {
    if (animOn || reduceMotion()) return;
    animOn = true;
    (function tick(ts) {
      if (!animOn || !map || mode === 'hidden') { animOn = false; return; }
      if (ready && !document.hidden) {
        var s = Math.floor(ts / 70) % DASH.length;
        if (s !== dashStep) { dashStep = s; map.setPaintProperty('arcs-line', 'line-dasharray', DASH[s]); }
        if (ts - lastPulse > 60) {
          lastPulse = ts;
          var ph = (ts % 2200) / 2200;
          map.setPaintProperty('pulse', 'circle-radius', 7 + 17 * ph);
          map.setPaintProperty('pulse', 'circle-opacity', 0.5 * (1 - ph));
        }
      }
      requestAnimationFrame(tick);
    })(performance.now());
  }

  /* ───────── create ───────── */
  function webglOK() {
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }
  MV.init = function (el, opts) {
    lastTheme = styleTheme = opts.theme || 'dark';
    if (!window.maplibregl || !webglOK()) { failed = true; emit('failed', 'webgl'); return; }
    try {
      map = new maplibregl.Map({
        container: el, style: buildStyle(P()), center: opts.center || [104, -6], zoom: opts.zoom || 1.3,
        attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false,
        maxZoom: 18.5, minZoom: 0.4, fadeDuration: 150, canvasContextAttributes: { antialias: true }
      });
    } catch (e) { failed = true; emit('failed', 'init'); return; }
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.on('styleimagemissing', function (e) { if (/^i-|^dots$/.test(e.id)) addImages(P(), false); });
    // size the globe as soon as it exists, so it doesn't jump bigger when the tiles arrive
    map.once('style.load', function () { styleReady = true; syncTheme(); MV.fitWorld(true); });
    map.on('load', function () {
      addImages(P(), false);
      addDataLayers();
      ready = true;
      syncTheme();
      MV.fitWorld(true);
      setData(lastItems, lastSel, lastExt);
      setMode(mode);
      emit('ready');
    });
    map.on('error', function (e) { emit('error', e && e.error ? String(e.error.message || e.error) : 'error'); });
    ['items', 'sel-item'].forEach(function (layer) {
      map.on('click', layer, function (e) { var f = e.features && e.features[0]; if (f) emit('select', f.properties.id); });
      map.on('mouseenter', layer, function (e) { map.getCanvas().style.cursor = 'pointer'; var f = e.features[0]; emit('hover', { id: f.properties.id, x: e.point.x, y: e.point.y }); });
      map.on('mousemove', layer, function (e) { var f = e.features[0]; emit('hover', { id: f.properties.id, x: e.point.x, y: e.point.y }); });
      map.on('mouseleave', layer, function () { map.getCanvas().style.cursor = ''; emit('hover', null); });
    });
    map.on('click', 'clusters', function (e) {
      var f = e.features && e.features[0]; if (!f) return;
      map.getSource('items').getClusterExpansionZoom(f.properties.cluster_id).then(function (z) {
        map.easeTo({ center: f.geometry.coordinates, zoom: Math.min(z + 0.6, 15), duration: reduceMotion() ? 0 : 700 });
      }).catch(function () { map.easeTo({ center: f.geometry.coordinates, zoom: map.getZoom() + 2 }); });
    });
    map.on('mouseenter', 'clusters', function () { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'clusters', function () { map.getCanvas().style.cursor = ''; });
    map.on('click', function (e) {
      if (!ready) return;
      var hits = map.queryRenderedFeatures(e.point, { layers: ['items', 'sel-item', 'clusters'] });
      if (!hits.length) emit('mapclick', { lng: e.lngLat.lng, lat: e.lngLat.lat });
    });
    map.on('movestart', function (e) { if (e.originalEvent) { userBusy = true; emit('interact'); } });
    map.on('move', function () { emit('move'); });
    map.on('moveend', function () { userBusy = false; emit('moveend'); });
  };

  /* ───────── modes: hero (the home page's rising earth), app (full map), hidden ───────── */
  function setMode(m) {
    mode = m;
    if (!map) return;
    var on = m === 'app';
    ['scrollZoom', 'dragPan', 'doubleClickZoom', 'touchZoomRotate', 'keyboard', 'boxZoom'].forEach(function (h) { if (map[h]) { if (on) map[h].enable(); else map[h].disable(); } });
    if (on) { map.touchZoomRotate.disableRotation(); map.keyboard.disableRotation(); }
    map.resize();
    if (m === 'hero') startSpin(); else spinOn = false;
    if (m !== 'hidden') startAnim();
  }
  MV.setMode = setMode;
  MV.mode = function () { return mode; };
  MV.resize = function () { if (map) map.resize(); };
  function startSpin() {
    if (spinOn || reduceMotion()) return;
    spinOn = true;
    (function step() {
      if (!spinOn || mode !== 'hero' || !map) { spinOn = false; return; }
      if (!userBusy && !document.hidden) { var c = map.getCenter(); map.setCenter([c.lng + 0.05, c.lat]); }
      requestAnimationFrame(step);
    })();
  }
  MV.stopSpin = function () { spinOn = false; };

  /* ───────── camera ───────── */
  function minDim() { var c = map.getContainer(); return Math.max(1, Math.min(c.clientWidth, c.clientHeight)); }
  MV.kmAcross = function () {
    if (!map) return 20000;
    var lat = map.getCenter().lat;
    return minDim() * 40075016.686 * Math.cos(lat * RAD) / (512 * Math.pow(2, map.getZoom())) / 1000;
  };
  MV.zoomForKm = function (km, lat) {
    return Math.log(40075.016686 * Math.cos((lat || 0) * RAD) * minDim() / (512 * km)) / Math.LN2;
  };
  // zoom at which the whole globe fits: measure the globe's real radius on screen, scale to 41% of the smaller side
  // the globe is drawn with a perspective camera, so its visible edge is the horizon, not 90 degrees away:
  // walk along a meridian and keep the farthest projected point, which is the edge of the disk
  MV.worldZoom = function () {
    if (!map) return 1.3;
    var c = map.getCenter(), z = map.getZoom(), dir = c.lat > 0 ? -1 : 1;
    var a = map.project([c.lng, c.lat]), r = 0;
    for (var t = 40; t <= 90; t += 1) {
      var q = map.project([c.lng, c.lat + dir * t]);
      var d = Math.sqrt((q.x - a.x) * (q.x - a.x) + (q.y - a.y) * (q.y - a.y));
      if (d > r) r = d;
    }
    if (!(r > 5)) return Math.log(0.5 * Math.PI * minDim() / 512) / Math.LN2;
    // on a wide screen the banners sit over the top of the map, so leave the globe a little more air
    var el = map.getContainer(), share = mode === 'app' && el.clientWidth > el.clientHeight ? 0.38 : 0.41;
    return z + Math.log(share * minDim() / r) / Math.LN2;
  };
  MV.fitWorld = function (instant, center) {
    if (!map) return;
    if (center) map.jumpTo({ center: center });
    if (instant || reduceMotion()) {
      // the camera's perspective changes a little with zoom, so settle it in two steps
      map.jumpTo({ zoom: MV.worldZoom() }); map.jumpTo({ zoom: MV.worldZoom() });
    } else map.easeTo({ zoom: MV.worldZoom(), duration: 600 });
  };
  MV.level = function () {
    var km = MV.kmAcross();
    return km >= 9000 ? 0 : km >= 2600 ? 1 : km >= 380 ? 2 : km >= 5 ? 3 : 4;
  };
  MV.center = function () { if (!map) return { lng: 104, lat: 14 }; var c = map.getCenter(); return { lng: c.lng, lat: c.lat }; };
  MV.zoom = function () { return map ? map.getZoom() : 1.3; };
  MV.flyTo = function (lng, lat, km, opts) {
    if (!map) return;
    opts = opts || {};
    var z = opts.zoom != null ? opts.zoom : km === 'world' ? MV.worldZoom() : MV.zoomForKm(km, lat);
    // offset (not padding): padding would stick to the map after the move
    var o = { center: [lng, lat], zoom: Math.max(0.4, Math.min(18.5, z)), offset: opts.offset || [0, 0], essential: true };
    if (reduceMotion() || opts.instant) { map.jumpTo(o); return; }
    if (opts.ease) { o.duration = opts.duration || 500; map.easeTo(o); } else { o.speed = 1.3; o.curve = 1.5; map.flyTo(o); }
  };
  MV.zoomBy = function (d) { if (map) map.easeTo({ zoom: map.getZoom() + d, duration: reduceMotion() ? 0 : 300 }); };
  MV.project = function (lng, lat) { if (!map) return null; var pt = map.project([lng, lat]); return { x: pt.x, y: pt.y }; };
  MV.isOnScreen = function (lng, lat) {
    if (!map) return false;
    var c = map.getCenter();
    if (MV.kmAcross() > 2600 && angDist(c.lat, c.lng, lat, lng) > 75) return false;
    var pt = map.project([lng, lat]), el = map.getContainer();
    return pt.x >= 0 && pt.y >= 0 && pt.x <= el.clientWidth && pt.y <= el.clientHeight;
  };
  function angDist(la1, lo1, la2, lo2) {
    var a = Math.sin((la2 - la1) * RAD / 2), b = Math.sin((lo2 - lo1) * RAD / 2);
    return 2 * Math.asin(Math.min(1, Math.sqrt(a * a + Math.cos(la1 * RAD) * Math.cos(la2 * RAD) * b * b))) * DEG;
  }
  MV.setTheme = function (t) {
    if (t === lastTheme) return;
    lastTheme = t;
    syncTheme();
  };
  // night/day may be switched while the map is still loading: repaint as soon as the style is there
  function syncTheme() { if (styleTheme !== lastTheme && styleReady) { styleTheme = lastTheme; recolor(P()); } }
})();
