import json
from Queue import Queue  # custom

from flask import Blueprint, request, Response
from flask_cors import CORS
from models import Map, Feature

# custom sse
live = Blueprint('live', __name__)
CORS(live)
channels = {}


@live.route('/api/maps/<int:map_id>/live')
def map_features_live(map_id):
    q = Queue()
    if 'map_id' not in channels:
        channels[map_id] = [q]
    else:
        channels[map_id].append(q)

    def event_gen():
        try:
            while True:
                yield q.get(True)
        except GeneratorExit:
            channels[map_id].remove(q)

    return Response(event_gen(), mimetype="text/event-stream")


def emit(name, data, channel):
    raw = [
        ('event', name),
        ('data', json.dumps(data))
    ]
    lines = ["{}: {}".format(k, v) for (k, v) in raw]
    lines.append("\n")
    event = '\n'.join(lines)
    for subscriber in channels[channel]:
        subscriber.put(event)


@Feature.on_created.connect
@Map.on_created.connect
def model_on_created(data):
    #sse.publish(data, type='created')
    #socketio.emit('created', data, broadcast=True)
    emit('created', data, channel=data['map_id'])

    print("created event", data)


@Feature.on_updated.connect
@Map.on_updated.connect
def model_on_updated(data):
    #sse.publish(data, type='updated')
    #socketio.emit('updated', data)
    emit('updated', data, channel=data['map_id'])
    print("update event", data)


@Feature.on_deleted.connect
@Map.on_deleted.connect
def model_on_deleted(data):
    #sse.publish(data, type='deleted')
    #socketio.emit('deleted', data)
    emit('deleted', data, channel=data['map_id'])
    print("deleted event", data)
