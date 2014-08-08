angular
  .module('webmakerAngular.login', [])
  .factory('webmakerLoginService', ['$rootScope', '$modal', '$window', '$location', 'CONFIG',
    function webmakerLoginService($rootScope, $modal, $window, $location, CONFIG) {

      // This is needed to apply scope changes for events that happen in
      // async callbacks.
      function apply() {
        if (!$rootScope.$$phase) {
          $rootScope.$apply();
        }
      }

      var auth = new $window.WebmakerAuthClient({
        host: '',
        csrfToken: CONFIG.csrf,
        handleNewUserUI: false
      });

      // Set up login/logout functions
      $rootScope.login = auth.login;
      $rootScope.logout = auth.logout;

      // Set up user data
      $rootScope._user = {};

      auth.on('login', function (user) {
        $rootScope._user = user;
        apply();
      });

      auth.on('tokenlogin', function (user) {
        $rootScope._user = user;
        apply();
      });

      auth.on('passwordlogin', function (user) {
        $rootScope._user = user;
        apply();
      });

      auth.on('firstpasswordset', function(user) {
        console.log( arguments );
        $rootScope._user = user;
      });

      auth.on('logout', function (why) {
        $rootScope._user = {};
        apply();
      });

      auth.on('error', function (message, xhr) {
        console.error('error', message, xhr);
      });

      var searchObj = $location.search();

      if ( searchObj.e && searchObj.t ) {
        auth.authenticateToken();
      }

      auth.verify();

      return auth;
    }
  ])
  .controller('loginController', ['$rootScope', '$scope', '$http', '$modal', 'webmakerLoginService',
    function ($rootScope, $scope, $http, $modal, webmakerLoginService) {
      $rootScope.tokenLogin = function (email) {
        $modal.open({
          templateUrl: '/views/signin.html',
          controller: tokenLogin,
          resolve: {
            email: function() {
              return email;
            }
          }
        });
      };

      var tokenLogin = function ($scope, $modalInstance, email) {
        $scope.form = {};
        $scope.user = {};
        $scope.enterEmail = true;

        if ( email ) {
          $scope.user.loginEmail = email;
        }

        var emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

        $scope.checkEmail = function () {
          if (!$scope.user.loginEmail) {
            return;
          }

          var isValid = emailRegex.test($scope.user.loginEmail);

          $scope.form.user.loginEmail.$setValidity('invalid', isValid);
          $scope.form.user.loginEmail.$setValidity('noAccount', true);

          if (!isValid) {
            return;
          }

          $http
            .get(webmakerLoginService.urls.checkEmail + $scope.user.loginEmail)
            .success(function (resp) {
              $scope.usePasswordLogin = resp.usePasswordLogin;
              $scope.form.user.loginEmail.$setValidity('noAccount', resp.exists);
            })
            .error(function (err) {
              $scope.form.user.loginEmail.$setValidity('noAccount', true);
            });
        };

        $scope.setPassword = function() {
          $scope.setFirstPassword = true;
          $scope.enterToken = false;
        }

        $scope.submitFirstPassword = function() {
          // TODO validation
          webmakerLoginService.setFirstPassword($scope.user.loginEmail, $scope.user.token, $scope.user.password, function() {
            $scope.setFirstPassword = false;
            $scope.setFirstPasswordSuccess = true;
            if (!$rootScope.$$phase) {
              $rootScope.$apply();
            }
          });
        }

        $scope.submit = function () {
          var isValid = emailRegex.test($scope.user.loginEmail);
          $scope.form.user.loginEmail.$setValidity("invalid", isValid);
          if (!isValid) {
            return;
          }

          if ( $scope.usePasswordLogin ) {
            webmakerLoginService.verifyPassword($scope.user.loginEmail, $scope.user.password, function(err, success) {
              if ( err || !success ) {
                console.error( 'failed to sign in, do something.' );
                return
              }
              $modalInstance.dismiss('done');
            });
          } else {
          webmakerLoginService.request($scope.user.loginEmail);
            $scope.enterEmail = false;
            $scope.enterToken = true;
          }
        };

        $scope.submitToken = function () {
          webmakerLoginService.authenticateToken($scope.user.loginEmail, $scope.user.token);
        };

        $scope.cancel = function () {
          $modalInstance.dismiss('cancel');
        };

        $scope.continue = function () {
          $modalInstance.dismiss('done');
        };

        webmakerLoginService.on('tokenlogin', function() {
          $modalInstance.dismiss('done');
        });

        webmakerLoginService.on('password-login', function() {
          $modalInstance.dismiss('done');
        });
      };
    }
  ])
  .controller('createUserController', ['$rootScope', '$scope', '$http', '$modal', 'webmakerLoginService',
    function ($rootScope, $scope, $http, $modal, webmakerLoginService) {

      $rootScope.createUserTwo = function (email) {
        $modal.open({
          templateUrl: '/views/create-user-form-2.html',
          controller: createUserCtrlTwo,
          resolve: {
            email: function() {
              return email;
            }
          }
        });
      };

      var createUserCtrlTwo = function ($scope, $modalInstance, email) {

        $scope.form = {};
        $scope.user = {};

        if ( email ) {
          $scope.user.email = email;
        }

        var usernameRegex = /^[abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789\-]{1,20}$/;
        var emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

        $scope.enterEmail = true;
        $scope.selectUsername = false;
        $scope.welcome = false;

        $scope.submitEmail = function () {
          $scope.submit = true;
          if ($scope.form.agree && $scope.user.email) {
            $scope.enterEmail = false;
            $scope.selectUsername = true;
          }
        };

        $scope.checkEmail = function () {
          if (!$scope.user.email) {
            return;
          }

          var isValid = emailRegex.test($scope.user.email);

          $scope.form.user.email.$setValidity('invalid', isValid);
          $scope.form.user.email.$setValidity('accountExists', true);

          if (!isValid) {
            return;
          }

          $http
            .get(webmakerLoginService.urls.checkEmail + $scope.user.email)
            .success(function (email) {
              $scope.form.user.email.$setValidity('accountExists', !email.exists);
            })
            .error(function (err) {
              $scope.form.user.email.$setValidity('accountExists', true);
            });
        };

        $scope.submitUsername = function () {
          if ($scope.form.user.$valid && $scope.form.agree) {
            webmakerLoginService.createUser2({
              user: $scope.user
            }, function (err, user) {
              $scope.selectUsername = false;
              $scope.welcome = true;
              if (!$rootScope.$$phase) {
                $rootScope.$apply();
              }
            });
          }
        };

        $scope.continue = function () {
          $modalInstance.dismiss('done');
        };

        $scope.cancel = function () {
          webmakerLoginService.analytics.webmakerNewUserCancelled();
          $modalInstance.dismiss('cancel');
        };

        $scope.checkUsername = function () {
          if (!$scope.user.username) {
            return;
          }
          if (!usernameRegex.test($scope.user.username)) {
            $scope.form.user.username.$setValidity('invalid', false);
            return;
          }
          $scope.form.user.username.$setValidity('invalid', true);
          $http
            .post(webmakerLoginService.urls.checkUsername, {
              username: $scope.user.username
            })
            .success(function (username) {
              $scope.form.user.username.$setValidity('taken', !username.exists);
            })
            .error(function (err) {
              $scope.form.user.username.$setValidity('taken', true);
            });
        };
      };
    }
  ]);
