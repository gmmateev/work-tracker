'use strict';

angular.module('articles').controller('ArticlesController', ['$scope', '$stateParams', '$location', 'Authentication', 'Articles', 'Grades',
    function($scope, $stateParams, $location, Authentication, Articles, Grades) {
        $scope.authentication = Authentication;

        $scope.create = function() {
            var article = new Articles({
                title: this.title,
                content: this.content,
                topic: $stateParams.topicId
            });
            article.$save(function(response) {
                $location.path('articles/' + response._id);

                $scope.title = '';
                $scope.content = '';
            }, function(errorResponse) {
                $scope.error = errorResponse.data.message;
            });
        };

        $scope.remove = function(article) {
            if (article) {
                article.$remove();

                for (var i in $scope.articles) {
                    if ($scope.articles[i] === article) {
                        $scope.articles.splice(i, 1);
                    }
                }
            } else {
                $scope.article.$remove(function() {
                    $location.path('articles');
                });
            }
        };

        $scope.update = function() {
            var article = $scope.article;

            article.$update(function() {
                $location.path('articles/' + article._id);
            }, function(errorResponse) {
                $scope.error = errorResponse.data.message;
            });
        };

        $scope.find = function(onlyMine) {
            var param = { filter: onlyMine ? 'my' : 'all' };
            $scope.articles = Articles.query(param);
        };

        $scope.findOne = function() {
            $scope.article = Articles.get({
                articleId: $stateParams.articleId
            });

            $scope.article.$promise.then(function (article) {
                for (var i = 0; i < article.grades.length; i++) {
                    var grade = article.grades[i];
                    if (grade.user===Authentication.user._id) {
                        $scope.hasCommented = true;
                        $scope.grade = grade;
                        break;
                    }
                }
            });
        };

        $scope.loadHistory = function (article) {
            $scope.history = Articles.history({articleId: article._id});
        };

        $scope.addReview = function () {
            var grade = new Grades($scope.grade);

            grade.$save({ articleId: $scope.article._id }, function () {
               $scope.hasCommented = true;
            }, function (errorResponse) {
               $scope.error = errorResponse.data.message; 
            });
        };
    }
]);