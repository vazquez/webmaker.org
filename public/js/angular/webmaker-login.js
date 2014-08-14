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

      auth.on('firstpasswordset', function (user) {
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

      if (searchObj.e && searchObj.t) {
        auth.authenticateToken();
      }

      auth.verify();

      return auth;
    }
  ])
  .factory('focus', function ($rootScope, $timeout) {
    return function (name) {
      $timeout(function () {
        $rootScope.$broadcast('focusOn', name);
      });
    };
  })
  .factory('passwordCheck', function () {
    return function ($scope) {
      var pass = $scope.user.password,
        confirmPass = $scope.user.confirmPassword;

      if (pass) {
        var hasLowerCase = /[a-z]+/.test(pass),
          hasUpperCase = /[A-Z]+/.test(pass),
          digitNonWord = /[\d\W_]+/.test(pass),
          longEnough = pass.length >= 8,
          notTooLong = pass.length <= 120;

        var isInvalidPassword = hasLowerCase && hasUpperCase && digitNonWord && longEnough && notTooLong;

        $scope.form.user.password.$setValidity('hasLowerCase', hasLowerCase);
        $scope.form.user.password.$setValidity('hasUpperCase', hasUpperCase);
        $scope.form.user.password.$setValidity('hasDigitOrNonWord', digitNonWord);
        $scope.form.user.password.$setValidity('longEnough', longEnough);
        $scope.form.user.password.$setValidity('notTooLong', notTooLong);
        $scope.form.user.password.$setValidity('isInvalidPassword', isInvalidPassword);

        if (pass.length && confirmPass && confirmPass.length) {
          $scope.form.user.password.$setValidity('passwordsMatch', pass === confirmPass);
        }
      }
    };
  })
  .controller('loginController', ['$rootScope', '$scope', '$http', '$modal', '$timeout', 'webmakerLoginService', 'focus', 'passwordCheck',
    function ($rootScope, $scope, $http, $modal, $timeout, webmakerLoginService, focus, passwordCheck) {

      function apply() {
        if (!$rootScope.$$phase) {
          $rootScope.$apply();
        }
      }

      $rootScope.tokenLogin = function (email) {
        $modal.open({
          templateUrl: '/views/signin.html',
          controller: tokenLogin,
          resolve: {
            email: function () {
              return email;
            }
          }
        })
        .opened.then(function () {
          $timeout(function () {
            focus('login-email');
          }, 0);
        })
      };

      var tokenLogin = function ($scope, $modalInstance, email) {
        $scope.form = {};
        $scope.user = {};
        $scope.enterEmail = $scope.showPersona = true;

        if (email) {
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
              if (resp.usePasswordLogin) {
                focus('passwordInput');
              }
              $scope.form.user.loginEmail.$setValidity('noAccount', resp.exists);
            })
            .error(function (err) {
              $scope.form.user.loginEmail.$setValidity('noAccount', true);
            });
        };

        $scope.setPassword = function () {
          $scope.setFirstPassword = true;
          $scope.enterToken = false;
        };

        $scope.checkPasswords = function () {
          passwordCheck($scope);
        };

        $scope.submitFirstPassword = function () {
          // TODO validation
          webmakerLoginService.setFirstPassword($scope.user.loginEmail, $scope.user.token, $scope.user.password, function () {
            $scope.setFirstPassword = false;
            $scope.setFirstPasswordSuccess = true;
            apply();
          });
        };

        // this is borked, causes $modal to throw when the create user modal attempts to close..
        $scope.switchToSignup = function () {
          $modalInstance.close();
          $rootScope.createUser_v2($scope.user.loginEmail);
        };

        $scope.submit = function () {
          var isValid = emailRegex.test($scope.user.loginEmail);
          $scope.form.user.loginEmail.$setValidity("invalid", isValid);
          if (!isValid) {
            return;
          }

          $scope.showPersona = false;

          if ($scope.usePasswordLogin) {
            webmakerLoginService.verifyPassword($scope.user.loginEmail, $scope.user.password, function (err, success) {
              if (err || !success) {
                $scope.form.user.loginEmail.$setValidity("failed", false);
                $timeout(function () {
                  $scope.form.user.loginEmail.$setValidity("failed", true);
                }, 10000);
                apply();
                return;
              }
              $modalInstance.dismiss('done');
            });
          } else {
            webmakerLoginService.request($scope.user.loginEmail, function (err) {
              if (err) {
                $scope.form.user.loginEmail.$setValidity("tokenSendFailed", false);
                $timeout(function () {
                  $scope.form.user.loginEmail.$setValidity("tokenSendFailed", true);
                }, 10000);
                apply();
              } else {
                $scope.enterEmail = false;
                $scope.enterToken = true;
                apply();
              }
            });
          }
        };

        $scope.resetPassword = function () {
          var isValid = emailRegex.test($scope.user.loginEmail);
          $scope.resetRequestSent = true;
          $scope.form.user.loginEmail.$setValidity("invalid", isValid);
          if (!isValid) {
            return;
          }

          $scope.showPersona = false;

          webmakerLoginService.requestReset($scope.user.loginEmail, function (err) {
            if (err) {
              console.error(err);
              $scope.resetRequestSent = false;
            } else {
              $scope.enterEmail = false;
              $scope.resetSent = true;
            }
            apply();
          });
        };

        $scope.personaLogin = function () {
          webmakerLoginService.login();
        };

        $scope.submitToken = function () {
          webmakerLoginService.authenticateToken($scope.user.loginEmail, $scope.user.token);
        };

        $scope.cancel = function () {
          $modalInstance.dismiss('cancel');
        };

        function done() {
          $modalInstance.dismiss('done');
        }

        $scope.
        continue = done;

        webmakerLoginService.on('login', done);

        webmakerLoginService.on('tokenlogin', done);

        webmakerLoginService.on('password-login', done);
      };
    }
  ])
  .controller('createUserController_v2', ['$rootScope', '$scope', '$http', '$modal', 'webmakerLoginService',
    function ($rootScope, $scope, $http, $modal, webmakerLoginService) {

      function apply() {
        if (!$rootScope.$$phase) {
          $rootScope.$apply();
        }
      }

      $rootScope.createUser_v2 = function (email) {
        $modal.open({
          templateUrl: '/views/create-user-form-v2.html',
          controller: createUserCtrl_v2,
          resolve: {
            email: function () {
              return email;
            }
          }
        });
      };

      var createUserCtrl_v2 = function ($scope, $modalInstance, email) {

        $scope.form = {};
        $scope.user = {};

        if (email) {
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
            webmakerLoginService.createNewUser({
              user: $scope.user
            }, function (err, user) {
              $scope.selectUsername = false;
              $scope.welcome = true;
              apply();
            });
          }
        };

        $scope.
        continue = function () {
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
  ])
  .controller('resetPasswordController', ['$rootScope', '$scope', '$route', '$location', 'webmakerLoginService', 'passwordCheck',
    function ($rootScope, $scope, $route, $location, webmakerLoginService, passwordCheck) {
      $scope.form = {};
      $scope.user = {};

      $scope.user.email = $route.current.params.email;
      $scope.user.resetToken = $route.current.params.resetToken;

      function apply() {
        if (!$rootScope.$$phase) {
          $rootScope.$apply();
        }
      }

      $scope.checkPasswords = function () {
        console.log($scope.form);
        passwordCheck($scope);
      };

      $scope.submitChanges = function () {
        $scope.resetFailed = false;
        $scope.resetInProgress = true;

        webmakerLoginService.resetPassword(
          $scope.user.email,
          $scope.user.resetToken,
          $scope.user.password,
          function done(err) {
            if (err) {
              $scope.resetInProgress = false;
              console.error(err);
              $scope.resetFailed = true;
            } else {
              $location.path("/");
              $location.search("resetPassword=true");
            }
            apply();
          }
        );
      };
    }
  ]);
