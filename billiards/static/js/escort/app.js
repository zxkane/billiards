var currentPosition = null;
function fetchBMapLocation(callback) {
	if (currentPosition)
		callback(currentPosition);
	else
		new BMap.Geolocation().getCurrentPosition(function(r){
			if(this.getStatus() === BMAP_STATUS_SUCCESS){
				currentPosition = r.point;
				callback(currentPosition);
			}
		}, {enableHighAccuracy: false});
}

if(!Object.keys) Object.keys = function(o){
    if (o !== Object(o))
         throw new TypeError('Object.keys called on non-object');
    var ret=[],p;
    for(p in o) if(Object.prototype.hasOwnProperty.call(o,p)) ret.push(p);
    return ret;
}

moment.lang("zh-CN");

function refreshAuthentication() {
	if (isWechat())
		dologin('/user/login/wechat');
	else
		loginFirst();
}

function calcDistance(mypoint, locations) {
	var max = min = 0;
	for (var i = 0; i < locations.length; i++) {
		var dist = distance(mypoint, locations[i]);
		if (min == 0 || min > dist)
			min = dist;
		if (max == 0 || max < dist)
			max = dist;
	}
	if (min == max)
		offerdistance = formatDistance(min);
	else
		offerdistance = formatDistance(min) + "-" + formatDistance(max);
	return {'min': min, 'max': max, 'distanceLabel': offerdistance};
}

var offerServicesModule = angular.module('offerServices',[]);
offerServicesModule.service('NetworkService', function($http){});

angular.module("escortApp", ["ngRoute", "restangular"])

.config(function($interpolateProvider, $routeProvider) {
	  $interpolateProvider.startSymbol('<{');
	  $interpolateProvider.endSymbol('}>');
	})
	
.service('offerService', function(){
	var dayRange = _.range(3);
	var buffer = 2;
	
	
	function setTime(timestr, time) {
		var timearray = timestr.split(":");
		time.hour(timearray[0]);
		time.minute(0);
		return time;
	}
	
	this.offerPriceLocation = function(offers) {
		var maxprice = minprice = 0;
		var poolrooms = [];
		var locations = [];
		for (var i in dayRange) {
			for (var j = 0; j < offers[i].length; j++) {
				if (minprice == 0 || minprice > offers[i][j].price)
					minprice = offers[i][j].price;
				if (maxprice == 0 || maxprice < offers[i][j].price)
					maxprice = offers[i][j].price;
				if ($.inArray(offers[i][j].poolroom.name, poolrooms) == -1) {
					poolrooms.push(offers[i][j].poolroom);
					locations.push(new BMap.Point(
						offers[i][j].poolroom.lng, offers[i][j].poolroom.lat
					));
				}
			}
		}
		if (maxprice != minprice)
			offerprice = minprice + "-" + maxprice;
		else
			offerprice = minprice;
		
		return {'offerprice': offerprice, 'locations': locations, 'poolrooms': poolrooms, 'minprice': minprice,
			'maxprice': maxprice};
	}
	
	this.poolroomsDisplay = function(poolrooms) {
		var pnames = [];
		var pobj = {};
		for (var idx in poolrooms) {
			if (pobj[poolrooms[idx].name])
				continue;
			pobj[poolrooms[idx].name] = true;
			pnames.push(poolrooms[idx].name);
		}
		var pdisplay = '';
		if (pnames.length > 0)
			pdisplay = pnames.join("/");
		else
			pdisplay = pnames[0];
		return pdisplay;
	}
	
	this.latestOffer = function(offers){
		var now = moment().startOf("hour").add(1, 'h');
		var end = moment();
		var start = now.clone().add(buffer, 'h');
		for (var i in dayRange) {
			var min_start = null;
			var diffdays = moment().clone().startOf("day").diff(end.clone().startOf("day"), 'd');
			var inRange = false;
			for (var j = 0; j < offers[i].length; j++) {
				if (min_start == null)
					min_start = setTime(offers[i][j].starttime, end.clone());
				else if (min_start.diff(setTime(offers[i][j].starttime, end.clone())) > 0)
					min_start = setTime(offers[i][j].starttime, end.clone());
				if (start.diff(setTime(offers[i][j].endtime, end.clone())) < 0)
					inRange = true;
			}
			
			if (diffdays == 0) {
				if (start.diff(min_start) < 0)
					return min_start;
				else if (inRange)
					return start;
			} else if (min_start != null)
				return min_start;
			
			end.add(1, 'd');
		}
		return null;
	}
	
	this.formatLatestOffer = function(start) {
		return start === null ? "" : start.calendar();
	}
	
	this.offerDays = function(offers) {
		var offerdays = [];
		var starthour = moment().startOf("hour").add(buffer + 1, 'h');
		for (var i in dayRange) {
			var day = moment().startOf('day');
			day.add(i, 'd');
			hours = [];
			for (var j = 0; j < offers[i].length; j++) {
				var start, end;
				if (starthour.clone().startOf('day').diff(day, 'd') <= 0) {
					var start2 = setTime(offers[i][j].starttime, day.clone());
					start = starthour.diff(start2) > 0 ? starthour.clone() : start2;
					end = setTime(offers[i][j].endtime, day.clone());
				} else {
					continue;
				}
				if (end.diff(start, 'h') > 0) {
					hours = hours.concat(_.range(start.hour(), end.hour()));
				}
			}
			if (hours.length > 0) {
				offerdays.push({'hours': hours, 'day': day, 'offer': offers[i], 'idx': i});
			}
		}
		return offerdays;
	}
})

.controller("ProviderListCtrl", ["$scope", "Restangular", "offerService", function($scope, Restangular, offerService) {
	Restangular.one('assistant', 'list').get().then(function (assistants){
    	$scope.assistants = assistants;
    	for (var i = 0; i < $scope.assistants.length; i++) {
    		
    		var obj = offerService.offerPriceLocation($scope.assistants[i].offers);
			$scope.assistants[i].price = obj['offerprice'];
			$scope.assistants[i].locations = obj['locations'];
    		$scope.assistants[i].poolrooms = offerService.poolroomsDisplay(obj['poolrooms']);
    		$scope.assistants[i].latestOffer = offerService.formatLatestOffer(
    				offerService.latestOffer($scope.assistants[i].offers));
    	}
		fetchBMapLocation(function(mypoint) {
			for (var i = 0; i < $scope.assistants.length; i++) {
				$scope.assistants[i].distance = calcDistance(mypoint, $scope.assistants[i].locations)['distanceLabel'];
			}
			$scope.$apply();
		});
    });
}])

.controller('DetailCtrl', ['$scope', '$routeParams', "Restangular", "offerService", 
                           function($scope, $routeParams, Restangular, offerService) {
	
	$scope.init = function(uuid)
	  {
		var baseEscort = Restangular.one('assistant', uuid);
		baseEscort.post().then(function (assistant){
			escort = assistant[0];
			escort.age = _calculateAge(escort.birthday);
	    	$scope.assistant = escort;
	    });
		baseEscort.getList("offer").then(function (offers){
			offers = offers[0];
			$scope.offers = offers;
			
			var pricelocation = offerService.offerPriceLocation($scope.offers);
			 
			$scope.locations = pricelocation['locations'];
			$scope.offerprice = pricelocation['offerprice'];
			$scope.offerlocation = offerService.poolroomsDisplay(pricelocation['poolrooms']);;
			
			
			// calculate latest offer
			$scope.latestOffer = offerService.latestOffer($scope.offers);
			$scope.hasOffer = $scope.latestOffer != null;
			
			$scope.formatLatestOffer = offerService.formatLatestOffer;
			
			$scope.offerdays = function() {
				var offerdays = offerService.offerDays($scope.offers);
				if (offerdays.length > 0) {
					$scope.selectedOffer = offerdays[0];
					$scope.selectedOfferHour = offerdays[0].hours[0];
				}
				return offerdays;
			}($scope.offers);
			
			$scope.getDayLabel = function(offerday) {
				var dayofweek = offerday.day.format('D号(ddd)');
				var prefix = "";
				switch (parseInt(offerday.idx)) {
				case 0:
					prefix = "今天";
					break;
				case 1:
					prefix = "明天";
					break;
				case 2:
					prefix = "后天";
					break;
				}
				return prefix + " " + dayofweek;
			};
			
			$scope.getOffer = function() {
				if ($scope.selectedOffer.offer.length == 1)
					return $scope.selectedOffer.offer[0];
				for (var i = 0; i < $scope.selectedOffer.offer.length; i++) {
					var selected = moment().startOf("hour").hour($scope.selectedOfferHour);
					var start = setTime($scope.selectedOffer.offer[i].starttime, moment());
					var end = setTime($scope.selectedOffer.offer[i].endtime, moment());
					if (selected.diff(start) > 0 && end.diff(selected) > 0)
						return $scope.selectedOffer.offer[i];
				}
			};
			
			fetchBMapLocation(function(mypoint) {
				$scope.offerdistance = calcDistance(mypoint, $scope.locations)['distanceLabel'];
				$scope.$apply();
			});
			
			$scope.offerDuring = 1;
			$scope.booking = function() {
				if (AUTH === 1) {
					var params = {offerDay: $scope.selectedOffer.day.unix(), offerHour: $scope.selectedOfferHour, offerDuring: $scope.offerDuring};
					baseEscort.one('offer', 'booking').customPOST(params).then(function (rt){
						if (rt.code == 0)
							window.location = rt.payurl;
				    });
				} else {
					refreshAuthentication();
				}
			};
			//TODO load comments from server
			$scope.comments = [];
		});
	  };
	  
	function _calculateAge(birthday) { // birthday is a date
	    var ageDifMs = Date.now() - new Date(birthday).getTime();
	    var ageDate = new Date(ageDifMs); // miliseconds from epoch
	    return Math.abs(ageDate.getUTCFullYear() - 1970);
	}
}])

.controller('OrderCtrl', ['$scope', '$routeParams', "Restangular", function($scope, $routeParams, Restangular) {
	var myOrder = Restangular.one('user', 'order');
	myOrder.post().then(function (orders){
    	$scope.orders = orders;
    });
	
	function parseTime(timestr) {
		return moment(timestr, moment.ISO_8601).zone('+0800');
	}
	
	$scope.orderTime = function(timestr) {
		return parseTime(timestr).format('HH mm');
	};
	
	$scope.orderDate = function(timestr) {
		return parseTime(timestr).format('YYYY-MM-DD');
	};
	
	$scope.canPay = function(order) {
		if (order.transaction.state == 1 && parseTime(order.starttime).diff(moment()) > 60*60*2)
			return true;
		return false;
	}
	
	$scope.pay = function(order) {
		window.location = ORDER_URL.replace(/12345678901234567890123456789012/g, order.transaction.goods.sku);
	};
	
	$scope.orderStateDisplay = function(order) {
		switch (order.transaction.state) {
		case 5:
			return "订单已完成";
		case 4:
			return "订单已过期";
		case 3:
			return "订单已取消";
		case 2:
			if (order.state == 2)
				return "订单已支付，等待确认";
			else if (order.state == 32)
				return "订单已确认，等待消费";
			return "订单已支付";
		case 1:
			if ($scope.canPay(order))
				return "等待支付";
			return "订单已过期";
		}
	};
}]);
