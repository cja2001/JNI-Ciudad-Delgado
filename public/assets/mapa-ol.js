// Mapa base de Ciudad Delgado con OpenLayers, compartido por Mapa y Redes.
// Necesita ol.js y assets/mapa-base.js (window.MAPA) cargados antes.
(function () {
  const { Map, View, Feature, Overlay } = ol;
  const { Tile: TileLayer, Vector: VectorLayer, Image: ImageLayer } = ol.layer;
  const { XYZ, OSM, Vector: VectorSource, ImageStatic } = ol.source;
  const { Style, Fill, Stroke, Text, Circle: CircleStyle } = ol.style;
  const fromLonLat = ol.proj.fromLonLat;
  const geojson = new ol.format.GeoJSON({ featureProjection: "EPSG:3857" });
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Urna de votación blanca sobre fondo azul oscuro.
  const ICONO_CENTRO = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32"><rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="#071f2e" stroke="#fff" stroke-width="2.5"/>' +
    '<path d="M11 5.5h10v10H11z" fill="#fff"/><path d="m13.3 10.4 1.9 1.9 3.6-3.8" fill="none" stroke="#00adef" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M7 14h18v12.5H7z" fill="#fff"/><path d="M10.5 15.6h11" stroke="#071f2e" stroke-width="2" stroke-linecap="round"/></svg>');
  // "CENTRO ESCOLAR PEDRO PABLO CASTILLO" -> "Centro Escolar Pedro\nPablo Castillo"
  const MENORES = new Set(["de", "del", "la", "las", "los", "el", "y", "e"]);
  const nombreCorto = n => {
    const palabras = String(n || "").toLowerCase().split(/\s+/).filter(Boolean)
      .map((w, i) => (i && MENORES.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1));
    const lineas = [""];
    for (const w of palabras) { const l = lineas[lineas.length - 1]; if (l && (l + " " + w).length > 20) lineas.push(w); else lineas[lineas.length - 1] = l ? l + " " + w : w; }
    return lineas.slice(0, 3).join("\n");
  };
  const punto = (lat, lng, props) => new Feature({ geometry: new ol.geom.Point(fromLonLat([+lng, +lat])), ...props });

  function crear(opts) {
    opts = opts || {};
    /* ---------- Fondos ---------- */
    const BASES = {
      claro: new TileLayer({ source: new XYZ({ url: "https://{a-d}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", maxZoom: 20,
        attributions: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>' }) }),
      calles: new TileLayer({ source: new OSM(), visible: false }),
      satelite: new TileLayer({ visible: false, source: new XYZ({ maxZoom: 19,
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attributions: "Imágenes © Esri" }) }),
      oficial: new ImageLayer({ visible: false, source: new ImageStatic({ url: "assets/satelite.jpg", projection: "EPSG:3857",
        imageExtent: ol.extent.boundingExtent([fromLonLat([MAPA.IMG_BOUNDS[0][1], MAPA.IMG_BOUNDS[0][0]]), fromLonLat([MAPA.IMG_BOUNDS[1][1], MAPA.IMG_BOUNDS[1][0]])]),
        attributions: "Mapa oficial de zonas del distrito" }) })
    };

    /* ---------- Distrito, zonas y cantones ---------- */
    const zonasSrc = new VectorSource({ features: geojson.readFeatures(MAPA.ZONAS) });
    const distrito = ol.extent.createEmpty();
    zonasSrc.getFeatures().forEach(f => ol.extent.extend(distrito, f.getGeometry().getExtent()));

    // Todo lo que está fuera del distrito se aclara, para que la vista se concentre en Ciudad Delgado.
    const mundo = [[-20037508, -20037508], [20037508, -20037508], [20037508, 20037508], [-20037508, 20037508], [-20037508, -20037508]];
    const huecos = [];
    zonasSrc.getFeatures().forEach(f => f.getGeometry().getPolygons().forEach(p => huecos.push(p.getLinearRing(0).getCoordinates())));
    const mascara = new VectorLayer({
      source: new VectorSource({ features: [new Feature(new ol.geom.Polygon([mundo, ...huecos]))] }),
      style: new Style({ fill: new Fill({ color: "rgba(255,255,255,.55)" }) }),
      zIndex: 1
    });

    let zonaActiva = null;
    const zonas = new VectorLayer({ source: zonasSrc, zIndex: 2, style: f => {
      const on = zonaActiva === f.get("zona");
      return new Style({
        fill: new Fill({ color: on ? "rgba(0,173,239,.22)" : "rgba(0,173,239,.06)" }),
        stroke: new Stroke({ color: on ? "#0084b8" : "#0aa5d6", width: on ? 3 : 1.6 })
      });
    } });
    let textoZona = z => "ZONA " + z;
    const rotulos = new VectorLayer({
      zIndex: 6, declutter: "rotulos",
      source: new VectorSource({ features: MAPA.ZONAS.features.map(f => new Feature({ geometry: new ol.geom.Point(fromLonLat([f.properties.lab[1], f.properties.lab[0]])), zona: f.properties.zona })) }),
      style: f => new Style({ text: new Text({ text: textoZona(f.get("zona")), font: '800 12px "Bricolage Grotesque", system-ui, sans-serif', textAlign: "center",
        fill: new Fill({ color: "#0b5d7e" }), stroke: new Stroke({ color: "#fff", width: 4 }) }) })
    });
    const cantones = new VectorLayer({ visible: false, zIndex: 3, declutter: true,
      source: new VectorSource({ features: geojson.readFeatures(MAPA.CANTONES) }),
      style: f => new Style({ stroke: new Stroke({ color: "#c2410c", width: 1.4, lineDash: [6, 5] }),
        text: new Text({ text: f.get("nombre"), font: '600 11px "Plus Jakarta Sans", system-ui, sans-serif', fill: new Fill({ color: "#9a3412" }),
          stroke: new Stroke({ color: "#fff", width: 3 }), overflow: true }) })
    });

    /* ---------- Centros de votación: ícono de urna y nombre ---------- */
    // Más pequeño con todo el distrito a la vista, más grande al acercarse.
    const iconoChico = new Style({ image: new ol.style.Icon({ src: ICONO_CENTRO, width: 22, height: 22 }) });
    const iconoGrande = new Style({ image: new ol.style.Icon({ src: ICONO_CENTRO, width: 30, height: 30 }) });
    const centros = new VectorLayer({ zIndex: 7, source: new VectorSource(), style: (f, res) => res > 8 ? iconoChico : iconoGrande });
    // Los nombres van en su propia capa: si dos se encimarían se oculta uno, pero el ícono siempre queda.
    const nombresCentros = new VectorLayer({ zIndex: 7, source: centros.getSource(), declutter: "rotulos",
      style: (f, res) => new Style({ text: new Text({ text: nombreCorto(f.get("nombre")), font: '700 11px "Plus Jakarta Sans", system-ui, sans-serif',
        textAlign: "center", textBaseline: "top", offsetY: res > 8 ? 13 : 17, fill: new Fill({ color: "#071f2e" }), stroke: new Stroke({ color: "#fff", width: 3.5 }) }) })
    });
    centros.on("change:visible", () => nombresCentros.setVisible(centros.getVisible()));
    const ponerCentros = lista => {
      centros.getSource().clear();
      centros.getSource().addFeatures((lista || []).map(c => {
        const la = c.latitud ?? c.lat, ln = c.longitud ?? c.lng, loc = MAPA.locate(la, ln);
        return punto(la, ln, { zona: loc.zona, canton: loc.canton, ...c, capa: "centro" });
      }));
    };
    ponerCentros(window.CENTROS || []);

    /* ---------- Mapa y ventana de información ---------- */
    const popEl = document.createElement("div");
    popEl.className = "ol-pop"; popEl.hidden = true;
    popEl.innerHTML = '<button class="x" type="button" aria-label="Cerrar">×</button><div class="body"></div>';
    const popup = new Overlay({ element: popEl, positioning: "bottom-center", offset: [0, -16], autoPan: { animation: { duration: 200 } } });
    const map = new Map({
      target: opts.target || "map",
      layers: [...Object.values(BASES), mascara, zonas, cantones, rotulos, centros, nombresCentros],
      overlays: [popup],
      view: new View({ center: ol.extent.getCenter(distrito), zoom: 13, minZoom: 11, maxZoom: 19,
        extent: ol.extent.buffer(distrito, 6000), constrainOnlyCenter: true })
    });
    const abrir = (coord, html) => { popEl.querySelector(".body").innerHTML = html; popEl.hidden = false; popup.setPosition(coord); };
    const cerrar = () => { popup.setPosition(undefined); popEl.hidden = true; };
    popEl.querySelector(".x").addEventListener("click", cerrar);

    const padding = () => (typeof opts.padding === "function" ? opts.padding() : opts.padding) || [20, 20, 20, 20];
    const encuadrar = ext => map.getView().fit(ext || distrito, { padding: padding(), duration: 300, maxZoom: 17 });
    encuadrar(distrito);

    const popupCentro = p => `<b>${esc(p.nombre)}</b><span class="m">Centro de votación ${p.id}${p.zona ? " · Zona " + p.zona : ""}${p.canton ? " · " + esc(p.canton) : ""}</span>` +
      (p.redes != null ? `<br>${p.redes} ${p.redes === 1 ? "red" : "redes"} · ${p.personas} personas` : "");
    const popupZona = z => `<b>Zona ${z}</b><span class="m">${centros.getSource().getFeatures().filter(c => c.get("zona") === z).map(c => esc(c.get("nombre"))).join("<br>") || "Sin centro de votación"}</span>`;

    return {
      map, BASES, mascara, zonas, zonasSrc, rotulos, cantones, centros, nombresCentros, distrito, popup,
      abrir, cerrar, encuadrar, punto, ponerCentros, popupCentro, popupZona, esc,
      fondo(k) { for (const [n, l] of Object.entries(BASES)) l.setVisible(n === k); mascara.setVisible(k !== "oficial"); },
      zona(z) {
        zonaActiva = z || null; zonas.changed(); cerrar();
        const f = zonasSrc.getFeatures().find(x => x.get("zona") === zonaActiva);
        encuadrar(f ? f.getGeometry().getExtent() : distrito);
      },
      textoZona(fn) { textoZona = fn; rotulos.changed(); },
      ir(lat, lng, zoom) { map.getView().animate({ center: fromLonLat([+lng, +lat]), zoom: Math.max(map.getView().getZoom(), zoom || 15), duration: 300 }); },
      lonlat: coord => ol.proj.toLonLat(coord)
    };
  }

  window.MAPAOL = { crear, punto, esc, ICONO_CENTRO, nombreCorto };
})();
