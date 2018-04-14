//
// Localized Leaflet.Draw strings
//
L.drawLocal.draw.toolbar.buttons.text = 'Schreibe Text zu einem Element';
L.drawLocal.draw.toolbar.buttons.polyline = 'Male eine Demoroute';
L.drawLocal.draw.toolbar.buttons.marker = 'Platziere einen Aktionsmarker';
L.drawLocal.draw.handlers.polyline.tooltip = {
  'start': 'Klicke wo die Demo anfangen soll',
  'cond': 'Klick wo die Demo langlaufen soll',
  'end': 'Klicke auf den letzten Demopunkt um die Route zu beenden'
}
L.drawLocal.edit.handlers.text = {
  tooltip: {
    text: 'Klicke auf ein Element um es zu labeln.'
  }
}

// Limit rectangle to DINA4 ratio
L.Draw.Rectangle.include({
  _drawShape: function (latlng) {
    if (!this._shape) {
      this._shape = new L.Rectangle(new L.LatLngBounds(this._startLatLng, latlng), this.options.shapeOptions);
      this._map.addLayer(this._shape);
    } else {
      let a = this._map.latLngToLayerPoint(this._startLatLng),
          b = this._map.latLngToLayerPoint(latlng),
          width = Math.abs(b.x - a.x);

      let ratio =  1240 / 1754.; // 1./Math.sqrt(2)
      if (a.y < b.y) {
        b = new L.Point(b.x, a.y + width*ratio);
      } else {
        b = new L.Point(b.x, a.y - width*ratio);
      }

      latlng = this._map.layerPointToLatLng(b);
      this._shape.setBounds(new L.LatLngBounds(this._startLatLng, latlng));
    }
  }
});

//
// Custom Edit Handler
//

L.Draw.Event.TEXTSTART = 'draw:textstart'
L.Draw.Event.TEXTSTOP = 'draw:textstop'

L.EditToolbar.Text = L.Handler.extend({
  statics: {
    TYPE: 'text'
  },

  // copy/paste of L.EditToolbar.Delete.initialize
  initialize(map, options) {
    L.Handler.prototype.initialize.call(this, map);

    L.Util.setOptions(this, options);

    // Store the selectable layer group for ease of access
    this._layers = this.options.featureGroup;

    if (!(this._layers instanceof L.FeatureGroup)) {
      throw new Error('options.featureGroup must be a L.FeatureGroup');
    }

    // Save the type so super can fire, need to do this as cannot do this.TYPE :(
    this.type = L.EditToolbar.Text.TYPE;

    var version = L.version.split('.');
    //If Version is >= 1.2.0
    if (parseInt(version[0], 10) === 1 && parseInt(version[1], 10) >= 2) {
      L.EditToolbar.Text.include(L.Evented.prototype);
    } else {
      L.EditToolbar.Text.include(L.Mixin.Events);
    }
  },

  enable() {
    if (this._enabled) {
      return;
    }
    this.fire('enabled', {handler: this.type});
    this._map.fire(L.Draw.Event.TEXTSTART, {handler: this.type});

    L.Handler.prototype.enable.call(this);

    this._layers
      .on('layeradd', this._enableLayerHandler, this)
      .on('layerremove', this._disableLayerHandler, this);
  },

  disable() {
    if (!this._enabled) {
      return;
    }

    this._layers
      .off('layeradd', this._enableLayerHandler, this)
      .off('layerremove', this._disableLayerHandler, this);

    L.Handler.prototype.disable.call(this);

    this._map.fire(L.Draw.Event.TEXTSTOP, {handler: this.type});

    this.fire('disabled', {handler: this.type});
  },


  _enableLayerHandler(e) {
    var layer = e.layer || e.target || e;
    layer.on('click', this._layerHandler, this);
  },

  _disableLayerHandler(e) {
    var layer = e.layer || e.target || e;
    layer.off('click', this._layerHandler, this);

    // close still open popups when disabled
    if (layer.isPopupOpen()) {
      layer.closePopup()
    }
    layer.unbindPopup();
  },

  _layerHandler(e) {
    var layer = e.layer || e.target || e;
    var id = 'popup-'+layer.id;

    layer.on('popupopen', e => {
      $('#'+id)
        .keypress(function(e) {
          if (e.key == 'Enter') {
            layer.closePopup();
          }
        })
        .focus();
    });

    layer.on('popupclose', e => {
      // replace popup with tooltip and mark layer as edited
      var elem = document.getElementById(id)
      if (elem && elem.value != layer.feature.properties.label) {
        if (layer.getTooltip()) {
          layer.setTooltipContent(elem.value);
        } else {
          layer.bindTooltip(elem.value, {direction: 'left', sticky: true});
        }

        layer.feature.properties.label = elem.value;
        layer.edited = true
      }
      layer.unbindPopup()
    });

    var properties = layer.feature.properties
    var label = 'label' in properties ? properties.label : ''
    var html = '<input id="'+id+'" type="text" value="'+label+'" />'
    layer.bindPopup(html, {opacity: 0.7, sticky: true});
    layer.openPopup();
  },

  save() {
    var editedLayers = new L.LayerGroup();
    this._layers.eachLayer(function (layer) {
      if (layer.isPopupOpen()) {
        layer.closePopup()
      }

      if (layer.edited) {
        editedLayers.addLayer(layer);
        layer.edited = false;
      }
    });

    this._map.fire(L.Draw.Event.EDITED, {layers: editedLayers});
  },

  addHooks() {
    var map = this._map;

    if (map) {
      map.getContainer().focus();

      this._layers.eachLayer(this._enableLayerHandler, this);

      this._tooltip = new L.Draw.Tooltip(this._map);
      this._tooltip.updateContent({text: L.drawLocal.edit.handlers.text.tooltip.text});

      this._map.on('mousemove', this._onMouseMove, this);
    }
  },

  removeHooks() {
    if (this._map) {
      this._layers.eachLayer(this._disableLayerHandler, this);

      this._tooltip.dispose();
      this._tooltip = null;

      this._map.off('mousemove', this._onMouseMove, this);
    }
  },

  _onMouseMove: function (e) {
    this._tooltip.updatePosition(e.latlng);
  },

  revertLayers() {
  }
});


let defaultEditModeHandlers = L.EditToolbar.prototype.getModeHandlers;
L.EditToolbar.include({
  getModeHandlers: function(map) {
    var featureGroup = this.options.featureGroup;
    let modeHandlers = defaultEditModeHandlers.bind(this).call(this, map)
    modeHandlers.push({
        enabled: true, //this.options.text,
        handler: new L.EditToolbar.Text(map, {
          featureGroup: featureGroup
        }),
        title: L.drawLocal.edit.toolbar.buttons.text
    });
    return modeHandlers;
  }
});

// Map features (editable through Leaflet.Draw and Leaflet.StyleEditor)
// are normally a FeatureGroup but GeoJSON extends FeatureGroup and gives
// us functionality to populate with geojson data
L.FeatureLayer = L.GeoJSON.extend({
    //get count() {
    //  return this.getLayers().length;
    //},
    addFeature(data) {
      var exists = false;
      this.eachLayer((layer) => {
        if (data.properties.id == layer.id) {
          exists = true;
        }
      })

      // already exists for client who created the feature
      if (!exists) {
        this.addData(data);
      }
    },
    updateFeature(data) {
      this.deleteFeature(data.properties.id);
      this.addData(data);
    },
    deleteFeature(id) {
      this.eachLayer((layer) => {
        if (id == layer.id) {
          this.removeLayer(layer);
        }
      })
    }
});

//
// Custom Draw Handler - unused
//
//L.Draw.Text = L.Draw.Feature.extend({
//  statics: {
//    TYPE: 'text'
//  },
//  // @method initialize(): void
//  initialize: function (map, options) {
//    // Save the type so super can fire, need to do this as cannot do this.TYPE :(
//    this.type = L.Draw.Text.TYPE;

//    //this._initialLabelText = L.drawLocal.draw.handlers.text.tooltip.start;

//    L.Draw.Feature.prototype.initialize.call(this, map, options);
//  },

//})
//let defaultModeHandlers = L.DrawToolbar.prototype.getModeHandlers;
//L.DrawToolbar.include({
//  getModeHandlers: function(map) {
//    let modeHandlers = defaultModeHandlers.bind(this).call(this, map)
//    modeHandlers.push({
//      enabled: {},//this.options.text,
//      handler: new L.Draw.Text(map, this.options.text),
//      type: 'text',
//      title: L.drawLocal.draw.toolbar.buttons.polyline
//    });
//    return modeHandlers
//  }
//});


