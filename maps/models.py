# -*- coding: utf-8 -*-
from django.contrib.gis.db import models
from django.utils.translation import ugettext_lazy as _

from maps.utils import parse_bbox_string


class MapManager(models.Manager):
    def public(self):
        qs = self.get_queryset()
        return qs.filter(public=True)


class Map(models.Model):
    name = models.CharField(_(u'name'), max_length=50, primary_key=True)
    bbox = models.PolygonField(_(u'bounding box'))
    public = models.BooleanField(_(u'public'), default=False)
    editable = models.BooleanField(_(u'editable'), default=True)

    def set_bbox(self, bbox_string):
        self.bbox = parse_bbox_string(bbox_string)

    def get_bbox(self):
        return

    objects = MapManager()

    def __unicode__(self):
        return self.name


class Feature(models.Model):
    geo = models.GeometryField(u'')
    map = models.ForeignKey(Map, related_name=u'features')