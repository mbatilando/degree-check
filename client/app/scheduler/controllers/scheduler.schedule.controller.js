'use strict';

angular.module('degreeCheckApp')
  .controller('SchedulerScheduleCtrl', function ($scope, scheduleService, majorService) {
    console.log('SchedulerScheduleCtrl');
    $scope.scheduleService = scheduleService;
    $scope.majorService = majorService;
    $scope.allCourses = majorService.allCourses.map(function (elem) { return elem.name; });
    $scope.newClass = {};

    $scope.removeCourse = function (semesterId, courseId) {
    	scheduleService.removeCourse(semesterId, courseId);
    };

    $scope.updateCourse = function (semesterId, courseId, updatedCourse) {
    };

    $scope.addYear = function () {
    	scheduleService.addSemester('Fall', 2018);
      scheduleService.addSemester('Spring', 2019);
      scheduleService.addSemester('Summer', 2019);
    };

    $scope.checkInput = function (event, semesterId) {
      // Check if enter
      if (event.keyCode === 13) {
          // Check if valid course
          if ($scope.allCourses.indexOf($scope.newClass[semesterId]) > -1) {
              scheduleService.addCourse(semesterId, { name: $scope.newClass[semesterId] });
              $scope.newClass[semesterId] = '';
          }
      }
    };

    $scope.saveSchedule = function () {
      scheduleService.saveSchedule();
    };

  });
