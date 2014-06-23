from django.shortcuts import render_to_response
from billiards.settings import TEMPLATE_ROOT
from django.template.context import RequestContext

def lottery(request):
    return render_to_response(TEMPLATE_ROOT + 'lottery/lottery.html', context_instance=RequestContext(request))
