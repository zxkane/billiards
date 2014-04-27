function formatDistance(distance) {
	if (distance < 1000) {
		return Math.floor(distance/100) * 100 + "米";
	} else {
		return Math.round(distance/100)/10 + "公里";
	}
}

R=6370996.81;//地球半径
function pi() {
	return Math.PI;
}
function distance(point1, point2) {
	return R*Math.acos(Math.cos(point1.lat*pi()/180 )*Math.cos(point2.lat*pi()/180)*Math.cos(point1.lng*pi()/180 -point2.lng*pi()/180)+
			Math.sin(point1.lat*pi()/180 )*Math.sin(point2.lat*pi()/180))
}

var PKLocation = function(mypos) {
	var position;

	var consumers = [];

	this.consume = function() {
		if (arguments.length === 0) {
			return;
		}
		if (position) {
			for (var i = 0; i < arguments.length; i++) {
				if (arguments[i] && typeof arguments[i] === 'function') {
					arguments[i](position);
				}
			}
		} else {
			consumers = consumers.concat(Array.prototype.slice.call(arguments, 0));
		}
	};
	
	if (mypos) {
		position = mypos;
	} else {
		var geolocation = new BMap.Geolocation();
		geolocation.getCurrentPosition(function(r){
			if(this.getStatus() === BMAP_STATUS_SUCCESS){
				position = r.point;
				for (var i = 0; i < consumers.length; i++) {
					if (consumers[i] && typeof consumers[i] === 'function') {
						consumers[i](position);
					}
				}
			} else {
	        	$("#info .subheader").text("无法获取您当前的位置，请刷新页面重试。");
			}
		}, {enableHighAccuracy: false});
	}
};

var PKMap = function(dom, center, zoom) {
	var map = new BMap.Map(dom);

	map.centerAndZoom(center, zoom);
	map.addControl(
		new BMap.NavigationControl({
			anchor: BMAP_ANCHOR_TOP_RIGHT,
			type: BMAP_NAVIGATION_CONTROL_SMALL}
		)
	);
	map.enableScrollWheelZoom(true);

	var _this = this;

	this.markCurrentLocation = function(myPosition) {
		_this.addMarker(myPosition, STATIC_URL + "images/location.png");
		// Custom control
		var control = new BMap.Control();
		$.extend(control, {
			defaultAnchor: BMAP_ANCHOR_TOP_LEFT,
			defaultOffset: new BMap.Size(10, 10)
		});
		control.initialize = function() {
			var div = document.createElement("div");
			div.appendChild(document.createTextNode("我的位置"));

			div.style.cursor = "pointer";
			div.style.border = "1px solid gray";
			div.style.backgroundColor = "white";

			div.onclick = function(e){
				// map.centerAndZoom(myPosition, zoom);
				map.panTo(myPosition);
			}
			map.getContainer().appendChild(div);
			return div;
		};
		map.addControl(control);
	};

	this.addMarker = function(point, iconPath) {
		var icon = new BMap.Icon(iconPath, new BMap.Size(39, 55), {
			anchor : new BMap.Size(15, 53),
			infoWindowAnchor : new BMap.Size(15, 0)
		});
		var marker = new BMap.Marker(point, {
			icon : icon
		});
		map.addOverlay(marker);
		return marker;
	};

	this.removeMarker = function(marker) {
		map.removeOverlay(marker);
	};

	this.setViewport = function(points) {
		map.setViewport(points);
	};
	
	this.innerMap = function() {
		return map;
	}
};

var PKPoolrooms = function(pkMap) {
	var markers = [],
		myPosition;

	// 球房模板
	var PoolroomTemplate = '\
		<div class="poolroom panel medium-pull-1 medium-offset-1 medium-3 columns">\
			<div class="pic">\
				{{#image}}\
					<img src="{{path}}" >\
				{{/image}}\
				{{^image}}\
					<img data-caption="MapShot" src="http://api.map.baidu.com/staticimage?center={{point}}&width=104&height=62&zoom=16&scale=2&markers={{point}}&markerStyles=-1">\
				{{/image}}\
			</div>\
			<div>\
				<h5>\
					<span name="title">\
						<a target="_blank" href="{{url}}">{{name}}</a>\
					</span>\
				</h5>\
				<p class="distance">距离我: {{distance}}</p>\
				{{#equip}}\
					<div class="equip icon_list">\
						<span class="ico_none">球房设施: </span>\
						{{#wifi}}\
							<span class="ico_wifi" title="公共区域WIFI"></span>\
						{{/wifi}}\
						{{#freeWifi}}\
							<span class="ico_free_wifi" title="公共区域WIFI"></span>\
						{{/freeWifi}}\
						{{#parking}}\
							<span class="ico_parking" title="停车场"></span>\
						{{/parking}}\
						{{#cafe}}\
							<span class="ico_restaurant" title="餐饮服务"></span>\
						{{/cafe}}\
						{{#subway}}\
							<span class="ico_bus" title="地铁周边"></span>\
						{{/subway}}\
					</div>\
				{{/equip}}\
				<p class="address">地址: {{address}}</p>\
				<p class="tel">电话: {{tel}}</p>\
				<p class="hour">营业时间: {{hour}}</p>\
				{{#coupon}}\
					<div><h5><b>优惠信息</b></h5></div>\
					{{#coupons}}\
						<div><h6><a target="_blank" href="{{url}}">{{title}}</a></h6></div>\
					{{/coupons}}\
				{{/coupon}}\
			</div>\
		</div>\
	';

	// 球房摘要模板
	var PoolroomInfoTemplate = '\
		<div class="mapBubbleInfo"><h6>{{name}}</h6>\
		<p>地址:\
			<code>{{address}}</code>\
		</p>\
		<p>营业时间:\
			<code>{{businessHours}}</code>\
		</p>\
		{{#distance}}\
			<p>距离我: \
				<code>{{.}}</code>\
			</p>\
		{{/distance}}\
	';

	this.loadPoolrooms = function(distance) {
		return function(myPos) {
			if (myPos) {
				myPosition = myPos;
			}
			for (var i = 0; i < markers.length; i++) {
				pkMap.removeMarker(markers[i]);
			}

			createInfo("正在加载附近的球房...");
    		$.ajax({
				url : NEARBY_URL.replace(/00\.00/g, myPosition.lat).replace(/11\.11/g, myPosition.lng)
						.replace(/00/g, distance),
				data : {'f':'json'},
				dataType : 'json',
				success : function(data) {
					if (data.length == 0) {
						$("#info .subheader").text("真遗憾，您附近没有我们收录的球房。");
					} else {
						$("#info").remove();
						layPoolrooms(data);
					}
				},
				error: function (xhr, ajaxOptions, thrownError) {
					$("#info .subheader").text("无法获取周边的球房，请刷新重试。");
				}
			});
		};
	};

	function layPoolrooms(data) {
		var points = [];
		for (var i = 0; i < data.length; i++) {
			var point = new BMap.Point(
				data[i].fields.lng_baidu,
				data[i].fields.lat_baidu
			);
			var poolroomObj = renderPoolroom(data[i], point);
			markers.push(createPoolroomMarker(poolroomObj, data[i], point));
			points.push(point);
		}

		$('#poolrooms .poolroom:nth-child(3n)').after('<br style="clear:both;">');
		if ($('#viewSwitch a.map').hasClass('active')) {
			$('#poolrooms').addClass('medium-3 columns').children('.poolroom').removeClass('medium-pull-1 medium-offset-1 medium-3');	
		}

		pkMap.setViewport(points);
	}

	function createPoolroomMarker(obj, poolroom, point) {
		var marker = pkMap.addMarker(point, STATIC_URL + "images/marker.png");
		marker.addEventListener("click", function() {
			poolroomInfo(marker, poolroom);
		});
		if (obj != null) {
			(function(){
				$(obj).click(
					function(event) {
						var link = $(obj);
						var clickingobj = $(event.target);
						if (clickingobj[0].tagName == 'A') {
							//TODO catch click event on link
						} else {
							poolroomInfo(marker, poolroom);
						}
					});
			})();
		}
		return marker;
	}
	
	function renderPoolroom(poolroom, point) {
		var view = {
				"point": point.lng + "," + point.lat,
				"name": poolroom.fields.name,
				"address": poolroom.fields.address,
				"tel": poolroom.fields.tel,
				"hour": poolroom.fields.businesshours,
				"distance": formatDistance(poolroom.fields.distance * 1000),
				"url": POOLROOM_URL.replace(/000/g, poolroom.pk)
			},
			images = Object.getOwnPropertyNames(poolroom.fields.images),
			image,
			coupons = Object.getOwnPropertyNames(poolroom.fields.coupons),
			coupon,
			equip = {},
			i;
		if (images.length !== 0) {
			view["image"] = {};
			for (i in images) {
				image = poolroom.fields.images[images[i]]
				if (image.fields.iscover) {
					view["image"]["path"] = MEDIA_URL + getThumbnail(image.fields.imagepath, '200');
				}
			}
		}

		poolroom.fields.flags.wifi && (equip["wifi"] = true);
		poolroom.fields.flags.freeWifi && (equip["freeWifi"] = true);
		(poolroom.fields.flags.parking || poolroom.fields.flags.parking_free) && (equip["parking"] = true);
		poolroom.fields.flags.cafeteria && (equip["cafe"] = true);
		poolroom.fields.flags.subway && (equip["subway"] = true);
		if (equip.hasOwnProperty()) {
			view["equip"] = equip;
		}

		if (coupons.length > 0) {
			view["coupon"] = {"coupons": []};
			for (i in coupons) {
				coupon = poolroom.fields.coupons[coupons[i]]
				view["coupon"]["coupons"].push({"url": coupon.fields.url}, {"title": coupon.fields.title});
			}
		}

		return $(Mustache.render(PoolroomTemplate, view)).appendTo('#poolrooms');
	}

	function poolroomInfo(marker, poolroom) {
		var view = {
			"name": poolroom.fields.name,
			"address": poolroom.fields.address,
			"businessHours": poolroom.fields.businesshours
		};
		if (poolroom.fields.distance) {
			view["distance"] = formatDistance(poolroom.fields.distance * 1000);
		}
		
		var infoWindow = new BMap.InfoWindow(Mustache.render(PoolroomInfoTemplate, view));
		marker.openInfoWindow(infoWindow);
		infoWindow.redraw();
	}
	
	this.createSinglePoolroomMarker = function(poolroom) {
		point = new BMap.Point(poolroom.fields.lng_baidu,
				poolroom.fields.lat_baidu);
		marker = createPoolroomMarker(null, poolroom, point);
		setTimeout(function(){
			pkMap.innerMap().panTo(point);
			marker.setAnimation(BMAP_ANIMATION_BOUNCE);
			setTimeout(function(){
				marker.setAnimation(null);
			}, 3000);
		}, 2500);
	};
};

function createInfo(text) {
	if ($("#info .subheader").length == 0) {
		var infoobj = jQuery('<div/>', {
			class : 'panel',
			id : 'info'
		});
		infoobj.append("<h3 class=\"subheader\">" + text + "</h3>");
		infoobj.appendTo('#content');
	} else {
		$("#info .subheader").text(text);
	}
}

function getThumbnail(filename, width) {
	return filename.replace(/(\.[\w\d_-]+)$/i, '-w'+width+'$1');
}

var PKChallenges = function(pkMap) {
	var markers = [],
		myPosition;
	
	var ChallengeTemplate = '\
		<div class="challenge panel medium-pull-1 medium-offset-1 medium-3 columns">\
			<div class="optional">\
				{{#image}}\
					<img src="{{path}}" >\
				{{/image}}\
				{{^image}}\
					<img data-caption="MapShot" src="http://api.map.baidu.com/staticimage?center={{point}}&width=104&height=62&zoom=16&scale=2&markers={{point}}&markerStyles=-1">\
				{{/image}}\
			</div>\
			<div>\
				<p class="optional">距离我: <code>{{distance}}</code></p>\
				{{#equip}}\
					<div class="optional icon_list">\
						<span class="ico_none">球房设施: </span>\
						{{#wifi}}\
							<span class="ico_wifi" title="公共区域WIFI"></span>\
						{{/wifi}}\
						{{#freeWifi}}\
							<span class="ico_free_wifi" title="公共区域WIFI"></span>\
						{{/freeWifi}}\
						{{#parking}}\
							<span class="ico_parking" title="停车场"></span>\
						{{/parking}}\
						{{#cafe}}\
							<span class="ico_restaurant" title="餐饮服务"></span>\
						{{/cafe}}\
						{{#subway}}\
							<span class="ico_bus" title="地铁周边"></span>\
						{{/subway}}\
					</div>\
				{{/equip}}\
				<p class="musthave">开始时间: <code>{{starttime}}</code></p>\
				<p class="optional">结束时间: <code>{{endtime}}</code></p>\
				<p class="musthave">一名<code>{{level}}</code> <code>{{nickname}}</code>发起在<a target="_blank" href="{{poolroomurl}}">{{name}}</a>的{{type}}</p>\
				<p class="musthave">{{contactway}}: <code>{{contact}}</code></p>\
				<p class="optional">球台类型: <code>{{tabletype}}</code></p>\
			</div>\
			<div class="show-for-touch show-for-small-only">\
				<a href="javascript:weixinSendAppMessage(\'{{nickname}}在我为台球狂发起的{{type}}\', \'我为台球狂，一个专注于台球的网站\', \'{{challenge_datail_url}}\', \'{{logo_url}}\');" class="button small secondary fi-share">  发送给好友</a>\
				<a href="javascript:weixinShareTimeline(\'{{nickname}}在我为台球狂发起的{{type}}\', \'我为台球狂，一个专注于台球的网站\', \'{{challenge_datail_url}}\', \'{{logo_url}}\');" class="button small secondary fi-social-picasa">  分享到朋友圈</a>\
			</div>\
		</div>\
	';
	
	var ChallengeInfoTemplate = '\
		<div class="mapBubbleInfo">\
		<p>一名<code>{{level}}</code> <code>{{nickname}}</code>发起在<a target="_blank" href="{{poolroomurl}}">{{name}}</a>的{{type}}</p>\
		<p>开始时间:\
			<code>{{starttime}}</code>\
		</p>\
		<p>结束时间:\
		<code>{{endtime}}</code>\
		</p>\
		<p>{{contactway}}: <code>{{contact}}</code></p>\
		<p>球台类型: <code>{{tabletype}}</code></p>\
		{{#distance}}\
			<p>距离我: \
				<code>{{.}}</code>\
			</p>\
		{{/distance}}\
	';
	
	this.loadChallenges = function() {
		return function(myPos) {
			if (myPos) {
				myPosition = myPos;
			}
			for (var i = 0; i < markers.length; i++) {
				pkMap.removeMarker(markers[i]);
			}

			createInfo("正在加载约球信息...");
			url = CHALLENGE_URL;
			if (myPosition != null) {
				url = CHALLENGE_WITH_DISTANCE_URL;
				url = url.replace(/00\.00/g, myPosition.lat).replace(/11\.11/g, myPosition.lng);
			}
			$.ajax({
				url : url,
				data : {'f':'json'},
				dataType : 'json',
				success : function(data)
				{
					if (data.length == 0) {
						$("#info .subheader").text("真遗憾，暂时没有球友和俱乐部发布的约球信息。");
					} else {
						$("#info").remove();
						layChallenges(data);
						$(document).foundation({
					    	abide: abideOptions
					    });
					}
				},
				error: function (xhr, ajaxOptions, thrownError) {
					$("#info .subheader").text("无法获取约球信息，请刷新重试。");
			     }
			});
		};
	};
	
	this.layChallenge = function(data) {
		layChallenges(data);
		$('#challenges').addClass('map medium-3 columns').children('.challenge').removeClass('medium-pull-1 medium-offset-1 medium-3');	
		pkMap.innerMap().panTo(markers[0].getPosition());
		pkMap.innerMap().tilesloaded(function(type, target) {
			pkMap.innerMap().panTo(markers[0].getPosition());
		});
	};
	
	this.updateMyPosition = function(challenge) {
		return function(myPos) {
			if (myPos) {
				myPosition = myPos;
			}
			var point = new BMap.Point(
					challenge.fields.lng_baidu,
					challenge.fields.lat_baidu
				);
			pkMap.innerMap().panTo(point);
		}
	}
	
	function layChallenges(data) {
		var points = [];
		for (var i = 0; i < data.length; i++) {
			var point = new BMap.Point(
				data[i].fields.lng_baidu,
				data[i].fields.lat_baidu
			);
			var challengeObj = renderChallenge(data[i], point);
			markers.push(createChallengeMarker(challengeObj, data[i], point));
			points.push(point);
		}

		$('#challenges .challenge:nth-child(3n)').after('<br style="clear:both;">');
		if ($('#viewSwitch a.map').hasClass('active')) {
			$('#challenges').addClass('map medium-3 columns').children('.challenge').removeClass('medium-pull-1 medium-offset-1 medium-3');	
		}

		pkMap.setViewport(points);
	}
	
	function challengeToView(challenge, point) {
		var view = {
				"point": point.lng + "," + point.lat,
				"name": challenge.fields.poolroom.name,
				"poolroomurl": POOLROOM_URL.replace(/000/g, challenge.fields.poolroom.id),
				"starttime": getSmartTime(challenge.fields.starttime),
				"endtime": getSmartTime(challenge.fields.expiretime),
				"level": challenge.fields.level,
				"nickname": challenge.fields.issuer_nickname == null ? "" : challenge.fields.issuer_nickname,
				"type": challenge.fields.source == 1 ? "约赛" : "抢台费",
				"tabletype": challenge.fields.tabletype,
				"challenge_datail_url": CHALLENGE_DETAIL_URL.replace(/000/g, challenge.fields.id),
				"logo_url": LOGO_URL,
			};
		var protocols = [["tel://", "电话"], ["qq://", "QQ"], ["wechat://", "微信"]];
		for (idx in protocols) {
			protocol = protocols[idx];
			if (challenge.fields.issuer_contact.indexOf(protocol[0]) == 0) {
				method = protocol[1];
				contactinfo = challenge.fields.issuer_contact.substring(protocol[0].length);
				break;
			}
		}
		if (method == undefined) {
			method = "联系方式";
			contactinfo = challenge.fields.issuer_contact;
		}
		view["contactway"] = method;
		view["contact"] = contactinfo;
		if (challenge.fields.source == 2 && challenge.fields.location != '') {
			view["name"] = "地图位置";
			view["poolroomurl"] = "javascript:void(0);";
			locationdata = challenge.fields.location.split(":");
			if (locationdata.length > 1)
				view["name"] = locationdata[1];
		}
		return view;
	}
	
	function renderChallenge(challenge, point) {
		var view = challengeToView(challenge, point),
			images = Object.getOwnPropertyNames(challenge.fields.poolroom.images),
			image,
			equip = {},
			i;
		if (images.length !== 0) {
			view["image"] = {};
			for (i in images) {
				image = challenge.fields.poolroom.images[images[i]]
				if (image.iscover) {
					view["image"]["path"] = MEDIA_URL + getThumbnail(image.imagepath, '200');
				}
			}
		}
		view["distance"] = myPosition == null ? "正在获取你的位置" : formatDistance(distance(myPosition, point));
		challenge.fields.poolroom.flags.wifi && (equip["wifi"] = true);
		challenge.fields.poolroom.flags.freeWifi && (equip["freeWifi"] = true);
		(challenge.fields.poolroom.flags.parking || challenge.fields.poolroom.flags.parking_free) && (equip["parking"] = true);
		challenge.fields.poolroom.flags.cafeteria && (equip["cafe"] = true);
		challenge.fields.poolroom.flags.subway && (equip["subway"] = true);
		if (equip.hasOwnProperty()) {
			view["equip"] = equip;
		}
		
		if (challenge.fields.source == 1) {
			//TODO add challege apply
		}

		return $(Mustache.render(ChallengeTemplate, view)).appendTo('#challenges');
	}	
	
	
	function createChallengeMarker(obj, challenge, point) {
		var marker = pkMap.addMarker(point, STATIC_URL + "images/marker.png");
		marker.addEventListener("click", function() {
			challengeInfo(marker, challenge, point);
		});
		if (obj != null) {
			(function(){
				$(obj).click(
					function(event) {
						var link = $(obj);
						var clickingobj = $(event.target);
						if (clickingobj[0].tagName == 'A') {
							//TODO catch click event on link
						} else {
							challengeInfo(marker, challenge, point);
						}
					});
			})();
		}
		return marker;
	}
	
	function challengeInfo(marker, challenge, point) {
		var view = challengeToView(challenge, point);
		if (myPosition != null) {
			view["distance"] = formatDistance(distance(myPosition, point));
		}
		
		pkMap.innerMap().panTo(point);
		var infoWindow = new BMap.InfoWindow(Mustache.render(ChallengeInfoTemplate, view));
		marker.openInfoWindow(infoWindow);
		infoWindow.redraw();
	}
}

var PKMatches = function(pkMap) {
	var CalendarTemplate = '\
		{{#monthes}}\
			<dl class="sub-nav">\
				<dt><strong>{{month}}</strong></dt>\
				{{#days}}\
				<dd timestamp="{{timestamp}}" class="{{active}}"><a class="{{money}}" href="javascript:void(0);">{{day}}</a></dd>\
				{{/days}}\
			</dl>\
		{{/monthes}}\
	';
	
	var MatchTemplate = '\
		<div class="match panel medium-pull-1 medium-offset-1 medium-3 columns">\
			<div class="optional">\
				{{#image}}\
					<img src="{{path}}" >\
				{{/image}}\
				{{^image}}\
					<img data-caption="MapShot" src="http://api.map.baidu.com/staticimage?center={{point}}&width=104&height=62&zoom=16&scale=2&markers={{point}}&markerStyles=-1">\
				{{/image}}\
			</div>\
			<div>\
				<p class="optional">距离我: <code>{{distance}}</code></p>\
				<p class="musthave"><a href="{{match_detail_url}}">{{title}}</a></p>\
				<p class="musthave">{{type}}球馆: <a href="{{poolroom_url}}">{{poolroom_name}}</a></p>\
				{{#equip}}\
					<div class="optional icon_list">\
						<span class="ico_none">球房设施: </span>\
						{{#wifi}}\
							<span class="ico_wifi" title="公共区域WIFI"></span>\
						{{/wifi}}\
						{{#freeWifi}}\
							<span class="ico_free_wifi" title="公共区域WIFI"></span>\
						{{/freeWifi}}\
						{{#parking}}\
							<span class="ico_parking" title="停车场"></span>\
						{{/parking}}\
						{{#cafe}}\
							<span class="ico_restaurant" title="餐饮服务"></span>\
						{{/cafe}}\
						{{#subway}}\
							<span class="ico_bus" title="地铁周边"></span>\
						{{/subway}}\
					</div>\
				{{/equip}}\
				<p class="musthave">开始时间: <code>{{starttime}}</code></p>\
				{{#hasPrize}}\
				<p class="musthave">比赛奖金: <code>\
				{{#bonus}}\
				现金: {{bonus}}元\
				{{/bonus}}\
				{{#rechargeablecard}}\
				俱乐部充值卡: {{rechargeablecard}}元\
				{{/rechargeablecard}}\
				{{#otherprize}}\
				{{otherprize}}\
				{{/otherprize}}\
				</code></p>\
				{{/hasPrize}}\
				<p class="optional">报名费: <code>{{enroll_fee}}</code></p>\
				{{#enroll_focal}}\
				<p class="optional">报名联系人: <code>{{enroll_focal}}</code></p>\
				{{/enroll_focal}}\
			</div>\
		</div>\
	';
	
	this.buildCalendar = function(starttime, endtime, bonusobj, summary, intervals) {
		var bonussummary = {};
		for (var idx in bonusobj) {
			bonussummary[bonusobj[idx].starttime] = bonusobj[idx].bonus;
		}
		
		var m = moment.utc([starttime.year(), starttime.month(), starttime.dates(), starttime.hour(), starttime.minute(), starttime.second()]);
		var selectedTimestamp = getParameterByName('s');
		if (selectedTimestamp != null) {
			var initialDay = moment.unix(selectedTimestamp);
			if (!(initialDay.unix() >= starttime.unix() && initialDay.unix() <= endtime.unix()))
				initialDay = null;
		}
		var thismonth = m.month();
		view = {
			"monthes": [
			    {"month": m.lang('zh_CN').format('MMM')},
			]
		};
		var days = [];
		for (var i = 0; i < intervals; i++) {
			if (m.month() != thismonth) {
				view["monthes"][view["monthes"].length - 1]["days"] = days;
				days = [];
				thismonth = m.month();
				view["monthes"].push({"month": m.lang('zh_CN').format('MMM')});
			}
			var day = {
				"day": m.format('DD') + " " + m.format('dddd'),
				"timestamp": m.unix(),
			};
			if (initialDay != null) {
				if (m.date() == initialDay.date() && m.month() == initialDay.month())
					day["active"] = "active";
			} else if (m.date() == starttime.date() && m.month() == starttime.month())
				day["active"] = "active";
			var formattedday = m.format("YYYY-MM-DD");
			if (formattedday in summary) {
				day["day"] += "(" + summary[formattedday] + ")";
			}
			if (formattedday in bonussummary) {
				day["money"] = "fi-trophy";
			}
			m.add('days', 1);
			days.push(day);
		}
		view["monthes"][view["monthes"].length - 1]["days"] = days;
		
		return $(Mustache.render(CalendarTemplate, view)).appendTo('#calendarSelect');
	};
	
	this.layMatches = layMatches;
	
	function layMatches(data) {
		var points = [];
		for (var i = 0; i < data.length; i++) {
			var point = new BMap.Point(
				data[i].fields.poolroom.lng,
				data[i].fields.poolroom.lat
			);
			var matchObj = renderMatch(data[i], point);
//			markers.push(createMatchMarker(matchObj, data[i], point));
			points.push(point);
		}

		$('#matches .match:nth-child(3n)').after('<br style="clear:both;">');
		if ($('#viewSwitch a.map').hasClass('active')) {
			$('#matches').addClass('medium-3 columns').children('.match').removeClass('medium-pull-1 medium-offset-1 medium-3');	
		}

		pkMap.setViewport(points);
	}
	
	function matchToView(match, point) {
		var view = {
				"point": point.lng + "," + point.lat,
				"poolroom_name": match.fields.poolroom.name,
				"poolroomurl": POOLROOM_URL.replace(/000/g, match.fields.poolroom.id),
				"starttime": getSmartTime(match.fields.starttime),
				"title": match.fields.title,
				"enroll_fee": match.fields.enrollfee,
				"enroll_focal": match.fields.enrollfocal,
			};
		
		if (match.fields.type == 1) {
			view["match_detail_url"] = MATCH_URL.replace(/000/g, match.pk);
			view["hasPrize"] = true;
			if (match.fields.bonus > 0)
				view["bonus"] = match.fields.bonus;
			if (match.fields.rechargeablecard > 0)
				view["rechargeablecard"] = match.fields.rechargeablecard;
			if (match.fields.otherprize != null)
				view["otherprize"] = match.fields.otherprize;
		}
		else 
			view["match_detail_url"] = ACTIVITY_URL.replace(/000/g, match.pk);

		return view;
	}
	
	function renderMatch(match, point) {
		var view = matchToView(match, point),
			images = Object.getOwnPropertyNames(match.fields.poolroom.images),
			image,
			equip = {},
			i;
		if (images.length !== 0) {
			view["image"] = {};
			for (i in images) {
				image = match.fields.poolroom.images[images[i]];
				if (image.iscover) {
					view["image"]["path"] = MEDIA_URL + getThumbnail(image.imagepath, '200');
				}
			}
		}

		match.fields.poolroom.flags.wifi && (equip["wifi"] = true);
		match.fields.poolroom.flags.freeWifi && (equip["freeWifi"] = true);
		(match.fields.poolroom.flags.parking || match.fields.poolroom.flags.parking_free) && (equip["parking"] = true);
		match.fields.poolroom.flags.cafeteria && (equip["cafe"] = true);
		match.fields.poolroom.flags.subway && (equip["subway"] = true);
		if (equip.hasOwnProperty()) {
			view["equip"] = equip;
		}

		return $(Mustache.render(MatchTemplate, view)).appendTo('#matches');
	}
}