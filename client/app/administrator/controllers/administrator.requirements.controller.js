'use strict';

angular.module('degreeCheckApp')
    .controller('AdminRequirementsCtrl', function ($scope, majorService, $modal) {
        $scope.majorService = majorService;
        function allCoursesCallback (courses) {
            $scope.allCourses = courses.map(function (elem) { return elem.name; });
        };
        $scope.majorService.initMajorService(allCoursesCallback);
        $scope.majorService.fullGetMajor();




        $scope.deleteRequirement = function(major,req_id){
            majorService.deleteRequirement(major,req_id);
        }

        $scope.addRequirement = function(major){
            $scope.majorService.asdf = major;
            console.log($scope.majorService.fullAllMajors);
            var modalInstance = $modal.open({
                templateUrl: 'administrator.major.edit-requirement.html',
                controller: 'AdminAddRequirementsCtrl',
                size: 'sm'
            });
        },
        $scope.editRequirement = function(major, requirement){
            $scope.majorService.asdf = major;
            $scope.majorService.req = angular.copy(requirement);
            console.log($scope.majorService.fullAllMajors);
            var modalInstance = $modal.open({
                templateUrl: 'administrator.major.edit-requirement.html',
                controller: 'AdminEditRequirementsCtrl',
                size: 'sm'
            });
        }
    });