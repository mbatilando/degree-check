'use strict';

var _ = require('lodash');
var User = require('./user.model');
var cache = require('memory-cache');

// Get list of users
exports.index = function(req, res) {
  var cached = cache.get('all-users');

  if (cached) {
    return res.json(cached);
  }

  User.find(function (err, users) {
    if(err) { return handleError(res, err); }
    cache.put('all-users', users, 10000);
    return res.json(200, users);
  });
};

// Get a single user
exports.show = function(req, res) {
  var cached = cache.get(req.params.uid);

  if (cached) {
    return res.json(cached);
  }

  User.findOne({uid: req.params.uid}).populate('prev_coursework').exec(function (err, user) {
    if(err) { return handleError(res, err); }
    if(!user) { return res.send(404); }
    var opts = [{path: 'schedules.major', model: 'Major'},
                {path: 'schedules.semesters.courses', model: 'Course'}];
    User.populate(user, opts, function (err, user) {
        var opts = [{path: 'schedules.major.requirements.courses', model: 'Course'}];
        User.populate(user, opts, function(err, user) {
            cache.put(req.params.uid, user, 10000);
            return res.json(user);
        });
    });
  });
};

// Creates a new user in the DB.
exports.create = function(req, res) {
  User.create(req.body, function(err, user) {
    if(err) { return handleError(res, err); }
    cache.del('all-users');
    cache.put(user.uid, user, 10000);
    return res.json(201, user);
  });
};

// Updates an existing user in the DB.
exports.update = function(req, res) {
  if(req.body._id) { delete req.body._id; }

  cache.del(req.params.uid);
  cache.del('all-users');

  User.findOne({uid: req.params.uid}, function (err, user) {
    if (err) { return handleError(res, err); }
    if(!user) { return res.send(404); }
    // User is completely overridden with each call
    var updated = _.merge(user, req.body, function(a,b) {
        return b;
    });

    updated.save(function (err) {
        User.findOne({uid: req.params.uid}).populate('prev_coursework').exec(function (err, user) {
            if(err) { return handleError(res, err); }
            if(!user) { return res.send(404); }
            var opts = [{path: 'schedules.major', model: 'Major'},
                {path: 'schedules.semesters.courses', model: 'Course'}];
            User.populate(user, opts, function (err, user) {
                var opts = [{path: 'schedules.major.requirements.courses', model: 'Course'}];
                User.populate(user, opts, function(err, user) {
                    cache.put(user.uid, user, 10000);
                    return res.json(user);
                });
            });
        });
    });
  });
};

// Deletes a user from the DB.
exports.destroy = function(req, res) {
  cache.del(req.params.uid);
  cache.del('all-users');

  User.findOne({uid: req.params.uid}, function (err, user) {
    if(err) { return handleError(res, err); }
    if(!user) { return res.send(404); }
    user.remove(function(err) {
      if(err) { return handleError(res, err); }
      return res.send(204);
    });
  });
};

function handleError(res, err) {
  return res.send(500, err);
}
