# -*- coding: utf-8 -*-
# encoding: utf-8
'''
Created on 2014年1月4日

@author: kane
'''
import datetime
from billiards.models import Challenge, ChallengeApply,\
    DisplayNameJsonSerializer, Poolroom
from django.shortcuts import render_to_response, get_object_or_404
from billiards.settings import TEMPLATE_ROOT, TIME_ZONE
from django.template.context import RequestContext
from StringIO import StringIO
from django.http import HttpResponse, Http404
import json
from django.utils import simplejson
from django.db.models.query_utils import Q
from billiards.location_convertor import bd2gcj, distance
from django.db import transaction
import pytz
from django.core.exceptions import PermissionDenied
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from billiards.views.poolroom import getNearbyPoolrooms
from billiards.views.club import challenge, saveChallenge
from urlparse import urlparse

def updateChallengeJsonStrApplyInfo(jsonstr, user, challenges):
    appliedChallenges = ChallengeApply.objects.filter(Q(challenge__in=challenges) & Q(user__exact=user))
    if len(appliedChallenges) > 0:
        challenges = simplejson.loads(jsonstr)
        for challengeApply in appliedChallenges:
            for challenge in challenges:
                if challengeApply.challenge.id == challenge['pk']:
                    challenge['fields']['applied'] = True
                    challenge['fields']['applystatus'] = challengeApply.status
                    break
        jsonstr = simplejson.dumps(challenges)
    return jsonstr

def updateChallengeJsonStrDistance(jsonstr, lat, lng):
    challenges = simplejson.loads(jsonstr)
    gp = bd2gcj(lat, lng)
    for challenge in challenges:
        gp2 = bd2gcj(challenge.fields.issuer.lat, challenge.fields.issuer.lng)
        challenge['fields']['distance'] = distance(gp[0], gp[1], gp2[0], gp2[1])
    jsonstr = simplejson.dumps(challenges)
    return jsonstr

def index(request, lat = None, lng = None):
    if 'f' in request.GET and request.GET.get('f') == 'json':
        starttime = datetime.datetime.today()
        datefmt = "%Y-%m-%d"
        challenges = Challenge.objects.filter(starttime__gte=starttime.strftime(datefmt)).order_by('starttime')
        json_serializer = DisplayNameJsonSerializer()
        stream = StringIO()
        json_serializer.serialize(challenges, ensure_ascii=False, stream=stream, indent=2, use_natural_keys=True)
        jsonstr = stream.getvalue()
        # calculate it in client
#         if lat is not None and lng is not None:
#             jsonstr = updateChallengeJsonStrDistance(jsonstr, lat, lng)
        if request.user.is_authenticated():
            jsonstr = updateChallengeJsonStrApplyInfo(jsonstr, request.user, challenges)
        return HttpResponse(jsonstr)
        
    return render_to_response(TEMPLATE_ROOT + 'challenge.html',
                              {'lat': lat, 'lng': lng},
                              context_instance=RequestContext(request))

@transaction.commit_on_success
def applyChallenge(request, challengeid):
    if not request.user.is_authenticated():
        raise PermissionDenied
    try:
        challenge = Challenge.objects.select_for_update().get(pk=challengeid)
        if challenge.status == 'matched':
            msg = {'rt': 4, 'msg': 'already match'}
        elif challenge.is_expired:
            msg = {'rt': 3, 'msg': 'already expired'}
        else:
            obj, created = ChallengeApply.objects.get_or_create(challenge=challenge, user=request.user,
                      defaults={'applytime': datetime.datetime.utcnow().replace(tzinfo=pytz.timezone(TIME_ZONE))})
            if created and obj != None:
                challenge.status = 'matched'
                challenge.save()
                msg = {'rt': 1, 'msg': 'applied'}
            elif obj != None:
                msg = {'rt': 2, 'msg': 'already applied'}
            else:
                msg = {'rt': -1, 'msg': 'unknown error'}
        return HttpResponse(json.dumps(msg.items()), content_type="application/json")
    except Challenge.DoesNotExist:
        raise Http404
    
@csrf_exempt
def publish(request, lat = None, lng = None, distance = 3):
    if request.method == 'POST':
        try:
            poolroomid = int(request.POST['poolroom'])
            location = None
            if poolroomid == -1:
                location = "{0},{1}".format(lat, lng)
                poolroomid = Poolroom.objects.all()[:1].get().id
            elif poolroomid == 0:
                location = u"{0},{1}:{2}".format(lat, lng, request.POST['location'])
                poolroomid = Poolroom.objects.all()[:1].get().id
            else:
                try:
                    Poolroom.objects.get(id=poolroomid)
                except Poolroom.DoesNotExist:
                    location = "{0},{1}".format(lat, lng)
                    poolroomid = 1
            username = 'unknown'
            if request.user.is_authenticated():
                username = request.user.username
            else:
                try:
                    username = request.POST['user']
                except KeyError:
                    pass
                username = 'wechat:%s' %(username)
            return saveChallenge(request, username, poolroomid, None, 2, location)
        except Exception:
            return HttpResponse(json.dumps({'rt': 0, 'msg': u'Invalid Arguments.'}), content_type="application/json")
    nearbypoolrooms = getNearbyPoolrooms(lat, lng, distance)
    username = 'unknown'
    try:
        username = request.GET['uid']
    except KeyError:
        pass
    return render_to_response(TEMPLATE_ROOT + 'challenge_application.html', 
                                  {'poolrooms': nearbypoolrooms, 'lat': lat, 'lng': lng, 'username': username}, context_instance=RequestContext(request))
    
def detail(request, challengeid):
    challenge = get_object_or_404(Challenge, pk=challengeid)
    location = "%s,%s" %(challenge.poolroom.lng_baidu, challenge.poolroom.lat_baidu)
    locationtext = None
    if challenge.source == 2 and challenge.location != '':
        locationtexts = challenge.location.split(':')
        if len(locationtexts) > 1:
            locationtext = locationtexts[1]
        latlng = locationtexts[0].split(",")
        location = "%s,%s" %(latlng[1], latlng[2])
    return render_to_response(TEMPLATE_ROOT + 'challenge_detail.html', {'cha': challenge, 'location': location, 'locationtext': locationtext,
                                'contact': urlparse(challenge.issuer_contact)},
                              context_instance=RequestContext(request))