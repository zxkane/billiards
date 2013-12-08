function addMatchItems_v2(data) {
	function cleanMatchMarkers() {
		var overlays = map.getOverlays();
		for ( var m in overlays) {
			if (overlays[m] instanceof BMap.Marker
					&& overlays[m].getTitle() != '我的位置') {
				map.removeOverlay(overlays[m]);
			}
		}
	}

	if (data.length == 0) {
		if ($("#nomatch").length == 0) {
			$("#matchlist").children("#match").remove();
			createNoMatch();
			cleanMatchMarkers();
		}
	} else {
		$("#matchlist").children("#nomatch").remove();
		$("#matchlist").children("#match").remove();
		var ggpoints = [];
		for ( var idx in data) {
			ggPoint = new BMap.Point(data[idx].fields.poolroom.lng,
					data[idx].fields.poolroom.lat);
			ggpoints.push(ggPoint);
		}
		convertPoints(ggpoints, function(convertedPoints) {
			cleanMatchMarkers();
			for ( var idx in data) {
				matchobj = addMatchToList_v2(data[idx], convertedPoints[idx]);
				createMatchMarker(idx, matchobj.find("span[name=title]"));
			}
			$(document).foundation();
		});
	}
}

function addMatchToList_v2(match, point) {
	var matchobj = jQuery('<div/>', {
		class : 'row',
		id : 'match'
	});
	contentTemplate = "<div class=\"large-2 columns\">"
			+ "<div class=\"row panel\">$starttime</div></div>"
			+ "<div class=\"large-7 columns\">"
			+ "<div class=\"row panel\">"
			+ "<div class=\"large-2 columns\"><img src=\"http://foundation.zurb.com/docs/v/4.3.2/img/demos/demo1-th.jpg\"></div>"
			+ "<div class=\"large-7 columns\">"
			+ "<div class=\"row\">"
			+ "<h5><span name=\"title\" point=\"$point\" match=\"$matchjsonstr\"><u>$poolroomname</u></span></h5> 详情"
			+ "</div>"
			+ "<div class=\"row\">"
	equipment = "";
	if (match.fields.poolroom.flags.wifi)
		equipment += "<span class=\"ico_wifi\" title=\"公共区域WIFI\"></span>";
	if (match.fields.poolroom.flags.wifi_free)
		equipment += "<span class=\"ico_free_wifi\" title=\"公共区域WIFI\"></span>";
	if (match.fields.poolroom.flags.parking || match.fields.poolroom.flags.parking_free)
		equipment += "<span class=\"ico_parking\" title=\"停车场\"></span>";
	if (match.fields.poolroom.flags.cafeteria)
		equipment += "<span class=\"ico_restaurant\" title=\"餐饮服务\"></span>";
	if (match.fields.poolroom.flags.subway)
		equipment += "<span class=\"ico_bus\" title=\"地铁周边\"></span>";
	if (equipment != "") {
		contentTemplate += "<span class=\"icon_list\">";
		contentTemplate += "<div class=\"ico_none\">球房设施: </div>";
		contentTemplate += equipment;
		contentTemplate += "</span>";
	}
	contentTemplate += "</dvi></div></div><div class=\"large-3 columns\">"
			+ "<div class=\"row\">已报名人数:</div>"
			+ "<div class=\"row\">76人</div>"
			+ "<div class=\"row\">"
			+ "<a href=\"#\" class=\"small radius button\">我要报名</a>"
			+ "</div>"
			+ "</div>"
			+ "</div>"
			+ "</div>"
			+ "<div class=\"large-3 columns panel\">"
			+ "<div class=\"row\">冠军:</div>"
			+ "<div class=\"row\">现金: $bonus元</div>"
			+ "<div class=\"row\">比赛规则  奖金设置</div>"
			+ "</div>";
	contentTemplate = contentTemplate.replace(/\$point/g,
			point.lng + "," + point.lat).replace(/\$matchjsonstr/g,
			objectToJsonString([ match ])).replace(/\$poolroomname/g,
			match.fields.poolroom.name).replace(/\$starttime/g,
			getFormattedTime2(match.fields.starttime)).replace(/\$bonus/g, match.fields.bonus)
			.replace(/\$address/g, match.fields.poolroom.address).replace(/\$enrollfee/g, match.fields.enrollfee)
			.replace(/\$enrollfocalpoint/g, match.fields.enrollfocal);
	matchobj.append(contentTemplate);
	matchobj.appendTo('#matchlist');
	return matchobj;
}