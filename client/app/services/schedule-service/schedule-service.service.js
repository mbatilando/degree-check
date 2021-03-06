'use strict';

angular.module('degreeCheckApp')
    .factory('scheduleService', ['$http', function ($http) {
        var service = {};
        service.classesTaking = {};
        service.classesRequired = {};
        service.yearsProcessed = [];
        service.requirementsProcessed = [];
        service.requirementMap = {};
        service.coursesMap = {};
        service.tracker = {};
        service.currScheduleIndex = 0;

        /*
            Searches the current schedule and returns true if the class exists in it
        */
        service.classInSchedule = function (className) {
            var currSched = service.currSchedule;
            for (var i = 0, iLen = currSched.semesters.length; i < iLen; i++) {
                for (var j = 0, jLen = currSched.semesters[i].courses.length; j < jLen; j++) {
                    if (currSched.semesters[i].courses[j].name === className) {
                        return true;
                    }
                }
            }
            return false;
        }

        service.initSchedule = function (uid, callback) {
            $http.get('/api/users/' + uid)
                .success(function (bigJson) {
                    service.schedule = bigJson;
                    service.currSchedule = service.schedule.schedules[0];
                    service.currScheduleIndex = 0;
                    service.yearsProcessed = processYears(service.currSchedule);
                    setupSchedule(service.schedule.schedules[0]);
                    if(callback !== undefined) callback();
                });
        };

        function clearReqs() {
            // reset tracking objects
            service.requirementMap = {};
            service.requirementMap = {}; // maps requirement._id to a list of mutex requirements and quantity required
            service.coursesMap = {}; // maps course._id to a list of requirements the course can fulfill
            service.tracker = {}; // list of possible assignments
            service.emptyTracker = {}; // blank copy to be copied later
            // populate requirement map
            for (var i = 0; i < service.currSchedule.major[0].requirements.length; i++) {
                var requirement = service.currSchedule.major[0].requirements[i];
                service.requirementMap[requirement._id] = {'exclusives': requirement.exclusives, 'quantity': requirement.quantity, 'type': requirement.type};
                // create row in tracker and emptyTracker
                service.tracker[requirement._id] = [
                    0
                ];
                service.emptyTracker[requirement._id] = [];
                // add requirement to corresponding courses in courseMap
                for (var j = 0; j < requirement.courses.length; j++) {
                    var course = requirement.courses[j];
                    if (!service.coursesMap[course._id]) {
                        service.coursesMap[course._id] = {'requirement': []};//, 'units': course.units};
                    }
                    service.coursesMap[course._id].requirement.push(requirement._id);
                }
            }
        }

        function updateReqWithNewCourse(course) {
            if (service.coursesMap[course._id]) { // if the course fulfills a requirement
                var exclusives = []; // course can only count towards one of these
                var reqTemp = angular.copy(service.coursesMap[course._id].requirement); // can count toward all of these
                // make the above definitions true
                for (var k in service.coursesMap[course._id].requirement) {
                    var req_id = service.coursesMap[course._id].requirement[k];
                    for (var l in service.requirementMap[req_id].exclusives) {
                        var exclusive = service.requirementMap[req_id].exclusives[l];
                        var exists = false;
                        for (var x = reqTemp.length - 1; x >= 0; x--) {
                            if (reqTemp[x] == exclusive) {
                                reqTemp.splice(x, 1);
                                for (var y in exclusives) {
                                    if (exclusives[y] == exclusive) {
                                        exists = true;
                                        break;
                                    }
                                }
                                if (!exists) {
                                    exclusives.push(exclusive);
                                }
                            }
                        }

                    }
                }
                // update posibilities
                for (k in reqTemp) {
                    req_id = reqTemp[k];
                    for (var j = 0; j < service.tracker[req_id].length; j++) {
                        if (service.requirementMap[req_id].type == 'units') {
                                service.tracker[req_id][j]+=course.units;
                        } else if (service.requirementMap[req_id].type == 'courses') {
                            service.tracker[req_id][j]+=1;
                        }
                    }
                }
                if (exclusives.length > 0) {
                    var tempTracker = angular.copy(service.emptyTracker);
                    for (k in exclusives) {
                        req_id = exclusives[k];
                        var temp = angular.copy(service.tracker);
                        for (j = 0; j < temp[req_id].length; j++) {
                            if (service.requirementMap[req_id].type == 'units') {
                                    temp[req_id][j]+=course.units;
                            } else if (service.requirementMap[req_id].type == 'courses') {
                                temp[req_id][j]+=1
                            }
                        }
                        for (var m in service.currSchedule.major[0].requirements) {
                            var requirement = service.currSchedule.major[0].requirements[m];
                            tempTracker[requirement._id] = tempTracker[requirement._id].concat(temp[requirement._id]);
                        }
                    }
                    service.tracker = angular.copy(tempTracker);
                }
            }

        }

        function initReqs() {
            clearReqs()
            var scheduleObj = service.currSchedule;
            for (var i = 0; i < scheduleObj.semesters.length; i++) {
                for (var j in  scheduleObj.semesters[i].courses) {
                    var course = scheduleObj.semesters[i].courses[j];
                    updateReqWithNewCourse(course);
                }
            }
            for (var k = 0; k < service.schedule.prev_coursework.length; k++) {
                updateReqWithNewCourse(service.schedule.prev_coursework[k]);
            }
            checkReqs();
        }

        function checkReqs() {
            // check if a requirement is fulfilled or not started in all possibilities
            for (i in service.currSchedule.major[0].requirements) {
                var requirement = service.currSchedule.major[0].requirements[i];
                var req_id = requirement._id;
                var met = true;
                var started = false;
                for (var j = 0; j < service.tracker[req_id].length; j++) {
                    if (service.tracker[req_id][j] < requirement.quantity) {
                        met = false;
                    }
                    if (service.tracker[req_id][j] > 0) {
                        started = true;
                    }
                }
                if (met) {
                    requirement.satisfied = true;
                    requirement.ip = false;
                    requirement.notStarted = false;
                } else if (started) {
                    requirement.satisfied = false;
                    requirement.ip = true;
                    requirement.notStarted = false;
                } else {
                    requirement.satisfied = false;
                    requirement.ip = false;
                    requirement.notStarted = true;
                }
            }

            if (service.currSchedule.major[0].requirements.length == 0) {
                return;
            }
            // check if there is a single possibility where all requirements are fulfilled
            for (var i = 0; i < service.tracker[req_id].length; i++) {
                var done = true;
                for (j in service.currSchedule.major[0].requirements) {
                    req_id = service.currSchedule.major[0].requirements[j]._id;
                    if (service.tracker[req_id][i] < requirement.quantity) {
                        done = false;
                        break;
                    }
                }
                if (done) {
                    for (j in service.currSchedule.major[0].requirements) {
                        requirement = service.currSchedule.major[0].requirements[j];
                        requirement.satisfied = true;
                        requirement.ip = false;
                        requirement.notStarted = false;
                    }
                    break;
                }
            }
        }

        /*
         Sets up schedule obj for left sidebar by updating all requirements
         Used for initially loading a schedule
         Use updateUserReq for updating a single requirement
         */
        function setupSchedule(scheduleObj) {
            // Clear all reqs first
            initReqs();
            clearUserReq();
            for (var i = 0, len = scheduleObj.semesters.length; i < len; i++) {
                for (var j = 0, jLen = scheduleObj.semesters[i].courses.length; j < jLen; j++) {
                    updateUserReq(scheduleObj.semesters[i].courses[j].name, true);
                }
            }
            for (var i = 0; i < service.schedule.prev_coursework.length; i++) {
                updateUserReq(service.schedule.prev_coursework[i].name, true);
            }
        };

        /*
         Add a course to the user's previous coursework and save schedule.
         */
        service.addToPrevCoursework = function(course) {
          service.schedule.prev_coursework.push(course);
          updateReqWithNewCourse(course);
          checkReqs();
          updateUserReq(course.name, true);
          setupSchedule(service.currSchedule);
        }

        /*
         Remove a course from the user's previous coursework and save schedule.a
         */
        service.removeFromPrevCoursework = function(course) {
          var index = service.schedule.prev_coursework.indexOf(course);
          service.schedule.prev_coursework.splice(index, 1);
          updateUserReq(course.name, false);
          service.saveSchedule();
        }

        /*
         Adds a course to a semester
         semesterId - semester._id
         course - { __v: 0
         _id: "5461a572665fee02008eb970"
         name: "MATH1A"
         units: 4 }
         */
        service.addCourse = function (semesterId, course) {
            var semester, year;
            for (var i = 0, len = service.yearsProcessed.length; i < len; i++) {
                year = service.yearsProcessed[i];
                for (var j = 0, jLen = year.semesters.length; j < jLen; j++) {
                    semester = year.semesters[j];
                    if (semester._id === semesterId) {
                        semester.courses.push(course);
                        updateReqWithNewCourse(course);
                        checkReqs();
                        updateUserReq(course.name, true);
                        return;
                    }
                }
            }
        };

        /*
         Sets satisfied attribute to a boolean course in service.currSchedule.major[0].requirements[i].courses
         Used for left sidebar to change color
         courseName: String
         satisfied: boolean
         */
        function updateUserReq(courseName, satisfied) {
            var requirement;
            for (var i = 0, len = service.currSchedule.major[0].requirements.length; i < len; i++) {
                requirement = service.currSchedule.major[0].requirements[i];
                for (var j = 0, jLen = requirement.courses.length; j < jLen; j++) {
                    if (requirement.courses[j].name === courseName) {
                        requirement.courses[j].satisfied = satisfied;
                        if(!satisfied) service.currSchedule.blessed = false;
                    }
                }
            }
        };

        /*
         Sets all requirements to unsatisfied
         */
        function clearUserReq() {
            /**var requirement;
             for (var i = 0, len = service.currSchedule.major[0].requirements.length; i < len; i++) {
           requirement = service.currSchedule.major[0].requirements[i];
           for (var j = 0, jLen = requirement.courses.length; j < jLen; j++) {
              requirement.courses[j].satisfied = false;
           }
      }**/
        };

        /*
         Process requirements to display properly on left side bar
         TODO
         */
        function processRequirements(requirementsArr) {
            service.requirementsProcessed = [];

            for (var i = 0, len = requirementsArr.length; i < len; i++) {

            }
        }

        /*
         Turns schedule obj into an object similar to service.processedYears
         aliou - assuming semesters are in correct order (first to last)
         */
        function processYears(scheduleObj) {
            var years = [];
            for (var i = 0; i < scheduleObj.semesters.length; i += 3) {
                var id = scheduleObj.semesters[i]._id;
                var startYear = scheduleObj.semesters[i].year;
                var endYear = scheduleObj.semesters[i + 1].year;
                var semesters = [scheduleObj.semesters[i], scheduleObj.semesters[i + 1], scheduleObj.semesters[i + 2]];
                years.push({
                    '_id': id,
                    'startYear': startYear,
                    'endYear': endYear,
                    'semesters': semesters
                });
            }
            service.yearsProcessed = years;
            return years;
        };

        /*
         Removes a course from a semester
         semesterId - semester._id
         courseName - String
         */
        service.removeCourse = function (semesterId, courseName) {
            var semester, year;
            for (var i = 0, len = service.yearsProcessed.length; i < len; i++) {
                year = service.yearsProcessed[i];
                for (var j = 0, jLen = year.semesters.length; j < jLen; j++) {
                    semester = year.semesters[j];
                    if (semester._id === semesterId) {
                        var index = semester.courses.map(function (elem) {
                            return elem.name;
                        }).indexOf(courseName);
                        semester.courses.splice(index, 1);
                        initReqs();
                        updateUserReq(courseName, false);
                        return;
                    }
                }
            }
        };

        /*
         Creates, adds, and saves three new semesters to the user's current schedule.
         */
        service.addYear = function (year) {
            var fallSemester = { season: "Fall", year: year.endYear, courses: [] };
            var springSemester = { season: "Spring", year: (parseInt(year.endYear) + 1).toString(), courses: [] };
            var summerSemester = { season: "Summer", year: (parseInt(year.endYear) + 1).toString(), courses: [] };

            service.currSchedule.semesters.push(fallSemester);
            service.currSchedule.semesters.push(springSemester);
            service.currSchedule.semesters.push(summerSemester);
            processYears(service.currSchedule);
            service.saveSchedule().then(function(){
                processYears(service.currSchedule);
            });
        };

        /*
         Deletes the latest year from the schedule by removing three semesters and saves schedule.
         Delete year will not delete a year when there is only one year in the schedule.
         */
        service.deleteYear = function () {
            if(service.currSchedule.semesters.length > 3) {
              service.currSchedule.semesters.pop();
              service.currSchedule.semesters.pop();
              service.currSchedule.semesters.pop();
              service.currSchedule.blessed = false;
              processYears(service.currSchedule);
              service.saveSchedule().then(function(){
                processYears(service.currSchedule);
              });
            }
        };

        /*
         Updates a semester object, given semester parameter
         Returns a promise
         semesterId - semester._id
         semester - { _id: String, season: String, year: Number, courses: [Course]}
         */
        service.updateSemester = function (semesterId, semester) {
            var deferred = $q.defer();

            $http.put('/api/semester/' + semesterId, semester)
                .success(function (updatedSemester) {
                    deferred.resolve(updatedSemester);
                });

            return deferred.promise;
        };

        /*
         Clears yearProcessed and deletes a schedule with scheduleId
         */
        service.deleteSchedule = function (scheduleId) {
            if (service.schedule.schedules.length > 1) {
                var schedule;
                for (var i = 0, len = service.schedule.schedules.length; i < len; i++) {
                    schedule = service.schedule.schedules[i];
                    if (schedule._id === scheduleId) {
                        service.schedule.schedules.splice(i, 1);
                        service.yearsProcessed = [];
                        service.currSchedule = service.schedule.schedules[0];
                        service.currScheduleIndex = 0;
                        service.yearsProcessed = processYears(service.currSchedule);
                        setupSchedule(service.currSchedule);
                        service.saveSchedule();
                        return;
                    }
                }
            }
        };

        service.changeSchedule = function (scheduleId) {
            // TODO: Process years function
            for (var i = 0, len = service.schedule.schedules.length; i < len; i++) {
                if (service.schedule.schedules[i]._id === scheduleId) {
                    service.currScheduleIndex = i;
                    service.currSchedule = service.schedule.schedules[i];
                    service.yearsProcessed = service.yearsProcessed2;
                    service.yearsProcessed = processYears(service.currSchedule);
                    setupSchedule(service.currSchedule);
                    return;
                }
            }
        };

        /*
         Adds a new schedule
         */
        service.addSchedule = function (schedule, callback) {
            $http.get('/api/majors/' + schedule.major)
                .success(function (majorObj) {
                    var newSchedule = {};
                    newSchedule.name = schedule.name;
                    newSchedule.semesters = createSemesters();
                    newSchedule.major = [majorObj];
                    service.schedule.schedules.push(newSchedule);
                    service.saveSchedule().then(function(){
                        callback();
                    });
                });
        };

        function createSemesters() {
            return [
                { "season": "Fall", "year": "2014", "courses": [] },
                { "season": "Spring", "year": "2015", "courses": [] },
                { "season": "Summer", "year": "2015", "courses": [] },
                { "season": "Fall", "year": "2015", "courses": [] },
                { "season": "Spring", "year": "2016", "courses": [] },
                { "season": "Summer", "year": "2016", "courses": [] },
                { "season": "Fall", "year": "2016", "courses": [] },
                { "season": "Spring", "year": "2017", "courses": [] },
                { "season": "Summer", "year": "2017", "courses": [] },
                { "season": "Fall", "year": "2017", "courses": [] },
                { "season": "Spring", "year": "2018", "courses": [] },
                { "season": "Summer", "year": "2018", "courses": [] }
            ];
        }

        /*
         Adds newly added/removed courses from years processed to the original service.schedule object
         */
        function unprocessYears() {
            service.currSchedule.semesters = [];
            var year;
            for (var i = 0, len = service.yearsProcessed.length; i < len; i++) {
                year = service.yearsProcessed[i];
                service.currSchedule.semesters = service.currSchedule.semesters.concat(year.semesters);
            }
            service.schedule.schedules[service.currScheduleIndex]=service.currSchedule;
        }

        /*
         Replaces the embedded course and major objects in the
         User object with the corresponding course and major IDs.
         Puts new User object.
         */
        service.saveSchedule = function () {
            unprocessYears();

            var serviceSchedule = jQuery.extend(true, {}, service.schedule); // deep copy of service.schedule
            /*
             Replaces all course and major objects in the User object with the object IDs.
             This is in the deep copy, not the original
             */
            for (var i = 0; i < serviceSchedule.prev_coursework.length; i++) {
                serviceSchedule.prev_coursework[i] = serviceSchedule.prev_coursework[i]._id;
            }
            for (var j = 0; j < serviceSchedule.schedules.length; j++) {
                var currentSchedule = serviceSchedule.schedules[j];
                for (var k = 0; k < currentSchedule.major.length; k++) {
                    if (currentSchedule.major[k] !== null)
                        currentSchedule.major[k] = currentSchedule.major[k]._id;
                }
                for (var l = 0; l < currentSchedule.semesters.length; l++) {
                    var currentSemester = currentSchedule.semesters[l];
                    for (var m = 0; m < currentSemester.courses.length; m++) {
                        currentSemester.courses[m] = currentSemester.courses[m]._id;
                    }
                    currentSchedule.semesters[l] = currentSemester;
                }
                serviceSchedule.schedules[j] = currentSchedule;
            }

            delete service.schedule['__v'];


            // Put user
            return $http.put('/api/users/' + service.schedule.uid, serviceSchedule)
                .success(function (data) {
                    service.schedule.schedules = data.schedules;
                    service.currSchedule = service.schedule.schedules[service.currScheduleIndex];
                    setupSchedule(service.currSchedule);

                });
        };

        return service;
    }]);
