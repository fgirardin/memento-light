angular.module('googleService', []).factory('googleApi', function ($http) {

    var google = {};

    google.getReverseGeocode = function (latitude, longitude) {

        endPoint = 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' 
                + latitude + ',' 
                + longitude 
                + '&key=AIzaSyBdD36eu27bR9Ih2WYaEAB-LhfW9pcE1DA';

        return $http.get(endPoint, {
          params: {
          }
        });        
    };    


    //errors
    google.errorCodes = {
        200: 1,
        400: 2
    };

    return google;

});