var app = angular.module('instagramApp', ['instagramApp.controllers', 'instagramService', 'googleService', 'ngMaterial', 'ui.router',
    'Authentication', 'directives', 'ngCookies', 'ui.unique', 'ngStorage']);

app.constant('instagramApiConfig', {
        apiUrl: 'https://api.instagram.com/v1/',
        clientId: '8e0c010c39dc44f1b44243fd69d3d6ef',
        callback: 'http://alpha.memento.li/callback.html'
    }
);


app.config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {

    // Redirect any unresolved url
    $urlRouterProvider.otherwise("/index");

    $stateProvider

        .state("user", {
            url: "/user/:userId/:userName",
            templateUrl: "views/user.html",
            data: {pageTitle: 'User', pageSubTitle: ''},
            controller: "userController"
        })

        .state("destination", {
            url: "/user/:userId/:userName/memento/:mementoId",
            templateUrl: "views/destination.html",
            data: {pageTitle: 'Destination', pageSubTitle: ''},
            controller: "destinationController"
        })

        .state('index', {
            url: "/index",
            templateUrl: "views/index.html",
            data: {pageTitle: 'Home', pageSubTitle: ''},
            controller: "IndexController"
        })        

        .state("login", {
            url: "/login/:accessToken",
            templateUrl: "views/login.html",
            data: {pageTitle: 'Login', pageSubTitle: ''},
            controller: "loginController"
        })

}]);

app.config(function($mdThemingProvider) {
  $mdThemingProvider.theme('default')
    .primaryPalette('grey', {
      'default': '300',
      'hue-1': '100',
      'hue-2': '600',
      'hue-3': 'A100'
    })
    .accentPalette('pink');
});

app.run(["$rootScope", 'AuthenticationService', 'instagramApi', 'instagramApiConfig', '$state', function ($rootScope, AuthenticationService, instagramApi, instagramApiConfig, $state) {

    instagramApi.setCredentials(instagramApiConfig);

    AuthenticationService.start(instagramApi);

    $rootScope.$state = $state;

    $rootScope.errorCodes = instagramApi.errorCodes;

}]);