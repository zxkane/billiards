# -*- coding: utf-8 -*-
# encoding: utf-8
'''
Created on 2014年2月26日

@author: kane
'''
from django.test import TestCase
from django.test.client import Client
from django.core.urlresolvers import reverse
from django.utils.encoding import smart_str
from xml.etree import ElementTree as ET
from billiards.models import Match, WechatActivity
from django.utils import simplejson, timezone
import datetime

def parse_tree(root):
    msg = {}
    for child in root:
        if len(child) > 0:
            value = parse_tree(child)
            if child.tag in msg:
                values = []
                if isinstance(msg[child.tag], (list)):
                    values = msg[child.tag]
                else:
                    values.append(msg[child.tag])
                values.append(value)
                msg[child.tag] = values
            else:
                msg[child.tag] = value
        else:
            msg[child.tag] = child.text
    return msg

def parse_msg(content):
    print content
    recvmsg = smart_str(content)
    root = ET.fromstring(recvmsg)
    return parse_tree(root)

class WechatTest(TestCase):
    
    fixtures = ['poolroom.json', 'match.json', 'group.json', 'coupon.json', 'event.json', 'challenge.json']
    
    def setUp(self):
        self.client = Client()
        
    def test_subscription_event(self):
        data = """
        <xml><ToUserName>pktaiqiu</ToUserName>
        <FromUserName>newuser</FromUserName>
        <CreateTime>123456789</CreateTime>
        <MsgType>event</MsgType>
        <Event>subscribe</Event>
        <EventKey>subscribe</EventKey>
        </xml>
        """
        msg = self._send_wechat_message(data)
        self.assertEqual("pktaiqiu", msg['FromUserName'])
        self.assertEqual("newuser", msg['ToUserName'])
        activityquery = WechatActivity.objects.filter(eventtype='event')
        self.assertEqual(1, activityquery.count())
        activity = activityquery[:1][0]
        self.assertEqual('newuser', activity.userid)
        self.assertEqual('subscribe', activity.keyword)
        msg = simplejson.loads(activity.message)
        self.assertEqual('subscribe', msg['event'])
        self.assertEqual('subscribe', msg['eventkey'])
        
    def test_location_event(self):
        data = """
        <xml>
        <ToUserName><![CDATA[toUser]]></ToUserName>
        <FromUserName><![CDATA[fromUser]]></FromUserName>
        <CreateTime>1393804800</CreateTime>
        <MsgType><![CDATA[location]]></MsgType>
        <Location_X>40.094799793619</Location_X>
        <Location_Y>116.36137302268</Location_Y>
        <Scale>20</Scale>
        <Label><![CDATA[位置信息]]></Label>
        <MsgId>1234567890123456</MsgId>
        </xml> 
        """
        msg = self._send_wechat_message(data)
        self.assertTrue('ArticleCount' in msg)
        self.assertEqual(3, int(msg['ArticleCount']))
        self.assertEqual(u'北京黑桃8撞球馆上坡家园店', msg['Articles']['item'][0]['Title'])
        self.assertTrue(msg['Articles']['item'][0]['PicUrl'].startswith('http://api.map.baidu.com/staticimage'))
        activityquery = WechatActivity.objects.filter(eventtype='location')
        self.assertEqual(1, activityquery.count())
        activity = activityquery[:1][0]
        self.assertEqual('fromUser', activity.userid)
        self.assertEqual(u'北京黑桃8撞球馆上坡家园店', activity.keyword)
        msg = simplejson.loads(activity.message)
        self.assertEqual(u'40.094799793619', msg['lat'])
        self.assertEqual(u'116.36137302268', msg['lng'])
        reply = simplejson.loads(activity.reply)
        self.assertEqual(u'北京黑桃8撞球馆上坡家园店', reply['name'])
        self.assertEqual(148, reply['id'])
        utctime = datetime.datetime.utcfromtimestamp(1393804800)
        self.assertEqual(utctime.replace(tzinfo=timezone.utc), activity.receivedtime)
        # the poolroom has coupon
        data = """
        <xml>
        <ToUserName><![CDATA[toUser]]></ToUserName>
        <FromUserName><![CDATA[fromUser]]></FromUserName>
        <CreateTime>1393977600</CreateTime>
        <MsgType><![CDATA[location]]></MsgType>
        <Location_X>40.0823690</Location_X>
        <Location_Y>116.3582070</Location_Y>
        <Scale>20</Scale>
        <Label><![CDATA[位置信息]]></Label>
        <MsgId>1234567890123456</MsgId>
        </xml> 
        """
        msg = self._send_wechat_message(data)
        self.assertTrue('ArticleCount' in msg)
        self.assertEqual(4, int(msg['ArticleCount']))
        self.assertEqual(u'北京98台球俱乐部', msg['Articles']['item'][0]['Title'])
        # the poolroom has imgaes
        data = """
        <xml>
        <ToUserName><![CDATA[toUser]]></ToUserName>
        <FromUserName><![CDATA[fromUser]]></FromUserName>
        <CreateTime>1393977600</CreateTime>
        <MsgType><![CDATA[location]]></MsgType>
        <Location_X>39.9349310</Location_X>
        <Location_Y>116.3733030</Location_Y>
        <Scale>20</Scale>
        <Label><![CDATA[位置信息]]></Label>
        <MsgId>1234567890123456</MsgId>
        </xml> 
        """
        msg = self._send_wechat_message(data)
        self.assertTrue('ArticleCount' in msg)
        self.assertEqual(3, int(msg['ArticleCount']))
        self.assertEqual(u'北京夜时尚护国寺店', msg['Articles']['item'][0]['Title'])
        self.assertTrue(msg['Articles']['item'][0]['PicUrl'].startswith('http://billiardsalbum.bcs.duapp.com/resources/poolroom'))
        
    def _send_wechat_message(self, data):
        response = self.client.post(reverse('weixin'), data, "application/xml")
        self.assertEqual(response.status_code, 200)
        msg = parse_msg(response.content)
        return msg
    
    def test_text_match_message(self):
        self.assertEqual(2, Match.objects.filter(type=1).count())
        data = u"""
        <xml>
        <ToUserName><![CDATA[toUser]]></ToUserName>
        <FromUserName><![CDATA[fromUser]]></FromUserName> 
        <CreateTime>1393628400</CreateTime>
        <MsgType><![CDATA[text]]></MsgType>
        <Content><![CDATA[比赛]]></Content>
        <MsgId>1234567890123456</MsgId>
        </xml>
        """
        msg = self._send_wechat_message(data)
        self.assertTrue('ArticleCount' in msg)
        self.assertEqual(1, int(msg['ArticleCount']))
        activityquery = WechatActivity.objects.filter(eventtype='text')
        self.assertEqual(1, activityquery.count())
        activity = activityquery[:1][0]
        self.assertEqual('fromUser', activity.userid)
        msg = simplejson.loads(activity.message)
        self.assertEqual(u'比赛', msg['content'])
        reply = simplejson.loads(activity.reply)
        self.assertEqual(1, reply['count'])
        
    def test_text_activity_message(self):
        self.assertEqual(2, Match.objects.filter(type=2).count())
        # no activity in 7 days, submitted on 2014-02-27
        data = u"""
        <xml>
        <ToUserName><![CDATA[toUser]]></ToUserName>
        <FromUserName><![CDATA[fromUser]]></FromUserName> 
        <CreateTime>1393459200</CreateTime>
        <MsgType><![CDATA[text]]></MsgType>
        <Content><![CDATA[活动]]></Content>
        <MsgId>1234567890123456</MsgId>
        </xml>
        """
        msg = self._send_wechat_message(data)
        self.assertTrue('ArticleCount' in msg)
        self.assertEqual(1, int(msg['ArticleCount']))
        self.assertEqual(u'最近7天内没有被收录的爱好者活动', msg['Articles']['item']['Title'])
        
        # two activities in 7 days, submitted on 2014-03-05
        data = u"""
        <xml>
        <ToUserName><![CDATA[toUser]]></ToUserName>
        <FromUserName><![CDATA[fromUser]]></FromUserName> 
        <CreateTime>1393977600</CreateTime>
        <MsgType><![CDATA[text]]></MsgType>
        <Content><![CDATA[活动]]></Content>
        <MsgId>1234567890123456</MsgId>
        </xml>
        """
        msg = self._send_wechat_message(data)
        self.assertTrue('ArticleCount' in msg)
        self.assertEqual(2, int(msg['ArticleCount']))
        
    def test_text_coupon_message(self):
        data = u"""
        <xml>
        <ToUserName><![CDATA[toUser]]></ToUserName>
        <FromUserName><![CDATA[fromUser]]></FromUserName> 
        <CreateTime>1393459200</CreateTime>
        <MsgType><![CDATA[text]]></MsgType>
        <Content><![CDATA[团购]]></Content>
        <MsgId>1234567890123456</MsgId>
        </xml>
        """
        msg = self._send_wechat_message(data)
        self.assertTrue('ArticleCount' in msg)
        self.assertEqual(2, int(msg['ArticleCount']))
        
    def test_text_yunchuan_coupon_message(self):
        data = u"""
        <xml>
        <ToUserName><![CDATA[toUser]]></ToUserName>
        <FromUserName><![CDATA[fromUser]]></FromUserName> 
        <CreateTime>1393459200</CreateTime>
        <MsgType><![CDATA[text]]></MsgType>
        <Content><![CDATA[yunchuan]]></Content>
        <MsgId>1234567890123456</MsgId>
        </xml>
        """
        msg = self._send_wechat_message(data)
        self.assertTrue('ArticleCount' in msg)
        self.assertEqual(2, int(msg['ArticleCount']))
        
    def test_text_pic_message(self):
        data = u"""
        <xml>
        <ToUserName><![CDATA[toUser]]></ToUserName>
        <FromUserName><![CDATA[fromUser]]></FromUserName> 
        <CreateTime>1393459200</CreateTime>
        <MsgType><![CDATA[text]]></MsgType>
        <Content><![CDATA[花式]]></Content>
        <MsgId>1234567890123456</MsgId>
        </xml>
        """
        msg = self._send_wechat_message(data)
        self.assertTrue('ArticleCount' in msg)
        self.assertEqual(1, int(msg['ArticleCount']))
        
    def test_location_specialevent_event(self):
        data = """
        <xml>
        <ToUserName><![CDATA[toUser]]></ToUserName>
        <FromUserName><![CDATA[fromUser]]></FromUserName>
        <CreateTime>1395446400</CreateTime>
        <MsgType><![CDATA[location]]></MsgType>
        <Location_X>40.094799793619</Location_X>
        <Location_Y>116.36137302268</Location_Y>
        <Scale>20</Scale>
        <Label><![CDATA[位置信息]]></Label>
        <MsgId>1234567890123456</MsgId>
        </xml> 
        """
        msg = self._send_wechat_message(data)
        self.assertTrue('ArticleCount' in msg)
        self.assertEqual(4, int(msg['ArticleCount']))
        self.assertEqual(u'北京黑桃8撞球馆上坡家园店', msg['Articles']['item'][1]['Title'])
        self.assertTrue(msg['Articles']['item'][1]['PicUrl'].startswith('http://api.map.baidu.com/staticimage'))
        self.assertEqual(u'台球免费打', msg['Articles']['item'][0]['Title'])
        self.assertTrue(msg['Articles']['item'][0]['PicUrl'].startswith('http://bcs.duapp.com/billiardsalbum/2014/03/activity.jpg'))
    
    def test_extend_date_special_event(self):
        data = u"""
        <xml>
        <ToUserName><![CDATA[toUser]]></ToUserName>
        <FromUserName><![CDATA[fromUser]]></FromUserName> 
        <CreateTime>1396577902</CreateTime>
        <MsgType><![CDATA[text]]></MsgType>
        <Content><![CDATA[yunchuan]]></Content>
        <MsgId>1234567890123456</MsgId>
        </xml>
        """
        msg = self._send_wechat_message(data)
        self.assertTrue('ArticleCount' in msg)
        self.assertEqual(2, int(msg['ArticleCount']))
        self.assertEqual(u'抢台费送话费', msg['Articles']['item'][0]['Title'])
        self.assertTrue(msg['Articles']['item'][0]['Url'].startswith('http://www.pktaiqiu.com/event/2014/04/qiang-tai-fei-yue-qiu'))
        
    def test_nearby_challenges(self):
        data = """
        <xml>
        <ToUserName><![CDATA[toUser]]></ToUserName>
        <FromUserName><![CDATA[fromUser]]></FromUserName>
        <CreateTime>1397285999</CreateTime>
        <MsgType><![CDATA[location]]></MsgType>
        <Location_X>39.8894880</Location_X>
        <Location_Y>116.466469</Location_Y>
        <Scale>20</Scale>
        <Label><![CDATA[位置信息]]></Label>
        <MsgId>1234567890123456</MsgId>
        </xml> 
        """
        msg = self._send_wechat_message(data)
        self.assertTrue('ArticleCount' in msg)
        self.assertEqual(5, int(msg['ArticleCount']))
        self.assertTrue(msg['Articles']['item'][4]['Title'].startswith(u'小婷'))
        