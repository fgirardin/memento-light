var directives = angular.module('directives', []);

directives.directive('error', ['$rootScope', 'AuthenticationService', function ($rootScope, AuthenticationService) {

    return {

        templateUrl: 'views/templates/error.html',
        replace: true,
        link: function (scope, element, attr) {

            //element doesn't appear by default
            element.css('display', 'none');

            scope.$watch('serviceMeta', function (serviceMeta) {

                if ($rootScope.errorCodes[serviceMeta.code] && $rootScope.errorCodes[serviceMeta.code] != 1) {

                    element.css('display', '');

                    scope.errorMessage = scope.serviceMeta.error_message;

                    //must be authenticated User case

                    if ($rootScope.errorCodes[serviceMeta.code] == 2) {

                        var authLink = $rootScope.authLink;

                        if(!AuthenticationService.isLoggedIn()) {
                            scope.errorMessage = "You have to <a href='" + authLink + "'>sign in with Instagram</a>";
                        }else{

                               //hardcoded fix it
                            if(serviceMeta.error_message == "The access_token provided is invalid.") {
                                AuthenticationService.ClearCredentials();
                                scope.errorMessage = "You have to <a href='" + authLink + "'>sign in with Instagram</a>";
                            }else{
                                scope.errorMessage = "You have to follow this user";
                            }

                        }

                        element.html(scope.errorMessage);

                    }

                }

            });

        }

    }

}]);


