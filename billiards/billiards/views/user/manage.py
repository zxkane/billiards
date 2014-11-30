# -*- coding: utf-8 -*-
# encoding: utf-8
'''
Created on 2014年1月1日

@author: kane
'''
from django.http import HttpResponse
from billiards.models import Group, Membership
from django.db.models.query_utils import Q
from billiards.settings import TEMPLATE_ROOT, PREFER_LOGIN_SITE
from django.template.context import RequestContext
from django.shortcuts import render_to_response, get_object_or_404, redirect
from django.views.decorators.csrf import csrf_exempt
import json
from billiards.commons import forceLogin
from django.utils import simplejson
from django.core.exceptions import PermissionDenied
import re
from validate_email import validate_email

PHONE_PATTERN = re.compile(r'^1\d{10}$')    
@csrf_exempt
def completeInfo(request):
    user = request.user
    if user.is_authenticated():
        contactInfo = simplejson.loads(request.body)
        if contactInfo['tel'].strip() != '' and PHONE_PATTERN.search(contactInfo['tel'].strip()) and validate_email(contactInfo['email']):
            user.cellphone = contactInfo['tel'].strip()
            user.email = contactInfo['email'].strip()
            user.save()
            return HttpResponse(simplejson.dumps({'code': 0}))
        return HttpResponse(simplejson.dumps({'code': -1}))
    raise PermissionDenied("login firstly.")    

MEMBERSHIP_PAGE = 'user/membership.html'
@csrf_exempt
def membership_apply(request, wechatid, group):
    if request.user.is_authenticated() and request.user.site_name.startswith(PREFER_LOGIN_SITE):
        groupobj = get_object_or_404(Group, id=group)
        if request.method == 'POST':
            realname = request.POST['realname']
            cellphone = request.POST['cellphone']
            gender = request.POST['gender']
            obj, created = Membership.objects.get_or_create(wechatid=wechatid, targetid_id=group,
                          defaults={'userid': request.user.id if request.user.is_authenticated() else 0,
                                    'name': realname, 'gender': int(gender), 'cellphone': cellphone})
            if obj != None:
                return HttpResponse(json.dumps({'rt': 1, 'msg': 'created'}), content_type="application/json")
            else:
                return HttpResponse(json.dumps({'rt': 0, 'msg': 'failed to apply a membership'}), content_type="application/json")
        try:
            member = Membership.objects.get(Q(wechatid=wechatid) & Q(targetid=group))
            return renderMemberPage(request, member, groupobj)
        except Membership.DoesNotExist:
            return render_to_response(TEMPLATE_ROOT + 'user/membership_application.html',
                    {'group': groupobj, 'wechatid': wechatid}, context_instance=RequestContext(request))

    return forceLogin(request, PREFER_LOGIN_SITE)
def renderMemberPage(request, member, groupobj):
    return render_to_response(TEMPLATE_ROOT + MEMBERSHIP_PAGE,
            {'group': groupobj, 'member': member}, context_instance=RequestContext(request))

def membership(request, wechatid, group):
    groupobj = get_object_or_404(Group, id=group)
    try:
        member = Membership.objects.get(Q(wechatid=wechatid) & Q(targetid=group))
        return renderMemberPage(request, member, groupobj)
    except Membership.DoesNotExist:
        return redirect('membership_apply', wechatid=wechatid, group=group)
