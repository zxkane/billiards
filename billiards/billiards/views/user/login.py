# -*- coding: utf-8 -*-
# encoding: utf-8
'''
Created on 2013年12月11日

@author: baron
'''

from django.http import HttpResponseRedirect, Http404
from billiards.settings import SOCIALOAUTH_SITES
from billiards.support.socialoauth import SocialSites, SocialAPIError
from billiards.support.helper import UserStorage
from django.contrib.auth.models import User
from django.contrib import auth
from billiards.models import Profile
import random
import hashlib



def login_3rd(request, site_name):
    socialsites = SocialSites(SOCIALOAUTH_SITES)
    if site_name in socialsites._sites_name_list:
        _s = socialsites.get_site_object_by_name(site_name)
        url = _s.authorize_url
        return HttpResponseRedirect(url)
    else:
        raise Http404("Unknown login method '%s'." % site_name)

# not finished yet, to be continued...    
def callback(request, site_name):
    '''
    user store and manage should be replaced by django.contib.auth (TBD)
    '''
    code = request.GET.get('code')
    if not code:
        #error occurred
        return HttpResponseRedirect('/oautherror')
    
    socialsites = SocialSites(SOCIALOAUTH_SITES)
    _s = socialsites.get_site_object_by_name(site_name)
    
    try:
        _s.get_access_token(code)
    except SocialAPIError as e:
        print e.site_name   # the site_name which has error occurred
        print e.url         # the url requested
        print e.error_msg   # the error log returned from the site
        raise
    
    user = auth.authenticate(username=_s.uid[0:29], password=_s.site_name)
    
    if user is not None and user.is_active:
        auth.login(request, user)
        profile=request.user.get_profile()
    else:
        user = User.objects.create_user(username=_s.uid[0:29], password=_s.site_name)
        user.save()    
        profile = Profile(user = user)
        
    profile.nickname = _s.name
    profile.gender = _s.gender
    profile.avatar = _s.avatar
    profile.site_name = _s.site_name
    profile.save()
    
    return HttpResponseRedirect('/')
    

def logout(request):

    auth.logout(request)
    return HttpResponseRedirect('/')
    
    
def oautherror():
    print "OAuth Error"
    return HttpResponseRedirect('/')    #should have some ERROR info here, TBD
    
    
def gen_session_id():
    key = '%0.10f' % random.random()
    return hashlib.sha1(key).hexdigest()

def user_info(request):
    UID = request.session['uid']
    storage = UserStorage()
    if not UID:
        user = {'uid': None}
    else:
        user = storage.get_user(UID)
        
    return user
    
    