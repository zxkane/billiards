from django.shortcuts import render_to_response
from billiards.settings import TEMPLATE_ROOT
from django.template.context import RequestContext

def about(request):
    return render_to_response(TEMPLATE_ROOT + 'about/about.html', context_instance=RequestContext(request))

def join(request):
    return render_to_response(TEMPLATE_ROOT + 'about/join.html', context_instance=RequestContext(request))

def pictureservice(request):
    return render_to_response(TEMPLATE_ROOT + 'about/pictureservice.html', context_instance=RequestContext(request))

def contact(request):
    return render_to_response(TEMPLATE_ROOT + 'about/contact.html', context_instance=RequestContext(request))

def partner(request):
    return render_to_response(TEMPLATE_ROOT + 'about/partner.html', context_instance=RequestContext(request))

def home(request):
    return render_to_response(TEMPLATE_ROOT + 'index-2.html', context_instance=RequestContext(request))

def home1(request):
    return render_to_response(TEMPLATE_ROOT + 'index-3.html', context_instance=RequestContext(request))
