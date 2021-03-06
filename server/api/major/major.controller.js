'use strict';

var _ = require('lodash');
var Major = require('./major.model');
var cache = require('memory-cache');
var cachePrefix = 'major-';

// Get list of majors
exports.index = function(req, res) {
  var cached = cache.get('all-majors');
  if (cached) { return res.json(200, cached); }

  Major.find({}, 'name', function (err, majors) {
    if(err) { return handleError(res, err); }
    cache.put('all-majors', majors, 10000);
    return res.json(200, majors);
  });
};

// Get a single major
exports.show = function(req, res) {
    var cached = cache.get(cachePrefix+req.params.id);
    if (cached) { return res.json(200, cached); }

    Major.findById(req.params.id).exec(function (err, major) {
        if(err) { return handleError(res, err); }
        if(!major) { return res.send(404); }
        var opts = [{path: 'requirements.courses', model: 'Course'}];
        Major.populate(major, opts, function (err, major) {
                cache.put(cachePrefix+major._id, major, 10000);
                return res.json(major);
        });
    });
};

// Creates a new major in the DB.
exports.create = function(req, res) {
  Major.create(req.body, function(err, major) {
    if(err) { return handleError(res, err); }
    cache.del('all-majors');
    cache.put(cachePrefix+major._id, major, 10000);
    return res.json(201, major);
  });
};

// Updates an existing major in the DB.
exports.update = function(req, res) {
  cache.del('all-majors');
  cache.del(cachePrefix+req.body._id);

  if(req.body._id) { delete req.body._id; }
  Major.findById(req.params.id, function (err, major) {
    if (err) { return handleError(res, err); }
    if(!major) { return res.send(404); }
      var updated = _.merge(major, req.body, function(a,b){
          return b;
      });
    updated.save(function (err) {
      if (err) { return handleError(res, err); }
      cache.put(cachePrefix+major._id, major, 10000);
      return res.json(200, major);
    });
  });
};

// Deletes a major from the DB.
exports.destroy = function(req, res) {
  cache.del('all-majors');
  cache.del(cachePrefix+req.params.id);

  Major.findById(req.params.id, function (err, major) {
    if(err) { return handleError(res, err); }
    if(!major) { return res.send(404); }
    major.remove(function(err) {
      if(err) { return handleError(res, err); }
      return res.send(204);
    });
  });
};

function handleError(res, err) {
  return res.send(500, err);
}