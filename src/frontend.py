from flask import Blueprint, render_template, redirect, url_for
from datetime import datetime
from models import Map


frontend = Blueprint('frontend', __name__)


@frontend.route('/')
def index():
    return render_template('index.html', maps=Map.all())


@frontend.route('/maps')
@frontend.route('/maps/<string:map_id>/edit')
def maps_form(map_id=None):
    m = None
    if (map_id):
        m = Map.get(map_id)
    now = datetime.utcnow()
    return render_template('map-form.html', map_id=map_id, m=m, now=now)


@frontend.route('/maps/<string:map_id>/edit/bbox')
def maps_bbox(map_id=None):
    m = Map.get(map_id)
    return render_template('map-bbox.html', map_id=map_id, m=m)


@frontend.route('/maps/<string:map_id>/')
@frontend.route('/maps/<string:map_id>')
def maps_show(map_id=None):
    m = Map.get(map_id)
    if (not m):
        return redirect(url_for('.maps_form'))
    elif (not m.bbox):
        return redirect(url_for('.maps_bbox', map_id=map_id))
    return render_template('map-edit.html', map_id=map_id, m=m)
