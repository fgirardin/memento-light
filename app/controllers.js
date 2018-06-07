var instagramAppControllers = angular.module('instagramApp.controllers', []);

var AppController = instagramAppControllers.controller('AppController', function ($rootScope, $scope, AuthenticationService, instagramApi) {

    $scope.isLoggedIn = function(){

        if(AuthenticationService.isLoggedIn()){
            return true;
        }else{
            return false;
        }
    };

    //common variables
    $rootScope.authLink = AuthenticationService.getAuthLink();
    if($rootScope.globals.currentUser) {
        AuthenticationService.getRequestedBy(function(response){
            $scope.serviceMeta = response.meta;
            $rootScope.userRequests = response.data;
        });
    }

    //common method
    $scope.isOwn = function(userId){
        if( $scope.isLoggedIn() ) {
            if( AuthenticationService.getCurrentUser().userId == userId ) {
                return true;
            }
        }else {
            return false;
        }
    }
});

var navController = instagramAppControllers.controller('navController', function($scope, AuthenticationService, $location){

    $scope.isLoggedIn = function(){
        if(AuthenticationService.isLoggedIn()){
            $scope.user = AuthenticationService.getCurrentUser();
            return true;
        }else{
            return false;
        }

    };

    $scope.signOut = function(){
        AuthenticationService.ClearCredentials();
        $location.path("/#");

    };

    $scope.refresh = function(){
        AuthenticationService.getUserSelf();
    };

});



var loginController = instagramAppControllers.controller('loginController', function ($scope, $stateParams, AuthenticationService, instagramApi, $location) {

    $scope.$on('$viewContentLoaded', function () {
        $scope.accessToken = $stateParams.accessToken;
        AuthenticationService.setAuth($scope.accessToken);
        AuthenticationService.getUserSelf(function (response) {
            $scope.serviceMeta = response.meta;
            $location.path("/#");
        });
    });
});


var IndexController = instagramAppControllers.controller('IndexController', function ($scope, $localStorage, instagramApi, googleApi, AuthenticationService, $timeout) {

    $scope.follows = [];
    $scope.users = [];

    $scope.serviceMeta = {};

    $scope.$storage = $localStorage;

    if ($scope.$storage.travelers == null){
        $scope.travelers = [];
    } else {
        $scope.travelers = $scope.$storage.travelers;
    }

    console.log("travelers");
    console.log($scope.travelers);

    $scope.geocodeLevels = ['neighborhood', 'locality', 'administrative_area_level_1', 'country'];    

    $scope.epsValues = [2, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02, 0.01, 0.009, 0.008, 0.007, 0.006, 0.005, 0.004, 0.003, 0.002, 0.001];      

    $scope.max_locations = 15;

    $scope.min_locations = 5;



    $scope.setLayout = function (layout) {
        $scope.layout = layout;
        $scope.nextIterator = false;
    };    

    $scope.init = function(){
        if ($scope.isLoggedIn()){
            $scope.user = AuthenticationService.getCurrentUser();
            //set the 'you' traveler
            if ($scope.travelers.length == 0){
                var traveler0 = {id: $scope.user.userId, username: $scope.user.username, 
                                profile_picture: $scope.user.profile_picture,
                                full_name: $scope.user.full_name};            
                $scope.getUserData(traveler0);                                
            }

            //load instagram users
            $scope.getFollows();
        }
    }

    $scope.getFollows = function(nextIterator){

        //setting layout
        $scope.setLayout('getFollows');

        instagramApi.getFollows($scope.userId, function(response){
            $scope.serviceMeta = response.meta;
            $scope.follows = $scope.follows.concat(response.data);
            $scope.nextIterator = response.pagination.next_cursor;
        }, nextIterator);
    };

    $scope.search = function () {

        instagramApi.searchUser($scope.username, function (response) {
            $scope.serviceMeta = response.meta;
            $scope.users = response.data;
        });
    }    

    $scope.loadMore = function(){
        $scope.getFollows($scope.nextIterator);
    }; 

    $scope.getUserProfile = function (user) {
        instagramApi.getUser(user.id, function (response) {
            user.profile = response.data;
            user.loadedMedia = 0;
        });
    };    

    //load a user media
    $scope.getUserData = function (user) {
        console.log("getUserData");
        console.log(user);
        if (user.destinations == null){
            $scope.getUserProfile(user);
            console.log("user profile");
            console.log(user);
            user.locations = [];
            user.destinations = {};
            user.analyzing = true;
            $scope.travelers.unshift(user);
            //remove user from the contacts...
            for( i=$scope.follows.length-1; i>=0; i--) {
                if( $scope.follows[i].id == user.id) $scope.follows.splice(i,1);
            }
            $scope.users = [];
            $scope.getRecentMedia(user);
        }
    }

    $scope.getRecentMedia = function (user) {
        console.log("getRecentMedia");
        user.loading = true;

        instagramApi.getRecentMedia(user.id , function (response) {

            $scope.serviceMeta = response.meta;
            user.loadedMedia = user.loadedMedia + response.data.length;

            //user.images = user.images.concat(response.data);
            $scope.getRecentMediaWithLocation(user, response.data);
            console.log("media response");
            console.log(response);

            user.nextIterator = response.pagination.next_max_id; 

            var recursiveCall;

            if (user.nextIterator!=null){
                recursiveCall = $timeout(function(){ $scope.getRecentMedia(user); }, 200);
            } else {
                $timeout.cancel(recursiveCall);
                user.loading = false;
                //user.images.reverse();
                user.locations.reverse();
                //cluster the locations

                
                var currentDepth = 0;
                var eps = $scope.epsValues[currentDepth];
                var minPts = 2;
                var destinations = $scope.clusterLocations(user.locations, eps, minPts, currentDepth);

                //set metadata to all destinations
                for (var i = 0; i < destinations.length; i++) {
                    var destination = destinations[i];
                    //set the bounding box
                    destination.boundingBox = $scope.getBoundingBox(destination.locations);

                    //set the geocodes
                    $scope.reverseGeocodeBox(destination.boundingBox);

                    //set the destination name
                    $scope.getDestinationName(user, destination);

                    //set the period
                    var start_date = destination.locations[0].images[0].created_time;
                    start_date = new Date(+start_date*1000);
                    var end_date = destination.locations[destination.locations.length-1].images[0].created_time;
                    end_date = new Date(+end_date*1000);
                    var name = $scope.getPeriod(start_date, end_date);
                    var duration = Math.floor(Math.abs((start_date.getTime() - end_date.getTime())/(24*60*60*1000)));
                    destination.period = {start: start_date, end: end_date, name: name, duration};
                    
                };             

                user.analyzing = false;
                user.loaded = true;

                //save the travelers in storage
                $scope.$storage.travelers = $scope.travelers;
                console.log($scope.$storage.travelers);
            }

        }, user.nextIterator);

    };    

    $scope.getRecentMediaWithLocation = function (user, data){
        for (var i = 0; i < data.length; i++){
            var image = data[i];
            if (image.location != null){
                var location = {id: image.location.id, name: image.location.name, latitude: image.location.latitude, longitude: image.location.longitude, images: []};
                if (location.latitude != undefined){
                    //check if location already exists
                    var l = getLocation(location, user.locations);
                    if (l == null){
                        location.images.push(image);
                        user.locations.push(location);
                    } else {
                        l.images.push(image);
                    }
                } else {
                    console.log("Bad location latitude");
                    console.log(image);                    
                }
            }
        }
        console.log(user.locations);
    }    

    function getLocation(location, locations) {

        for (var i = 0; i < locations.length; i++) {
            var l = locations[i];
            if (l.id == location.id){
                return l;
            }
        };
        return null;
    };

    $scope.clusterLocations = function (locations, eps, minPts, currentDepth) {

      var dataset = [];
      var newDestinations = [];

      var resultDestinations = [];

      for (var i = 0; i < locations.length; i++){
        var location = locations[i];
        var a = {x: location.latitude, y: location.longitude};
        dataset.push(a);
      }


        var dbscanner = jDBSCAN().eps(eps).minPts(minPts).distance('EUCLIDEAN').data(dataset);
        var point_assignment_result = dbscanner();
        point_assignment_result.forEach(function(d,i){
          if (newDestinations[d] == null){
            newDestinations[d] = {name: 'Destination '+d, locations: [], user: $scope.user};
          }
          newDestinations[d].locations.push(locations[i]);
        });        


        if (newDestinations[0]==null){
            newDestinations.shift();
        }


        //merge the small destinations
        for (var j = 0; j < newDestinations.length-1; j++) {
            var destination = newDestinations[j];
            if (destination.locations.length < $scope.min_locations){
                if (newDestinations[j+1].length <= $scope.max_locations - $scope.min_locations){
                    newDestinations[j+1].locations = newDestinations[j+1].locations.concat(destination.locations);
                }
            }
        }

        //set the clusters metadata (period + name)
        for (var j = 0; j < newDestinations.length; j++) {
            var destination = newDestinations[j];
            if (destination.locations.length > $scope.max_locations && currentDepth < $scope.epsValues.length-2){
                currentDepth++;
                var eps = $scope.epsValues[currentDepth];
                resultDestinations = resultDestinations.concat($scope.clusterLocations(destination.locations, eps, minPts, currentDepth));
            } else {
                //only push the chapter that have more than 4 moments
                if (destination.locations.length >= $scope.min_locations){
                    resultDestinations.push(destination);            
                }                
            }
        };
        return resultDestinations;
    };    

    $scope.getBoundingBox = function (locations){
                //find the boundaries of the destination
                var maxLat = null;
                var minLat = null;
                var maxLng = null;
                var minLng = null;

                for (var h=0; h < locations.length; h++){
                    var location = locations[h];

                    //maxLat
                    if (maxLat != null){
                        if (maxLat.latitude < location.latitude){
                            maxLat = location;
                        }
                    } else {
                        maxLat = location;
                    }

                    //minLat
                    if (minLat != null){
                        if (minLat.latitude > location.latitude){
                            minLat = location;
                        }
                    } else {
                        minLat = location;
                    }                

                    //maxLmg
                    if (maxLng != null){
                        if (maxLng.longitude < location.longitude){
                            maxLng = location;
                        }
                    } else {
                        maxLng = location;
                    }

                    //minLmg
                    if (minLng != null){
                        if (minLng.longitude > location.longitude){
                            minLng = location;
                        }
                    } else {
                        minLng = location;
                    }                 

                }
                //return bounding box
                return [maxLat, minLat, maxLng, minLng]; 

    };    

    $scope.setReverseGeocode = function (location) {
                return googleApi.getReverseGeocode(location.latitude, location.longitude).then(function(result){
                        var geocode = {neighborhood: "", sublocality: "", locality: "", colloquial_area: "", administrative_area_level_2: "", administrative_area_level_1: "", country: "", resolved: false};
                        if (result.data.results[0]!=null){
                            var result = result.data.results[0];
                            for (var j = 0; j < result.address_components.length; j++) {
                                var components = result.address_components[j];
                                for (var h = 0; h < components.types.length; h++) {
                                    var type = components.types[h];
                                    if (type == 'neighborhood'){
                                        geocode.neighborhood = components.long_name;
                                    }
                                    if (type == 'sublocality'){
                                        geocode.sublocality = components.long_name;
                                    }
                                    if (type == 'locality'){
                                        geocode.locality = components.long_name;
                                    } 
                                    if (type == 'colloquial_area'){
                                        geocode.colloquial_area = components.long_name;
                                    }                                                                    
                                    if (type == 'administrative_area_level_2'){
                                        geocode.administrative_area_level_2 = components.long_name;
                                    }                                    
                                    if (type == 'administrative_area_level_1'){
                                        geocode.administrative_area_level_1 = components.long_name;
                                    }
                                    if (type == 'country'){
                                        geocode.country = components.long_name;
                                    }                                                                                
                                };
                            };
                        } else {
                            console.log("LOCATION NOT REVERSE GEOCODED!");
                        }
                        geocode.resolved = true;
                        location.geocode = geocode;
                        return result;  
                });  
    };

    $scope.reverseGeocodeBox = function (locations){
          for (var i = 0; i < locations.length; i++) {
              var location = locations[i];
              $scope.setReverseGeocode(location);
              console.log(location.geocode);
        };
    };

    $scope.getDestinationName = function(user, destination){
        var locations = destination.boundingBox;
        var recursiveCall = $timeout(function(){ 
            if (locations[0].geocode != undefined && locations[1].geocode != undefined && locations[2].geocode != undefined && locations[3].geocode != undefined){
                if (locations[0].geocode.resolved && locations[1].geocode.resolved && locations[2].geocode.resolved && locations[3].geocode.resolved){
                    
                    for (var i = 0; i < $scope.geocodeLevels.length; i++) {
                        var names = $scope.getAreaGeocodeName(locations, i);
                        if (names != null){
                            $timeout.cancel(recursiveCall);
                            destination.names = names;
                            break;
                        }

                        if (names == null && i == $scope.geocodeLevels.length-1){
                            destination.names = [{level: $scope.geocodeLevels[$scope.geocodeLevels.length-1], name: 'World'}];
                            break;
                        }
                    };

                    var d = user.destinations[destination.names[0].name];
                    if (d == null){
                        user.destinations[destination.names[0].name] = [destination];
                        user.destinations[destination.names[0].name].locations = destination.locations;
                    } else {
                        user.destinations[destination.names[0].name].push(destination);
                        user.destinations[destination.names[0].name].locations = user.destinations[destination.names[0].name].locations.concat(destination.locations);
                    }
                    console.log("user destinations");
                    console.log(user.destinations);

                    //save the travelers in storage
                    $scope.$storage.travelers = $scope.travelers;
                    console.log("saved travelers");
                    console.log($scope.$storage.travelers);                    

                } else {
                    console.log("not resolved yet");
                    $scope.getDestinationName(user, destination);
                }                
            } else {
                console.log("no geocode yet");
                $scope.getDestinationName(user, destination);
            }

        }, 1000);        
    };

    $scope.getAreaGeocodeName = function (locations, depth){
        var level = $scope.geocodeLevels[depth];
        var sublevel = null;
        if (depth==0){
            sublevel = $scope.geocodeLevels[depth];
        } else {
            sublevel = $scope.geocodeLevels[depth-1];
        }

        //hack for some level that are empty...
        if (locations[0].geocode[sublevel] == "" && locations[1].geocode[sublevel] == "" && locations[2].geocode[sublevel] == "" && locations[3].geocode[sublevel] == ""){
            if (depth>1){
                sublevel = $scope.geocodeLevels[depth-2];
            }
        }

        if (locations[0].geocode[level] != "" && locations[0].geocode[level] == locations[1].geocode[level] && locations[1].geocode[level] == locations[2].geocode[level] && locations[2].geocode[level] == locations[3].geocode[level]){
            var regions = [];                                
            for (var i = 0; i < locations.length; i++) {
                var region = locations[i].geocode[sublevel];
                if (region!=""){
                    if (regions.indexOf(region) == -1){
                        regions.push(region);
                    }
                }                                    
            };
            console.log(regions);
            var mainName = locations[0].geocode[level];
            if (regions.length == 3) {
               var name = regions[0]+', '+regions[1]+' and '+regions[2];
               return [{level: level, name: mainName}, {level: sublevel, name}];
            }  else if (regions.length == 2) {
               var name = regions[0]+' and '+regions[1];
               return [{level: level, name: mainName}, {level: sublevel, name}];
            } else if (regions.length == 1) {
               var name = regions[0];
               return [{level: level, name: mainName}, {level: sublevel, name}];
            } 
            return [{level: level, name: mainName}];
        } else {
            if (level == 'country'){
                var regions = [];                                
                for (var i = 0; i < locations.length; i++) {
                    var region = locations[i].geocode.country;
                    console.log(region);
                    if (region!=""){
                        if (regions.indexOf(region) == -1){
                            regions.push(region);
                        }
                    }                                    
                };                
                if (regions.length > 2) {
                   var mainName = "World";
                   return [{level: level, name: mainName}];
                }  else if (regions.length == 2) {
                   var mainName = regions[0]+' and '+regions[1];
                   return [{level: level, name: mainName}];
                } else if (regions.length == 1) {
                   var mainName = regions[0];
                   return [{level: level, name: mainName}];
                }                 
            }
            return null;
        }
    };

    $scope.getDestinationMapUrl = function(destination, width, height){

      console.log(destination);
      var places = [];
      for (var i = 0; i < destination.length; i++) {
            var chapter = destination[i];
            places = places.concat(chapter.locations);
        };       

      var boundingBox = $scope.getBoundingBox(places);
      var zoom = $scope.getBoundsZoomLevel(boundingBox, width, height);
      if (zoom > 0){
        zoom--;
      }
      var center = $scope.getBoundsCenter(boundingBox);

      var url = "https://api.mapbox.com/styles/v1/fgirardin/cikpbp0f400mmbylvl2fgnxvr/static/"+center.longitude+","+center.latitude+","+zoom+",0,0/"+width+"x"+height+"?access_token=pk.eyJ1IjoiZmdpcmFyZGluIiwiYSI6IktabUd4X28ifQ.Xp54fg5Mk94v0uPelnUkKg";
      return url;
    };      

    $scope.getBoundsZoomLevel = function (bounds, width, height) {
        var WORLD_DIM = { height: 256, width: 256 };
        var ZOOM_MAX = 21;

        function latRad(lat) {
            var sin = Math.sin(lat * Math.PI / 180);
            var radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
            return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
        }

        function zoom(mapPx, worldPx, fraction) {
            return Math.floor(Math.log(mapPx / worldPx / fraction) / Math.LN2);
        }

        var latFraction = (latRad(bounds[0].latitude) - latRad(bounds[1].latitude)) / Math.PI;

        var lngDiff = bounds[2].longitude - bounds[3].longitude;

        var lngFraction = ((lngDiff < 0) ? (lngDiff + 360) : lngDiff) / 360;

        var latZoom = zoom(height, WORLD_DIM.height, latFraction);

        var lngZoom = zoom(width, WORLD_DIM.width, lngFraction);

        return Math.min(latZoom, lngZoom, ZOOM_MAX);
    }



    $scope.getBoundsCenter = function (bounds) {
        var latitude = (bounds[0].latitude+bounds[1].latitude)/2;
        var longitude = (bounds[2].longitude+bounds[3].longitude)/2;
        return {latitude: latitude, longitude: longitude};

    }    

    $scope.getPeriod = function(start_period, end_period) {
      var duration = Math.floor(Math.abs((start_period.getTime() - end_period.getTime())/(24*60*60*1000)));
      console.log(duration);
      var m_names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      var date1_date = start_period.getDate();
      var date2_date = end_period.getDate();
      var date1_month = start_period.getMonth();
      var date2_month = end_period.getMonth();
      var date1_year = start_period.getFullYear();
      var date2_year = end_period.getFullYear();

      var dateString = "";

      if (duration > 60){
        if (date1_year==date2_year){
            dateString = date2_year;
        } else {
            dateString = date1_year + " - "+date2_year;
        }


      } else {
          if (date1_month == date2_month && date1_year==date2_year){
            if (date1_date == date2_date){
                dateString = m_names[date1_month]+" "+date1_date+", "+date1_year;
            } else {
                dateString = m_names[date1_month]+" "+date1_date+"-"+date2_date+", "+date1_year;
            }
          } else if (date1_year==date2_year) {
            dateString = m_names[date1_month]+" "+date1_date+" - "+m_names[date2_month]+" "+date2_date+", "+date1_year;
          } else {
            dateString = m_names[date1_month]+" "+date1_date+", "+date1_year+" - "+m_names[date2_month]+" "+date2_date+", "+date2_year;
          }        
      }

      return dateString;               
    }    




});

var userController = instagramAppControllers.controller('userController', function ($rootScope, $scope, $localStorage, $location, $stateParams, $state) {

    $scope.$storage = $localStorage;

    $scope.userName = $stateParams.userName;
    $scope.loaded = false;


    $scope.init = function() {
        if ($scope.$storage.travelers!=null){
            for (var i = 0; i < $scope.$storage.travelers.length; i++) {
                var traveler = $scope.$storage.travelers[i];
                if (traveler.id == $stateParams.userId){
                    $scope.user = traveler;
                    console.log("user found");
                    console.log($scope.user);
                    $scope.loaded = true;

                }
            };
        } else {
            //move to home
        }


    };



    $scope.getBoundingBox = function (locations){
                //find the boundaries of the destination
                var maxLat = null;
                var minLat = null;
                var maxLng = null;
                var minLng = null;

                for (var h=0; h < locations.length; h++){
                    var location = locations[h];

                    //maxLat
                    if (maxLat != null){
                        if (maxLat.latitude < location.latitude){
                            maxLat = location;
                        }
                    } else {
                        maxLat = location;
                    }

                    //minLat
                    if (minLat != null){
                        if (minLat.latitude > location.latitude){
                            minLat = location;
                        }
                    } else {
                        minLat = location;
                    }                

                    //maxLmg
                    if (maxLng != null){
                        if (maxLng.longitude < location.longitude){
                            maxLng = location;
                        }
                    } else {
                        maxLng = location;
                    }

                    //minLmg
                    if (minLng != null){
                        if (minLng.longitude > location.longitude){
                            minLng = location;
                        }
                    } else {
                        minLng = location;
                    }                 

                }
                //return bounding box
                return [maxLat, minLat, maxLng, minLng]; 

    }


    $scope.viewDestination = function(destinationId) {
        $state.go('destination', {userId: $scope.user.id, userName: $scope.user.username, mementoId: destinationId}, {});   
    }


    $scope.getBoundsZoomLevel = function (bounds, width, height) {
        var WORLD_DIM = { height: 256, width: 256 };
        var ZOOM_MAX = 21;

        function latRad(lat) {
            var sin = Math.sin(lat * Math.PI / 180);
            var radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
            return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
        }

        function zoom(mapPx, worldPx, fraction) {
            return Math.floor(Math.log(mapPx / worldPx / fraction) / Math.LN2);
        }

        var latFraction = (latRad(bounds[0].latitude) - latRad(bounds[1].latitude)) / Math.PI;

        var lngDiff = bounds[2].longitude - bounds[3].longitude;

        var lngFraction = ((lngDiff < 0) ? (lngDiff + 360) : lngDiff) / 360;

        var latZoom = zoom(height, WORLD_DIM.height, latFraction);

        var lngZoom = zoom(width, WORLD_DIM.width, lngFraction);

        return Math.min(latZoom, lngZoom, ZOOM_MAX);
    }



    $scope.getBoundsCenter = function (bounds) {
        var latitude = (bounds[0].latitude+bounds[1].latitude)/2;
        var longitude = (bounds[2].longitude+bounds[3].longitude)/2;
        return {latitude: latitude, longitude: longitude};

    }

    $scope.getDestinationMapUrl = function(destination, width, height){

      console.log(destination);
      var places = [];
      for (var i = 0; i < destination.length; i++) {
            var chapter = destination[i];
            places = places.concat(chapter.locations);
        };       

      var boundingBox = $scope.getBoundingBox(places);
      var zoom = $scope.getBoundsZoomLevel(boundingBox, width, height);
      if (zoom > 0){
        zoom--;
      }
      var center = $scope.getBoundsCenter(boundingBox);

      var url = "https://api.mapbox.com/styles/v1/fgirardin/cikpbp0f400mmbylvl2fgnxvr/static/"+center.longitude+","+center.latitude+","+zoom+",0,0/"+width+"x"+height+"?access_token=pk.eyJ1IjoiZmdpcmFyZGluIiwiYSI6IktabUd4X28ifQ.Xp54fg5Mk94v0uPelnUkKg";
      return url;
    };  



});

var userController = instagramAppControllers.controller('destinationController', function ($rootScope, $scope, $stateParams, $localStorage) {

    $scope.$storage = $localStorage;

    $scope.mementoId = $stateParams.mementoId;

    $scope.serviceMeta = {};    

    $scope.init = function() {
        if ($scope.$storage.travelers!=null){
            for (var i = 0; i < $scope.$storage.travelers.length; i++) {
                var traveler = $scope.$storage.travelers[i];
                if (traveler.id == $stateParams.userId){
                    $scope.user = traveler;
                    console.log("user found");
                    console.log($scope.user);
                    var keys = Object.keys($scope.user.destinations);
                    console.log(keys);
                    var key = keys[$stateParams.mementoId];
                    $scope.destination = $scope.user.destinations[key];
                    console.log($scope.user.destinations);
                    console.log($stateParams.mementoId);
                    console.log($scope.destination);
                    for (var j = 0; j < $scope.destination.length; j++) {
                        var chapter = $scope.destination[j];
                        $scope.setTileSizes(chapter.locations);
                    };                                        
                }
            };
        } else {
            //move to home
        }
    }

    $scope.setTileSizes = function(locations) {
        for (var i = 0; i < locations.length; i++) {
            var location = locations[i];
            location.rowspan = 1;
            location.colspan = 1;
        }
        if (locations.length <= 12){
            locations[0].rowspan = 2;
            locations[0].colspan = 2;

            if (locations.length < 8){
              console.log(locations.length);
              locations[4].rowspan = 2;
              locations[4].colspan = 2;
            }
        }
    }

    $scope.getShortText = function(text, length){
        if (text!=undefined){
            if (text.length > length){
                var t = text.substring(0, length);
                t = t+"...";
                return t;                
            }
        }
        return text;
    }

    $scope.getMapUrl = function(places, width, height){

      if (places == undefined){
        return undefined;
      }

      var displayPlaces = null;
      if (places.length > 20){
        displayPlaces = places.slice(0,19);
      } else {
        displayPlaces = places;
      }

      var nbPlaces = 0;
      var place = null;
      var url = 'https://api.tiles.mapbox.com/v4/fgirardin.map-rxmaard1/';
      for (var i = 0; i < displayPlaces.length; i++) {
           place = displayPlaces[i];
           var pin_id = nbPlaces;
           place.pin_id = i+1;
           url = url + "pin-l-"+place.pin_id+"("+place.longitude+","+place.latitude+"),";
           nbPlaces++;
      }
      url = url.substring(0, url.length - 1);
      if (nbPlaces > 0){
        if (nbPlaces == 1){
          url = url +"/"+place.longitude+","+place.latitude+",10/"+width+"x"+height+".png?access_token=pk.eyJ1IjoiZmdpcmFyZGluIiwiYSI6IktabUd4X28ifQ.Xp54fg5Mk94v0uPelnUkKg";          
        } else {
          url = url +"/auto/"+width+"x"+height+".png?access_token=pk.eyJ1IjoiZmdpcmFyZGluIiwiYSI6IktabUd4X28ifQ.Xp54fg5Mk94v0uPelnUkKg";
        }
        return url;
      } 
      console.log("no url");
      return undefined;
    };  

});


