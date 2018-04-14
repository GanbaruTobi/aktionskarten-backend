class ActionMap {
  constructor(url, mapName, mapId) {
    this.url = url
    this.mapName = mapName;

    // private properties for Leaflet
    this._layers = {}
    this._controls = {}

    // init leaflet
    this.init(mapId);
  }

  get apiUrl() {
    return this.url + '/api';
  }

  get mapUrl() {
    return this.apiUrl + '/maps/' + this.mapName;
  }

  set mode(mode) {
    this._mode = mode;
    if ('draw' in this._controls) {
      this.addDraw();
    }
  }

  get mode() {
    return this._mode;
  }

  clear(name) {
    let layer = this.get(name).clearLayers();
    this._map.fire(name+'Changed');
  }

  get(name) {
    if (!(name in this._layers)) {
      throw "Layer " + name + " does not exist";
    }

    return this._layers[name];
  }

  set(name, data) {
    let layer = this.get(name);

    this.clear(name);

    if (data && 'features' in data) {
      layer.addData(data);
      layer.fire('changed');
      this._map.fire(name+'Changed');
    }
  }

  load(name) {
    get(this.mapUrl + '/' + name).then(data => this.set(name, data))
  }

  _addGridLayer() {
    if ('grid' in this._layers) {
      return;
    }

    let grid = L.geoJSON(null, {
      interactive: false,
      style: (f) => f.properties
    });

    grid.on('changed', e => {
      this._map.fitBounds(e.target.getBounds());
    });

    this._layers.grid = grid;
    grid.addTo(this._map);
  }

  _addFeatureLayer() {
    if ('features' in this._layers) {
      return;
    }

    let features = new L.FeatureLayer(null, {
      // copies style and id to feature.options
      style: (f) => f.properties,
      pointToLayer: (feature, latlng) => {
        if ('radius' in feature.properties) {
          return L.circle(latlng,
            feature.properties.radius,
            feature.properties
          );
        }

        try {
          let markerType = this._controls.styleEditor.options.markerType;
          if (!('icon' in feature.properties)) {
            feature.properties.icon = markerType.options.markers['default'][0]
            feature.properties.iconColor = markerType.options.colorRamp[0]
            feature.properties.iconSize = markerType.options.size['medium']
          }
          return L.marker(latlng, {icon: markerType.createMarkerIcon(feature.properties)});
        } catch (err) {
          console.log("Could not find marker options");
          //console.log(err);
        }
        return L.marker(latlng);
      },
      onEachFeature: (feature, layer) => {
        layer.id = feature.properties.id;

        if ('label' in feature.properties) {
          layer.bindTooltip(feature.properties.label, {direction: 'left', sticky: true});
        }
      }
    });

    this._layers.features = features;
    features.addTo(this._map);
  }

  get draw() {
    return 'draw' in this._controls;
  }

  set draw(show) {
    // do nothing if already in desired state
    if (show == this.draw) {
      return;
    }

    if ('draw' in this._controls) {
      this._map.removeControl(this._controls.draw);
      delete this._controls.draw;
    }

    // remove only Leaflet.Draw
    if (!show && this.grid) {
      this._map.fire('drawChanged');
      return;
    }

    // add Leaflet.Draw
    let draw = new L.Control.Draw({
      position: 'topright',
      draw: {
        rectangle: false,
        circlemarker: false
      },
      edit: {
          featureGroup: this.get('features'), // only allow features to be editable
      }
    })
    this._controls.draw = draw;
    this._map.addControl(draw);
    this._map.fire('drawChanged');
  }

  get styleEditor() {
    return 'styleEditor' in this._controls;
  }

  set styleEditor(show) {
    // do nothing if already in desired state
    if (show == this.styleEditor) {
      return;
    }

    if ('styleEditor' in this._controls) {
      this._map.removeControl(this._controls.styleEditor);
      delete this._controls.styleEditor;
    }

    // remove only Leaflet.StyleEditor
    if (!show && this.grid) {
      this._map.fire('styleEditorChanged');
      return;
    }

    // add Leaflet.StyleEditor
    let styleEditor = new L.control.styleEditor({
      colorRamp: [
        '#e04f9e', '#fe0000', '#ee9c00', '#ffff00', '#00e13c', '#00a54c', '#00adf0', '#7e55fc', '#1f4199', '#7d3411'
      ],
      position: 'topright',
      markerType: L.StyleEditor.marker.AktionskartenMarker,
      useGrouping: false // otherwise a change style applies to all
                         // auto-added featues
    });

    this._controls.styleEditor = styleEditor;
    this._map.addControl(styleEditor);
    this._map.fire('styleEditorChanged');
  }

  init(mapId) {
    this._map = L.map(mapId);

    // add tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      detectRetina: true,
      attribution: 'Karte &copy; Aktionskarten | Tiles &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
        '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a> '
    }).addTo(this._map);

    // init layers
    this._addGridLayer();
    this._addFeatureLayer();

    // init socketio
    this._socket = io.connect(this.url);
    this._socket.emit('join', this.mapName);

    // register event handlers
    this._registerLeafletEventHandlers();
    this._registerSocketIOEventHandlers();
  }

  _registerLeafletEventHandlers() {
      this._map.on(L.Draw.Event.CREATED, e => {
        let feature = e.layer.toGeoJSON();

        // use rectangle as bbox if only rectangle control is enabled
        if (feature.geometry.type == "Polygon" && this.mode == 'bbox') {
          let bounds = e.layer.getBounds();
          let rect = [bounds.getSouthEast(), bounds.getNorthWest()];
          let bbox = [].concat.apply([], L.GeoJSON.latLngsToCoords(rect));

          this._map.fire('bboxChanged', {'bbox': bbox});

          return;
        }

        // feature
        if (feature.geometry.type == "Point") {

          // if the layer is a circle save radius to properties
          if (e.layer.getRadius){
            feature.properties.radius = e.layer.getRadius();
          }
        }

        post(this.mapUrl + '/features', feature).then(resp => {
          resp.json().then(data => {
            e.layer.id = data.properties.id
            this.get('features').addData(data);
            this._map.fire('featureAdded', data.properties.id);
          });
        });
      });

      this._map.on(L.Draw.Event.EDITED, e => {
        var layers = e.layers;
        layers.eachLayer(layer => {
          var id = layer.id;
          console.log("edited", layer.toGeoJSON())
          patch(this.mapUrl + '/features/' + id, layer.toGeoJSON())
            .then(resp => {
              this._map.fire('featureEdited', id);
          })
        });
      });

      this._map.on(L.Draw.Event.DELETED, e => {
        var layers = e.layers;
        layers.eachLayer(layer => {
          var id = layer.id;
          del(this.mapUrl + '/features/' + id, layer.toGeoJSON())
            .then(resp => {
              this._map.fire('featureDeleted', id);
          })
        });
      });

      this._map.on('styleeditor:changed', e => {
        var properties = filterProperties(e.options);
        var feature = Object.assign(e.toGeoJSON(), {'properties': properties})

        var id = e.id;
        patch(this.mapUrl + '/features/' + id, feature)
          .then(function(resp) {
            console.log(resp, "Changed style of " + id);
          })
      });

  }


  _registerSocketIOEventHandlers() {
      this._socket.on('connect', () => {
        console.log('connected')
      });
      this._socket.on('created', (data) => {
        console.log('event create', data);
        this.get('features').addFeature(data);
      });

      this._socket.on('updated', (data) => {
        console.log('event update', data);
        this.get('features').updateFeature(data);
      });

      this._socket.on('deleted', (data) => {
        console.log('event deleted', data);
        this.get('features').deleteFeature(data.properties.id);
      });
  }

  center(cords) {
    if (cords) {
      this._map.setView(cords, 12);
      return;
    }

    // try to default back to bbox and then to geo data of place
    get(this.mapUrl).then(data => {
      if (data.bbox) {
        var a = L.GeoJSON.coordsToLatLng(data.bbox.slice(0,2)),
            b = L.GeoJSON.coordsToLatLng(data.bbox.slice(2,4));
        this._map.fitBounds([a, b]);

      } else if (data.place) {
        var url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + data.place;
        get(url).then(json => {
          let bbox = json[0].boundingbox;
          this._map.fitBounds([[bbox[0],bbox[2]], [bbox[1], bbox[3]]]);
        });
      }
    });
  }

  on(event, handler) {
    this._map.on(event, handler);
  }


  setTooltip(content) {
    if (!this.tooltip) {
      let wrapper = L.DomUtil.create('div', 'leaflet-styleeditor-tooltip-wrapper', this._map.getContainer());
      this.tooltip = L.DomUtil.create('div', 'leaflet-styleeditor-tooltip', wrapper);
    }
    this.tooltip.innerHTML = content;
  }
}
