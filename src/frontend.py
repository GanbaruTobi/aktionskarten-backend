import re

from flask import Blueprint, request, jsonify, abort, render_template, redirect, url_for
from flask_cors import CORS
from werkzeug.security import safe_str_cmp
from models import db, Map, Feature
from geojson import FeatureCollection

frontend = Blueprint('frontend', __name__)

@frontend.route('/maps/')
@frontend.route('/maps')
def overview():
    return 'TODO overview'

@frontend.route('/maps/<string:map_id>/')
@frontend.route('/maps/<string:map_id>')
def show_map(map_id):
    m = db.session.query(Map).get(map_id)
    if (m):
        return render_template('map.html', map_id=map_id)
    return render_template('create_map.html', map_id=map_id) 
